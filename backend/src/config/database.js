const { initializeFirebaseAdmin, getFirestore } = require('./firebase');

const connectDB = async () => {
  try {
    // Initialize Firebase Admin
    const admin = initializeFirebaseAdmin();

    // Test Firestore connection with timeout
    const db = getFirestore();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firebase connection timeout')), 5000)
    );
    
    const connectionPromise = db.collection('_health').doc('test').set({
      timestamp: new Date(),
      status: 'connected'
    });

    await Promise.race([connectionPromise, timeoutPromise]);

    console.log('🔥 Firebase Firestore Connected');

    // Clean up test document
    await db.collection('_health').doc('test').delete();

  } catch (error) {
    console.error('Firebase connection failed:', error.message);
    
    if (error.message.includes('UNAUTHENTICATED')) {
      console.log('\n🔧 Firebase Authentication Issue:');
      console.log('   The service account key may be invalid or expired.');
      console.log('   Please check your Firebase Console > Project Settings > Service Accounts');
      console.log('   and generate a new private key.');
    } else {
      console.log('\n🔧 Firebase Setup Options:');
      console.log('1. Use Firebase Emulator (Recommended for development):');
      console.log('   - Install Firebase CLI: npm install -g firebase-tools');
      console.log('   - Run: firebase emulators:start --only firestore,auth');
      console.log('   - Set FIRESTORE_EMULATOR_HOST=localhost:8080 in .env');
      console.log('\n2. Use Service Account (For production):');
      console.log('   - Go to Firebase Console > Project Settings > Service Accounts');
      console.log('   - Generate new private key and add to FIREBASE_SERVICE_ACCOUNT_KEY');
      console.log('\n3. Use Application Default Credentials:');
      console.log('   - Install gcloud CLI and run: gcloud auth application-default login');
    }
    
    // For development, we can continue without Firebase connection
    console.log('\n⚠️  Continuing without Firebase connection (development mode)');
    console.log('   Some features may not work properly');
  }
};

module.exports = { connectDB };
