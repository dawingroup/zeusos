// ============================================================================
// PERFORMANCE REVIEW SCHEMAS
// DawinOS v2.0 - HR Module
// Zod validation schemas for Performance Management
// ============================================================================

import { z } from 'zod';
import {
  REVIEW_CYCLES,
  RATING_SCALES,
  GOAL_TYPES,
  GOAL_STATUS,
  FEEDBACK_TYPES,
  REVIEW_TEMPLATES,
} from '../constants/performance.constants';

// ----------------------------------------------------------------------------
// PERFORMANCE REVIEW SCHEMA
// ----------------------------------------------------------------------------

export const performanceReviewSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  managerId: z.string().min(1, 'Manager is required'),
  
  reviewCycle: z.enum([
    REVIEW_CYCLES.ANNUAL,
    REVIEW_CYCLES.SEMI_ANNUAL,
    REVIEW_CYCLES.QUARTERLY,
    REVIEW_CYCLES.MONTHLY,
    REVIEW_CYCLES.PROBATION,
    REVIEW_CYCLES.PROJECT_END,
    REVIEW_CYCLES.AD_HOC,
  ]),
  reviewTemplate: z.enum([
    REVIEW_TEMPLATES.STANDARD,
    REVIEW_TEMPLATES.PROBATION,
    REVIEW_TEMPLATES.LEADERSHIP,
    REVIEW_TEMPLATES.PROJECT,
    REVIEW_TEMPLATES.QUICK_CHECK,
  ]),
  
  periodStart: z.date(),
  periodEnd: z.date(),
  dueDate: z.date(),
  
  ratingScale: z.enum([
    RATING_SCALES.FIVE_POINT,
    RATING_SCALES.FOUR_POINT,
    RATING_SCALES.THREE_POINT,
    RATING_SCALES.PERCENTAGE,
  ]).default(RATING_SCALES.FIVE_POINT),
}).refine(
  (data) => data.periodEnd >= data.periodStart,
  { message: 'Period end must be after period start', path: ['periodEnd'] }
);

export type PerformanceReviewInput = z.infer<typeof performanceReviewSchema>;

// ----------------------------------------------------------------------------
// GOAL SCHEMA
// ----------------------------------------------------------------------------

export const performanceGoalSchema = z.object({
  title: z.string().min(1, 'Goal title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  type: z.enum([
    GOAL_TYPES.PERFORMANCE,
    GOAL_TYPES.DEVELOPMENT,
    GOAL_TYPES.PROJECT,
    GOAL_TYPES.BEHAVIORAL,
    GOAL_TYPES.STRETCH,
  ]),
  
  measurementType: z.enum(['quantitative', 'qualitative', 'milestone']),
  targetValue: z.number().optional(),
  targetUnit: z.string().max(50).optional(),
  
  milestones: z.array(z.object({
    title: z.string().min(1),
    dueDate: z.date(),
  })).optional(),
  
  weight: z.number().min(0).max(100).default(100),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  
  startDate: z.date(),
  dueDate: z.date(),
  
  alignedOkrId: z.string().optional(),
  alignedKpiId: z.string().optional(),
}).refine(
  (data) => data.dueDate >= data.startDate,
  { message: 'Due date must be after start date', path: ['dueDate'] }
);

export type PerformanceGoalInput = z.infer<typeof performanceGoalSchema>;

// ----------------------------------------------------------------------------
// GOAL UPDATE SCHEMA
// ----------------------------------------------------------------------------

export const goalUpdateSchema = z.object({
  progress: z.number().min(0).max(100),
  status: z.enum([
    GOAL_STATUS.NOT_STARTED,
    GOAL_STATUS.IN_PROGRESS,
    GOAL_STATUS.ON_TRACK,
    GOAL_STATUS.AT_RISK,
    GOAL_STATUS.COMPLETED,
    GOAL_STATUS.EXCEEDED,
    GOAL_STATUS.CANCELLED,
  ]),
  notes: z.string().max(2000),
  currentValue: z.number().optional(),
});

export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;

// ----------------------------------------------------------------------------
// COMPETENCY ASSESSMENT SCHEMA
// ----------------------------------------------------------------------------

export const competencyAssessmentItemSchema = z.object({
  competencyId: z.string().min(1),
  selfRating: z.number().min(1).max(5).optional(),
  managerRating: z.number().min(1).max(5).optional(),
  evidence: z.string().max(2000).optional(),
  developmentSuggestions: z.string().max(2000).optional(),
});

export const competencyAssessmentSchema = z.object({
  competencies: z.array(competencyAssessmentItemSchema),
});

export type CompetencyAssessmentInput = z.infer<typeof competencyAssessmentSchema>;

// ----------------------------------------------------------------------------
// FEEDBACK SCHEMA
// ----------------------------------------------------------------------------

