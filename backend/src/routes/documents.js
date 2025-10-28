const express = require('express');
const Document = require('../models/Document');
const documentProcessor = require('../services/documentProcessor');
const vectorService = require('../services/vectorService');
const { authenticateToken, checkSubscription, incrementQueryCount } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload and process a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               subject:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *     responses:
 *       200:
 *         description: Document uploaded and processed successfully
 *       400:
 *         description: Invalid file or processing error
 */
router.post('/upload', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const upload = documentProcessor.getUploadMiddleware().single('file');
    
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: 'File upload error',
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file provided'
        });
      }

      try {
        // Determine file type properly
        const getFileType = (mimetype, originalname) => {
          if (mimetype === 'text/plain' || originalname.endsWith('.txt')) return 'txt';
          if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) return 'pdf';
          if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalname.endsWith('.docx')) return 'docx';
          if (mimetype.startsWith('image/')) return 'image';
          return mimetype.split('/')[1];
        };

        // Create document record
        const document = new Document({
          userId: req.user.id, // Use req.user.id instead of req.user._id
          filename: req.file.filename,
          originalName: req.file.originalname,
          fileType: getFileType(req.file.mimetype, req.file.originalname),
          fileSize: req.file.size,
          filePath: req.file.path,
          extractedText: '', // Will be updated after processing
          metadata: {
            subject: req.body.subject || 'General',
            difficulty: req.body.difficulty || 'intermediate'
          }
        });

        await document.save();
        console.log(`📄 Document saved with ID: ${document.id}`);

        // Process document asynchronously
        console.log(`🚀 Starting async processing for document ${document.id}...`);
        processDocumentAsync(document.id, req.file.path, document.fileType); // Use document.id

        res.json({
          message: 'Document uploaded successfully',
          documentId: document.id, // Use document.id
          status: 'processing',
          filename: document.originalName
        });

      } catch (error) {
        console.error('Document creation error:', error);
        res.status(500).json({
          error: 'Failed to create document record',
          message: error.message
        });
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Async document processing
const processDocumentAsync = async (documentId, filePath, fileType) => {
  console.log(`🚀 Starting document processing for ${documentId}...`);
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      console.error(`❌ Document ${documentId} not found`);
      return;
    }

    console.log(`📄 Document found, updating status to processing...`);
    // Update status to processing
    await document.updateProcessingStatus('processing');

    console.log(`🔧 Processing document with processor...`);
    // Process document
    const result = await documentProcessor.processDocument(documentId, filePath, fileType);

    console.log(`✅ Document processing completed, updating document...`);
    // Update document with extracted text and metadata
    document.extractedText = result.extractedText;
    document.metadata = {
      ...document.metadata,
      ...result.metadata
    };

    // Store chunks in vector database
    if (result.chunks.length > 0) {
      try {
        // Ensure vector service is connected
        if (!vectorService.connected) {
          await vectorService.connect();
        }
        
        await vectorService.storeDocumentChunks(documentId, result.chunks);
        
        // Update document with chunks
        document.chunks = result.chunks.map(chunk => ({
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata
        }));
      } catch (vectorError) {
        console.error('Vector storage error (using fallback):', vectorError);
        // Continue processing even if vector storage fails
        document.chunks = result.chunks.map(chunk => ({
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata
        }));
      }
    }

    // Mark as completed
    await document.updateProcessingStatus('completed');

    console.log(`Document ${documentId} processed successfully`);

  } catch (error) {
    console.error(`Document processing error for ${documentId}:`, error);
    
    try {
      const document = await Document.findById(documentId);
      if (document) {
        await document.updateProcessingStatus('failed', error.message);
      }
    } catch (updateError) {
      console.error('Failed to update document status:', updateError);
    }
  }
};

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get user's documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📚 Fetching documents for user:', req.user.id);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const subject = req.query.subject;
    const skip = (page - 1) * limit;

    // For now, return empty array if Firebase is not connected
    // This allows the frontend to work without crashing
    try {
      const documents = await Document.findByUserId(req.user.id, {
        limit: limit,
        offset: skip,
        subject: subject
      });

      const total = await Document.countDocuments({
        userId: req.user.id,
        isActive: true
      });

      console.log('📚 Found documents:', documents.length);
      
      res.json({
        documents,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (dbError) {
      console.error('Database error, returning empty result:', dbError.message);
      // Return empty result instead of crashing
      res.json({
        documents: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      });
    }

  } catch (error) {
    console.error('Documents fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get document by ID
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *       404:
 *         description: Document not found
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const document = await Document.findOne({
      id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    res.json({
      document: {
        id: document.id,
        filename: document.originalName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        processingStatus: document.processingStatus,
        processingError: document.processingError,
        extractedText: document.extractedText,
        chunks: document.chunks,
        metadata: document.metadata,
        chunkCount: document.chunkCount,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }
    });

  } catch (error) {
    console.error('Document fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     summary: Delete document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Document not found
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const document = await Document.findOne({
      id: req.params.id,
      userId: req.user.id
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    // Delete from vector database
    await vectorService.deleteDocumentChunks(document.id);

    // Mark as inactive
    document.isActive = false;
    await document.save();

    res.json({
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Document deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/documents/{id}/status:
 *   get:
 *     summary: Get document processing status
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 */
router.get('/:id/status', authenticateToken, async (req, res) => {
  try {
    const document = await Document.findOne({
      id: req.params.id,
      userId: req.user.id
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    res.json({
      status: document.processingStatus,
      error: document.processingError,
      chunkCount: document.chunkCount,
      isReady: document.processingStatus === 'completed'
    });

  } catch (error) {
    console.error('Status fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch status',
      message: error.message
    });
  }
});

module.exports = router;
