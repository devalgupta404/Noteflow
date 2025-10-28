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
  Slider,
  Alert,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  VolumeUp as VolumeIcon,
} from '@mui/icons-material';
import { voiceAPI } from '../services/api';

const VoiceSynthesis: React.FC = () => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const voices = [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' },
  ];

  const handleGenerateSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter text to convert to speech');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccess('');

    try {
      const response = await voiceAPI.textToSpeech({
        text,
        voice,
        format: 'mp3',
      });

      // Create blob URL from response
      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setSuccess('Speech generated successfully!');

    } catch (error: any) {
      console.error('Error generating speech:', error);
      setError(error.response?.data?.error || 'Failed to generate speech');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'speech.mp3';
      link.click();
    }
  };

  const handleStop = () => {
    // Stop any playing audio
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => audio.pause());
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Voice Synthesis
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
        {/* Text Input */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Text to Speech
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Enter text to convert to speech"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste your text here..."
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Voice</InputLabel>
                <Select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                >
                  {voices.map((v) => (
                    <MenuItem key={v.value} value={v.value}>
                      {v.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                onClick={handleGenerateSpeech}
                disabled={isGenerating || !text.trim()}
                startIcon={<VolumeIcon />}
              >
                {isGenerating ? 'Generating...' : 'Generate Speech'}
              </Button>
            </Box>

            {isGenerating && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Generating speech...
                </Typography>
                <LinearProgress />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Voice Controls */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Voice Settings
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography gutterBottom>Speed: {speed}x</Typography>
                <Slider
                  value={speed}
                  onChange={(_, value) => setSpeed(value as number)}
                  min={0.25}
                  max={4.0}
                  step={0.25}
                  marks={[
                    { value: 0.25, label: '0.25x' },
                    { value: 1.0, label: '1x' },
                    { value: 2.0, label: '2x' },
                    { value: 4.0, label: '4x' },
                  ]}
                />
              </Box>

              <Box>
                <Typography gutterBottom>Pitch: {pitch}</Typography>
                <Slider
                  value={pitch}
                  onChange={(_, value) => setPitch(value as number)}
                  min={0.25}
                  max={4.0}
                  step={0.25}
                  marks={[
                    { value: 0.25, label: 'Low' },
                    { value: 1.0, label: 'Normal' },
                    { value: 2.0, label: 'High' },
                    { value: 4.0, label: 'Very High' },
                  ]}
                />
              </Box>

              <Box>
                <Typography gutterBottom>Volume: {Math.round(volume * 100)}%</Typography>
                <Slider
                  value={volume}
                  onChange={(_, value) => setVolume(value as number)}
                  min={0.0}
                  max={1.0}
                  step={0.1}
                  marks={[
                    { value: 0.0, label: '0%' },
                    { value: 0.5, label: '50%' },
                    { value: 1.0, label: '100%' },
                  ]}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Audio Player */}
        {audioUrl && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generated Audio
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <IconButton onClick={handlePlay} color="primary">
                  <PlayIcon />
                </IconButton>
                
                <IconButton onClick={handleStop} color="secondary">
                  <StopIcon />
                </IconButton>
                
                <IconButton onClick={handleDownload} color="primary">
                  <DownloadIcon />
                </IconButton>
                
                <Typography variant="body2" color="text.secondary">
                  Click play to listen to your generated speech
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default VoiceSynthesis;