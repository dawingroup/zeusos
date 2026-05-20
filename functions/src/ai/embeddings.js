/**
 * Embedding Generation Cloud Functions
 * Uses Gemini API for text embedding generation
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);

/**
 * Generate embedding for a single text
 */
exports.generateEmbedding = onCall({
  cors: ALLOWED_ORIGINS,
  maxInstances: 10,
}, async (request) => {
  const { text } = request.data;
  
  if (!text || typeof text !== 'string') {
    throw new HttpsError('invalid-argument', 'Text is required and must be a string');
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    
    return { embedding };
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new HttpsError('internal', 'Failed to generate embedding');
  }
});

/**
 * Generate embeddings for multiple texts in batch
 */
exports.generateEmbeddings = onCall({
  cors: ALLOWED_ORIGINS,
  maxInstances: 10,
}, async (request) => {
  const { texts } = request.data;
  
  if (!texts || !Array.isArray(texts)) {
    throw new HttpsError('invalid-argument', 'Texts must be an array of strings');
  }
  
  if (texts.length > 100) {
    throw new HttpsError('invalid-argument', 'Maximum 100 texts per batch');
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    
    // Process in parallel with rate limiting
    const batchSize = 10;
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (text) => {
          const result = await model.embedContent(text);
          return result.embedding.values;
        })
      );
      embeddings.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return { embeddings };
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new HttpsError('internal', 'Failed to generate embeddings');
  }
});

/**
 * Semantic search across indexed documents
 * Performs vector similarity search
 */
