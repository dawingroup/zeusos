// ============================================================================
// ENVIRONMENT SCANNING TYPES
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  PESTELDimension,
  ImpactLevel,
  ProbabilityLevel,
  SignalType,
  SignalSource,
  SignalStatus,
  RegulatoryCategory,
  RegulatoryStatus,
  ComplianceStatus,
  ScenarioType,
  TimeHorizon,
  AlertPriority,
  TriggerCondition,
  UgandaEconomicIndicator,
  AffectedBusinessArea,
} from '../constants/scanning.constants';

// ----------------------------------------------------------------------------
// PESTEL ANALYSIS TYPES
// ----------------------------------------------------------------------------

export interface PESTELAnalysis {
  id: string;
  title: string;
  description: string;
  
  scope: {
    industries: string[];
    geographies: string[];
    timeHorizon: TimeHorizon;
    targetDate: Timestamp;
  };
  
  factors: PESTELFactor[];
  
  summary: {
    overallImpact: ImpactLevel;
    keyOpportunities: string[];
    keyThreats: string[];
    strategicImplications: string[];
  };
  
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  version: number;
  
  linkedScenarios: string[];
  linkedSignals: string[];
  linkedRegulations: string[];
}

export interface PESTELFactor {
  id: string;
  dimension: PESTELDimension;
  subFactor: string;
  
  title: string;
  description: string;
  currentState: string;
  futureOutlook: string;
  
  impact: {
    level: ImpactLevel;
    probability: ProbabilityLevel;
    timeToImpact: TimeHorizon;
    riskScore: number;
  };
  
  type: 'opportunity' | 'threat' | 'neutral';
  affectedAreas: AffectedBusinessArea[];
  
  evidence: FactorEvidence[];
  
  strategicResponse?: {
    recommendation: string;
    actions: string[];
    owner?: string;
    deadline?: Timestamp;
    status: 'pending' | 'in_progress' | 'completed';
  };
  
  watchPriority: AlertPriority;
  lastUpdated: Timestamp;
}

export interface FactorEvidence {
  id: string;
  type: 'statistic' | 'trend' | 'event' | 'regulation' | 'expert_opinion' | 'research';
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  date: Timestamp;
  reliability: 'high' | 'medium' | 'low';
}

// ----------------------------------------------------------------------------
// SIGNAL DETECTION TYPES
// ----------------------------------------------------------------------------

export interface EnvironmentSignal {
  id: string;
  
  title: string;
  description: string;
  signalType: SignalType;
  source: SignalSource;
  sourceDetails: {
    name: string;
    url?: string;
    author?: string;
    publicationDate?: Timestamp;
  };
  
  pestelDimension: PESTELDimension;
  industries: string[];
  geographies: string[];
  affectedAreas: AffectedBusinessArea[];
  
  assessment: {
    impactLevel: ImpactLevel;
    probability: ProbabilityLevel;
    timeToImpact: TimeHorizon;
    confidenceLevel: number;
    strengthScore: number;
  };
  
  implications: {
    opportunities: string[];
    threats: string[];
    strategicImplications: string[];
  };
  
  status: SignalStatus;
  statusHistory: SignalStatusChange[];
  
  relatedSignals: string[];
  relatedRegulations: string[];
  linkedAnalyses: string[];
  
  actionItems: SignalActionItem[];
  
  detectedBy: string;
  detectedAt: Timestamp;
  updatedAt: Timestamp;
  validatedBy?: string;
  validatedAt?: Timestamp;
  
  tags: string[];
}

export interface SignalStatusChange {
  fromStatus: SignalStatus;
  toStatus: SignalStatus;
  changedBy: string;
  changedAt: Timestamp;
  reason: string;
}

export interface SignalActionItem {
  id: string;
  action: string;
  assignee?: string;
  dueDate?: Timestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: AlertPriority;
  completedAt?: Timestamp;
  notes?: string;
}

