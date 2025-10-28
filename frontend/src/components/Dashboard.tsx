import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Container,
  TextField,
  InputAdornment,
  Avatar,
} from '@mui/material';
import {
  Upload as UploadIcon,
  School as SchoolIcon,
  Quiz as QuizIcon,
  Work as WorkIcon,
  Description as DocumentIcon,
  Search as SearchIcon,
  MonetizationOn as CoinIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { authAPI, documentsAPI, quizAPI } from '../services/api';
import { useAuth } from '../App';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  subscription: {
    type: string;
    dailyQueries: number;
    maxDailyQueries: number;
  };
  skillScores: any[];
  reputationScore: number;
}

interface Document {
  id: string;
  title: string;
  subject: string;
  status: string;
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      if (user) {
        setProfile({
          id: user.uid,
          email: user.email || '',
          firstName: user.displayName?.split(' ')[0] || 'User',
          lastName: user.displayName?.split(' ')[1] || '',
          role: 'student',
          subscription: {
            type: 'free',
            dailyQueries: 0,
            maxDailyQueries: 10,
          },
          skillScores: [],
          reputationScore: 0,
        });
      }
      try {
        const profileResponse = await authAPI.getProfile();
        setProfile(profileResponse.data.user);
      } catch (err) {
        console.log('Backend profile not available, using Firebase user data');
      }
      try {
        const documentsResponse = await documentsAPI.getAll();
        setDocuments(documentsResponse.data.documents || []);
      } catch (err) {
        console.log('No documents found or error loading documents');
      }
      try {
        const quizzesResponse = await quizAPI.getAll();
        setQuizzes(quizzesResponse.data.quizzes || []);
      } catch (err) {
        console.log('No quizzes found or error loading quizzes');
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeSubscription = async () => {
    try {
      await authAPI.upgradeSubscription();
      await loadDashboardData();
    } catch (error: any) {
      console.error('Error upgrading subscription:', error);
      setError('Failed to upgrade subscription');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Responsive 2-column layout (global sidebar handles nav) */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 320px' } }}>

        {/* Main content */}
        <Box>
          {/* Top bar with search and credits/profile */}
          <Card sx={{ p: 2, mb: 2, borderRadius: 4 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <TextField
                fullWidth
                placeholder="Search something..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Chip icon={<CoinIcon />} label={`${profile?.subscription.dailyQueries || 0}/${profile?.subscription.maxDailyQueries || 10}`} color="primary" sx={{ borderRadius: 2 }} />
              <Avatar sx={{ width: 36, height: 36 }} />
            </Box>
          </Card>

          {/* Action cards using CSS grid */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, mb: 2 }}>
            <Card sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(123,97,255,0.12)' }}>
              <Typography variant="subtitle2" color="text.secondary">Get started</Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>AI Tutor</Typography>
              <Button href="/tutor" variant="contained" startIcon={<SchoolIcon />}>Open</Button>
            </Card>
            <Card sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(255,159,64,0.15)' }}>
              <Typography variant="subtitle2" color="text.secondary">Documents</Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>Upload</Typography>
              <Button href="/upload" variant="contained" color="secondary" startIcon={<UploadIcon />}>Upload</Button>
            </Card>
            <Card sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(255,64,129,0.12)' }}>
              <Typography variant="subtitle2" color="text.secondary">Practice</Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>Take Quiz</Typography>
              <Button href="/quiz" variant="contained" color="success" startIcon={<QuizIcon />}>Start</Button>
            </Card>
          </Box>

          {/* Marketplace banner */}
          <Card sx={{ p: 3, borderRadius: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box>
                <Typography variant="h6">Freelance Marketplace</Typography>
                <Typography variant="body2" color="text.secondary">Find tutors and gigs that match your skills.</Typography>
              </Box>
              <Button href="/marketplace" variant="contained" startIcon={<WorkIcon />}>Browse Gigs</Button>
            </Box>
          </Card>
        </Box>

        {/* Right rail */}
        <Box>
          <Card sx={{ p: 2, mb: 2, borderRadius: 4 }}>
            <Typography variant="h6" gutterBottom>Recent Documents</Typography>
            {documents.length > 0 ? (
              <List>
                {documents.slice(0, 5).map((doc) => (
                  <React.Fragment key={doc.id}>
                    <ListItem dense>
                      <DocumentIcon sx={{ mr: 1 }} />
                      <ListItemText primary={doc.title} secondary={`${doc.subject} • ${doc.status}`} />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">No documents uploaded yet</Typography>
            )}
          </Card>

          <Card sx={{ p: 2, borderRadius: 4 }}>
            <Typography variant="h6" gutterBottom>Recent Quizzes</Typography>
            {quizzes.length > 0 ? (
              <List>
                {quizzes.slice(0, 5).map((quiz) => (
                  <React.Fragment key={quiz.id}>
                    <ListItem dense>
                      <QuizIcon sx={{ mr: 1 }} />
                      <ListItemText primary={quiz.title} secondary={`${quiz.difficulty} • ${quiz.questionCount} questions`} />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">No quizzes taken yet</Typography>
            )}
          </Card>
        </Box>
      </Box>
    </Container>
  );
};

export default Dashboard;