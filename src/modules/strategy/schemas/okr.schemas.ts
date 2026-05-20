// ============================================================================
// OKR SCHEMAS - DawinOS CEO Strategy Command
// Zod validation schemas for OKR management
// ============================================================================

import { z } from 'zod';
import {
  OKR_LEVEL,
  OKR_STATUS,
  OKR_CYCLE,
  OKR_CYCLE_STATUS,
  KEY_RESULT_TYPE,
  CONFIDENCE_LEVEL,
  CHECK_IN_FREQUENCY,
  OKR_VISIBILITY,
  OKR_OWNER_TYPE,
  OKR_SCORING_METHOD,
  OKR_ALIGNMENT_TYPE,
  OKR_DEFAULTS,
} from '../constants/okr.constants';

// ----------------------------------------------------------------------------
// Common Schemas
// ----------------------------------------------------------------------------
const titleSchema = z.string().min(5, 'Title must be at least 5 characters').max(300);
const descriptionSchema = z.string().max(1000).optional();
const tagsSchema = z.array(z.string().max(30)).max(OKR_DEFAULTS.MAX_TAGS).optional();

// ----------------------------------------------------------------------------
// Milestone Schema
// ----------------------------------------------------------------------------
export const milestoneSchema = z.object({
  title: z.string().min(2, 'Milestone title required').max(200),
  description: z.string().max(500).optional(),
  targetDate: z.date().optional(),
  order: z.number().int().min(0).optional(),
});

// ----------------------------------------------------------------------------
// Key Result Schemas
// ----------------------------------------------------------------------------
export const createKeyResultSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  type: z.enum([
    KEY_RESULT_TYPE.NUMERIC,
    KEY_RESULT_TYPE.PERCENTAGE,
    KEY_RESULT_TYPE.CURRENCY,
    KEY_RESULT_TYPE.BINARY,
    KEY_RESULT_TYPE.MILESTONE,
  ]),
  unit: z.string().max(30).optional(),
  startValue: z.number(),
  targetValue: z.number(),
  stretchValue: z.number().optional(),
  milestones: z.array(milestoneSchema).max(OKR_DEFAULTS.MAX_MILESTONES_PER_KEY_RESULT).optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().max(100).optional(),
  weight: z.number().min(0).max(100).default(1),
}).refine(
  (data) => {
    // For non-binary types, target should be different from start
    if (data.type !== KEY_RESULT_TYPE.BINARY) {
      return data.targetValue !== data.startValue;
    }
    return true;
  },
  { message: 'Target value must be different from start value', path: ['targetValue'] }
).refine(
  (data) => {
    // If milestone type, must have milestones
    if (data.type === KEY_RESULT_TYPE.MILESTONE) {
      return data.milestones && data.milestones.length > 0;
    }
    return true;
  },
  { message: 'Milestone key results must have at least one milestone', path: ['milestones'] }
).refine(
  (data) => {
    // Stretch value should be more ambitious than target
    if (data.stretchValue !== undefined) {
      const isIncreasing = data.targetValue > data.startValue;
      if (isIncreasing) {
        return data.stretchValue > data.targetValue;
      } else {
        return data.stretchValue < data.targetValue;
      }
    }
    return true;
  },
  { message: 'Stretch value must be more ambitious than target', path: ['stretchValue'] }
);

export const updateKeyResultSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.nullable(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  stretchValue: z.number().optional().nullable(),
  confidence: z.enum([
    CONFIDENCE_LEVEL.ON_TRACK,
    CONFIDENCE_LEVEL.AT_RISK,
    CONFIDENCE_LEVEL.OFF_TRACK,
  ]).optional(),
  confidenceNote: z.string().max(500).optional().nullable(),
  ownerId: z.string().optional().nullable(),
  ownerName: z.string().max(100).optional().nullable(),
  weight: z.number().min(0).max(100).optional(),
});

