// ============================================================================
// PERFORMANCE REVIEW TYPES
// DawinOS v2.0 - HR Module
// Type definitions for Performance Management
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  ReviewCycle,
  ReviewStatus,
  RatingScale,
  CompetencyCategory,
  GoalType,
  GoalStatus,
  FeedbackType,
  ReviewTemplate,
  PIPStatus,
} from '../constants/performance.constants';

// ----------------------------------------------------------------------------
// PERFORMANCE REVIEW
// ----------------------------------------------------------------------------

export interface PerformanceReview {
  id: string;
  companyId: string;
  
  // Employee info
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  departmentId: string;
  departmentName: string;
  
  // Manager info
  managerId: string;
  managerName: string;
  
  // Review details
  reviewCycle: ReviewCycle;
  reviewTemplate: ReviewTemplate;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  
  // Status
  status: ReviewStatus;
  currentStep: number;
  totalSteps: number;
  
  // Ratings
  ratingScale: RatingScale;
  selfRating?: number;
  managerRating?: number;
  calibratedRating?: number;
  finalRating?: number;
  
  // Sections
  goalsAssessment?: GoalsAssessment;
  competencyAssessment?: CompetencyAssessment;
  achievementsSection?: AchievementsSection;
  developmentSection?: DevelopmentSection;
  overallSection?: OverallSection;
  
  // Comments
  employeeComments?: string;
  managerComments?: string;
  hrComments?: string;
  
  // Acknowledgement
  employeeAcknowledged: boolean;
  employeeAcknowledgedAt?: Timestamp;
  employeeDisagreement?: string;
  
  // Calibration
  calibrationNotes?: string;
  calibratedBy?: string;
  calibratedAt?: Timestamp;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

// ----------------------------------------------------------------------------
// GOALS ASSESSMENT
// ----------------------------------------------------------------------------

export interface GoalsAssessment {
  goals: GoalAssessmentItem[];
  overallGoalRating: number;
  weightedScore: number;
  summary?: string;
}

export interface GoalAssessmentItem {
  goalId: string;
  goalTitle: string;
  goalType: GoalType;
  weight: number;
  targetValue?: number;
  actualValue?: number;
  achievementPercent: number;
  selfRating?: number;
  managerRating?: number;
  finalRating: number;
  employeeComments?: string;
  managerComments?: string;
}

// ----------------------------------------------------------------------------
// COMPETENCY ASSESSMENT
// ----------------------------------------------------------------------------

export interface CompetencyAssessment {
  competencies: CompetencyAssessmentItem[];
  categoryScores: Record<CompetencyCategory, number>;
  overallCompetencyRating: number;
}

export interface CompetencyAssessmentItem {
  competencyId: string;
  competencyName: string;
  category: CompetencyCategory;
  description: string;
  expectedLevel: number;
  selfRating?: number;
  managerRating?: number;
  finalRating: number;
  gap: number;
  evidence?: string;
  developmentSuggestions?: string;
}

// ----------------------------------------------------------------------------
// ACHIEVEMENTS SECTION
// ----------------------------------------------------------------------------

export interface AchievementsSection {
  keyAchievements: Achievement[];
  challengesOvercome: string[];
  impactHighlights: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: Date;
  impact: string;
  metrics?: string;
  recognition?: string;
}

// ----------------------------------------------------------------------------
// DEVELOPMENT SECTION
// ----------------------------------------------------------------------------

export interface DevelopmentSection {
  strengthsIdentified: string[];
  areasForImprovement: string[];
  developmentGoals: DevelopmentGoal[];
  trainingRecommendations: TrainingRecommendation[];
  careerAspirations?: string;
}

export interface DevelopmentGoal {
  id: string;
  title: string;
  description: string;
  targetDate: Date;
  supportRequired?: string;
  successMeasure: string;
  priority: 'high' | 'medium' | 'low';
}

export interface TrainingRecommendation {
  id: string;
  title: string;
  type: 'course' | 'workshop' | 'certification' | 'mentoring' | 'on_the_job' | 'external';
  provider?: string;
  estimatedCost?: number;
  estimatedDuration?: string;
  priority: 'required' | 'recommended' | 'optional';
  deadline?: Date;
}

// ----------------------------------------------------------------------------
// OVERALL SECTION
// ----------------------------------------------------------------------------

export interface OverallSection {
  performanceSummary: string;
  potentialAssessment: 'high_potential' | 'promotable' | 'well_placed' | 'needs_development' | 'action_required';
  readinessForPromotion: 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'not_ready';
  retentionRisk: 'low' | 'medium' | 'high';
  compensationRecommendation?: 'increase' | 'bonus' | 'promotion' | 'no_change' | 'review';
  nextReviewDate?: Date;
}

// ----------------------------------------------------------------------------
// PERFORMANCE GOAL
// ----------------------------------------------------------------------------

export interface PerformanceGoal {
  id: string;
  companyId: string;
  employeeId: string;
  
  // Goal details
  title: string;
  description: string;
  type: GoalType;
  
  // Alignment
  alignedOkrId?: string;
  alignedKpiId?: string;
  departmentGoalId?: string;
  
