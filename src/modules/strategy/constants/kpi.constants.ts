// ============================================================================
// KPI CONSTANTS - ZeusOS CEO Strategy Command
// Constants for KPI (Key Performance Indicator) management
// ============================================================================

// ----------------------------------------------------------------------------
// KPI Category
// ----------------------------------------------------------------------------
export const KPI_CATEGORY = {
  FINANCIAL: 'financial',
  CUSTOMER: 'customer',
  OPERATIONAL: 'operational',
  PEOPLE: 'people',
  GROWTH: 'growth',
  QUALITY: 'quality',
  INNOVATION: 'innovation',
  SUSTAINABILITY: 'sustainability',
  SALES_MARKETING: 'sales_marketing',
  HEALTHCARE: 'healthcare',
} as const;

export type KPICategory = typeof KPI_CATEGORY[keyof typeof KPI_CATEGORY];

export const KPI_CATEGORY_LABELS: Record<KPICategory, string> = {
  [KPI_CATEGORY.FINANCIAL]: 'Financial',
  [KPI_CATEGORY.CUSTOMER]: 'Customer',
  [KPI_CATEGORY.OPERATIONAL]: 'Operational',
  [KPI_CATEGORY.PEOPLE]: 'People & HR',
  [KPI_CATEGORY.GROWTH]: 'Growth',
  [KPI_CATEGORY.QUALITY]: 'Quality',
  [KPI_CATEGORY.INNOVATION]: 'Innovation',
  [KPI_CATEGORY.SUSTAINABILITY]: 'Sustainability',
  [KPI_CATEGORY.SALES_MARKETING]: 'Sales & Marketing',
  [KPI_CATEGORY.HEALTHCARE]: 'Healthcare / Clinical',
};

export const KPI_CATEGORY_COLORS: Record<KPICategory, string> = {
  [KPI_CATEGORY.FINANCIAL]: '#4CAF50',
  [KPI_CATEGORY.CUSTOMER]: '#2196F3',
  [KPI_CATEGORY.OPERATIONAL]: '#FF9800',
  [KPI_CATEGORY.PEOPLE]: '#9C27B0',
  [KPI_CATEGORY.GROWTH]: '#00BCD4',
  [KPI_CATEGORY.QUALITY]: '#F44336',
  [KPI_CATEGORY.INNOVATION]: '#3F51B5',
  [KPI_CATEGORY.SUSTAINABILITY]: '#8BC34A',
  [KPI_CATEGORY.SALES_MARKETING]: '#E91E63',
  [KPI_CATEGORY.HEALTHCARE]: '#009688',
};

export const KPI_CATEGORY_ICONS: Record<KPICategory, string> = {
  [KPI_CATEGORY.FINANCIAL]: 'attach_money',
  [KPI_CATEGORY.CUSTOMER]: 'people',
  [KPI_CATEGORY.OPERATIONAL]: 'settings',
  [KPI_CATEGORY.PEOPLE]: 'badge',
  [KPI_CATEGORY.GROWTH]: 'trending_up',
  [KPI_CATEGORY.QUALITY]: 'verified',
  [KPI_CATEGORY.INNOVATION]: 'lightbulb',
  [KPI_CATEGORY.SUSTAINABILITY]: 'eco',
  [KPI_CATEGORY.SALES_MARKETING]: 'megaphone',
  [KPI_CATEGORY.HEALTHCARE]: 'heart_pulse',
};

// ----------------------------------------------------------------------------
// KPI Type
// ----------------------------------------------------------------------------
export const KPI_TYPE = {
  NUMERIC: 'numeric',
  PERCENTAGE: 'percentage',
  CURRENCY: 'currency',
  RATIO: 'ratio',
  INDEX: 'index',
  RATING: 'rating',
  BINARY: 'binary',
} as const;

export type KPIType = typeof KPI_TYPE[keyof typeof KPI_TYPE];

export const KPI_TYPE_LABELS: Record<KPIType, string> = {
  [KPI_TYPE.NUMERIC]: 'Numeric',
  [KPI_TYPE.PERCENTAGE]: 'Percentage',
  [KPI_TYPE.CURRENCY]: 'Currency',
  [KPI_TYPE.RATIO]: 'Ratio',
  [KPI_TYPE.INDEX]: 'Index',
  [KPI_TYPE.RATING]: 'Rating (1-5)',
  [KPI_TYPE.BINARY]: 'Yes/No',
};

// ----------------------------------------------------------------------------
// KPI Status
// ----------------------------------------------------------------------------
export const KPI_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived',
} as const;