// ----------------------------------------------------------------------------
// Objective Schemas
// ----------------------------------------------------------------------------
export const createObjectiveSchema = z.object({
  level: z.enum([
    OKR_LEVEL.COMPANY,
    OKR_LEVEL.SUBSIDIARY,
    OKR_LEVEL.DEPARTMENT,
    OKR_LEVEL.TEAM,
    OKR_LEVEL.INDIVIDUAL,
  ]),
  ownerId: z.string().min(1, 'Owner ID required'),
  ownerType: z.enum([
    OKR_OWNER_TYPE.USER,
    OKR_OWNER_TYPE.SUBSIDIARY,
    OKR_OWNER_TYPE.DEPARTMENT,
    OKR_OWNER_TYPE.TEAM,
  ]),
  ownerName: z.string().min(1).max(100),
  ownerAvatarUrl: z.string().url().optional(),
  cycleId: z.string().min(1, 'Cycle ID required'),
  title: z.string().min(10, 'Title must be at least 10 characters').max(300),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  parentOKRId: z.string().optional(),
  alignedStrategyPillarId: z.string().optional(),
  alignedStrategyObjectiveId: z.string().optional(),
  tags: tagsSchema,
  visibility: z.enum([
    OKR_VISIBILITY.PUBLIC,
    OKR_VISIBILITY.TEAM,
    OKR_VISIBILITY.PRIVATE,
  ]).default(OKR_VISIBILITY.PUBLIC),
  isStretch: z.boolean().default(false),
  checkInFrequency: z.enum([
    CHECK_IN_FREQUENCY.DAILY,
    CHECK_IN_FREQUENCY.WEEKLY,
    CHECK_IN_FREQUENCY.BI_WEEKLY,
    CHECK_IN_FREQUENCY.MONTHLY,
  ]).optional(),
  keyResults: z.array(createKeyResultSchema)
    .max(OKR_DEFAULTS.MAX_KEY_RESULTS_PER_OBJECTIVE)
    .optional(),
});

export const updateObjectiveSchema = z.object({
  title: z.string().min(10).max(300).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  status: z.enum([
    OKR_STATUS.DRAFT,
    OKR_STATUS.ACTIVE,
    OKR_STATUS.COMPLETED,
    OKR_STATUS.CANCELLED,
    OKR_STATUS.DEFERRED,
  ]).optional(),
  parentOKRId: z.string().optional().nullable(),
  alignedStrategyPillarId: z.string().optional().nullable(),
  alignedStrategyObjectiveId: z.string().optional().nullable(),
  tags: tagsSchema.nullable(),
  visibility: z.enum([
    OKR_VISIBILITY.PUBLIC,
    OKR_VISIBILITY.TEAM,
    OKR_VISIBILITY.PRIVATE,
  ]).optional(),
  checkInFrequency: z.enum([
    CHECK_IN_FREQUENCY.DAILY,
    CHECK_IN_FREQUENCY.WEEKLY,
    CHECK_IN_FREQUENCY.BI_WEEKLY,
    CHECK_IN_FREQUENCY.MONTHLY,
  ]).optional(),
});

// ----------------------------------------------------------------------------
// Check-In Schemas
// ----------------------------------------------------------------------------
export const checkInSchema = z.object({
  keyResultId: z.string().min(1, 'Key result ID required'),
  newValue: z.number(),
  confidence: z.enum([
    CONFIDENCE_LEVEL.ON_TRACK,
    CONFIDENCE_LEVEL.AT_RISK,
    CONFIDENCE_LEVEL.OFF_TRACK,
  ]),
  note: z.string().max(500).optional(),
  blockers: z.array(z.string().max(200)).max(OKR_DEFAULTS.MAX_BLOCKERS_PER_CHECKIN).optional(),
  wins: z.array(z.string().max(200)).max(OKR_DEFAULTS.MAX_WINS_PER_CHECKIN).optional(),
});

export const bulkCheckInSchema = z.object({
  objectiveId: z.string().min(1, 'Objective ID required'),
  checkIns: z.array(checkInSchema).min(1, 'At least one check-in required').max(20),
});

// ----------------------------------------------------------------------------
// Milestone Update Schema
// ----------------------------------------------------------------------------
export const updateMilestoneSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  targetDate: z.date().optional().nullable(),
  isComplete: z.boolean().optional(),
});

// ----------------------------------------------------------------------------
// Cycle Schemas
// ----------------------------------------------------------------------------
export const cycleSettingsSchema = z.object({
  allowStretchGoals: z.boolean().default(true),
  requireAlignment: z.boolean().default(true),
  minKeyResultsPerObjective: z.number().int().min(1).max(10).default(1),
  maxKeyResultsPerObjective: z.number().int().min(1).max(10).default(5),
  defaultCheckInFrequency: z.enum([
    CHECK_IN_FREQUENCY.DAILY,
    CHECK_IN_FREQUENCY.WEEKLY,
    CHECK_IN_FREQUENCY.BI_WEEKLY,
    CHECK_IN_FREQUENCY.MONTHLY,
  ]).default(CHECK_IN_FREQUENCY.WEEKLY),
  autoRemindCheckIns: z.boolean().default(true),
  scoringMethod: z.enum([
    OKR_SCORING_METHOD.AVERAGE,
    OKR_SCORING_METHOD.WEIGHTED,
  ]).default(OKR_SCORING_METHOD.AVERAGE),
  gracePeriodsEnabled: z.boolean().default(false),
});

