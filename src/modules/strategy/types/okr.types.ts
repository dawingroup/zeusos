// ============================================================================
// OKR TYPES - DawinOS CEO Strategy Command
// TypeScript interfaces for OKR management
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  OKRLevel,
  OKRStatus,
  OKRCycle,
  OKRCycleStatus,
  KeyResultType,
  ConfidenceLevel,
  CheckInFrequency,
  OKRAlignmentType,
  OKRVisibility,
  OKROwnerType,
  OKRScoringMethod,
} from '../constants/okr.constants';

// ----------------------------------------------------------------------------
// OKR Objective
// ----------------------------------------------------------------------------
export interface OKRObjective {
  id: string;
  companyId: string;
  
  // Hierarchy
  level: OKRLevel;
  ownerId: string;
  ownerType: OKROwnerType;
  ownerName: string;
  ownerAvatarUrl?: string;
  
  // Cycle
  cycle: OKRCycle;
  cycleId: string;
  year: number;
  quarter?: number;
  
  // Content
  title: string;
  description?: string;
  category?: string;
  
  // Status
  status: OKRStatus;
  
  // Key Results
  keyResults: KeyResult[];
  
  // Scoring
  score: number;
  progress: number;
  
  // Alignment
  parentOKRId?: string;
  parentOKRTitle?: string;
  alignedStrategyPillarId?: string;
  alignedStrategyPillarName?: string;
  alignedStrategyObjectiveId?: string;
  alignedStrategyObjectiveTitle?: string;
  childOKRIds: string[];
  
  // Metadata
  tags: string[];
  visibility: OKRVisibility;
  isStretch: boolean;
  
  // Check-ins
  checkInFrequency: CheckInFrequency;
  lastCheckInDate?: Timestamp;
  nextCheckInDate?: Timestamp;
  checkInCount: number;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName?: string;
  updatedBy: string;
  updatedByName?: string;
}

// ----------------------------------------------------------------------------
// Key Result
// ----------------------------------------------------------------------------
export interface KeyResult {
  id: string;
  objectiveId: string;
  
  // Content
  title: string;
  description?: string;
  
  // Type & Measurement
  type: KeyResultType;
  unit?: string;
  
  // Values
  startValue: number;
  targetValue: number;
  currentValue: number;
  stretchValue?: number;
  
  // For milestone type
  milestones: KeyResultMilestone[];
  
  // Scoring
  score: number;
  progress: number;
  
  // Confidence
  confidence: ConfidenceLevel;
  confidenceNote?: string;
  
  // Ownership
  ownerId?: string;
  ownerName?: string;
  
  // Status
  isComplete: boolean;
  completedAt?: Timestamp;
  
  // Metadata
  order: number;
  weight: number;
  
  // History
  checkIns: KeyResultCheckIn[];
}

// ----------------------------------------------------------------------------
// Key Result Milestone
// ----------------------------------------------------------------------------
export interface KeyResultMilestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: Timestamp;
  isComplete: boolean;
  completedAt?: Timestamp;
  completedBy?: string;
  completedByName?: string;
  order: number;
}

// ----------------------------------------------------------------------------
// Key Result Check-In
// ----------------------------------------------------------------------------
export interface KeyResultCheckIn {
  id: string;
  keyResultId: string;
  objectiveId: string;
  date: Timestamp;
  previousValue: number;
  newValue: number;
  previousScore: number;
  newScore: number;
  confidence: ConfidenceLevel;
  note?: string;
  blockers: string[];
  wins: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp;
}

