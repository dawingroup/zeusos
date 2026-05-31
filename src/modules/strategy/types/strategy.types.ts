// ============================================================================
// STRATEGY TYPES - ZeusOS CEO Strategy Command
// TypeScript interfaces for strategy document management
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  StrategyDocumentType,
  StrategyDocumentStatus,
  StrategyScope,
  TimeHorizon,
  PillarCategory,
  PillarStatus,
  ReviewFrequency,
  StrategyApprovalLevel,
  ObjectivePriority,
  ObjectiveStatus,
  RiskLikelihood,
  RiskImpact,
  RiskStatus,
  AlignmentEntityType,
  AlignmentStrength,
  MetricDirection,
} from '../constants/strategy.constants';
import type { SectionType } from './documentSection.types';

// ----------------------------------------------------------------------------
// Strategy Document
// ----------------------------------------------------------------------------
export interface StrategyDocument {
  id: string;
  companyId: string;
  type: StrategyDocumentType;
  title: string;
  subtitle?: string;
  description?: string;
  status: StrategyDocumentStatus;
  scope: StrategyScope;
  scopeEntityId?: string;
  scopeEntityName?: string;
  timeHorizon: TimeHorizon;
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  fiscalYear?: string;
  quarter?: number;
  content: StrategyDocumentContent;
  pillars: StrategicPillar[];
  parentDocumentId?: string;
  linkedDocumentIds: string[];
  approvalLevel: StrategyApprovalLevel;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  reviewFrequency: ReviewFrequency;
  nextReviewDate?: Timestamp;
  lastReviewDate?: Timestamp;
  version: number;
  previousVersionId?: string;
  changeLog?: string;
  tags: string[];
  attachments: StrategyAttachment[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName?: string;
  updatedBy: string;
  updatedByName?: string;
}

// ----------------------------------------------------------------------------
// Strategy Document Content
// ----------------------------------------------------------------------------
export interface StrategyDocumentContent {
  summary?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  context?: string;
  assumptions?: string[];
  risks?: StrategyRisk[];
  dependencies?: string[];
  successCriteria?: string[];
  richContent?: string;
}

// ----------------------------------------------------------------------------
// Strategic Pillar
// ----------------------------------------------------------------------------
export interface StrategicPillar {
  id: string;
  category: PillarCategory;
  name: string;
  description?: string;
  weight: number;
  order: number;
  objectives: StrategicObjective[];
  metrics: PillarMetric[];
  owner?: PillarOwner;
  status: PillarStatus;
  progress: number;
  color?: string;
}

export interface PillarOwner {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
}

// ----------------------------------------------------------------------------
// Strategic Objective
// ----------------------------------------------------------------------------
export interface StrategicObjective {
  id: string;
  pillarId: string;
  title: string;
  description?: string;
  targetDate?: Timestamp;
  priority: ObjectivePriority;
  status: ObjectiveStatus;
  progress: number;
  linkedOKRIds: string[];
  linkedKPIIds: string[];
  notes?: string;
  assigneeId?: string;
  assigneeName?: string;
}

// ----------------------------------------------------------------------------
// Pillar Metric
// ----------------------------------------------------------------------------
export interface PillarMetric {
  id: string;
  name: string;
  description?: string;
  targetValue: number;
  currentValue?: number;
  baselineValue?: number;
  unit: string;
  direction: MetricDirection;
  source?: string;
  lastUpdatedAt?: Timestamp;
}

// ----------------------------------------------------------------------------
// Strategy Risk
// ----------------------------------------------------------------------------
export interface StrategyRisk {
  id: string;
  description: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  mitigation?: string;
  owner?: string;
  ownerName?: string;
  status: RiskStatus;
  identifiedAt?: Timestamp;
  mitigatedAt?: Timestamp;
}

// ----------------------------------------------------------------------------
// Strategy Attachment
// ----------------------------------------------------------------------------
export interface StrategyAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
  uploadedByName?: string;
}

// ----------------------------------------------------------------------------
// Strategy Version
// ----------------------------------------------------------------------------
export interface StrategyVersion {
  id: string;
  documentId: string;
  version: number;
  title: string;
  content: StrategyDocumentContent;
  pillars: StrategicPillar[];
  changeLog: string;
  changedBy: string;
  changedByName?: string;
  changedAt: Timestamp;
  snapshot: Partial<StrategyDocument>;
}

