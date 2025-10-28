const express = require('express');
const Quiz = require('../models/Quiz');
const Document = require('../models/Document');
const User = require('../models/User');
const aiService = require('../services/aiService');
const { authenticateToken, checkSubscription, incrementQueryCount } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/quiz/generate:
 *   post:
 *     summary: Generate quiz from document
 *     tags: [Quiz]
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
 *               questionCount:
 *                 type: integer
 *                 default: 5
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *     responses:
 *       200:
 *         description: Quiz generated successfully
 *       404:
 *         description: Document not found
 */
router.post('/generate', authenticateToken, checkSubscription, incrementQueryCount, async (req, res) => {
  try {
    const { documentId, questionCount = 5, difficulty = 'medium' } = req.body;

    console.log('Quiz generation - Document ID:', documentId);
    console.log('Quiz generation - User ID:', req.user.id);

    // Get document
    const document = await Document.findOne({
      id: documentId,
      userId: req.user.id,
      isActive: true,
      processingStatus: 'completed'
    });

    if (!document) {
      console.log('Quiz generation - Document not found');
      return res.status(404).json({
        error: 'Document not found or not processed'
      });
    }

    console.log('Quiz generation - Document found:', document.originalName);

    // Generate quiz using AI
    const quizData = await aiService.generateQuiz(
      document.extractedText,
      document.metadata.subject,
      questionCount
    );

    console.log('Quiz generation - AI generated quiz data:', quizData);

    // Create quiz record
    const quiz = new Quiz({
      documentId: document.id,
      userId: req.user.id,
      title: `Quiz: ${document.originalName}`,
      description: `Generated quiz based on ${document.metadata.subject}`,
      questions: quizData.questions.map((q, index) => ({
        id: `q_${index + 1}`, // Add unique ID for each question
        type: q.type,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty || difficulty,
        points: q.points || 1
      })),
      timeLimit: Math.max(questionCount * 2, 10), // 2 minutes per question, minimum 10 minutes
      passingScore: 70
    });

    await quiz.save();

    console.log('Quiz generation - Quiz saved with ID:', quiz.id);

    res.json({
      message: 'Quiz generated successfully',
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        questions: quiz.questions.map(q => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          points: q.points
        }))
      }
    });

  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({
      error: 'Failed to generate quiz',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/quiz/{id}:
 *   get:
 *     summary: Get quiz by ID
 *     tags: [Quiz]
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
 *         description: Quiz retrieved successfully
 *       404:
 *         description: Quiz not found
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Quiz route - Getting quiz by ID:', req.params.id);
    console.log('Quiz route - User ID:', req.user.id);

    const quiz = await Quiz.findOne({
      id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!quiz) {
      console.log('Quiz route - Quiz not found');
      return res.status(404).json({
        error: 'Quiz not found'
      });
    }

    console.log('Quiz route - Quiz found:', quiz.title);

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        questions: quiz.questions.map(q => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          points: q.points
        })),
        totalPoints: quiz.totalPoints,
        createdAt: quiz.createdAt
      }
    });

  } catch (error) {
    console.error('Quiz fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch quiz',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/quiz/{id}/submit:
 *   post:
 *     summary: Submit quiz answers
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     answer:
 *                       type: string
 *               timeSpent:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Quiz submitted successfully
 *       404:
 *         description: Quiz not found
 */
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { answers, timeSpent } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        error: 'Answers array is required'
      });
    }

    // Get quiz
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!quiz) {
      return res.status(404).json({
        error: 'Quiz not found'
      });
    }

    // Process answers and calculate score
    const processedAnswers = [];
    let totalScore = 0;
    let correctAnswers = 0;

    for (const answer of answers) {
      const question = quiz.questions.id(answer.questionId);
      if (!question) continue;

      let isCorrect = false;
      let points = 0;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        isCorrect = question.correctAnswer.toLowerCase().trim() === answer.answer.toLowerCase().trim();
        points = isCorrect ? question.points : 0;
      } else if (question.type === 'short_answer') {
        // Use fuzzy matching for short answers
        isCorrect = quiz.fuzzyMatch(question.correctAnswer, answer.answer);
        points = isCorrect ? question.points : 0;
      } else if (question.type === 'essay') {
        // For essay questions, use AI grading
        try {
          const grading = await aiService.gradeAnswer(
            question.question,
            answer.answer,
            question.explanation
          );
          points = Math.round((grading.score / 100) * question.points);
          isCorrect = grading.score >= 70; // 70% threshold
        } catch (error) {
          console.error('AI grading error:', error);
          points = 0;
          isCorrect = false;
        }
      }

      if (isCorrect) {
        correctAnswers++;
      }

      totalScore += points;

      processedAnswers.push({
        questionId: answer.questionId,
        answer: answer.answer,
        isCorrect,
        points
      });
    }

    const percentage = Math.round((totalScore / quiz.totalPoints) * 100);
    const passed = percentage >= quiz.passingScore;

    // Add attempt to quiz
    await quiz.addAttempt(req.user._id, answers, timeSpent);

    // Update user's skill score if they passed
    if (passed) {
      const document = await Document.findById(quiz.documentId);
      if (document) {
        await req.user.updateSkillScore(
          document.metadata.subject,
          percentage
        );
      }
    }

    res.json({
      message: 'Quiz submitted successfully',
      results: {
        score: totalScore,
        percentage,
        correctAnswers,
        totalQuestions: quiz.questions.length,
        passed,
        passingScore: quiz.passingScore,
        timeSpent,
        answers: processedAnswers
      }
    });

  } catch (error) {
    console.error('Quiz submission error:', error);
    res.status(500).json({
      error: 'Failed to submit quiz',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/quiz/{id}/attempts:
 *   get:
 *     summary: Get quiz attempts
 *     tags: [Quiz]
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
 *         description: Quiz attempts retrieved successfully
 */
router.get('/:id/attempts', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!quiz) {
      return res.status(404).json({
        error: 'Quiz not found'
      });
    }

    const userAttempts = quiz.attempts.filter(attempt => 
      attempt.userId.toString() === req.user._id.toString()
    );

    res.json({
      attempts: userAttempts.map(attempt => ({
        id: attempt._id,
        score: attempt.score,
        percentage: attempt.percentage,
        completedAt: attempt.completedAt,
        timeSpent: attempt.timeSpent,
        answers: attempt.answers
      })),
      bestAttempt: quiz.getUserBestAttempt(req.user._id),
      totalAttempts: userAttempts.length
    });

  } catch (error) {
    console.error('Quiz attempts fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch quiz attempts',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/quiz:
 *   get:
 *     summary: Get user's quizzes
 *     tags: [Quiz]
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
 *     responses:
 *       200:
 *         description: Quizzes retrieved successfully
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log('Quiz route - User ID:', req.user.id);
    console.log('Quiz route - User object:', req.user);

    const quizzes = await Quiz.find({
      userId: req.user.id,
      isActive: true
    }, {
      limit: limit,
      offset: skip,
      sort: { field: 'createdAt', direction: 'desc' }
    });

    console.log('Quiz route - Found quizzes:', quizzes.length);

    const total = await Quiz.countDocuments({
      userId: req.user.id,
      isActive: true
    });

    res.json({
      quizzes: quizzes.map(quiz => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        totalPoints: quiz.totalPoints,
        attempts: quiz.attempts.length,
        bestScore: quiz.getUserBestAttempt(req.user.id)?.percentage || 0,
        document: quiz.documentId,
        createdAt: quiz.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Quizzes fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch quizzes',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/quiz/{id}:
 *   delete:
 *     summary: Delete quiz
 *     tags: [Quiz]
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
 *         description: Quiz deleted successfully
 *       404:
 *         description: Quiz not found
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!quiz) {
      return res.status(404).json({
        error: 'Quiz not found'
      });
    }

    quiz.isActive = false;
    await quiz.save();

    res.json({
      message: 'Quiz deleted successfully'
    });

  } catch (error) {
    console.error('Quiz deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete quiz',
      message: error.message
    });
  }
});

module.exports = router;
