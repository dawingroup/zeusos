/**
 * Semantic Search Service
 * Provides vector embedding and semantic search capabilities for RAG
 * Uses Gemini embeddings via Cloud Functions
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
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
// Collection-Specific Indexers
// ============================================

/**
 * Build searchable content from a product document
 */
export function buildProductContent(product: any): string {
  const parts: string[] = [];
  
  if (product.name) parts.push(`Product: ${product.name}`);
  if (product.description) parts.push(product.description);
  if (product.category) parts.push(`Category: ${product.category}`);
  if (product.tags?.length) parts.push(`Tags: ${product.tags.join(', ')}`);
  
  // Specifications
  if (product.specifications) {
    if (product.specifications.materials?.length) {
      parts.push(`Materials: ${product.specifications.materials.join(', ')}`);
    }
    if (product.specifications.finishes?.length) {
      parts.push(`Finishes: ${product.specifications.finishes.join(', ')}`);
    }
    if (product.specifications.features?.length) {
      parts.push(`Features: ${product.specifications.features.join(', ')}`);
    }
  }
  
  // AI Discovery data
  if (product.aiDiscovery) {
    if (product.aiDiscovery.semanticTags?.length) {
      parts.push(`Semantic Tags: ${product.aiDiscovery.semanticTags.join(', ')}`);
    }
    if (product.aiDiscovery.useCases?.length) {
      parts.push(`Use Cases: ${product.aiDiscovery.useCases.join(', ')}`);
    }
    if (product.aiDiscovery.targetMarkets?.length) {
      parts.push(`Target Markets: ${product.aiDiscovery.targetMarkets.join(', ')}`);
    }
  }
  
  return parts.join('. ');
}

/**
 * Build searchable content from an inspiration clip
 */
export function buildClipContent(clip: any): string {
  const parts: string[] = [];
  
  if (clip.title) parts.push(`Inspiration: ${clip.title}`);
  if (clip.notes) parts.push(clip.notes);
  if (clip.tags?.length) parts.push(`Tags: ${clip.tags.join(', ')}`);
  if (clip.sourceUrl) parts.push(`Source: ${clip.sourceUrl}`);
  
  // AI analysis if available
  if (clip.aiAnalysis) {
    if (clip.aiAnalysis.style) parts.push(`Style: ${clip.aiAnalysis.style}`);
    if (clip.aiAnalysis.materials?.length) {
      parts.push(`Materials: ${clip.aiAnalysis.materials.join(', ')}`);
    }
    if (clip.aiAnalysis.colors?.length) {
      parts.push(`Colors: ${clip.aiAnalysis.colors.join(', ')}`);
    }
  }
  
  return parts.join('. ');
}

/**
 * Build searchable content from a feature
 */
export function buildFeatureContent(feature: any): string {
  const parts: string[] = [];
  
  if (feature.name) parts.push(`Feature: ${feature.name}`);
  if (feature.description) parts.push(feature.description);
  if (feature.category) parts.push(`Category: ${feature.category}`);
  if (feature.tags?.length) parts.push(`Tags: ${feature.tags.join(', ')}`);
  if (feature.complexity) parts.push(`Complexity: ${feature.complexity}`);
  
  return parts.join('. ');
}

/**
 * Build searchable content from a part
 */
export function buildPartContent(part: any): string {
  const parts: string[] = [];
  
  if (part.name) parts.push(`Part: ${part.name}`);
  if (part.sku) parts.push(`SKU: ${part.sku}`);
  if (part.description) parts.push(part.description);
  if (part.category) parts.push(`Category: ${part.category}`);
  if (part.material) parts.push(`Material: ${part.material}`);
  if (part.dimensions) {
    parts.push(`Dimensions: ${part.dimensions.length}x${part.dimensions.width}x${part.dimensions.height}`);
  }
  
  return parts.join('. ');
}

// ============================================
// Full Collection Indexing
// ============================================

/**
 * Index all products from launchProducts collection
 */
export async function indexProducts(): Promise<{ indexed: number; errors: number }> {
  const productsRef = collection(db, 'launchProducts');
  const q = query(productsRef, where('currentStage', 'in', ['launched', 'ready', 'photoshoot', 'seo']));
  const snapshot = await getDocs(q);
  
  const documents: IndexableDocument[] = snapshot.docs.map(doc => ({
    id: doc.id,
    content: buildProductContent({ id: doc.id, ...doc.data() }),
    metadata: {
      name: doc.data().name,
      category: doc.data().category,
      currentStage: doc.data().currentStage,
    },
  }));
  
  return indexDocuments('launchProducts', documents);
}

/**
 * Index all design clips from designClips collection
 */
export async function indexClips(): Promise<{ indexed: number; errors: number }> {
  const clipsRef = collection(db, 'designClips');
  const q = query(clipsRef, orderBy('createdAt', 'desc'), limit(500));
  const snapshot = await getDocs(q);
  
  const documents: IndexableDocument[] = snapshot.docs.map(doc => ({
    id: doc.id,
    content: buildClipContent({ id: doc.id, ...doc.data() }),
    metadata: {
      title: doc.data().title,
      tags: doc.data().tags,
      imageUrl: doc.data().imageUrl,
    },
  }));
  
  return indexDocuments('designClips', documents);
}

