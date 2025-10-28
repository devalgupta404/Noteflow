const { getFirestore } = require('../config/firebase');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.role = data.role || 'student';
    this.skillScores = data.skillScores || [];
    this.reputationScore = data.reputationScore || 0;
    this.subscription = {
      type: data.subscription?.type || 'free',
      dailyQueries: data.subscription?.dailyQueries || 0,
      maxDailyQueries: data.subscription?.maxDailyQueries || 10,
      resetDate: data.subscription?.resetDate || new Date()
    };
    this.preferences = {
      voiceEnabled: data.preferences?.voiceEnabled || true,
      language: data.preferences?.language || 'en',
      learningStyle: data.preferences?.learningStyle || 'mixed'
    };
    this.isActive = data.isActive !== false;
    this.lastLogin = data.lastLogin || new Date();
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Save user to Firestore
  async save() {
    try {
      const db = getFirestore();
      const userData = {
        email: this.email,
        firstName: this.firstName,
        lastName: this.lastName,
        role: this.role,
        skillScores: this.skillScores,
        reputationScore: this.reputationScore,
        subscription: this.subscription,
        preferences: this.preferences,
        isActive: this.isActive,
        lastLogin: this.lastLogin,
        createdAt: this.createdAt,
        updatedAt: new Date()
      };

      if (this.id) {
        // Check if user exists, if not create, otherwise update
        const userDoc = await db.collection('users').doc(this.id).get();
        if (userDoc.exists) {
          // Update existing user
          await db.collection('users').doc(this.id).update(userData);
        } else {
          // Create new user
          await db.collection('users').doc(this.id).set(userData);
        }
        this.updatedAt = new Date();
      } else {
        // Create new user
        const docRef = await db.collection('users').add(userData);
        this.id = docRef.id;
        this.createdAt = new Date();
        this.updatedAt = new Date();
      }

      return this;
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const db = getFirestore();
      const doc = await db.collection('users').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return new User({ id: doc.id, ...data });
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      return new User({ id: doc.id, ...data });
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Find user by email and select specific fields
  static async findByEmailSelect(email, fields = []) {
    try {
      const db = getFirestore();
      let query = db.collection('users').where('email', '==', email);
      
      if (fields.length > 0) {
        query = query.select(...fields);
      }
      
      const snapshot = await query.limit(1).get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      return new User({ id: doc.id, ...data });
    } catch (error) {
      console.error('Error finding user by email with select:', error);
      throw error;
    }
  }

  // Update skill score
  async updateSkillScore(subject, score) {
    const existingSkill = this.skillScores.find(skill => skill.subject === subject);
    
    if (existingSkill) {
      // Update existing skill with weighted average
      const totalQuizzes = existingSkill.quizCount + 1;
      existingSkill.score = Math.round(
        (existingSkill.score * existingSkill.quizCount + score) / totalQuizzes
      );
      existingSkill.quizCount = totalQuizzes;
      existingSkill.lastUpdated = new Date();
    } else {
      // Add new skill
      this.skillScores.push({
        subject,
        score,
        quizCount: 1,
        lastUpdated: new Date()
      });
    }
    
    return this.save();
  }

  // Get skill score for a subject
  getSkillScore(subject) {
    const skill = this.skillScores.find(s => s.subject === subject);
    return skill ? skill.score : 0;
  }

  // Reset daily queries if needed
  async resetDailyQueries() {
    const now = new Date();
    const lastReset = new Date(this.subscription.resetDate);
    
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.subscription.dailyQueries = 0;
      this.subscription.resetDate = now;
      return this.save();
    }
    return this;
  }

  // Check if user can make queries
  canMakeQuery() {
    if (this.subscription.type === 'premium') return true;
    return this.subscription.dailyQueries < this.subscription.maxDailyQueries;
  }

  // Compare password (for Firebase Auth, this is handled by Firebase)
  async comparePassword(candidatePassword) {
    // Firebase Auth handles password verification
    // This method is kept for compatibility
    return true;
  }

  // Delete user
  async delete() {
    try {
      const db = getFirestore();
      await db.collection('users').doc(this.id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Get user data as plain object
  toObject() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      skillScores: this.skillScores,
      reputationScore: this.reputationScore,
      subscription: this.subscription,
      preferences: this.preferences,
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;