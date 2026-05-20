// ============================================================================
// AGGREGATION CONSTANTS
// DawinOS v2.0 - CEO Strategy Command Module
// Constants for performance aggregation across strategy, OKRs, and KPIs
// ============================================================================

// ----------------------------------------------------------------------------
// AGGREGATION LEVELS
// ----------------------------------------------------------------------------

export const AGGREGATION_LEVELS = {
  GROUP: 'group',
  SUBSIDIARY: 'subsidiary',
  DEPARTMENT: 'department',
  TEAM: 'team',
  INDIVIDUAL: 'individual',
} as const;

export type AggregationLevel = typeof AGGREGATION_LEVELS[keyof typeof AGGREGATION_LEVELS];

export const AGGREGATION_LEVEL_LABELS: Record<AggregationLevel, string> = {
  [AGGREGATION_LEVELS.GROUP]: 'Dawin Group',
  [AGGREGATION_LEVELS.SUBSIDIARY]: 'Subsidiary',
  [AGGREGATION_LEVELS.DEPARTMENT]: 'Department',
  [AGGREGATION_LEVELS.TEAM]: 'Team',
  [AGGREGATION_LEVELS.INDIVIDUAL]: 'Individual',
};

export const AGGREGATION_LEVEL_ORDER: AggregationLevel[] = [
  AGGREGATION_LEVELS.GROUP,
  AGGREGATION_LEVELS.SUBSIDIARY,
  AGGREGATION_LEVELS.DEPARTMENT,
  AGGREGATION_LEVELS.TEAM,
  AGGREGATION_LEVELS.INDIVIDUAL,
];

// ----------------------------------------------------------------------------
// PERFORMANCE DOMAINS
// ----------------------------------------------------------------------------

export const PERFORMANCE_DOMAINS = {
  STRATEGY: 'strategy',
  OKR: 'okr',
  KPI: 'kpi',
  COMBINED: 'combined',
} as const;

export type PerformanceDomain = typeof PERFORMANCE_DOMAINS[keyof typeof PERFORMANCE_DOMAINS];

export const PERFORMANCE_DOMAIN_LABELS: Record<PerformanceDomain, string> = {
  [PERFORMANCE_DOMAINS.STRATEGY]: 'Strategic Execution',
  [PERFORMANCE_DOMAINS.OKR]: 'Objectives & Key Results',
  [PERFORMANCE_DOMAINS.KPI]: 'Key Performance Indicators',
  [PERFORMANCE_DOMAINS.COMBINED]: 'Overall Performance',
};

export const PERFORMANCE_DOMAIN_WEIGHTS: Record<PerformanceDomain, number> = {
  [PERFORMANCE_DOMAINS.STRATEGY]: 0.3,
  [PERFORMANCE_DOMAINS.OKR]: 0.4,
  [PERFORMANCE_DOMAINS.KPI]: 0.3,
  [PERFORMANCE_DOMAINS.COMBINED]: 1.0,
};

// ----------------------------------------------------------------------------
// PERFORMANCE RATING
// ----------------------------------------------------------------------------

export const PERFORMANCE_RATINGS = {
  EXCEPTIONAL: 'exceptional',
  STRONG: 'strong',
  ON_TRACK: 'on_track',
  NEEDS_ATTENTION: 'needs_attention',
  AT_RISK: 'at_risk',
  CRITICAL: 'critical',
} as const;

export type PerformanceRating = typeof PERFORMANCE_RATINGS[keyof typeof PERFORMANCE_RATINGS];

export const PERFORMANCE_RATING_LABELS: Record<PerformanceRating, string> = {
  [PERFORMANCE_RATINGS.EXCEPTIONAL]: 'Exceptional',
  [PERFORMANCE_RATINGS.STRONG]: 'Strong',
  [PERFORMANCE_RATINGS.ON_TRACK]: 'On Track',
  [PERFORMANCE_RATINGS.NEEDS_ATTENTION]: 'Needs Attention',
  [PERFORMANCE_RATINGS.AT_RISK]: 'At Risk',
  [PERFORMANCE_RATINGS.CRITICAL]: 'Critical',
};