export type KPIStatus = typeof KPI_STATUS[keyof typeof KPI_STATUS];

export const KPI_STATUS_LABELS: Record<KPIStatus, string> = {
  [KPI_STATUS.DRAFT]: 'Draft',
  [KPI_STATUS.ACTIVE]: 'Active',
  [KPI_STATUS.PAUSED]: 'Paused',
  [KPI_STATUS.DEPRECATED]: 'Deprecated',
  [KPI_STATUS.ARCHIVED]: 'Archived',
};

export const KPI_STATUS_COLORS: Record<KPIStatus, string> = {
  [KPI_STATUS.DRAFT]: 'default',
  [KPI_STATUS.ACTIVE]: 'success',
  [KPI_STATUS.PAUSED]: 'warning',
  [KPI_STATUS.DEPRECATED]: 'error',
  [KPI_STATUS.ARCHIVED]: 'default',
};

// ----------------------------------------------------------------------------
// KPI Scope
// ----------------------------------------------------------------------------
export const KPI_SCOPE = {
  GROUP: 'group',
  SUBSIDIARY: 'subsidiary',
  DEPARTMENT: 'department',
  TEAM: 'team',
  PROJECT: 'project',
} as const;

export type KPIScope = typeof KPI_SCOPE[keyof typeof KPI_SCOPE];

export const KPI_SCOPE_LABELS: Record<KPIScope, string> = {
  [KPI_SCOPE.GROUP]: 'Group-wide',
  [KPI_SCOPE.SUBSIDIARY]: 'Subsidiary',
  [KPI_SCOPE.DEPARTMENT]: 'Department',
  [KPI_SCOPE.TEAM]: 'Team',
  [KPI_SCOPE.PROJECT]: 'Project',
};

// ----------------------------------------------------------------------------
// KPI Direction (Performance Polarity)
// ----------------------------------------------------------------------------
export const KPI_DIRECTION = {
  HIGHER_IS_BETTER: 'higher_is_better',
  LOWER_IS_BETTER: 'lower_is_better',
  TARGET_IS_BEST: 'target_is_best',
  RANGE_IS_BEST: 'range_is_best',
} as const;

export type KPIDirection = typeof KPI_DIRECTION[keyof typeof KPI_DIRECTION];

export const KPI_DIRECTION_LABELS: Record<KPIDirection, string> = {
  [KPI_DIRECTION.HIGHER_IS_BETTER]: 'Higher is Better',
  [KPI_DIRECTION.LOWER_IS_BETTER]: 'Lower is Better',
  [KPI_DIRECTION.TARGET_IS_BEST]: 'Target is Best',
  [KPI_DIRECTION.RANGE_IS_BEST]: 'Within Range is Best',
};

// ----------------------------------------------------------------------------
// KPI Tracking Frequency
// ----------------------------------------------------------------------------
export const KPI_FREQUENCY = {
  REAL_TIME: 'real_time',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BI_WEEKLY: 'bi_weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'annually',
} as const;

export type KPIFrequency = typeof KPI_FREQUENCY[keyof typeof KPI_FREQUENCY];

export const KPI_FREQUENCY_LABELS: Record<KPIFrequency, string> = {
  [KPI_FREQUENCY.REAL_TIME]: 'Real-time',
  [KPI_FREQUENCY.DAILY]: 'Daily',
  [KPI_FREQUENCY.WEEKLY]: 'Weekly',
  [KPI_FREQUENCY.BI_WEEKLY]: 'Bi-weekly',
  [KPI_FREQUENCY.MONTHLY]: 'Monthly',
  [KPI_FREQUENCY.QUARTERLY]: 'Quarterly',
  [KPI_FREQUENCY.ANNUALLY]: 'Annually',
};

export const KPI_FREQUENCY_DAYS: Record<KPIFrequency, number> = {
  [KPI_FREQUENCY.REAL_TIME]: 0,
  [KPI_FREQUENCY.DAILY]: 1,
  [KPI_FREQUENCY.WEEKLY]: 7,
  [KPI_FREQUENCY.BI_WEEKLY]: 14,
  [KPI_FREQUENCY.MONTHLY]: 30,
  [KPI_FREQUENCY.QUARTERLY]: 90,
  [KPI_FREQUENCY.ANNUALLY]: 365,
};

// ----------------------------------------------------------------------------
// KPI Performance Status
// ----------------------------------------------------------------------------
export const KPI_PERFORMANCE = {
  EXCEEDING: 'exceeding',
  ON_TARGET: 'on_target',
  BELOW_TARGET: 'below_target',
  CRITICAL: 'critical',
  NO_DATA: 'no_data',
} as const;

