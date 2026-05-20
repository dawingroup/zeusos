// ============================================================================
// STRATEGY SCHEMAS - DawinOS CEO Strategy Command
// Zod validation schemas for strategy documents
// ============================================================================

import { z } from 'zod';
import {
  STRATEGY_DOCUMENT_TYPE,
  STRATEGY_DOCUMENT_STATUS,
  STRATEGY_SCOPE,
  TIME_HORIZON,
  PILLAR_CATEGORY,
  PILLAR_STATUS,
  REVIEW_FREQUENCY,
  STRATEGY_APPROVAL_LEVEL,
  OBJECTIVE_PRIORITY,
  OBJECTIVE_STATUS,
  RISK_LIKELIHOOD,
  RISK_IMPACT,
  RISK_STATUS,
  ALIGNMENT_ENTITY_TYPE,
  ALIGNMENT_STRENGTH,
  METRIC_DIRECTION,
  STRATEGY_DEFAULTS,
} from '../constants/strategy.constants';

// ----------------------------------------------------------------------------
// Common Schemas
// ----------------------------------------------------------------------------
const titleSchema = z.string().min(5, 'Title must be at least 5 characters').max(200);
const descriptionSchema = z.string().max(1000).optional();
const tagsSchema = z.array(z.string().max(50)).max(STRATEGY_DEFAULTS.MAX_TAGS).optional();
const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional();

// ----------------------------------------------------------------------------
// Risk Schema
// ----------------------------------------------------------------------------
export const strategyRiskSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
  likelihood: z.enum([RISK_LIKELIHOOD.LOW, RISK_LIKELIHOOD.MEDIUM, RISK_LIKELIHOOD.HIGH]),
  impact: z.enum([RISK_IMPACT.LOW, RISK_IMPACT.MEDIUM, RISK_IMPACT.HIGH]),
  mitigation: z.string().max(500).optional(),
  owner: z.string().optional(),
  ownerName: z.string().optional(),
  status: z.enum([
    RISK_STATUS.IDENTIFIED,
    RISK_STATUS.MITIGATING,
    RISK_STATUS.MITIGATED,
    RISK_STATUS.ACCEPTED,
  ]).default(RISK_STATUS.IDENTIFIED),
});

// ----------------------------------------------------------------------------
// Content Schema
// ----------------------------------------------------------------------------
export const strategyContentSchema = z.object({
  summary: z.string().max(2000).optional(),
  vision: z.string().max(500).optional(),
  mission: z.string().max(500).optional(),
  values: z.array(z.string().max(100)).max(STRATEGY_DEFAULTS.MAX_VALUES).optional(),
  context: z.string().max(5000).optional(),
  assumptions: z.array(z.string().max(300)).max(STRATEGY_DEFAULTS.MAX_ASSUMPTIONS).optional(),
  risks: z.array(strategyRiskSchema).max(STRATEGY_DEFAULTS.MAX_RISKS).optional(),
  dependencies: z.array(z.string().max(300)).max(STRATEGY_DEFAULTS.MAX_DEPENDENCIES).optional(),
  successCriteria: z.array(z.string().max(300)).max(STRATEGY_DEFAULTS.MAX_SUCCESS_CRITERIA).optional(),
  richContent: z.string().max(100000).optional(),
});

// ----------------------------------------------------------------------------
// Metric Schema
// ----------------------------------------------------------------------------
export const pillarMetricSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional(),
  targetValue: z.number(),
  currentValue: z.number().optional(),
  baselineValue: z.number().optional(),
  unit: z.string().max(30),
  direction: z.enum([
    METRIC_DIRECTION.HIGHER_IS_BETTER,
    METRIC_DIRECTION.LOWER_IS_BETTER,
    METRIC_DIRECTION.TARGET,
  ]),
  source: z.string().max(100).optional(),
});

// ----------------------------------------------------------------------------
// Objective Schema
// ----------------------------------------------------------------------------
export const strategicObjectiveSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(500).optional(),
  targetDate: z.date().optional(),
  priority: z.enum([
    OBJECTIVE_PRIORITY.CRITICAL,
    OBJECTIVE_PRIORITY.HIGH,
    OBJECTIVE_PRIORITY.MEDIUM,
    OBJECTIVE_PRIORITY.LOW,
  ]),
  status: z.enum([
    OBJECTIVE_STATUS.NOT_STARTED,
    OBJECTIVE_STATUS.IN_PROGRESS,
    OBJECTIVE_STATUS.COMPLETED,
    OBJECTIVE_STATUS.DEFERRED,
    OBJECTIVE_STATUS.CANCELLED,
  ]).default(OBJECTIVE_STATUS.NOT_STARTED),
  progress: z.number().min(0).max(100).default(0),
  linkedOKRIds: z.array(z.string()).optional(),
  linkedKPIIds: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
  assigneeId: z.string().optional(),
  assigneeName: z.string().optional(),
});