export const PERFORMANCE_RATING_COLORS: Record<PerformanceRating, string> = {
  [PERFORMANCE_RATINGS.EXCEPTIONAL]: '#1B5E20',  // Dark Green
  [PERFORMANCE_RATINGS.STRONG]: '#4CAF50',       // Green
  [PERFORMANCE_RATINGS.ON_TRACK]: '#8BC34A',     // Light Green
  [PERFORMANCE_RATINGS.NEEDS_ATTENTION]: '#FF9800', // Orange
  [PERFORMANCE_RATINGS.AT_RISK]: '#F44336',      // Red
  [PERFORMANCE_RATINGS.CRITICAL]: '#B71C1C',     // Dark Red
};

export const PERFORMANCE_RATING_THRESHOLDS = {
  EXCEPTIONAL: 90,
  STRONG: 80,
  ON_TRACK: 60,
  NEEDS_ATTENTION: 40,
  AT_RISK: 20,
  CRITICAL: 0,
} as const;

// ----------------------------------------------------------------------------
// SNAPSHOT FREQUENCY
// ----------------------------------------------------------------------------

export const SNAPSHOT_FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
} as const;

export type SnapshotFrequency = typeof SNAPSHOT_FREQUENCIES[keyof typeof SNAPSHOT_FREQUENCIES];

export const SNAPSHOT_FREQUENCY_LABELS: Record<SnapshotFrequency, string> = {
  [SNAPSHOT_FREQUENCIES.DAILY]: 'Daily',
  [SNAPSHOT_FREQUENCIES.WEEKLY]: 'Weekly',
  [SNAPSHOT_FREQUENCIES.MONTHLY]: 'Monthly',
  [SNAPSHOT_FREQUENCIES.QUARTERLY]: 'Quarterly',
};

// ----------------------------------------------------------------------------
// TREND INDICATORS
// ----------------------------------------------------------------------------

export const TREND_INDICATORS = {
  STRONG_UP: 'strong_up',
  UP: 'up',
  STABLE: 'stable',
  DOWN: 'down',
  STRONG_DOWN: 'strong_down',
} as const;

export type TrendIndicator = typeof TREND_INDICATORS[keyof typeof TREND_INDICATORS];

export const TREND_INDICATOR_LABELS: Record<TrendIndicator, string> = {
  [TREND_INDICATORS.STRONG_UP]: 'Strong Upward Trend',
  [TREND_INDICATORS.UP]: 'Upward Trend',
  [TREND_INDICATORS.STABLE]: 'Stable',
  [TREND_INDICATORS.DOWN]: 'Downward Trend',
  [TREND_INDICATORS.STRONG_DOWN]: 'Strong Downward Trend',
};

export const TREND_INDICATOR_COLORS: Record<TrendIndicator, string> = {
  [TREND_INDICATORS.STRONG_UP]: '#1B5E20',
  [TREND_INDICATORS.UP]: '#4CAF50',
  [TREND_INDICATORS.STABLE]: '#9E9E9E',
  [TREND_INDICATORS.DOWN]: '#F44336',
  [TREND_INDICATORS.STRONG_DOWN]: '#B71C1C',
};

export const TREND_THRESHOLDS = {
  STRONG_UP: 10,    // > 10% improvement
  UP: 3,            // > 3% improvement
  STABLE_UPPER: 3,  // -3% to +3%
  STABLE_LOWER: -3,
  DOWN: -10,        // > 3% decline
  STRONG_DOWN: -10, // > 10% decline
} as const;

// ----------------------------------------------------------------------------
// COMPARISON PERIODS
// ----------------------------------------------------------------------------

