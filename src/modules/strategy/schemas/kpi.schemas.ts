// ============================================================================
// KPI SCHEMAS - DawinOS CEO Strategy Command
// Zod validation schemas for KPI management
// ============================================================================

import { z } from 'zod';
import {
  KPI_CATEGORY,
  KPI_TYPE,
  KPI_STATUS,
  KPI_SCOPE,
  KPI_DIRECTION,
  KPI_FREQUENCY,
  KPI_DATA_SOURCE,
  KPI_AGGREGATION_METHOD,
  KPI_SCORECARD_TYPE,
  KPI_THRESHOLD_TYPE,
  BSC_PERSPECTIVE,
  KPI_DEFAULTS,
} from '../constants/kpi.constants';

// ----------------------------------------------------------------------------
// Base Enum Schemas
// ----------------------------------------------------------------------------
export const kpiCategorySchema = z.enum([
  KPI_CATEGORY.FINANCIAL,
  KPI_CATEGORY.CUSTOMER,
  KPI_CATEGORY.OPERATIONAL,
  KPI_CATEGORY.PEOPLE,
  KPI_CATEGORY.GROWTH,
  KPI_CATEGORY.QUALITY,
  KPI_CATEGORY.INNOVATION,
  KPI_CATEGORY.SUSTAINABILITY,
]);

export const kpiTypeSchema = z.enum([
  KPI_TYPE.NUMERIC,
  KPI_TYPE.PERCENTAGE,
  KPI_TYPE.CURRENCY,
  KPI_TYPE.RATIO,
  KPI_TYPE.INDEX,
  KPI_TYPE.RATING,
  KPI_TYPE.BINARY,
]);

export const kpiStatusSchema = z.enum([
  KPI_STATUS.DRAFT,
  KPI_STATUS.ACTIVE,
  KPI_STATUS.PAUSED,
  KPI_STATUS.DEPRECATED,
  KPI_STATUS.ARCHIVED,
]);

export const kpiScopeSchema = z.enum([
  KPI_SCOPE.GROUP,
  KPI_SCOPE.SUBSIDIARY,
  KPI_SCOPE.DEPARTMENT,
  KPI_SCOPE.TEAM,
  KPI_SCOPE.PROJECT,
]);

export const kpiDirectionSchema = z.enum([
  KPI_DIRECTION.HIGHER_IS_BETTER,
  KPI_DIRECTION.LOWER_IS_BETTER,
  KPI_DIRECTION.TARGET_IS_BEST,
  KPI_DIRECTION.RANGE_IS_BEST,
]);

export const kpiFrequencySchema = z.enum([
  KPI_FREQUENCY.REAL_TIME,
  KPI_FREQUENCY.DAILY,
  KPI_FREQUENCY.WEEKLY,
  KPI_FREQUENCY.BI_WEEKLY,
  KPI_FREQUENCY.MONTHLY,
  KPI_FREQUENCY.QUARTERLY,
  KPI_FREQUENCY.ANNUALLY,
]);

export const kpiDataSourceSchema = z.enum([
  KPI_DATA_SOURCE.MANUAL,
  KPI_DATA_SOURCE.CALCULATED,
  KPI_DATA_SOURCE.API_INTEGRATION,
  KPI_DATA_SOURCE.DATABASE_QUERY,
  KPI_DATA_SOURCE.FILE_IMPORT,
  KPI_DATA_SOURCE.AGGREGATED,
]);

export const kpiAggregationMethodSchema = z.enum([
  KPI_AGGREGATION_METHOD.SUM,
  KPI_AGGREGATION_METHOD.AVERAGE,
  KPI_AGGREGATION_METHOD.WEIGHTED_AVERAGE,
  KPI_AGGREGATION_METHOD.MINIMUM,
  KPI_AGGREGATION_METHOD.MAXIMUM,
  KPI_AGGREGATION_METHOD.COUNT,
  KPI_AGGREGATION_METHOD.MEDIAN,
  KPI_AGGREGATION_METHOD.LATEST,
]);