// ----------------------------------------------------------------------------
// Pillar Schema
// ----------------------------------------------------------------------------
export const strategicPillarSchema = z.object({
  category: z.enum([
    PILLAR_CATEGORY.GROWTH,
    PILLAR_CATEGORY.OPERATIONAL_EXCELLENCE,
    PILLAR_CATEGORY.INNOVATION,
    PILLAR_CATEGORY.PEOPLE,
    PILLAR_CATEGORY.FINANCIAL,
    PILLAR_CATEGORY.CUSTOMER,
    PILLAR_CATEGORY.SUSTAINABILITY,
    PILLAR_CATEGORY.TECHNOLOGY,
  ]),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  weight: z.number().min(0).max(100),
  order: z.number().int().min(0).optional(),
  metrics: z.array(pillarMetricSchema).max(STRATEGY_DEFAULTS.MAX_METRICS_PER_PILLAR).optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  status: z.enum([
    PILLAR_STATUS.NOT_STARTED,
    PILLAR_STATUS.ON_TRACK,
    PILLAR_STATUS.AT_RISK,
    PILLAR_STATUS.BEHIND,
  ]).default(PILLAR_STATUS.NOT_STARTED),
  progress: z.number().min(0).max(100).default(0),
  color: colorSchema,
});

// ----------------------------------------------------------------------------
// Create Strategy Document Schema
// ----------------------------------------------------------------------------
export const createStrategyDocumentSchema = z.object({
  type: z.enum([
    STRATEGY_DOCUMENT_TYPE.VISION,
    STRATEGY_DOCUMENT_TYPE.MISSION,
    STRATEGY_DOCUMENT_TYPE.STRATEGIC_PLAN,
    STRATEGY_DOCUMENT_TYPE.BUSINESS_PLAN,
    STRATEGY_DOCUMENT_TYPE.ANNUAL_PLAN,
    STRATEGY_DOCUMENT_TYPE.QUARTERLY_PLAN,
    STRATEGY_DOCUMENT_TYPE.INITIATIVE,
    STRATEGY_DOCUMENT_TYPE.POLICY,
  ]),
  title: titleSchema,
  subtitle: z.string().max(200).optional(),
  description: descriptionSchema,
  scope: z.enum([
    STRATEGY_SCOPE.GROUP,
    STRATEGY_SCOPE.SUBSIDIARY,
    STRATEGY_SCOPE.DEPARTMENT,
    STRATEGY_SCOPE.TEAM,
  ]),
  scopeEntityId: z.string().optional(),
  scopeEntityName: z.string().optional(),
  timeHorizon: z.enum([
    TIME_HORIZON.SHORT_TERM,
    TIME_HORIZON.MEDIUM_TERM,
    TIME_HORIZON.LONG_TERM,
    TIME_HORIZON.VISION,
  ]),
  effectiveFrom: z.date(),
  effectiveTo: z.date().optional(),
  fiscalYear: z.string().regex(/^\d{4}$/, 'Fiscal year must be 4 digits').optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  content: strategyContentSchema.optional(),
  pillars: z.array(strategicPillarSchema).max(STRATEGY_DEFAULTS.MAX_PILLARS).optional(),
  approvalLevel: z.enum([
    STRATEGY_APPROVAL_LEVEL.BOARD,
    STRATEGY_APPROVAL_LEVEL.CEO,
    STRATEGY_APPROVAL_LEVEL.EXECUTIVE_TEAM,
    STRATEGY_APPROVAL_LEVEL.DEPARTMENT_HEAD,
  ]),
  reviewFrequency: z.enum([
    REVIEW_FREQUENCY.WEEKLY,
    REVIEW_FREQUENCY.MONTHLY,
    REVIEW_FREQUENCY.QUARTERLY,
    REVIEW_FREQUENCY.SEMI_ANNUAL,
    REVIEW_FREQUENCY.ANNUAL,
  ]),
  parentDocumentId: z.string().optional(),
  tags: tagsSchema,
}).refine(
  (data) => {
    if (data.effectiveTo) {
      return data.effectiveTo > data.effectiveFrom;
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['effectiveTo'] }
).refine(
  (data) => {
    if (data.pillars && data.pillars.length > 0) {
      const totalWeight = data.pillars.reduce((sum, p) => sum + p.weight, 0);
      return Math.abs(totalWeight - 100) < 0.01;
    }
    return true;
  },
  { message: 'Pillar weights must total 100%', path: ['pillars'] }
).refine(
  (data) => {
    if (data.scope !== STRATEGY_SCOPE.GROUP && !data.scopeEntityId) {
      return false;
    }
    return true;
  },
  { message: 'Entity ID required for non-group scope', path: ['scopeEntityId'] }
);

// ----------------------------------------------------------------------------
// Update Strategy Document Schema
// ----------------------------------------------------------------------------
export const updateStrategyDocumentSchema = z.object({
  title: titleSchema.optional(),
  subtitle: z.string().max(200).optional().nullable(),
  description: descriptionSchema.nullable(),
  status: z.enum([
    STRATEGY_DOCUMENT_STATUS.DRAFT,
    STRATEGY_DOCUMENT_STATUS.IN_REVIEW,
    STRATEGY_DOCUMENT_STATUS.APPROVED,
    STRATEGY_DOCUMENT_STATUS.ACTIVE,
    STRATEGY_DOCUMENT_STATUS.SUPERSEDED,
    STRATEGY_DOCUMENT_STATUS.ARCHIVED,
  ]).optional(),
  timeHorizon: z.enum([
    TIME_HORIZON.SHORT_TERM,
    TIME_HORIZON.MEDIUM_TERM,
    TIME_HORIZON.LONG_TERM,
    TIME_HORIZON.VISION,
  ]).optional(),
  effectiveFrom: z.date().optional(),
  effectiveTo: z.date().optional().nullable(),
  content: strategyContentSchema.optional(),
  approvalLevel: z.enum([
    STRATEGY_APPROVAL_LEVEL.BOARD,
    STRATEGY_APPROVAL_LEVEL.CEO,
    STRATEGY_APPROVAL_LEVEL.EXECUTIVE_TEAM,
    STRATEGY_APPROVAL_LEVEL.DEPARTMENT_HEAD,
  ]).optional(),
  reviewFrequency: z.enum([
    REVIEW_FREQUENCY.WEEKLY,
    REVIEW_FREQUENCY.MONTHLY,
    REVIEW_FREQUENCY.QUARTERLY,
    REVIEW_FREQUENCY.SEMI_ANNUAL,
    REVIEW_FREQUENCY.ANNUAL,
  ]).optional(),
  nextReviewDate: z.date().optional().nullable(),
  tags: tagsSchema.nullable(),
  changeLog: z.string().max(500).optional(),
});

// ----------------------------------------------------------------------------
// Pillar Schemas
// ----------------------------------------------------------------------------
export const createPillarSchema = z.object({
  category: z.enum([
    PILLAR_CATEGORY.GROWTH,
    PILLAR_CATEGORY.OPERATIONAL_EXCELLENCE,
    PILLAR_CATEGORY.INNOVATION,
    PILLAR_CATEGORY.PEOPLE,
    PILLAR_CATEGORY.FINANCIAL,
    PILLAR_CATEGORY.CUSTOMER,
    PILLAR_CATEGORY.SUSTAINABILITY,
    PILLAR_CATEGORY.TECHNOLOGY,
  ]),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  weight: z.number().min(0).max(100),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  color: colorSchema,
});

export const updatePillarSchema = z.object({
  category: z.enum([
    PILLAR_CATEGORY.GROWTH,
    PILLAR_CATEGORY.OPERATIONAL_EXCELLENCE,
    PILLAR_CATEGORY.INNOVATION,
    PILLAR_CATEGORY.PEOPLE,
    PILLAR_CATEGORY.FINANCIAL,
    PILLAR_CATEGORY.CUSTOMER,
    PILLAR_CATEGORY.SUSTAINABILITY,
    PILLAR_CATEGORY.TECHNOLOGY,
  ]).optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  weight: z.number().min(0).max(100).optional(),
  status: z.enum([
    PILLAR_STATUS.NOT_STARTED,
    PILLAR_STATUS.ON_TRACK,
    PILLAR_STATUS.AT_RISK,
    PILLAR_STATUS.BEHIND,
  ]).optional(),
  progress: z.number().min(0).max(100).optional(),
  ownerId: z.string().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  color: colorSchema.nullable(),
});

// ----------------------------------------------------------------------------
// Objective Schemas
// ----------------------------------------------------------------------------
export const createObjectiveSchema = z.object({
  pillarId: z.string().min(1, 'Pillar ID required'),
  title: z.string().min(5).max(200),
  description: z.string().max(500).optional(),
  targetDate: z.date().optional(),
  priority: z.enum([
    OBJECTIVE_PRIORITY.CRITICAL,
    OBJECTIVE_PRIORITY.HIGH,
    OBJECTIVE_PRIORITY.MEDIUM,
    OBJECTIVE_PRIORITY.LOW,
  ]),
  assigneeId: z.string().optional(),
  assigneeName: z.string().optional(),
});

export const updateObjectiveSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  targetDate: z.date().optional().nullable(),
  priority: z.enum([
    OBJECTIVE_PRIORITY.CRITICAL,
    OBJECTIVE_PRIORITY.HIGH,
    OBJECTIVE_PRIORITY.MEDIUM,
    OBJECTIVE_PRIORITY.LOW,
  ]).optional(),
  status: z.enum([
    OBJECTIVE_STATUS.NOT_STARTED,
    OBJECTIVE_STATUS.IN_PROGRESS,
    OBJECTIVE_STATUS.COMPLETED,
    OBJECTIVE_STATUS.DEFERRED,
    OBJECTIVE_STATUS.CANCELLED,
  ]).optional(),
  progress: z.number().min(0).max(100).optional(),
  linkedOKRIds: z.array(z.string()).optional(),
  linkedKPIIds: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  assigneeName: z.string().optional().nullable(),
});

