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
  Stack,
  Tooltip,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
} from '@mui/material';
import { quizAPI, documentsAPI } from '../services/api';

interface Document {
  id: string;
  originalName: string;
  filename: string;
  processingStatus: string;
  metadata: {
    subject: string;
  };
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
  questionCount: number;
  timeLimit?: number;
  passingScore?: number;
  difficulty?: string; // Optional; not always provided by backend list
  createdAt: string;
}

interface QuizDetailQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  difficulty?: string;
  points?: number;
}

interface QuizDetailResponse {
  quiz: {
    id: string;
    title: string;
    description?: string;
    questionCount: number;
    timeLimit?: number;
    passingScore?: number;
    questions: QuizDetailQuestion[];
  }
}

const Quiz: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeQuizId, setActiveQuizId] = useState<string>('');
  const [activeQuiz, setActiveQuiz] = useState<QuizDetailResponse['quiz'] | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadDocuments();
    loadQuizzes();
  }, []);

  const loadDocuments = async () => {
    try {
      console.log('📚 Loading documents for Quiz...');
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
        
        // Only show completed documents for quiz generation
        setDocuments(completedDocs);
      } else {
        console.log('⚠️ No documents found or empty response');
        setDocuments([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading documents:', error);
      console.error('❌ Error details:', error.response?.data);
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

  const openQuiz = async (quizId: string) => {
    try {
      setError('');
      setActiveQuizId(quizId);
      setActiveQuiz(null);
      setAnswers({});
      setResult(null);
      const res = await quizAPI.getById(quizId);
      setActiveQuiz(res.data.quiz);
    } catch (e: any) {
      console.error('Error loading quiz detail:', e);
      setError(e.response?.data?.error || 'Failed to load quiz');
    }
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        quizId: activeQuiz.id,
        answers: activeQuiz.questions.map(q => ({
          questionId: q.id,
          answer: answers[q.id] ?? null,
        })),
      };
      const res = await quizAPI.submit(payload);
      setResult(res.data);
    } catch (e: any) {
      console.error('Submit error:', e);
      setError(e.response?.data?.error || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
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

      {documents.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No completed documents available for quiz generation. Please upload and process a document first.
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
                {doc.originalName} ({doc.metadata?.subject || 'No Subject'}) - {doc.processingStatus}
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
          disabled={loading || !selectedDocument || documents.length === 0}
        >
          {loading ? <CircularProgress size={20} /> : 'Generate Quiz'}
        </Button>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Available Quizzes
            </Typography>
            {quizzes.length > 0 ? (
              <List>
                {quizzes.map((quiz) => (
                  <React.Fragment key={quiz.id}>
                    <ListItem
                      onClick={() => openQuiz(quiz.id)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemText
                        primary={quiz.title}
                        secondary={`${quiz.questionCount} questions${quiz.difficulty ? ` • ${quiz.difficulty}` : ''}`}
                      />
                      {quiz.difficulty && (
                        <Chip
                          label={quiz.difficulty}
                          color={quiz.difficulty === 'hard' ? 'error' : quiz.difficulty === 'medium' ? 'warning' : 'success'}
                          size="small"
                        />
                      )}
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

        <Card sx={{ flex: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {activeQuiz ? activeQuiz.title : 'Quiz Preview'}
            </Typography>
            {!activeQuiz && (
              <Typography variant="body2" color="text.secondary">
                Select a quiz from the list to start.
              </Typography>
            )}

            {activeQuiz && (
              <Stack spacing={2}>
                {activeQuiz.questions.map((q, idx) => (
                  <Box key={q.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                    '&:hover': { boxShadow: 1, borderColor: 'primary.light' } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="subtitle1">{idx + 1}. {q.question}</Typography>
                      {q.points ? <Chip label={`${q.points} pt`} size="small" /> : null}
                    </Stack>

                    {q.type === 'multiple_choice' && (
                      <RadioGroup
                        value={answers[q.id] ?? ''}
                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                      >
                        {(q.options || []).map((opt, i) => (
                          <FormControlLabel key={i} value={opt} control={<Radio />} label={opt} />
                        ))}
                      </RadioGroup>
                    )}

                    {q.type === 'true_false' && (
                      <RadioGroup
                        value={answers[q.id] ?? ''}
                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                      >
                        <FormControlLabel value={'True'} control={<Radio />} label="True" />
                        <FormControlLabel value={'False'} control={<Radio />} label="False" />
                      </RadioGroup>
                    )}

                    {q.type === 'short_answer' && (
                      <TextField
                        value={answers[q.id] ?? ''}
                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                        placeholder="Type your answer"
                        fullWidth
                        size="small"
                      />
                    )}
                  </Box>
                ))}

                {!result ? (
                  <Tooltip title="Submit your answers">
                    <span>
                      <Button variant="contained" onClick={submitQuiz} disabled={submitting}>
                        {submitting ? <CircularProgress size={20} /> : 'Submit Quiz'}
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Results</Typography>
                    <pre style={{ margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
                  </Box>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default Quiz;
