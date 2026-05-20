// src/subsidiaries/advisory/ai/types/agent.ts

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Domain Types
// ============================================================================

export type AgentDomain = 
  | 'general'
  | 'infrastructure'
  | 'investment'
  | 'advisory'
  | 'matflow'
  | 'analytics'
  | 'settings';

export interface DomainContext {
  domain: AgentDomain;
  confidence: number; // 0-1
  detectedEntities: DetectedEntity[];
  sessionContext: SessionContext;
  domainParams?: Record<string, unknown>;
}

export interface SessionContext {
  userId: string;
  organizationId: string;
  currentModule?: string;
  currentPage?: string;
  currentEntityId?: string;
  currentEntityType?: string;
  recentEntities: RecentEntity[];
  preferences: UserAIPreferences;
}

export interface UserAIPreferences {
  preferredLanguage: 'en' | 'sw';
  responseLength: 'concise' | 'detailed';
  autoExecuteActions: boolean;
  showConfidenceScores: boolean;
  enabledDomains: AgentDomain[];
  defaultCurrency: string;
  timezone: string;
}

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 
  | 'project'
  | 'engagement'
  | 'deal'
  | 'portfolio'
  | 'investment'
  | 'facility'
  | 'requisition'
  | 'purchase_order'
  | 'supplier'
  | 'material'
  | 'boq'
  | 'person'
  | 'organization'
  | 'date'
  | 'currency'
  | 'amount'
  | 'percentage';

export interface DetectedEntity {
  type: EntityType;
  value: string;
  id?: string; // Resolved entity ID
  confidence: number;
  position: {
    start: number;
    end: number;
  };
  metadata?: Record<string, unknown>;
}

export interface RecentEntity {
  type: EntityType;
  id: string;
  name: string;
  module: string;
  accessedAt: Timestamp;
}

// ============================================================================
// Conversation Types
// ============================================================================

export interface AgentConversation {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  status: 'active' | 'archived';
  currentDomain: AgentDomain;
  domainHistory: DomainSwitch[];
  linkedEntities: LinkedEntity[];
  messageCount: number;
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DomainSwitch {
  from: AgentDomain;
  to: AgentDomain;
  triggeredBy: string; // Message ID
  timestamp: Timestamp;
}

export interface LinkedEntity {
  type: EntityType;
  id: string;
  name: string;
  domain: AgentDomain;
  mentionCount: number;
  firstMentionedAt: Timestamp;
  lastMentionedAt: Timestamp;
}

export interface AgentMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  richContent?: RichContent[];
  domain: AgentDomain;
  domainContext?: DomainContext;
  entities: DetectedEntity[];
  actions: AgentAction[];
  model?: string;
  tokenUsage?: TokenUsage;
  processingTimeMs?: number;
  createdAt: Timestamp;
}

export interface RichContent {
  type: 'text' | 'table' | 'chart' | 'entity_link' | 'action_button' | 'code';
  data: unknown;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionType = 
  | 'navigate'
  | 'open_entity'
  | 'search'
  | 'create'
  | 'update'
  | 'delete'
  | 'submit_approval'
  | 'approve'
  | 'reject'
  | 'generate_report'
  | 'analyze_data'
  | 'compare_entities'
  | 'send_notification'
  | 'schedule_meeting'
  | 'parse_boq'
  | 'create_requisition'
  | 'generate_po'
  | 'custom';

export interface AgentAction {
  id: string;
  type: ActionType;
  label: string;
  description?: string;
  params: Record<string, unknown>;
  status: 'suggested' | 'confirmed' | 'executed' | 'failed';
  executedAt?: Timestamp;
  result?: unknown;
  error?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export type GeminiModel = 
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-pro-latest'
  | 'gemini-2.0-flash'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro';

export interface AgentConfig {
  model: GeminiModel;
  temperature: number;
  maxTokens: number;
  enabledDomains: AgentDomain[];
  defaultDomain: AgentDomain;
  features: {
    enableActions: boolean;
    enableEntityLinking: boolean;
    enableCrossModuleQueries: boolean;
    enableStreaming: boolean;
  };
  safety: {
    blockHarmfulContent: boolean;
    requireConfirmation: ActionType[];
  };
  rateLimit: {
    maxMessagesPerMinute: number;
    maxTokensPerDay: number;
  };
}

export interface DomainHandler {
  domain: AgentDomain;
  name: string;
  description: string;
  keywords: string[];
  patterns: RegExp[];
  entityTypes: EntityType[];
  systemPrompt: string;
  tools: AgentTool[];
  capabilities: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canAnalyze: boolean;
  };
}

export interface AgentTool {
  name: string;
  description: string;
  domain: AgentDomain;
  functionDeclaration: FunctionDeclaration;
  handler: string; // Function name in tool executor
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required?: string[];
  };
}

export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ParameterSchema;
}

// ============================================================================
// Event Types
// ============================================================================

export interface AIEvent {
  type: 'message_sent' | 'message_received' | 'action_executed' | 'domain_switched' | 'error';
  conversationId: string;
  messageId?: string;
  data: unknown;
  timestamp: Timestamp;
}

export interface AIError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}
