// ============================================================================
// SUCCESSION TYPES
// DawinOS v2.0 - HR Module
// Type definitions for Succession Planning
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  RoleCriticalityLevel,
  CriticalityFactor,
  ReadinessLevel,
  PotentialRating,
  NineBoxCategory,
  SuccessionRiskLevel,
  FlightRiskFactor,
  DevelopmentActionType,
  SuccessionPlanStatus,
  DevelopmentPlanStatus,
  ActionStatus,
  VacancyReason,
  TalentPoolType,
  SuccessionReviewCycle,
  CompetencyGapPriority,
} from '../constants/succession.constants';

// ----------------------------------------------------------------------------
// CRITICAL ROLE
// ----------------------------------------------------------------------------

export interface CriticalRole {
  id: string;
  companyId: string;
  positionId: string;
  positionTitle: string;
  departmentId: string;
  departmentName: string;
  
  // Criticality assessment
  criticalityLevel: RoleCriticalityLevel;
  criticalityFactors: CriticalityFactorAssessment[];
  criticalityScore: number;
  
  // Current incumbent
  incumbentId?: string;
  incumbentName?: string;
  incumbentTenure?: number;
  incumbentAge?: number;
  expectedVacancyDate?: Timestamp;
  vacancyReason?: VacancyReason;
  
  // Succession status
  successors: SuccessorCandidate[];
  successionRisk: SuccessionRiskLevel;
  benchStrength: number;
  
  // Emergency backup
  emergencySuccessorId?: string;
  emergencySuccessorName?: string;
  
  // Metadata
  lastReviewDate: Timestamp;
  nextReviewDate: Timestamp;
  reviewedBy?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CriticalityFactorAssessment {
  factor: CriticalityFactor;
  score: number;
  weight: number;
  notes?: string;
}

// ----------------------------------------------------------------------------
// SUCCESSOR CANDIDATE
// ----------------------------------------------------------------------------

export interface SuccessorCandidate {
  id: string;
  employeeId: string;
  employeeName: string;
  currentPosition: string;
  currentDepartment: string;
  
  // Readiness assessment
  readinessLevel: ReadinessLevel;
  readinessScore: number;
  readinessAssessment: ReadinessAssessmentDetail;
  
  // Performance & Potential
  performanceRating: number;
  potentialRating: PotentialRating;
  nineBoxCategory: NineBoxCategory;
  
  // Gaps and development
  competencyGaps: CompetencyGap[];
  developmentPlanId?: string;
  
  // Candidate preferences
  interestedInRole: boolean;
  willingToRelocate?: boolean;
  
  // Flight risk
  flightRisk: 'low' | 'medium' | 'high';
  flightRiskFactors: FlightRiskFactor[];
  
  // Ranking
  rank: number;
  lastAssessedDate: Timestamp;
  assessedBy: string;
}

export interface ReadinessAssessmentDetail {
  leadershipCompetencies: number;
  technicalExpertise: number;
  businessAcumen: number;
  stakeholderManagement: number;
  strategicThinking: number;
  teamManagement: number;
  ugandaMarketKnowledge?: number;
  overallReadiness: number;
  assessmentNotes?: string;
}

export interface CompetencyGap {
  competency: string;
  currentLevel: number;
  requiredLevel: number;
  gapSize: number;
  priority: CompetencyGapPriority;
  developmentActions: string[];
}

// ----------------------------------------------------------------------------
// DEVELOPMENT PLAN
// ----------------------------------------------------------------------------

export interface DevelopmentPlan {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  targetRoleId?: string;
  targetRoleTitle?: string;
  
  // Plan details
  objective: string;
  targetReadiness: ReadinessLevel;
  targetDate: Timestamp;
  
  // Actions
  actions: DevelopmentAction[];
  
  // Progress
  overallProgress: number;
  status: DevelopmentPlanStatus;
  
  // Ownership
  ownerId: string;
  sponsorId?: string;
  mentorId?: string;
  