export const COMPARISON_PERIODS = {
  PREVIOUS_PERIOD: 'previous_period',
  PREVIOUS_QUARTER: 'previous_quarter',
  PREVIOUS_YEAR: 'previous_year',
  BUDGET: 'budget',
  TARGET: 'target',
} as const;

export type ComparisonPeriod = typeof COMPARISON_PERIODS[keyof typeof COMPARISON_PERIODS];

export const COMPARISON_PERIOD_LABELS: Record<ComparisonPeriod, string> = {
  [COMPARISON_PERIODS.PREVIOUS_PERIOD]: 'vs Previous Period',
  [COMPARISON_PERIODS.PREVIOUS_QUARTER]: 'vs Previous Quarter',
  [COMPARISON_PERIODS.PREVIOUS_YEAR]: 'vs Previous Year',
  [COMPARISON_PERIODS.BUDGET]: 'vs Budget',
  [COMPARISON_PERIODS.TARGET]: 'vs Target',
};

// ----------------------------------------------------------------------------
// AGGREGATION METHODS
// ----------------------------------------------------------------------------

export const AGGREGATION_METHODS = {
  WEIGHTED_AVERAGE: 'weighted_average',
  SIMPLE_AVERAGE: 'simple_average',
  SUM: 'sum',
  MIN: 'min',
  MAX: 'max',
  MEDIAN: 'median',
  CUSTOM: 'custom',
} as const;

export type AggregationMethod = typeof AGGREGATION_METHODS[keyof typeof AGGREGATION_METHODS];

export const AGGREGATION_METHOD_LABELS: Record<AggregationMethod, string> = {
  [AGGREGATION_METHODS.WEIGHTED_AVERAGE]: 'Weighted Average',
  [AGGREGATION_METHODS.SIMPLE_AVERAGE]: 'Simple Average',
  [AGGREGATION_METHODS.SUM]: 'Sum',
  [AGGREGATION_METHODS.MIN]: 'Minimum',
  [AGGREGATION_METHODS.MAX]: 'Maximum',
  [AGGREGATION_METHODS.MEDIAN]: 'Median',
  [AGGREGATION_METHODS.CUSTOM]: 'Custom',
};

// ----------------------------------------------------------------------------
// DEFAULTS
// ----------------------------------------------------------------------------

export const AGGREGATION_DEFAULTS = {
  DEFAULT_WEIGHT_STRATEGY: 0.3,
  DEFAULT_WEIGHT_OKR: 0.4,
  DEFAULT_WEIGHT_KPI: 0.3,
  SNAPSHOT_RETENTION_DAYS: 365,
  TREND_PERIODS: 12,
  COMPARISON_PERIODS: 4,
  HEATMAP_CELLS_MAX: 100,
  MIN_DATA_POINTS_FOR_TREND: 3,
} as const;

// ----------------------------------------------------------------------------
// HEALTH INDICATORS
// ----------------------------------------------------------------------------

export const HEALTH_INDICATORS = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  NO_DATA: 'no_data',
} as const;

export type HealthIndicator = typeof HEALTH_INDICATORS[keyof typeof HEALTH_INDICATORS];

export const HEALTH_INDICATOR_LABELS: Record<HealthIndicator, string> = {
  [HEALTH_INDICATORS.HEALTHY]: 'Healthy',
  [HEALTH_INDICATORS.WARNING]: 'Warning',
  [HEALTH_INDICATORS.CRITICAL]: 'Critical',
  [HEALTH_INDICATORS.NO_DATA]: 'No Data',
};

export const HEALTH_INDICATOR_COLORS: Record<HealthIndicator, string> = {
  [HEALTH_INDICATORS.HEALTHY]: '#4CAF50',
  [HEALTH_INDICATORS.WARNING]: '#FF9800',
  [HEALTH_INDICATORS.CRITICAL]: '#F44336',
  [HEALTH_INDICATORS.NO_DATA]: '#9E9E9E',
};