// ----------------------------------------------------------------------------
// Strategy Alignment
// ----------------------------------------------------------------------------
export interface StrategyAlignment {
  id: string;
  companyId: string;
  strategyDocumentId: string;
  strategyDocumentTitle?: string;
  pillarId: string;
  pillarName?: string;
  objectiveId?: string;
  objectiveTitle?: string;
  alignedEntityType: AlignmentEntityType;
  alignedEntityId: string;
  alignedEntityName: string;
  alignmentStrength: AlignmentStrength;
  contributionDescription?: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
}

// ----------------------------------------------------------------------------
// Strategy Review
// ----------------------------------------------------------------------------
export interface StrategyReview {
  id: string;
  documentId: string;
  documentTitle?: string;
  reviewDate: Timestamp;
  reviewedBy: string[];
  reviewerNames?: string[];
  summary: string;
  pillarUpdates: PillarUpdate[];
  recommendations: string[];
  decisions?: string[];
  nextReviewDate: Timestamp;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface PillarUpdate {
  pillarId: string;
  pillarName: string;
  previousStatus: PillarStatus;
  newStatus: PillarStatus;
  previousProgress: number;
  newProgress: number;
  comments: string;
}

// ----------------------------------------------------------------------------
// Strategy Summary (For Dashboards)
// ----------------------------------------------------------------------------
export interface StrategySummary {
  documentId: string;
  title: string;
  type: StrategyDocumentType;
  status: StrategyDocumentStatus;
  scope: StrategyScope;
  scopeEntityName?: string;
  overallProgress: number;
  pillarSummaries: PillarSummary[];
  upcomingMilestones: MilestoneSummary[];
  risksAtRisk: number;
  objectivesTotal: number;
  objectivesCompleted: number;
  lastReviewDate?: Timestamp;
  nextReviewDate?: Timestamp;
  daysUntilReview?: number;
}

export interface PillarSummary {
  pillarId: string;
  name: string;
  category: PillarCategory;
  weight: number;
  progress: number;
  status: PillarStatus;
  objectivesTotal: number;
  objectivesCompleted: number;
}

export interface MilestoneSummary {
  objectiveId: string;
  pillarId: string;
  title: string;
  targetDate: Timestamp;
  daysRemaining: number;
  priority: ObjectivePriority;
  status: ObjectiveStatus;
}

// ----------------------------------------------------------------------------
// Form Input Types
// ----------------------------------------------------------------------------
export interface CreateStrategyDocumentInput {
  type: StrategyDocumentType;
  title: string;
  subtitle?: string;
  description?: string;
  scope: StrategyScope;
  scopeEntityId?: string;
  scopeEntityName?: string;
  timeHorizon: TimeHorizon;
  effectiveFrom: Date;
  effectiveTo?: Date;
  fiscalYear?: string;
  quarter?: number;
  content?: Partial<StrategyDocumentContent>;
  pillars?: CreatePillarInput[];
  approvalLevel: StrategyApprovalLevel;
  reviewFrequency: ReviewFrequency;
  parentDocumentId?: string;
  tags?: string[];
}

export interface UpdateStrategyDocumentInput {
  title?: string;
  subtitle?: string;
  description?: string;
  status?: StrategyDocumentStatus;
  timeHorizon?: TimeHorizon;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  content?: Partial<StrategyDocumentContent>;
  approvalLevel?: StrategyApprovalLevel;
  reviewFrequency?: ReviewFrequency;
  nextReviewDate?: Date;
  tags?: string[];
  changeLog?: string;
}

export interface CreatePillarInput {
  category: PillarCategory;
  name: string;
  description?: string;
  weight: number;
  ownerId?: string;
  ownerName?: string;
  color?: string;
}

export interface UpdatePillarInput {
  category?: PillarCategory;
  name?: string;
  description?: string;
  weight?: number;
  status?: PillarStatus;
  progress?: number;
  ownerId?: string;
  ownerName?: string;
  color?: string;
}

export interface CreateObjectiveInput {
  pillarId: string;
  title: string;
  description?: string;
  targetDate?: Date;
  priority: ObjectivePriority;
  assigneeId?: string;
  assigneeName?: string;
}

export interface UpdateObjectiveInput {
  title?: string;
  description?: string;
  targetDate?: Date;
  priority?: ObjectivePriority;
  status?: ObjectiveStatus;
  progress?: number;
  linkedOKRIds?: string[];
  linkedKPIIds?: string[];
  notes?: string;
  assigneeId?: string;
  assigneeName?: string;
}

export interface CreateMetricInput {
  pillarId: string;
  name: string;
  description?: string;
  targetValue: number;
  baselineValue?: number;
  unit: string;
  direction: MetricDirection;
  source?: string;
}

export interface UpdateMetricInput {
  name?: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  direction?: MetricDirection;
  source?: string;
}

export interface CreateRiskInput {
  description: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  mitigation?: string;
  owner?: string;
  ownerName?: string;
}

export interface UpdateRiskInput {
  description?: string;
  likelihood?: RiskLikelihood;
  impact?: RiskImpact;
  mitigation?: string;
  owner?: string;
  ownerName?: string;
  status?: RiskStatus;
}

export interface CreateAlignmentInput {
  strategyDocumentId: string;
  pillarId: string;
  objectiveId?: string;
  alignedEntityType: AlignmentEntityType;
  alignedEntityId: string;
  alignedEntityName: string;
  alignmentStrength: AlignmentStrength;
  contributionDescription?: string;
}

export interface CreateReviewInput {
  documentId: string;
  reviewDate: Date;
  reviewedBy: string[];
  summary: string;
  pillarUpdates: Omit<PillarUpdate, 'pillarName'>[];
  recommendations: string[];
  decisions?: string[];
  nextReviewDate: Date;
  notes?: string;
}

// ----------------------------------------------------------------------------
// Filter Types
// ----------------------------------------------------------------------------
export interface StrategyDocumentFilters {
  type?: StrategyDocumentType;
  status?: StrategyDocumentStatus;
  scope?: StrategyScope;
  scopeEntityId?: string;
  fiscalYear?: string;
  timeHorizon?: TimeHorizon;
  approvalLevel?: StrategyApprovalLevel;
  activeOnly?: boolean;
  parentDocumentId?: string;
  tags?: string[];
  createdBy?: string;
  searchQuery?: string;
}

export interface AlignmentFilters {
  strategyDocumentId?: string;
  pillarId?: string;
  objectiveId?: string;
  alignedEntityType?: AlignmentEntityType;
  alignedEntityId?: string;
  alignmentStrength?: AlignmentStrength;
}

// ----------------------------------------------------------------------------
// Hierarchy Types
// ----------------------------------------------------------------------------
export interface StrategyHierarchy {
  groupStrategy?: StrategyDocument;
  subsidiaryStrategies: StrategyDocument[];
  departmentStrategies: StrategyDocument[];
  teamStrategies: StrategyDocument[];
}

export interface StrategyTreeNode {
  document: StrategyDocument;
  children: StrategyTreeNode[];
  level: number;
  alignmentCount: number;
}

// ============================================================================
// BUSINESS STRATEGY REVIEW TYPES
// ============================================================================

// ----------------------------------------------------------------------------
// Business Model Canvas
// ----------------------------------------------------------------------------
export interface BusinessModelCanvas {
  keyPartners: CanvasItem[];
  keyActivities: CanvasItem[];
  keyResources: CanvasItem[];
  valuePropositions: CanvasItem[];
  customerRelationships: CanvasItem[];
  channels: CanvasItem[];
  customerSegments: CanvasItem[];
  costStructure: CanvasItem[];
  revenueStreams: CanvasItem[];
}

export interface CanvasItem {
  id: string;
  text: string;
  notes?: string;
  priority?: 'high' | 'medium' | 'low';
  isNew?: boolean;
  isModified?: boolean;
  aiSuggested?: boolean;
}

// ----------------------------------------------------------------------------
// SWOT Analysis
// ----------------------------------------------------------------------------
export interface SWOTAnalysis {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
}

export interface SWOTItem {
  id: string;
  text: string;
  impact: 'high' | 'medium' | 'low';
  notes?: string;
  actionRequired?: string;
  aiSuggested?: boolean;
}

// ----------------------------------------------------------------------------
// Market & Competitive Analysis
// ----------------------------------------------------------------------------
export interface MarketAnalysis {
  marketSize: string;
  marketGrowthRate: string;
  targetSegments: MarketSegment[];
  marketTrends: string[];
  marketChallenges: string[];
  regulatoryEnvironment: string;
  notes: string;
}

export interface MarketSegment {
  id: string;
  name: string;
  size: string;
  growthPotential: 'high' | 'medium' | 'low';
  currentPenetration: string;
  targetPenetration: string;
  notes?: string;
}

export interface CompetitiveAnalysis {
  competitors: CompetitorProfile[];
  competitiveAdvantages: string[];
  competitiveThreats: string[];
  marketPositioning: string;
  differentiationStrategy: string;
}

export interface CompetitorProfile {
  id: string;
  name: string;
  strengths: string[];
  weaknesses: string[];
  marketShare: string;
  threatLevel: 'high' | 'medium' | 'low';
}

// ----------------------------------------------------------------------------
// Financial Projections
// ----------------------------------------------------------------------------
export interface FinancialProjections {
  revenueTargets: FinancialTarget[];
  costProjections: FinancialTarget[];
  profitabilityTargets: FinancialTarget[];
  fundingRequirements: string;
  keyFinancialAssumptions: string[];
  breakEvenAnalysis: string;
  notes: string;
}

export interface FinancialTarget {
  id: string;
  label: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  timeframe: string;
  notes?: string;
}

// ----------------------------------------------------------------------------
// Implementation Roadmap
// ----------------------------------------------------------------------------
export interface ImplementationRoadmap {
  phases: RoadmapPhase[];
  criticalDependencies: string[];
  resourceRequirements: string[];
  notes: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  milestones: RoadmapMilestone[];
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  owner: string;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  targetDate: string;
  status: 'pending' | 'completed' | 'delayed';
  deliverables: string[];
}

// ----------------------------------------------------------------------------
// Business Pivots (Company-level, shared across reviews)
// ----------------------------------------------------------------------------
export type PivotCategory =
  | 'customer_focus'
  | 'product_pivot'
  | 'market_pivot'
  | 'operational_restructure'
  | 'technology_shift'
  | 'revenue_model'
  | 'partnership'
  | 'other';

export type PivotStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

export interface BusinessPivot {
  id: string;
  title: string;
  description: string;
  category: PivotCategory;
  status: PivotStatus;
  pivotDate: string;
  impactAssessment: string;
  outcomes: string;
  lessonsLearned: string;
  affectedAreas: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ----------------------------------------------------------------------------
// Section Review
// ----------------------------------------------------------------------------
export type ReviewSectionStatus = 'not_started' | 'in_review' | 'needs_update' | 'approved';

export interface SectionReview {
  status: ReviewSectionStatus;
  currentContent: string;
  updatedContent: string;
  reviewNotes: string;
  score: number;
  recommendations: string[];
  lastReviewedAt?: string;
  reviewedBy?: string;
}

// ----------------------------------------------------------------------------
// Strategy Review Data (Main Review Entity)
// ----------------------------------------------------------------------------
export interface StrategyReviewData {
  id: string;
  companyId: string;
  strategyDocumentId?: string;
  title: string;
  reviewDate: string;
  status: 'draft' | 'in_progress' | 'completed';

