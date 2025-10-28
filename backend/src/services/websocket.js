const { Server } = require('socket.io');
const { getAuth } = require('../config/firebase');
const User = require('../models/User');
const aiService = require('./aiService');
const vectorService = require('./vectorService');
const voiceService = require('./voiceService');

let io = null;

const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware for WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify Firebase ID token
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(token);
      
      // Get user from Firestore
      const user = await User.findById(decodedToken.uid);
      
      if (!user || !user.isActive) {
        return next(new Error('Invalid or inactive user'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected via WebSocket`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Handle voice questions during lesson
    socket.on('voice_question', async (data) => {
      try {
        const { audioData, documentId, lessonContext } = data;
        
        // Convert audio to text
        const transcription = await voiceService.speechToText(audioData);
        
        // Search for relevant chunks
        const relevantChunks = await vectorService.searchSimilarChunks(
          transcription.text, 
          documentId, 
          3
        );

        // Generate AI response
        const aiResponse = await aiService.answerQuestion(
          transcription.text,
          relevantChunks,
          lessonContext
        );

        // Convert response to speech
        const audioResponse = await voiceService.textToSpeech(aiResponse);

        // Send response back to client
        socket.emit('voice_response', {
          text: aiResponse,
          audioUrl: audioResponse.filepath,
          duration: audioResponse.duration
        });

      } catch (error) {
        console.error('Voice question error:', error);
        socket.emit('error', { message: 'Failed to process voice question' });
      }
    });

    // Handle real-time lesson streaming
    socket.on('start_lesson', async (data) => {
      try {
        const { documentId, lessonScript } = data;
        
        // Stream lesson content
        const sections = lessonScript.sections || [];
        
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          
          // Send section to client
          socket.emit('lesson_section', {
            sectionIndex: i,
            title: section.title,
            content: section.content,
            isLast: i === sections.length - 1
          });

          // Convert to speech and send audio
          const audioData = await voiceService.textToSpeech(section.content);
          
          socket.emit('lesson_audio', {
            sectionIndex: i,
            audioUrl: audioData.filepath,
            duration: audioData.duration
          });

          // Wait for user to finish listening (or implement pause/resume)
          await new Promise(resolve => setTimeout(resolve, audioData.duration * 1000));
        }

        // End lesson
        socket.emit('lesson_complete', {
          summary: lessonScript.summary,
          nextStep: 'quiz'
        });

      } catch (error) {
        console.error('Lesson streaming error:', error);
        socket.emit('error', { message: 'Failed to stream lesson' });
      }
    });

    // Handle quiz interactions
    socket.on('quiz_answer', async (data) => {
      try {
        const { questionId, answer, questionType } = data;
        
        // For essay/short answer questions, use AI grading
        if (questionType === 'essay' || questionType === 'short_answer') {
          const grading = await aiService.gradeAnswer(
            `Question: ${data.question}`,
            answer
          );
          
          socket.emit('quiz_feedback', {
            questionId,
            score: grading.score,
            feedback: grading.feedback,
            suggestions: grading.suggestions
          });
        } else {
          // For multiple choice, handle immediately
          socket.emit('quiz_feedback', {
            questionId,
            isCorrect: data.isCorrect,
            explanation: data.explanation
          });
        }

      } catch (error) {
        console.error('Quiz answer error:', error);
        socket.emit('error', { message: 'Failed to process quiz answer' });
      }
    });

    // Handle voice commands
    socket.on('voice_command', async (data) => {
      try {
        const { audioData, command } = data;
        
        const transcription = await voiceService.speechToText(audioData);
        
        // Process voice commands
        const response = await processVoiceCommand(transcription.text, socket.user);
        
        socket.emit('command_response', {
          command: transcription.text,
          response: response.text,
          audioUrl: response.audioUrl
        });

      } catch (error) {
        console.error('Voice command error:', error);
        socket.emit('error', { message: 'Failed to process voice command' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from WebSocket`);
    });
  });

  return io;
};

// Process voice commands
const processVoiceCommand = async (command, user) => {
  const lowerCommand = command.toLowerCase();
  
  let response = '';
  
  if (lowerCommand.includes('pause') || lowerCommand.includes('stop')) {
    response = 'Lesson paused. Say "resume" to continue.';
  } else if (lowerCommand.includes('resume') || lowerCommand.includes('continue')) {
    response = 'Resuming lesson...';
  } else if (lowerCommand.includes('repeat') || lowerCommand.includes('again')) {
    response = 'Repeating the last section...';
  } else if (lowerCommand.includes('help')) {
    response = 'You can say pause, resume, repeat, or ask questions about the content.';
  } else {
    response = 'I didn\'t understand that command. Try saying pause, resume, or ask a question about the lesson.';
  }

  // Convert response to speech
  const audioData = await voiceService.textToSpeech(response);
  
  return {
    text: response,
    audioUrl: audioData.filepath
  };
};

// Broadcast to specific user
const broadcastToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

// Broadcast to all connected users
const broadcastToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  initializeWebSocket,
  broadcastToUser,
  broadcastToAll
};
