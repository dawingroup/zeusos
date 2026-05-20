/**
 * Knowledge Base Service
 * Provides context retrieval and injection for AI prompts
 * Part of the RAG (Retrieval Augmented Generation) framework
 */

import {
  semanticSearch,
  type IndexableCollection,
} from './semanticSearchService';
import {
  getContextualRecommendations,
} from '../recommendationService';

// ============================================
// Types
// ============================================

export interface KnowledgeContext {
  products: ContextItem[];
  inspirations: ContextItem[];
  features: ContextItem[];
  parts: ContextItem[];
  projectHistory?: ProjectHistoryItem[];
  relevantStrategies?: StrategyExcerpt[];
}

export interface ContextItem {
  id: string;
  name: string;
  description: string;
  relevance: number;
  source: string;
  /** Optional kind/category of context item (used in feedback logging) */
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectHistoryItem {
  projectId: string;
  projectName: string;
  projectType: string;
  completedDate?: string;
  relevance: number;
}

export interface StrategyExcerpt {
  projectId: string;
  excerpt: string;
  category: string;
  relevance: number;
}

export interface ContextInjectionConfig {
  maxProducts?: number;
  maxInspirations?: number;
  maxFeatures?: number;
  maxParts?: number;
  includeProjectHistory?: boolean;
  includeStrategies?: boolean;
  minRelevance?: number;
}

const DEFAULT_CONFIG: ContextInjectionConfig = {
  maxProducts: 5,
  maxInspirations: 3,
  maxFeatures: 3,
  maxParts: 5,
  includeProjectHistory: false,
  includeStrategies: false,
  minRelevance: 0.5,
};

// ============================================
// Context Retrieval
// ============================================

/**
 * Retrieve relevant knowledge context based on query
 */
export async function retrieveContext(
  query: string,
  config: ContextInjectionConfig = {}
): Promise<KnowledgeContext> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Search across all collections
  const searchResults = await semanticSearch(
    query,
    ['launchProducts', 'designClips', 'features', 'standardParts'],
    20,
    mergedConfig.minRelevance
  );
  
  // Group results by collection
  const context: KnowledgeContext = {
    products: [],
    inspirations: [],
    features: [],
    parts: [],
  };
  
  for (const result of searchResults) {
    const item: ContextItem = {
      id: result.documentId,
      name: result.metadata.name as string || result.documentId,
      description: result.content.substring(0, 200),
      relevance: result.similarity,
      source: result.collectionName,
      metadata: result.metadata,
    };
    
    switch (result.collectionName) {
      case 'launchProducts':
        if (context.products.length < (mergedConfig.maxProducts || 5)) {
          context.products.push(item);
        }
        break;
      case 'designClips':
        if (context.inspirations.length < (mergedConfig.maxInspirations || 3)) {
          context.inspirations.push(item);
        }
        break;
      case 'features':
        if (context.features.length < (mergedConfig.maxFeatures || 3)) {
          context.features.push(item);
        }
        break;
      case 'standardParts':
        if (context.parts.length < (mergedConfig.maxParts || 5)) {
          context.parts.push(item);
        }
        break;
    }
  }
  
  return context;
}

/**
 * Retrieve context specifically for strategy research
 */
export async function retrieveStrategyContext(
  projectType: string,
  stylePreferences: string[],
  materials: string[],
  keywords: string[]
): Promise<KnowledgeContext> {
  // Build comprehensive query from project details
  const queryParts = [
    projectType,
    ...stylePreferences,
    ...materials,
    ...keywords,
  ].filter(Boolean);
  
  const query = queryParts.join(' ');
  
  return retrieveContext(query, {
    maxProducts: 8,
    maxInspirations: 5,
    maxFeatures: 5,
    maxParts: 3,
    includeStrategies: true,
  });
}

/**
 * Retrieve context for design item enhancement
 */
export async function retrieveDesignItemContext(
  itemName: string,
  category: string,
  description?: string
): Promise<KnowledgeContext> {
  const query = [itemName, category, description].filter(Boolean).join(' ');
  
  return retrieveContext(query, {
    maxProducts: 3,
    maxInspirations: 5,
    maxFeatures: 5,
    maxParts: 8,
  });
}

// ============================================
// Context Formatting for AI Prompts
// ============================================

/**
 * Format knowledge context as structured text for AI prompt injection
 */