// ----------------------------------------------------------------------------
// Metric Schemas
// ----------------------------------------------------------------------------
export const createMetricSchema = z.object({
  pillarId: z.string().min(1, 'Pillar ID required'),
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional(),
  targetValue: z.number(),
  baselineValue: z.number().optional(),
  unit: z.string().max(30),
  direction: z.enum([
    METRIC_DIRECTION.HIGHER_IS_BETTER,
    METRIC_DIRECTION.LOWER_IS_BETTER,
    METRIC_DIRECTION.TARGET,
  ]),
  source: z.string().max(100).optional(),
});

export const updateMetricSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(300).optional().nullable(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().max(30).optional(),
  direction: z.enum([
    METRIC_DIRECTION.HIGHER_IS_BETTER,
    METRIC_DIRECTION.LOWER_IS_BETTER,
    METRIC_DIRECTION.TARGET,
  ]).optional(),
  source: z.string().max(100).optional().nullable(),
});

// ----------------------------------------------------------------------------
// Risk Schemas
// ----------------------------------------------------------------------------
export const createRiskSchema = z.object({
  description: z.string().min(10).max(500),
  likelihood: z.enum([RISK_LIKELIHOOD.LOW, RISK_LIKELIHOOD.MEDIUM, RISK_LIKELIHOOD.HIGH]),
  impact: z.enum([RISK_IMPACT.LOW, RISK_IMPACT.MEDIUM, RISK_IMPACT.HIGH]),
  mitigation: z.string().max(500).optional(),
  owner: z.string().optional(),
  ownerName: z.string().optional(),
});

