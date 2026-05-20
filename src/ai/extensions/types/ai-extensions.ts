/**
 * AI Agent Extensions Types
 * Domain-specific AI capabilities for Dawin Advisory Platform
 */

import { ModuleType } from '../../../subsidiaries/advisory/cross-module/types/cross-module';

// ============================================================================
// LINKABLE ENTITY TYPES (local definition to avoid circular deps)
// ============================================================================

export type LinkableEntityType =
  | 'program'
  | 'project'
  | 'ipc'
  | 'requisition'
  | 'milestone'
  | 'deal'
  | 'dueDiligence'
  | 'financialModel'
  | 'client'
  | 'portfolio'
  | 'holding'
  | 'boq'
  | 'material'
  | 'purchaseOrder'
  | 'supplier'
  | 'payment';

// ============================================================================
// INTELLIGENT SUGGESTIONS
// ============================================================================

export type SuggestionType =
  | 'entity_link'
  | 'next_action'
  | 'risk_alert'
  | 'optimization'
  | 'anomaly'
  | 'completion'
  | 'similar_entity'
  | 'trend_insight';

export type SuggestionPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AISuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  reasoning: string;
  confidence: number; // 0-1

  // Context
  sourceModule: ModuleType;
  sourceEntityType: LinkableEntityType;
  sourceEntityId: string;

  // Target (for link suggestions)
  targetModule?: ModuleType;
  targetEntityType?: LinkableEntityType;
  targetEntityId?: string;

  // Action
  actionType: 'navigate' | 'create' | 'update' | 'link' | 'alert' | 'review';
  actionPayload: Record<string, any>;

  // Metadata
  generatedAt: Date;
  expiresAt?: Date;
  dismissedAt?: Date;
  appliedAt?: Date;
  userId: string;

  // Feedback
  feedback?: 'helpful' | 'not_helpful' | 'incorrect';
  feedbackNote?: string;
}

export interface SuggestionContext {
  module: ModuleType;
  entityType: LinkableEntityType;
  entityId: string;
  entityData: Record<string, any>;
  userRole: string;
  recentActions: UserAction[];
  relatedEntities: RelatedEntity[];
}

export interface UserAction {
  action: string;
  entityType: LinkableEntityType;
  entityId: string;
  timestamp: Date;
}

export interface RelatedEntity {
  module: ModuleType;
  entityType: LinkableEntityType;
  entityId: string;
  relationship: string;
}

// ============================================================================
// PREDICTIVE ANALYTICS
// ============================================================================

export type PredictionType =
  | 'project_completion'
  | 'project_risk'
  | 'deal_success'
  | 'portfolio_performance'
  | 'budget_variance'
  | 'payment_delay'
  | 'material_shortage'
  | 'resource_constraint';

export interface AIPrediction {
  id: string;
  type: PredictionType;

  // Prediction details
  prediction: string;
  probability: number; // 0-1
  confidenceInterval: [number, number];

  // Context
  module: ModuleType;
  entityType: LinkableEntityType;
  entityId: string;

  // Factors
  positiveFactors: PredictionFactor[];
  negativeFactors: PredictionFactor[];

  // Recommendations
  recommendations: PredictionRecommendation[];

  // Metadata
  modelVersion: string;
  generatedAt: Date;
  validUntil: Date;

  // Historical accuracy
  historicalAccuracy?: number;
}

export interface PredictionFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  direction: 'positive' | 'negative';
  value?: number | string;
  explanation: string;
}

export interface PredictionRecommendation {
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

// ============================================================================
// NATURAL LANGUAGE QUERIES
// ============================================================================

export type NLQueryType =
  | 'search'
  | 'aggregate'
  | 'compare'
  | 'trend'
  | 'filter'
  | 'report';

export interface ParsedNLQuery {
  originalQuery: string;
  queryType: NLQueryType;

