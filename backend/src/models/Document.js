const { getFirestore } = require('../config/firebase');

class Document {
  constructor(data = {}) {
    this.id = data.id;
    this.userId = data.userId;
    this.filename = data.filename;
    this.originalName = data.originalName;
    this.fileType = data.fileType;
    this.fileSize = data.fileSize;
    this.filePath = data.filePath;
    this.extractedText = data.extractedText || '';
    this.chunks = data.chunks || [];
    this.metadata = {
      pageCount: data.metadata?.pageCount || 0,
      wordCount: data.metadata?.wordCount || 0,
      language: data.metadata?.language || 'en',
      subject: data.metadata?.subject || 'General',
      difficulty: data.metadata?.difficulty || 'intermediate'
    };
    this.processingStatus = data.processingStatus || 'uploaded';
    this.processingError = data.processingError;
    this.isActive = data.isActive !== false;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Save document to Firestore
  async save() {
    try {
      const db = getFirestore();
      const documentData = {
        userId: this.userId,
        filename: this.filename,
        originalName: this.originalName,
        fileType: this.fileType,
        fileSize: this.fileSize,
        filePath: this.filePath,
        extractedText: this.extractedText || '',
        chunks: this.chunks || [],
        metadata: this.metadata || {},
        processingStatus: this.processingStatus || 'uploaded',
        processingError: this.processingError || null,
        isActive: this.isActive !== false,
        createdAt: this.createdAt || new Date(),
        updatedAt: new Date()
      };

      // Remove undefined values to prevent Firestore errors
      Object.keys(documentData).forEach(key => {
        if (documentData[key] === undefined) {
          delete documentData[key];
        }
      });

      if (this.id) {
        // Update existing document
        await db.collection('documents').doc(this.id).update(documentData);
        this.updatedAt = new Date();
      } else {
        // Create new document
        const docRef = await db.collection('documents').add(documentData);
        this.id = docRef.id;
        this.createdAt = new Date();
        this.updatedAt = new Date();
      }

      return this;
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  }

  // Find document by ID
  static async findById(id) {
    try {
      const db = getFirestore();
      const doc = await db.collection('documents').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return new Document({ id: doc.id, ...data });
    } catch (error) {
      console.error('Error finding document by ID:', error);
      throw error;
    }
  }

  // Find documents by user ID
  static async findByUserId(userId, options = {}) {
    try {
      const db = getFirestore();
      if (!db) {
        console.log('⚠️ Firestore not available, returning empty array');
        return [];
      }
      
      // Simplified query to avoid composite index requirement
      let query = db.collection('documents')
        .where('userId', '==', userId);

      const snapshot = await query.get();
      
      // Filter and sort in memory to avoid Firestore index requirements
      let documents = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return new Document({ id: doc.id, ...data });
        })
        .filter(doc => doc.isActive === true); // Filter active documents

      // Apply subject filter
      if (options.subject) {
        documents = documents.filter(doc => 
          doc.metadata && doc.metadata.subject === options.subject
        );
      }

      // Sort by creation date
      documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      if (options.offset) {
        documents = documents.slice(options.offset);
      }
      if (options.limit) {
        documents = documents.slice(0, options.limit);
      }

      return documents;
    } catch (error) {
      console.error('Error finding documents by user ID:', error);
      // Return empty array instead of throwing error
      return [];
    }
  }

  // Find one document with filters
  static async findOne(filters) {
    try {
      const db = getFirestore();
      
      // If we have an ID filter, use direct document lookup
      if (filters.id) {
        const doc = await db.collection('documents').doc(filters.id).get();
        if (!doc.exists) {
          return null;
        }
        const data = doc.data();
        return new Document({ id: doc.id, ...data });
      }
      
      // For other filters, get all documents and filter in memory
      let query = db.collection('documents');
      
      // Use only userId filter to avoid composite index issues
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      const snapshot = await query.get();
      
      // Filter in memory to avoid Firestore index requirements
      let documents = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return new Document({ id: doc.id, ...data });
        })
        .filter(doc => {
          // Apply all filters in memory
          return Object.keys(filters).every(key => {
            if (key === 'id') return doc.id === filters[key];
            if (key === 'userId') return doc.userId === filters[key];
            if (key === 'isActive') return doc.isActive === filters[key];
            if (key === 'processingStatus') return doc.processingStatus === filters[key];
            return true;
          });
        });

      return documents.length > 0 ? documents[0] : null;
    } catch (error) {
      console.error('Error finding document:', error);
      throw error;
    }
  }

  // Count documents
  static async countDocuments(filters = {}) {
    try {
      const db = getFirestore();
      if (!db) {
        console.log('⚠️ Firestore not available, returning 0');
        return 0;
      }
      
      let query = db.collection('documents');

      // Use only userId filter to avoid composite index issues
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      const snapshot = await query.get();
      
      // Filter in memory to avoid Firestore index requirements
      const documents = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data };
        })
        .filter(doc => {
          // Apply all filters in memory
          return Object.keys(filters).every(key => {
            if (key === 'id') return doc.id === filters[key];
            if (key === 'userId') return doc.userId === filters[key];
            if (key === 'isActive') return doc.isActive === filters[key];
            if (key === 'processingStatus') return doc.processingStatus === filters[key];
            return true;
          });
        });

      return documents.length;
    } catch (error) {
      console.error('Error counting documents:', error);
      // Return 0 instead of throwing error
      return 0;
    }
  }

  // Get chunks for RAG
  getChunksForRAG(limit = 10) {
    return this.chunks.slice(0, limit).map(chunk => ({
      content: chunk.content,
      metadata: chunk.metadata
    }));
  }

  // Add chunk
  async addChunk(content, embedding, metadata = {}) {
    this.chunks.push({
      content,
      embedding,
      metadata: {
        chunkIndex: this.chunks.length,
        ...metadata
      }
    });
    return this.save();
  }

  // Update processing status
  async updateProcessingStatus(status, error = null) {
    this.processingStatus = status;
    if (error) {
      this.processingError = error;
    }
    return this.save();
  }

  // Get chunk count (virtual property)
  get chunkCount() {
    return this.chunks.length;
  }

  // Delete document
  async delete() {
    try {
      const db = getFirestore();
      await db.collection('documents').doc(this.id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Soft delete (mark as inactive)
  async softDelete() {
    this.isActive = false;
    return this.save();
  }

  // Get document data as plain object
  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      filename: this.filename,
      originalName: this.originalName,
      fileType: this.fileType,
      fileSize: this.fileSize,
      filePath: this.filePath,
      extractedText: this.extractedText,
      chunks: this.chunks,
      metadata: this.metadata,
      processingStatus: this.processingStatus,
      processingError: this.processingError,
      isActive: this.isActive,
      chunkCount: this.chunkCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Document;