import { Timestamp } from 'firebase/firestore';

// ==================== Module Types ====================

export type ModuleType = 'infrastructure' | 'investment' | 'advisory' | 'matflow';

export type LinkableEntityType =
  | 'project'
  | 'engagement'
  | 'facility'
  | 'ipc'
  | 'milestone'
  | 'contractor'
  | 'deal'
  | 'portfolio'
  | 'fund'
  | 'investment'
  | 'investor'
  | 'mandate'
  | 'proposal'
  | 'client'
  | 'deliverable'
  | 'requisition'
  | 'purchase_order'
  | 'supplier'
  | 'boq'
  | 'delivery'
  | 'material';

// ==================== Entity Reference ====================

export interface EntityReference {
  id: string;
  type: LinkableEntityType;
  module: ModuleType;
  name: string;
  referenceNumber?: string;
  metadata?: Record<string, unknown>;
}

// ==================== Entity Linking ====================

export type LinkStrength = 'strong' | 'medium' | 'weak';
export type LinkDirection = 'outgoing' | 'incoming' | 'both';

export interface EntityLink {
  id: string;
  sourceEntity: EntityReference;
  targetEntity: EntityReference;
  linkType: string;
  strength: LinkStrength;
  bidirectional: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface CreateLinkInput {
  sourceEntity: EntityReference;
  targetEntity: EntityReference;
  linkType: string;
  strength?: LinkStrength;
  bidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

// ==================== Entity Graph ====================

export interface EntityGraphNode {
  entity: EntityReference;
  depth: number;
  linkCount: number;
}

export interface EntityGraphEdge {
  source: string;
  target: string;
  linkType: string;
  strength: LinkStrength;
}

export interface EntityGraph {
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
  rootEntity: EntityReference;
  maxDepth: number;
}

// ==================== Unified Search ====================

export interface UnifiedSearchQuery {
  query: string;
  modules?: ModuleType[];
  entityTypes?: LinkableEntityType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface UnifiedSearchResult {
  entity: EntityReference;
  score: number;
  highlights: string[];
  linkedEntities?: EntityReference[];
}

export interface SearchFacets {
  modules: { module: ModuleType; count: number }[];
  entityTypes: { type: LinkableEntityType; count: number }[];
  dateRanges: { label: string; count: number }[];
}

export interface UnifiedSearchResponse {
  results: UnifiedSearchResult[];
  facets: SearchFacets;
  total: number;
  query: UnifiedSearchQuery;
  executionTime: number;
}

// ==================== Cross-Module Reports ====================

export type CrossModuleReportType =
  | 'portfolio_infrastructure'
  | 'deal_project_pipeline'
  | 'procurement_analysis'
  | 'engagement_overview'
  | 'financial_consolidated'
  | 'supplier_performance';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface ReportMetric {
  id: string;
  name: string;
  field: string;
  aggregation: AggregationType;
  format?: 'currency' | 'percentage' | 'number';
}

export interface ReportDimension {
  id: string;
  name: string;
  field: string;
  groupBy: boolean;
}

export interface ReportChart {
  id: string;
  type: 'bar' | 'pie' | 'line' | 'area' | 'scatter';
  title: string;
  data: unknown[];
  config?: Record<string, unknown>;
}

export interface CrossModuleReportConfig {
  id: string;
  type: CrossModuleReportType;
  name: string;
  description: string;
  modules: ModuleType[];
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  filters?: Record<string, unknown>;
}

export interface CrossModuleReport {
  id: string;
  config: CrossModuleReportConfig;
  data: Record<string, unknown>[];
  summary: Record<string, number>;
  charts: ReportChart[];
  generatedAt: Timestamp;
  generatedBy: string;
}

// ==================== Workflow Orchestration ====================

export type WorkflowType =
  | 'project_setup'
  | 'procurement_cycle'
  | 'investment_deployment'
  | 'deal_execution'
  | 'ipc_generation';

export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export type WorkflowActionType =
  | 'create'
  | 'update'
  | 'approve'
  | 'notify'
  | 'generate'
  | 'link'
  | 'custom';

export interface WorkflowAction {
  type: WorkflowActionType;
  targetModule: ModuleType;
  targetEntity?: LinkableEntityType;
  params: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  module: ModuleType;
  action: WorkflowAction;
  dependencies: string[];
  status: StepStatus;
  result?: unknown;
  error?: string;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  requiresApproval?: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
}

export interface WorkflowTemplate {
  id: string;
  type: WorkflowType;
  name: string;
  description: string;
  steps: Omit<WorkflowStep, 'status' | 'result' | 'error'>[];
  estimatedDuration: string;
  requiredInputs: string[];
}

export interface Workflow {
  id: string;
  templateId: string;
  type: WorkflowType;
  name: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  currentStepId?: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  startedBy: string;
  error?: string;
}

// ==================== Link Suggestions ====================

export interface LinkSuggestion {
  targetEntity: EntityReference;
  suggestedLinkType: string;
  confidence: number;
  reason: string;
}
