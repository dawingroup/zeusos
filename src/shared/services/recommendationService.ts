/**
 * Universal Recommendation Service
 * Provides contextual recommendations for products, parts, and inspirations
 * across the application to help users reduce errors and omissions
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

// ============================================
// Types
// ============================================

export type RecommendationType = 'product' | 'part' | 'inspiration' | 'feature';

export type RecommendationContext = 
  | 'design-item'
  | 'strategy-canvas'
  | 'project-scoping'
  | 'parts-list'
  | 'procurement'
  | 'cutlist'
  | 'general';

export interface RecommendationItem {
  id: string;
  type: RecommendationType;
  name: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  relevanceScore: number;
  matchReason: string;
  metadata?: Record<string, unknown>;
  source: string; // Collection or source name
}

export interface RecommendationQuery {
  context: RecommendationContext;
  searchText?: string;
  keywords?: string[];
  category?: string;
  projectType?: string;
  materials?: string[];
  style?: string;
  budgetTier?: string;
  designItemId?: string;
  projectId?: string;
  limit?: number;
}

export interface ContextualRecommendations {
  products: RecommendationItem[];
  parts: RecommendationItem[];
  inspirations: RecommendationItem[];
  features: RecommendationItem[];
  suggestedActions?: string[];
}

// ============================================
// Search Functions
// ============================================

/**
 * Get contextual recommendations based on the current user context
 */
export async function getContextualRecommendations(
  queryParams: RecommendationQuery
): Promise<ContextualRecommendations> {
  const results: ContextualRecommendations = {
    products: [],
    parts: [],
    inspirations: [],
    features: [],
    suggestedActions: [],
  };

  const maxResults = queryParams.limit || 5;

  try {
    // Run searches in parallel for better performance
    const [products, parts, inspirations, features] = await Promise.all([
      searchProducts(queryParams, maxResults),
      searchParts(queryParams, maxResults),
      searchInspirations(queryParams, maxResults),
      searchFeatures(queryParams, maxResults),
    ]);

    results.products = products;
    results.parts = parts;
    results.inspirations = inspirations;
    results.features = features;

    // Generate suggested actions based on context
    results.suggestedActions = generateSuggestedActions(queryParams, results);
  } catch (error) {
    console.error('Recommendation service error:', error);
  }

  return results;
}

/**
 * Search products from launch pipeline
 */