  // Review
  lastReviewDate?: Timestamp;
  nextReviewDate: Timestamp;
  reviewNotes?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DevelopmentAction {
  id: string;
  type: DevelopmentActionType;
  title: string;
  description: string;
  targetCompetency?: string;
  
  // Timeline
  startDate: Timestamp;
  endDate: Timestamp;
  
  // Status
  status: ActionStatus;
  progress: number;
  
  // Resources
  resources?: string[];
  estimatedCost?: number;
  actualCost?: number;
  
  // Outcome
  expectedOutcome: string;
  actualOutcome?: string;
  completedAt?: Timestamp;
}

// ----------------------------------------------------------------------------
// TALENT POOL
// ----------------------------------------------------------------------------

export interface TalentPool {
  id: string;
  companyId: string;
  name: string;
  description: string;
  poolType: TalentPoolType;
  targetLevel: string;
  
  // Members
  members: TalentPoolMember[];
  memberCount: number;
  
  // Metrics
  averageReadiness: number;
  readyNowCount: number;
  ready1YearCount: number;
  
  // Management
  ownerId: string;
  ownerName: string;
  reviewCycle: SuccessionReviewCycle;
  lastReviewDate: Timestamp;
  nextReviewDate: Timestamp;
  
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TalentPoolMember {
  employeeId: string;
  employeeName: string;
  currentPosition: string;
  nineBoxCategory: NineBoxCategory;
  readinessLevel: ReadinessLevel;
  addedDate: Timestamp;
  addedBy: string;
  lastAssessedDate: Timestamp;
}

// ----------------------------------------------------------------------------
// SUCCESSION PLAN
// ----------------------------------------------------------------------------

export interface SuccessionPlan {
  id: string;
  companyId: string;
  name: string;
  description: string;
  fiscalYear: string;
  
  // Scope
  scope: 'company' | 'subsidiary' | 'department';
  scopeId?: string;
  
  // Roles included
  criticalRoleIds: string[];
  
  // Summary metrics
  totalCriticalRoles: number;
  rolesWithSuccessors: number;
  readyNowCoverage: number;
  averageBenchStrength: number;
  highRiskRoles: number;
  
  // Status
  status: SuccessionPlanStatus;
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  // Review
  lastReviewDate: Timestamp;
  nextReviewDate: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// ANALYTICS
// ----------------------------------------------------------------------------

export interface SuccessionAnalytics {
  companyId: string;
  asOfDate: Timestamp;
  
  // Critical role coverage
  totalCriticalRoles: number;
  rolesWithReadySuccessor: number;
  rolesWithPipelineSuccessor: number;
  rolesWithNoSuccessor: number;
  overallCoverage: number;
  
  // Risk distribution
  criticalRiskCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  
  // Talent pool health
  totalTalentPoolMembers: number;
  nineBoxDistribution: Record<NineBoxCategory, number>;
  readinessDistribution: Record<ReadinessLevel, number>;
  
  // Development metrics
  activeDevelopmentPlans: number;
  onTrackPlans: number;
  atRiskPlans: number;
  
  // Trends
  coverageTrend: TrendDataPoint[];
  riskTrend: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: Timestamp;
  value: number;
  label?: string;
}

// ----------------------------------------------------------------------------
// FILTERS
// ----------------------------------------------------------------------------

export interface CriticalRoleFilters {
  departmentId?: string;
  criticalityLevel?: RoleCriticalityLevel;
  successionRisk?: SuccessionRiskLevel;
  hasSuccessor?: boolean;
}

export interface TalentFilters {
  departmentId?: string;
  nineBoxCategory?: NineBoxCategory;
  readinessLevel?: ReadinessLevel;
  flightRisk?: 'low' | 'medium' | 'high';
  poolId?: string;
}

export interface DevelopmentPlanFilters {
  employeeId?: string;
  status?: DevelopmentPlanStatus;
  targetRoleId?: string;
}
