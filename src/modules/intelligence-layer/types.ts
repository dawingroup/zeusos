// ============================================================================
// INTELLIGENCE LAYER TYPES
// DawinOS v2.0 - Cross-Module AI Intelligence
// TypeScript interfaces and types
// ============================================================================

import type {
  SuggestionType,
  AnomalySeverityId,
  SourceModuleId,
  IntelligenceFeatureId,
  AssistantModeId,
} from './constants';

// ============================================================================
// SMART SUGGESTIONS
// ============================================================================

export interface SmartSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  sourceModule: SourceModuleId;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  actionLabel?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  context?: SuggestionContext;
  status: 'pending' | 'accepted' | 'dismissed' | 'expired';
  createdAt: Date;
  expiresAt?: Date;
  acceptedAt?: Date;
  dismissedAt?: Date;
}

export interface SuggestionContext {
  entityType: string;
  entityId: string;
  entityName: string;
  relatedEntities?: Array<{
    type: string;
    id: string;
    name: string;
  }>;
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export interface Anomaly {
  id: string;
  type: string;
  severity: AnomalySeverityId;
  title: string;
  description: string;
  sourceModule: SourceModuleId;
  detectedAt: Date;
  metric?: AnomalyMetric;
  affectedEntities?: AffectedEntity[];
  suggestedActions?: string[];
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export interface AnomalyMetric {
  name: string;
  expectedValue: number;
  actualValue: number;
  deviation: number; // percentage
  threshold: number;
  historicalAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface AffectedEntity {
  type: string;
  id: string;
  name: string;
  impact: 'direct' | 'indirect';
}

// ============================================================================
// PREDICTIVE ANALYTICS
// ============================================================================

export interface Prediction {
  id: string;
  type: string;
  title: string;
  description: string;
  sourceModule: SourceModuleId;
  targetDate: Date;
  predictedValue: number;
  confidence: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  factors: PredictionFactor[];
  historicalAccuracy?: number;
  status: 'active' | 'validated' | 'invalidated' | 'expired';
  createdAt: Date;
  validatedAt?: Date;
  actualValue?: number;
}

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number; // 0-1
  description: string;
}

export interface PredictionScenario {
  id: string;
  name: string;
  description: string;
  assumptions: string[];
  predictions: Prediction[];
  probability: number;
}

// ============================================================================
// DOCUMENT INTELLIGENCE
// ============================================================================

export interface DocumentAnalysis {
  id: string;
  documentId: string;
  documentName: string;
  documentType: string;
  analyzedAt: Date;
  summary: string;
  keyPoints: string[];
  entities: ExtractedEntity[];
  sentiment?: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
  };
  topics: string[];
  recommendations?: string[];
  confidence: number;
}

export interface ExtractedEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'percentage' | 'custom';
  value: string;
  context: string;
  confidence: number;
}

// ============================================================================
// NATURAL LANGUAGE QUERY
// ============================================================================

export interface NLQuery {
  id: string;
  query: string;
  interpretedIntent: string;
  targetModule: SourceModuleId;
  parameters: Record<string, any>;
  response: NLQueryResponse;
  createdAt: Date;
  processingTime: number; // ms
}

export interface NLQueryResponse {
  type: 'data' | 'chart' | 'list' | 'summary' | 'action' | 'error';
  content: any;
  explanation: string;
  confidence: number;
  suggestedFollowUps?: string[];
}

// ============================================================================
// AI ASSISTANT
// ============================================================================

export interface AssistantConversation {
  id: string;
  mode: AssistantModeId;
  userId: string;
  title: string;
  messages: AssistantMessage[];
  context?: AssistantContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: MessageAttachment[];
  actions?: MessageAction[];
  timestamp: Date;
  tokenCount?: number;
}

export interface MessageAttachment {
  type: 'document' | 'image' | 'data' | 'chart';
  name: string;
  url?: string;
  data?: any;
}

export interface MessageAction {
  label: string;
  action: string;
  params?: Record<string, any>;
}

export interface AssistantContext {
  currentModule?: SourceModuleId;
  selectedEntities?: Array<{
    type: string;
    id: string;
    name: string;
  }>;
  recentActions?: string[];
  userPreferences?: Record<string, any>;
}

// ============================================================================
// INTELLIGENCE DASHBOARD
// ============================================================================

export interface IntelligenceOverview {
  activeSuggestions: number;
  pendingAnomalies: number;
  activePredictions: number;
  documentsAnalyzed: number;
  queriesProcessed: number;
  aiAccuracy: number;
  recentActivity: ActivityItem[];
  featureUsage: FeatureUsage[];
}

export interface ActivityItem {
  id: string;
  type: 'suggestion' | 'anomaly' | 'prediction' | 'query' | 'analysis';
  title: string;
  description: string;
  sourceModule: SourceModuleId;
  timestamp: Date;
  user?: string;
}

export interface FeatureUsage {
  feature: IntelligenceFeatureId;
  usageCount: number;
  trend: 'up' | 'down' | 'stable';
  lastUsed: Date;
}

// ============================================================================
// AUTO CATEGORIZATION
// ============================================================================

export interface CategorySuggestion {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  suggestedCategory: string;
  confidence: number;
  alternatives: Array<{
    category: string;
    confidence: number;
  }>;
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

// ============================================================================
// CROSS-MODULE INSIGHTS
// ============================================================================

export interface CrossModuleInsight {
  id: string;
  title: string;
  description: string;
  sourceModules: SourceModuleId[];
  insightType: 'correlation' | 'trend' | 'opportunity' | 'risk' | 'optimization';
  severity: 'high' | 'medium' | 'low';
  confidence: number;
  dataPoints: InsightDataPoint[];
  recommendations: string[];
  status: 'new' | 'reviewed' | 'actioned' | 'dismissed';
  createdAt: Date;
}

export interface InsightDataPoint {
  module: SourceModuleId;
  metric: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
}
