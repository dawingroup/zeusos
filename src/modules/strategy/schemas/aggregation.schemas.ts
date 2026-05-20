// ============================================================================
// AGGREGATION SCHEMAS
// DawinOS v2.0 - CEO Strategy Command Module
// Zod validation schemas for performance aggregation
// ============================================================================

import { z } from 'zod';
import {
  AGGREGATION_LEVELS,
  PERFORMANCE_DOMAINS,
  PERFORMANCE_RATINGS,
  TREND_INDICATORS,
  COMPARISON_PERIODS,
  AGGREGATION_METHODS,
  HEALTH_INDICATORS,
  SNAPSHOT_FREQUENCIES,
} from '../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// BASE SCHEMAS
// ----------------------------------------------------------------------------

export const aggregationLevelSchema = z.enum([
  AGGREGATION_LEVELS.GROUP,
  AGGREGATION_LEVELS.SUBSIDIARY,
  AGGREGATION_LEVELS.DEPARTMENT,
  AGGREGATION_LEVELS.TEAM,
  AGGREGATION_LEVELS.INDIVIDUAL,
]);

export const performanceDomainSchema = z.enum([
  PERFORMANCE_DOMAINS.STRATEGY,
  PERFORMANCE_DOMAINS.OKR,
  PERFORMANCE_DOMAINS.KPI,
  PERFORMANCE_DOMAINS.COMBINED,
]);

export const performanceRatingSchema = z.enum([
  PERFORMANCE_RATINGS.EXCEPTIONAL,
  PERFORMANCE_RATINGS.STRONG,
  PERFORMANCE_RATINGS.ON_TRACK,
  PERFORMANCE_RATINGS.NEEDS_ATTENTION,
  PERFORMANCE_RATINGS.AT_RISK,
  PERFORMANCE_RATINGS.CRITICAL,
]);

export const trendIndicatorSchema = z.enum([
  TREND_INDICATORS.STRONG_UP,
  TREND_INDICATORS.UP,
  TREND_INDICATORS.STABLE,
  TREND_INDICATORS.DOWN,
  TREND_INDICATORS.STRONG_DOWN,
]);

export const comparisonPeriodSchema = z.enum([
  COMPARISON_PERIODS.PREVIOUS_PERIOD,
  COMPARISON_PERIODS.PREVIOUS_QUARTER,
  COMPARISON_PERIODS.PREVIOUS_YEAR,
  COMPARISON_PERIODS.BUDGET,
  COMPARISON_PERIODS.TARGET,
]);

export const aggregationMethodSchema = z.enum([
  AGGREGATION_METHODS.WEIGHTED_AVERAGE,
  AGGREGATION_METHODS.SIMPLE_AVERAGE,
  AGGREGATION_METHODS.SUM,
  AGGREGATION_METHODS.MIN,
  AGGREGATION_METHODS.MAX,
  AGGREGATION_METHODS.MEDIAN,
  AGGREGATION_METHODS.CUSTOM,
]);

export const healthIndicatorSchema = z.enum([
  HEALTH_INDICATORS.HEALTHY,
  HEALTH_INDICATORS.WARNING,
  HEALTH_INDICATORS.CRITICAL,
  HEALTH_INDICATORS.NO_DATA,
]);

export const snapshotFrequencySchema = z.enum([
  SNAPSHOT_FREQUENCIES.DAILY,
  SNAPSHOT_FREQUENCIES.WEEKLY,
  SNAPSHOT_FREQUENCIES.MONTHLY,
  SNAPSHOT_FREQUENCIES.QUARTERLY,
]);

// ----------------------------------------------------------------------------
// PERFORMANCE WEIGHTS SCHEMA
// ----------------------------------------------------------------------------

export const performanceWeightsSchema = z.object({
  strategy: z.number().min(0).max(1),
  okr: z.number().min(0).max(1),
  kpi: z.number().min(0).max(1),
}).refine(
  (data) => Math.abs(data.strategy + data.okr + data.kpi - 1) < 0.01,
  { message: 'Weights must sum to 1.0' }
);

// ----------------------------------------------------------------------------
// AGGREGATION INPUT SCHEMA
// ----------------------------------------------------------------------------

export const aggregationInputSchema = z.object({
  level: aggregationLevelSchema,
  entityId: z.string().min(1),
  entityName: z.string().min(1).max(200),
  fiscalYear: z.number().min(2020).max(2100),
  quarter: z.number().min(1).max(4).optional(),
  month: z.number().min(1).max(12).optional(),
  weights: performanceWeightsSchema.optional(),
  includeChildren: z.boolean().optional().default(false),
});

// ----------------------------------------------------------------------------
// AGGREGATION CONFIG SCHEMA
// ----------------------------------------------------------------------------