// ----------------------------------------------------------------------------
// REGULATORY TRACKING TYPES
// ----------------------------------------------------------------------------

export interface RegulatoryItem {
  id: string;
  
  title: string;
  officialName: string;
  referenceNumber?: string;
  description: string;
  
  category: RegulatoryCategory;
  subcategory?: string;
  jurisdiction: string;
  issuingAuthority: string;
  
  status: RegulatoryStatus;
  statusHistory: RegulatoryStatusChange[];
  
  dates: {
    proposed?: Timestamp;
    consultationStart?: Timestamp;
    consultationEnd?: Timestamp;
    enacted?: Timestamp;
    effectiveDate?: Timestamp;
    amendedDate?: Timestamp;
    repealedDate?: Timestamp;
  };
  
  impact: {
    level: ImpactLevel;
    affectedAreas: AffectedBusinessArea[];
    affectedSubsidiaries: string[];
    financialImpact?: {
      estimatedCost?: number;
      currency: string;
      costType: 'one_time' | 'recurring' | 'both';
      notes?: string;
    };
  };
  
  compliance: {
    status: ComplianceStatus;
    requirements: ComplianceRequirement[];
    gapAnalysis?: string;
    remediationPlan?: string;
    dueDate?: Timestamp;
  };
  
  documents: RegulatoryDocument[];
  
  relatedRegulations: string[];
  linkedSignals: string[];
  
  trackedBy: string;
  trackedAt: Timestamp;
  updatedAt: Timestamp;
  notes?: string;
}

export interface RegulatoryStatusChange {
  fromStatus: RegulatoryStatus;
  toStatus: RegulatoryStatus;
  changedBy: string;
  changedAt: Timestamp;
  notes?: string;
}

export interface ComplianceRequirement {
  id: string;
  requirement: string;
  description: string;
  complianceStatus: ComplianceStatus;
  responsiblePerson?: string;
  dueDate?: Timestamp;
  evidence?: string;
  notes?: string;
}

export interface RegulatoryDocument {
  id: string;
  title: string;
  type: 'full_text' | 'summary' | 'guidance' | 'form' | 'commentary';
  url?: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

// ----------------------------------------------------------------------------
// SCENARIO PLANNING TYPES
// ----------------------------------------------------------------------------

export interface Scenario {
  id: string;
  
  title: string;
  description: string;
  type: ScenarioType;
  
  scope: {
    industries: string[];
    geographies: string[];
    timeHorizon: TimeHorizon;
    targetYear: number;
  };
  
  probability: number;
  probabilityRationale: string;
  
  drivingForces: ScenarioDrivingForce[];
  assumptions: ScenarioAssumption[];
  economicProjections: EconomicProjection[];
  
  businessImpact: {
    revenueImpact: number;
    costImpact: number;
    marketShareImpact: number;
    employmentImpact: number;
    qualitativeImpacts: string[];
  };
  
  strategicOptions: StrategicOption[];
  signposts: ScenarioSignpost[];
  
  status: 'draft' | 'under_review' | 'approved' | 'archived';
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  linkedPESTEL: string[];
  linkedSignals: string[];
  linkedRegulations: string[];
}

export interface ScenarioDrivingForce {
  id: string;
  force: string;
  description: string;
  pestelDimension: PESTELDimension;
  certainty: 'high' | 'medium' | 'low';
  impact: ImpactLevel;
  direction: 'positive' | 'negative' | 'uncertain';
}

export interface ScenarioAssumption {
  id: string;
  assumption: string;
  basis: string;
  sensitivity: 'high' | 'medium' | 'low';
  alternativeValues?: string[];
}

export interface EconomicProjection {
  indicator: UgandaEconomicIndicator;
  baselineValue: number;
  projectedValue: number;
  unit: string;
  confidence: number;
  notes?: string;
}

export interface StrategicOption {
  id: string;
  option: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  resourceRequirements: string;
  timeToImplement: TimeHorizon;
  recommendedIf: string;
  priority: AlertPriority;
}

export interface ScenarioSignpost {
  id: string;
  indicator: string;
  description: string;
  threshold?: number;
  unit?: string;
  currentValue?: number;
  targetValue?: number;
  direction: 'above' | 'below' | 'equals' | 'changes';
  lastChecked?: Timestamp;
  status: 'not_triggered' | 'approaching' | 'triggered';
}

// ----------------------------------------------------------------------------
// EARLY WARNING TYPES
// ----------------------------------------------------------------------------

export interface EarlyWarningAlert {
  id: string;
  
