// API service for backend communication
import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor to include Firebase ID token
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  console.log('🚀 API Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    user: user?.email || 'Not authenticated',
    timestamp: new Date().toISOString()
  });
  
  if (user) {
    try {
      const token = await user.getIdToken();
      console.log('🔑 Token obtained:', !!token);
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Authorization header set');
    } catch (error) {
      console.error('❌ Error getting ID token:', error);
    }
  } else {
    console.log('⚠️ No authenticated user');
  }
  return config;
});

// Add response interceptor for better error logging
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', userData),
  
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  
  getProfile: () =>
    api.get('/auth/profile'),
  
  updateProfile: (data: { firstName?: string; lastName?: string; preferences?: any }) =>
    api.put('/auth/profile', data),
  
  upgradeSubscription: () =>
    api.post('/auth/upgrade'),
};

// Documents API
export const documentsAPI = {
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  getAll: () =>
    api.get('/documents'),
  
  getById: (id: string) =>
    api.get(`/documents/${id}`),
  
  getStatus: (id: string) =>
    api.get(`/documents/${id}/status`),
  
  delete: (id: string) =>
    api.delete(`/documents/${id}`),
};

// Tutor API
export const tutorAPI = {
  generateLesson: (data: { documentId: string; difficulty: string }) =>
    api.post('/tutor/generate-lesson', data),
  
  askQuestion: (data: { question: string; documentId: string }) =>
    api.post('/tutor/ask-question', data),
  
  chat: (data: { documentId: string; message: string; chatHistory: any[] }) =>
    api.post('/tutor/chat', data),
  
  summarize: (data: { documentId: string; length: string }) =>
    api.post('/tutor/summarize', data),
  
  outline: (data: { documentId: string }) =>
    api.post('/tutor/outline', data),
};

// Lecture API
export const lectureAPI = {
  generateLecture: (data: { documentId: string; difficulty?: string }) =>
    api.post('/lecture/generate-lecture', data),
  
  interactiveQA: (data: { 
    question: string; 
    lectureContext: any; 
    slideContext: any; 
    conversationHistory?: any[] 
  }) =>
    api.post('/lecture/interactive-qa', data),
  
  textToSpeech: (data: { text: string; voice?: string; speed?: number }) =>
    api.post('/lecture/text-to-speech', data, { responseType: 'blob' }),
  
  saveProgress: (data: { 
    lectureId: string; 
    currentSlide: number; 
    progress: number; 
    conversationHistory: any[] 
  }) =>
    api.post('/lecture/save-progress', data),
  
  resumeLecture: (lectureId: string) =>
    api.get(`/lecture/resume/${lectureId}`),

  flashcards: (data: { documentId?: string; text?: string; count?: number }) =>
    api.post('/lecture/flashcards', data),
};

// Quiz API
export const quizAPI = {
  generate: (data: { documentId: string; questionCount: number; difficulty: string }) =>
    api.post('/quiz/generate', data),
  
  getAll: () =>
    api.get('/quiz'),
  
  getById: (id: string) =>
    api.get(`/quiz/${id}`),
  
  submit: (data: { quizId: string; answers: any[]; timeSpent?: number }) =>
    api.post(`/quiz/${data.quizId}/submit`, { answers: data.answers, timeSpent: data.timeSpent }),
  
  getAttempts: (quizId: string) =>
    api.get(`/quiz/${quizId}/attempts`),
};

// Voice API
export const voiceAPI = {
  textToSpeech: (data: { text: string; voice: string; format: string }) =>
    api.post('/voice/text-to-speech', data),
  
  streamingTTS: (data: { text: string; voice: string }) =>
    api.post('/voice/streaming-tts', data),
  
  speechToText: (audioFile: File) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    return api.post('/voice/speech-to-text', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  estimateDuration: (data: { text: string }) =>
    api.post('/voice/estimate-duration', data),
  
  getSupportedFormats: () =>
    api.get('/voice/supported-formats'),
};

// Marketplace API
export const marketplaceAPI = {
  createGig: (data: {
    title: string;
    description: string;
    category: string;
    subject: string;
    budget: number;
    currency: string;
    deadline: string;
  }) =>
    api.post('/marketplace/gigs', data),
  
  getGigs: (filters?: any) =>
    api.get('/marketplace/gigs', { params: filters }),
  
  getMyGigs: () =>
    api.get('/marketplace/my-gigs'),
  
  applyToGig: (data: { gigId: string; proposal: string; budget: number }) =>
    api.post('/marketplace/apply', data),
  
  getMessages: (gigId: string) =>
    api.get(`/marketplace/gigs/${gigId}/messages`),
  
  sendMessage: (data: { gigId: string; message: string }) =>
    api.post('/marketplace/messages', data),
  
  completeGig: (data: { gigId: string; rating: number; review: string }) =>
    api.post('/marketplace/complete', data),
};

export default api;