  // Extracted intent
  intent: string;
  entities: ExtractedEntity[];
  filters: QueryFilter[];
  aggregations: QueryAggregation[];
  timeRange?: TimeRange;

  // Generated query
  firestoreQuery?: FirestoreQueryPlan;
  crossModuleQuery?: CrossModuleQueryPlan;

  // Confidence
  confidence: number;
  alternativeInterpretations: string[];
}

export interface ExtractedEntity {
  type: LinkableEntityType;
  value: string;
  confidence: number;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface QueryAggregation {
  field: string;
  operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group';
  alias: string;
}

export interface TimeRange {
  start?: Date;
  end?: Date;
  relative?: string; // "last 30 days", "this quarter"
}

export interface FirestoreQueryPlan {
  collection: string;
  filters: QueryFilter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export interface CrossModuleQueryPlan {
  modules: ModuleType[];
  queries: Map<ModuleType, FirestoreQueryPlan>;
  joinOn?: string;
}

export interface NLQueryResponse {
  query: ParsedNLQuery;
  results: any[];
  totalCount: number;
  summary: string;
  visualizationType?: 'table' | 'chart' | 'cards' | 'timeline';
  chartConfig?: ChartConfig;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  xAxis: string;
  yAxis: string;
  series?: string[];
}

// ============================================================================
// DOCUMENT INTELLIGENCE
// ============================================================================

export type DocumentType =
  | 'ipc'
  | 'requisition'
  | 'boq'
  | 'contract'
  | 'valuation'
  | 'report'
  | 'invoice'
  | 'certificate'
  | 'letter'
  | 'unknown';

export interface DocumentAnalysis {
  id: string;
  documentId: string;
  documentType: DocumentType;

  // Extracted data
  extractedFields: ExtractedField[];
  extractedTables: ExtractedTable[];
  extractedAmounts: ExtractedAmount[];
  extractedDates: ExtractedDate[];
  extractedReferences: ExtractedReference[];

  // Classification
  confidence: number;
  suggestedModule: ModuleType;
  suggestedEntityType: LinkableEntityType;

  // Validation
  validationResults: ValidationResult[];

  // Metadata
  analyzedAt: Date;
  processingTime: number;
  modelVersion: string;
}

export interface ExtractedField {
  name: string;
  value: string | number | boolean;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface ExtractedTable {
  name: string;
  headers: string[];
  rows: string[][];
  confidence: number;
}

export interface ExtractedAmount {
  label: string;
  amount: number;
  currency: string;
  confidence: number;
}

export interface ExtractedDate {
  label: string;
  date: Date;
  confidence: number;
}

export interface ExtractedReference {
  type: 'project' | 'contract' | 'certificate' | 'invoice' | 'po';
  value: string;
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface ValidationResult {
  field: string;
  status: 'valid' | 'warning' | 'error';
  message: string;
  suggestedValue?: any;
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export type AnomalyType =
  | 'budget_overrun'
  | 'timeline_slip'
  | 'unusual_payment'
  | 'data_inconsistency'
  | 'missing_approval'
  | 'duplicate_entry'
  | 'rate_deviation'
  | 'pattern_break';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: 'critical' | 'high' | 'medium' | 'low';

  // Context
  module: ModuleType;
  entityType: LinkableEntityType;
  entityId: string;
  field?: string;

  // Details
  description: string;
  expectedValue?: any;
  actualValue?: any;
  deviation?: number;

  // Evidence
  evidence: AnomalyEvidence[];

  // Resolution
  suggestedActions: string[];
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;

  // Metadata
  detectedAt: Date;
  detectionMethod: 'statistical' | 'rule_based' | 'ml_model' | 'pattern';
  confidence: number;
}

export interface AnomalyEvidence {
  type: 'historical_comparison' | 'peer_comparison' | 'rule_violation' | 'pattern_analysis';
  description: string;
  data: Record<string, any>;
}

// ============================================================================
// MODULE-SPECIFIC EXTENSIONS
// ============================================================================

// Infrastructure Delivery
export interface ProjectHealthAnalysis {
  projectId: string;
  overallHealth: 'healthy' | 'at_risk' | 'critical';
  healthScore: number; // 0-100

