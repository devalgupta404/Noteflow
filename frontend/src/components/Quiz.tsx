import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
} from '@mui/material';
import { quizAPI, documentsAPI } from '../services/api';

interface Document {
  id: string;
  title: string;
  subject: string;
  status: string;
}

interface Quiz {
  id: string;
  title: string;
  questions: any[];
  difficulty: string;
  createdAt: string;
}

const Quiz: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDocuments();
    loadQuizzes();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await documentsAPI.getAll();
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadQuizzes = async () => {
    try {
      const response = await quizAPI.getAll();
      setQuizzes(response.data.quizzes || []);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedDocument) {
      setError('Please select a document first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await quizAPI.generate({
        documentId: selectedDocument,
        questionCount,
        difficulty,
      });
      
      // Reload quizzes
      await loadQuizzes();
      
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      setError(error.response?.data?.error || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Quiz Generator
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
          >
            {documents.map((doc) => (
              <MenuItem key={doc.id} value={doc.id}>
                {doc.title} ({doc.subject})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Questions</InputLabel>
          <Select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          >
            <MenuItem value={3}>3 Questions</MenuItem>
            <MenuItem value={5}>5 Questions</MenuItem>
            <MenuItem value={10}>10 Questions</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Difficulty</InputLabel>
          <Select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <MenuItem value="easy">Easy</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="hard">Hard</MenuItem>
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          onClick={handleGenerateQuiz}
          disabled={loading || !selectedDocument}
        >
          {loading ? <CircularProgress size={20} /> : 'Generate Quiz'}
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Available Quizzes
          </Typography>
          
          {quizzes.length > 0 ? (
            <List>
              {quizzes.map((quiz) => (
                <React.Fragment key={quiz.id}>
                  <ListItem>
                    <ListItemText
                      primary={quiz.title}
                      secondary={`${quiz.questions.length} questions • ${quiz.difficulty}`}
                    />
                    <Chip
                      label={quiz.difficulty}
                      color={quiz.difficulty === 'hard' ? 'error' : quiz.difficulty === 'medium' ? 'warning' : 'success'}
                      size="small"
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No quizzes available yet. Generate one from your documents.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Quiz;