/**
 * Index all features from features collection
 */
export async function indexFeatures(): Promise<{ indexed: number; errors: number }> {
  const featuresRef = collection(db, 'features');
  const q = query(featuresRef, where('status', '==', 'active'));
  const snapshot = await getDocs(q);
  
  const documents: IndexableDocument[] = snapshot.docs.map(doc => ({
    id: doc.id,
    content: buildFeatureContent({ id: doc.id, ...doc.data() }),
    metadata: {
      name: doc.data().name,
      category: doc.data().category,
      complexity: doc.data().complexity,
    },
  }));
  
  return indexDocuments('features', documents);
}

/**
 * Index all standard parts
 */
export async function indexParts(): Promise<{ indexed: number; errors: number }> {
  const partsRef = collection(db, 'standardParts');
  const snapshot = await getDocs(partsRef);
  
  const documents: IndexableDocument[] = snapshot.docs.map(doc => ({
    id: doc.id,
    content: buildPartContent({ id: doc.id, ...doc.data() }),
    metadata: {
      name: doc.data().name,
      sku: doc.data().sku,
      category: doc.data().category,
    },
  }));
  
  return indexDocuments('standardParts', documents);
}

/**
 * Re-index all collections
 */
export async function reindexAll(): Promise<Record<string, { indexed: number; errors: number }>> {
  const results: Record<string, { indexed: number; errors: number }> = {};

  results.launchProducts = await indexProducts();
  results.designClips = await indexClips();
  results.features = await indexFeatures();
  results.standardParts = await indexParts();
  results.inventoryItems = await indexInventoryItems();

  return results;
}

// ============================================
// Inventory Items — Search & Indexing
// ============================================

/**
 * Build searchable text content from an inventory item's fields.
 */
function buildInventoryItemContent(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.name) parts.push(`Item: ${data.name}`);
  if (data.displayName && data.displayName !== data.name) parts.push(`Display: ${data.displayName}`);
  if (data.sku) parts.push(`SKU: ${data.sku}`);
  if (data.category) parts.push(`Category: ${data.category}`);
  if (data.subcategory) parts.push(`Subcategory: ${data.subcategory}`);
  const sn = data.structuredName as Record<string, string> | undefined;
  if (sn?.function) parts.push(`Function: ${sn.function}`);
  if (sn?.keySpecs) parts.push(`Specs: ${sn.keySpecs}`);
  if (data.description) parts.push(`Description: ${data.description}`);
  const tags = data.tags as string[] | undefined;
  if (tags?.length) parts.push(`Tags: ${tags.join(', ')}`);
  const aliases = data.aliases as string[] | undefined;
  if (aliases?.length) parts.push(`Aliases: ${aliases.join(', ')}`);
  return parts.join('. ');
}

/**
 * Index all active inventory items for semantic search.
 */
export async function indexInventoryItems(): Promise<{ indexed: number; errors: number }> {
  const itemsRef = collection(db, 'inventoryItems');
  const q = query(itemsRef, where('status', '==', 'active'));
  const snapshot = await getDocs(q);

  const documents: IndexableDocument[] = snapshot.docs
    .filter(d => {
      const data = d.data();
      return !data.isFamily && data.isOrderable !== false;
    })
    .map(d => ({
      id: d.id,
      content: buildInventoryItemContent({ id: d.id, ...d.data() }),
      metadata: {
        name: d.data().name,
        sku: d.data().sku,
        category: d.data().category,
        subcategory: d.data().subcategory,
      },
    }));

  return indexDocuments('inventoryItems', documents);
}

/**
 * Search inventory items by semantic similarity.
 * Returns results in a shape compatible with SimilarInventoryItem.
 */
export async function searchInventoryBySimilarity(
  queryText: string,
  topK: number = 10,
): Promise<Array<{
  id: string;
  sku: string;
  name: string;
  displayName?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  unitCost: number;
  currency: string;
  unit: string;
  inStock: number;
  matchReason: string;
  score: number;
}>> {
  const results = await semanticSearch(queryText, ['inventoryItems'], topK, 0.5);

  // Fetch full item data for each match
  const items = await Promise.all(
    results.map(async (r) => {
      const snap = await getDoc(doc(db, 'inventoryItems', r.documentId));
      if (!snap.exists()) return null;
      const data = snap.data();
      const pricing = data.pricing as Record<string, unknown> | undefined;
      const inventory = data.inventory as Record<string, unknown> | undefined;
      return {
        id: snap.id,
        sku: (data.sku as string) ?? '',
        name: (data.name as string) ?? '',
        displayName: data.displayName as string | undefined,
        category: (data.category as string) ?? '',
        subcategory: data.subcategory as string | undefined,
        brand: data.brand as string | undefined,
        unitCost: (pricing?.costPerUnit as number) ?? 0,
        currency: (pricing?.currency as string) ?? 'UGX',
        unit: (pricing?.unit as string) ?? 'ea',
        inStock: (inventory?.inStock as number) ?? 0,
        matchReason: `AI similarity (${Math.round(r.similarity * 100)}%)`,
        score: r.similarity,
      };
    }),
  );

  return items.filter((i): i is NonNullable<typeof i> => i !== null);
}