export function formatContextForPrompt(context: KnowledgeContext): string {
  const sections: string[] = [];
  
  // Products section
  if (context.products.length > 0) {
    sections.push('## Relevant Products from Catalog');
    sections.push('The following products from our catalog may be relevant to this project:');
    for (const product of context.products) {
      sections.push(`- **${product.name}** (${Math.round(product.relevance * 100)}% match)`);
      sections.push(`  ${product.description}`);
      if (product.metadata?.category) {
        sections.push(`  Category: ${product.metadata.category}`);
      }
    }
    sections.push('');
  }
  
  // Inspirations section
  if (context.inspirations.length > 0) {
    sections.push('## Design Inspirations');
    sections.push('These saved inspirations may be relevant:');
    for (const inspiration of context.inspirations) {
      sections.push(`- **${inspiration.name}** (${Math.round(inspiration.relevance * 100)}% match)`);
      sections.push(`  ${inspiration.description}`);
    }
    sections.push('');
  }
  
  // Features section
  if (context.features.length > 0) {
    sections.push('## Available Features');
    sections.push('These standard features could be incorporated:');
    for (const feature of context.features) {
      sections.push(`- **${feature.name}** (${Math.round(feature.relevance * 100)}% match)`);
      sections.push(`  ${feature.description}`);
      if (feature.metadata?.complexity) {
        sections.push(`  Complexity: ${feature.metadata.complexity}`);
      }
    }
    sections.push('');
  }
  
  // Parts section
  if (context.parts.length > 0) {
    sections.push('## Standard Parts Available');
    sections.push('These parts from our catalog may be needed:');
    for (const part of context.parts) {
      sections.push(`- **${part.name}** (${Math.round(part.relevance * 100)}% match)`);
      if (part.metadata?.sku) {
        sections.push(`  SKU: ${part.metadata.sku}`);
      }
      sections.push(`  ${part.description}`);
    }
    sections.push('');
  }
  
  // Project history section
  if (context.projectHistory && context.projectHistory.length > 0) {
    sections.push('## Similar Past Projects');
    for (const project of context.projectHistory) {
      sections.push(`- **${project.projectName}** (${project.projectType})`);
      if (project.completedDate) {
        sections.push(`  Completed: ${project.completedDate}`);
      }
    }
    sections.push('');
  }
  
  return sections.join('\n');
}

/**
 * Format context as JSON for structured AI responses
 */
export function formatContextAsJSON(context: KnowledgeContext): object {
  return {
    availableProducts: context.products.map(p => ({
      id: p.id,
      name: p.name,
      relevance: p.relevance,
      category: p.metadata?.category,
    })),
    inspirations: context.inspirations.map(i => ({
      id: i.id,
      title: i.name,
      relevance: i.relevance,
    })),
    features: context.features.map(f => ({
      id: f.id,
      name: f.name,
      relevance: f.relevance,
      complexity: f.metadata?.complexity,
    })),
    parts: context.parts.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.metadata?.sku,
      relevance: p.relevance,
    })),
  };
}

// ============================================
// Hybrid Search (Semantic + Keyword)
// ============================================

/**
 * Perform hybrid search combining semantic and keyword results
 */
export async function hybridSearch(
  query: string,
  collections: IndexableCollection[],
  topK: number = 10
): Promise<ContextItem[]> {
  // Get semantic search results
  const semanticResults = await semanticSearch(query, collections, topK);
  
  // Get keyword-based recommendations
  const keywordRecommendations = await getContextualRecommendations({
    context: 'general',
    searchText: query,
    limit: topK,
  });
  
  // Merge and deduplicate results
  const resultMap = new Map<string, ContextItem>();
  
  // Add semantic results
  for (const result of semanticResults) {
    resultMap.set(result.documentId, {
      id: result.documentId,
      name: result.metadata.name as string || result.documentId,
      description: result.content.substring(0, 200),
      relevance: result.similarity,
      source: result.collectionName,
      metadata: result.metadata,
    });
  }
  
  // Merge keyword results (boost if already present)
  const allKeywordItems = [
    ...keywordRecommendations.products,
    ...keywordRecommendations.inspirations,
    ...keywordRecommendations.features,
    ...keywordRecommendations.parts,
  ];
  
  for (const item of allKeywordItems) {
    const existing = resultMap.get(item.id);
    if (existing) {
      // Boost relevance for items found in both searches
      existing.relevance = Math.min(1, existing.relevance + (item.relevanceScore / 100) * 0.3);
    } else {
      resultMap.set(item.id, {
        id: item.id,
        name: item.name,
        description: item.description || '',
        relevance: item.relevanceScore / 100,
        source: item.source,
        metadata: item.metadata,
      });
    }
  }
  
  // Sort by relevance and return top K
  return Array.from(resultMap.values())
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, topK);
}

// ============================================
// Context Caching
// ============================================

const contextCache = new Map<string, { context: KnowledgeContext; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieve context with caching
 */
export async function retrieveContextCached(
  query: string,
  config: ContextInjectionConfig = {}
): Promise<KnowledgeContext> {
  const cacheKey = `${query}_${JSON.stringify(config)}`;
  const cached = contextCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.context;
  }
  
  const context = await retrieveContext(query, config);
  contextCache.set(cacheKey, { context, timestamp: Date.now() });
  
  return context;
}

/**
 * Clear context cache
 */
export function clearContextCache(): void {
  contextCache.clear();
}

// ============================================
// Feedback Loop
// ============================================

export interface FeedbackEntry {
  queryId: string;
  query: string;
  selectedItemId: string;
  selectedItemType: 'product' | 'inspiration' | 'feature' | 'part';
  wasHelpful: boolean;
  timestamp: Date;
}

/**
 * Record user selection for feedback loop learning
 * This data can be used to improve future recommendations
 */
export async function recordSelection(
  query: string,
  selectedItem: ContextItem,
  wasHelpful: boolean = true
): Promise<void> {
  try {
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');
    const { db } = await import('../../../firebase/config');

    await addDoc(collection(db, 'ai_feedback'), {
      query,
      selectedItemId: selectedItem.id,
      selectedItemType: selectedItem.type,
      selectedItemName: selectedItem.name,
      wasHelpful,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    // Non-critical — log but don't block the user
    console.warn('Failed to record AI selection feedback:', error);
  }
}