export const updateRiskSchema = z.object({
  description: z.string().min(10).max(500).optional(),
  likelihood: z.enum([RISK_LIKELIHOOD.LOW, RISK_LIKELIHOOD.MEDIUM, RISK_LIKELIHOOD.HIGH]).optional(),
  impact: z.enum([RISK_IMPACT.LOW, RISK_IMPACT.MEDIUM, RISK_IMPACT.HIGH]).optional(),
  mitigation: z.string().max(500).optional().nullable(),
  owner: z.string().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  status: z.enum([
    RISK_STATUS.IDENTIFIED,
    RISK_STATUS.MITIGATING,
    RISK_STATUS.MITIGATED,
    RISK_STATUS.ACCEPTED,
  ]).optional(),
});

// ----------------------------------------------------------------------------
// Alignment Schemas
// ----------------------------------------------------------------------------
export const createAlignmentSchema = z.object({
  strategyDocumentId: z.string().min(1, 'Strategy document ID required'),
  pillarId: z.string().min(1, 'Pillar ID required'),
  objectiveId: z.string().optional(),
  alignedEntityType: z.enum([
    ALIGNMENT_ENTITY_TYPE.SUBSIDIARY,
    ALIGNMENT_ENTITY_TYPE.DEPARTMENT,
    ALIGNMENT_ENTITY_TYPE.OKR,
    ALIGNMENT_ENTITY_TYPE.KPI,
    ALIGNMENT_ENTITY_TYPE.PROJECT,
    ALIGNMENT_ENTITY_TYPE.INITIATIVE,
  ]),
  alignedEntityId: z.string().min(1, 'Aligned entity ID required'),
  alignedEntityName: z.string().max(200),
  alignmentStrength: z.enum([
    ALIGNMENT_STRENGTH.STRONG,
    ALIGNMENT_STRENGTH.MODERATE,
    ALIGNMENT_STRENGTH.WEAK,
  ]),
  contributionDescription: z.string().max(500).optional(),
});

