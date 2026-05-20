// ============================================================================
// SUCCESSION SCHEMAS
// DawinOS v2.0 - HR Module
// Zod validation schemas for Succession Planning
// ============================================================================

import { z } from 'zod';
import {
  ROLE_CRITICALITY_LEVELS,
  CRITICALITY_FACTORS,
  READINESS_LEVELS,
  POTENTIAL_RATINGS,
  DEVELOPMENT_ACTION_TYPES,
  COMPETENCY_GAP_PRIORITIES,
  TALENT_POOL_TYPES,
  SUCCESSION_REVIEW_CYCLES,
  VACANCY_REASONS,
} from '../constants/succession.constants';

// ----------------------------------------------------------------------------
// CRITICAL ROLE SCHEMAS
// ----------------------------------------------------------------------------

export const criticalityFactorAssessmentSchema = z.object({
  factor: z.enum([
    CRITICALITY_FACTORS.REVENUE_IMPACT,
    CRITICALITY_FACTORS.CLIENT_RELATIONSHIPS,
    CRITICALITY_FACTORS.SPECIALIZED_KNOWLEDGE,
    CRITICALITY_FACTORS.REGULATORY_COMPLIANCE,
    CRITICALITY_FACTORS.TEAM_DEPENDENCY,
    CRITICALITY_FACTORS.MARKET_SCARCITY,
    CRITICALITY_FACTORS.STRATEGIC_IMPORTANCE,
  ]),
  score: z.number().min(1).max(5),
  weight: z.number().min(0).max(100),
  notes: z.string().max(500).optional(),
});

export const criticalRoleInputSchema = z.object({
  positionId: z.string().min(1),
  positionTitle: z.string().min(1).max(200),
  departmentId: z.string().min(1),
  departmentName: z.string().min(1).max(200),
  criticalityLevel: z.enum([
    ROLE_CRITICALITY_LEVELS.MISSION_CRITICAL,
    ROLE_CRITICALITY_LEVELS.HIGH,
    ROLE_CRITICALITY_LEVELS.MEDIUM,
    ROLE_CRITICALITY_LEVELS.LOW,
  ]),
  criticalityFactors: z.array(criticalityFactorAssessmentSchema).min(1),
  incumbentId: z.string().optional(),
  expectedVacancyDate: z.date().optional(),
  vacancyReason: z.enum([
    VACANCY_REASONS.RETIREMENT,
    VACANCY_REASONS.PROMOTION,
    VACANCY_REASONS.RESIGNATION,
    VACANCY_REASONS.PLANNED_EXIT,
    VACANCY_REASONS.UNKNOWN,
  ]).optional(),
  emergencySuccessorId: z.string().optional(),
  notes: z.string().max(1000).optional(),
}).refine(data => {
  const totalWeight = data.criticalityFactors.reduce((sum, f) => sum + f.weight, 0);
  return totalWeight === 100;
}, { message: 'Criticality factor weights must sum to 100%' });

export type CriticalRoleInput = z.infer<typeof criticalRoleInputSchema>;

export const criticalRoleUpdateSchema = criticalRoleInputSchema.partial();

export type CriticalRoleUpdate = z.infer<typeof criticalRoleUpdateSchema>;

// ----------------------------------------------------------------------------
// SUCCESSOR CANDIDATE SCHEMAS
// ----------------------------------------------------------------------------

export const readinessAssessmentSchema = z.object({
  leadershipCompetencies: z.number().min(0).max(100),
  technicalExpertise: z.number().min(0).max(100),
  businessAcumen: z.number().min(0).max(100),
  stakeholderManagement: z.number().min(0).max(100),
  strategicThinking: z.number().min(0).max(100),
  teamManagement: z.number().min(0).max(100),
  ugandaMarketKnowledge: z.number().min(0).max(100).optional(),
  assessmentNotes: z.string().max(1000).optional(),
});

export const competencyGapSchema = z.object({
  competency: z.string().min(1).max(100),
  currentLevel: z.number().min(1).max(5),
  requiredLevel: z.number().min(1).max(5),
  priority: z.enum([
    COMPETENCY_GAP_PRIORITIES.CRITICAL,
    COMPETENCY_GAP_PRIORITIES.HIGH,
    COMPETENCY_GAP_PRIORITIES.MEDIUM,
    COMPETENCY_GAP_PRIORITIES.LOW,
  ]),
  developmentActions: z.array(z.string()).optional(),
});