  // Measurement
  measurementType: 'quantitative' | 'qualitative' | 'milestone';
  targetValue?: number;
  targetUnit?: string;
  currentValue?: number;
  milestones?: GoalMilestone[];
  
  // Weight & Priority
  weight: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // Timeline
  startDate: Date;
  dueDate: Date;
  completedDate?: Date;
  
  // Status
  status: GoalStatus;
  progress: number;

  // Classification
  category?: string;

  // Updates
  updates: GoalUpdate[];
  
  // Review period
  reviewCycle?: ReviewCycle;
  reviewId?: string;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GoalMilestone {
  id: string;
  title: string;
  dueDate: Date;
  completedDate?: Date;
  isCompleted: boolean;
}

export interface GoalUpdate {
  id: string;
  date: Date;
  progress: number;
  status: GoalStatus;
  notes: string;
  updatedBy: string;
}

// ----------------------------------------------------------------------------
// FEEDBACK
// ----------------------------------------------------------------------------

export interface Feedback {
  id: string;
  companyId: string;
  
  // Target
  targetEmployeeId: string;
  targetEmployeeName: string;
  
  // Source
  feedbackType: FeedbackType;
  sourceEmployeeId?: string;
  sourceEmployeeName?: string;
  isAnonymous: boolean;
  
  // Context
  reviewId?: string;
  context: 'review' | 'continuous' | '360' | 'project' | 'ad_hoc';
  
  // Feedback content
  ratings?: Record<string, number>;
  strengths: string[];
  areasForImprovement: string[];
  comments: string;
  
  // Status
  status: 'requested' | 'in_progress' | 'submitted' | 'reviewed';
  requestedAt?: Timestamp;
  submittedAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// 360 FEEDBACK
// ----------------------------------------------------------------------------

export interface ThreeSixtyFeedback {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  
  // Feedback collection
  feedbackRequests: FeedbackRequest[];
  
  // Aggregated results
  aggregatedRatings?: Record<string, AggregatedRating>;
  competencyScores?: Record<string, number>;
  overallScore?: number;
  
  // Summary
  consolidatedStrengths: string[];
  consolidatedDevelopmentAreas: string[];
  themes: string[];
  
  // Status
  status: 'setup' | 'collecting' | 'completed' | 'reviewed';
  responseRate: number;
  
  // Timeline
  startDate: Date;
  endDate: Date;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FeedbackRequest {
  feedbackId: string;
  requestedFrom: string;
  requestedFromName: string;
  relationship: FeedbackType;
  status: 'pending' | 'completed' | 'declined';
  requestedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface AggregatedRating {
  competencyId: string;
  selfRating?: number;
  managerRating?: number;
  peerAverage?: number;
  directReportAverage?: number;
  overallAverage: number;
  responseCount: number;
}

// ----------------------------------------------------------------------------
// PERFORMANCE IMPROVEMENT PLAN
// ----------------------------------------------------------------------------

export interface PerformanceImprovementPlan {
  id: string;
  companyId: string;
  
  // Employee
  employeeId: string;
  employeeName: string;
  departmentId: string;
  
  // Manager
  managerId: string;
  managerName: string;
  
  // HR oversight
  hrRepId: string;
  hrRepName: string;
  
  // Plan details
  reason: string;
  performanceGaps: PerformanceGap[];
  objectives: PIPObjective[];
  supportProvided: string[];
  
  // Timeline
  startDate: Date;
  endDate: Date;
  durationDays: number;
  
  // Check-ins
  checkIns: PIPCheckIn[];
  nextCheckInDate?: Date;
  
  // Status
  status: PIPStatus;
  outcome?: 'improvement_shown' | 'extended' | 'termination_recommended' | 'role_change';
  
  // Signatures
  employeeSignedAt?: Timestamp;
  managerSignedAt?: Timestamp;
  hrSignedAt?: Timestamp;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface PerformanceGap {
  id: string;
  area: string;
  expectedStandard: string;
  currentPerformance: string;
  gap: string;
  evidence: string[];
}

export interface PIPObjective {
  id: string;
  objective: string;
  successCriteria: string;
  targetDate: Date;
  status: 'pending' | 'in_progress' | 'achieved' | 'not_achieved';
  progress: number;
  notes?: string;
}

export interface PIPCheckIn {
  id: string;
  date: Date;
  attendees: string[];
  progressSummary: string;
  objectiveUpdates: Array<{
    objectiveId: string;
    progress: number;
    notes: string;
  }>;
  supportDiscussed: string;
  nextSteps: string[];
  conductedBy: string;
}

// ----------------------------------------------------------------------------
// FILTERS & PARAMS
// ----------------------------------------------------------------------------

export interface PerformanceReviewFilters {
  employeeId?: string;
  managerId?: string;
  departmentId?: string;
  reviewCycle?: ReviewCycle;
  status?: ReviewStatus;
  ratingRange?: { min: number; max: number };
  periodStart?: Date;
  periodEnd?: Date;
}

export interface GoalFilters {
  employeeId?: string;
  departmentId?: string;
  type?: GoalType;
  status?: GoalStatus;
  reviewCycle?: ReviewCycle;
  dueAfter?: Date;
  dueBefore?: Date;
}
