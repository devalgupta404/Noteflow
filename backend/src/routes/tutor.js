const express = require('express');
const Document = require('../models/Document');
const aiService = require('../services/aiService');
const vectorService = require('../services/vectorService');
const { authenticateToken, checkSubscription, incrementQueryCount } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/tutor/generate-lesson:
 *   post:
 *     summary: Generate AI lesson script from document
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *     responses:
 *       200:
 *         description: Lesson script generated successfully
 *       404:
 *         description: Document not found
 */
router.post('/generate-lesson', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { documentId, difficulty = 'intermediate' } = req.body;

    if (!documentId) {
      return res.status(400).json({
        error: 'Document ID is required'
      });
    }

    // Get document from database
    const document = await Document.findOne({
      id: documentId,
      userId: req.user.id,
      isActive: true
    });
    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    if (document.processingStatus !== 'completed') {
      return res.status(400).json({
        error: 'Document is still being processed',
        status: document.processingStatus
      });
    }

    // Generate lesson script using AI
    const lessonScript = await aiService.generateLectureScript(
      document.extractedText,
      document.metadata.subject || 'General',
      difficulty
    );

    res.json({
      success: true,
      script: lessonScript,
      document: {
        id: document.id,
        title: document.originalName,
        subject: document.metadata.subject
      }
    });

  } catch (error) {
    console.error('Lesson generation error:', error);
    res.status(500).json({
      error: 'Failed to generate lesson script',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tutor/ask-question:
 *   post:
 *     summary: Ask AI tutor a question about the document
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - documentId
 *             properties:
 *               question:
 *                 type: string
 *               documentId:
 *                 type: string
 *               context:
 *                 type: string
 *     responses:
 *       200:
 *         description: Question answered successfully
 *       404:
 *         description: Document not found
 */
router.post('/ask-question', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { question, documentId, context } = req.body;

    if (!question || !documentId) {
      return res.status(400).json({
        error: 'Question and documentId are required'
      });
    }

    // Get document
    const document = await Document.findOne({
      id: documentId,
      userId: req.user.id,
      isActive: true,
      processingStatus: 'completed'
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found or not processed'
      });
    }

    // Search for relevant chunks
    const relevantChunks = await vectorService.searchSimilarChunks(
      question,
      documentId,
      5
    );

    if (relevantChunks.length === 0) {
      return res.json({
        answer: "I couldn't find relevant information in the document to answer your question. Please try rephrasing your question or ask about a different topic.",
        sources: [],
        confidence: 0
      });
    }

    // Generate AI response
    const answer = await aiService.answerQuestion(
      question,
      relevantChunks,
      context
    );

    res.json({
      answer,
      sources: relevantChunks.map(chunk => ({
        content: chunk.content.substring(0, 200) + '...',
        score: chunk.score
      })),
      confidence: Math.round(relevantChunks[0].score * 100)
    });

  } catch (error) {
    console.error('Question answering error:', error);
    res.status(500).json({
      error: 'Failed to answer question',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tutor/chat:
 *   post:
 *     summary: Start a chat session with AI tutor
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: string
 *               message:
 *                 type: string
 *               chatHistory:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Chat response generated successfully
 */
router.post('/chat', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { documentId, message, chatHistory = [] } = req.body;

    if (!documentId || !message) {
      return res.status(400).json({
        error: 'DocumentId and message are required'
      });
    }

    // Get document
    const document = await Document.findOne({
      id: documentId,
      userId: req.user.id,
      isActive: true,
      processingStatus: 'completed'
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found or not processed'
      });
    }

    // Search for relevant chunks based on current message
    const relevantChunks = await vectorService.searchSimilarChunks(
      message,
      documentId,
      3
    );

    // Build context from chat history and relevant chunks
    const context = buildChatContext(chatHistory, relevantChunks);

    // Generate AI response
    const response = await aiService.answerQuestion(
      message,
      relevantChunks,
      context
    );

    res.json({
      response,
      sources: relevantChunks.map(chunk => ({
        content: chunk.content.substring(0, 150) + '...',
        score: chunk.score
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      message: error.message
    });
  }
});

// Build context from chat history and relevant chunks
const buildChatContext = (chatHistory, relevantChunks) => {
  let context = 'Previous conversation:\n';
  
  chatHistory.slice(-5).forEach((msg, index) => {
    context += `${index + 1}. User: ${msg.user}\n`;
    context += `   AI: ${msg.ai}\n\n`;
  });

  context += 'Relevant information from the document:\n';
  relevantChunks.forEach((chunk, index) => {
    context += `${index + 1}. ${chunk.content}\n`;
  });

  return context;
};

/**
 * @swagger
 * /api/tutor/summarize:
 *   post:
 *     summary: Generate document summary
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: string
 *               length:
 *                 type: string
 *                 enum: [short, medium, long]
 *     responses:
 *       200:
 *         description: Summary generated successfully
 */
router.post('/summarize', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { documentId, length = 'medium' } = req.body;

    // Get document
    const document = await Document.findOne({
      id: documentId,
      userId: req.user.id,
      isActive: true,
      processingStatus: 'completed'
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found or not processed'
      });
    }

    // Generate summary using AI
    const summary = await generateDocumentSummary(
      document.extractedText,
      document.metadata.subject,
      length
    );

    res.json({
      summary,
      document: {
        id: document.id,
        title: document.originalName,
        subject: document.metadata.subject
      },
      length
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      message: error.message
    });
  }
});

// Generate document summary
const generateDocumentSummary = async (content, subject, length) => {
  const lengthInstructions = {
    short: 'in 2-3 sentences',
    medium: 'in 1-2 paragraphs',
    long: 'in 3-4 paragraphs'
  };

  const prompt = `
    Create a comprehensive summary of the following document about ${subject}.
    Please summarize the key points ${lengthInstructions[length]}.
    
    Document content:
    ${content}
    
    Focus on:
    1. Main concepts and ideas
    2. Key facts and details
    3. Important relationships between concepts
    4. Practical applications or implications
  `;

  try {
    const response = await aiService.generateLectureScript(content, subject);
    return response.summary || 'Summary generated successfully';
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Unable to generate summary at this time.';
  }
};

/**
 * @swagger
 * /api/tutor/outline:
 *   post:
 *     summary: Generate document outline
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Outline generated successfully
 */
router.post('/outline', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { documentId } = req.body;

    // Get document
    const document = await Document.findOne({
      id: documentId,
      userId: req.user.id,
      isActive: true,
      processingStatus: 'completed'
    });

    if (!document) {
      return res.status(404).json({
        error: 'Document not found or not processed'
      });
    }

    // Generate outline using AI
    const outline = await generateDocumentOutline(
      document.extractedText,
      document.metadata.subject
    );

    res.json({
      outline,
      document: {
        id: document.id,
        title: document.originalName,
        subject: document.metadata.subject
      }
    });

  } catch (error) {
    console.error('Outline generation error:', error);
    res.status(500).json({
      error: 'Failed to generate outline',
      message: error.message
    });
  }
});

// Generate document outline
const generateDocumentOutline = async (content, subject) => {
  const prompt = `
    Create a detailed outline of the following document about ${subject}.
    Organize the content into a hierarchical structure with main topics and subtopics.
    
    Document content:
    ${content}
    
    Format the outline as a structured list with:
    - Main topics (I, II, III...)
    - Subtopics (A, B, C...)
    - Key points (1, 2, 3...)
  `;

  try {
    const response = await aiService.generateLectureScript(content, subject);
    return response.sections || [
      { title: "Introduction", content: "Overview of the topic" },
      { title: "Main Concepts", content: "Key ideas and principles" },
      { title: "Conclusion", content: "Summary and implications" }
    ];
  } catch (error) {
    console.error('Outline generation error:', error);
    return [
      { title: "Main Topic", content: "Key concepts from the document" }
    ];
  }
};

module.exports = router;
