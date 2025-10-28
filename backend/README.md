# NoteFlow Backend

A comprehensive AI-powered learning platform backend built with Node.js, featuring document processing, AI tutoring, voice interaction, and a freelance marketplace.

## 🚀 Features

### Core Learning Loop
- **Document Processing**: Upload and process PDFs, DOCX, images, and text files
- **AI-Powered RAG**: Retrieval-Augmented Generation for intelligent content understanding
- **Interactive AI Tutor**: Real-time Q&A and lesson generation
- **Voice Integration**: Speech-to-text and text-to-speech for hands-free learning
- **Smart Quiz Generation**: AI-generated quizzes with automatic grading

### Freelance Marketplace
- **Skill-Based Matching**: Verified skill scores for gig matching
- **Escrow System**: Secure payment handling with 10% commission
- **Real-time Communication**: In-app messaging for gig coordination
- **Reputation System**: Rating and feedback for quality assurance

### Technical Features
- **Microservices Architecture**: Scalable and maintainable design
- **Vector Database**: Milvus/Chroma for semantic search
- **WebSocket Support**: Real-time communication and streaming
- **Comprehensive Testing**: 90%+ test coverage with Jest
- **API Documentation**: Swagger/OpenAPI integration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   API Gateway    │    │   Auth Service  │
│   (Web/Mobile)  │◄──►│   (Express.js)  │◄──►│   (JWT/OAuth)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Document Service │    │   AI Service    │    │  Voice Service  │
│ (PDF/OCR/Text)   │◄──►│  (Gemini API)   │◄──►│ (ASR/TTS/WebRTC)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Vector Database  │    │  Quiz Service   │    │Marketplace Svc  │
│ (Milvus/Chroma) │    │ (Auto-grading)  │    │ (Gigs/Escrow)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis for session management
- **Authentication**: JWT with bcrypt
- **File Upload**: Multer with validation

### AI & ML
- **LLM**: Google Gemini API (primary), OpenAI GPT (fallback)
- **Embeddings**: Gemini Embeddings API
- **Vector DB**: Milvus (production), Chroma (development)
- **Document Processing**: PDF-parse, Mammoth, Tesseract.js
- **Voice**: OpenAI Whisper (ASR), OpenAI TTS

### Infrastructure
- **WebSocket**: Socket.io for real-time communication
- **Media**: WebRTC for voice streaming
- **Testing**: Jest with Supertest
- **Documentation**: Swagger/OpenAPI
- **Monitoring**: Morgan logging, Helmet security

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Firebase project with Firestore enabled
- Firebase Authentication enabled
- Python 3.8+ (for some ML dependencies)

### Setup

#### Option 1: Quick Setup (Recommended)
```bash
cd backend
npm install
npm run setup
# Follow the interactive setup wizard
npm run dev
```

#### Option 2: Manual Setup

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Firebase Setup**
- Go to [Firebase Console](https://console.firebase.google.com)
- Create a new project
- Enable Firestore Database
- Enable Authentication (Email/Password)
- Go to Project Settings > General > Your apps
- Add a web app and copy the config values

3. **Environment Configuration**
```bash
cp env.example .env
# Edit .env with your Firebase configuration
```

4. **Start Development Server**
```bash
npm run dev
```

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# Firebase Service Account (for production)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# AI Services
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

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
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/upgrade` - Upgrade to premium

### Document Management
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List user documents
- `GET /api/documents/:id` - Get document details
- `GET /api/documents/:id/status` - Check processing status
- `DELETE /api/documents/:id` - Delete document

### AI Tutor
- `POST /api/tutor/generate-lesson` - Generate lesson script
- `POST /api/tutor/ask-question` - Ask AI tutor
- `POST /api/tutor/chat` - Interactive chat
- `POST /api/tutor/summarize` - Document summary
- `POST /api/tutor/outline` - Document outline

### Quiz System
- `POST /api/quiz/generate` - Generate quiz
- `GET /api/quiz/:id` - Get quiz details
- `POST /api/quiz/:id/submit` - Submit answers
- `GET /api/quiz/:id/attempts` - Get attempts
- `GET /api/quiz` - List user quizzes

### Voice Processing
- `POST /api/voice/speech-to-text` - Convert speech to text
- `POST /api/voice/text-to-speech` - Convert text to speech
- `POST /api/voice/streaming-tts` - Streaming TTS
- `POST /api/voice/process-audio` - Process audio file
- `GET /api/voice/supported-formats` - Get supported formats

### Marketplace
- `POST /api/marketplace/gigs` - Create gig
- `GET /api/marketplace/gigs` - Browse gigs
- `GET /api/marketplace/gigs/:id` - Get gig details
- `POST /api/marketplace/gigs/:id/apply` - Apply for gig
- `POST /api/marketplace/gigs/:id/message` - Send message
- `POST /api/marketplace/gigs/:id/complete` - Complete gig
- `GET /api/marketplace/my-gigs` - User's gigs

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Structure
```
src/tests/
├── auth.test.js          # Authentication tests
├── documents.test.js      # Document processing tests
├── tutor.test.js        # AI tutor tests
├── quiz.test.js         # Quiz system tests
├── voice.test.js        # Voice processing tests
├── marketplace.test.js  # Marketplace tests
└── setup.js            # Test configuration
```

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
```bash
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
REDIS_URL=redis://your-production-redis
# ... other production variables
```

2. **Database Setup**
```bash
# Ensure MongoDB and Redis are running
# Set up vector database (Milvus/Chroma)
# Configure file storage (AWS S3, etc.)
```

3. **Start Production Server**
```bash
npm start
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Monitoring & Logging

### Health Checks
- `GET /health` - Service health status
- `GET /api-docs` - API documentation (development)

### Logging
- Request logging with Morgan
- Error tracking and reporting
- Performance monitoring

### Metrics
- API response times
- Database query performance
- AI service usage
- User engagement metrics

## 🔒 Security

### Authentication
- JWT tokens with secure secrets
- Password hashing with bcrypt
- Rate limiting on API endpoints
- CORS configuration

### Data Protection
- Input validation with Joi
- File upload restrictions
- SQL injection prevention
- XSS protection with Helmet

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the API documentation at `/api-docs`
- Review test cases for usage examples
- Open an issue on GitHub

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Core document processing
- ✅ AI tutor with RAG
- ✅ Voice integration
- ✅ Quiz system
- ✅ Basic marketplace

### Phase 2 (Next)
- Advanced analytics
- Mobile app support
- Advanced voice features
- Payment integration
- Admin dashboard

### Phase 3 (Future)
- Multi-language support
- Advanced AI features
- Enterprise features
- API marketplace
- White-label solutions

