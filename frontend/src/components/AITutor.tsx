// src/pages/AITutor.tsx
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
  Paper,
  Container,
  Chip,
} from '@mui/material';
import {
  Send as SendIcon,
  School as SchoolIcon,
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
      const response = await documentsAPI.getAll();
      setDocuments(response.data.documents || []);
    } catch (error: any) {
      setError('Failed to load documents.');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleGenerateLesson = async () => {
    if (!selectedDocument) {
      setError('Please select a document first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await tutorAPI.generateLesson({
        documentId: selectedDocument,
        difficulty: 'intermediate',
      });
      setLessonScript(response.data.script || '');
      setChatHistory([
        {
          id: Date.now().toString(),
          type: 'assistant',
          message: `📚 Lesson Generated\n\n${response.data.script || 'Lesson content will appear here...'}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to generate lesson');
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
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        message: response.data.response || 'Sorry, I could not generate a response.',
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, aiMessage]);
      setQuestion('');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        bgcolor: '#f5f3ff',
        minHeight: '100vh',
        py: 4,
        borderRadius: 4,
      }}
    >
      <Typography
        variant="h4"
        fontWeight="bold"
        sx={{ color: '#2b007cff', mb: 3 }}
      >
        AI Tutor
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Controls */}
      <Card sx={{ p: 2, mb: 3, background: '#bdb6e9ff', borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Lesson Controls
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel>Select Document</InputLabel>
              <Select
                value={selectedDocument}
                onChange={(e) => setSelectedDocument(e.target.value)}
                disabled={loadingDocuments}
              >
                {loadingDocuments ? (
                  <MenuItem disabled>Loading...</MenuItem>
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
              onClick={handleGenerateLesson}
              disabled={loading || !selectedDocument}
              sx={{
                bgcolor: '#2b007cff',
                '&:hover': { bgcolor: '#908ab8ff' },
              }}
              startIcon={<SchoolIcon />}
            >
              Generate Lesson
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              onClick={() => setShowInteractiveLecture(true)}
              disabled={!selectedDocument}
              startIcon={<SchoolIcon />}
              sx={{
                borderColor: '#2b007cff',
                color: '#2b007cff',
                '&:hover': { bgcolor: '#ccc2f7ff' },
              }}
            >
              Interactive Lecture
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Chat Box */}
      <Card
        sx={{
          background: '#e3def5ff',
          borderRadius: 4,
          height: 550,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <CardContent sx={{ flex: 1, overflowY: 'auto' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Interactive Chat
          </Typography>

          {chatHistory.length === 0 ? (
            <Typography color="text.secondary">
              Start by generating a lesson or asking a question.
            </Typography>
          ) : (
            <List>
              {chatHistory.map((msg) => (
                <ListItem
                  key={msg.id}
                  sx={{
                    justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor:
                        msg.type === 'user' ? '#b69cf9ff' : 'white',
                      color: msg.type === 'user' ? 'white' : 'black',
                      maxWidth: '75%',
                      borderRadius: 3,
                      boxShadow: 1,
                    }}
                  >
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {msg.message}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}
                    >
                      {msg.timestamp.toLocaleTimeString()}
                    </Typography>
                  </Paper>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>

        {/* Input Bar */}
        <Box sx={{ p: 2, borderTop: '1px solid #ccc', bgcolor: 'white' }}>
          <Box display="flex" gap={1}>
            <TextField
              fullWidth
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatMessage();
                }
              }}
            />
            <Button
              variant="contained"
              onClick={handleChatMessage}
              disabled={loading || !question.trim() || !selectedDocument}
              startIcon={
                loading ? <CircularProgress size={20} /> : <SendIcon />
              }
              sx={{
                bgcolor: '#fdd6e9ff',
                color: '#2b007cff',
                '&:hover': { bgcolor: '#fff7bbff' },
              }}
            >
              Send
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Interactive Lecture */}
      {showInteractiveLecture && (
        <InteractiveLecture
          documentId={selectedDocument}
          onClose={() => setShowInteractiveLecture(false)}
        />
      )}
    </Container>
  );
};

export default AITutor;