export const feedbackSchema = z.object({
  targetEmployeeId: z.string().min(1, 'Target employee is required'),
  feedbackType: z.enum([
    FEEDBACK_TYPES.SELF,
    FEEDBACK_TYPES.MANAGER,
    FEEDBACK_TYPES.PEER,
    FEEDBACK_TYPES.DIRECT_REPORT,
    FEEDBACK_TYPES.EXTERNAL,
  ]),
  isAnonymous: z.boolean().default(false),
  
  context: z.enum(['review', 'continuous', '360', 'project', 'ad_hoc']),
  reviewId: z.string().optional(),
  
  ratings: z.record(z.string(), z.number().min(1).max(5)).optional(),
  strengths: z.array(z.string().max(500)).min(1, 'At least one strength required'),
  areasForImprovement: z.array(z.string().max(500)),
  comments: z.string().max(3000),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

// ----------------------------------------------------------------------------
// 360 FEEDBACK REQUEST SCHEMA
// ----------------------------------------------------------------------------

export const threeSixtyRequestSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  
  feedbackProviders: z.array(z.object({
    employeeId: z.string().min(1),
    relationship: z.enum([
      FEEDBACK_TYPES.SELF,
      FEEDBACK_TYPES.MANAGER,
      FEEDBACK_TYPES.PEER,
      FEEDBACK_TYPES.DIRECT_REPORT,
      FEEDBACK_TYPES.EXTERNAL,
    ]),
  })).min(3, 'At least 3 feedback providers required'),
  
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

export type ThreeSixtyRequestInput = z.infer<typeof threeSixtyRequestSchema>;

// ----------------------------------------------------------------------------
// PERFORMANCE IMPROVEMENT PLAN SCHEMA
// ----------------------------------------------------------------------------

export const performanceGapSchema = z.object({
  area: z.string().min(1, 'Performance area is required').max(200),
  expectedStandard: z.string().min(1, 'Expected standard is required').max(500),
  currentPerformance: z.string().min(1, 'Current performance description is required').max(500),
  gap: z.string().min(1, 'Gap description is required').max(500),
  evidence: z.array(z.string()).min(1, 'At least one piece of evidence required'),
});

export const pipObjectiveSchema = z.object({
  objective: z.string().min(1, 'Objective is required').max(500),
  successCriteria: z.string().min(1, 'Success criteria is required').max(500),
  targetDate: z.date(),
});

export const pipSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  managerId: z.string().min(1, 'Manager is required'),
  hrRepId: z.string().min(1, 'HR representative is required'),
  
  reason: z.string().min(1, 'Reason for PIP is required').max(2000),
  
  performanceGaps: z.array(performanceGapSchema).min(1, 'At least one performance gap required'),
  objectives: z.array(pipObjectiveSchema).min(1, 'At least one objective required'),
  supportProvided: z.array(z.string().max(500)),
  
  startDate: z.date(),
  durationDays: z.number().min(30).max(90),
});

export type PIPInput = z.infer<typeof pipSchema>;

// ----------------------------------------------------------------------------
// PIP CHECK-IN SCHEMA
// ----------------------------------------------------------------------------

export const pipCheckInSchema = z.object({
  progressSummary: z.string().min(1, 'Progress summary is required').max(2000),
  objectiveUpdates: z.array(z.object({
    objectiveId: z.string().min(1),
    progress: z.number().min(0).max(100),
    notes: z.string().max(1000),
  })),
  supportDiscussed: z.string().max(1000),
  nextSteps: z.array(z.string().max(500)),
});

export type PIPCheckInInput = z.infer<typeof pipCheckInSchema>;

// ----------------------------------------------------------------------------
// REVIEW SUBMISSION SCHEMAS
// ----------------------------------------------------------------------------

export const selfAssessmentSchema = z.object({
  goalsAssessment: z.array(z.object({
    goalId: z.string(),
    selfRating: z.number().min(1).max(5),
    achievementPercent: z.number().min(0).max(150),
    comments: z.string().max(2000).optional(),
  })),
  competencyAssessment: z.array(competencyAssessmentItemSchema),
  achievements: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000),
    impact: z.string().max(500),
  })),
  employeeComments: z.string().max(3000).optional(),
});

export type SelfAssessmentInput = z.infer<typeof selfAssessmentSchema>;

export const managerAssessmentSchema = z.object({
  goalsAssessment: z.array(z.object({
    goalId: z.string(),
    managerRating: z.number().min(1).max(5),
    achievementPercent: z.number().min(0).max(150),
    comments: z.string().max(2000).optional(),
  })),
  competencyAssessment: z.array(z.object({
    competencyId: z.string(),
    managerRating: z.number().min(1).max(5),
    evidence: z.string().max(2000).optional(),
    developmentSuggestions: z.string().max(2000).optional(),
  })),
  overallRating: z.number().min(1).max(5),
  performanceSummary: z.string().min(1, 'Performance summary is required').max(3000),
  strengths: z.array(z.string().max(500)),
  developmentAreas: z.array(z.string().max(500)),
  managerComments: z.string().max(3000).optional(),
  
  // Recommendations
  potentialAssessment: z.enum(['high_potential', 'promotable', 'well_placed', 'needs_development', 'action_required']),
  readinessForPromotion: z.enum(['ready_now', 'ready_1_year', 'ready_2_years', 'not_ready']),
  retentionRisk: z.enum(['low', 'medium', 'high']),
  compensationRecommendation: z.enum(['increase', 'bonus', 'promotion', 'no_change', 'review']).optional(),
});

export type ManagerAssessmentInput = z.infer<typeof managerAssessmentSchema>;
