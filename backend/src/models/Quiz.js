const { getFirestore } = require('../config/firebase');

class Quiz {
  constructor(data = {}) {
    this.id = data.id;
    this.documentId = data.documentId;
    this.userId = data.userId;
    this.title = data.title;
    this.description = data.description;
    this.questions = data.questions || [];
    this.totalPoints = data.totalPoints || 0;
    this.timeLimit = data.timeLimit || 30;
    this.passingScore = data.passingScore || 70;
    this.attempts = data.attempts || [];
    this.isActive = data.isActive !== false;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Save quiz to Firestore
  async save() {
    try {
      const db = getFirestore();
      
      // Calculate total points
      this.totalPoints = this.questions.reduce((total, question) => total + (question.points || 1), 0);

      // Sanitize attempts to avoid undefined values (Firestore rejects undefined)
      const sanitizedAttempts = (this.attempts || []).map(attempt => ({
        userId: attempt.userId || null,
        answers: Array.isArray(attempt.answers) ? attempt.answers : [],
        score: typeof attempt.score === 'number' ? attempt.score : 0,
        percentage: typeof attempt.percentage === 'number' ? attempt.percentage : 0,
        timeSpent: typeof attempt.timeSpent === 'number' ? attempt.timeSpent : 0,
        completedAt: attempt.completedAt || new Date()
      }));

      const quizData = {
        documentId: this.documentId,
        userId: this.userId,
        title: this.title,
        description: this.description ?? null,
        questions: this.questions,
        totalPoints: this.totalPoints,
        timeLimit: this.timeLimit,
        passingScore: this.passingScore,
        attempts: sanitizedAttempts,
        isActive: this.isActive,
        createdAt: this.createdAt,
        updatedAt: new Date()
      };

      if (this.id) {
        // Update existing quiz
        await db.collection('quizzes').doc(this.id).update(quizData);
        this.updatedAt = new Date();
      } else {
        // Create new quiz
        const docRef = await db.collection('quizzes').add(quizData);
        this.id = docRef.id;
        this.createdAt = new Date();
        this.updatedAt = new Date();
      }

      return this;
    } catch (error) {
      console.error('Error saving quiz:', error);
      throw error;
    }
  }

  // Find quiz by ID
  static async findById(id) {
    try {
      const db = getFirestore();
      const doc = await db.collection('quizzes').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return new Quiz({ id: doc.id, ...data });
    } catch (error) {
      console.error('Error finding quiz by ID:', error);
      throw error;
    }
  }

  // Find quizzes with filters (general find method)
  static async find(filters = {}, options = {}) {
    try {
      const db = getFirestore();
      let query = db.collection('quizzes');

      // Use only userId filter to avoid composite index issues
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      const snapshot = await query.get();
      
      // Filter in memory to avoid Firestore index requirements
      let quizzes = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return new Quiz({ id: doc.id, ...data });
        })
        .filter(quiz => {
          // Apply all filters in memory
          return Object.keys(filters).every(key => {
            if (key === 'id') return quiz.id === filters[key];
            if (key === 'userId') return quiz.userId === filters[key];
            if (key === 'isActive') return quiz.isActive === filters[key];
            return true;
          });
        });

      // Apply sorting
      if (options.sort) {
        quizzes.sort((a, b) => {
          const field = options.sort.field;
          const direction = options.sort.direction || 'desc';
          if (direction === 'desc') {
            return new Date(b[field]) - new Date(a[field]);
          } else {
            return new Date(a[field]) - new Date(b[field]);
          }
        });
      } else {
        // Default sort by createdAt desc
        quizzes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      // Apply pagination
      if (options.offset) {
        quizzes = quizzes.slice(options.offset);
      }
      if (options.limit) {
        quizzes = quizzes.slice(0, options.limit);
      }

      return quizzes;
    } catch (error) {
      console.error('Error finding quizzes:', error);
      throw error;
    }
  }

  // Find quizzes by user ID
  static async findByUserId(userId, options = {}) {
    try {
      const db = getFirestore();
      let query = db.collection('quizzes')
        .where('userId', '==', userId);

      const snapshot = await query.get();
      
      // Filter in memory to avoid Firestore index requirements
      let quizzes = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return new Quiz({ id: doc.id, ...data });
        })
        .filter(quiz => quiz.isActive === true);

      // Apply sorting
      quizzes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      if (options.offset) {
        quizzes = quizzes.slice(options.offset);
      }
      if (options.limit) {
        quizzes = quizzes.slice(0, options.limit);
      }

