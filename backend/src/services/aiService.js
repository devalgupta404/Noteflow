const axios = require('axios');

class AIService {
  constructor() {
    this.geminiApiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4
    ].filter(key => key); // Remove empty keys
    
    this.currentKeyIndex = 0;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.groqApiKeys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
      process.env.GROQ_API_KEY_6
    ].filter(key => key);
    this.currentGroqKeyIndex = 0;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.groqBaseUrl = 'https://api.groq.com/openai/v1';

    if (this.geminiApiKeys.length > 0) {
      console.log(`🤖 Gemini AI initialized with ${this.geminiApiKeys.length} API keys`);
    } else {
      console.warn('No Gemini API keys available. Gemini AI services will be unavailable.');
    }

    if (this.groqApiKeys.length > 0) {
      console.log(`🚀 Groq API initialized with ${this.groqApiKeys.length} API keys for fast inference`);
    } else {
      console.warn('No Groq API keys available. Add GROQ_API_KEY to .env for faster inference.');
    }
  }

  // Get current Groq API key
  getCurrentGroqApiKey() {
    return this.groqApiKeys[this.currentGroqKeyIndex];
  }

  // Switch to next Groq API key
  switchToNextGroqKey() {
    this.currentGroqKeyIndex = (this.currentGroqKeyIndex + 1) % this.groqApiKeys.length;
    console.log(`🔄 Switched to Groq API key ${this.currentGroqKeyIndex + 1}/${this.groqApiKeys.length}`);
  }

  // Get current API key
  getCurrentApiKey() {
    return this.geminiApiKeys[this.currentKeyIndex];
  }

  // Switch to next API key
  switchToNextKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.geminiApiKeys.length;
    console.log(`🔄 Switched to Gemini API key ${this.currentKeyIndex + 1}/${this.geminiApiKeys.length}`);
  }

  // Generate text using Gemini with fallback keys
  async generateText(prompt, retryCount = 0) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/models/gemini-2.5-flash:generateContent`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1000
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getCurrentApiKey()
          }
        }
      );

      if (response.data.candidates && response.data.candidates[0]) {
        const candidate = response.data.candidates[0];
        
        // Check if the response has content with parts
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          return candidate.content.parts[0].text;
        }
        
        // Check if the response has finishReason indicating an issue
        if (candidate.finishReason === 'MAX_TOKENS') {
          console.warn('Gemini API hit token limit, using fallback');
          throw new Error('Token limit exceeded');
        }
        
        // Log the actual response format for debugging
        console.error('Unexpected Gemini API response format:', JSON.stringify(response.data, null, 2));
        throw new Error('Unexpected response format from Gemini API');
      } else {
        console.error('No candidates in Gemini API response:', JSON.stringify(response.data, null, 2));
        throw new Error('No candidates in Gemini API response');
      }
    } catch (error) {
      console.error('Error generating text:', error.message);
      
      // If rate limited and we have more keys, try the next one
      if (error.response?.status === 429 && retryCount < this.geminiApiKeys.length - 1) {
        console.log('🔄 Rate limited, switching to next API key...');
        this.switchToNextKey();
        return this.generateText(prompt, retryCount + 1);
      }
      
      throw new Error('Failed to generate text');
    }
  }

  // Generate embeddings for text with fallback keys
  async generateEmbeddings(text, retryCount = 0) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/models/embedding-001:embedContent`,
        {
          content: {
            parts: [{
              text: text
            }]
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getCurrentApiKey()
          }
        }
      );

      if (response.data.embedding && response.data.embedding.values) {
        return response.data.embedding.values;
      } else {
        console.error('Unexpected Gemini embeddings response format:', JSON.stringify(response.data, null, 2));
        throw new Error('Unexpected response format from Gemini embeddings API');
      }
    } catch (error) {
      console.error('Error generating embeddings:', error.message);
      
      // If rate limited and we have more keys, try the next one
      if (error.response?.status === 429 && retryCount < this.geminiApiKeys.length - 1) {
        console.log('🔄 Rate limited, switching to next API key...');
        this.switchToNextKey();
        return this.generateEmbeddings(text, retryCount + 1);
      }
      
      throw new Error('Failed to generate embeddings');
    }
  }

  // Generate comprehensive 10-minute lecture with parallel API calls
  async generateComprehensiveLecture(documentContent, subject, difficulty = 'intermediate') {
    try {
      console.log('🚀 Starting comprehensive lecture generation...');
      
      // Split document into chunks for parallel processing
      const chunks = this.splitDocumentIntoChunks(documentContent, 1000);
      console.log(`📚 Document split into ${chunks.length} chunks`);
      
      // Generate slides in parallel using multiple API calls
      const slidePromises = chunks.map((chunk, index) => 
        this.generateSlideContent(chunk, subject, index + 1, difficulty)
      );
      
      console.log('⚡ Making parallel API calls...');
      const slides = await Promise.all(slidePromises);
      
      // Filter out failed slides and combine content
      const validSlides = slides.filter(slide => slide !== null);
      console.log(`✅ Generated ${validSlides.length} slides successfully`);
      
      // Generate comprehensive voice scripts for each slide
      const enhancedSlides = await this.generateDetailedVoiceScripts(validSlides, subject);
      
      // Calculate total duration (aim for 10+ minutes)
      const totalDuration = enhancedSlides.reduce((sum, slide) => sum + slide.duration, 0);
      
      return {
        title: `Comprehensive ${subject} Lecture`,
        introduction: `Welcome to this comprehensive ${totalDuration/60}-minute lecture on ${subject}. We'll explore every aspect in detail with practical examples and real-world applications.`,
        slides: enhancedSlides,
        interactions: this.generateComprehensiveInteractions(enhancedSlides),
        summary: `We've completed a comprehensive exploration of ${subject}, covering ${enhancedSlides.length} detailed sections. This knowledge will serve as a solid foundation for advanced learning.`,
        totalDuration: totalDuration,
        estimatedReadingTime: Math.ceil(totalDuration / 60) + ' minutes'
      };
      
    } catch (error) {
      console.error('Error generating comprehensive lecture:', error);
      throw error;
    }
  }

  // Generate individual slide-based lectures (L1, L2, L3, etc.)
  async generateIndividualSlideLectures(documentContent, subject, difficulty = 'intermediate') {
    try {
      console.log('🎓 Generating individual slide-based lectures...');
      
      // Split document into chunks for individual lectures
      const chunks = this.splitDocumentIntoChunks(documentContent, 800);
      console.log(`📚 Document split into ${chunks.length} individual lectures`);
      
      // Generate individual lectures in parallel
      const lecturePromises = chunks.map((chunk, index) => 
        this.generateSingleSlideLecture(chunk, subject, index + 1, difficulty)
      );
      
      console.log('⚡ Generating individual lectures in parallel...');
      const individualLectures = await Promise.all(lecturePromises);
      
      // Filter out failed lectures
      const validLectures = individualLectures.filter(lecture => lecture !== null);
      console.log(`✅ Generated ${validLectures.length} individual lectures successfully`);
      
      // If no lectures were generated, create a fallback lecture
      if (validLectures.length === 0) {
        console.log('⚠️ No lectures generated, creating fallback lecture...');
        const fallbackLecture = {
          id: 'L1',
          title: `Lecture L1: ${subject} Overview`,
          lectureNumber: 1,
          slide: {
            id: 1,
            title: `${subject} - Overview`,
            content: documentContent.substring(0, 1000) + '...',
            keyPoints: [
              'Key concept 1 from the document',
              'Key concept 2 from the document',
              'Key concept 3 from the document'
            ],
            examples: [
              'Practical example 1',
              'Practical example 2'
            ],
            duration: 180,
            voiceScript: `Welcome to our lecture on ${subject}. Let's explore the key concepts together. ${documentContent.substring(0, 200)}...`,
            pdfSlide: null
          },
          totalDuration: 180,
          subject: subject,
          difficulty: difficulty,
          createdAt: new Date().toISOString()
        };
        
        return {
          success: true,
          lectures: [fallbackLecture],
          totalLectures: 1,
          subject: subject,
          difficulty: difficulty
        };
      }
      
      return {
        success: true,
        lectures: validLectures,
        totalLectures: validLectures.length,
        subject: subject,
        difficulty: difficulty
      };
      
    } catch (error) {
      console.error('❌ Error generating individual slide lectures:', error);
      throw error;
    }
  }

  // Generate a single slide-based lecture (L1, L2, etc.)
  async generateSingleSlideLecture(chunk, subject, lectureNumber, difficulty) {
    try {
      console.log(`🎯 Generating Lecture L${lectureNumber}...`);
      
      // Generate comprehensive slide content
      const slide = await this.generateSlideContent(chunk, subject, lectureNumber, difficulty);
      if (!slide) {
        console.warn(`⚠️ Failed to generate slide for L${lectureNumber}`);
        return null;
      }
      
      // Generate detailed voice script
      const voiceScript = await this.generateComprehensiveVoiceScript(slide, subject, lectureNumber);
      
      // Create individual lecture structure
      const individualLecture = {
        id: `L${lectureNumber}`,
        title: `Lecture L${lectureNumber}: ${slide.title}`,
        lectureNumber: lectureNumber,
        slide: {
          ...slide,
          voiceScript: voiceScript,
          duration: Math.max(slide.duration, voiceScript.split(' ').length * 0.5)
        },
        totalDuration: Math.max(slide.duration, voiceScript.split(' ').length * 0.5),
        subject: subject,
        difficulty: difficulty,
        createdAt: new Date().toISOString()
      };
      
      console.log(`✅ Generated L${lectureNumber} successfully (${individualLecture.totalDuration}s)`);
      return individualLecture;
      
    } catch (error) {
      console.error(`❌ Error generating L${lectureNumber}:`, error.message);
      return null;
    }
  }

  // Split document into manageable chunks
  splitDocumentIntoChunks(content, chunkSize) {
    // Clean the content first - remove extra whitespace, fix encoding issues
    const cleanedContent = content
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n+/g, ' ')  // Replace newlines with spaces
      .replace(/\t+/g, ' ')   // Replace tabs with spaces
      .trim();
    
    const words = cleanedContent.split(' ');
    const chunks = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    console.log(`📝 Text cleaned and split into ${chunks.length} chunks`);
    return chunks;
  }

  // Generate individual slide content using Groq
  async generateSlideContent(chunk, subject, slideNumber, difficulty) {
    try {
      const prompt = `Create a detailed slide for a comprehensive ${subject} lecture.

Slide ${slideNumber} Content: ${chunk}

Requirements:
- Create educational content with clear explanations (200+ words)
- Include 3-5 key points that are easy to understand
- Provide 2-3 practical examples with code snippets or real-world applications
- Make content suitable for a ${difficulty} level audience
- Focus on the most important concepts from the content
- Ensure examples are relevant and helpful

Return ONLY a JSON object with this exact structure:
{
  "title": "Clear slide title",
  "content": "Detailed explanation with examples",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "examples": ["Example 1 with code", "Example 2 with explanation"],
  "duration": 180
}`;

      // Try with multiple API keys and automatic rotation
      let lastError = null;
      for (let attempt = 0; attempt < this.groqApiKeys.length; attempt++) {
        try {
          console.log(`🚀 Making Groq API call for slide ${slideNumber} (attempt ${attempt + 1}/${this.groqApiKeys.length})...`);
          
          const response = await axios.post(
            `${this.groqBaseUrl}/chat/completions`,
            {
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert educator creating detailed lecture content. Generate comprehensive, educational slides with practical examples.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.7,
              max_tokens: 1000,
              top_p: 0.9
            },
            {
              headers: {
                'Authorization': `Bearer ${this.getCurrentGroqApiKey()}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log(`✅ Groq API response received for slide ${slideNumber} with key ${this.currentGroqKeyIndex + 1}`);
          
          if (response.data.choices && response.data.choices[0]) {
            const content = response.data.choices[0].message.content;
            
            try {
              // Extract JSON from response
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                  id: slideNumber,
                  title: parsed.title || `Slide ${slideNumber}`,
                  content: parsed.content || chunk,
                  keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(p => typeof p === 'string' ? p : p.title || p.content || String(p)) : [],
                  examples: Array.isArray(parsed.examples) ? parsed.examples.map(e => typeof e === 'string' ? e : e.title || e.content || String(e)) : [],
                  duration: parsed.duration || 180,
                  voiceScript: '', // Will be generated separately
                  pdfSlide: null // Will be populated with actual PDF slide
                };
              }
            } catch (parseError) {
              console.warn(`Failed to parse slide ${slideNumber}, using fallback`);
            }
          }
          
          // If we get here, the API call succeeded but parsing failed
          break;
          
        } catch (error) {
          lastError = error;
          console.error(`❌ Groq API call failed for slide ${slideNumber} with key ${this.currentGroqKeyIndex + 1}:`, error.message);
          
          if (error.response?.status === 429) {
            console.log(`🔄 Rate limited with key ${this.currentGroqKeyIndex + 1}, switching to next key...`);
            this.switchToNextGroqKey();
            
            // Add a small delay before trying the next key
            if (attempt < this.groqApiKeys.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            // For non-rate-limit errors, don't retry
            break;
          }
        }
      }
      
      // If all keys failed, use fallback
      console.log(`⚠️ All Groq API keys failed for slide ${slideNumber}, using fallback`);
      
      // Fallback slide
      return {
        id: slideNumber,
        title: `${subject} - Section ${slideNumber}`,
        content: chunk,
        keyPoints: ['Key concept 1', 'Key concept 2'],
        examples: ['Practical example'],
        duration: 180,
        voiceScript: '',
        pdfSlide: null
      };
      
    } catch (error) {
      console.error(`❌ Error generating slide ${slideNumber}:`, error.message);
      if (error.response) {
        console.error('Groq API Error Response:', error.response.data);
        console.error('Status:', error.response.status);
      }
      
      // Return fallback slide instead of null
      return {
        id: slideNumber,
        title: `${subject} - Section ${slideNumber}`,
        content: chunk,
        keyPoints: ['Key concept 1', 'Key concept 2'],
        examples: ['Practical example'],
        duration: 180,
        voiceScript: '',
        pdfSlide: null
      };
    }
  }

  // Generate detailed voice scripts for all slides
  async generateDetailedVoiceScripts(slides, subject) {
    console.log('🎤 Generating detailed voice scripts...');
    
    const enhancedSlides = await Promise.all(
      slides.map(async (slide, index) => {
        try {
          const voiceScript = await this.generateComprehensiveVoiceScript(slide, subject, index + 1);
          return {
            ...slide,
            voiceScript: voiceScript,
            duration: Math.max(slide.duration, voiceScript.split(' ').length * 0.5) // Estimate based on word count
          };
        } catch (error) {
          console.warn(`Failed to generate voice script for slide ${slide.id}:`, error.message);
          return {
            ...slide,
            voiceScript: `Let's explore ${slide.title}. ${slide.content}`,
            duration: slide.duration
          };
        }
      })
    );
    
    return enhancedSlides;
  }

  // Generate comprehensive voice script for a single slide
  async generateComprehensiveVoiceScript(slide, subject, slideNumber) {
    try {
      const prompt = `Create a natural, conversational voice script for a lecture slide.

Slide Title: ${slide.title}
Slide Content: ${slide.content}
Key Points: ${slide.keyPoints.join(', ')}
Examples: ${slide.examples.join(', ')}

Requirements:
- Write in natural, conversational English
- Use simple, clear sentences
- Avoid technical jargon
- Include natural pauses
- Use transition words like "Now", "Next", "Also", "Finally"
- Make it sound like a real teacher speaking
- Keep it engaging and educational
- Write 300-500 words for a 2-3 minute narration

DO NOT include phrases like:
- "Here's a script for the lecture slide"
- "Welcome to our first section"
- Any meta-commentary about creating scripts

Just write the actual lecture content as if you're speaking directly to students.

Return only the narration text, no formatting or explanations.`;

      // Try with multiple API keys and automatic rotation
      let lastError = null;
      for (let attempt = 0; attempt < this.groqApiKeys.length; attempt++) {
        try {
          console.log(`🎤 Making Groq API call for voice script ${slideNumber} (attempt ${attempt + 1}/${this.groqApiKeys.length})...`);
          
          const response = await axios.post(
            `${this.groqBaseUrl}/chat/completions`,
            {
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content: 'You are a professional lecturer creating detailed voice scripts. Generate engaging, educational narration that explains concepts clearly.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.8,
              max_tokens: 800,
              top_p: 0.9
            },
            {
              headers: {
                'Authorization': `Bearer ${this.getCurrentGroqApiKey()}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log(`✅ Groq API response received for voice script ${slideNumber} with key ${this.currentGroqKeyIndex + 1}`);
          
          if (response.data.choices && response.data.choices[0]) {
            let script = response.data.choices[0].message.content;
            console.log('📝 Original voice script:', script.substring(0, 100) + '...');
            
            // Post-process the script to make it more TTS-friendly
            script = this.optimizeScriptForTTS(script);
            console.log('🎤 TTS-optimized script:', script.substring(0, 100) + '...');
            
            return script;
          }
          
          // If we get here, the API call succeeded but no content
          break;
          
        } catch (error) {
          lastError = error;
          console.error(`❌ Groq API call failed for voice script ${slideNumber} with key ${this.currentGroqKeyIndex + 1}:`, error.message);
          
          if (error.response?.status === 429) {
            console.log(`🔄 Rate limited with key ${this.currentGroqKeyIndex + 1}, switching to next key...`);
            this.switchToNextGroqKey();
            
            // Add a small delay before trying the next key
            if (attempt < this.groqApiKeys.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            // For non-rate-limit errors, don't retry
            break;
          }
        }
      }
      
      // If all keys failed, use fallback
      console.log(`⚠️ All Groq API keys failed for voice script ${slideNumber}, using fallback`);
      
      // Fallback script
      return `Welcome to slide ${slideNumber} of our comprehensive ${subject} lecture. ${slide.content}. Let's explore the key points: ${slide.keyPoints.join(', ')}. Here are some practical examples: ${slide.examples.join(', ')}.`;
      
    } catch (error) {
      console.error(`❌ Error generating voice script for slide ${slideNumber}:`, error.message);
      if (error.response) {
        console.error('Groq API Error Response:', error.response.data);
        console.error('Status:', error.response.status);
      }
      
      // Return fallback script instead of failing
      return `Let's explore ${slide.title}. ${slide.content}`;
    }
  }

  // Optimize script for text-to-speech with comprehensive code character handling
  optimizeScriptForTTS(script) {
    return script
      // Fix common TTS pronunciation issues for programming terms
      .replace(/\bdef\b/g, 'define')
      .replace(/\bvar\b/g, 'variable')
      .replace(/\bclass\b/g, 'class definition')
      .replace(/\bfunction\b/g, 'function definition')
      .replace(/\bimport\b/g, 'import statement')
      .replace(/\breturn\b/g, 'return statement')
      .replace(/\bif\b/g, 'if statement')
      .replace(/\belse\b/g, 'else statement')
      .replace(/\bfor\b/g, 'for loop')
      .replace(/\bwhile\b/g, 'while loop')
      .replace(/\btry\b/g, 'try block')
      .replace(/\bexcept\b/g, 'except block')
      .replace(/\bfinally\b/g, 'finally block')
      
      // Fix numbers (convert to words)
      .replace(/\b1\b/g, 'one')
      .replace(/\b2\b/g, 'two')
      .replace(/\b3\b/g, 'three')
      .replace(/\b4\b/g, 'four')
      .replace(/\b5\b/g, 'five')
      .replace(/\b6\b/g, 'six')
      .replace(/\b7\b/g, 'seven')
      .replace(/\b8\b/g, 'eight')
      .replace(/\b9\b/g, 'nine')
      .replace(/\b0\b/g, 'zero')
      
      // Fix symbols and operators
      .replace(/=/g, ' equals ')
      .replace(/==/g, ' equals equals ')
      .replace(/!=/g, ' not equals ')
      .replace(/\+/g, ' plus ')
      .replace(/-/g, ' minus ')
      .replace(/\*/g, ' times ')
      .replace(/\//g, ' divided by ')
      .replace(/%/g, ' modulo ')
      .replace(/\^/g, ' caret ')
      .replace(/&/g, ' ampersand ')
      .replace(/\|/g, ' pipe ')
      .replace(/~/g, ' tilde ')
      .replace(/!/g, ' exclamation ')
      .replace(/@/g, ' at symbol ')
      .replace(/#/g, ' hash ')
      .replace(/\$/g, ' dollar ')
      
      // Fix brackets and parentheses
      .replace(/\(/g, ' open parenthesis ')
      .replace(/\)/g, ' close parenthesis ')
      .replace(/\[/g, ' open bracket ')
      .replace(/\]/g, ' close bracket ')
      .replace(/\{/g, ' open brace ')
      .replace(/\}/g, ' close brace ')
      .replace(/</g, ' less than ')
      .replace(/>/g, ' greater than ')
      
      // Fix quotes and strings
      .replace(/"/g, ' quote ')
      .replace(/'/g, ' single quote ')
      .replace(/`/g, ' backtick ')
      
      // Fix punctuation
      .replace(/\./g, ' period ')
      .replace(/,/g, ' comma ')
      .replace(/;/g, ' semicolon ')
      .replace(/:/g, ' colon ')
      .replace(/\?/g, ' question mark ')
      
      // Fix common programming values
      .replace(/\bTrue\b/g, 'true value')
      .replace(/\bFalse\b/g, 'false value')
      .replace(/\bNone\b/g, 'none value')
      .replace(/\bnull\b/g, 'null value')
      .replace(/\bundefined\b/g, 'undefined value')
      
      // Fix common file extensions
      .replace(/\.py\b/g, ' dot py file')
      .replace(/\.js\b/g, ' dot js file')
      .replace(/\.html\b/g, ' dot html file')
      .replace(/\.css\b/g, ' dot css file')
      
      // Clean up extra spaces and add natural pauses
      .replace(/\s+/g, ' ')
      .replace(/period/g, '.')
      .replace(/comma/g, ',')
      .replace(/semicolon/g, ';')
      .replace(/colon/g, ':')
      .replace(/question mark/g, '?')
      .replace(/exclamation/g, '!')
      .trim();
  }

  // Generate comprehensive interactions for all slides
  generateComprehensiveInteractions(slides) {
    return slides.map(slide => ({
      slideId: slide.id,
      question: `What questions do you have about ${slide.title}?`,
      expectedAnswers: [
        "I understand this concept",
        "Can you explain more?",
        "Show me more examples",
        "How does this apply practically?"
      ],
      feedback: `Great question! ${slide.title} is a fundamental concept. Let's explore it further.`
    }));
  }

  // Generate comprehensive interactive lecture using Groq (fast and free)
  async generateLectureScriptWithGroq(documentContent, subject, difficulty = 'intermediate') {
    try {
      if (!this.getCurrentGroqApiKey()) {
        throw new Error('Groq API key not available');
      }

      // Truncate document content to avoid token limits
      const truncatedContent = documentContent.substring(0, 1000); // Increased to 1000 characters
      
      const prompt = `Create a comprehensive interactive lecture for ${subject} with difficulty level: ${difficulty}.

Document Content: ${truncatedContent}

Generate a detailed lecture with:
1. Multiple slides (3-5 slides)
2. Complex flowcharts with multiple nodes
3. Detailed voice scripts for each slide
4. Interactive Q&A for each slide
5. Progressive difficulty

Return ONLY valid JSON in this exact format:
{
  "title": "Comprehensive Lecture Title",
  "introduction": "Detailed introduction paragraph",
  "slides": [
    {
      "id": 1,
      "title": "Slide Title",
      "content": "Detailed slide content (200+ words)",
      "flowchart": {
        "type": "process",
        "nodes": [
          {"id": "1", "label": "Start", "type": "start"},
          {"id": "2", "label": "Process Step", "type": "process"},
          {"id": "3", "label": "Decision Point", "type": "decision"},
          {"id": "4", "label": "End", "type": "end"}
        ],
        "connections": [
          {"from": "1", "to": "2", "label": "begins"},
          {"from": "2", "to": "3", "label": "leads to"},
          {"from": "3", "to": "4", "label": "concludes"}
        ]
      },
      "animation": {
        "sequence": ["1", "2", "3", "4"],
        "timing": [0, 2, 4, 6]
      },
      "voiceScript": "Detailed narration script (50+ words)",
      "duration": 60
    }
  ],
  "interactions": [
    {
      "slideId": 1,
      "question": "Engaging question",
      "expectedAnswers": ["Answer 1", "Answer 2", "Answer 3"],
      "feedback": "Detailed feedback"
    }
  ],
  "summary": "Comprehensive summary",
  "totalDuration": 300
}`;

      const response = await axios.post(
        `${this.groqBaseUrl}/chat/completions`,
        {
          model: 'llama-3.1-8b-instant', // Fast and free model
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational content creator. Generate comprehensive, detailed interactive lectures with multiple slides, complex flowcharts, and engaging content. Always return valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000, // Increased token limit
          top_p: 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${this.getCurrentGroqApiKey()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('🚀 Groq API response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.choices || response.data.choices.length === 0) {
        throw new Error('No choices in Groq API response');
      }
      
      const content = response.data.choices[0].message.content;
      
      try {
        // Clean the content - remove markdown code blocks if present
        let cleanContent = content;
        if (cleanContent.includes('```json')) {
          cleanContent = cleanContent.split('```json')[1].split('```')[0];
        }
        
        // Try to extract JSON from the response
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanContent = jsonMatch[0];
        }
        
        const parsed = JSON.parse(cleanContent);
        
        // Validate the structure
        if (!parsed.slides || !Array.isArray(parsed.slides)) {
          throw new Error('Invalid lecture structure from Groq');
        }
        
        console.log(`✅ Groq generated ${parsed.slides.length} slides successfully`);
        return parsed;
      } catch (parseError) {
        console.error('Error parsing Groq lecture script JSON:', parseError);
        console.log('Raw Groq content:', content.substring(0, 500));
        
        // Create a structured lecture from the raw content
        const lines = content.split('\n').filter(line => line.trim());
        const slides = [];
        let currentSlide = null;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.includes('**Slide') || line.includes('Slide Title:')) {
            if (currentSlide) slides.push(currentSlide);
            currentSlide = {
              id: slides.length + 1,
              title: line.replace(/\*\*/g, '').replace('Slide Title:', '').trim(),
              content: '',
              flowchart: {
                type: "concept",
                nodes: [
                  { id: "1", label: "Start", type: "start" },
                  { id: "2", label: "Process", type: "process" }
                ],
                connections: [
                  { from: "1", to: "2", label: "leads to" }
                ]
              },
              animation: {
                sequence: ["1", "2"],
                timing: [0, 2]
              },
              voiceScript: '',
              duration: 60
            };
          } else if (currentSlide && line.includes('**Content:')) {
            currentSlide.content = line.replace(/\*\*/g, '').replace('Content:', '').trim();
          } else if (currentSlide && line.includes('**Voice Script:')) {
            currentSlide.voiceScript = line.replace(/\*\*/g, '').replace('Voice Script:', '').trim();
          } else if (currentSlide && currentSlide.content && !line.includes('**')) {
            currentSlide.content += ' ' + line;
          }
        }
        
        if (currentSlide) slides.push(currentSlide);
        
        if (slides.length > 0) {
          console.log(`✅ Groq fallback generated ${slides.length} slides from content`);
          return {
            title: `Interactive Lecture: ${subject}`,
            introduction: `Welcome to this comprehensive lecture on ${subject}! Let's explore the key concepts together.`,
            slides: slides,
            interactions: slides.map(slide => ({
              slideId: slide.id,
              question: `What questions do you have about ${slide.title}?`,
              expectedAnswers: ["I understand", "Need clarification"],
              feedback: "Great! Let's continue learning together."
            })),
            summary: "We've covered the essential concepts. Practice these ideas to master the topic.",
            totalDuration: slides.length * 60
          };
        }
        
        throw new Error('Failed to parse Groq response');
      }
    } catch (error) {
      console.error('Error generating lecture script with Groq:', error);
      throw error;
    }
  }

  // Generate comprehensive lecture with flowcharts and slides
  async generateLectureScript(documentContent, subject, difficulty = 'intermediate') {
    try {
      // Try individual slide-based lectures first (L1, L2, L3, etc.)
      if (this.groqApiKeys.length > 0) {
        console.log('🎓 Attempting individual slide-based lecture generation with Groq...');
        try {
          return await this.generateIndividualSlideLectures(documentContent, subject, difficulty);
        } catch (groqError) {
          console.warn('⚠️ Individual lecture generation failed, trying comprehensive:', groqError.message);
          try {
            return await this.generateComprehensiveLecture(documentContent, subject, difficulty);
          } catch (comprehensiveError) {
            console.warn('⚠️ Comprehensive generation failed, falling back to Gemini:', comprehensiveError.message);
          }
        }
      }

      // Fallback to Gemini
      console.log('🤖 Using Gemini for lecture generation...');
      // Truncate document content to avoid token limits
      const truncatedContent = documentContent.substring(0, 500);
      
      const prompt = `Create a simple interactive lecture for ${subject}.

Content: ${truncatedContent}

Return JSON:
{
  "title": "Lecture Title",
  "introduction": "Brief intro",
  "slides": [
    {
      "id": 1,
      "title": "Slide Title",
      "content": "Main content",
      "flowchart": {
        "type": "concept",
        "nodes": [
          {"id": "1", "label": "Start", "type": "start"},
          {"id": "2", "label": "Process", "type": "process"}
        ],
        "connections": [
          {"from": "1", "to": "2", "label": "leads to"}
        ]
      },
      "animation": {
        "sequence": ["1", "2"],
        "timing": [0, 2]
      },
      "voiceScript": "Narration text",
      "duration": 30
    }
  ],
  "interactions": [
    {
      "slideId": 1,
      "question": "Any questions?",
      "expectedAnswers": ["Yes", "No"],
      "feedback": "Great!"
    }
  ],
  "summary": "Key points",
  "totalDuration": 60
}`;

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-2.5-flash:generateContent`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 800
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getCurrentApiKey()
          }
        }
      );

      console.log('Gemini API response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.candidates || response.data.candidates.length === 0) {
        console.error('No candidates in response:', response.data);
        throw new Error('No candidates in Gemini API response');
      }
      
      const candidate = response.data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        console.error('No content in candidate:', candidate);
        throw new Error('No content in Gemini API response');
      }
      
      const content = candidate.content.parts[0].text;
      
      try {
        // Clean the content - remove markdown code blocks if present
        let cleanContent = content;
        if (cleanContent.includes('```json')) {
          cleanContent = cleanContent.split('```json')[1].split('```')[0];
        }
        
        const parsed = JSON.parse(cleanContent);
        
        // Validate the structure
        if (!parsed.slides || !Array.isArray(parsed.slides)) {
          throw new Error('Invalid lecture structure');
        }
        
        return parsed;
      } catch (parseError) {
        console.error('Error parsing lecture script JSON:', parseError);
        
        // Create a comprehensive fallback lecture structure
        const content = documentContent.substring(0, 500);
        const words = content.split(' ');
        const keyTopics = words.filter(word => word.length > 4).slice(0, 5);
        
        return {
          title: `Interactive Lecture: ${subject}`,
          introduction: `Welcome to this comprehensive lecture on ${subject}! Today we'll explore the fundamental concepts and practical applications. Get ready for an engaging learning experience with interactive elements and visual aids.`,
          slides: [
            {
              id: 1,
              title: "Introduction & Overview",
              content: `Let's start our journey into ${subject}. This field encompasses many important concepts that we'll explore together. Understanding these fundamentals will provide a solid foundation for advanced learning.`,
              flowchart: {
                type: "concept",
                nodes: [
                  { id: "1", label: "Start Learning", type: "start" },
                  { id: "2", label: "Core Concepts", type: "process" },
                  { id: "3", label: "Practical Examples", type: "process" },
                  { id: "4", label: "Apply Knowledge", type: "end" }
                ],
                connections: [
                  { from: "1", to: "2", label: "explore" },
                  { from: "2", to: "3", label: "understand" },
                  { from: "3", to: "4", label: "master" }
                ]
              },
              animation: {
                sequence: ["1", "2", "3", "4"],
                timing: [0, 2, 4, 6]
              },
              voiceScript: `Welcome to our comprehensive lecture on ${subject}. Today we'll explore the fundamental concepts step by step. Let's begin with an overview of what we'll cover.`,
              duration: 45
            },
            {
              id: 2,
              title: "Key Concepts Deep Dive",
              content: `Now let's dive deeper into the core concepts. ${content.substring(0, 200)}... These concepts form the backbone of understanding in this field.`,
              flowchart: {
                type: "process",
                nodes: [
                  { id: "5", label: "Concept A", type: "process" },
                  { id: "6", label: "Concept B", type: "process" },
                  { id: "7", label: "Integration", type: "decision" }
                ],
                connections: [
                  { from: "5", to: "7", label: "connects to" },
                  { from: "6", to: "7", label: "connects to" }
                ]
              },
              animation: {
                sequence: ["5", "6", "7"],
                timing: [0, 3, 6]
              },
              voiceScript: `Let's explore the key concepts in detail. Understanding these principles is crucial for mastering ${subject}.`,
              duration: 60
            },
            {
              id: 3,
              title: "Practical Applications",
              content: `How do we apply these concepts in real-world scenarios? Let's look at practical examples and case studies that demonstrate the importance of these concepts.`,
              flowchart: {
                type: "data",
                nodes: [
                  { id: "8", label: "Theory", type: "process" },
                  { id: "9", label: "Practice", type: "process" },
                  { id: "10", label: "Results", type: "end" }
                ],
                connections: [
                  { from: "8", to: "9", label: "applies to" },
                  { from: "9", to: "10", label: "produces" }
                ]
              },
              animation: {
                sequence: ["8", "9", "10"],
                timing: [0, 4, 8]
              },
              voiceScript: `Now let's see how these concepts work in practice. Real-world applications help us understand the true value of what we've learned.`,
              duration: 50
            }
          ],
          interactions: [
            {
              slideId: 1,
              question: "What aspect of this topic interests you most?",
              expectedAnswers: ["The fundamentals", "Practical applications", "Advanced concepts"],
              feedback: "Great choice! Let's explore that together."
            },
            {
              slideId: 2,
              question: "Do you have any questions about these concepts?",
              expectedAnswers: ["I understand", "Need clarification", "Want examples"],
              feedback: "Perfect! Let's continue with more details."
            },
            {
              slideId: 3,
              question: "How would you apply these concepts?",
              expectedAnswers: ["In my work", "In studies", "In projects"],
              feedback: "Excellent! That's exactly how learning becomes practical."
            }
          ],
          summary: `We've covered the essential concepts of ${subject}, from fundamental principles to practical applications. Remember to practice these concepts regularly to master them completely.`,
          totalDuration: 180
        };
      }
    } catch (error) {
      console.error('Error generating lecture script:', error);
      return {
        title: `Interactive Lecture: ${subject}`,
        introduction: `Welcome to this comprehensive lecture on ${subject}! Today we'll explore the fundamental concepts and practical applications. Get ready for an engaging learning experience with interactive elements and visual aids.`,
        slides: [
          {
            id: 1,
            title: "Introduction & Overview",
            content: `Let's start our journey into ${subject}. This field encompasses many important concepts that we'll explore together. Understanding these fundamentals will provide a solid foundation for advanced learning.`,
            flowchart: {
              type: "concept",
              nodes: [
                { id: "1", label: "Start Learning", type: "start" },
                { id: "2", label: "Core Concepts", type: "process" },
                { id: "3", label: "Practical Examples", type: "process" },
                { id: "4", label: "Apply Knowledge", type: "end" }
              ],
              connections: [
                { from: "1", to: "2", label: "explore" },
                { from: "2", to: "3", label: "understand" },
                { from: "3", to: "4", label: "master" }
              ]
            },
            animation: {
              sequence: ["1", "2", "3", "4"],
              timing: [0, 2, 4, 6]
            },
            voiceScript: `Welcome to our comprehensive lecture on ${subject}. Today we'll explore the fundamental concepts step by step. Let's begin with an overview of what we'll cover.`,
            duration: 45
          },
          {
            id: 2,
            title: "Key Concepts Deep Dive",
            content: `Now let's dive deeper into the core concepts. ${documentContent.substring(0, 200)}... These concepts form the backbone of understanding in this field.`,
            flowchart: {
              type: "process",
              nodes: [
                { id: "5", label: "Concept A", type: "process" },
                { id: "6", label: "Concept B", type: "process" },
                { id: "7", label: "Integration", type: "decision" }
              ],
              connections: [
                { from: "5", to: "7", label: "connects to" },
                { from: "6", to: "7", label: "connects to" }
              ]
            },
            animation: {
              sequence: ["5", "6", "7"],
              timing: [0, 3, 6]
            },
            voiceScript: `Let's explore the key concepts in detail. Understanding these principles is crucial for mastering ${subject}.`,
            duration: 60
          },
          {
            id: 3,
            title: "Practical Applications",
            content: `How do we apply these concepts in real-world scenarios? Let's look at practical examples and case studies that demonstrate the importance of these concepts.`,
            flowchart: {
              type: "data",
              nodes: [
                { id: "8", label: "Theory", type: "process" },
                { id: "9", label: "Practice", type: "process" },
                { id: "10", label: "Results", type: "end" }
              ],
              connections: [
                { from: "8", to: "9", label: "applies to" },
                { from: "9", to: "10", label: "produces" }
              ]
            },
            animation: {
              sequence: ["8", "9", "10"],
              timing: [0, 4, 8]
            },
            voiceScript: `Now let's see how these concepts work in practice. Real-world applications help us understand the true value of what we've learned.`,
            duration: 50
          }
        ],
        interactions: [
          {
            slideId: 1,
            question: "What aspect of this topic interests you most?",
            expectedAnswers: ["The fundamentals", "Practical applications", "Advanced concepts"],
            feedback: "Great choice! Let's explore that together."
          },
          {
            slideId: 2,
            question: "Do you have any questions about these concepts?",
            expectedAnswers: ["I understand", "Need clarification", "Want examples"],
            feedback: "Perfect! Let's continue with more details."
          },
          {
            slideId: 3,
            question: "How would you apply these concepts?",
            expectedAnswers: ["In my work", "In studies", "In projects"],
            feedback: "Excellent! That's exactly how learning becomes practical."
          }
        ],
        summary: `We've covered the essential concepts of ${subject}, from fundamental principles to practical applications. Remember to practice these concepts regularly to master them completely.`,
        totalDuration: 180
      };
    }
  }

  // Generate quiz questions from document content
  async generateQuiz(documentContent, subject, questionCount = 5) {
    try {
      const prompt = `
        Generate ${questionCount} quiz questions based on the following document content.
        
        Subject: ${subject}
        
        Document Content:
        ${documentContent}
        
        Requirements:
        1. Create a mix of question types (multiple choice, true/false, short answer)
        2. Questions should test understanding, not just memorization
        3. Include varying difficulty levels
        4. Provide clear, unambiguous correct answers
        5. Include explanations for answers
        
        Format as JSON:
        {
          "questions": [
            {
              "type": "multiple_choice|true_false|short_answer",
              "question": "Question text",
              "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
              "correctAnswer": "Correct answer",
              "explanation": "Why this is correct",
              "difficulty": "easy|medium|hard",
              "points": 1
            }
          ]
        }
      `;

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        }
      );

      console.log('Gemini API response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.candidates || response.data.candidates.length === 0) {
        console.error('No candidates in response:', response.data);
        throw new Error('No candidates in Gemini API response');
      }
      
      const candidate = response.data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        console.error('No content in candidate:', candidate);
        throw new Error('No content in Gemini API response');
      }
      
      const content = candidate.content.parts[0].text;
      
      try {
        // Clean the content to remove markdown code blocks
        let cleanContent = content.trim();
        
        // Remove markdown code blocks
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to find JSON object in the content
        let jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanContent = jsonMatch[0];
        }
        
        return JSON.parse(cleanContent);
      } catch (parseError) {
        // Fallback quiz structure
        return {
          questions: [
            {
              type: "multiple_choice",
              question: `What is the main topic discussed in the ${subject} document?`,
              options: ["Option A", "Option B", "Option C", "Option D"],
              correctAnswer: "Option A",
              explanation: "This is the main topic based on the document content.",
              difficulty: "medium",
              points: 1
            }
          ]
        };
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      throw new Error('Failed to generate quiz');
    }
  }

  // Answer user questions using RAG
  async answerQuestion(question, relevantChunks, context = '') {
    try {
      const contextText = relevantChunks.map(chunk => chunk.content).join('\n\n');
      
      const prompt = `
        You are an AI tutor helping a student understand their study material.
        
        Context from the study material:
        ${contextText}
        
        Student's question: ${question}
        
        Additional context: ${context}
        
        Please provide a helpful, accurate answer based on the study material.
        If the question cannot be answered from the provided material, say so clearly.
        Keep your answer concise but comprehensive.
        Use examples when helpful.
      `;

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error answering question:', error);
      throw new Error('Failed to answer question');
    }
  }

  // Grade essay/short answer questions
  async gradeAnswer(question, studentAnswer, rubric = '') {
    try {
      const prompt = `
        Grade the following student answer based on the question and rubric.
        
        Question: ${question}
        Student Answer: ${studentAnswer}
        Rubric: ${rubric || 'Evaluate for accuracy, completeness, and clarity'}
        
        Provide:
        1. A score from 0-100
        2. Brief feedback
        3. Suggestions for improvement
        
        Format as JSON:
        {
          "score": 85,
          "feedback": "Good understanding shown, but could be more detailed",
          "suggestions": ["Add more examples", "Explain the reasoning"]
        }
      `;

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-2.5-flash:generateContent`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getCurrentApiKey()
          }
        }
      );

      console.log('Gemini API response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.candidates || response.data.candidates.length === 0) {
        console.error('No candidates in response:', response.data);
        throw new Error('No candidates in Gemini API response');
      }
      
      const candidate = response.data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        console.error('No content in candidate:', candidate);
        throw new Error('No content in Gemini API response');
      }
      
      const content = candidate.content.parts[0].text;
      
      try {
        // Clean the content to remove markdown code blocks
        let cleanContent = content.trim();
        
        // Remove markdown code blocks
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to find JSON object in the content
        let jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanContent = jsonMatch[0];
        }
        
        return JSON.parse(cleanContent);
      } catch (parseError) {
        return {
          score: 75,
          feedback: "Answer shows understanding but could be improved",
          suggestions: ["Provide more detail", "Use specific examples"]
        };
      }
    } catch (error) {
      console.error('Error grading answer:', error);
      throw new Error('Failed to grade answer');
    }
  }

  // Handle interactive Q&A with context maintenance
  async handleInteractiveQuestion(question, lectureContext, slideContext, conversationHistory = []) {
    try {
      const contextPrompt = `
You are an AI tutor conducting an interactive lecture. Maintain context throughout the conversation.

LECTURE CONTEXT:
Title: ${lectureContext.title}
Current Slide: ${slideContext.title}
Slide Content: ${slideContext.content}

CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

STUDENT QUESTION: ${question}

Instructions:
1. Answer the question in context of the current lecture
2. Keep responses concise but helpful
3. If the question is off-topic, gently redirect to lecture content
4. Use the conversation history to maintain continuity
5. End with a brief question to keep engagement

Respond in JSON format (no markdown code blocks, just pure JSON):
{
  "answer": "Your response to the student",
  "followUpQuestion": "Optional follow-up question",
  "redirectToSlide": null or slideId if should redirect,
  "confidence": 0.8
}`;

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-2.5-flash:generateContent`,
        {
          contents: [{
            parts: [{
              text: contextPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 500
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getCurrentApiKey()
          }
        }
      );

      if (response.data.candidates && response.data.candidates[0]) {
        const candidate = response.data.candidates[0];
        
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          const content = candidate.content.parts[0].text;
          
          try {
            // Clean the content to remove markdown code blocks
            let cleanContent = content.trim();
            
            // Remove markdown code blocks
            if (cleanContent.startsWith('```json')) {
              cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanContent.startsWith('```')) {
              cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            // Try to find JSON object in the content
            let jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleanContent = jsonMatch[0];
            }
            
            return JSON.parse(cleanContent);
          } catch (parseError) {
            console.warn('Failed to parse JSON response:', parseError.message);
            console.log('Raw content:', content);
            return {
              answer: content,
              followUpQuestion: "Does this help clarify the concept?",
              redirectToSlide: null,
              confidence: 0.7
            };
          }
        }
      }
      
      throw new Error('No content in Gemini API response');
    } catch (error) {
      console.error('Error handling interactive question:', error);
      
      // Fallback response
      return {
        answer: "I understand your question. Let me help clarify this concept from our lecture.",
        followUpQuestion: "Would you like me to explain this in more detail?",
        redirectToSlide: null,
        confidence: 0.5
      };
    }
  }

  // Generate text-to-speech script for a slide
  async generateTTScript(slideContent, slideTitle, animationTiming) {
    try {
      const prompt = `Create a natural, engaging narration script for this slide:

Title: ${slideTitle}
Content: ${slideContent}
Animation Timing: ${JSON.stringify(animationTiming)}

Create a script that:
1. Introduces the slide naturally
2. Explains concepts as they appear in animation
3. Uses pauses and emphasis appropriately
4. Keeps students engaged
5. Is suitable for text-to-speech conversion

Return only the narration text, no JSON formatting.`;

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-2.5-flash:generateContent`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 300
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getCurrentApiKey()
          }
        }
      );

      if (response.data.candidates && response.data.candidates[0]) {
        const candidate = response.data.candidates[0];
        
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          return candidate.content.parts[0].text;
        }
      }
      
      // Fallback
      return `Let's explore ${slideTitle}. ${slideContent}`;
    } catch (error) {
      console.error('Error generating TTS script:', error);
      return `Let's explore ${slideTitle}. ${slideContent}`;
    }
  }
}

module.exports = new AIService();