  // Uploaded document
  uploadedDocument?: UploadedStrategyDocument;

  // Business Model Canvas
  businessModelCanvas: BusinessModelCanvas;

  // Analysis sections
  swotAnalysis: SWOTAnalysis;
  marketAnalysis: MarketAnalysis;
  competitiveAnalysis: CompetitiveAnalysis;
  financialProjections: FinancialProjections;
  implementationRoadmap: ImplementationRoadmap;

  // Section reviews
  sectionReviews: {
    executiveSummary: SectionReview;
    visionMission: SectionReview;
    businessModelCanvas: SectionReview;
    marketAnalysis: SectionReview;
    competitiveAnalysis: SectionReview;
    swotAnalysis: SectionReview;
    financialProjections: SectionReview;
    riskAssessment: SectionReview;
    implementationRoadmap: SectionReview;
    okrKpiOutput: SectionReview;
  };

  // Outputs
  generatedOKRs: GeneratedOKR[];
  generatedKPIs: GeneratedKPI[];
  actionItems: StrategyActionItem[];
  overallScore: number;

  // AI conversation history
  aiConversationHistory: AIMessage[];

  // Google Docs integration
  googleDocId?: string;
  googleDocUrl?: string;

  // Document section management
  documentSectionCount?: number;
  lastFullAssessmentAt?: Timestamp | null;
  overallAlignmentScore?: number | null;
  sectionsNeedingRewrite?: number;
  sectionTypeMapping?: Record<SectionType, string[]>;
  rewriteThreshold?: number;
  autoApplyRewrites?: boolean;