export type KPIPerformance = typeof KPI_PERFORMANCE[keyof typeof KPI_PERFORMANCE];

export const KPI_PERFORMANCE_LABELS: Record<KPIPerformance, string> = {
  [KPI_PERFORMANCE.EXCEEDING]: 'Exceeding Target',
  [KPI_PERFORMANCE.ON_TARGET]: 'On Target',
  [KPI_PERFORMANCE.BELOW_TARGET]: 'Below Target',
  [KPI_PERFORMANCE.CRITICAL]: 'Critical',
  [KPI_PERFORMANCE.NO_DATA]: 'No Data',
};

export const KPI_PERFORMANCE_COLORS: Record<KPIPerformance, string> = {
  [KPI_PERFORMANCE.EXCEEDING]: '#4CAF50',
  [KPI_PERFORMANCE.ON_TARGET]: '#8BC34A',
  [KPI_PERFORMANCE.BELOW_TARGET]: '#FF9800',
  [KPI_PERFORMANCE.CRITICAL]: '#F44336',
  [KPI_PERFORMANCE.NO_DATA]: '#9E9E9E',
};

// ----------------------------------------------------------------------------
// Data Source Types
// ----------------------------------------------------------------------------
export const KPI_DATA_SOURCE = {
  MANUAL: 'manual',
  CALCULATED: 'calculated',
  API_INTEGRATION: 'api_integration',
  DATABASE_QUERY: 'database_query',
  FILE_IMPORT: 'file_import',
  AGGREGATED: 'aggregated',
} as const;

export type KPIDataSource = typeof KPI_DATA_SOURCE[keyof typeof KPI_DATA_SOURCE];

export const KPI_DATA_SOURCE_LABELS: Record<KPIDataSource, string> = {
  [KPI_DATA_SOURCE.MANUAL]: 'Manual Entry',
  [KPI_DATA_SOURCE.CALCULATED]: 'Calculated Formula',
  [KPI_DATA_SOURCE.API_INTEGRATION]: 'API Integration',
  [KPI_DATA_SOURCE.DATABASE_QUERY]: 'Database Query',
  [KPI_DATA_SOURCE.FILE_IMPORT]: 'File Import',
  [KPI_DATA_SOURCE.AGGREGATED]: 'Aggregated from Sub-KPIs',
};

// ----------------------------------------------------------------------------
// Aggregation Methods
// ----------------------------------------------------------------------------
export const KPI_AGGREGATION_METHOD = {
  SUM: 'sum',
  AVERAGE: 'average',
  WEIGHTED_AVERAGE: 'weighted_average',
  MINIMUM: 'minimum',
  MAXIMUM: 'maximum',
  COUNT: 'count',
  MEDIAN: 'median',
  LATEST: 'latest',
} as const;

export type KPIAggregationMethod = typeof KPI_AGGREGATION_METHOD[keyof typeof KPI_AGGREGATION_METHOD];

export const KPI_AGGREGATION_METHOD_LABELS: Record<KPIAggregationMethod, string> = {
  [KPI_AGGREGATION_METHOD.SUM]: 'Sum',
  [KPI_AGGREGATION_METHOD.AVERAGE]: 'Average',
  [KPI_AGGREGATION_METHOD.WEIGHTED_AVERAGE]: 'Weighted Average',
  [KPI_AGGREGATION_METHOD.MINIMUM]: 'Minimum',
  [KPI_AGGREGATION_METHOD.MAXIMUM]: 'Maximum',
  [KPI_AGGREGATION_METHOD.COUNT]: 'Count',
  [KPI_AGGREGATION_METHOD.MEDIAN]: 'Median',
  [KPI_AGGREGATION_METHOD.LATEST]: 'Latest Value',
};

// ----------------------------------------------------------------------------
// Scorecard Types
// ----------------------------------------------------------------------------
export const KPI_SCORECARD_TYPE = {
  BALANCED: 'balanced',
  STRATEGIC: 'strategic',
  OPERATIONAL: 'operational',
  DEPARTMENTAL: 'departmental',
  PROJECT: 'project',
  CUSTOM: 'custom',
} as const;

export type KPIScorecardType = typeof KPI_SCORECARD_TYPE[keyof typeof KPI_SCORECARD_TYPE];

