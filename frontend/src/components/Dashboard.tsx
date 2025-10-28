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
} from '@mui/material';
import {
  Upload as UploadIcon,
  School as SchoolIcon,
  Quiz as QuizIcon,
  RecordVoiceOver as VoiceIcon,
  Work as WorkIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { authAPI, documentsAPI, quizAPI } from '../services/api';
import { useAuth } from '../App';

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
      
      // Use Firebase user data as fallback
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
      
      // Try to load user profile from backend
      try {
        const profileResponse = await authAPI.getProfile();
        setProfile(profileResponse.data.user);
      } catch (err) {
        console.log('Backend profile not available, using Firebase user data');
      }
      
      // Load documents
      try {
        const documentsResponse = await documentsAPI.getAll();
        setDocuments(documentsResponse.data.documents || []);
      } catch (err) {
        console.log('No documents found or error loading documents');
      }
      
      // Load quizzes
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
      await loadDashboardData(); // Reload to get updated profile
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
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome to NoteFlow
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* User Profile Card */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Profile
            </Typography>
            {profile && (
              <>
                <Typography variant="body1">
                  {profile.firstName} {profile.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {profile.email}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Chip
                    label={profile.subscription.type.toUpperCase()}
                    color={profile.subscription.type === 'premium' ? 'primary' : 'default'}
                    size="small"
                  />
                </Box>
                {profile.subscription.type === 'free' && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleUpgradeSubscription}
                    sx={{ mt: 1 }}
                  >
                    Upgrade to Premium
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                href="/upload"
              >
                Upload Document
              </Button>
              <Button
                variant="outlined"
                startIcon={<SchoolIcon />}
                href="/tutor"
              >
                AI Tutor
              </Button>
              <Button
                variant="outlined"
                startIcon={<QuizIcon />}
                href="/quiz"
              >
                Take Quiz
              </Button>
              <Button
                variant="outlined"
                startIcon={<VoiceIcon />}
                href="/voice"
              >
                Voice Tools
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Recent Documents */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Documents
            </Typography>
            {documents.length > 0 ? (
              <List>
                {documents.slice(0, 5).map((doc) => (
                  <React.Fragment key={doc.id}>
                    <ListItem>
                      <DocumentIcon sx={{ mr: 1 }} />
                      <ListItemText
                        primary={doc.title}
                        secondary={`${doc.subject} • ${doc.status}`}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No documents uploaded yet
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Recent Quizzes */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Quizzes
            </Typography>
            {quizzes.length > 0 ? (
              <List>
                {quizzes.slice(0, 5).map((quiz) => (
                  <React.Fragment key={quiz.id}>
                    <ListItem>
                      <QuizIcon sx={{ mr: 1 }} />
                      <ListItemText
                        primary={quiz.title}
                        secondary={`${quiz.difficulty} • ${quiz.questionCount} questions`}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No quizzes taken yet
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Marketplace */}
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Marketplace
              </Typography>
              <Button
                variant="contained"
                startIcon={<WorkIcon />}
                href="/marketplace"
              >
                Browse Gigs
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Find tutoring opportunities and monetize your skills
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Dashboard;