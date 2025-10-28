// Firebase-only configuration
const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Firebase configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  },
  
  // AI Services
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY
  },
  
  // Vector Database
  vector: {
    milvus: {
      host: process.env.MILVUS_HOST || 'localhost',
      port: process.env.MILVUS_PORT || 19530
    },
    chroma: {
      host: process.env.CHROMA_HOST || 'localhost',
      port: process.env.CHROMA_PORT || 8000
    }
  },
  
  // File Storage
  storage: {
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: process.env.MAX_FILE_SIZE || '50MB'
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // WebRTC/Media
  media: {
    serverUrl: process.env.MEDIA_SERVER_URL || 'ws://localhost:8080'
  }
};

// Log configuration on startup
console.log('🔧 Configuration loaded:');
console.log(`   Database: Firebase Firestore`);
console.log(`   Auth: Firebase Auth`);
console.log(`   Environment: ${config.nodeEnv}`);

module.exports = config;