  // Authored Strategy Document v2 fields (Experiments / Options surfaces)
  /** Financial model (microforecasts, NPV) when the document includes one. */
  financialModel?: FinancialModel;
  /** Authored strategic themes (corporate / business level). */
  strategicThemes?: AuthoredTheme[];
  /** Capital allocation table. */
  capitalAllocation?: AuthoredCapitalBucket[];
  /** Spin-off experiments. */
  spinoffs?: AuthoredSpinoff[];
  /** Options analyses authored against this doc. */
  optionsAnalyses?: AuthoredOptionsAnalysis[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface UploadedStrategyDocument {
  fileName: string;
  fileUrl: string;
  storagePath?: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  parsedContent?: string;
}

// ----------------------------------------------------------------------------
// Generated OKRs & KPIs
// ----------------------------------------------------------------------------
export interface GeneratedOKR {
  id: string;
  objective: string;
  description: string;
  pillarId?: string;
  pillarName?: string;
  keyResults: GeneratedKeyResult[];
  timeframe: string;
  owner: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  aiGenerated: boolean;
  accepted: boolean;
  linkedToOKRId?: string;
}

export interface GeneratedKeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  weight: number;
}

export interface GeneratedKPI {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'operational' | 'customer' | 'employee' | 'growth';
  targetValue: number;
  currentValue: number;
  unit: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  owner: string;
  aiGenerated: boolean;
  accepted: boolean;
  linkedToKPIId?: string;
}

export interface StrategyActionItem {
  id: string;
  title: string;
  description: string;
  section: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// ----------------------------------------------------------------------------
// AI Strategy Assistant Types
// ----------------------------------------------------------------------------
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  section?: string;
  suggestions?: AISuggestion[];
}

export interface AISuggestion {
  id: string;
  type: 'bmc' | 'swot' | 'okr' | 'kpi' | 'risk' | 'market' | 'financial' | 'roadmap' | 'general';
  sectionKey?: string;
  title: string;
  content: string;
  score?: number;
  recommendations?: string[];
  confidence: number;
  applied: boolean;
}

export interface AIStrategyAnalysisRequest {
  companyId: string;
  reviewId: string;
  section: string;
  currentData: Record<string, unknown>;
  uploadedDocumentContent?: string;
  question?: string;
  conversationHistory?: AIMessage[];
  documentSectionId?: string;
  assessmentMode?: 'analyze' | 'assess_alignment' | 'generate_rewrite';
  dataPackage?: Record<string, unknown>;
}

export interface AIStrategyAnalysisResponse {
  success: boolean;
  message: string;
  suggestions: AISuggestion[];
  conversationMessage: AIMessage;
  error?: string;
}

// ============================================================================
// Authored Strategy Document v2 cluster — ported from DawinOS for the
// Experiments + Options Analysis surfaces (themes / spin-offs / options /
// capital allocation / financial model). Additive, optional interfaces.
// ============================================================================
export interface FinancialMicroforecastRow {
  /** Period label ('Q1 FY26', '2026-04', etc.). */
  period: string;
  /** Absolute period order (1, 2, 3, …). */
  index: number;
  revenue: number;
  cogs: number;
  opex: number;
  capex: number;
  workingCapital: number;
  /** Net free cash flow for the period (derived; persisted for audit). */
  netCashFlow: number;
}

/** NPV / IRR assessment for an initiative or scenario. */
export interface NPVAssessment {
  id: string;
  label: string;
  /** Annual discount rate (e.g. 0.18 = 18%). */
  discountRate: number;
  /** Cash flow series (period 0 is the upfront investment, usually negative). */
  cashFlows: number[];
  /** Derived. NaN until cash flows present. */
  npv: number;
  /** Derived. NaN if no sign change. */
  irr?: number;
  /** Derived payback period in periods (NaN if never paid back). */
  paybackPeriods?: number;
  notes?: string;
}

// ── Authored content shapes ─────────────────────────────────────────────
// These power the authoring-first editor surfaces. A strategy document is
// authored *directly* into these structures rather than being analysed
// from an uploaded PDF (the original review-mode workflow).

/** Strategic theme — the big bets that carry the strategy. */
export interface AuthoredTheme {
  id: string;
  /** Two-digit number ('01', '02', …) displayed in headings. */
  n?: string;
  name: string;
  owner: string;
  /** Subsidiary or BU short code (DG/DF/DA/DC/DT). Optional. */
  sub?: string;
  /** RAG tone. */
  status?: 'green' | 'amber' | 'red';
  /** Investment envelope, in document's display currency. */
  envelope?: number;
  /** Narrative "why this theme matters". */
  why?: string;
  /** Big-bet outcomes (the WHAT, not the HOW). */
  bigBets: string[];
  /** Current progress percentage 0–100, optional. */
  progress?: number;
}

/** A concrete initiative — operational tier and below. */
export interface AuthoredInitiative {
  id: string;
  title: string;
  /** The expected outcome (the WHAT). */
  outcome: string;
  owner: string;
  /** Optional theme link, if this initiative rolls up to a theme. */
  themeId?: string;
  /** ISO date string for the milestone / due date. */
  milestone?: string;
  status?: 'green' | 'amber' | 'red' | 'na';
}

/** Capability the function will build, sustain, or retire. */
export interface AuthoredCapability {
  id: string;
  name: string;
  /** Current maturity 1–5. */
  currentLevel: number;
  /** Target maturity 1–5. */
  targetLevel: number;
  /** Stance to take. */
  stance: 'build' | 'sustain' | 'retire';
  /** What the function commits to deliver — the WHAT. */
  outcome?: string;
  owner?: string;
}

/** Risk register entry (full structured form, distinct from the freeform
 *  text-only `riskAssessment` review section). */
export interface AuthoredRisk {
  id: string;
  title: string;
  category?: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  /** Net = max(prob, impact) by default — but editable. */
  net: 'low' | 'medium' | 'high';
  owner: string;
  mitigation: string;
}

/** A bucket in the capital allocation table. */
export interface AuthoredCapitalBucket {
  id: string;
  label: string;
  /** Amount in document's display currency. */
  amount: number;
  /** Optional theme this funds. */
  themeId?: string;
  /** Display tag. */
  tag?: string;
}

/** A single KPI tile (situation / scoreboard). */
export interface AuthoredKPITile {
  id: string;
  label: string;
  /** Display value as captured ('1.42B', '34.4%', '88', '+38'). */
  value: string;
  /** Target (display value). */
  target?: string;
  /** Delta vs prior period. */
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  status?: 'green' | 'amber' | 'red';
  /** Sparkline points (latest-on-the-right). */
  spark?: number[];
  /**
   * Linked KPI from the tracked KPI library. When set, the tile renders
   * `label`, `value`, `target`, and `status` from the live KPI definition
   * rather than from the user-authored fields. Editing controls are
   * hidden for linked tiles to prevent drift from the source of truth.
   */
  linkedKpiId?: string;
}

/** "Choices made / Choices avoided" two-column entry. */
export interface AuthoredChoice {
  id: string;
  /** true = a choice we are making. false = a choice we are NOT making. */
  pro: boolean;
  text: string;
}

/** North-star aspiration + concrete proofs by end-of-horizon. */
export interface AuthoredNorthStar {
  /** One-sentence aspiration. */
  aspiration: string;
  /** Three measurable proofs (free text, e.g. "≥45% UG premium share"). */
  proofs: string[];
  /** Horizon label ('FY26–FY28', '3-year', etc.). Display only. */
  horizon?: string;
}

/** Cadence row (weekly check-in, monthly review, etc.). */
export interface AuthoredCadence {
  id: string;
  /** Frequency label ('Weekly', 'Monthly', 'Quarterly', 'Half-year', 'Annual'). */
  frequency: string;
  name: string;
  /** Who attends ('Theme owners ↔ CEO', 'All MDs', etc.). */
  who: string;
  /** What gets done in the meeting. */
  what: string;
}

/** Approval-chain entry. */
export interface AuthoredApprover {
  id: string;
  name: string;
  role: string;
  status: 'signed' | 'pending' | 'na';
  date?: string;
}

/** Microforecast line item — granular, monthly, feeds the master model. */
export interface AuthoredMicroforecastLine {
  id: string;
  label: string;
  /** Driver document or PO/SO id ('PO-FIN-2026-0044'). */
  driver?: string;
  /** Cash impact per period (typically months, in the doc's currency). */
  periods: number[];
  /** Confidence band 0–100. */
  confidence: number;
  /** Upstream owner this line rolls up to ('PLAN-DF-MFG-26 · MFG-3'). */
  feedsTo?: string;
}

/** A spin-off experiment — timeboxed hypothesis test. */
export interface AuthoredSpinoff {
  id: string;
  /** Parent theme/objective id this experiment serves. */
  parent: string;
  name: string;
  /** The hypothesis being tested. */
  hypothesis: string;
  /** How we will test it. */
  mechanism: string;
  /** The metric this should move. */
  metric: string;
  target?: string;
  current?: string;
  owner: string;
  /** Subsidiary or BU short code. */
  sub?: string;
  /** Timebox label ('12 wks', '90 days'). */
  timebox?: string;
  started?: string;
  ends?: string;
  /** Lifecycle stage. */
  stage: 'brief' | 'running' | 'learning' | 'decided';
  /** Decision when stage === 'decided'. */
  decision?: 'promote' | 'iterate' | 'pause' | 'kill';
  evidence?: string;
  /** Confidence band 0–100. */
  confidence?: number;
  /**
   * Source strategy document id this experiment was spawned from. Used by
   * the enterprise Experiments tab to attribute each test to a doc.
   */
  sourceDoc?: string;
  /**
   * Tracked KPI id this experiment is trying to move. When set, the
   * experiment detail surface pulls live current/target/status from the
   * KPI library — replaces the free-text metric/target/current fields
   * with a live read.
   */
  linkedKpiId?: string;
  /**
   * Options-analysis id this experiment was spawned from (when the spin-off
   * was created via the "Spawn pilot spin-off" action on an analysis).
   */
  sourceAnalysis?: string;
}

/** A weighted decision criterion for an options analysis. */
export interface OptionsAnalysisCriterion {
  id: string;
  /** Human-readable label, e.g. "NPV", "Time-to-value", "Strategic fit". */
  label: string;
  /** Weight, 0..1. Weights across all criteria should sum to 1. */
  weight: number;
}

/** A single option being evaluated within an analysis. */
export interface OptionsAnalysisOption {
  id: string;
  /** Option name, e.g. "Build CNC line 3 in-house". */
  name: string;
  summary?: string;
  capex?: number;
  opex?: number;
  timeToValueMonths?: number;
  /** Optional link to a FinancialModel.npvAssessment for this option. */
  linkedNpvAssessmentId?: string;
  pros: string[];
  cons: string[];
  risks: string[];
  /** Per-criterion score, 0..5. Weighted-sum drives the recommendation. */
  scores: Record<string, number>;
}

/** A single approver in an options-analysis approval chain. */
export interface OptionsAnalysisApprover {
  id: string;
  name: string;
  role?: string;
  status: 'pending' | 'signed' | 'declined';
  /** ISO date the approver acted (signed/declined). */
  date?: string;
  note?: string;
}

/** A structured decision surface for evaluating infrastructure / capital /
 *  vendor / build-vs-buy choices. Sized between an experiment (timeboxed
 *  test) and a financial model (one set of numbers). */
export interface AuthoredOptionsAnalysis {
  id: string;
  /** The decision question, e.g. "How do we add 30% finishing capacity?". */
  question: string;
  /** Strategy doc this analysis belongs to. */
  sourceDocId: string;
  /** Optional parent theme this analysis serves. */
  themeId?: string;
  criteria: OptionsAnalysisCriterion[];
  options: OptionsAnalysisOption[];
  /** id of the recommended option. Defaults (computed) to the highest
   *  weighted score; user may override. */
  recommendation?: string;
  rationale?: string;
  status: 'draft' | 'in_review' | 'decided' | 'executing';
  /** ISO date the decision was made. */
  decisionDate?: string;
  /** Primary approver (display only — chain lives in `approvers`). */
  approver?: string;
  /** Multi-step approval chain. Status auto-advances to `decided` when all
   *  approvers have signed and the analysis is `in_review`. */
  approvers?: OptionsAnalysisApprover[];
  createdAt: string;
  updatedAt: string;
}

export interface FinancialModel {
  /** Forecast horizon length (number of periods). */
  horizonPeriods: number;
  /** Period granularity. */
  periodKind: 'month' | 'quarter' | 'year';
  /** Annual discount rate used for the headline NPV. */
  discountRate: number;
  /** Microforecast periods. */
  microforecast: FinancialMicroforecastRow[];
  /** Initiative-level NPV assessments. */
  npvAssessments: NPVAssessment[];
  /** Has this model been pushed to the group finance master model? */
  syncedToMasterAt?: string;
  notes?: string;
}