export const kpiScorecardTypeSchema = z.enum([
  KPI_SCORECARD_TYPE.BALANCED,
  KPI_SCORECARD_TYPE.STRATEGIC,
  KPI_SCORECARD_TYPE.OPERATIONAL,
  KPI_SCORECARD_TYPE.DEPARTMENTAL,
  KPI_SCORECARD_TYPE.PROJECT,
  KPI_SCORECARD_TYPE.CUSTOM,
]);

export const kpiThresholdTypeSchema = z.enum([
  KPI_THRESHOLD_TYPE.ABSOLUTE,
  KPI_THRESHOLD_TYPE.PERCENTAGE_OF_TARGET,
  KPI_THRESHOLD_TYPE.STANDARD_DEVIATION,
]);

export const bscPerspectiveSchema = z.enum([
  BSC_PERSPECTIVE.FINANCIAL,
  BSC_PERSPECTIVE.CUSTOMER,
  BSC_PERSPECTIVE.INTERNAL_PROCESS,
  BSC_PERSPECTIVE.LEARNING_GROWTH,
]);

// ----------------------------------------------------------------------------
// KPI Target Schema
// ----------------------------------------------------------------------------
export const kpiTargetSchema = z.object({
  value: z.number(),
  stretchValue: z.number().optional(),
  minimumValue: z.number().optional(),
  rangeMin: z.number().optional(),
  rangeMax: z.number().optional(),
  fiscalYear: z.number().min(2020).max(2100).optional(),
  quarter: z.number().min(1).max(4).optional(),
  baselineValue: z.number().optional(),
}).refine(
  (data) => {
    if (data.rangeMin !== undefined && data.rangeMax !== undefined) {
      return data.rangeMin <= data.rangeMax;
    }
    return true;
  },
  { message: 'Range minimum must be less than or equal to range maximum', path: ['rangeMax'] }
);

// ----------------------------------------------------------------------------
// KPI Threshold Schema
// ----------------------------------------------------------------------------
export const kpiThresholdSchema = z.object({
  id: z.string().optional(),
  level: z.number().min(1).max(KPI_DEFAULTS.MAX_THRESHOLD_LEVELS),
  name: z.string().min(1, 'Threshold name required').max(100),
  type: kpiThresholdTypeSchema,
  value: z.number(),
  comparison: z.enum(['above', 'below', 'equals', 'between']),
  upperValue: z.number().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  alertEnabled: z.boolean(),
  alertRecipients: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (data.comparison === 'between' && data.upperValue === undefined) {
      return false;
    }
    return true;
  },
  { message: 'Upper value is required for "between" comparison', path: ['upperValue'] }
);

// ----------------------------------------------------------------------------
// KPI Data Source Config Schema
// ----------------------------------------------------------------------------
export const kpiDataSourceConfigSchema = z.object({
  type: kpiDataSourceSchema,
  entryInstructions: z.string().max(500).optional(),
  approvalRequired: z.boolean().optional(),
  approverIds: z.array(z.string()).optional(),
  formula: z.string().optional(),
  inputKPIIds: z.array(z.string()).optional(),
  apiEndpoint: z.string().url().optional(),
  apiMapping: z.record(z.string(), z.string()).optional(),
  queryDefinition: z.string().optional(),
  fileFormat: z.string().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  aggregateFromKPIIds: z.array(z.string()).optional(),
  aggregationMethod: kpiAggregationMethodSchema.optional(),
}).refine(
  (data) => {
    if (data.type === KPI_DATA_SOURCE.CALCULATED && !data.formula) {
      return false;
    }
    return true;
  },
  { message: 'Formula is required for calculated KPIs', path: ['formula'] }
).refine(
  (data) => {
    if (data.type === KPI_DATA_SOURCE.AGGREGATED && 
        (!data.aggregateFromKPIIds || data.aggregateFromKPIIds.length === 0)) {
      return false;
    }
    return true;
  },
  { message: 'Source KPI IDs are required for aggregated KPIs', path: ['aggregateFromKPIIds'] }
);

