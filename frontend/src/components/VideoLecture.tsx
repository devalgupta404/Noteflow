import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Slider,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Paper,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  Replay10,
  Forward10,
  QuestionAnswer,
  Close,
} from '@mui/icons-material';
import { lectureAPI } from '../services/api';

interface Slide {
  id: number;
  title: string;
  content: string;
  keyPoints?: (string | {title?: string; content?: string})[];
  examples?: (string | {title?: string; content?: string})[];
  voiceScript?: string;
  duration: number;
}

interface IndividualLecture {
  id: string;
  title: string;
  lectureNumber: number;
  slide: Slide;
  totalDuration: number;
  subject: string;
  difficulty: string;
  createdAt: string;
}

interface VideoLectureProps {
  documentId: string;
  onClose: () => void;
}

const VideoLecture: React.FC<VideoLectureProps> = ({ documentId, onClose }) => {
  const [lectures, setLectures] = useState<IndividualLecture[]>([]);
  const [currentLectureIndex, setCurrentLectureIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showingExample, setShowingExample] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLecture = lectures[currentLectureIndex];

  // Load individual lectures
  const loadLectures = async () => {
    try {
      console.log('🎓 Loading individual slide-based lectures...');
      setLoading(true);
      setError('');
      
      const response = await lectureAPI.generateLecture({ documentId });
      console.log('🎓 Lectures API response:', response);
      
      const data = response.data.lecture || response.data;
      console.log('🎓 Processed lectures data:', data);
      
      if (data && data.lectures) {
        console.log(`✅ Loaded ${data.lectures.length} individual lectures`);
        setLectures(data.lectures);
        setCurrentLectureIndex(0);
      } else {
        throw new Error('Invalid lectures data structure');
      }
    } catch (error: any) {
      console.error('❌ Error loading lectures:', error);
      setError(error.response?.data?.error || error.message || 'Failed to load lectures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLectures();
  }, [documentId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!currentLecture) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handlePreviousLecture();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNextLecture();
          break;
        case ' ':
          event.preventDefault();
          if (isPlaying && !isPaused) {
            handlePause();
          } else {
            handlePlay();
          }
          break;
        case 'Escape':
          event.preventDefault();
          handleStop();
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentLecture, isPlaying, isPaused]);

  // Text-to-speech with example highlighting
  const speakText = async (text: string) => {
    try {
      console.log('🎤 Starting TTS for video lecture...');
      setShowingExample(null);
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = isMuted ? 0 : volume;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        const voices = speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.includes('Google')
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
        
        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            const word = text.substring(event.charIndex, event.charIndex + event.charLength).toLowerCase();
            if (word.includes('example') || word.includes('let') || word.includes('here') || word.includes('show')) {
              const exampleIndex = Math.floor(Math.random() * (currentLecture?.slide?.examples?.length || 0));
              if (exampleIndex < (currentLecture?.slide?.examples?.length || 0)) {
                setShowingExample(exampleIndex);
                setTimeout(() => setShowingExample(null), 5000);
              }
            }
          }
        };
        
        utterance.onstart = () => {
          console.log('🎤 Video TTS started');
          setIsPlaying(true);
        };
        
        utterance.onend = () => {
          console.log('🎤 Video TTS ended');
          setIsPlaying(false);
          setCurrentTime(0);
        };
        
        utterance.onerror = (event) => {
          console.error('🎤 Video TTS error:', event.error);
          setIsPlaying(false);
        };
        
        speechSynthesis.speak(utterance);
        return;
      }
      
      // Fallback to API TTS
      const response = await lectureAPI.textToSpeech({ text, voice: 'alloy' });
      const audioBlob = response.data;
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.volume = isMuted ? 0 : volume;
        
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };
        
        audioRef.current.onerror = () => {
          console.error('🎤 API TTS error');
          setIsPlaying(false);
        };
        
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('❌ TTS error:', error);
      setIsPlaying(false);
    }
  };

  // Playback controls
  const handlePlay = async () => {
    if (!currentLecture) return;
    
    console.log('▶️ Starting video lecture playback...');
    
    if (isPaused) {
      setIsPaused(false);
      if ('speechSynthesis' in window) {
        speechSynthesis.resume();
      } else if (audioRef.current) {
        audioRef.current.play();
      }
      return;
    }

    setIsPlaying(true);
    const slide = currentLecture.slide;
    
    if (slide.voiceScript) {
      await speakText(slide.voiceScript);
    }
  };

  const handlePause = () => {
    console.log('⏸️ Pausing video lecture');
    setIsPaused(true);
    
    if ('speechSynthesis' in window) {
      speechSynthesis.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleStop = () => {
    console.log('⏹️ Stopping video lecture');
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handlePreviousLecture = () => {
    if (currentLectureIndex > 0) {
      console.log('⬅️ Going to previous lecture');
      setCurrentLectureIndex(prev => prev - 1);
      handleStop();
    }
  };

  const handleNextLecture = () => {
    if (currentLectureIndex < lectures.length - 1) {
      console.log('➡️ Going to next lecture');
      setCurrentLectureIndex(prev => prev + 1);
      handleStop();
    }
  };

  const handleLectureSelect = (lectureIndex: number) => {
    console.log('🎯 Jumping to lecture:', lectureIndex + 1);
    setCurrentLectureIndex(lectureIndex);
    handleStop();
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    // Note: Browser TTS doesn't support seeking, this is for visual feedback
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Generating individual lectures...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!currentLecture) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6">No lecture data available</Typography>
      </Box>
    );
  }

  const slide = currentLecture.slide;
  const progress = (currentTime / currentLecture.totalDuration) * 100;

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: '#000',
        color: '#fff'
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{currentLecture.title}</Typography>
        <Box display="flex" gap={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Lecture</InputLabel>
            <Select
              value={currentLectureIndex}
              onChange={(e) => handleLectureSelect(e.target.value as number)}
              label="Lecture"
            >
              {lectures.map((lecture, index) => (
                <MenuItem key={lecture.id} value={index}>
                  {lecture.id}: {lecture.slide.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton onClick={onClose} sx={{ color: '#fff' }}>
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Card sx={{ maxWidth: 800, width: '100%', bgcolor: '#1a1a1a', color: '#fff' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ textAlign: 'center', mb: 4 }}>
              {slide.title}
            </Typography>
            
            {/* Key Points and Examples */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
              {/* Key Points */}
              {slide.keyPoints && slide.keyPoints.length > 0 && (
                <Paper elevation={3} sx={{ p: 3, flex: 1, bgcolor: '#2a2a2a' }}>
                  <Typography variant="h6" gutterBottom color="primary">
                    📌 Key Points
                  </Typography>
                  {slide.keyPoints.map((point, index) => (
                    <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'flex-start' }}>
                      <Typography variant="body2" sx={{ mr: 1, color: 'primary.main' }}>
                        •
                      </Typography>
                      <Typography variant="body2">
                        {typeof point === 'string' ? point : point.title || point.content || JSON.stringify(point)}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}

              {/* Examples */}
              {slide.examples && slide.examples.length > 0 && (
                <Paper elevation={3} sx={{ p: 3, flex: 1, bgcolor: '#2a2a2a' }}>
                  <Typography variant="h6" gutterBottom color="secondary">
                    💡 Examples
                  </Typography>
                  {slide.examples.map((example, index) => (
                    <Box 
                      key={index} 
                      sx={{ 
                        mb: 1, 
                        display: 'flex', 
                        alignItems: 'flex-start',
                        p: showingExample === index ? 2 : 1,
                        borderRadius: showingExample === index ? '8px' : '4px',
                        bgcolor: showingExample === index ? 'primary.light' : 'transparent',
                        border: showingExample === index ? '2px solid' : 'none',
                        borderColor: showingExample === index ? 'primary.main' : 'transparent',
                        transition: 'all 0.3s ease-in-out',
                        transform: showingExample === index ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: showingExample === index ? 3 : 0
                      }}
                    >
                      <Typography variant="body2" sx={{ mr: 1, color: 'secondary.main' }}>
                        •
                      </Typography>
                      <Typography variant="body2">
                        {typeof example === 'string' ? example : example.title || example.content || JSON.stringify(example)}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            <Typography variant="body1" sx={{ textAlign: 'center', fontSize: '1.1rem', lineHeight: 1.6 }}>
              {slide.content}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Bottom Controls Bar */}
      <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderTop: '1px solid #333' }}>
        {/* Progress Bar */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress}
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: '#333',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#ff0000'
              }
            }}
          />
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Lecture Navigation */}
            <IconButton 
              onClick={handlePreviousLecture}
              disabled={currentLectureIndex === 0}
              sx={{ color: '#fff' }}
            >
              <SkipPrevious />
            </IconButton>
            
            {/* Playback Controls */}
            <IconButton onClick={handlePlay} disabled={isPlaying && !isPaused} sx={{ color: '#fff' }}>
              <PlayArrow />
            </IconButton>
            <IconButton onClick={handlePause} disabled={!isPlaying || isPaused} sx={{ color: '#fff' }}>
              <Pause />
            </IconButton>
            <IconButton onClick={handleStop} sx={{ color: '#fff' }}>
              <Stop />
            </IconButton>
            
            {/* 10 Second Controls */}
            <IconButton onClick={() => handleSeek(Math.max(0, currentTime - 10))} sx={{ color: '#fff' }}>
              <Replay10 />
            </IconButton>
            <IconButton onClick={() => handleSeek(Math.min(currentLecture.totalDuration, currentTime + 10))} sx={{ color: '#fff' }}>
              <Forward10 />
            </IconButton>
            
            {/* Next Lecture */}
            <IconButton 
              onClick={handleNextLecture}
              disabled={currentLectureIndex === lectures.length - 1}
              sx={{ color: '#fff' }}
            >
              <SkipNext />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Time Display */}
            <Typography variant="body2" sx={{ color: '#fff', minWidth: 100, textAlign: 'center' }}>
              {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')} / {Math.floor(currentLecture.totalDuration / 60)}:{(currentLecture.totalDuration % 60).toFixed(0).padStart(2, '0')}
            </Typography>

            {/* Volume Control */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => setIsMuted(!isMuted)} sx={{ color: '#fff' }}>
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
              <Slider
                value={volume}
                onChange={(_, value) => setVolume(value as number)}
                min={0}
                max={1}
                step={0.1}
                sx={{ width: 100, color: '#fff' }}
                disabled={isMuted}
              />
            </Box>

            {/* Fullscreen */}
            <IconButton onClick={toggleFullscreen} sx={{ color: '#fff' }}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Box>
        </Box>

        {/* Keyboard Shortcuts */}
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
            ⌨️ Space: Play/Pause • ← →: Previous/Next Lecture • F: Fullscreen • Esc: Stop
          </Typography>
        </Box>
      </Box>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} />
    </Box>
  );
};

export default VideoLecture;