// ----------------------------------------------------------------------------
// Review Schemas
// ----------------------------------------------------------------------------
export const createReviewSchema = z.object({
  documentId: z.string().min(1, 'Document ID required'),
  reviewDate: z.date(),
  reviewedBy: z.array(z.string()).min(1, 'At least one reviewer required'),
  summary: z.string().min(20, 'Summary must be at least 20 characters').max(2000),
  pillarUpdates: z.array(z.object({
    pillarId: z.string(),
    previousStatus: z.enum([
      PILLAR_STATUS.NOT_STARTED,
      PILLAR_STATUS.ON_TRACK,
      PILLAR_STATUS.AT_RISK,
      PILLAR_STATUS.BEHIND,
    ]),
    newStatus: z.enum([
      PILLAR_STATUS.NOT_STARTED,
      PILLAR_STATUS.ON_TRACK,
      PILLAR_STATUS.AT_RISK,
      PILLAR_STATUS.BEHIND,
    ]),
    previousProgress: z.number().min(0).max(100),
    newProgress: z.number().min(0).max(100),
    comments: z.string().max(500),
  })),
  recommendations: z.array(z.string().max(500)).max(10),
  decisions: z.array(z.string().max(500)).max(10).optional(),
  nextReviewDate: z.date(),
  notes: z.string().max(2000).optional(),
});

// ----------------------------------------------------------------------------
// Type Exports
// ----------------------------------------------------------------------------
export type CreateStrategyDocumentSchemaType = z.infer<typeof createStrategyDocumentSchema>;
export type UpdateStrategyDocumentSchemaType = z.infer<typeof updateStrategyDocumentSchema>;
export type CreatePillarSchemaType = z.infer<typeof createPillarSchema>;
export type UpdatePillarSchemaType = z.infer<typeof updatePillarSchema>;
export type CreateObjectiveSchemaType = z.infer<typeof createObjectiveSchema>;
export type UpdateObjectiveSchemaType = z.infer<typeof updateObjectiveSchema>;
export type CreateMetricSchemaType = z.infer<typeof createMetricSchema>;
export type UpdateMetricSchemaType = z.infer<typeof updateMetricSchema>;
export type CreateRiskSchemaType = z.infer<typeof createRiskSchema>;
export type UpdateRiskSchemaType = z.infer<typeof updateRiskSchema>;
export type CreateAlignmentSchemaType = z.infer<typeof createAlignmentSchema>;
export type CreateReviewSchemaType = z.infer<typeof createReviewSchema>;
export type StrategyRiskSchemaType = z.infer<typeof strategyRiskSchema>;
export type StrategyContentSchemaType = z.infer<typeof strategyContentSchema>;
export type PillarMetricSchemaType = z.infer<typeof pillarMetricSchema>;
export type StrategicObjectiveSchemaType = z.infer<typeof strategicObjectiveSchema>;
export type StrategicPillarSchemaType = z.infer<typeof strategicPillarSchema>;

// ----------------------------------------------------------------------------
// Validation Functions
// ----------------------------------------------------------------------------
export function validateCreateStrategyDocument(data: unknown) {
  return createStrategyDocumentSchema.safeParse(data);
}

export function validateUpdateStrategyDocument(data: unknown) {
  return updateStrategyDocumentSchema.safeParse(data);
}

export function validateCreatePillar(data: unknown) {
  return createPillarSchema.safeParse(data);
}

export function validateCreateObjective(data: unknown) {
  return createObjectiveSchema.safeParse(data);
}

export function validateCreateAlignment(data: unknown) {
  return createAlignmentSchema.safeParse(data);
}

export function validateCreateReview(data: unknown) {
  return createReviewSchema.safeParse(data);
}
