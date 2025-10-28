const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const path = require('path');

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      return admin;
    }

    // Check if using emulator
    if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      console.log('🔥 Using Firebase Emulator');
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'noteflow-941ab'
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_KEY !== '{"type":"service_account","project_id":"..."}') {
      // For production, use service account key from environment variable
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        console.log('🔥 Firebase Admin initialized with service account (env)');
      } catch (error) {
        console.error('❌ Firebase service account error:', error.message);
        // Fallback to project ID only
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('🔥 Firebase Admin initialized with project ID only');
      }
    } else if (require('fs').existsSync(path.join(__dirname, '../../noteflow-941ab-firebase-adminsdk-fbsvc-f83680f4b3.json'))) {
      // Try to use service account JSON file
      try {
        const serviceAccount = require(path.join(__dirname, '../../noteflow-941ab-firebase-adminsdk-fbsvc-f83680f4b3.json'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        console.log('🔥 Firebase Admin initialized with service account (file)');
      } catch (error) {
        console.error('❌ Firebase service account file error:', error.message);
        // Fallback to project ID only
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('🔥 Firebase Admin initialized with project ID only');
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && require('fs').existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      // Use GOOGLE_APPLICATION_CREDENTIALS environment variable
      try {
        const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        console.log('🔥 Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS');
      } catch (error) {
        console.error('❌ GOOGLE_APPLICATION_CREDENTIALS error:', error.message);
        // Fallback to project ID only
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('🔥 Firebase Admin initialized with project ID only');
      }
    } else {
      // For development, use project ID only
      if (!process.env.FIREBASE_PROJECT_ID) {
        throw new Error('FIREBASE_PROJECT_ID is required');
      }
      
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }

    console.log('🔥 Firebase Admin initialized');
    return admin;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    console.log('💡 For development, you can use Firebase emulator or set up service account');
    throw error;
  }
};

// Initialize Firebase Client SDK (for client-side operations)
const initializeFirebaseClient = () => {
  try {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

    const app = initializeApp(firebaseConfig);
    console.log('🔥 Firebase Client initialized');
    return app;
  } catch (error) {
    console.error('Firebase Client initialization error:', error);
    throw error;
  }
};

// Get Firestore instance
const getFirestore = () => {
  return admin.firestore();
};

// Get Auth instance
const getAuth = () => {
  return admin.auth();
};

// Get Storage instance
const getStorage = () => {
  return admin.storage();
};

module.exports = {
  initializeFirebaseAdmin,
  initializeFirebaseClient,
  getFirestore,
  getAuth,
  getStorage,
  admin
};
