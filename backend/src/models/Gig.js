const { getFirestore } = require('../config/firebase');

class Gig {
  constructor(data = {}) {
    this.id = data.id;
    this.buyerId = data.buyerId;
    this.sellerId = data.sellerId;
    this.title = data.title;
    this.description = data.description;
    this.category = data.category;
    this.subject = data.subject;
    this.requiredSkills = data.requiredSkills || [];
    this.budget = data.budget;
    this.currency = data.currency || 'USD';
    this.deadline = data.deadline;
    this.status = data.status || 'open';
    this.payment = {
      amount: data.payment?.amount || data.budget,
      currency: data.payment?.currency || data.currency,
      status: data.payment?.status || 'pending',
      escrowId: data.payment?.escrowId
    };
    this.deliverables = data.deliverables || [];
    this.communication = data.communication || [];
    this.rating = {
      buyerRating: data.rating?.buyerRating || {},
      sellerRating: data.rating?.sellerRating || {}
    };
    this.completedAt = data.completedAt;
    this.cancelledAt = data.cancelledAt;
    this.cancellationReason = data.cancellationReason;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Save gig to Firestore
  async save() {
    try {
      const db = getFirestore();
      const gigData = {
        buyerId: this.buyerId,
        sellerId: this.sellerId,
        title: this.title,
        description: this.description,
        category: this.category,
        subject: this.subject,
        requiredSkills: this.requiredSkills,
        budget: this.budget,
        currency: this.currency,
        deadline: this.deadline,
        status: this.status,
        payment: this.payment,
        deliverables: this.deliverables,
        communication: this.communication,
        rating: this.rating,
        completedAt: this.completedAt,
        cancelledAt: this.cancelledAt,
        cancellationReason: this.cancellationReason,
        createdAt: this.createdAt,
        updatedAt: new Date()
      };

      if (this.id) {
        // Update existing gig
        await db.collection('gigs').doc(this.id).update(gigData);
        this.updatedAt = new Date();
      } else {
        // Create new gig
        const docRef = await db.collection('gigs').add(gigData);
        this.id = docRef.id;
        this.createdAt = new Date();
        this.updatedAt = new Date();
      }

      return this;
    } catch (error) {
      console.error('Error saving gig:', error);
      throw error;
    }
  }

  // Find gig by ID
  static async findById(id) {
    try {
      const db = getFirestore();
      const doc = await db.collection('gigs').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return new Gig({ id: doc.id, ...data });
    } catch (error) {
      console.error('Error finding gig by ID:', error);
      throw error;
    }
  }

  // Find gigs with filters
  static async find(filters = {}, options = {}) {
    try {
      const db = getFirestore();
      let query = db.collection('gigs');

      // Apply filters
      Object.keys(filters).forEach(key => {
        if (key === 'budget') {
          if (filters.budget.$gte) {
            query = query.where('budget', '>=', filters.budget.$gte);
          }
          if (filters.budget.$lte) {
            query = query.where('budget', '<=', filters.budget.$lte);
          }
        } else if (key === 'subject' && typeof filters[key] === 'object') {
          // Handle regex-like search for subject
          query = query.where('subject', '>=', filters[key].$regex)
                      .where('subject', '<=', filters[key].$regex + '\uf8ff');
        } else {
          query = query.where(key, '==', filters[key]);
        }
      });

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      // Apply sorting
      query = query.orderBy('createdAt', 'desc');

      const snapshot = await query.get();
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return new Gig({ id: doc.id, ...data });
      });
    } catch (error) {
      console.error('Error finding gigs:', error);
      throw error;
    }
  }

  // Find one gig with filters
  static async findOne(filters) {
    try {
      const db = getFirestore();
      let query = db.collection('gigs');

      // Apply filters
      Object.keys(filters).forEach(key => {
        query = query.where(key, '==', filters[key]);
      });

      const snapshot = await query.limit(1).get();
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      return new Gig({ id: doc.id, ...data });
    } catch (error) {
      console.error('Error finding gig:', error);
      throw error;
    }
  }

  // Count gigs
  static async countDocuments(filters = {}) {
    try {
      const db = getFirestore();
      let query = db.collection('gigs');

      // Apply filters
      Object.keys(filters).forEach(key => {
        query = query.where(key, '==', filters[key]);
      });

      const snapshot = await query.get();
      return snapshot.size;
    } catch (error) {
      console.error('Error counting gigs:', error);
      throw error;
    }
  }

  // Find matching gigs for seller
  static async findMatchingGigs(sellerId, userSkills) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('gigs')
        .where('status', '==', 'open')
        .get();

      const matchingGigs = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const gig = new Gig({ id: doc.id, ...data });
        
        // Check if user meets skill requirements
        const meetsRequirements = gig.requiredSkills.every(requiredSkill => {
          const userSkill = userSkills[requiredSkill.skill] || 0;
          return userSkill >= requiredSkill.minScore;
        });
        
        if (meetsRequirements) {
          matchingGigs.push(gig);
        }
      });
      
      return matchingGigs;
    } catch (error) {
      console.error('Error finding matching gigs:', error);
      throw error;
    }
  }

  // Assign seller
  async assignSeller(sellerId) {
    this.sellerId = sellerId;
    this.status = 'assigned';
    return this.save();
  }

  // Start work
  async startWork() {
    this.status = 'in_progress';
    return this.save();
  }

  // Complete gig
  async completeGig() {
    this.status = 'completed';
    this.completedAt = new Date();
    return this.save();
  }

  // Add communication
  async addMessage(senderId, message) {
    this.communication.push({
      senderId,
      message,
      timestamp: new Date()
    });
    return this.save();
  }

  // Rate seller
  async rateSeller(score, comment) {
    this.rating.sellerRating = { score, comment };
    return this.save();
  }

  // Rate buyer
  async rateBuyer(score, comment) {
    this.rating.buyerRating = { score, comment };
    return this.save();
  }

  // Get commission (virtual property)
  get commission() {
    return Math.round(this.budget * 0.1); // 10% commission
  }

  // Get seller payout (virtual property)
  get sellerPayout() {
    return this.budget - this.commission;
  }

  // Delete gig
  async delete() {
    try {
      const db = getFirestore();
      await db.collection('gigs').doc(this.id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting gig:', error);
      throw error;
    }
  }

  // Get gig data as plain object
  toObject() {
    return {
      id: this.id,
      buyerId: this.buyerId,
      sellerId: this.sellerId,
      title: this.title,
      description: this.description,
      category: this.category,
      subject: this.subject,
      requiredSkills: this.requiredSkills,
      budget: this.budget,
      currency: this.currency,
      deadline: this.deadline,
      status: this.status,
      payment: this.payment,
      deliverables: this.deliverables,
      communication: this.communication,
      rating: this.rating,
      commission: this.commission,
      sellerPayout: this.sellerPayout,
      completedAt: this.completedAt,
      cancelledAt: this.cancelledAt,
      cancellationReason: this.cancellationReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Gig;