export const KPI_SCORECARD_TYPE_LABELS: Record<KPIScorecardType, string> = {
  [KPI_SCORECARD_TYPE.BALANCED]: 'Balanced Scorecard',
  [KPI_SCORECARD_TYPE.STRATEGIC]: 'Strategic Scorecard',
  [KPI_SCORECARD_TYPE.OPERATIONAL]: 'Operational Scorecard',
  [KPI_SCORECARD_TYPE.DEPARTMENTAL]: 'Departmental Scorecard',
  [KPI_SCORECARD_TYPE.PROJECT]: 'Project Scorecard',
  [KPI_SCORECARD_TYPE.CUSTOM]: 'Custom Scorecard',
};

// ----------------------------------------------------------------------------
// Threshold Types
// ----------------------------------------------------------------------------
export const KPI_THRESHOLD_TYPE = {
  ABSOLUTE: 'absolute',
  PERCENTAGE_OF_TARGET: 'percentage_of_target',
  STANDARD_DEVIATION: 'standard_deviation',
} as const;

export type KPIThresholdType = typeof KPI_THRESHOLD_TYPE[keyof typeof KPI_THRESHOLD_TYPE];

// ----------------------------------------------------------------------------
// Balanced Scorecard Perspectives
// ----------------------------------------------------------------------------
export const BSC_PERSPECTIVE = {
  FINANCIAL: 'financial',
  CUSTOMER: 'customer',
  INTERNAL_PROCESS: 'internal_process',
  LEARNING_GROWTH: 'learning_growth',
} as const;

export type BSCPerspective = typeof BSC_PERSPECTIVE[keyof typeof BSC_PERSPECTIVE];

export const BSC_PERSPECTIVE_LABELS: Record<BSCPerspective, string> = {
  [BSC_PERSPECTIVE.FINANCIAL]: 'Financial',
  [BSC_PERSPECTIVE.CUSTOMER]: 'Customer',
  [BSC_PERSPECTIVE.INTERNAL_PROCESS]: 'Internal Business Processes',
  [BSC_PERSPECTIVE.LEARNING_GROWTH]: 'Learning & Growth',
};

export const BSC_PERSPECTIVE_COLORS: Record<BSCPerspective, string> = {
  [BSC_PERSPECTIVE.FINANCIAL]: '#4CAF50',
  [BSC_PERSPECTIVE.CUSTOMER]: '#2196F3',
  [BSC_PERSPECTIVE.INTERNAL_PROCESS]: '#FF9800',
  [BSC_PERSPECTIVE.LEARNING_GROWTH]: '#9C27B0',
};

// ----------------------------------------------------------------------------
// Alert Types
// ----------------------------------------------------------------------------
export const KPI_ALERT_TYPE = {
  THRESHOLD_CROSSED: 'threshold_crossed',
  MISSING_DATA: 'missing_data',
  TREND_CHANGE: 'trend_change',
  TARGET_ACHIEVED: 'target_achieved',
} as const;

export type KPIAlertType = typeof KPI_ALERT_TYPE[keyof typeof KPI_ALERT_TYPE];

export const KPI_ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type KPIAlertSeverity = typeof KPI_ALERT_SEVERITY[keyof typeof KPI_ALERT_SEVERITY];

// ----------------------------------------------------------------------------
// Collections
// ----------------------------------------------------------------------------
export const KPI_COLLECTIONS = {
  DEFINITIONS: 'kpis',
  DATA_POINTS: 'kpiDataPoints',
  SCORECARDS: 'kpiScorecards',
  ALERTS: 'kpiAlerts',
  TRENDS: 'kpiTrends',
} as const;

// ----------------------------------------------------------------------------
// Defaults & Limits
// ----------------------------------------------------------------------------
export const KPI_DEFAULTS = {
  MAX_KPIS_PER_SCORECARD: 20,
  MAX_THRESHOLD_LEVELS: 4,
  MAX_TAGS: 10,
  DEFAULT_FREQUENCY: KPI_FREQUENCY.MONTHLY,
  DATA_RETENTION_DAYS: 1095, // 3 years
  TREND_PERIODS: 12,
  DECIMAL_PLACES: 2,
  STALE_DATA_DAYS: 14,
  MAX_SECTIONS_PER_SCORECARD: 10,
};