// ----------------------------------------------------------------------------
// Create KPI Schema
// ----------------------------------------------------------------------------
export const createKPISchema = z.object({
  code: z.string()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code must be at most 20 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers, and underscores only'),
  name: z.string().min(3, 'Name must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
  category: kpiCategorySchema,
  type: kpiTypeSchema,
  scope: kpiScopeSchema,
  subsidiaryId: z.string().optional(),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
  ownerId: z.string().min(1, 'Owner ID required'),
  ownerName: z.string().max(100).optional(),
  unit: z.string().max(50),
  direction: kpiDirectionSchema,
  frequency: kpiFrequencySchema,
  decimalPlaces: z.number().min(0).max(6).default(KPI_DEFAULTS.DECIMAL_PLACES),
  target: kpiTargetSchema,
  thresholds: z.array(kpiThresholdSchema).max(KPI_DEFAULTS.MAX_THRESHOLD_LEVELS).optional(),
  dataSourceType: kpiDataSourceSchema,
  formula: z.string().optional(),
  linkedStrategyPillarId: z.string().optional(),
  linkedOKRKeyResultIds: z.array(z.string()).optional(),
  bscPerspective: bscPerspectiveSchema.optional(),
  tags: z.array(z.string().max(30)).max(KPI_DEFAULTS.MAX_TAGS).optional(),
  isPublic: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.scope === KPI_SCOPE.SUBSIDIARY && !data.subsidiaryId) {
      return false;
    }
    return true;
  },
  { message: 'Subsidiary ID is required for subsidiary-scoped KPIs', path: ['subsidiaryId'] }
).refine(
  (data) => {
    if (data.scope === KPI_SCOPE.DEPARTMENT && !data.departmentId) {
      return false;
    }
    return true;
  },
  { message: 'Department ID is required for department-scoped KPIs', path: ['departmentId'] }
).refine(
  (data) => {
    if (data.scope === KPI_SCOPE.TEAM && !data.teamId) {
      return false;
    }
    return true;
  },
  { message: 'Team ID is required for team-scoped KPIs', path: ['teamId'] }
).refine(
  (data) => {
    if (data.scope === KPI_SCOPE.PROJECT && !data.projectId) {
      return false;
    }
    return true;
  },
  { message: 'Project ID is required for project-scoped KPIs', path: ['projectId'] }
);

// ----------------------------------------------------------------------------
// Update KPI Schema
// ----------------------------------------------------------------------------
export const updateKPISchema = z.object({
  code: z.string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/)
    .optional(),
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: kpiCategorySchema.optional(),
  type: kpiTypeSchema.optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().max(100).optional().nullable(),
  unit: z.string().max(50).optional(),
  direction: kpiDirectionSchema.optional(),
  frequency: kpiFrequencySchema.optional(),
  decimalPlaces: z.number().min(0).max(6).optional(),
  linkedStrategyPillarId: z.string().optional().nullable(),
  linkedOKRKeyResultIds: z.array(z.string()).optional(),
  bscPerspective: bscPerspectiveSchema.optional().nullable(),
  tags: z.array(z.string().max(30)).max(KPI_DEFAULTS.MAX_TAGS).optional(),
  isPublic: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

// ----------------------------------------------------------------------------
// KPI Data Point Schema
// ----------------------------------------------------------------------------
export const createDataPointSchema = z.object({
  kpiId: z.string().min(1, 'KPI ID required'),
  date: z.date(),
  periodStart: z.date().optional(),
  periodEnd: z.date().optional(),
  fiscalYear: z.number().min(2020).max(2100),
  fiscalQuarter: z.number().min(1).max(4).optional(),
  fiscalMonth: z.number().min(1).max(12).optional(),
  value: z.number(),
  note: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.periodStart && data.periodEnd) {
      return data.periodStart <= data.periodEnd;
    }
    return true;
  },
  { message: 'Period start must be before or equal to period end', path: ['periodEnd'] }
);

// ----------------------------------------------------------------------------
// Scorecard Section Schema
// ----------------------------------------------------------------------------
export const scorecardSectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Section name required').max(100),
  description: z.string().max(500).optional(),
  category: kpiCategorySchema.optional(),
  bscPerspective: bscPerspectiveSchema.optional(),
  kpiIds: z.array(z.string()),
  weight: z.number().min(0).max(100),
  order: z.number().min(0).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// ----------------------------------------------------------------------------
