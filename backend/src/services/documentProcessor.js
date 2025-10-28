const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const natural = require('natural');
const aiService = require('./aiService');

class DocumentProcessor {
  constructor() {
    this.uploadPath = process.env.UPLOAD_PATH || './uploads';
    // Parse file size from environment variable (supports MB format)
    const maxFileSizeStr = process.env.MAX_FILE_SIZE || '50MB';
    if (maxFileSizeStr.endsWith('MB')) {
      this.maxFileSize = parseInt(maxFileSizeStr) * 1024 * 1024;
    } else {
      this.maxFileSize = parseInt(maxFileSizeStr) || 50 * 1024 * 1024;
    }
    
    this.setupMulter();
  }

  setupMulter() {
    // Ensure upload directory exists
    fs.mkdir(this.uploadPath, { recursive: true }).catch(console.error);

    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

    this.upload = multer({
      storage: this.storage,
      limits: {
        fileSize: this.maxFileSize
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/gif'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF, TXT, DOCX, and images are allowed.'));
        }
      }
    });
  }

  // Extract text from different file types
  async extractText(filePath, fileType) {
    try {
      switch (fileType) {
        case 'pdf':
          return await this.extractFromPDF(filePath);
        case 'txt':
          return await this.extractFromTXT(filePath);
        case 'docx':
          return await this.extractFromDOCX(filePath);
        case 'image':
          return await this.extractFromImage(filePath);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error('Error extracting text:', error);
      throw new Error(`Failed to extract text from ${fileType} file`);
    }
  }

  async extractFromPDF(filePath) {
    try {
      console.log('📄 Extracting text from PDF using pdf-parse (FREE)...');
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }
      
      console.log(`✅ PDF text extracted: ${data.text.length} characters`);
      return data.text.trim();
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  async extractFromTXT(filePath) {
    try {
      console.log('📝 Extracting text from TXT file (FREE)...');
      const content = await fs.readFile(filePath, 'utf8');
      
      if (!content || content.trim().length === 0) {
        throw new Error('No text content found in TXT file');
      }
      
      console.log(`✅ TXT text extracted: ${content.length} characters`);
      return content.trim();
    } catch (error) {
      console.error('TXT extraction error:', error);
      throw new Error('Failed to extract text from TXT file');
    }
  }

  async extractFromDOCX(filePath) {
    try {
      console.log('📄 Extracting text from DOCX using mammoth (FREE)...');
      const result = await mammoth.extractRawText({ path: filePath });
      
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('No text content found in DOCX file');
      }
      
      console.log(`✅ DOCX text extracted: ${result.value.length} characters`);
      return result.value.trim();
    } catch (error) {
      console.error('DOCX extraction error:', error);
      throw new Error('Failed to extract text from DOCX file');
    }
  }

  async extractFromImage(filePath) {
    try {
      console.log('🖼️ Extracting text from image using Tesseract.js OCR (FREE)...');
      
      // Preprocess image for better OCR
      const processedImagePath = await this.preprocessImageForOCR(filePath);
      
      // Use Tesseract.js for OCR
      const { data: { text } } = await Tesseract.recognize(
        processedImagePath,
        'eng',
        {
          logger: m => console.log('OCR Progress:', m)
        }
      );
      
      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in image');
      }
      
      console.log(`✅ Image OCR completed: ${text.length} characters`);
      return text.trim();
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  // Preprocess image for better OCR results
  async preprocessImageForOCR(filePath) {
    try {
      const processedPath = filePath.replace(/\.[^/.]+$/, '_processed.png');
      
      await sharp(filePath)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(processedPath);
      
      return processedPath;
    } catch (error) {
      console.error('Image preprocessing error:', error);
      return filePath; // Return original if preprocessing fails
    }
  }

  // Chunk text into smaller pieces for embedding using FREE natural language processing
  chunkText(text, chunkSize = 1000, overlap = 200) {
    console.log('📝 Chunking text using FREE natural language processing...');
    
    const chunks = [];
    let start = 0;
    
    // Use natural language processing for better sentence detection
    const sentences = this.splitIntoSentences(text);
    let currentChunk = '';
    let chunkStart = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      // If adding this sentence would exceed chunk size, save current chunk
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          start: chunkStart,
          end: chunkStart + currentChunk.length,
          length: currentChunk.length,
          sentences: currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length
        });
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + sentence;
        chunkStart = chunkStart + currentChunk.length - overlapText.length - sentence.length;
      } else {
        currentChunk += sentence;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        start: chunkStart,
        end: chunkStart + currentChunk.length,
        length: currentChunk.length,
        sentences: currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length
      });
    }
    
    console.log(`✅ Text chunked into ${chunks.length} pieces`);
    return chunks;
  }

  // Split text into sentences using FREE natural language processing
  splitIntoSentences(text) {
    // Use natural language processing for better sentence detection
    const tokenizer = new natural.SentenceTokenizer();
    return tokenizer.tokenize(text);
  }

  // Get overlap text from previous chunk
  getOverlapText(text, overlapSize) {
    if (text.length <= overlapSize) return text;
    
    // Try to break at word boundary
    const overlapText = text.slice(-overlapSize);
    const firstSpace = overlapText.indexOf(' ');
    
    if (firstSpace > 0) {
      return overlapText.slice(firstSpace + 1);
    }
    
    return overlapText;
  }

  // Extract keywords using Gemini AI (better results)
  async extractKeywordsWithGemini(text, maxKeywords = 10) {
    try {
      console.log('🤖 Extracting keywords using Gemini AI...');
      
      const prompt = `Extract the top ${maxKeywords} most important keywords from this text. Return only a JSON array of strings, no other text.

Text: ${text.substring(0, 2000)}`;

      const response = await aiService.generateText(prompt);
      
      try {
        const keywords = JSON.parse(response);
        console.log(`✅ Gemini extracted ${keywords.length} keywords`);
        return keywords.map(keyword => ({ word: keyword, count: 1, source: 'gemini' }));
      } catch (parseError) {
        // Fallback to FREE method
        return this.extractKeywords(text, maxKeywords);
      }
    } catch (error) {
      console.error('Gemini keyword extraction error:', error);
      return this.extractKeywords(text, maxKeywords);
    }
  }

  // Generate summary using Gemini AI (better results)
  async generateSummaryWithGemini(text, maxSentences = 3) {
    try {
      console.log('🤖 Generating summary using Gemini AI...');
      
      const prompt = `Summarize this text in ${maxSentences} sentences. Focus on the main points and key information.

Text: ${text.substring(0, 3000)}`;

      const summary = await aiService.generateText(prompt);
      console.log(`✅ Gemini generated summary: ${summary.length} characters`);
      return summary.trim();
    } catch (error) {
      console.error('Gemini summary generation error:', error);
      return this.generateSummary(text, maxSentences);
    }
  }

  // Extract subject using Gemini AI (better results)
  async extractSubjectWithGemini(text) {
    try {
      console.log('🤖 Extracting subject using Gemini AI...');
      
      const prompt = `What is the main subject or topic of this text? Respond with only the subject name (e.g., "Mathematics", "Science", "History", "Technology", "Business", "Literature").

Text: ${text.substring(0, 2000)}`;

      const subject = await aiService.generateText(prompt);
      const cleanSubject = subject.trim().replace(/['"]/g, '');
      console.log(`✅ Gemini detected subject: ${cleanSubject}`);
      return cleanSubject;
    } catch (error) {
      console.error('Gemini subject extraction error:', error);
      return this.extractSubject(text);
    }
  }

  // Extract keywords using FREE natural language processing
  extractKeywords(text, maxKeywords = 10) {
    try {
      console.log('🔍 Extracting keywords using FREE NLP...');
      
      // Tokenize and clean text
      const tokenizer = new natural.WordTokenizer();
      const tokens = tokenizer.tokenize(text.toLowerCase());
      
      // Remove stop words and short words
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);
      
      const filteredTokens = tokens.filter(token => 
        token.length > 2 && 
        !stopWords.has(token) && 
        !/^\d+$/.test(token) // Remove pure numbers
      );
      
      // Count word frequency
      const wordCount = {};
      filteredTokens.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
      
      // Sort by frequency and return top keywords
      const keywords = Object.entries(wordCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, maxKeywords)
        .map(([word, count]) => ({ word, count }));
      
      console.log(`✅ Extracted ${keywords.length} keywords`);
      return keywords;
    } catch (error) {
      console.error('Keyword extraction error:', error);
      return [];
    }
  }

  // Generate summary using FREE text processing
  generateSummary(text, maxSentences = 3) {
    try {
      console.log('📝 Generating summary using FREE NLP...');
      
      // Split into sentences
      const sentences = this.splitIntoSentences(text);
      
      if (sentences.length <= maxSentences) {
        return text; // Return original if too short
      }
      
      // Simple extractive summarization - take first few sentences
      const summary = sentences.slice(0, maxSentences).join(' ');
      
      console.log(`✅ Generated summary: ${summary.length} characters`);
      return summary;
    } catch (error) {
      console.error('Summary generation error:', error);
      return text.substring(0, 200) + '...'; // Fallback to first 200 chars
    }
  }

  // Process document and create embeddings
  async processDocument(documentId, filePath, fileType) {
    try {
      console.log(`Processing document ${documentId}...`);
      
      // Extract text
      const extractedText = await this.extractText(filePath, fileType);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content found in document');
      }

      // Chunk the text
      const chunks = this.chunkText(extractedText);
      console.log(`Created ${chunks.length} chunks`);

      // Generate embeddings for each chunk
      const processedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
        
        try {
          // Use Gemini embeddings for better results, fallback to FREE processing
          let embedding = null;
          let keywords = [];
          let summary = '';
          
                  try {
                    // Try Gemini first for best results
                    console.log(`🤖 Using Gemini for chunk ${i + 1}/${chunks.length}...`);
                    embedding = await aiService.generateEmbeddings(chunk.content);
                    keywords = await this.extractKeywordsWithGemini(chunk.content);
                    summary = await this.generateSummaryWithGemini(chunk.content);
                  } catch (geminiError) {
                    console.log(`⚠️ Gemini failed for chunk ${i + 1}, using FREE alternatives...`);
                    // Fallback to FREE processing - never fail
                    keywords = this.extractKeywords(chunk.content);
                    summary = this.generateSummary(chunk.content);
                    // Don't throw error, continue with FREE processing
                  }
          
          processedChunks.push({
            content: chunk.content,
            embedding,
            keywords,
            summary,
            metadata: {
              chunkIndex: i,
              start: chunk.start,
              end: chunk.end,
              length: chunk.length,
              sentences: chunk.sentences || 0,
              processingMethod: embedding ? 'gemini' : 'free'
            }
          });
        } catch (error) {
          console.error(`Error processing chunk ${i}:`, error);
          // Continue with other chunks
        }
      }

      // Extract metadata with FREE fallbacks
      let subject, keywords, summary;
      
      try {
        subject = await this.extractSubjectWithGemini(extractedText);
      } catch (error) {
        console.log('⚠️ Gemini subject extraction failed, using FREE fallback...');
        subject = this.extractSubject(extractedText);
      }
      
      try {
        keywords = await this.extractKeywordsWithGemini(extractedText, 20);
      } catch (error) {
        console.log('⚠️ Gemini keyword extraction failed, using FREE fallback...');
        keywords = this.extractKeywords(extractedText, 20);
      }
      
      try {
        summary = await this.generateSummaryWithGemini(extractedText, 5);
      } catch (error) {
        console.log('⚠️ Gemini summary generation failed, using FREE fallback...');
        summary = this.generateSummary(extractedText, 5);
      }

      return {
        extractedText,
        chunks: processedChunks,
        metadata: {
          wordCount: extractedText.split(/\s+/).length,
          chunkCount: processedChunks.length,
          language: (() => {
            try {
              return DocumentProcessor.detectLanguage(extractedText);
            } catch (error) {
              console.error('Language detection error:', error);
              return 'en'; // Default to English
            }
          })(),
          subject,
          keywords,
          summary,
          readability: this.calculateReadability(extractedText),
          processingTime: new Date().toISOString(),
          processingMethod: processedChunks.some(c => c.metadata.processingMethod === 'gemini') ? 'gemini' : 'free'
        }
      };
    } catch (error) {
      console.error('Document processing error:', error);
      throw error;
    }
  }

  // Extract subject/topic using FREE text analysis
  extractSubject(text) {
    try {
      console.log('📚 Extracting subject using FREE text analysis...');
      
      // Get top keywords
      const keywords = this.extractKeywords(text, 5);
      
      // Simple subject detection based on common academic subjects
      const subjectKeywords = {
        'mathematics': ['math', 'algebra', 'calculus', 'geometry', 'equation', 'formula', 'number', 'solve'],
        'science': ['science', 'biology', 'chemistry', 'physics', 'experiment', 'research', 'theory', 'hypothesis'],
        'history': ['history', 'historical', 'ancient', 'century', 'war', 'battle', 'empire', 'civilization'],
        'literature': ['literature', 'novel', 'poetry', 'author', 'character', 'plot', 'theme', 'writing'],
        'technology': ['technology', 'computer', 'software', 'programming', 'digital', 'internet', 'data', 'system'],
        'business': ['business', 'management', 'marketing', 'finance', 'economy', 'company', 'strategy', 'profit']
      };
      
      const textLower = text.toLowerCase();
      let bestMatch = 'General';
      let maxScore = 0;
      
      for (const [subject, keywords] of Object.entries(subjectKeywords)) {
        const score = keywords.reduce((acc, keyword) => {
          return acc + (textLower.includes(keyword) ? 1 : 0);
        }, 0);
        
        if (score > maxScore) {
          maxScore = score;
          bestMatch = subject.charAt(0).toUpperCase() + subject.slice(1);
        }
      }
      
      console.log(`✅ Subject detected: ${bestMatch}`);
      return bestMatch;
    } catch (error) {
      console.error('Subject extraction error:', error);
      return 'General';
    }
  }

  // Calculate readability score using FREE algorithm
  calculateReadability(text) {
    try {
      console.log('📊 Calculating readability using FREE algorithm...');
      
      const sentences = this.splitIntoSentences(text);
      const words = text.split(/\s+/).filter(word => word.length > 0);
      const syllables = words.reduce((acc, word) => acc + this.countSyllables(word), 0);
      
      // Flesch Reading Ease Score
      const avgWordsPerSentence = words.length / sentences.length;
      const avgSyllablesPerWord = syllables / words.length;
      
      const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
      
      let level;
      if (fleschScore >= 90) level = 'Very Easy';
      else if (fleschScore >= 80) level = 'Easy';
      else if (fleschScore >= 70) level = 'Fairly Easy';
      else if (fleschScore >= 60) level = 'Standard';
      else if (fleschScore >= 50) level = 'Fairly Difficult';
      else if (fleschScore >= 30) level = 'Difficult';
      else level = 'Very Difficult';
      
      console.log(`✅ Readability: ${level} (${fleschScore.toFixed(1)})`);
      return {
        score: Math.round(fleschScore),
        level,
        avgWordsPerSentence: Math.round(avgWordsPerSentence),
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100
      };
    } catch (error) {
      console.error('Readability calculation error:', error);
      return { score: 50, level: 'Standard', avgWordsPerSentence: 15, avgSyllablesPerWord: 1.5 };
    }
  }

  // Count syllables in a word (FREE algorithm)
  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    let syllables = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = 'aeiouy'.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        syllables++;
      }
      previousWasVowel = isVowel;
    }
    
    // Handle silent 'e'
    if (word.endsWith('e') && syllables > 1) {
      syllables--;
    }
    
    return Math.max(1, syllables);
  }

  // Clean up temporary files
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
  }

  // Simple language detection (static method)
  static detectLanguage(text) {
    try {
      console.log('🌍 Detecting language using FREE algorithm...');
      
      // Simple heuristic - in production, use a proper language detection library
      const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'];
      const words = text.toLowerCase().split(/\s+/);
      const englishCount = words.filter(word => englishWords.includes(word)).length;
      
      const language = englishCount > words.length * 0.1 ? 'en' : 'unknown';
      console.log(`✅ Language detected: ${language}`);
      return language;
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default to English
    }
  }

  // Get multer middleware
  getUploadMiddleware() {
    return this.upload;
  }
}

module.exports = new DocumentProcessor();
