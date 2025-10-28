const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const voiceService = require('../services/voiceService');
const { authenticateToken } = require('../middleware/auth');
const Document = require('../models/Document');

// Generate comprehensive lecture with flowcharts
router.post('/generate-lecture', authenticateToken, async (req, res) => {
  try {
    const { documentId, difficulty = 'intermediate' } = req.body;

    if (!documentId) {
      return res.status(400).json({
        error: 'Document ID is required'
      });
    }

    // Get document from database
    const Document = require('../models/Document');
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

    // Generate comprehensive lecture script
    const lectureScript = await aiService.generateLectureScript(
      document.extractedText,
      document.metadata.subject || 'General',
      difficulty
    );

    // Handle different lecture formats
    if (lectureScript.lectures) {
      // Individual slide-based lectures format (L1, L2, L3...)
      console.log('📚 Processing individual slide-based lectures...');
      
      // Generate TTS scripts for each lecture's slide
      for (let lecture of lectureScript.lectures) {
        if (lecture.slide) {
          lecture.slide.ttsScript = await aiService.generateTTScript(
            lecture.slide.content,
            lecture.slide.title,
            lecture.slide.animation
          );
        }
      }
      
      res.json({
        success: true,
        lecture: lectureScript,
        document: {
          id: document.id,
          name: document.originalName,
          subject: document.metadata.subject
        }
      });
    } else if (lectureScript.slides) {
      // Traditional comprehensive lecture format
      console.log('📚 Processing comprehensive lecture...');
      
      // Generate TTS scripts for each slide
      for (let slide of lectureScript.slides) {
        slide.ttsScript = await aiService.generateTTScript(
          slide.content,
          slide.title,
          slide.animation
        );
      }

      res.json({
        success: true,
        lecture: lectureScript,
        document: {
          id: document.id,
          title: document.originalName,
          subject: document.metadata.subject
        }
      });
    } else {
      throw new Error('Invalid lecture format returned from AI service');
    }

  } catch (error) {
    console.error('Lecture generation error:', error);
    res.status(500).json({
      error: 'Failed to generate lecture',
      message: error.message
    });
  }
});

// Handle interactive Q&A during lecture
router.post('/interactive-qa', authenticateToken, async (req, res) => {
  try {
    const { 
      question, 
      lectureContext, 
      slideContext, 
      conversationHistory = [] 
    } = req.body;

    if (!question || !lectureContext || !slideContext) {
      return res.status(400).json({
        error: 'Question, lecture context, and slide context are required'
      });
    }

    // Handle the interactive question with context
    const response = await aiService.handleInteractiveQuestion(
      question,
      lectureContext,
      slideContext,
      conversationHistory
    );

    res.json({
      success: true,
      response
    });

  } catch (error) {
    console.error('Interactive Q&A error:', error);
    res.status(500).json({
      error: 'Failed to process question',
      message: error.message
    });
  }
});

// Convert text to speech for lecture narration
router.post('/text-to-speech', authenticateToken, async (req, res) => {
  try {
    const { text, voice = 'alloy', speed = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Text is required for TTS conversion'
      });
    }

    // Generate audio using voice service
    const audioBuffer = await voiceService.textToSpeech(text, voice, speed);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error('TTS conversion error:', error);
    res.status(500).json({
      error: 'Failed to convert text to speech',
      message: error.message
    });
  }
});

// Save lecture progress
router.post('/save-progress', authenticateToken, async (req, res) => {
  try {
    const { 
      lectureId, 
      currentSlide, 
      progress, 
      conversationHistory 
    } = req.body;

    // Save progress to database (implement based on your needs)
    // This could be stored in Firestore or a separate collection
    
    res.json({
      success: true,
      message: 'Progress saved successfully'
    });

  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({
      error: 'Failed to save progress',
      message: error.message
    });
  }
});

// Resume lecture from saved progress
router.get('/resume/:lectureId', authenticateToken, async (req, res) => {
  try {
    const { lectureId } = req.params;

    // Retrieve saved progress from database
    // This would fetch the lecture state, current slide, etc.
    
    res.json({
      success: true,
      lectureState: {
        currentSlide: 1,
        progress: 0.25,
        conversationHistory: []
      }
    });

  } catch (error) {
    console.error('Resume lecture error:', error);
    res.status(500).json({
      error: 'Failed to resume lecture',
      message: error.message
    });
  }
});

module.exports = router;

// Generate flashcards from document or raw text using OpenRouter
router.post('/flashcards', authenticateToken, async (req, res) => {
  try {
    const { documentId, text, count = 12 } = req.body;

    if (!documentId && !text) {
      return res.status(400).json({ error: 'Provide documentId or text' });
    }

    let sourceText = text;
    if (documentId) {
      const doc = await Document.findOne({ id: documentId, userId: req.user.id, isActive: true });
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      if (doc.processingStatus !== 'completed') {
        return res.status(400).json({ error: 'Document is still being processed', status: doc.processingStatus });
      }
      sourceText = doc.extractedText;
    }

    const result = await aiService.generateFlashcards(sourceText, count);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Flashcards generation error:', error);
    res.status(500).json({ error: 'Failed to generate flashcards', message: error.message });
  }
});
