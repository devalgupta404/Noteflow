import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Slider,
  Chip,
  Alert,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  Divider,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  Mic,
  VolumeUp,
  VolumeOff,
  QuestionAnswer,
} from '@mui/icons-material';
import { lectureAPI } from '../services/api';
import { auth } from '../firebase';

interface Slide {
  id: number;
  title: string;
  content: string;
  keyPoints?: (string | {title?: string; content?: string})[];
  examples?: (string | {title?: string; content?: string})[];
  flowchart?: {
    type: string;
    nodes: Array<{id: string; label: string; type: string}>;
    connections: Array<{from: string; to: string; label: string}>;
  };
  animation?: {
    sequence: string[];
    timing: number[];
  };
  voiceScript?: string;
  duration: number;
  pdfSlide?: string;
}

interface Lecture {
  title: string;
  introduction: string;
  slides: Slide[];
  interactions: Array<{
    slideId: number;
    question: string;
    expectedAnswers: string[];
    feedback: string;
  }>;
  summary: string;
  totalDuration: number;
}

interface InteractiveLectureProps {
  documentId: string;
  onClose: () => void;
}

const InteractiveLecture: React.FC<InteractiveLectureProps> = ({ documentId, onClose }) => {
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showQADialog, setShowQADialog] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showingExample, setShowingExample] = useState<number | null>(null);
  const [wasPlayingBeforeDoubt, setWasPlayingBeforeDoubt] = useState(false);
  const [lecturePausedForDoubt, setLecturePausedForDoubt] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const recordingRef = useRef<MediaRecorder | null>(null);

  // Memoize current slide data to prevent unnecessary re-renders
  const currentSlideData = useMemo(() => {
    if (!lecture || !lecture.slides || lecture.slides.length === 0) return null;
    return lecture.slides[currentSlide];
  }, [lecture, currentSlide]);

  // Get authentication token
  const getAuthToken = async (): Promise<string> => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        return token;
      }
      throw new Error('No authenticated user');
    } catch (error) {
      console.error('❌ Failed to get auth token:', error);
      throw error;
    }
  };

  const loadLecture = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loading) {
      console.log('⏳ Lecture already loading, skipping duplicate call');
      return;
    }

    try {
      console.log('🎓 Starting lecture load process...');
      setLoading(true);
      setError('');
      
      console.log('📡 Making API request to generate lecture...');
      const response = await lectureAPI.generateLecture({ documentId });
      console.log('🎓 Lecture API response received:', response);
      
      // Handle different response structures
      const lectureData = response.data.lecture || response.data;
      console.log('🎓 Processed lecture data:', lectureData);
      
      if (lectureData && lectureData.slides) {
        // Traditional comprehensive lecture format
        console.log(`✅ Lecture loaded successfully with ${lectureData.slides.length} slides`);
        console.log('📊 Slide details:', lectureData.slides.map((slide: Slide) => ({
          id: slide.id,
          title: slide.title,
          hasVoiceScript: !!slide.voiceScript,
          voiceScriptLength: slide.voiceScript?.length || 0,
          keyPoints: slide.keyPoints?.length || 0,
          examples: slide.examples?.length || 0
        })));
        
        setLecture(lectureData);
        console.log('🎯 Set lecture data, current slide will be:', lectureData.slides[0]);
      } else if (lectureData && lectureData.lectures) {
        // Individual slide-based lectures format (L1, L2, L3...)
        console.log(`✅ Individual lectures loaded successfully with ${lectureData.lectures.length} lectures`);
        
        // Convert individual lectures to traditional format for compatibility
        const convertedLecture = {
          title: `${lectureData.subject} Interactive Lecture`,
          introduction: `Welcome to this interactive lecture series on ${lectureData.subject}! We have ${lectureData.lectures.length} individual lectures to explore.`,
          slides: lectureData.lectures.map((lecture: any, index: number) => ({
            id: index + 1,
            title: lecture.slide.title,
            content: lecture.slide.content,
            keyPoints: lecture.slide.keyPoints || [],
            examples: lecture.slide.examples || [],
            voiceScript: lecture.slide.voiceScript,
            duration: lecture.slide.duration || 180,
            ttsScript: lecture.slide.ttsScript
          })),
          interactions: [],
          summary: `We've completed ${lectureData.lectures.length} individual lectures on ${lectureData.subject}.`,
          totalDuration: lectureData.lectures.reduce((sum: number, lecture: any) => sum + (lecture.slide.duration || 180), 0)
        };
        
        console.log('📊 Converted slide details:', convertedLecture.slides.map((slide: Slide) => ({
          id: slide.id,
          title: slide.title,
          hasVoiceScript: !!slide.voiceScript,
          voiceScriptLength: slide.voiceScript?.length || 0,
          keyPoints: slide.keyPoints?.length || 0,
          examples: slide.examples?.length || 0
        })));
        
        setLecture(convertedLecture);
        console.log('🎯 Set converted lecture data, current slide will be:', convertedLecture.slides[0]);
      } else {
        console.error('❌ Invalid lecture data structure:', lectureData);
        throw new Error('Invalid lecture data structure');
      }
    } catch (error: any) {
      console.error('❌ Lecture loading error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setError(error.response?.data?.error || error.message || 'Failed to load lecture');
    } finally {
      setLoading(false);
      console.log('🏁 Lecture load process completed');
    }
  }, [documentId]); // Remove loading from dependencies to prevent circular dependency

  // Load lecture
  useEffect(() => {
    loadLecture();
  }, [documentId]); // Only depend on documentId, not loadLecture

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop any ongoing TTS when component unmounts
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
      // Stop any audio element
      const audioElement = audioRef.current;
      if (audioElement) {
        audioElement.pause();
        audioElement.load();
      }
    };
  }, []);


  // Text-to-speech with fallback and example highlighting
  const speakText = useCallback(async (text: string) => {
    try {
      console.log('🎤 Starting TTS process...');
      console.log('📝 Text to be spoken:', text.substring(0, 100) + '...');
      
      // Reset example highlighting
      setShowingExample(null);
      
      // Try browser's built-in speech synthesis first (free and works offline)
      if ('speechSynthesis' in window) {
        console.log('🎤 Using browser TTS (SpeechSynthesis API)');
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = isMuted ? 0 : volume;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        // Use a more natural voice if available
        const voices = speechSynthesis.getVoices();
        console.log('🎤 Available voices:', voices.length);
        
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.includes('Google')
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
          utterance.voice = englishVoice;
          console.log('🎤 Using voice:', englishVoice.name);
        } else {
          console.log('🎤 Using default voice');
        }
        
        // Add event listeners for example highlighting
        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            const word = text.substring(event.charIndex, event.charIndex + event.charLength).toLowerCase();
            // Check if we're mentioning an example
            if (word.includes('example') || word.includes('let') || word.includes('here') || word.includes('show')) {
              // Find the next example to highlight
              const exampleIndex = Math.floor(Math.random() * (currentSlideData?.examples?.length || 0));
              if (exampleIndex < (currentSlideData?.examples?.length || 0)) {
                console.log('✨ Highlighting example:', exampleIndex);
                setShowingExample(exampleIndex);
                // Hide after 5 seconds
                setTimeout(() => setShowingExample(null), 5000);
              }
            }
          }
        };
        
        utterance.onstart = () => {
          console.log('🎤 TTS started');
          setIsPlaying(true);
          setIsPaused(false);
        };
        
        utterance.onend = () => {
          console.log('🎤 TTS ended');
          setIsPlaying(false);
        };
        
        utterance.onerror = (event) => {
          console.error('🎤 TTS error:', event.error);
          // Don't treat "interrupted" as a real error
          if (event.error !== 'interrupted') {
            setIsPlaying(false);
          }
        };
        
        utterance.onpause = () => {
          console.log('🎤 TTS paused');
          setIsPaused(true);
        };
        
        utterance.onresume = () => {
          console.log('🎤 TTS resumed');
          setIsPaused(false);
        };
        
        // Cancel any existing speech before starting new one
        speechSynthesis.cancel();
        
        // Add a small delay to ensure the speech synthesis is ready
        setTimeout(() => {
          speechSynthesis.speak(utterance);
        }, 100);
        return;
      }
      
      // Fallback to API TTS
      const response = await lectureAPI.textToSpeech({ text, voice: 'alloy' });
      const audioBlob = response.data;
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.volume = isMuted ? 0 : volume;
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
      // Final fallback: just log the text
      console.log('📢 Speaking:', text);
    }
  }, [volume, isMuted, currentSlideData]);

  // Play/pause controls
  const handlePlay = useCallback(async () => {
    if (!lecture) {
      console.error('❌ No lecture data available');
      return;
    }

    // Prevent multiple simultaneous calls
    if (isPlaying && !isPaused) {
      console.log('⏸️ Already playing, ignoring duplicate play request');
      return;
    }

    // Cancel any existing speech before starting new one
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    console.log('▶️ Starting lecture playback...');
    console.log('📊 Current slide:', currentSlide + 1, 'of', lecture.slides.length);

    if (isPaused) {
      console.log('⏯️ Resuming from pause');
      setIsPaused(false);
      // Resume browser TTS if it was paused
      if ('speechSynthesis' in window) {
        speechSynthesis.resume();
      } else if (audioRef.current) {
        audioRef.current.play();
      }
      return;
    }

    // Don't set isPlaying here - let speakText handle it
    const slide = lecture.slides[currentSlide];
    console.log('🎯 Playing slide:', slide.title);
    console.log('📝 Slide content preview:', slide.content.substring(0, 100) + '...');
    
    // Start narration
    if (slide.voiceScript) {
      console.log('🎤 Starting voice script narration...');
      console.log('📝 Voice script preview:', slide.voiceScript.substring(0, 100) + '...');
      await speakText(slide.voiceScript);
    } else {
      console.warn('⚠️ No voice script available for this slide');
      // If no voice script, set playing state manually
      setIsPlaying(true);
    }
    
    // Auto-advance after duration
    console.log('⏰ Setting auto-advance timer for', slide.duration, 'seconds');
    setTimeout(() => {
      if (currentSlide < lecture.slides.length - 1) {
        console.log('🔄 Auto-advancing to next slide');
        setCurrentSlide(prev => prev + 1);
      } else {
        console.log('🏁 Lecture completed');
        setIsPlaying(false);
      }
    }, slide.duration * 1000);
  }, [lecture, currentSlide, isPaused, volume, isMuted, isPlaying, speakText]);

  const handlePause = () => {
    console.log('⏸️ Pausing lecture...');
    setIsPaused(true);
    
    // Pause browser TTS
    if ('speechSynthesis' in window) {
      speechSynthesis.pause();
    }
    
    // Pause audio element
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSlide(0);
    setProgress(0);
    
    // Stop browser TTS
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    // Stop audio element
    audioRef.current?.pause();
    audioRef.current?.load();
  };

  const handlePrevious = useCallback(() => {
    if (!lecture) return;
    
    console.log('⬅️ Going to previous slide');
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
      setIsPlaying(false);
      setIsPaused(false);
      
      // Stop current TTS
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    }
  }, [lecture, currentSlide]);

  const handleNext = useCallback(() => {
    if (!lecture) return;
    
    console.log('➡️ Going to next slide');
    if (currentSlide < lecture.slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
      setIsPlaying(false);
      setIsPaused(false);
      
      // Stop current TTS
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    }
  }, [lecture, currentSlide]);

  const handleSlideSelect = (slideIndex: number) => {
    if (!lecture) return;
    
    console.log('🎯 Jumping to slide:', slideIndex + 1);
    setCurrentSlide(slideIndex);
    setIsPlaying(false);
    setIsPaused(false);
    
    // Stop current TTS
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!lecture) return;
      
      // Don't interfere with text input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNext();
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
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lecture, currentSlide, isPlaying, isPaused, handleNext, handlePlay, handlePrevious]);

  // Voice recording with speech-to-text
  const startRecording = async () => {
    try {
      console.log('🎤 Starting voice recording for doubt solving...');
      
      // Check microphone permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        console.log('🎤 Microphone access granted');
        
        // Pause lecture if it's currently playing
        if (isPlaying && !isPaused) {
          console.log('⏸️ Pausing lecture for doubt solving...');
          setWasPlayingBeforeDoubt(true);
          setLecturePausedForDoubt(true);
          handlePause();
        } else {
          setWasPlayingBeforeDoubt(false);
        }
        
        recordingRef.current = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        const audioChunks: Blob[] = [];
        
        recordingRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log('🎤 Audio chunk received:', event.data.size, 'bytes');
          }
        };
        
        recordingRef.current.onstop = async () => {
          console.log('🎤 Recording stopped, processing audio...');
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log('🎤 Audio blob created:', audioBlob.size, 'bytes');
          
          try {
            // Convert speech to text using browser's Web Speech API
            await processAudioToText(audioBlob);
          } catch (error) {
            console.error('❌ Speech-to-text error:', error);
            setError('Failed to process voice input. Please try typing your question.');
            // Resume lecture if it was paused for doubt solving
            if (lecturePausedForDoubt && wasPlayingBeforeDoubt) {
              console.log('▶️ Resuming lecture after voice input error...');
              handlePlay();
              setLecturePausedForDoubt(false);
              setWasPlayingBeforeDoubt(false);
            }
          }
          
          // Clean up stream
          stream.getTracks().forEach(track => track.stop());
        };
        
        recordingRef.current.start();
        setIsRecording(true);
        console.log('🎤 Recording started - speak your question now!');
        
      } catch (micError) {
        console.error('❌ Microphone access error:', micError);
        setError('Microphone access denied. Please allow microphone access and try again.');
        // Resume lecture if it was paused for doubt solving
        if (lecturePausedForDoubt && wasPlayingBeforeDoubt) {
          console.log('▶️ Resuming lecture after microphone error...');
          handlePlay();
          setLecturePausedForDoubt(false);
          setWasPlayingBeforeDoubt(false);
        }
      }
    } catch (error) {
      console.error('❌ Recording error:', error);
      setError('Failed to access microphone. Please check permissions.');
      // Resume lecture if it was paused for doubt solving
      if (lecturePausedForDoubt && wasPlayingBeforeDoubt) {
        console.log('▶️ Resuming lecture after recording error...');
        handlePlay();
        setLecturePausedForDoubt(false);
        setWasPlayingBeforeDoubt(false);
      }
    }
  };

  const stopRecording = () => {
    if (recordingRef.current && isRecording) {
      console.log('🎤 Stopping recording...');
      recordingRef.current.stop();
      setIsRecording(false);
    }
  };

  // Process audio to text using Web Speech API
  const processAudioToText = async (audioBlob: Blob) => {
    try {
      console.log('🎤 Converting speech to text...');
      
      // Use Web Speech API for speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;
        
        return new Promise<void>((resolve, reject) => {
          let resolved = false;
          
          // Set a timeout for speech recognition
          const timeout = setTimeout(() => {
            if (!resolved) {
              console.log('🎤 Speech recognition timeout');
              recognition.stop();
              reject(new Error('Speech recognition timeout'));
            }
          }, 15000); // 15 second timeout
          
          recognition.onresult = (event: any) => {
            console.log('🎤 Speech recognition event:', event);
            if (event.results && event.results.length > 0) {
              const transcript = event.results[0][0].transcript;
              console.log('🎤 Speech recognized:', transcript);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                setQuestion(transcript);
                setShowQADialog(true);
                resolve();
              }
            } else {
              console.log('🎤 No speech results found');
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(new Error('No speech results'));
              }
            }
          };
          
          recognition.onerror = (event: any) => {
            console.error('❌ Speech recognition error:', event.error);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              
              // Handle specific error types
              if (event.error === 'no-speech') {
                console.log('🎤 No speech detected, trying backend fallback...');
                // Try backend fallback instead of rejecting
                processAudioWithBackend(audioBlob).then(resolve).catch(reject);
              } else if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone access and try again.');
                reject(new Error('Microphone access denied'));
              } else if (event.error === 'network') {
                setError('Network error. Please check your internet connection.');
                reject(new Error('Network error'));
              } else {
                setError(`Speech recognition failed: ${event.error}`);
                reject(new Error(event.error));
              }
            }
          };
          
          recognition.onend = () => {
            console.log('🎤 Speech recognition ended');
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              reject(new Error('Speech recognition ended without results'));
            }
          };
          
          recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
          };
          
          recognition.start();
          console.log('🎤 Speech recognition started');
        });
      } else {
        // Fallback: Send audio to backend for processing
        console.log('🎤 Web Speech API not available, sending to backend...');
        await processAudioWithBackend(audioBlob);
      }
    } catch (error) {
      console.error('❌ Speech-to-text processing error:', error);
      throw error;
    }
  };

  // Fallback: Process audio with backend
  const processAudioWithBackend = async (audioBlob: Blob) => {
    try {
      console.log('🎤 Sending audio to backend for processing...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'question.webm');
      
      const response = await fetch('/api/voice/speech-to-text', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('🎤 Backend speech-to-text result:', result);
        
        if (result.transcript && result.transcript.trim()) {
          setQuestion(result.transcript);
          setShowQADialog(true);
        } else {
          throw new Error('No transcript received from backend');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Backend speech-to-text failed:', response.status, errorText);
        throw new Error(`Backend speech-to-text failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Backend speech-to-text error:', error);
      setError('Failed to process voice input. Please try typing your question.');
      throw error;
    }
  };

  // Interactive Q&A
  const handleQuestion = async () => {
    if (!question.trim() || !lecture) return;

    try {
      const slide = lecture.slides[currentSlide];
      const response = await lectureAPI.interactiveQA({
        question,
        lectureContext: {
          title: lecture.title,
          currentSlide: currentSlide
        },
        slideContext: {
          title: slide.title,
          content: slide.content
        },
        conversationHistory
      });

      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: question, timestamp: new Date() },
        { role: 'assistant', content: response.data.response.answer, timestamp: new Date() }
      ]);

      setQuestion('');
      setShowQADialog(false);

      // Speak the response
      await speakText(response.data.response.answer);
      
      // Resume lecture if it was paused for doubt solving
      if (lecturePausedForDoubt && wasPlayingBeforeDoubt) {
        console.log('▶️ Resuming lecture after question answered...');
        handlePlay();
        setLecturePausedForDoubt(false);
        setWasPlayingBeforeDoubt(false);
      }
    } catch (error) {
      console.error('Q&A error:', error);
      // Resume lecture if it was paused for doubt solving (even on error)
      if (lecturePausedForDoubt && wasPlayingBeforeDoubt) {
        console.log('▶️ Resuming lecture after Q&A error...');
        handlePlay();
        setLecturePausedForDoubt(false);
        setWasPlayingBeforeDoubt(false);
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading Interactive Lecture...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadLecture}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!lecture) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Typography>No lecture data available</Typography>
      </Box>
    );
  }

  if (!lecture) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6">No lecture data available</Typography>
      </Box>
    );
  }

  if (!currentSlideData) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6">No slide data available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">{lecture.title}</Typography>
          <Box display="flex" gap={1}>
            <Chip label={`Slide ${currentSlide + 1}/${lecture.slides.length}`} />
            <Chip label={`${Math.round(progress * 100)}% Complete`} />
          </Box>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={(currentSlide / lecture.slides.length) * 100} 
          sx={{ mt: 1 }}
        />
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Slide Content */}
        <Box sx={{ flex: 1, p: 3, position: 'relative' }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {currentSlideData.title}
              </Typography>
              
              {/* Key Points and Examples */}
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                {/* Key Points */}
                {currentSlideData.keyPoints && currentSlideData.keyPoints.length > 0 && (
                  <Paper elevation={3} sx={{ p: 3, flex: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📌 Key Points
                    </Typography>
                    {currentSlideData.keyPoints.map((point, index) => (
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
                {currentSlideData.examples && currentSlideData.examples.length > 0 && (
                  <Paper elevation={3} sx={{ p: 3, flex: 1 }}>
                    <Typography variant="h6" gutterBottom color="secondary">
                      💡 Examples
                    </Typography>
                    {currentSlideData.examples.map((example, index) => (
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

              {/* PDF Slide Display (if available) */}
              {currentSlideData.pdfSlide && (
                <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
                  <Typography variant="h6" gutterBottom>📄 PDF Slide</Typography>
                  <Box sx={{ 
                    border: '1px solid #ccc', 
                    borderRadius: '8px', 
                    p: 2, 
                    bgcolor: '#f9f9f9',
                    minHeight: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      PDF slide content would be displayed here
                    </Typography>
                  </Box>
                </Paper>
              )}

              <Typography variant="body1" sx={{ mt: 2 }}>
                {currentSlideData.content}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Controls Panel */}
        <Box sx={{ width: '300px', p: 2, borderLeft: '1px solid #ccc' }}>
          {/* Playback Controls */}
          <Box display="flex" justifyContent="center" gap={1} mb={3}>
            <IconButton onClick={handlePlay} disabled={isPlaying && !isPaused}>
              <PlayArrow />
            </IconButton>
            <IconButton onClick={handlePause} disabled={!isPlaying || isPaused}>
              <Pause />
            </IconButton>
            <IconButton onClick={handleStop}>
              <Stop />
            </IconButton>
            <IconButton 
              onClick={handlePrevious}
              disabled={currentSlide === 0}
              title="Previous Slide"
            >
              <SkipPrevious />
            </IconButton>
            <IconButton 
              onClick={handleNext}
              disabled={currentSlide === lecture.slides.length - 1}
              title="Next Slide"
            >
              <SkipNext />
            </IconButton>
          </Box>
          
          {/* Pause Status Indicator */}
          {lecturePausedForDoubt && (
            <Box 
              sx={{ 
                p: 2, 
                mb: 2, 
                bgcolor: 'warning.light', 
                borderRadius: 1,
                textAlign: 'center'
              }}
            >
              <Typography variant="body2" color="warning.dark">
                ⏸️ Lecture paused for doubt solving
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ask your question and the lecture will resume automatically
              </Typography>
            </Box>
          )}

          {/* Slide Navigation */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              📚 Slide Navigation
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Slide {currentSlide + 1} of {lecture.slides.length}
            </Typography>
            
            {/* Slide Progress Bar */}
            <Box sx={{ mb: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={(currentSlide + 1) / lecture.slides.length * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            
            {/* Slide List */}
            <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {lecture.slides.map((slide, index) => (
                <Box
                  key={slide.id}
                  onClick={() => handleSlideSelect(index)}
                  sx={{
                    p: 1,
                    mb: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: index === currentSlide ? 'primary.light' : 'transparent',
                    border: index === currentSlide ? '2px solid' : '1px solid',
                    borderColor: index === currentSlide ? 'primary.main' : 'grey.300',
                    '&:hover': {
                      bgcolor: index === currentSlide ? 'primary.light' : 'grey.100',
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: index === currentSlide ? 'bold' : 'normal',
                      color: index === currentSlide ? 'primary.main' : 'text.primary'
                    }}
                  >
                    {index + 1}. {slide.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {slide.duration}s • {slide.keyPoints?.length || 0} points • {slide.examples?.length || 0} examples
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Volume Control */}
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <IconButton onClick={() => setIsMuted(!isMuted)}>
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            <Slider
              value={volume}
              onChange={(_, value) => setVolume(value as number)}
              min={0}
              max={1}
              step={0.1}
              disabled={isMuted}
            />
          </Box>

          {/* Keyboard Shortcuts */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              ⌨️ Keyboard Shortcuts
            </Typography>
            <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              <Box>← → Navigate slides</Box>
              <Box>Space Play/Pause</Box>
              <Box>Esc Stop lecture</Box>
            </Box>
          </Box>

          {/* Voice Interaction */}
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <Typography variant="h6" gutterBottom>
              🎤 Voice Interaction
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              Hold the microphone button to ask questions about the current slide
            </Typography>
            <Fab
              color={isRecording ? "secondary" : "primary"}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              sx={{ 
                width: 64, 
                height: 64,
                transform: isRecording ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              <Mic />
            </Fab>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
              {isRecording ? '🎤 Recording... Release to ask your question' : 'Hold to record your question'}
            </Typography>
          </Box>

          {/* Q&A Button */}
          <Button
            variant="contained"
            fullWidth
            startIcon={<QuestionAnswer />}
            onClick={() => {
              // Pause lecture if it's currently playing
              if (isPlaying && !isPaused) {
                console.log('⏸️ Pausing lecture for Q&A...');
                setWasPlayingBeforeDoubt(true);
                setLecturePausedForDoubt(true);
                handlePause();
              } else {
                setWasPlayingBeforeDoubt(false);
              }
              setShowQADialog(true);
            }}
            sx={{ mb: 3 }}
          >
            Ask Question
          </Button>

          {/* Conversation History */}
          <Typography variant="h6" gutterBottom>
            Conversation
          </Typography>
          <List sx={{ maxHeight: '200px', overflow: 'auto' }}>
            {conversationHistory.map((msg, index) => (
              <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="caption" color="text.secondary">
                  {msg.role === 'user' ? 'You' : 'Tutor'}
                </Typography>
                <Typography variant="body2">{msg.content}</Typography>
                <Divider sx={{ width: '100%', mt: 1 }} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>

      {/* Q&A Dialog */}
      <Dialog 
        open={showQADialog} 
        onClose={() => {
          setShowQADialog(false);
          // Resume lecture if it was paused for doubt solving
          if (lecturePausedForDoubt && wasPlayingBeforeDoubt) {
            console.log('▶️ Resuming lecture after Q&A dialog closed...');
            handlePlay();
            setLecturePausedForDoubt(false);
            setWasPlayingBeforeDoubt(false);
          }
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <QuestionAnswer />
            Ask Your Question
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Ask anything about the current slide or lecture. You can type or use voice input.
            </Typography>
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleQuestion();
              }
            }}
            placeholder="Ask anything about the current slide or lecture... (Ctrl+Enter to submit)"
            sx={{ mb: 2 }}
          />
          
          {/* Voice Input Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Voice Input:
            </Typography>
            <Fab
              size="small"
              color={isRecording ? "secondary" : "primary"}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={loading}
            >
              <Mic />
            </Fab>
            <Typography variant="caption" color="text.secondary">
              {isRecording ? 'Recording... Release to stop' : 'Hold to record your question'}
            </Typography>
          </Box>
          
          {/* Current Slide Context */}
          {lecture && lecture.slides[currentSlide] && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Current Slide Context:
              </Typography>
              <Typography variant="body2">
                <strong>{lecture.slides[currentSlide].title}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Slide {currentSlide + 1} of {lecture.slides.length}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowQADialog(false);
              // Resume lecture if it was paused for doubt solving
              if (lecturePausedForDoubt && wasPlayingBeforeDoubt) {
                console.log('▶️ Resuming lecture after Q&A cancelled...');
                handlePlay();
                setLecturePausedForDoubt(false);
                setWasPlayingBeforeDoubt(false);
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleQuestion} 
            variant="contained" 
            disabled={!question.trim() || loading}
            startIcon={<QuestionAnswer />}
          >
            {loading ? 'Processing...' : 'Ask Question'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} />
    </Box>
  );
};

export default InteractiveLecture;