export const createCycleSchema = z.object({
  cycle: z.enum([
    OKR_CYCLE.Q1,
    OKR_CYCLE.Q2,
    OKR_CYCLE.Q3,
    OKR_CYCLE.Q4,
    OKR_CYCLE.ANNUAL,
    OKR_CYCLE.CUSTOM,
  ]),
  year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4).optional(),
  name: z.string().min(2, 'Name required').max(100),
  startDate: z.date(),
  endDate: z.date(),
  planningDeadline: z.date().optional(),
  reviewStartDate: z.date().optional(),
  settings: cycleSettingsSchema.optional(),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
).refine(
  (data) => {
    if (data.planningDeadline) {
      return data.planningDeadline <= data.startDate;
    }
    return true;
  },
  { message: 'Planning deadline must be before or on start date', path: ['planningDeadline'] }
).refine(
  (data) => {
    if (data.reviewStartDate) {
      return data.reviewStartDate <= data.endDate && data.reviewStartDate >= data.startDate;
    }
    return true;
  },
  { message: 'Review start must be within cycle period', path: ['reviewStartDate'] }
);

export const updateCycleSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum([
    OKR_CYCLE_STATUS.PLANNING,
    OKR_CYCLE_STATUS.ACTIVE,
    OKR_CYCLE_STATUS.REVIEW,
    OKR_CYCLE_STATUS.CLOSED,
  ]).optional(),
  planningDeadline: z.date().optional().nullable(),
  reviewStartDate: z.date().optional().nullable(),
  settings: cycleSettingsSchema.partial().optional(),
});

// ----------------------------------------------------------------------------
// Alignment Schema
// ----------------------------------------------------------------------------
export const createAlignmentSchema = z.object({
  sourceOKRId: z.string().min(1, 'Source OKR ID required'),
  targetOKRId: z.string().min(1, 'Target OKR ID required'),
  alignmentType: z.enum([
    OKR_ALIGNMENT_TYPE.PARENT,
    OKR_ALIGNMENT_TYPE.CONTRIBUTES_TO,
    OKR_ALIGNMENT_TYPE.SHARED,
  ]),
  contributionPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => data.sourceOKRId !== data.targetOKRId,
  { message: 'Source and target OKRs must be different', path: ['targetOKRId'] }
);

// ----------------------------------------------------------------------------
// Type Exports
// ----------------------------------------------------------------------------
export type MilestoneSchemaType = z.infer<typeof milestoneSchema>;
export type CreateKeyResultSchemaType = z.infer<typeof createKeyResultSchema>;
export type UpdateKeyResultSchemaType = z.infer<typeof updateKeyResultSchema>;
export type CreateObjectiveSchemaType = z.infer<typeof createObjectiveSchema>;
export type UpdateObjectiveSchemaType = z.infer<typeof updateObjectiveSchema>;
export type CheckInSchemaType = z.infer<typeof checkInSchema>;
export type BulkCheckInSchemaType = z.infer<typeof bulkCheckInSchema>;
export type UpdateMilestoneSchemaType = z.infer<typeof updateMilestoneSchema>;
export type CycleSettingsSchemaType = z.infer<typeof cycleSettingsSchema>;
export type CreateCycleSchemaType = z.infer<typeof createCycleSchema>;
export type UpdateCycleSchemaType = z.infer<typeof updateCycleSchema>;
export type CreateAlignmentSchemaType = z.infer<typeof createAlignmentSchema>;

// ----------------------------------------------------------------------------
// Validation Functions
// ----------------------------------------------------------------------------
export function validateCreateObjective(data: unknown) {
  return createObjectiveSchema.safeParse(data);
}

export function validateUpdateObjective(data: unknown) {
  return updateObjectiveSchema.safeParse(data);
}

export function validateCreateKeyResult(data: unknown) {
  return createKeyResultSchema.safeParse(data);
}

export function validateUpdateKeyResult(data: unknown) {
  return updateKeyResultSchema.safeParse(data);
}

export function validateCheckIn(data: unknown) {
  return checkInSchema.safeParse(data);
}

export function validateBulkCheckIn(data: unknown) {
  return bulkCheckInSchema.safeParse(data);
}

export function validateCreateCycle(data: unknown) {
  return createCycleSchema.safeParse(data);
}

export function validateUpdateCycle(data: unknown) {
  return updateCycleSchema.safeParse(data);
}

export function validateCreateAlignment(data: unknown) {
  return createAlignmentSchema.safeParse(data);
}
