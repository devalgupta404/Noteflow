import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, AppBar, Toolbar, Typography, Button, Container } from '@mui/material';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Components
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import DocumentUpload from './components/DocumentUpload';
import AITutor from './components/AITutor';
import Quiz from './components/Quiz';
import VoiceSynthesis from './components/VoiceSynthesis';
import Marketplace from './components/Marketplace';
import Sidebar from './components/Sidebar';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthContext.Provider value={{ user, loading }}>
        <Router>
        <Box sx={{ display: 'flex' }}>
          {user && <Sidebar userName={user.displayName || user.email || 'User'} subscriptionLabel="FREE" />}
          <Container maxWidth="xl" sx={{ mt: 4, mb: 4, ml: { xs: 0, md: user ? '90px' : 0 } }}>
            <Routes>
              {!user ? (
                <>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="*" element={<Navigate to="/login" />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/upload" element={<DocumentUpload />} />
                  <Route path="/tutor" element={<AITutor />} />
                  <Route path="/quiz" element={<Quiz />} />
                  <Route path="/voice" element={<VoiceSynthesis />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </>
              )}
            </Routes>
          </Container>
        </Box>
        </Router>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App;