// ----------------------------------------------------------------------------
// Common KPI Templates (Uganda Business Context)
// ----------------------------------------------------------------------------
export const KPI_TEMPLATES = {
  FINANCIAL: [
    { code: 'REV', name: 'Revenue', category: KPI_CATEGORY.FINANCIAL, type: KPI_TYPE.CURRENCY, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: 'UGX', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'GPM', name: 'Gross Profit Margin', category: KPI_CATEGORY.FINANCIAL, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'NPM', name: 'Net Profit Margin', category: KPI_CATEGORY.FINANCIAL, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'OPEX', name: 'Operating Expenses', category: KPI_CATEGORY.FINANCIAL, type: KPI_TYPE.CURRENCY, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: 'UGX', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'DSO', name: 'Days Sales Outstanding', category: KPI_CATEGORY.FINANCIAL, type: KPI_TYPE.NUMERIC, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: 'days', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'ROI', name: 'Return on Investment', category: KPI_CATEGORY.FINANCIAL, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.QUARTERLY },
  ],
  CUSTOMER: [
    { code: 'CSAT', name: 'Customer Satisfaction Score', category: KPI_CATEGORY.CUSTOMER, type: KPI_TYPE.RATING, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '/5', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'NPS', name: 'Net Promoter Score', category: KPI_CATEGORY.CUSTOMER, type: KPI_TYPE.INDEX, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '', frequency: KPI_FREQUENCY.QUARTERLY },
    { code: 'CRR', name: 'Customer Retention Rate', category: KPI_CATEGORY.CUSTOMER, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'CHURN', name: 'Customer Churn Rate', category: KPI_CATEGORY.CUSTOMER, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'CAC', name: 'Customer Acquisition Cost', category: KPI_CATEGORY.CUSTOMER, type: KPI_TYPE.CURRENCY, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: 'UGX', frequency: KPI_FREQUENCY.MONTHLY },
  ],
  PEOPLE: [
    { code: 'TURN', name: 'Employee Turnover Rate', category: KPI_CATEGORY.PEOPLE, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'ESAT', name: 'Employee Satisfaction Score', category: KPI_CATEGORY.PEOPLE, type: KPI_TYPE.RATING, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '/5', frequency: KPI_FREQUENCY.QUARTERLY },
    { code: 'ABS', name: 'Absenteeism Rate', category: KPI_CATEGORY.PEOPLE, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'TTF', name: 'Time to Fill (Recruitment)', category: KPI_CATEGORY.PEOPLE, type: KPI_TYPE.NUMERIC, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: 'days', frequency: KPI_FREQUENCY.MONTHLY },
    { code: 'TRAIN', name: 'Training Hours per Employee', category: KPI_CATEGORY.PEOPLE, type: KPI_TYPE.NUMERIC, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: 'hours', frequency: KPI_FREQUENCY.QUARTERLY },
  ],
  OPERATIONAL: [
    { code: 'OEE', name: 'Overall Equipment Effectiveness', category: KPI_CATEGORY.OPERATIONAL, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.HIGHER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.WEEKLY },
    { code: 'LEAD', name: 'Lead Time', category: KPI_CATEGORY.OPERATIONAL, type: KPI_TYPE.NUMERIC, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: 'days', frequency: KPI_FREQUENCY.WEEKLY },
    { code: 'DEFECT', name: 'Defect Rate', category: KPI_CATEGORY.QUALITY, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.LOWER_IS_BETTER, unit: '%', frequency: KPI_FREQUENCY.WEEKLY },
    { code: 'UTIL', name: 'Capacity Utilization', category: KPI_CATEGORY.OPERATIONAL, type: KPI_TYPE.PERCENTAGE, direction: KPI_DIRECTION.TARGET_IS_BEST, unit: '%', frequency: KPI_FREQUENCY.WEEKLY },
  ],
} as const;

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------
export function getPerformanceColor(performance: KPIPerformance): string {
  return KPI_PERFORMANCE_COLORS[performance] || KPI_PERFORMANCE_COLORS.no_data;
}

export function getCategoryColor(category: KPICategory): string {
  return KPI_CATEGORY_COLORS[category] || '#9E9E9E';
}

export function formatKPIValue(
  value: number,
  type: KPIType,
  unit: string,
  decimalPlaces: number = 2
): string {
  if (value === undefined || value === null) return '-';

  switch (type) {
    case KPI_TYPE.CURRENCY:
      return new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: 'UGX',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    case KPI_TYPE.PERCENTAGE:
      return `${value.toFixed(decimalPlaces)}%`;
    case KPI_TYPE.RATING:
      return `${value.toFixed(1)}${unit}`;
    case KPI_TYPE.BINARY:
      return value >= 1 ? 'Yes' : 'No';
    default:
      return `${value.toLocaleString('en-UG', { maximumFractionDigits: decimalPlaces })} ${unit}`.trim();
  }
}
