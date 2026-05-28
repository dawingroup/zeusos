/**
 * Semantic Search Service
 * Provides vector embedding and semantic search capabilities for RAG
 * Uses Gemini embeddings via Cloud Functions
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/shared/services/firebase';

// ============================================
// Types
// ============================================

export interface EmbeddingDocument {
  id: string;
  collectionName: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SemanticSearchResult {
  documentId: string;
  collectionName: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface IndexableDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export type IndexableCollection =
  | 'launchProducts'
  | 'designClips'
  | 'features'
  | 'standardParts'
  | 'projectStrategy'
  | 'inventoryItems';

// ============================================
// Embedding Generation
// ============================================

/**
 * Generate embedding for text using Gemini
 * Calls Cloud Function that wraps Gemini embedding API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const generateEmbeddingFn = httpsCallable<{ text: string }, { embedding: number[] }>(
      functions,
      'generateEmbedding'
    );
    
    const result = await generateEmbeddingFn({ text });
    return result.data.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const generateEmbeddingsFn = httpsCallable<{ texts: string[] }, { embeddings: number[][] }>(
      functions,
      'generateEmbeddings'
    );
    
    const result = await generateEmbeddingsFn({ texts });
    return result.data.embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

// ============================================
// Vector Store Operations
// ============================================

const EMBEDDINGS_COLLECTION = 'embeddings';

/**
 * Store embedding in Firestore
 */
export async function storeEmbedding(
  collectionName: IndexableCollection,
  documentId: string,
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const embeddingId = `${collectionName}_${documentId}`;
  const embeddingDoc: EmbeddingDocument = {
    id: embeddingId,
    collectionName,
    documentId,
    content,
    embedding,
    metadata,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(doc(db, EMBEDDINGS_COLLECTION, embeddingId), embeddingDoc);
}

/**
 * Get all embeddings for a collection
 */
export async function getCollectionEmbeddings(
  collectionName: IndexableCollection
): Promise<EmbeddingDocument[]> {
  const q = query(
    collection(db, EMBEDDINGS_COLLECTION),
    where('collectionName', '==', collectionName)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as EmbeddingDocument);
}

// ============================================
// Similarity Search
// ============================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
 * Search for similar documents using vector similarity
 */
export async function semanticSearch(
  queryText: string,
  collections: IndexableCollection[],
  topK: number = 10,
  minSimilarity: number = 0.5
): Promise<SemanticSearchResult[]> {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(queryText);
  
  // Get all embeddings from specified collections
  const allEmbeddings: EmbeddingDocument[] = [];
  for (const collectionName of collections) {
    const embeddings = await getCollectionEmbeddings(collectionName);
    allEmbeddings.push(...embeddings);
  }
  
  // Calculate similarities
  const results: SemanticSearchResult[] = allEmbeddings
    .map(doc => ({
      documentId: doc.documentId,
      collectionName: doc.collectionName,
      content: doc.content,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
      metadata: doc.metadata,
    }))
    .filter(result => result.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  
  return results;
}

/**
 * Search within a single collection
 */
export async function searchCollection(
  queryText: string,
  collectionName: IndexableCollection,
  topK: number = 5
): Promise<SemanticSearchResult[]> {
  return semanticSearch(queryText, [collectionName], topK);
}

// ============================================
// Indexing Operations
// ============================================

/**
 * Index a single document
 */
export async function indexDocument(
  collectionName: IndexableCollection,
  document: IndexableDocument
): Promise<void> {
  const embedding = await generateEmbedding(document.content);
  await storeEmbedding(
    collectionName,
    document.id,
    document.content,
    embedding,
    document.metadata
  );
}

/**
 * Index multiple documents in batch
 */
export async function indexDocuments(
  collectionName: IndexableCollection,
  documents: IndexableDocument[],
  batchSize: number = 10
): Promise<{ indexed: number; errors: number }> {
  let indexed = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const contents = batch.map(doc => doc.content);
    
    try {
      const embeddings = await generateEmbeddings(contents);
      
      // Store each embedding
      for (let j = 0; j < batch.length; j++) {
        try {
          await storeEmbedding(
            collectionName,
            batch[j].id,
            batch[j].content,
            embeddings[j],
            batch[j].metadata
          );
          indexed++;
        } catch (err) {
          console.error(`Error storing embedding for ${batch[j].id}:`, err);
          errors++;
        }
      }
    } catch (err) {
      console.error(`Error generating embeddings for batch:`, err);
      errors += batch.length;
    }
  }
  
  return { indexed, errors };
}

// ============================================
// Collection-Specific Indexers — removed in the Phase 1.E intelligence-
// layer strip.
//
// The DawinOS RAG indexers (indexProducts → launchProducts, indexClips →
// designClips, indexFeatures → features, indexParts → standardParts,
// indexInventoryItems → inventoryItems) + reindexAll + the
// searchInventoryBySimilarity reader all targeted collections stripped in
// Phase 1.A/1.C. They had no live UI callers (only the ai/ barrel
// re-exported them). The generic embedding primitives above
// (generateEmbedding(s), storeEmbedding, semanticSearch, indexDocument(s))
// are retained — knowledgeBaseService still uses semanticSearch against
// the embeddings index. New ZeusOS indexers (master_jobs, briefs, assets)
// can be added here when the RAG surface is rebuilt for the agency model.
// ============================================