exports.semanticSearch = onCall({
  cors: ALLOWED_ORIGINS,
  maxInstances: 10,
}, async (request) => {
  const { query, collections, topK = 10, minSimilarity = 0.5 } = request.data;
  
  if (!query || typeof query !== 'string') {
    throw new HttpsError('invalid-argument', 'Query is required');
  }
  
  const admin = require('firebase-admin');
  const db = admin.firestore();
  
  try {
    // Generate query embedding
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(query);
    const queryEmbedding = result.embedding.values;
    
    // Get embeddings from specified collections
    let embeddingsQuery = db.collection('embeddings');
    if (collections && collections.length > 0) {
      embeddingsQuery = embeddingsQuery.where('collectionName', 'in', collections);
    }
    
    const snapshot = await embeddingsQuery.get();
    const documents = snapshot.docs.map(doc => doc.data());
    
    // Calculate similarities
    const results = documents
      .map(doc => ({
        documentId: doc.documentId,
        collectionName: doc.collectionName,
        content: doc.content,
        metadata: doc.metadata,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
    
    return { results };
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw new HttpsError('internal', 'Semantic search failed');
  }
});

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Index a collection of documents
 * Generates embeddings and stores them
 */
exports.indexCollection = onCall({
  cors: ALLOWED_ORIGINS,
  maxInstances: 5,
  timeoutSeconds: 540, // 9 minutes for large collections
}, async (request) => {
  const { collectionName, buildContentFn } = request.data;
  
  if (!collectionName) {
    throw new HttpsError('invalid-argument', 'Collection name is required');
  }
  
  const admin = require('firebase-admin');
  const db = admin.firestore();
  
  try {
    // Get documents from source collection
    const sourceSnapshot = await db.collection(collectionName).get();
    const documents = sourceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    if (documents.length === 0) {
      return { indexed: 0, message: 'No documents to index' };
    }
    
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    let indexed = 0;
    let errors = 0;
    
    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (doc) => {
        try {
          // Build content based on collection type
          const content = buildDocumentContent(collectionName, doc);
          
          // Generate embedding
          const result = await model.embedContent(content);
          const embedding = result.embedding.values;
          
          // Store in embeddings collection
          const embeddingId = `${collectionName}_${doc.id}`;
          await db.collection('embeddings').doc(embeddingId).set({
            id: embeddingId,
            collectionName,
            documentId: doc.id,
            content,
            embedding,
            metadata: extractMetadata(collectionName, doc),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          indexed++;
        } catch (err) {
          console.error(`Error indexing ${doc.id}:`, err);
          errors++;
        }
      }));
      
      // Rate limiting delay
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return { indexed, errors, total: documents.length };
  } catch (error) {
    console.error('Error indexing collection:', error);
    throw new HttpsError('internal', 'Failed to index collection');
  }
});

/**
 * Build searchable content from document based on collection type
 */
function buildDocumentContent(collectionName, doc) {
  switch (collectionName) {
    case 'launchProducts':
      return buildProductContent(doc);
    case 'designClips':
      return buildClipContent(doc);
    case 'features':
      return buildFeatureContent(doc);
    case 'standardParts':
      return buildPartContent(doc);
    default:
      return JSON.stringify(doc);
  }
}

function buildProductContent(product) {
  const parts = [];
  if (product.name) parts.push(`Product: ${product.name}`);
  if (product.description) parts.push(product.description);
  if (product.category) parts.push(`Category: ${product.category}`);
  if (product.tags?.length) parts.push(`Tags: ${product.tags.join(', ')}`);
  if (product.specifications?.materials?.length) {
    parts.push(`Materials: ${product.specifications.materials.join(', ')}`);
  }
  if (product.specifications?.finishes?.length) {
    parts.push(`Finishes: ${product.specifications.finishes.join(', ')}`);
  }
  if (product.aiDiscovery?.semanticTags?.length) {
    parts.push(`Semantic Tags: ${product.aiDiscovery.semanticTags.join(', ')}`);
  }
  if (product.aiDiscovery?.useCases?.length) {
    parts.push(`Use Cases: ${product.aiDiscovery.useCases.join(', ')}`);
  }
  return parts.join('. ');
}

function buildClipContent(clip) {
  const parts = [];
  if (clip.title) parts.push(`Inspiration: ${clip.title}`);
  if (clip.notes) parts.push(clip.notes);
  if (clip.tags?.length) parts.push(`Tags: ${clip.tags.join(', ')}`);
  if (clip.aiAnalysis?.style) parts.push(`Style: ${clip.aiAnalysis.style}`);
  if (clip.aiAnalysis?.materials?.length) {
    parts.push(`Materials: ${clip.aiAnalysis.materials.join(', ')}`);
  }
  return parts.join('. ');
}

function buildFeatureContent(feature) {
  const parts = [];
  if (feature.name) parts.push(`Feature: ${feature.name}`);
  if (feature.description) parts.push(feature.description);
  if (feature.category) parts.push(`Category: ${feature.category}`);
  if (feature.tags?.length) parts.push(`Tags: ${feature.tags.join(', ')}`);
  if (feature.complexity) parts.push(`Complexity: ${feature.complexity}`);
  return parts.join('. ');
}

function buildPartContent(part) {
  const parts = [];
  if (part.name) parts.push(`Part: ${part.name}`);
  if (part.sku) parts.push(`SKU: ${part.sku}`);
  if (part.description) parts.push(part.description);
  if (part.category) parts.push(`Category: ${part.category}`);
  if (part.material) parts.push(`Material: ${part.material}`);
  return parts.join('. ');
}

/**
 * Extract metadata for quick filtering
 */
function extractMetadata(collectionName, doc) {
  switch (collectionName) {
    case 'launchProducts':
      return {
        name: doc.name,
        category: doc.category,
        currentStage: doc.currentStage,
      };
    case 'designClips':
      return {
        title: doc.title,
        tags: doc.tags,
        imageUrl: doc.imageUrl,
      };
    case 'features':
      return {
        name: doc.name,
        category: doc.category,
        complexity: doc.complexity,
      };
    case 'standardParts':
      return {
        name: doc.name,
        sku: doc.sku,
        category: doc.category,
      };
    default:
      return {};
  }
}