  dimensions: {
    schedule: DimensionHealth;
    budget: DimensionHealth;
    quality: DimensionHealth;
    safety: DimensionHealth;
  };

  riskFactors: RiskFactor[];
  recommendations: string[];
  trendDirection: 'improving' | 'stable' | 'declining';
}

export interface DimensionHealth {
  status: 'green' | 'yellow' | 'red';
  score: number;
  trend: 'up' | 'stable' | 'down';
  details: string;
}

export interface RiskFactor {
  category: string;
  description: string;
  probability: number;
  impact: number;
  mitigationStatus: 'mitigated' | 'in_progress' | 'unmitigated';
}

// Investment Module
export interface DealScoring {
  dealId: string;
  overallScore: number; // 0-100
  recommendation: 'strong_proceed' | 'proceed' | 'conditional' | 'decline';

  dimensions: {
    strategic_fit: number;
    financial_viability: number;
    risk_assessment: number;
    execution_capability: number;
    market_conditions: number;
  };

  keyStrengths: string[];
  keyRisks: string[];
  requiredConditions: string[];
}

// Advisory Module
export interface PortfolioOptimization {
  portfolioId: string;
  currentAllocation: AllocationBreakdown;
  recommendedAllocation: AllocationBreakdown;

  recommendations: OptimizationRecommendation[];
  expectedImpact: {
    returnChange: number;
    riskChange: number;
    diversificationChange: number;
  };
}

export interface AllocationBreakdown {
  byAssetClass: Record<string, number>;
  bySector: Record<string, number>;
  byGeography: Record<string, number>;
}

export interface OptimizationRecommendation {
  action: 'increase' | 'decrease' | 'hold' | 'exit';
  holdingId: string;
  holdingName: string;
  currentWeight: number;
  targetWeight: number;
  rationale: string;
}

// MatFlow
export interface BOQOptimization {
  projectId: string;
  totalCurrentCost: number;
  totalOptimizedCost: number;
  savingsPotential: number;

  optimizations: MaterialOptimization[];
  substitutions: MaterialSubstitution[];
  bulkOpportunities: BulkOpportunity[];
}

export interface MaterialOptimization {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  optimizedQuantity: number;
  wastageReduction: number;
  costSaving: number;
  method: string;
}

export interface MaterialSubstitution {
  originalMaterial: string;
  suggestedMaterial: string;
  costDifference: number;
  qualityImpact: 'better' | 'equivalent' | 'acceptable';
  availability: 'in_stock' | 'order_required' | 'special_order';
  rationale: string;
}

export interface BulkOpportunity {
  materials: string[];
  currentTotalQuantity: number;
  bulkThreshold: number;
  potentialDiscount: number;
  supplier: string;
}

// ============================================================================
// IPC SPECIFIC EXTRACTION
// ============================================================================

export interface IPCExtraction {
  certificateNumber: string;
  projectReference: string;
  contractReference?: string;
  periodFrom: string;
  periodTo: string;
  cumulativeWorkDone: number;
  previousCertificates: number;
  currentCertificate: number;
  retention: number;
  advanceRecovery: number;
  netPayable: number;
  contractor: string;
  certifyingOfficer?: string;
  status: 'draft' | 'submitted' | 'certified' | 'approved' | 'paid';
}

// ============================================================================
// BOQ SPECIFIC EXTRACTION
// ============================================================================

export interface BOQExtraction {
  projectReference: string;
  preparedBy?: string;
  datePrepared?: string;
  currency: string;
  sections: BOQSection[];
  grandTotal: number;
}

export interface BOQSection {
  name: string;
  items: BOQItem[];
  subtotal: number;
}

export interface BOQItem {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}