// ----------------------------------------------------------------------------
// OKR Cycle Period
// ----------------------------------------------------------------------------
export interface OKRCyclePeriod {
  id: string;
  companyId: string;
  cycle: OKRCycle;
  year: number;
  quarter?: number;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: OKRCycleStatus;
  planningDeadline?: Timestamp;
  reviewStartDate?: Timestamp;
  settings: OKRCycleSettings;
  objectiveCount: number;
  averageScore: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface OKRCycleSettings {
  allowStretchGoals: boolean;
  requireAlignment: boolean;
  minKeyResultsPerObjective: number;
  maxKeyResultsPerObjective: number;
  defaultCheckInFrequency: CheckInFrequency;
  autoRemindCheckIns: boolean;
  scoringMethod: OKRScoringMethod;
  gracePeriodsEnabled: boolean;
}

// ----------------------------------------------------------------------------
// OKR Alignment
// ----------------------------------------------------------------------------
export interface OKRAlignment {
  id: string;
  companyId: string;
  sourceOKRId: string;
  sourceOKRTitle: string;
  targetOKRId: string;
  targetOKRTitle: string;
  alignmentType: OKRAlignmentType;
  contributionPercentage?: number;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
}

// ----------------------------------------------------------------------------
// OKR Score History
// ----------------------------------------------------------------------------
export interface OKRScoreHistory {
  id: string;
  objectiveId: string;
  cycleId: string;
  date: Timestamp;
  score: number;
  progress: number;
  keyResultScores: KeyResultScoreSnapshot[];
  recordedBy: string;
}

export interface KeyResultScoreSnapshot {
  keyResultId: string;
  title: string;
  score: number;
  progress: number;
  currentValue: number;
  confidence: ConfidenceLevel;
}

// ----------------------------------------------------------------------------
// OKR Analytics
// ----------------------------------------------------------------------------
export interface OKRAnalytics {
  companyId: string;
  cycleId: string;
  cycleName: string;
  asOfDate: Timestamp;
  
  // Totals
  totalObjectives: number;
  totalKeyResults: number;
  totalCheckIns: number;
  
  // By Status
  objectivesByStatus: Record<OKRStatus, number>;
  
  // By Level
  objectivesByLevel: Record<OKRLevel, number>;
  
  // Scoring
  averageScore: number;
  medianScore: number;
  scoreDistribution: OKRScoreDistribution;
  
  // Alignment
  alignedToStrategyCount: number;
  alignedToParentCount: number;
  orphanedCount: number;
  
  // Confidence
  onTrackCount: number;
  atRiskCount: number;
  offTrackCount: number;
  
  // Engagement
  averageCheckInsPerOKR: number;
  staleOKRsCount: number;
  activeContributors: number;
  
  // Trends
  scoreChange7Days?: number;
  scoreChange30Days?: number;
}

export interface OKRScoreDistribution {
  stretch: number;
  target: number;
  partial: number;
  miss: number;
}

// ----------------------------------------------------------------------------
// OKR Summary (For cards/lists)
// ----------------------------------------------------------------------------
export interface OKRSummary {
  id: string;
  title: string;
  level: OKRLevel;
  ownerName: string;
  ownerAvatarUrl?: string;
  status: OKRStatus;
  score: number;
  progress: number;
  keyResultCount: number;
  completedKeyResultCount: number;
  overallConfidence: ConfidenceLevel;
  lastCheckInDate?: Timestamp;
  daysUntilNextCheckIn?: number;
  isStale: boolean;
  hasBlockers: boolean;
}

// ----------------------------------------------------------------------------
// OKR Tree Node (For visualization)
// ----------------------------------------------------------------------------
export interface OKRTreeNode {
  objective: OKRObjective;
  children: OKRTreeNode[];
  level: number;
  alignmentType?: OKRAlignmentType;
  isExpanded?: boolean;
}

// ----------------------------------------------------------------------------
// Form Input Types
// ----------------------------------------------------------------------------
export interface CreateObjectiveInput {
  level: OKRLevel;
  ownerId: string;
  ownerType: OKROwnerType;
  ownerName: string;
  ownerAvatarUrl?: string;
  cycleId: string;
  title: string;
  description?: string;
  category?: string;
  parentOKRId?: string;
  alignedStrategyPillarId?: string;
  alignedStrategyObjectiveId?: string;
  tags?: string[];
  visibility?: OKRVisibility;
  isStretch?: boolean;
  checkInFrequency?: CheckInFrequency;
  keyResults?: CreateKeyResultInput[];
}

export interface UpdateObjectiveInput {
  title?: string;
  description?: string;
  category?: string;
  status?: OKRStatus;
  parentOKRId?: string | null;
  alignedStrategyPillarId?: string | null;
  alignedStrategyObjectiveId?: string | null;
  tags?: string[];
  visibility?: OKRVisibility;
  checkInFrequency?: CheckInFrequency;
}

export interface CreateKeyResultInput {
  title: string;
  description?: string;
  type: KeyResultType;
  unit?: string;
  startValue: number;
  targetValue: number;
  stretchValue?: number;
  milestones?: CreateMilestoneInput[];
  ownerId?: string;
  ownerName?: string;
  weight?: number;
}

export interface UpdateKeyResultInput {
  title?: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  stretchValue?: number;
  confidence?: ConfidenceLevel;
  confidenceNote?: string;
  ownerId?: string | null;
  ownerName?: string | null;
  weight?: number;
}

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  targetDate?: Date;
  order?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  targetDate?: Date | null;
  isComplete?: boolean;
}

