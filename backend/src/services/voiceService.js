const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class VoiceService {
  constructor() {
    this.audioPath = './uploads/audio';
    this.supportedFormats = ['wav', 'mp3', 'ogg', 'webm'];
    
    // Ensure audio directory exists
    fs.mkdir(this.audioPath, { recursive: true }).catch(console.error);
  }

  // Speech-to-Text using OpenAI Whisper API
  async speechToText(audioBuffer, language = 'en') {
    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('file', blob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', language);

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return {
        text: response.data.text,
        language: response.data.language,
        duration: response.data.duration
      };
    } catch (error) {
      console.error('Speech-to-text error:', error);
      throw new Error('Failed to convert speech to text');
    }
  }

  // Text-to-Speech using Google Translate TTS (100% FREE)
  async textToSpeech(text, voice = 'en', format = 'mp3') {
    try {
      console.log('🎤 Using Google Translate TTS (FREE)...');
      
      // Primary: Google Translate TTS (FREE, no API key needed)
      return await this.googleTranslateTTS(text, voice, format);
      
    } catch (error) {
      console.error('Google Translate TTS error:', error);
      console.log('⚠️ Google TTS failed, trying fallback options...');
      
      // Fallback 1: Microsoft Edge TTS (FREE)
      try {
        return await this.microsoftEdgeTTS(text, voice, format);
      } catch (edgeError) {
        console.log('⚠️ Microsoft Edge TTS failed, trying local TTS...');
        
        // Fallback 2: Local Windows TTS (FREE)
        try {
          return await this.localTTS(text, voice, format);
        } catch (localError) {
          console.log('⚠️ All TTS services failed, using mock TTS');
          return this.mockTextToSpeech(text, voice, format);
        }
      }
    }
  }

  // Local TTS using Windows Speech API (FREE)
  async localTTS(text, voice = 'en-US', format = 'mp3') {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      // Use Windows PowerShell with SAPI for TTS
      const filename = `local_tts_${Date.now()}.wav`;
      const filepath = path.join(this.audioPath, filename);
      
      // PowerShell command to generate speech
      const psCommand = `
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.SetOutputToWaveFile("${filepath.replace(/\\/g, '\\\\')}")
        $synth.Speak("${text.replace(/"/g, '\\"')}")
        $synth.Dispose()
      `;
      
      await execAsync(`powershell -Command "${psCommand}"`);
      
      return {
        filepath,
        filename,
        duration: this.estimateDuration(text),
        format: 'wav',
        size: require('fs').statSync(filepath).size,
        provider: 'windows-sapi'
      };
    } catch (error) {
      console.error('Local TTS error:', error);
      throw error;
    }
  }

  // Google Translate TTS (100% FREE - No API key required!)
  async googleTranslateTTS(text, voice = 'en', format = 'mp3') {
    try {
      console.log('🌐 Using Google Translate TTS (FREE)...');
      
      // Map voice names to language codes
      const voiceMap = {
        'en': 'en',
        'english': 'en',
        'spanish': 'es',
        'es': 'es',
        'french': 'fr',
        'fr': 'fr',
        'german': 'de',
        'de': 'de',
        'italian': 'it',
        'it': 'it',
        'portuguese': 'pt',
        'pt': 'pt',
        'russian': 'ru',
        'ru': 'ru',
        'japanese': 'ja',
        'ja': 'ja',
        'korean': 'ko',
        'ko': 'ko',
        'chinese': 'zh',
        'zh': 'zh',
        'arabic': 'ar',
        'ar': 'ar',
        'hindi': 'hi',
        'hi': 'hi'
      };
      
      const languageCode = voiceMap[voice.toLowerCase()] || 'en';
      
      // Google Translate TTS URL (completely free, no API key needed)
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${languageCode}&client=tw-ob&q=${encodeURIComponent(text)}`;
      
      console.log(`🎤 Generating speech for "${text.substring(0, 50)}..." in ${languageCode}`);
      
      const response = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'audio/mpeg, audio/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://translate.google.com/'
        },
        timeout: 10000 // 10 second timeout
      });

      const audioBuffer = Buffer.from(response.data);
      const filename = `google_tts_${Date.now()}.mp3`;
      const filepath = path.join(this.audioPath, filename);
      
      await fs.writeFile(filepath, audioBuffer);
      
      console.log(`✅ Google TTS Success: ${filename} (${audioBuffer.length} bytes)`);
      
      return {
        filepath,
        filename,
        duration: this.estimateDuration(text),
        format: 'mp3',
        size: audioBuffer.length,
        provider: 'google-translate',
        language: languageCode,
        cost: 'FREE'
      };
    } catch (error) {
      console.error('Google Translate TTS error:', error.message);
      throw error;
    }
  }

  // Microsoft Edge TTS (FREE alternative)
  async microsoftEdgeTTS(text, voice = 'en-US-AriaNeural', format = 'mp3') {
    try {
      // Microsoft Edge TTS is free and high quality
      const ttsUrl = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/tts?text=${encodeURIComponent(text)}&voice=${voice}`;
      
      const response = await axios.post(ttsUrl, {
        text: text,
        voice: voice
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });

      const audioBuffer = Buffer.from(response.data);
      const filename = `edge_tts_${Date.now()}.${format}`;
      const filepath = path.join(this.audioPath, filename);
      
      await fs.writeFile(filepath, audioBuffer);
      
      return {
        filepath,
        filename,
        duration: this.estimateDuration(text),
        format,
        size: audioBuffer.length,
        provider: 'microsoft-edge'
      };
    } catch (error) {
      console.error('Microsoft Edge TTS error:', error);
      throw error;
    }
  }

  // Mock TTS for testing when OpenAI API is not available
  async mockTextToSpeech(text, voice = 'alloy', format = 'mp3') {
    const filename = `mock_tts_${Date.now()}.${format}`;
    const filepath = path.join(this.audioPath, filename);
    
    // Create a mock audio file (just a text file for testing)
    const mockContent = `Mock TTS Audio File\nText: ${text}\nVoice: ${voice}\nFormat: ${format}\nGenerated: ${new Date().toISOString()}`;
    await fs.writeFile(filepath, mockContent);
    
    return {
      filepath,
      filename,
      duration: this.estimateDuration(text),
      format,
      size: mockContent.length,
      mock: true
    };
  }

  // Generate streaming TTS for real-time conversation
  async generateStreamingTTS(text, voice = 'alloy') {
    try {
      // For real-time streaming, we'll use smaller chunks
      const sentences = this.splitIntoSentences(text);
      const audioChunks = [];

      for (const sentence of sentences) {
        if (sentence.trim().length > 0) {
          const audioData = await this.textToSpeech(sentence, voice, 'wav');
          audioChunks.push(audioData);
        }
      }

      return audioChunks;
    } catch (error) {
      console.error('Streaming TTS error:', error);
      throw new Error('Failed to generate streaming TTS');
    }
  }

  // Split text into sentences for better TTS
  splitIntoSentences(text) {
    return text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  // Estimate audio duration based on text length
  estimateDuration(text) {
    const wordsPerMinute = 150; // Average speaking rate
    const wordCount = text.split(/\s+/).length;
    return Math.ceil((wordCount / wordsPerMinute) * 60); // Duration in seconds
  }

  // Process audio file for ASR
  async processAudioFile(filePath, language = 'en') {
    try {
      const audioBuffer = await fs.readFile(filePath);
      return await this.speechToText(audioBuffer, language);
    } catch (error) {
      console.error('Audio processing error:', error);
      throw new Error('Failed to process audio file');
    }
  }

  // Convert audio format if needed
  async convertAudioFormat(inputPath, outputFormat = 'wav') {
    try {
      // In production, you'd use ffmpeg or similar
      // This is a placeholder for audio conversion
      const outputPath = inputPath.replace(/\.[^/.]+$/, `.${outputFormat}`);
      
      // For now, just copy the file
      await fs.copyFile(inputPath, outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Audio conversion error:', error);
      throw new Error('Failed to convert audio format');
    }
  }

  // Clean up audio files
  async cleanupAudioFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`Cleaned up audio file: ${filePath}`);
    } catch (error) {
      console.error('Error cleaning up audio file:', error);
    }
  }

  // Get supported audio formats
  getSupportedFormats() {
    return {
      input: this.supportedFormats,
      output: ['mp3', 'wav', 'ogg'],
      tts: {
        'google-translate': {
          formats: ['mp3'],
          languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
          cost: 'FREE',
          quality: 'Good'
        },
        'microsoft-edge': {
          formats: ['mp3', 'wav'],
          languages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'],
          cost: 'FREE',
          quality: 'High'
        },
        'windows-sapi': {
          formats: ['wav'],
          languages: ['en-US', 'en-GB'],
          cost: 'FREE',
          quality: 'Basic'
        }
      }
    };
  }

  // Validate audio file
  validateAudioFile(file) {
    const extension = path.extname(file.originalname).toLowerCase().slice(1);
    return this.supportedFormats.includes(extension);
  }
}

module.exports = new VoiceService();
