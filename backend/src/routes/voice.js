const express = require('express');
const voiceService = require('../services/voiceService');
const { authenticateToken, checkSubscription, incrementQueryCount } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/voice/speech-to-text:
 *   post:
 *     summary: Convert speech to text
 *     tags: [Voice]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *               language:
 *                 type: string
 *                 default: en
 *     responses:
 *       200:
 *         description: Speech converted to text successfully
 *       400:
 *         description: Invalid audio file
 */
router.post('/speech-to-text', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const upload = require('multer')({
      storage: require('multer').memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
      },
      fileFilter: (req, file, cb) => {
        if (voiceService.validateAudioFile(file)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid audio format'));
        }
      }
    }).single('audio');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: 'Audio upload error',
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No audio file provided'
        });
      }

      try {
        const { language = 'en' } = req.body;
        const result = await voiceService.speechToText(req.file.buffer, language);

        res.json({
          text: result.text,
          language: result.language,
          duration: result.duration,
          confidence: result.confidence || 0.9
        });

      } catch (error) {
        console.error('Speech-to-text error:', error);
        res.status(500).json({
          error: 'Failed to convert speech to text',
          message: error.message
        });
      }
    });

  } catch (error) {
    console.error('Speech-to-text endpoint error:', error);
    res.status(500).json({
      error: 'Speech-to-text failed',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/voice/text-to-speech:
 *   post:
 *     summary: Convert text to speech
 *     tags: [Voice]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               voice:
 *                 type: string
 *                 enum: [alloy, echo, fable, onyx, nova, shimmer]
 *                 default: alloy
 *               format:
 *                 type: string
 *                 enum: [mp3, wav, ogg]
 *                 default: mp3
 *     responses:
 *       200:
 *         description: Text converted to speech successfully
 *       400:
 *         description: Invalid request
 */
router.post('/text-to-speech', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { text, voice = 'alloy', format = 'mp3' } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Text is required'
      });
    }

    if (text.length > 4096) {
      return res.status(400).json({
        error: 'Text too long. Maximum 4096 characters allowed.'
      });
    }

    const result = await voiceService.textToSpeech(text, voice, format);

    res.json({
      audioUrl: result.filepath,
      filename: result.filename,
      duration: result.duration,
      format: result.format,
      size: result.size || 0,
      provider: result.provider || 'unknown',
      language: result.language || 'en',
      cost: result.cost || 'FREE'
    });

  } catch (error) {
    console.error('Text-to-speech error:', error);
    res.status(500).json({
      error: 'Failed to convert text to speech',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/voice/streaming-tts:
 *   post:
 *     summary: Generate streaming TTS for real-time conversation
 *     tags: [Voice]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               voice:
 *                 type: string
 *                 default: alloy
 *     responses:
 *       200:
 *         description: Streaming TTS generated successfully
 */
router.post('/streaming-tts', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { text, voice = 'alloy' } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Text is required'
      });
    }

    const audioChunks = await voiceService.generateStreamingTTS(text, voice);

    res.json({
      chunks: audioChunks.map(chunk => ({
        audioUrl: chunk.filepath,
        duration: chunk.duration,
        text: chunk.text || ''
      })),
      totalDuration: audioChunks.reduce((total, chunk) => total + chunk.duration, 0)
    });

  } catch (error) {
    console.error('Streaming TTS error:', error);
    res.status(500).json({
      error: 'Failed to generate streaming TTS',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/voice/process-audio:
 *   post:
 *     summary: Process audio file for transcription
 *     tags: [Voice]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *               language:
 *                 type: string
 *                 default: en
 *     responses:
 *       200:
 *         description: Audio processed successfully
 */
router.post('/process-audio', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const upload = require('multer')({
      storage: require('multer').diskStorage({
        destination: './uploads/audio',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, 'audio-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
        }
      }),
      limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
      },
      fileFilter: (req, file, cb) => {
        if (voiceService.validateAudioFile(file)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid audio format'));
        }
      }
    }).single('audio');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: 'Audio upload error',
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No audio file provided'
        });
      }

      try {
        const { language = 'en' } = req.body;
        const result = await voiceService.processAudioFile(req.file.path, language);

        // Clean up file after processing
        await voiceService.cleanupAudioFile(req.file.path);

        res.json({
          text: result.text,
          language: result.language,
          duration: result.duration,
          confidence: result.confidence || 0.9
        });

      } catch (error) {
        console.error('Audio processing error:', error);
        res.status(500).json({
          error: 'Failed to process audio file',
          message: error.message
        });
      }
    });

  } catch (error) {
    console.error('Audio processing endpoint error:', error);
    res.status(500).json({
      error: 'Audio processing failed',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/voice/supported-formats:
 *   get:
 *     summary: Get supported audio formats
 *     tags: [Voice]
 *     responses:
 *       200:
 *         description: Supported formats retrieved successfully
 */
router.get('/supported-formats', (req, res) => {
  try {
    const formats = voiceService.getSupportedFormats();
    
    res.json({
      supportedFormats: formats,
      maxFileSize: '25MB',
      maxTextLength: 4096
    });

  } catch (error) {
    console.error('Formats fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch supported formats',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/voice/estimate-duration:
 *   post:
 *     summary: Estimate audio duration for text
 *     tags: [Voice]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Duration estimated successfully
 */
router.post('/estimate-duration', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Text is required'
      });
    }

    const duration = voiceService.estimateDuration(text);

    res.json({
      text,
      estimatedDuration: duration,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length
    });

  } catch (error) {
    console.error('Duration estimation error:', error);
    res.status(500).json({
      error: 'Failed to estimate duration',
      message: error.message
    });
  }
});

module.exports = router;
