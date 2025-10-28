const express = require('express');
const Gig = require('../models/Gig');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/marketplace/gigs:
 *   post:
 *     summary: Create a new gig
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - subject
 *               - budget
 *               - deadline
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [academic, creative, technical, language, other]
 *               subject:
 *                 type: string
 *               requiredSkills:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     skill:
 *                       type: string
 *                     minScore:
 *                       type: number
 *               budget:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *               deadline:
 *                 type: string
 *                 format: date
 *               deliverables:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Gig created successfully
 *       400:
 *         description: Validation error
 */
router.post('/gigs', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      subject,
      requiredSkills = [],
      budget,
      currency = 'USD',
      deadline,
      deliverables = []
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !subject || !budget || !deadline) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Validate deadline
    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return res.status(400).json({
        error: 'Deadline must be in the future'
      });
    }

    // Create gig
    const gig = new Gig({
      buyerId: req.user._id,
      title,
      description,
      category,
      subject,
      requiredSkills,
      budget,
      currency,
      deadline: deadlineDate,
      deliverables: deliverables.map(deliverable => ({
        description: deliverable,
        completed: false
      })),
      payment: {
        amount: budget,
        currency
      }
    });

    await gig.save();

    res.status(201).json({
      message: 'Gig created successfully',
      gig: {
        id: gig._id,
        title: gig.title,
        description: gig.description,
        category: gig.category,
        subject: gig.subject,
        budget: gig.budget,
        currency: gig.currency,
        deadline: gig.deadline,
        status: gig.status,
        commission: gig.commission,
        sellerPayout: gig.sellerPayout,
        createdAt: gig.createdAt
      }
    });

  } catch (error) {
    console.error('Gig creation error:', error);
    res.status(500).json({
      error: 'Failed to create gig',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/marketplace/gigs:
 *   get:
 *     summary: Get available gigs
 *     tags: [Marketplace]
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
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *       - in: query
 *         name: minBudget
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxBudget
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Gigs retrieved successfully
 */
router.get('/gigs', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { category, subject, minBudget, maxBudget } = req.query;

    // Build filter for Firestore
    const filter = { status: 'open' };

    if (category) filter.category = category;
    if (subject) filter.subject = subject;
    if (minBudget) filter.budget = { $gte: parseFloat(minBudget) };
    if (maxBudget) filter.budget = { ...filter.budget, $lte: parseFloat(maxBudget) };

    // Get user's skills for matching
    const userSkills = {};
    if (req.user.skillScores) {
      req.user.skillScores.forEach(skill => {
        userSkills[skill.subject] = skill.score;
      });
    }

            // Find matching gigs using Firestore-compatible method
            // Simplified query to avoid index requirements
            const gigs = await Gig.find({ status: 'open' }, {
              limit: limit,
              offset: skip,
              sort: { field: 'createdAt', direction: 'desc' }
            });

    // Filter gigs based on user's skills
    const matchingGigs = gigs.filter(gig => {
      if (!gig.requiredSkills || !Array.isArray(gig.requiredSkills)) {
        return true; // If no required skills, include the gig
      }
      return gig.requiredSkills.every(requiredSkill => {
        const userSkill = userSkills[requiredSkill.skill] || 0;
        return userSkill >= requiredSkill.minScore;
      });
    });

            const total = await Gig.countDocuments({ status: 'open' });

    res.json({
      gigs: matchingGigs.map(gig => ({
        id: gig.id,
        title: gig.title,
        description: gig.description,
        category: gig.category,
        subject: gig.subject,
        budget: gig.budget,
        currency: gig.currency,
        deadline: gig.deadline,
        requiredSkills: gig.requiredSkills || [],
        buyer: {
          id: gig.buyerId,
          name: `${gig.buyerFirstName || ''} ${gig.buyerLastName || ''}`.trim(),
          reputationScore: gig.buyerReputationScore || 0
        },
        commission: gig.commission,
        sellerPayout: gig.sellerPayout,
        createdAt: gig.createdAt
      })),
      pagination: {
        page,
        limit,
        total: matchingGigs.length,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Gigs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch gigs',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/marketplace/gigs/{id}:
 *   get:
 *     summary: Get gig by ID
 *     tags: [Marketplace]
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
 *         description: Gig retrieved successfully
 *       404:
 *         description: Gig not found
 */
router.get('/gigs/:id', authenticateToken, async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id)
      .populate('buyerId', 'firstName lastName reputationScore')
      .populate('sellerId', 'firstName lastName reputationScore skillScores');

    if (!gig) {
      return res.status(404).json({
        error: 'Gig not found'
      });
    }

    // Check if user can view this gig
    const canView = gig.buyerId._id.toString() === req.user._id.toString() ||
                   gig.sellerId?._id.toString() === req.user._id.toString() ||
                   gig.status === 'open';

    if (!canView) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      gig: {
        id: gig._id,
        title: gig.title,
        description: gig.description,
        category: gig.category,
        subject: gig.subject,
        budget: gig.budget,
        currency: gig.currency,
        deadline: gig.deadline,
        status: gig.status,
        requiredSkills: gig.requiredSkills,
        deliverables: gig.deliverables,
        buyer: {
          id: gig.buyerId._id,
          name: `${gig.buyerId.firstName} ${gig.buyerId.lastName}`,
          reputationScore: gig.buyerId.reputationScore
        },
        seller: gig.sellerId ? {
          id: gig.sellerId._id,
          name: `${gig.sellerId.firstName} ${gig.sellerId.lastName}`,
          reputationScore: gig.sellerId.reputationScore,
          relevantSkills: gig.sellerId.skillScores.filter(skill => 
            gig.requiredSkills.some(reqSkill => reqSkill.skill === skill.subject)
          )
        } : null,
        commission: gig.commission,
        sellerPayout: gig.sellerPayout,
        createdAt: gig.createdAt,
        updatedAt: gig.updatedAt
      }
    });

  } catch (error) {
    console.error('Gig fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch gig',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/marketplace/gigs/{id}/apply:
 *   post:
 *     summary: Apply for a gig
 *     tags: [Marketplace]
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
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application submitted successfully
 *       400:
 *         description: Cannot apply for this gig
 */
router.post('/gigs/:id/apply', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({
        error: 'Gig not found'
      });
    }

    if (gig.buyerId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Cannot apply for your own gig'
      });
    }

    if (gig.status !== 'open') {
      return res.status(400).json({
        error: 'Gig is no longer available'
      });
    }

    // Check if user has required skills
    const userSkills = {};
    req.user.skillScores.forEach(skill => {
      userSkills[skill.subject] = skill.score;
    });

    const hasRequiredSkills = gig.requiredSkills.every(requiredSkill => {
      const userSkill = userSkills[requiredSkill.skill] || 0;
      return userSkill >= requiredSkill.minScore;
    });

    if (!hasRequiredSkills) {
      return res.status(400).json({
        error: 'You do not meet the required skill criteria for this gig'
      });
    }

    // Assign seller and update status
    await gig.assignSeller(req.user._id);

    // Add initial communication
    if (message) {
      await gig.addMessage(req.user._id, message);
    }

    res.json({
      message: 'Successfully applied for gig',
      gig: {
        id: gig._id,
        status: gig.status,
        sellerId: gig.sellerId
      }
    });

  } catch (error) {
    console.error('Gig application error:', error);
    res.status(500).json({
      error: 'Failed to apply for gig',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/marketplace/gigs/{id}/message:
 *   post:
 *     summary: Send message in gig communication
 *     tags: [Marketplace]
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       403:
 *         description: Access denied
 */
router.post('/gigs/:id/message', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({
        error: 'Gig not found'
      });
    }

    // Check if user is part of this gig
    const isParticipant = gig.buyerId.toString() === req.user._id.toString() ||
                          gig.sellerId?.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    await gig.addMessage(req.user._id, message);

    res.json({
      message: 'Message sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Message sending error:', error);
    res.status(500).json({
      error: 'Failed to send message',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/marketplace/gigs/{id}/complete:
 *   post:
 *     summary: Mark gig as complete
 *     tags: [Marketplace]
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
 *         description: Gig completed successfully
 *       403:
 *         description: Access denied
 */
router.post('/gigs/:id/complete', authenticateToken, async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({
        error: 'Gig not found'
      });
    }

    // Only buyer can mark as complete
    if (gig.buyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Only the buyer can mark gig as complete'
      });
    }

    if (gig.status !== 'in_progress') {
      return res.status(400).json({
        error: 'Gig is not in progress'
      });
    }

    await gig.completeGig();

    res.json({
      message: 'Gig completed successfully',
      gig: {
        id: gig._id,
        status: gig.status,
        completedAt: gig.completedAt
      }
    });

  } catch (error) {
    console.error('Gig completion error:', error);
    res.status(500).json({
      error: 'Failed to complete gig',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/marketplace/gigs/{id}/rate:
 *   post:
 *     summary: Rate gig participant
 *     tags: [Marketplace]
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
 *               - rating
 *               - type
 *             properties:
 *               rating:
 *                 type: object
 *                 properties:
 *                   score:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 5
 *                   comment:
 *                     type: string
 *               type:
 *                 type: string
 *                 enum: [buyer, seller]
 *     responses:
 *       200:
 *         description: Rating submitted successfully
 *       403:
 *         description: Access denied
 */
router.post('/gigs/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { rating, type } = req.body;
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({
        error: 'Gig not found'
      });
    }

    if (gig.status !== 'completed') {
      return res.status(400).json({
        error: 'Can only rate completed gigs'
      });
    }

    // Check if user can rate
    const canRateBuyer = type === 'buyer' && gig.sellerId?.toString() === req.user._id.toString();
    const canRateSeller = type === 'seller' && gig.buyerId.toString() === req.user._id.toString();

    if (!canRateBuyer && !canRateSeller) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (type === 'buyer') {
      await gig.rateBuyer(rating.score, rating.comment);
    } else {
      await gig.rateSeller(rating.score, rating.comment);
    }

    res.json({
      message: 'Rating submitted successfully',
      type,
      rating
    });

  } catch (error) {
    console.error('Rating submission error:', error);
    res.status(500).json({
      error: 'Failed to submit rating',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/marketplace/my-gigs:
 *   get:
 *     summary: Get user's gigs
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [buyer, seller]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, assigned, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: User's gigs retrieved successfully
 */
router.get('/my-gigs', authenticateToken, async (req, res) => {
  try {
    const { type, status } = req.query;
    
    let filter = {};
    
    if (type === 'buyer') {
      filter.buyerId = req.user.id; // Use req.user.id instead of req.user._id
    } else if (type === 'seller') {
      filter.sellerId = req.user.id; // Use req.user.id instead of req.user._id
    } else {
      // For Firestore, we need to handle OR queries differently
      // We'll get all gigs and filter in memory
      filter = {}; // Get all gigs, filter in memory
    }
    
    if (status) {
      filter.status = status;
    }

    // Get gigs using Firestore-compatible method
    const allGigs = await Gig.find(filter, {
      sort: { field: 'createdAt', direction: 'desc' }
    });

    // Filter gigs based on user relationship if no specific type
    let gigs = allGigs;
    if (!type) {
      gigs = allGigs.filter(gig => 
        gig.buyerId === req.user.id || gig.sellerId === req.user.id
      );
    }

    res.json({
      gigs: gigs.map(gig => ({
        id: gig.id, // Use gig.id instead of gig._id
        title: gig.title,
        description: gig.description,
        category: gig.category,
        subject: gig.subject,
        budget: gig.budget,
        currency: gig.currency,
        deadline: gig.deadline,
        status: gig.status,
        buyer: {
          id: gig.buyerId,
          name: `${gig.buyerFirstName || ''} ${gig.buyerLastName || ''}`.trim()
        },
        seller: gig.sellerId ? {
          id: gig.sellerId,
          name: `${gig.sellerFirstName || ''} ${gig.sellerLastName || ''}`.trim()
        } : null,
        commission: gig.commission,
        sellerPayout: gig.sellerPayout,
        createdAt: gig.createdAt,
        completedAt: gig.completedAt
      }))
    });

  } catch (error) {
    console.error('My gigs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch user gigs',
      message: error.message
    });
  }
});

module.exports = router;
