// Optional vector database imports
let MilvusClient;
try {
  const milvus = require('@zilliz/milvus2-sdk-node');
  MilvusClient = milvus.MilvusClient;
} catch (error) {
  console.log('⚠️  Milvus SDK not available, using fallback storage');
}

const aiService = require('./aiService');

class VectorService {
  constructor() {
    this.client = null;
    this.collectionName = 'noteflow_embeddings';
    this.dimension = 768; // Gemini embedding dimension
    this.connected = false;
    this.useFallback = false;
    this.fallbackStorage = new Map(); // Simple in-memory fallback
  }

  async connect() {
    try {
      if (!MilvusClient) {
        throw new Error('Milvus SDK not available');
      }

      this.client = new MilvusClient({
        address: `${process.env.MILVUS_HOST || 'localhost'}:${process.env.MILVUS_PORT || 19530}`
      });

      await this.client.connect();
      this.connected = true;
      console.log('✅ Milvus connected');
      
      // Create collection if it doesn't exist
      await this.ensureCollection();
    } catch (error) {
      console.error('Milvus connection failed:', error);
      // Fallback to in-memory storage for development
      this.useFallback = true;
      this.fallbackStorage = new Map();
      this.connected = true; // Mark as connected for fallback
      console.log('📦 Using fallback in-memory storage');
    }
  }

  async ensureCollection() {
    try {
      const collections = await this.client.listCollections();
      
      if (!collections.includes(this.collectionName)) {
        await this.client.createCollection({
          collection_name: this.collectionName,
          dimension: this.dimension,
          metric_type: 'COSINE',
          index_type: 'IVF_FLAT',
          params: { nlist: 1024 }
        });
        console.log(`Created collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Error ensuring collection:', error);
    }
  }

  // Store document chunks with embeddings
  async storeDocumentChunks(documentId, chunks) {
    try {
      if (this.useFallback || !this.client) {
        return this.storeChunksFallback(documentId, chunks);
      }

      const vectors = chunks.map(chunk => chunk.embedding);
      const metadata = chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk.content,
        ...chunk.metadata
      }));

      await this.client.insert({
        collection_name: this.collectionName,
        data: {
          vectors,
          metadata
        }
      });

      console.log(`Stored ${chunks.length} chunks for document ${documentId}`);
    } catch (error) {
      console.error('Error storing chunks:', error);
      // If we're using fallback, don't throw error
      if (this.useFallback) {
        console.log('📦 Using fallback storage due to error');
        this.storeChunksFallback(documentId, chunks);
        return;
      }
      throw new Error('Failed to store document chunks');
    }
  }

  // Search for similar chunks
  async searchSimilarChunks(query, documentId = null, limit = 5) {
    try {
      if (this.useFallback) {
        return this.searchChunksFallback(query, documentId, limit);
      }

      // Generate embedding for query
      const queryEmbedding = await aiService.generateEmbeddings(query);

      const searchParams = {
        collection_name: this.collectionName,
        vectors: [queryEmbedding],
        top_k: limit,
        params: { nprobe: 10 }
      };

      // Add document filter if specified
      if (documentId) {
        searchParams.filter = `document_id == "${documentId}"`;
      }

      const results = await this.client.search(searchParams);
      
      return results[0].map(result => ({
        content: result.metadata.content,
        score: result.score,
        metadata: {
          documentId: result.metadata.document_id,
          chunkIndex: result.metadata.chunk_index,
          ...result.metadata
        }
      }));
    } catch (error) {
      console.error('Error searching chunks:', error);
      throw new Error('Failed to search similar chunks');
    }
  }

  // Fallback storage for development
  storeChunksFallback(documentId, chunks) {
    if (!this.fallbackStorage.has(documentId)) {
      this.fallbackStorage.set(documentId, []);
    }
    
    const existingChunks = this.fallbackStorage.get(documentId);
    const newChunks = chunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: {
        document_id: documentId,
        chunk_index: index,
        ...chunk.metadata
      }
    }));
    
    this.fallbackStorage.set(documentId, [...existingChunks, ...newChunks]);
    console.log(`Stored ${chunks.length} chunks in fallback storage for document ${documentId}`);
  }

  // Fallback search
  async searchChunksFallback(query, documentId, limit) {
    const queryEmbedding = await aiService.generateEmbeddings(query);
    const results = [];

    for (const [docId, chunks] of this.fallbackStorage) {
      if (documentId && docId !== documentId) continue;

      for (const chunk of chunks) {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        results.push({
          content: chunk.content,
          score: similarity,
          metadata: {
            documentId: chunk.metadata.document_id,
            chunkIndex: chunk.metadata.chunk_index,
            ...chunk.metadata
          }
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Calculate cosine similarity
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Delete document chunks
  async deleteDocumentChunks(documentId) {
    try {
      if (this.useFallback) {
        this.fallbackStorage.delete(documentId);
        return;
      }

      await this.client.delete({
        collection_name: this.collectionName,
        filter: `document_id == "${documentId}"`
      });

      console.log(`Deleted chunks for document ${documentId}`);
    } catch (error) {
      console.error('Error deleting chunks:', error);
      throw new Error('Failed to delete document chunks');
    }
  }

  // Get collection statistics
  async getCollectionStats() {
    try {
      if (this.useFallback) {
        return {
          totalChunks: Array.from(this.fallbackStorage.values())
            .reduce((sum, chunks) => sum + chunks.length, 0),
          documents: this.fallbackStorage.size
        };
      }

      const stats = await this.client.getCollectionStats({
        collection_name: this.collectionName
      });

      return stats;
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { totalChunks: 0, documents: 0 };
    }
  }
}

module.exports = new VectorService();
