import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { documentsAPI } from '../services/api';
import { useAuth } from '../App';
import { auth } from '../firebase';

interface Document {
  id: string;
  title: string;
  subject: string;
  status: string;
  createdAt: string;
}

const DocumentUpload: React.FC = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please select a PDF file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !subject) {
      setError('Please select a file and enter a subject');
      return;
    }

    // Check if user is authenticated
    if (!user) {
      setError('You must be logged in to upload documents');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      // Get fresh ID token from Firebase auth
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setError('You must be logged in to upload documents');
        return;
      }
      
      const idToken = await firebaseUser.getIdToken();
      console.log('User authenticated:', firebaseUser.email);
      console.log('ID Token obtained:', !!idToken);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject', subject);
      formData.append('difficulty', difficulty);

      await documentsAPI.upload(formData);
      
      setSuccess('Document uploaded successfully!');
      setFile(null);
      setSubject('');
      setUploadProgress(0);
      
      // Reload documents list
      loadDocuments();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error details:', error.response?.data);
      setError(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await documentsAPI.getAll();
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await documentsAPI.delete(documentId);
      loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon />;
      case 'failed':
        return <ErrorIcon />;
      default:
        return undefined;
    }
  };

  React.useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Document Upload
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Upload Form */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Upload New Document
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <input
                accept=".pdf"
                style={{ display: 'none' }}
                id="file-upload"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {file ? file.name : 'Choose PDF File'}
                </Button>
              </label>
            </Box>

            <TextField
              fullWidth
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              margin="normal"
              placeholder="e.g., Mathematics, Physics, Computer Science"
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <MenuItem value="beginner">Beginner</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
              </Select>
            </FormControl>

            {uploading && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Uploading... {uploadProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={uploading || !file || !subject}
              fullWidth
              sx={{ mt: 2 }}
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Your Documents
            </Typography>
            
            {documents.length > 0 ? (
              <List>
                {documents.map((doc) => (
                  <ListItem key={doc.id} divider>
                    <ListItemText
                      primary={doc.title}
                      secondary={`${doc.subject} • ${new Date(doc.createdAt).toLocaleDateString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={doc.status}
                          color={getStatusColor(doc.status)}
                          size="small"
                          icon={getStatusIcon(doc.status)}
                        />
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteDocument(doc.id)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No documents uploaded yet
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default DocumentUpload;