// Create Scorecard Schema
// ----------------------------------------------------------------------------
export const createScorecardSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
  type: kpiScorecardTypeSchema,
  scope: kpiScopeSchema,
  subsidiaryId: z.string().optional(),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  fiscalYear: z.number().min(2020).max(2100),
  quarter: z.number().min(1).max(4).optional(),
  sections: z.array(scorecardSectionSchema)
    .min(1, 'At least one section required')
    .max(KPI_DEFAULTS.MAX_SECTIONS_PER_SCORECARD),
  showTrends: z.boolean().default(true),
  showTargets: z.boolean().default(true),
  showVariance: z.boolean().default(true),
  refreshFrequency: kpiFrequencySchema.default(KPI_FREQUENCY.DAILY),
}).refine(
  (data) => {
    const totalWeight = data.sections.reduce((sum, s) => sum + s.weight, 0);
    return Math.abs(totalWeight - 100) < 0.01;
  },
  { message: 'Section weights must sum to 100%', path: ['sections'] }
);

// ----------------------------------------------------------------------------
// Update Scorecard Schema
// ----------------------------------------------------------------------------
export const updateScorecardSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  status: kpiStatusSchema.optional(),
  showTrends: z.boolean().optional(),
  showTargets: z.boolean().optional(),
  showVariance: z.boolean().optional(),
  refreshFrequency: kpiFrequencySchema.optional(),
});

// ----------------------------------------------------------------------------
// Update Scorecard Section Schema
// ----------------------------------------------------------------------------
export const updateScorecardSectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  category: kpiCategorySchema.optional().nullable(),
  bscPerspective: bscPerspectiveSchema.optional().nullable(),
  kpiIds: z.array(z.string()).optional(),
  weight: z.number().min(0).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

// ----------------------------------------------------------------------------
// Type Exports
// ----------------------------------------------------------------------------
export type KPICategorySchemaType = z.infer<typeof kpiCategorySchema>;
export type KPITypeSchemaType = z.infer<typeof kpiTypeSchema>;
export type KPIStatusSchemaType = z.infer<typeof kpiStatusSchema>;
export type KPIScopeSchemaType = z.infer<typeof kpiScopeSchema>;
export type KPIDirectionSchemaType = z.infer<typeof kpiDirectionSchema>;
export type KPIFrequencySchemaType = z.infer<typeof kpiFrequencySchema>;
export type KPITargetSchemaType = z.infer<typeof kpiTargetSchema>;
export type KPIThresholdSchemaType = z.infer<typeof kpiThresholdSchema>;
export type CreateKPISchemaType = z.infer<typeof createKPISchema>;
export type UpdateKPISchemaType = z.infer<typeof updateKPISchema>;
export type CreateDataPointSchemaType = z.infer<typeof createDataPointSchema>;
export type ScorecardSectionSchemaType = z.infer<typeof scorecardSectionSchema>;
export type CreateScorecardSchemaType = z.infer<typeof createScorecardSchema>;
export type UpdateScorecardSchemaType = z.infer<typeof updateScorecardSchema>;
export type UpdateScorecardSectionSchemaType = z.infer<typeof updateScorecardSectionSchema>;

// ----------------------------------------------------------------------------
// Validation Functions
// ----------------------------------------------------------------------------
export function validateCreateKPI(data: unknown) {
  return createKPISchema.safeParse(data);
}

export function validateUpdateKPI(data: unknown) {
  return updateKPISchema.safeParse(data);
}

export function validateCreateDataPoint(data: unknown) {
  return createDataPointSchema.safeParse(data);
}

export function validateCreateScorecard(data: unknown) {
  return createScorecardSchema.safeParse(data);
}

export function validateUpdateScorecard(data: unknown) {
  return updateScorecardSchema.safeParse(data);
}

export function validateKPITarget(data: unknown) {
  return kpiTargetSchema.safeParse(data);
}

export function validateKPIThreshold(data: unknown) {
  return kpiThresholdSchema.safeParse(data);
}