  title: string;
  description: string;
  priority: AlertPriority;
  
  trigger: AlertTrigger;
  
  sourceType: 'signal' | 'regulation' | 'scenario' | 'indicator' | 'custom';
  sourceId?: string;
  
  affectedAreas: AffectedBusinessArea[];
  
  notificationsSent: AlertNotification[];
  
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  resolution?: string;
  
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface AlertTrigger {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  
  condition: TriggerCondition;
  threshold?: number;
  thresholdUnit?: string;
  pattern?: string;
  
  monitoringFrequency: 'real_time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  lastChecked?: Timestamp;
  
  targetType: 'indicator' | 'signal' | 'regulation' | 'scenario' | 'custom';
  targetId?: string;
  
  alertPriority: AlertPriority;
  notifyRoles: string[];
  notifyUsers: string[];
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AlertNotification {
  id: string;
  userId: string;
  channel: 'email' | 'sms' | 'in_app' | 'push';
  sentAt: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

// ----------------------------------------------------------------------------
// INDICATOR TRACKING TYPES
// ----------------------------------------------------------------------------

export interface TrackedIndicator {
  id: string;
  indicator: UgandaEconomicIndicator;
  
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  
  thresholds: {
    critical_high?: number;
    warning_high?: number;
    warning_low?: number;
    critical_low?: number;
  };
  
  history: IndicatorDataPoint[];
  
  projections?: {
    method: string;
    values: IndicatorDataPoint[];
    confidence: number;
  };
  
  alertStatus: 'normal' | 'warning' | 'critical';
  
  lastUpdated: Timestamp;
  source: string;
}

export interface IndicatorDataPoint {
  date: Timestamp;
  value: number;
  source?: string;
  notes?: string;
}

// ----------------------------------------------------------------------------
// ANALYTICS TYPES
// ----------------------------------------------------------------------------

export interface EnvironmentScanningAnalytics {
  pestelSummary: {
    totalAnalyses: number;
    byStatus: Record<string, number>;
    byDimension: Record<PESTELDimension, number>;
    avgImpactScore: number;
    topOpportunities: string[];
    topThreats: string[];
  };
  
  signalSummary: {
    totalSignals: number;
    byType: Record<SignalType, number>;
    byStatus: Record<SignalStatus, number>;
    byDimension: Record<PESTELDimension, number>;
    avgStrengthScore: number;
    recentSignals: number;
    validationRate: number;
  };
  
  regulatorySummary: {
    totalTracked: number;
    byCategory: Record<RegulatoryCategory, number>;
    byStatus: Record<RegulatoryStatus, number>;
    complianceRate: number;
    upcomingDeadlines: number;
    highImpactItems: number;
  };
  
  scenarioSummary: {
    totalScenarios: number;
    byType: Record<ScenarioType, number>;
    avgProbability: number;
    approvedScenarios: number;
    triggeredSignposts: number;
  };
  
  earlyWarningSummary: {
    activeAlerts: number;
    byPriority: Record<AlertPriority, number>;
    activeTriggers: number;
    alertsLast30Days: number;
    avgResolutionTime: number;
  };
  
  indicatorsSummary: {
    trackedIndicators: number;
    warningIndicators: number;
    criticalIndicators: number;
    lastUpdateTime: Timestamp;
  };
  
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  
  generatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// FILTER TYPES
// ----------------------------------------------------------------------------

export interface PESTELAnalysisFilters {
  status?: string[];
  dimensions?: PESTELDimension[];
  industries?: string[];
  geographies?: string[];
  timeHorizon?: TimeHorizon[];
  impactLevel?: ImpactLevel[];
  dateRange?: { start: Timestamp; end: Timestamp };
}

export interface SignalFilters {
  signalType?: SignalType[];
  status?: SignalStatus[];
  dimension?: PESTELDimension[];
  source?: SignalSource[];
  industries?: string[];
  geographies?: string[];
  impactLevel?: ImpactLevel[];
  confidenceMin?: number;
  dateRange?: { start: Timestamp; end: Timestamp };
}

export interface RegulatoryFilters {
  category?: RegulatoryCategory[];
  status?: RegulatoryStatus[];
  complianceStatus?: ComplianceStatus[];
  jurisdiction?: string[];
  impactLevel?: ImpactLevel[];
  affectedAreas?: AffectedBusinessArea[];
  effectiveDateRange?: { start: Timestamp; end: Timestamp };
}

export interface ScenarioFilters {
  type?: ScenarioType[];
  status?: string[];
  industries?: string[];
  geographies?: string[];
  timeHorizon?: TimeHorizon[];
  probabilityRange?: { min: number; max: number };
}

export interface AlertFilters {
  priority?: AlertPriority[];
  status?: string[];
  sourceType?: string[];
  affectedAreas?: AffectedBusinessArea[];
  dateRange?: { start: Timestamp; end: Timestamp };
}

// ----------------------------------------------------------------------------
// FORM INPUT TYPES
// ----------------------------------------------------------------------------

export interface PESTELAnalysisFormInput {
  title: string;
  description: string;
  scope: {
    industries: string[];
    geographies: string[];
    timeHorizon: TimeHorizon;
    targetDate: Date;
  };
}

export interface PESTELFactorFormInput {
  dimension: PESTELDimension;
  subFactor: string;
  title: string;
  description: string;
  currentState: string;
  futureOutlook: string;
  impactLevel: ImpactLevel;
  probability: ProbabilityLevel;
  timeToImpact: TimeHorizon;
  type: 'opportunity' | 'threat' | 'neutral';
  affectedAreas: AffectedBusinessArea[];
  watchPriority: AlertPriority;
}

export interface SignalFormInput {
  title: string;
  description: string;
  signalType: SignalType;
  source: SignalSource;
  sourceDetails: {
    name: string;
    url?: string;
    author?: string;
    publicationDate?: Date;
  };
  pestelDimension: PESTELDimension;
  industries: string[];
  geographies: string[];
  affectedAreas: AffectedBusinessArea[];
  impactLevel: ImpactLevel;
  probability: ProbabilityLevel;
  timeToImpact: TimeHorizon;
  confidenceLevel: number;
  tags: string[];
}

export interface RegulatoryItemFormInput {
  title: string;
  officialName: string;
  referenceNumber?: string;
  description: string;
  category: RegulatoryCategory;
  subcategory?: string;
  jurisdiction: string;
  issuingAuthority: string;
  status: RegulatoryStatus;
  effectiveDate?: Date;
  impactLevel: ImpactLevel;
  affectedAreas: AffectedBusinessArea[];
  affectedSubsidiaries: string[];
}

export interface ScenarioFormInput {
  title: string;
  description: string;
  type: ScenarioType;
  scope: {
    industries: string[];
    geographies: string[];
    timeHorizon: TimeHorizon;
    targetYear: number;
  };
  probability: number;
  probabilityRationale: string;
}

export interface AlertTriggerFormInput {
  name: string;
  description: string;
  condition: TriggerCondition;
  threshold?: number;
  thresholdUnit?: string;
  pattern?: string;
  monitoringFrequency: 'real_time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  targetType: 'indicator' | 'signal' | 'regulation' | 'scenario' | 'custom';
  targetId?: string;
  alertPriority: AlertPriority;
  notifyRoles: string[];
  notifyUsers: string[];
}