export interface CheckInInput {
  keyResultId: string;
  newValue: number;
  confidence: ConfidenceLevel;
  note?: string;
  blockers?: string[];
  wins?: string[];
}

export interface BulkCheckInInput {
  objectiveId: string;
  checkIns: Omit<CheckInInput, 'keyResultId'> & { keyResultId: string }[];
}

export interface CreateCycleInput {
  cycle: OKRCycle;
  year: number;
  quarter?: number;
  name: string;
  startDate: Date;
  endDate: Date;
  planningDeadline?: Date;
  reviewStartDate?: Date;
  settings?: Partial<OKRCycleSettings>;
}

export interface UpdateCycleInput {
  name?: string;
  status?: OKRCycleStatus;
  planningDeadline?: Date | null;
  reviewStartDate?: Date | null;
  settings?: Partial<OKRCycleSettings>;
}

// ----------------------------------------------------------------------------
// Filter Types
// ----------------------------------------------------------------------------
export interface OKRFilters {
  cycleId?: string;
  ownerId?: string;
  ownerType?: OKROwnerType;
  level?: OKRLevel;
  status?: OKRStatus;
  parentOKRId?: string | null;
  alignedStrategyPillarId?: string;
  visibility?: OKRVisibility;
  isStretch?: boolean;
  tags?: string[];
  searchQuery?: string;
  includeChildren?: boolean;
}

export interface CycleFilters {
  year?: number;
  status?: OKRCycleStatus;
  cycle?: OKRCycle;
}

// ----------------------------------------------------------------------------
// Progress Tracking
// ----------------------------------------------------------------------------
export interface OKRProgressUpdate {
  objectiveId: string;
  keyResultId: string;
  previousValue: number;
  newValue: number;
  previousScore: number;
  newScore: number;
  timestamp: Timestamp;
  updatedBy: string;
}

export interface OKRProgressTrend {
  objectiveId: string;
  title: string;
  dataPoints: {
    date: Timestamp;
    score: number;
    progress: number;
  }[];
  averageWeeklyProgress: number;
  projectedEndScore: number;
}

// ----------------------------------------------------------------------------
// Dashboard Types
// ----------------------------------------------------------------------------
export interface OKRDashboardData {
  activeCycle: OKRCyclePeriod | null;
  myOKRs: OKRSummary[];
  teamOKRs: OKRSummary[];
  companyOKRs: OKRSummary[];
  analytics: OKRAnalytics | null;
  recentCheckIns: KeyResultCheckIn[];
  upcomingCheckIns: OKRSummary[];
  atRiskOKRs: OKRSummary[];
}

export interface OKRLeaderboard {
  cycleId: string;
  cycleName: string;
  topPerformers: {
    ownerId: string;
    ownerName: string;
    ownerAvatarUrl?: string;
    level: OKRLevel;
    averageScore: number;
    objectiveCount: number;
    completedCount: number;
  }[];
  mostImproved: {
    ownerId: string;
    ownerName: string;
    scoreChange: number;
  }[];
}
