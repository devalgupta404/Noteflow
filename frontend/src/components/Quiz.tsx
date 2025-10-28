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
                    <Typography variant="h6" sx={{ mb: 2 }}>Quiz Report</Typography>
                    {/* Summary */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                      <Card sx={{ flex: 1 }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Score</Typography>
                          <Typography variant="h5">
                            {(result.results?.score ?? 0)} / {activeQuiz.questions.reduce((s, q) => s + (q.points || 1), 0)} points
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Questions: {activeQuiz.questions.length}
                          </Typography>
                        </CardContent>
                      </Card>
                      <Card sx={{ flex: 1 }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Percentage</Typography>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="h5">{result.results?.percentage ?? 0}%</Typography>
                            {result.results?.passed ? (
                              <Chip label={`Passed (≥ ${activeQuiz.passingScore || 70}%)`} color="success" size="small" />
                            ) : (
                              <Chip label={`Failed (< ${activeQuiz.passingScore || 70}%)`} color="error" size="small" />
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                      <Card sx={{ flex: 1 }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Time Spent</Typography>
                          <Typography variant="h5">{(result.results?.timeSpent ?? 0)}s</Typography>
                        </CardContent>
                      </Card>
                    </Stack>

                    {/* Focus Areas */}
                    {(() => {
                      const incorrect = (result.results?.answers || []).filter((a: any) => a && a.isCorrect === false);
                      const stop = new Set(['the','a','an','and','or','of','to','in','for','on','is','are','with','by','as','at','from','that','this','it','be','can']);
                      const text = incorrect.map((a: any) => (activeQuiz.questions.find(q => q.id === a.questionId)?.question || '')).join(' ');
                      const counts: Record<string, number> = {};
                      text.toLowerCase().split(/[^a-z0-9]+/).forEach((w: string) => {
                        if (!w || stop.has(w) || w.length < 3) return;
                        counts[w] = (counts[w] || 0) + 1;
                      });
                      const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w])=>w);
                      return (
                        <Card sx={{ mb: 2 }}>
                          <CardContent>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>Focus areas</Typography>
                            {incorrect.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">Great job! No weak areas detected.</Typography>
                            ) : (
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {top.length > 0 ? top.map((w, i) => (
                                  <Chip key={i} label={w} variant="outlined" />
                                )) : (
                                  <Typography variant="body2" color="text.secondary">Review the questions you missed below.</Typography>
                                )}
                              </Stack>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })()}

                    {/* Breakdown */}
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ mb: 2 }}>Question breakdown</Typography>
                        <Stack spacing={1}>
                          {activeQuiz.questions.map((q, idx) => {
                            const ra = (result.results?.answers || []).find((a: any) => a.questionId === q.id);
                            const status = ra?.isCorrect === true ? 'correct' : (ra ? 'incorrect' : 'not answered');
                            return (
                              <Box key={q.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                  <Typography variant="body1">{idx + 1}. {q.question}</Typography>
                                  {status === 'correct' ? (
                                    <Chip label="Correct" color="success" size="small" />
                                  ) : status === 'incorrect' ? (
                                    <Chip label="Incorrect" color="error" size="small" />
                                  ) : (
                                    <Chip label="Not answered" size="small" />
                                  )}
                                </Stack>
                                {status !== 'correct' && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Correct answer: <strong>hidden</strong>
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </Stack>
                      </CardContent>
                    </Card>
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
