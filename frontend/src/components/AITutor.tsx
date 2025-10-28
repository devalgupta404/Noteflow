import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
} from '@mui/material';
import {
  Send as SendIcon,
  School as SchoolIcon,
  QuestionAnswer as QuestionIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { tutorAPI, documentsAPI } from '../services/api';
import InteractiveLecture from './InteractiveLecture';

interface Document {
  id: string;
  originalName: string;
  filename: string;
  processingStatus: string;
  metadata: {
    subject: string;
  };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  message: string;
  timestamp: Date;
}

const AITutor: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [error, setError] = useState('');
  const [lessonScript, setLessonScript] = useState('');
  const [showInteractiveLecture, setShowInteractiveLecture] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoadingDocuments(true);
      console.log('📚 Loading documents for AI Tutor...');
      const response = await documentsAPI.getAll();
      console.log('📚 Full API response:', response);
      console.log('📚 Documents loaded:', response.data.documents?.length || 0);
      console.log('📚 Documents data:', response.data.documents);
      
      if (response.data.documents && response.data.documents.length > 0) {
        setDocuments(response.data.documents);
        console.log('✅ Documents set in state:', response.data.documents.length);
        
        // Log each document's processing status
        response.data.documents.forEach((doc: any, index: number) => {
          console.log(`📄 Document ${index + 1}:`, {
            id: doc.id,
            name: doc.originalName || doc.filename,
            status: doc.processingStatus,
            subject: doc.metadata?.subject
          });
        });
        
        const completedDocs = response.data.documents.filter((doc: any) => doc.processingStatus === 'completed');
        console.log(`🎯 Completed documents: ${completedDocs.length}/${response.data.documents.length}`);
      } else {
        console.log('⚠️ No documents found or empty response');
        setDocuments([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading documents:', error);
      console.error('❌ Error details:', error.response?.data);
      setError('Failed to load documents. Please check console for details.');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleGenerateLesson = async () => {
    if (!selectedDocument) {
      setError('Please select a document first');
      return;
    }

    console.log('🎓 Generating lesson for document:', selectedDocument);
    setLoading(true);
    setError('');

    try {
      const response = await tutorAPI.generateLesson({
        documentId: selectedDocument,
        difficulty: 'intermediate',
      });

      console.log('✅ Lesson generated successfully:', response.data);
      setLessonScript(response.data.script || '');
      
      // Add lesson to chat history
      const lessonMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        message: `📚 **Lesson Generated**\n\n${response.data.script || 'Lesson content will appear here...'}`,
        timestamp: new Date(),
      };
      setChatHistory([lessonMessage]);
      
    } catch (error: any) {
      console.error('❌ Error generating lesson:', error);
      console.error('❌ Error details:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to generate lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !selectedDocument) {
      setError('Please enter a question and select a document');
      return;
    }

    setLoading(true);
    setError('');

    // Add user question to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: question,
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response = await tutorAPI.askQuestion({
        question: question,
        documentId: selectedDocument,
      });

      // Add AI response to chat
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        message: response.data.answer || 'I apologize, but I couldn\'t generate a response.',
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, aiMessage]);
      
      setQuestion('');
      
    } catch (error: any) {
      console.error('Error asking question:', error);
      setError(error.response?.data?.error || 'Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  const handleChatMessage = async () => {
    if (!question.trim() || !selectedDocument) {
      setError('Please enter a message and select a document');
      return;
    }

    setLoading(true);
    setError('');

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: question,
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response = await tutorAPI.chat({
        documentId: selectedDocument,
        message: question,
        chatHistory: chatHistory.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.message,
        })),
      });

      // Add AI response to chat
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        message: response.data.response || 'I apologize, but I couldn\'t generate a response.',
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, aiMessage]);
      
      setQuestion('');
      
    } catch (error: any) {
      console.error('Error in chat:', error);
      setError(error.response?.data?.error || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        AI Tutor
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={2} sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Select Document</InputLabel>
          <Select
            value={selectedDocument}
            onChange={(e) => setSelectedDocument(e.target.value)}
            disabled={loadingDocuments}
          >
            {loadingDocuments ? (
              <MenuItem disabled>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Loading documents...
              </MenuItem>
            ) : documents.length === 0 ? (
              <MenuItem disabled>No documents available</MenuItem>
            ) : documents.filter(doc => doc.processingStatus === 'completed').length === 0 ? (
              <MenuItem disabled>No completed documents</MenuItem>
            ) : (
              documents
                .filter(doc => doc.processingStatus === 'completed')
                .map((doc) => (
                  <MenuItem key={doc.id} value={doc.id}>
                    {doc.originalName} ({doc.metadata?.subject || 'Unknown'})
                  </MenuItem>
                ))
            )}
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          startIcon={<SchoolIcon />}
          onClick={handleGenerateLesson}
          disabled={loading || !selectedDocument}
        >
          Generate Lesson
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<SchoolIcon />}
          onClick={() => setShowInteractiveLecture(true)}
          disabled={!selectedDocument}
          color="secondary"
        >
          Interactive Lecture
        </Button>
      </Box>

      {/* Chat Interface */}
      <Card sx={{ height: 500, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            Interactive Chat
          </Typography>
          
          {chatHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Start by generating a lesson or asking a question about your document.
            </Typography>
          ) : (
            <List>
              {chatHistory.map((message) => (
                <React.Fragment key={message.id}>
                  <ListItem>
                    <Paper
                      sx={{
                        p: 2,
                        backgroundColor: message.type === 'user' ? 'primary.light' : 'grey.100',
                        color: message.type === 'user' ? 'white' : 'text.primary',
                        maxWidth: '80%',
                        ml: message.type === 'user' ? 'auto' : 0,
                      }}
                    >
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message.message}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Paper>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
        
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box display="flex" gap={1}>
            <TextField
              fullWidth
              placeholder="Ask a question or send a message..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatMessage();
                }
              }}
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleChatMessage}
              disabled={loading || !question.trim() || !selectedDocument}
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
            >
              Send
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Interactive Lecture Modal */}
      {showInteractiveLecture && (
        <InteractiveLecture
          documentId={selectedDocument}
          onClose={() => setShowInteractiveLecture(false)}
        />
      )}
    </Box>
  );
};

export default AITutor;
