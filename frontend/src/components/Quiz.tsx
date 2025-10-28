// src/pages/Quiz.tsx
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
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Avatar,
  Container,
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
  difficulty?: string;
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
  };
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
      const response = await documentsAPI.getAll();
      if (response.data.documents && response.data.documents.length > 0) {
        const completedDocs = response.data.documents.filter(
          (doc: any) => doc.processingStatus === 'completed'
        );
        setDocuments(completedDocs);
      } else {
        setDocuments([]);
      }
    } catch (error: any) {
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
      setError(e.response?.data?.error || 'Failed to load quiz');
    }
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        quizId: activeQuiz.id,
        answers: activeQuiz.questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id] ?? null,
        })),
      };
      const res = await quizAPI.submit(payload);
      setResult(res.data);
    } catch (e: any) {
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
      await loadQuizzes();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ bgcolor: '#f5f3ff', minHeight: '100vh', py: 4, borderRadius: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Course Quiz Dashboard
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Search / Generate Section */}
        <Card sx={{ p: 2, background: '#bdb6e9ff', borderRadius: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Generate a Quiz
            </Typography>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <FormControl sx={{ minWidth: 250 }}>
                <InputLabel>Document</InputLabel>
                <Select
                  value={selectedDocument}
                  onChange={(e) => setSelectedDocument(e.target.value)}
                >
                  {documents.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar
                          src="https://cdn-icons-png.flaticon.com/512/337/337946.png"
                          alt="doc"
                          sx={{ width: 24, height: 24 }}
                        />
                        {doc.originalName}
                      </Box>
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
                  <MenuItem value={3}>3</MenuItem>
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
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
                sx={{ bgcolor: '#2b007cff', color: 'white' }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Generate Quiz'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Available Quizzes */}
        <Card sx={{ background: '#e3def5ff', borderRadius: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Available Quizzes
            </Typography>
            {quizzes.length > 0 ? (
              <List>
                {quizzes.map((quiz) => (
                  <React.Fragment key={quiz.id}>
                    <ListItem
                      onClick={() => openQuiz(quiz.id)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#ccc2f7ff' },
                        borderRadius: 2,
                      }}
                    >
                      <ListItemText
                        primary={<strong>{quiz.title}</strong>}
                        secondary={`${quiz.questionCount} questions`}
                      />
                      <Chip
                        label={quiz.difficulty || 'Medium'}
                        sx={{
                          bgcolor:
                            quiz.difficulty === 'hard'
                              ? '#d4b8f2ff'
                              : quiz.difficulty === 'easy'
                              ? '#b69cf9ff'
                              : '#908ab8ff',
                        }}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">
                No quizzes available yet. Generate one to begin.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Active Quiz */}
        <Card sx={{ background: '#fff7bbff', borderRadius: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {activeQuiz ? activeQuiz.title : 'Quiz Preview'}
            </Typography>
            {!activeQuiz && (
              <Typography color="text.secondary">
                Select a quiz from above to start answering.
              </Typography>
            )}

            {activeQuiz && (
              <Stack spacing={2}>
                {activeQuiz.questions.map((q, idx) => (
                  <Box
                    key={q.id}
                    sx={{
                      p: 2,
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      bgcolor: 'white',
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {idx + 1}. {q.question}
                    </Typography>

                    {q.type === 'multiple_choice' && (
                      <RadioGroup
                        value={answers[q.id] ?? ''}
                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                      >
                        {q.options?.map((opt, i) => (
                          <FormControlLabel
                            key={i}
                            value={opt}
                            control={<Radio />}
                            label={opt}
                          />
                        ))}
                      </RadioGroup>
                    )}

                    {q.type === 'true_false' && (
                      <RadioGroup
                        value={answers[q.id] ?? ''}
                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                      >
                        <FormControlLabel value="True" control={<Radio />} label="True" />
                        <FormControlLabel value="False" control={<Radio />} label="False" />
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

                <Button
                  variant="contained"
                  sx={{ bgcolor: '#fdd6e9ff', color: 'white', width: 'fit-content' }}
                  onClick={submitQuiz}
                  disabled={submitting}
                >
                  {submitting ? <CircularProgress size={20} /> : 'Submit Quiz'}
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Quiz;
