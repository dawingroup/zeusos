/**
 * AI Services Export
 * RAG Framework components for semantic search and context injection
 */

// Semantic Search
export {
  generateEmbedding,
  generateEmbeddings,
  semanticSearch,
  searchCollection,
  indexDocument,
  indexDocuments,
  indexProducts,
  indexClips,
  indexFeatures,
  indexParts,
  reindexAll,
  cosineSimilarity,
  buildProductContent,
  buildClipContent,
  buildFeatureContent,
  buildPartContent,
  type EmbeddingDocument,
  type SemanticSearchResult,
  type IndexableDocument,
  type IndexableCollection,
} from './semanticSearchService';

// AI Memory System
export type {
  MemoryCategory,
  MemoryImportance,
  MemorySource,
  AIMemoryEntry,
  AIMemoryFormData,
  ConversationModule,
  ConversationMessage,
  AIConversation,
  AIConversationFormData,
  MemoryContext,
  ContextInjectionRequest,
  MemoryExtractionResult,
  MemorySearchParams,
} from './aiMemory.types';

export {
  createMemory,
  createMemories,
  getMemory,
  searchMemories,
  getRecentMemories,
  getMemoriesByCategory,
  updateMemory,
  recordMemoryAccess,
  archiveMemory,
  deleteMemory,
  subscribeToMemories,
  createConversation,
  getConversation,
  getOrCreateConversation,
  addConversationMessage,
  getRecentConversations,
  subscribeToConversation,
  archiveConversation,
  startNewConversation,
  buildMemoryContext,
  formatMemoryForPrompt,
} from './aiMemory.service';

// Knowledge Base
export {
  retrieveContext,
  retrieveContextCached,
  retrieveStrategyContext,
  retrieveDesignItemContext,
  formatContextForPrompt,
  formatContextAsJSON,
  hybridSearch,
  clearContextCache,
  recordSelection,
  type KnowledgeContext,
  type ContextItem,
  type ProjectHistoryItem,
  type StrategyExcerpt,
  type ContextInjectionConfig,
  type FeedbackEntry,
} from './knowledgeBaseService';