async function searchProducts(
  queryParams: RecommendationQuery,
  maxResults: number
): Promise<RecommendationItem[]> {
  try {
    const q = query(
      collection(db, 'launchProducts'),
      where('currentStage', 'in', ['launched', 'ready', 'photoshoot', 'seo']),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Score and filter based on query
    const searchTerms = buildSearchTerms(queryParams);
    
    return products
      .map(product => scoreProduct(product, searchTerms, queryParams))
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

/**
 * Search parts from standard parts list
 */
async function searchParts(
  queryParams: RecommendationQuery,
  maxResults: number
): Promise<RecommendationItem[]> {
  try {
    // Query parts collection (or standardParts if that's the collection name)
    const collections = ['standardParts', 'partsCatalog'];
    let allParts: any[] = [];

    for (const collectionName of collections) {
      try {
        const q = query(
          collection(db, collectionName),
          orderBy('name'),
          limit(50)
        );
        const snapshot = await getDocs(q);
        allParts = allParts.concat(
          snapshot.docs.map(doc => ({
            id: doc.id,
            collectionSource: collectionName,
            ...doc.data(),
          }))
        );
      } catch {
        // Collection might not exist, continue
      }
    }

    const searchTerms = buildSearchTerms(queryParams);
    
    return allParts
      .map(part => scorePart(part, searchTerms, queryParams))
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  } catch (error) {
    console.error('Parts search error:', error);
    return [];
  }
}

/**
 * Search inspirations from design clips
 */
async function searchInspirations(
  queryParams: RecommendationQuery,
  maxResults: number
): Promise<RecommendationItem[]> {
  try {
    const q = query(
      collection(db, 'designClips'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const clips = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const searchTerms = buildSearchTerms(queryParams);
    
    return clips
      .map(clip => scoreInspiration(clip, searchTerms, queryParams))
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  } catch (error) {
    console.error('Inspiration search error:', error);
    return [];
  }
}

/**
 * Search features from feature library
 */
async function searchFeatures(
  queryParams: RecommendationQuery,
  maxResults: number
): Promise<RecommendationItem[]> {
  try {
    const q = query(
      collection(db, 'features'),
      where('status', '==', 'active'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const features = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const searchTerms = buildSearchTerms(queryParams);
    
    return features
      .map(feature => scoreFeature(feature, searchTerms, queryParams))
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  } catch (error) {
    console.error('Feature search error:', error);
    return [];
  }
}

// ============================================
// Scoring Functions
// ============================================

function buildSearchTerms(queryParams: RecommendationQuery): string[] {
  const terms: string[] = [];
  
  if (queryParams.searchText) {
    terms.push(...queryParams.searchText.toLowerCase().split(/\s+/));
  }
  if (queryParams.keywords) {
    terms.push(...queryParams.keywords.map(k => k.toLowerCase()));
  }
  if (queryParams.category) {
    terms.push(queryParams.category.toLowerCase());
  }
  if (queryParams.projectType) {
    terms.push(queryParams.projectType.toLowerCase());
  }
  if (queryParams.materials) {
    terms.push(...queryParams.materials.map(m => m.toLowerCase()));
  }
  if (queryParams.style) {
    terms.push(queryParams.style.toLowerCase());
  }
  
  return [...new Set(terms)].filter(Boolean);
}

function scoreProduct(product: any, searchTerms: string[], queryParams: RecommendationQuery): RecommendationItem {
  let score = 0;
  const matchReasons: string[] = [];

  const name = (product.name || '').toLowerCase();
  const description = (product.description || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  const tags = (product.tags || []).map((t: string) => t.toLowerCase());
  const materials = (product.specifications?.materials || []).map((m: string) => m.toLowerCase());

  for (const term of searchTerms) {
    if (name.includes(term)) {
      score += 10;
      matchReasons.push('Name match');
    }
    if (category.includes(term)) {
      score += 8;
      matchReasons.push('Category match');
    }
    if (description.includes(term)) {
      score += 5;
      matchReasons.push('Description match');
    }
    if (tags.some((t: string) => t.includes(term))) {
      score += 6;
      matchReasons.push('Tag match');
    }
    if (materials.some((m: string) => m.includes(term))) {
      score += 7;
      matchReasons.push('Material match');
    }
  }

  // Context-specific boosts
  if (queryParams.context === 'strategy-canvas') {
    score += 2; // Products are highly relevant in strategy
  }

  const deliverable = product.deliverables?.find((d: any) => 
    d.type === 'hero-image' || d.type === 'product-photos'
  );

  return {
    id: product.id,
    type: 'product',
    name: product.name || 'Unnamed Product',
    description: product.description,
    category: product.category,
    imageUrl: deliverable?.url,
    relevanceScore: score,
    matchReason: matchReasons[0] || 'Related product',
    source: 'launchProducts',
    metadata: {
      materials: product.specifications?.materials,
      features: product.specifications?.features,
    },
  };
}

function scorePart(part: any, searchTerms: string[], queryParams: RecommendationQuery): RecommendationItem {
  let score = 0;
  const matchReasons: string[] = [];

  const name = (part.name || '').toLowerCase();
  const description = (part.description || '').toLowerCase();
  const category = (part.category || '').toLowerCase();
  const sku = (part.sku || '').toLowerCase();
  const material = (part.material || '').toLowerCase();

  for (const term of searchTerms) {
    if (name.includes(term)) {
      score += 10;
      matchReasons.push('Name match');
    }
    if (sku.includes(term)) {
      score += 8;
      matchReasons.push('SKU match');
    }
    if (category.includes(term)) {
      score += 7;
      matchReasons.push('Category match');
    }
    if (material.includes(term)) {
      score += 8;
      matchReasons.push('Material match');
    }
    if (description.includes(term)) {
      score += 4;
      matchReasons.push('Description match');
    }
  }

  // Context-specific boosts
  if (queryParams.context === 'parts-list' || queryParams.context === 'cutlist') {
    score += 3;
  }

  return {
    id: part.id,
    type: 'part',
    name: part.name || 'Unnamed Part',
    description: part.description,
    category: part.category,
    relevanceScore: score,
    matchReason: matchReasons[0] || 'Related part',
    source: part.collectionSource || 'standardParts',
    metadata: {
      sku: part.sku,
      material: part.material,
      dimensions: part.dimensions,
      unitPrice: part.unitPrice,
    },
  };
}

function scoreInspiration(clip: any, searchTerms: string[], queryParams: RecommendationQuery): RecommendationItem {
  let score = 0;
  const matchReasons: string[] = [];

  const title = (clip.title || '').toLowerCase();
  const notes = (clip.notes || '').toLowerCase();
  const tags = (clip.tags || []).map((t: string) => t.toLowerCase());
  for (const term of searchTerms) {
    if (title.includes(term)) {
      score += 10;
      matchReasons.push('Title match');
    }
    if (notes.includes(term)) {
      score += 5;
      matchReasons.push('Notes match');
    }
    if (tags.some((t: string) => t.includes(term))) {
      score += 7;
      matchReasons.push('Tag match');
    }
  }

  // Context-specific boosts
  if (queryParams.context === 'design-item' || queryParams.context === 'strategy-canvas') {
    score += 2;
  }

  return {
    id: clip.id,
    type: 'inspiration',
    name: clip.title || 'Inspiration',
    description: clip.notes,
    imageUrl: clip.imageUrl || clip.thumbnailUrl,
    relevanceScore: score,
    matchReason: matchReasons[0] || 'Related inspiration',
    source: 'designClips',
    metadata: {
      sourceUrl: clip.sourceUrl,
      tags: clip.tags,
    },
  };
}

function scoreFeature(feature: any, searchTerms: string[], queryParams: RecommendationQuery): RecommendationItem {
  let score = 0;
  const matchReasons: string[] = [];

  const name = (feature.name || '').toLowerCase();
  const description = (feature.description || '').toLowerCase();
  const category = (feature.category || '').toLowerCase();
  const tags = (feature.tags || []).map((t: string) => t.toLowerCase());

  for (const term of searchTerms) {
    if (name.includes(term)) {
      score += 10;
      matchReasons.push('Name match');
    }
    if (category.includes(term)) {
      score += 8;
      matchReasons.push('Category match');
    }
    if (description.includes(term)) {
      score += 5;
      matchReasons.push('Description match');
    }
    if (tags.some((t: string) => t.includes(term))) {
      score += 6;
      matchReasons.push('Tag match');
    }
  }

  // Context-specific boosts
  if (queryParams.context === 'design-item') {
    score += 3;
  }

  return {
    id: feature.id,
    type: 'feature',
    name: feature.name || 'Unnamed Feature',
    description: feature.description,
    category: feature.category,
    relevanceScore: score,
    matchReason: matchReasons[0] || 'Related feature',
    source: 'features',
    metadata: {
      estimatedMinutes: feature.estimatedMinutes,
      complexity: feature.complexity,
      requiredAssets: feature.requiredAssetIds,
    },
  };
}

// ============================================
// Suggested Actions
// ============================================

function generateSuggestedActions(
  queryParams: RecommendationQuery,
  results: ContextualRecommendations
): string[] {
  const actions: string[] = [];

  switch (queryParams.context) {
    case 'design-item':
      if (results.inspirations.length > 0) {
        actions.push('Review similar inspirations for design ideas');
      }
      if (results.features.length > 0) {
        actions.push('Consider adding recommended features');
      }
      if (results.parts.length === 0) {
        actions.push('Add parts list to complete item specification');
      }
      break;

    case 'strategy-canvas':
      if (results.products.length > 0) {
        actions.push('Include recommended products in proposal');
      }
      if (results.inspirations.length > 0) {
        actions.push('Use inspirations to communicate design direction');
      }
      break;

    case 'parts-list':
      if (results.parts.length > 0) {
        actions.push('Review standard parts for consistency');
      }
      actions.push('Verify all hardware is included');
      actions.push('Check material specifications match design');
      break;

    case 'procurement':
      actions.push('Verify supplier availability');
      actions.push('Check lead times for critical items');
      break;

    case 'cutlist':
      actions.push('Verify material dimensions');
      actions.push('Check grain direction requirements');
      break;
  }

  return actions;
}

// ============================================
// Quick Search (for typeahead/autocomplete)
// ============================================

export async function quickSearch(
  searchText: string,
  types: RecommendationType[] = ['product', 'part', 'inspiration', 'feature'],
  maxResults = 10
): Promise<RecommendationItem[]> {
  const results = await getContextualRecommendations({
    context: 'general',
    searchText,
    limit: maxResults,
  });

  const allItems: RecommendationItem[] = [];
  
  if (types.includes('product')) allItems.push(...results.products);
  if (types.includes('part')) allItems.push(...results.parts);
  if (types.includes('inspiration')) allItems.push(...results.inspirations);
  if (types.includes('feature')) allItems.push(...results.features);

  return allItems
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

// ============================================
// Context-Specific Recommendations
// ============================================

/**
 * Get recommendations for a specific design item
 */
export async function getDesignItemRecommendations(
  designItem: {
    name: string;
    category?: string;
    description?: string;
    materials?: string[];
    projectType?: string;
  }
): Promise<ContextualRecommendations> {
  return getContextualRecommendations({
    context: 'design-item',
    searchText: designItem.name,
    keywords: [
      designItem.category,
      ...(designItem.materials || []),
    ].filter(Boolean) as string[],
    category: designItem.category,
    projectType: designItem.projectType,
    materials: designItem.materials,
  });
}

/**
 * Get recommendations for strategy canvas
 */
export async function getStrategyRecommendations(
  strategyContext: {
    projectType?: string;
    style?: string;
    materials?: string[];
    budgetTier?: string;
    keywords?: string[];
  }
): Promise<ContextualRecommendations> {
  return getContextualRecommendations({
    context: 'strategy-canvas',
    keywords: strategyContext.keywords,
    projectType: strategyContext.projectType,
    style: strategyContext.style,
    materials: strategyContext.materials,
    budgetTier: strategyContext.budgetTier,
  });
}

/**
 * Get recommendations for parts list
 */
export async function getPartsRecommendations(
  partsContext: {
    itemName: string;
    category?: string;
    existingParts?: string[];
  }
): Promise<ContextualRecommendations> {
  return getContextualRecommendations({
    context: 'parts-list',
    searchText: partsContext.itemName,
    category: partsContext.category,
    keywords: partsContext.existingParts,
  });
}