export const aggregationConfigSchema = z.object({
  name: z.string().min(3).max(100),
  weights: performanceWeightsSchema,
  includeLevels: z.array(aggregationLevelSchema).min(1),
  method: aggregationMethodSchema,
  snapshotFrequency: snapshotFrequencySchema,
  snapshotRetentionDays: z.number().min(30).max(1825), // 30 days to 5 years
  ratingThresholds: z.record(performanceRatingSchema, z.number().min(0).max(100)),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

// ----------------------------------------------------------------------------
// COMPARISON REQUEST SCHEMA
// ----------------------------------------------------------------------------

export const comparisonRequestSchema = z.object({
  entityIds: z.array(z.string()).min(2).max(20),
  domain: performanceDomainSchema,
  fiscalYear: z.number().min(2020).max(2100),
  quarter: z.number().min(1).max(4).optional(),
  month: z.number().min(1).max(12).optional(),
  comparisonPeriod: comparisonPeriodSchema.optional(),
});

// ----------------------------------------------------------------------------
// TREND REQUEST SCHEMA
// ----------------------------------------------------------------------------

export const trendRequestSchema = z.object({
  entityId: z.string().min(1),
  level: aggregationLevelSchema,
  domain: performanceDomainSchema,
  periods: z.number().min(3).max(24).default(12),
  frequency: snapshotFrequencySchema.default(SNAPSHOT_FREQUENCIES.MONTHLY),
});

// ----------------------------------------------------------------------------
// HEATMAP REQUEST SCHEMA
// ----------------------------------------------------------------------------

export const heatmapRequestSchema = z.object({
  entityIds: z.array(z.string()).min(1).max(50),
  domains: z.array(performanceDomainSchema).min(1),
  fiscalYear: z.number().min(2020).max(2100),
  quarter: z.number().min(1).max(4).optional(),
});

// ----------------------------------------------------------------------------
// SNAPSHOT REQUEST SCHEMA
// ----------------------------------------------------------------------------

export const snapshotRequestSchema = z.object({
  level: aggregationLevelSchema,
  entityId: z.string().min(1),
  frequency: snapshotFrequencySchema,
  fiscalYear: z.number().min(2020).max(2100),
  quarter: z.number().min(1).max(4).optional(),
  month: z.number().min(1).max(12).optional(),
});

// ----------------------------------------------------------------------------
// SNAPSHOT FILTERS SCHEMA
// ----------------------------------------------------------------------------

export const snapshotFiltersSchema = z.object({
  level: aggregationLevelSchema.optional(),
  entityId: z.string().optional(),
  frequency: snapshotFrequencySchema.optional(),
  fiscalYear: z.number().min(2020).max(2100).optional(),
  quarter: z.number().min(1).max(4).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(100).optional(),
});

// ----------------------------------------------------------------------------
// TYPE EXPORTS
// ----------------------------------------------------------------------------

export type AggregationLevelSchemaType = z.infer<typeof aggregationLevelSchema>;
export type PerformanceDomainSchemaType = z.infer<typeof performanceDomainSchema>;
export type PerformanceRatingSchemaType = z.infer<typeof performanceRatingSchema>;
export type TrendIndicatorSchemaType = z.infer<typeof trendIndicatorSchema>;
export type ComparisonPeriodSchemaType = z.infer<typeof comparisonPeriodSchema>;
export type AggregationMethodSchemaType = z.infer<typeof aggregationMethodSchema>;
export type HealthIndicatorSchemaType = z.infer<typeof healthIndicatorSchema>;
export type SnapshotFrequencySchemaType = z.infer<typeof snapshotFrequencySchema>;
export type PerformanceWeightsSchemaType = z.infer<typeof performanceWeightsSchema>;
export type AggregationInputSchemaType = z.infer<typeof aggregationInputSchema>;
export type AggregationConfigSchemaType = z.infer<typeof aggregationConfigSchema>;
export type ComparisonRequestSchemaType = z.infer<typeof comparisonRequestSchema>;
export type TrendRequestSchemaType = z.infer<typeof trendRequestSchema>;
export type HeatmapRequestSchemaType = z.infer<typeof heatmapRequestSchema>;
export type SnapshotRequestSchemaType = z.infer<typeof snapshotRequestSchema>;
export type SnapshotFiltersSchemaType = z.infer<typeof snapshotFiltersSchema>;

// ----------------------------------------------------------------------------
// VALIDATION FUNCTIONS
// ----------------------------------------------------------------------------

export function validateAggregationInput(data: unknown) {
  return aggregationInputSchema.safeParse(data);
}

export function validateAggregationConfig(data: unknown) {
  return aggregationConfigSchema.safeParse(data);
}

export function validateComparisonRequest(data: unknown) {
  return comparisonRequestSchema.safeParse(data);
}

export function validateTrendRequest(data: unknown) {
  return trendRequestSchema.safeParse(data);
}

export function validateHeatmapRequest(data: unknown) {
  return heatmapRequestSchema.safeParse(data);
}

export function validateSnapshotRequest(data: unknown) {
  return snapshotRequestSchema.safeParse(data);
}

export function validatePerformanceWeights(data: unknown) {
  return performanceWeightsSchema.safeParse(data);
}