// ----------------------------------------------------------------------------
// COLLECTION NAMES
// ----------------------------------------------------------------------------

export const AGGREGATION_COLLECTIONS = {
  AGGREGATIONS: 'performanceAggregations',
  SNAPSHOTS: 'performanceSnapshots',
  CONFIGS: 'aggregationConfigs',
} as const;

// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Get performance rating from score
 */
export function getRatingFromScore(score: number): PerformanceRating {
  if (score >= PERFORMANCE_RATING_THRESHOLDS.EXCEPTIONAL) {
    return PERFORMANCE_RATINGS.EXCEPTIONAL;
  }
  if (score >= PERFORMANCE_RATING_THRESHOLDS.STRONG) {
    return PERFORMANCE_RATINGS.STRONG;
  }
  if (score >= PERFORMANCE_RATING_THRESHOLDS.ON_TRACK) {
    return PERFORMANCE_RATINGS.ON_TRACK;
  }
  if (score >= PERFORMANCE_RATING_THRESHOLDS.NEEDS_ATTENTION) {
    return PERFORMANCE_RATINGS.NEEDS_ATTENTION;
  }
  if (score >= PERFORMANCE_RATING_THRESHOLDS.AT_RISK) {
    return PERFORMANCE_RATINGS.AT_RISK;
  }
  return PERFORMANCE_RATINGS.CRITICAL;
}

/**
 * Get trend indicator from change percentage
 */
export function getTrendFromChange(changePercent: number): TrendIndicator {
  if (changePercent > TREND_THRESHOLDS.STRONG_UP) {
    return TREND_INDICATORS.STRONG_UP;
  }
  if (changePercent > TREND_THRESHOLDS.UP) {
    return TREND_INDICATORS.UP;
  }
  if (changePercent >= TREND_THRESHOLDS.STABLE_LOWER && changePercent <= TREND_THRESHOLDS.STABLE_UPPER) {
    return TREND_INDICATORS.STABLE;
  }
  if (changePercent > TREND_THRESHOLDS.STRONG_DOWN) {
    return TREND_INDICATORS.DOWN;
  }
  return TREND_INDICATORS.STRONG_DOWN;
}

/**
 * Get health indicator from score
 */
export function getHealthFromScore(score: number): HealthIndicator {
  if (score >= 70) return HEALTH_INDICATORS.HEALTHY;
  if (score >= 40) return HEALTH_INDICATORS.WARNING;
  if (score > 0) return HEALTH_INDICATORS.CRITICAL;
  return HEALTH_INDICATORS.NO_DATA;
}

/**
 * Get rating color
 */
export function getRatingColor(rating: PerformanceRating): string {
  return PERFORMANCE_RATING_COLORS[rating] || PERFORMANCE_RATING_COLORS.critical;
}

/**
 * Get trend color
 */
export function getTrendColor(trend: TrendIndicator): string {
  return TREND_INDICATOR_COLORS[trend] || TREND_INDICATOR_COLORS.stable;
}

/**
 * Get health color
 */
export function getHealthColor(health: HealthIndicator): string {
  return HEALTH_INDICATOR_COLORS[health] || HEALTH_INDICATOR_COLORS.no_data;
}

/**
 * Get child level for hierarchy
 */
export function getChildLevel(level: AggregationLevel): AggregationLevel | null {
  const index = AGGREGATION_LEVEL_ORDER.indexOf(level);
  if (index === -1 || index === AGGREGATION_LEVEL_ORDER.length - 1) {
    return null;
  }
  return AGGREGATION_LEVEL_ORDER[index + 1];
}

/**
 * Get parent level for hierarchy
 */
export function getParentLevel(level: AggregationLevel): AggregationLevel | null {
  const index = AGGREGATION_LEVEL_ORDER.indexOf(level);
  if (index <= 0) {
    return null;
  }
  return AGGREGATION_LEVEL_ORDER[index - 1];
}
