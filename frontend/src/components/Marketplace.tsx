import React, { useState, useEffect } from 'react';
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
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Work as WorkIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { marketplaceAPI } from '../services/api';

interface Gig {
  id: string;
  title: string;
  description: string;
  subject: string;
  category: string;
  budget: number;
  deadline: string;
  status: string;
  createdAt: string;
  createdBy: string;
}

const Marketplace: React.FC = () => {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGig, setNewGig] = useState({
    title: '',
    description: '',
    subject: '',
    category: '',
    budget: '',
    deadline: '',
  });

  useEffect(() => {
    loadGigs();
  }, []);

  const loadGigs = async () => {
    try {
      setLoading(true);
      const response = await marketplaceAPI.getGigs();
      setGigs(response.data.gigs || []);
    } catch (error) {
      console.error('Error loading gigs:', error);
      setError('Failed to load gigs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGig = async () => {
    try {
      setError('');
      setSuccess('');
      
      const gigData = {
        ...newGig,
        budget: parseFloat(newGig.budget),
        currency: 'USD',
      };

      await marketplaceAPI.createGig(gigData);
      
      setSuccess('Gig created successfully!');
      setCreateDialogOpen(false);
      setNewGig({
        title: '',
        description: '',
        subject: '',
        category: '',
        budget: '',
        deadline: '',
      });
      
      loadGigs();
    } catch (error: any) {
      console.error('Error creating gig:', error);
      setError(error.response?.data?.error || 'Failed to create gig');
    }
  };

  const handleDeleteGig = async (gigId: string) => {
    try {
      // Note: There's no delete method in the API, so we'll just remove from local state
      setGigs(gigs.filter(gig => gig.id !== gigId));
      loadGigs();
    } catch (error) {
      console.error('Error deleting gig:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Marketplace
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Gig
        </Button>
      </Box>

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

      {/* Gigs List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Available Gigs
          </Typography>
          
          {gigs.length > 0 ? (
            <List>
              {gigs.map((gig) => (
                <ListItem key={gig.id} divider>
                  <ListItemText
                    primary={gig.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {gig.description}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip label={gig.subject} size="small" />
                          <Chip label={gig.category} size="small" />
                          <Chip label={`$${gig.budget}`} size="small" color="primary" />
                          <Chip 
                            label={gig.status} 
                            size="small" 
                            color={getStatusColor(gig.status)}
                          />
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteGig(gig.id)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No gigs available
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Create Gig Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Gig</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={newGig.title}
              onChange={(e) => setNewGig({ ...newGig, title: e.target.value })}
            />
            
            <TextField
              fullWidth
              label="Subject"
              value={newGig.subject}
              onChange={(e) => setNewGig({ ...newGig, subject: e.target.value })}
            />
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={newGig.description}
              onChange={(e) => setNewGig({ ...newGig, description: e.target.value })}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={newGig.category}
                  onChange={(e) => setNewGig({ ...newGig, category: e.target.value })}
                >
                  <MenuItem value="tutoring">Tutoring</MenuItem>
                  <MenuItem value="assignment">Assignment Help</MenuItem>
                  <MenuItem value="project">Project Work</MenuItem>
                  <MenuItem value="consultation">Consultation</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label="Budget ($)"
                type="number"
                value={newGig.budget}
                onChange={(e) => setNewGig({ ...newGig, budget: e.target.value })}
              />
              
              <TextField
                fullWidth
                label="Deadline"
                type="date"
                value={newGig.deadline}
                onChange={(e) => setNewGig({ ...newGig, deadline: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateGig} 
            variant="contained"
            disabled={!newGig.title || !newGig.description || !newGig.subject}
          >
            Create Gig
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Marketplace;