      return quizzes;
    } catch (error) {
      console.error('Error finding quizzes by user ID:', error);
      throw error;
    }
  }

  // Find one quiz with filters
  static async findOne(filters) {
    try {
      const db = getFirestore();
      
      // If we have an ID filter, use direct document lookup
      if (filters.id) {
        const doc = await db.collection('quizzes').doc(filters.id).get();
        if (!doc.exists) {
          return null;
        }
        const data = doc.data();
        return new Quiz({ id: doc.id, ...data });
      }
      
      // For other filters, get all documents and filter in memory
      let query = db.collection('quizzes');
      
      // Use only userId filter to avoid composite index issues
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      const snapshot = await query.get();
      
      // Filter in memory to avoid Firestore index requirements
      let quizzes = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return new Quiz({ id: doc.id, ...data });
        })
        .filter(quiz => {
          // Apply all filters in memory
          return Object.keys(filters).every(key => {
            if (key === 'id') return quiz.id === filters[key];
            if (key === 'userId') return quiz.userId === filters[key];
            if (key === 'isActive') return quiz.isActive === filters[key];
            return true;
          });
        });

      return quizzes.length > 0 ? quizzes[0] : null;
    } catch (error) {
      console.error('Error finding quiz:', error);
      throw error;
    }
  }

  // Count quizzes
  static async countDocuments(filters = {}) {
    try {
      const db = getFirestore();
      let query = db.collection('quizzes');

      // Use only userId filter to avoid composite index issues
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      const snapshot = await query.get();
      
      // Filter in memory to avoid Firestore index requirements
      let quizzes = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return new Quiz({ id: doc.id, ...data });
        })
        .filter(quiz => {
          // Apply all filters in memory
          return Object.keys(filters).every(key => {
            if (key === 'id') return quiz.id === filters[key];
            if (key === 'userId') return quiz.userId === filters[key];
            if (key === 'isActive') return quiz.isActive === filters[key];
            return true;
          });
        });

      return quizzes.length;
    } catch (error) {
      console.error('Error counting quizzes:', error);
      throw error;
    }
  }

  // Add attempt
  async addAttempt(userId, answers, timeSpent) {
    let score = 0;
    let correctAnswers = 0;
    
    const attemptAnswers = answers.map(answer => {
      const question = this.questions.find(q => q.id === answer.questionId);
      if (!question) return null;
      
      const isCorrect = answer.answer != null ? this.checkAnswer(answer.questionId, String(answer.answer)) : false;
      const points = isCorrect ? (question.points || 1) : 0;
      
      if (isCorrect) {
        score += points;
        correctAnswers++;
      }
      
      return {
        questionId: answer.questionId,
        answer: answer.answer,
        isCorrect,
        points
      };
    }).filter(Boolean);
    
    const percentage = Math.round((score / this.totalPoints) * 100);
    
    this.attempts.push({
      userId: userId || null,
      answers: attemptAnswers,
      score,
      percentage,
      timeSpent: typeof timeSpent === 'number' ? timeSpent : 0,
      completedAt: new Date()
    });
    
    return this.save();
  }

  // Check if answer is correct
  checkAnswer(questionId, userAnswer) {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) return false;
    
    switch (question.type) {
      case 'multiple_choice':
      case 'true_false':
        return question.correctAnswer.toLowerCase().trim() === userAnswer.toLowerCase().trim();
      
      case 'short_answer':
        // For short answers, use fuzzy matching
        return this.fuzzyMatch(question.correctAnswer, userAnswer);
      
      case 'essay':
        // Essay questions need manual grading or AI evaluation
        return null; // Will be handled by AI grader
      
      default:
        return false;
    }
  }

  // Fuzzy matching for short answers
  fuzzyMatch(correct, userAnswer) {
    const correctWords = correct.toLowerCase().split(/\s+/);
    const userWords = userAnswer.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of correctWords) {
      if (userWords.some(userWord => 
        userWord.includes(word) || word.includes(userWord)
      )) {
        matches++;
      }
    }
    
    // Consider it correct if 70% of words match
    return (matches / correctWords.length) >= 0.7;
  }

  // Get user's best attempt
  getUserBestAttempt(userId) {
    const userAttempts = this.attempts.filter(attempt => 
      attempt.userId === userId
    );
    
    if (userAttempts.length === 0) return null;
    
    return userAttempts.reduce((best, current) => 
      current.percentage > best.percentage ? current : best
    );
  }

  // Check if user passed
  didUserPass(userId) {
    const bestAttempt = this.getUserBestAttempt(userId);
    return bestAttempt ? bestAttempt.percentage >= this.passingScore : false;
  }

  // Delete quiz
  async delete() {
    try {
      const db = getFirestore();
      await db.collection('quizzes').doc(this.id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting quiz:', error);
      throw error;
    }
  }

  // Soft delete (mark as inactive)
  async softDelete() {
    this.isActive = false;
    return this.save();
  }

  // Get quiz data as plain object
  toObject() {
    return {
      id: this.id,
      documentId: this.documentId,
      userId: this.userId,
      title: this.title,
      description: this.description,
      questions: this.questions,
      totalPoints: this.totalPoints,
      timeLimit: this.timeLimit,
      passingScore: this.passingScore,
      attempts: this.attempts,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Quiz;