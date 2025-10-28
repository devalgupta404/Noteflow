const { getAuth } = require('../config/firebase');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    console.log('Auth middleware - Authorization header:', authHeader);
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    console.log('Auth middleware - Token received:', token.substring(0, 20) + '...');

    // Mock authentication for testing
    if (token === 'test-token') {
      console.log('Auth middleware - Using mock user: test@example.com');
      req.user = {
        id: 'abc@gmail.com', // Use email as ID to match documents
        email: 'abc@gmail.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'student',
        subscription: {
          type: 'free',
          dailyQueries: 0,
          maxDailyQueries: 100
        },
        skillScores: [],
        reputationScore: 0,
        isActive: true,
        resetDailyQueries: function() {
          // Reset daily queries if needed
          const today = new Date().toDateString();
          if (this.lastQueryDate !== today) {
            this.subscription.dailyQueries = 0;
            this.lastQueryDate = today;
          }
        },
        canMakeQuery: function() {
          return this.subscription.dailyQueries < this.subscription.maxDailyQueries;
        },
        save: async function() {
          // Mock save function
          return Promise.resolve();
        }
      };
      console.log('Auth middleware - Mock authentication successful');
      next();
      return;
    }

    // Verify Firebase ID token
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    console.log('Auth middleware - Token verified for user:', decodedToken.uid);
    
    // Get user from Firestore
    let user = await User.findById(decodedToken.uid);
    console.log('Auth middleware - User found in Firestore:', !!user);
    
    // If user doesn't exist in Firestore, create them
    if (!user) {
      console.log('Auth middleware - User not found in Firestore, creating new user...');
      try {
        // Get user info from Firebase Auth
        const userRecord = await auth.getUser(decodedToken.uid);
        
        // Create user in Firestore
        const userData = {
          id: decodedToken.uid,
          email: userRecord.email,
          firstName: userRecord.displayName?.split(' ')[0] || 'User',
          lastName: userRecord.displayName?.split(' ')[1] || '',
          role: 'student',
          subscription: {
            type: 'free',
            dailyQueries: 0,
            maxDailyQueries: 100
          },
          skillScores: [],
          reputationScore: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        user = new User(userData);
        await user.save();
        console.log('Auth middleware - User created in Firestore successfully');
      } catch (createError) {
        console.error('Auth middleware - Error creating user:', createError);
        return res.status(500).json({ 
          error: 'Failed to create user',
          code: 'USER_CREATION_FAILED'
        });
      }
    }
    
    if (!user.isActive) {
      console.log('Auth middleware - User is inactive');
      return res.status(401).json({ 
        error: 'User account is inactive',
        code: 'INACTIVE_USER'
      });
    }

    req.user = user;
    console.log('Auth middleware - Authentication successful');
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.code === 'auth/invalid-token') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles
      });
    }

    next();
  };
};

const checkSubscription = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Reset daily queries if needed
  req.user.resetDailyQueries();

  if (!req.user.canMakeQuery()) {
    return res.status(429).json({
      error: 'Daily query limit exceeded',
      code: 'QUERY_LIMIT_EXCEEDED',
      limit: req.user.subscription.maxDailyQueries,
      used: req.user.subscription.dailyQueries,
      upgrade: 'Consider upgrading to Premium for unlimited queries'
    });
  }

  next();
};

const incrementQueryCount = async (req, res, next) => {
  try {
    if (req.user && req.user.subscription.type === 'free') {
      req.user.subscription.dailyQueries += 1;
      await req.user.save();
    }
    next();
  } catch (error) {
    console.error('Error incrementing query count:', error);
    // Don't fail the request for this
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  checkSubscription,
  incrementQueryCount
};
