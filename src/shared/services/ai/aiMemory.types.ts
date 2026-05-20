/**
 * AI Memory System Types
 * DawinOS v2.0 - Persistent AI Memory Layer
 * 
 * Three-tier memory architecture:
 * 1. Conversation Memory — Full chat history persisted in Firestore
 * 2. Business Memory — Extracted facts, preferences, decisions
 * 3. Context Injection — Relevant memories fed into AI prompts
 * 
 * Collections:
 * - ai_conversations/{conversationId} — Persistent conversation history
 * - ai_memory/{memoryId} — Business knowledge entries
 */

// ============================================================================
// Business Memory Types
// ============================================================================

export type MemoryCategory =
  | 'business_fact'        // Company info, processes, capabilities
  | 'user_preference'      // Individual user preferences and patterns
  | 'project_insight'      // Learnings from specific projects
  | 'customer_intel'       // Customer preferences, history, relationships
  | 'process_knowledge'    // SOPs, workflows, best practices
  | 'decision_record'      // Key decisions and their rationale
  | 'market_intel'         // Market trends, competitor info
  | 'financial_insight';   // Financial patterns, pricing knowledge

export type MemoryImportance = 'critical' | 'high' | 'medium' | 'low';

export interface MemorySource {
  type: 'conversation' | 'document' | 'manual' | 'ai_extracted';
  refId?: string;          // ID of the source (conversationId, documentId, etc.)
  module?: string;         // Which module generated this memory
  extractedFrom?: string;  // Brief description of source context
}

export interface AIMemoryEntry {
  id: string;
  category: MemoryCategory;
  content: string;         // The actual knowledge/fact
  summary?: string;        // Short version for quick context injection
  tags: string[];
  importance: MemoryImportance;
  source: MemorySource;
  companyId: string;
  createdBy: string;       // userId
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
  expiresAt?: Date;        // Optional TTL
  isArchived: boolean;
  relatedEntityIds?: string[]; // projectIds, customerIds, etc.
  embedding?: number[];    // For semantic search (future)
}

export interface AIMemoryFormData {
  category: MemoryCategory;
  content: string;
  summary?: string;
  tags: string[];
  importance: MemoryImportance;
  source: MemorySource;
  relatedEntityIds?: string[];
  expiresAt?: Date;
}

// ============================================================================
// Conversation Memory Types
// ============================================================================

export type ConversationModule =
  | 'assistant'            // Main AI assistant panel
  | 'strategy_research'    // Strategy research tool
  | 'strategy_review'      // Strategy review assistant
  | 'design_enhancement'   // Design item enhancement
  | 'project_scoping'      // Project scoping AI
  | 'image_analysis'       // Image analysis
  | 'advisory'             // Advisory platform agent
  | 'customer_intel';      // Customer intelligence

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: string;           // Assistant mode (general, data_analyst, etc.)
  sources?: Array<{ url: string; title: string; domain?: string }>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface AIConversation {
  id: string;
  userId: string;
  companyId: string;
  module: ConversationModule;
  mode?: string;           // Current assistant mode
  title: string;
  messages: ConversationMessage[];
  context?: Record<string, unknown>;
  memoryExtractionDone: boolean;  // Whether memories have been extracted
  projectId?: string;
  designItemId?: string;
  customerId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  isArchived: boolean;
}

export interface AIConversationFormData {
  module: ConversationModule;
  mode?: string;
  title: string;
  context?: Record<string, unknown>;
  projectId?: string;
  designItemId?: string;
  customerId?: string;
}

// ============================================================================
// Context Injection Types
// ============================================================================

export interface MemoryContext {
  memories: AIMemoryEntry[];
  recentConversationSummary?: string;
  totalMemories: number;
  relevanceScores?: Map<string, number>;
}

export interface ContextInjectionRequest {
  companyId: string;
  userId: string;
  module: ConversationModule;
  query?: string;          // Current user message for relevance matching
  categories?: MemoryCategory[];
  maxMemories?: number;
  includeConversationHistory?: boolean;
  projectId?: string;
  customerId?: string;
}

// ============================================================================
// Memory Extraction Types (used by backend)
// ============================================================================

export interface MemoryExtractionResult {
  memories: AIMemoryFormData[];
  conversationSummary: string;
  keyTopics: string[];
}

export interface MemorySearchParams {
  companyId: string;
  categories?: MemoryCategory[];
  tags?: string[];
  importance?: MemoryImportance[];
  query?: string;
  relatedEntityId?: string;
  limit?: number;
  includeArchived?: boolean;
}
