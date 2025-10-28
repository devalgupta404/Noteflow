#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 NoteFlow Backend Setup');
console.log('========================\n');

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setup() {
  try {
    // Check if .env already exists
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const overwrite = await askQuestion('⚠️  .env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    console.log('🔥 Firebase Setup');
    console.log('==================');
    console.log('1. Go to https://console.firebase.google.com');
    console.log('2. Create a new project');
    console.log('3. Enable Firestore Database');
    console.log('4. Enable Authentication (Email/Password)');
    console.log('5. Go to Project Settings > General > Your apps');
    console.log('6. Add a web app and copy the config values\n');
    
    const projectId = await askQuestion('Firebase Project ID: ');
    const apiKey = await askQuestion('Firebase API Key: ');
    const authDomain = await askQuestion('Firebase Auth Domain: ');
    const storageBucket = await askQuestion('Firebase Storage Bucket: ');
    const messagingSenderId = await askQuestion('Firebase Messaging Sender ID: ');
    const appId = await askQuestion('Firebase App ID: ');
    const databaseUrl = await askQuestion('Firebase Database URL: ');
    
    // AI Services
    console.log('\n🤖 AI Services Setup');
    console.log('=====================');
    const geminiKey = await askQuestion('Gemini API Key (required): ');
    const openaiKey = await askQuestion('OpenAI API Key (optional): ');
    
    const envContent = `# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=${projectId}
FIREBASE_API_KEY=${apiKey}
FIREBASE_AUTH_DOMAIN=${authDomain}
FIREBASE_STORAGE_BUCKET=${storageBucket}
FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}
FIREBASE_APP_ID=${appId}
FIREBASE_DATABASE_URL=${databaseUrl}

# Firebase Service Account (for production)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# AI Services
GEMINI_API_KEY=${geminiKey}
OPENAI_API_KEY=${openaiKey}

# Vector Database
MILVUS_HOST=localhost
MILVUS_PORT=19530
CHROMA_HOST=localhost
CHROMA_PORT=8000

# File Storage
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=50MB

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebRTC/Media
MEDIA_SERVER_URL=ws://localhost:8080
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Setup complete!');
    console.log('==================');
    console.log('Your .env file has been created.');
    console.log('\nNext steps:');
    console.log('1. npm install');
    console.log('2. npm run dev');
    
  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    rl.close();
  }
}

setup();