export const successorCandidateInputSchema = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1).max(200),
  currentPosition: z.string().min(1).max(200),
  currentDepartment: z.string().min(1).max(200),
  readinessLevel: z.enum([
    READINESS_LEVELS.READY_NOW,
    READINESS_LEVELS.READY_1_YEAR,
    READINESS_LEVELS.READY_2_YEARS,
    READINESS_LEVELS.READY_3_PLUS,
    READINESS_LEVELS.NOT_READY,
  ]),
  readinessAssessment: readinessAssessmentSchema,
  performanceRating: z.number().min(1).max(5),
  potentialRating: z.enum([
    POTENTIAL_RATINGS.HIGH,
    POTENTIAL_RATINGS.MEDIUM,
    POTENTIAL_RATINGS.LOW,
  ]),
  competencyGaps: z.array(competencyGapSchema).optional(),
  interestedInRole: z.boolean(),
  willingToRelocate: z.boolean().optional(),
  flightRisk: z.enum(['low', 'medium', 'high']),
  rank: z.number().min(1).max(10),
});

export type SuccessorCandidateInput = z.infer<typeof successorCandidateInputSchema>;

// ----------------------------------------------------------------------------
// DEVELOPMENT PLAN SCHEMAS
// ----------------------------------------------------------------------------

export const developmentActionInputSchema = z.object({
  type: z.enum([
    DEVELOPMENT_ACTION_TYPES.STRETCH_ASSIGNMENT,
    DEVELOPMENT_ACTION_TYPES.JOB_ROTATION,
    DEVELOPMENT_ACTION_TYPES.MENTORING,
    DEVELOPMENT_ACTION_TYPES.COACHING,
    DEVELOPMENT_ACTION_TYPES.TRAINING,
    DEVELOPMENT_ACTION_TYPES.CERTIFICATION,
    DEVELOPMENT_ACTION_TYPES.EXPOSURE,
    DEVELOPMENT_ACTION_TYPES.PROJECT_LEAD,
    DEVELOPMENT_ACTION_TYPES.ACTING_ROLE,
    DEVELOPMENT_ACTION_TYPES.SHADOWING,
  ]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  targetCompetency: z.string().max(100).optional(),
  startDate: z.date(),
  endDate: z.date(),
  resources: z.array(z.string()).optional(),
  estimatedCost: z.number().min(0).optional(),
  expectedOutcome: z.string().max(500),
});

export type DevelopmentActionInput = z.infer<typeof developmentActionInputSchema>;

export const developmentPlanInputSchema = z.object({
  employeeId: z.string().min(1),
  targetRoleId: z.string().optional(),
  targetRoleTitle: z.string().max(200).optional(),
  objective: z.string().min(10).max(500),
  targetReadiness: z.enum([
    READINESS_LEVELS.READY_NOW,
    READINESS_LEVELS.READY_1_YEAR,
    READINESS_LEVELS.READY_2_YEARS,
    READINESS_LEVELS.READY_3_PLUS,
    READINESS_LEVELS.NOT_READY,
  ]),
  targetDate: z.date(),
  actions: z.array(developmentActionInputSchema).min(1),
  sponsorId: z.string().optional(),
  mentorId: z.string().optional(),
});

export type DevelopmentPlanInput = z.infer<typeof developmentPlanInputSchema>;

export const developmentPlanUpdateSchema = developmentPlanInputSchema.partial();

export type DevelopmentPlanUpdate = z.infer<typeof developmentPlanUpdateSchema>;

// ----------------------------------------------------------------------------
// TALENT POOL SCHEMAS
// ----------------------------------------------------------------------------

export const talentPoolInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  poolType: z.enum([
    TALENT_POOL_TYPES.LEADERSHIP,
    TALENT_POOL_TYPES.TECHNICAL,
    TALENT_POOL_TYPES.FUNCTIONAL,
    TALENT_POOL_TYPES.GENERAL,
  ]),
  targetLevel: z.string().min(1),
  reviewCycle: z.enum([
    SUCCESSION_REVIEW_CYCLES.QUARTERLY,
    SUCCESSION_REVIEW_CYCLES.SEMI_ANNUAL,
    SUCCESSION_REVIEW_CYCLES.ANNUAL,
  ]),
});

export type TalentPoolInput = z.infer<typeof talentPoolInputSchema>;

export const talentPoolMemberInputSchema = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1).max(200),
  currentPosition: z.string().min(1).max(200),
});

export type TalentPoolMemberInput = z.infer<typeof talentPoolMemberInputSchema>;

// ----------------------------------------------------------------------------
// SUCCESSION PLAN SCHEMAS
// ----------------------------------------------------------------------------

export const successionPlanInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  fiscalYear: z.string().regex(/^\d{4}-\d{4}$/),
  scope: z.enum(['company', 'subsidiary', 'department']),
  scopeId: z.string().optional(),
  criticalRoleIds: z.array(z.string()).min(1),
});

export type SuccessionPlanInput = z.infer<typeof successionPlanInputSchema>;

export const successionPlanUpdateSchema = successionPlanInputSchema.partial();

export type SuccessionPlanUpdate = z.infer<typeof successionPlanUpdateSchema>;
