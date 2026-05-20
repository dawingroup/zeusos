// ============================================================================
// ENVIRONMENT SCANNING CONSTANTS
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

// ----------------------------------------------------------------------------
// PESTEL DIMENSIONS
// ----------------------------------------------------------------------------

export const PESTEL_DIMENSIONS = {
  POLITICAL: 'political',
  ECONOMIC: 'economic',
  SOCIAL: 'social',
  TECHNOLOGICAL: 'technological',
  ENVIRONMENTAL: 'environmental',
  LEGAL: 'legal',
} as const;

export type PESTELDimension = typeof PESTEL_DIMENSIONS[keyof typeof PESTEL_DIMENSIONS];

export const PESTEL_DIMENSION_CONFIG: Record<PESTELDimension, {
  label: string;
  description: string;
  color: string;
  icon: string;
  subFactors: string[];
}> = {
  [PESTEL_DIMENSIONS.POLITICAL]: {
    label: 'Political',
    description: 'Government policies, political stability, trade regulations',
    color: '#E53935',
    icon: 'AccountBalance',
    subFactors: [
      'Government Stability',
      'Trade Policy',
      'Tax Policy',
      'Political Leadership',
      'Regional Integration',
      'Foreign Relations',
      'Public Sector Investment',
      'Election Cycles',
      'Corruption Index',
      'Policy Consistency',
    ],
  },
  [PESTEL_DIMENSIONS.ECONOMIC]: {
    label: 'Economic',
    description: 'Economic growth, exchange rates, inflation, interest rates',
    color: '#1E88E5',
    icon: 'TrendingUp',
    subFactors: [
      'GDP Growth',
      'Inflation Rate',
      'Exchange Rates',
      'Interest Rates',
      'Unemployment',
      'Consumer Spending',
      'Foreign Investment',
      'Commodity Prices',
      'Banking Sector Health',
      'Infrastructure Investment',
    ],
  },
  [PESTEL_DIMENSIONS.SOCIAL]: {
    label: 'Social',
    description: 'Demographics, cultural trends, education, health',
    color: '#43A047',
    icon: 'People',
    subFactors: [
      'Population Growth',
      'Age Distribution',
      'Urbanization',
      'Education Levels',
      'Health Indicators',
      'Cultural Values',
      'Consumer Attitudes',
      'Workforce Skills',
      'Income Distribution',
      'Migration Patterns',
    ],
  },
  [PESTEL_DIMENSIONS.TECHNOLOGICAL]: {
    label: 'Technological',
    description: 'Technology adoption, innovation, R&D, digital infrastructure',
    color: '#FB8C00',
    icon: 'Computer',
    subFactors: [
      'Internet Penetration',
      'Mobile Adoption',
      'Digital Payments',
      'Technology Infrastructure',
      'Innovation Ecosystem',
      'R&D Investment',
      'Tech Talent Pool',
      'Automation Trends',
      'Cybersecurity',
      'Emerging Technologies',
    ],
  },
  [PESTEL_DIMENSIONS.ENVIRONMENTAL]: {
    label: 'Environmental',
    description: 'Climate change, sustainability, natural resources',
    color: '#00897B',
    icon: 'Nature',
    subFactors: [
      'Climate Change Impact',
      'Natural Resources',
      'Water Availability',
      'Energy Sources',
      'Sustainability Regulations',
      'Carbon Footprint',
      'Waste Management',
      'Biodiversity',
      'Environmental Compliance',
      'Green Technology',
    ],
  },
  [PESTEL_DIMENSIONS.LEGAL]: {
    label: 'Legal',
    description: 'Regulatory framework, compliance requirements, legal system',
    color: '#8E24AA',
    icon: 'Gavel',
    subFactors: [
      'Business Regulations',
      'Employment Law',
      'Competition Law',
      'Consumer Protection',
      'Data Protection',
      'Intellectual Property',
      'Contract Enforcement',
      'Dispute Resolution',
      'Licensing Requirements',
      'Sector-Specific Regulations',
    ],
  },
};

// ----------------------------------------------------------------------------
// FACTOR IMPACT LEVELS
// ----------------------------------------------------------------------------

export const IMPACT_LEVELS = {
  VERY_HIGH: 'very_high',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  VERY_LOW: 'very_low',
} as const;

export type ImpactLevel = typeof IMPACT_LEVELS[keyof typeof IMPACT_LEVELS];

export const IMPACT_LEVEL_CONFIG: Record<ImpactLevel, {
  label: string;
  score: number;
  color: string;
}> = {
  [IMPACT_LEVELS.VERY_HIGH]: { label: 'Very High', score: 5, color: '#D32F2F' },
  [IMPACT_LEVELS.HIGH]: { label: 'High', score: 4, color: '#F57C00' },
  [IMPACT_LEVELS.MEDIUM]: { label: 'Medium', score: 3, color: '#FBC02D' },
  [IMPACT_LEVELS.LOW]: { label: 'Low', score: 2, color: '#7CB342' },
  [IMPACT_LEVELS.VERY_LOW]: { label: 'Very Low', score: 1, color: '#43A047' },
};

// ----------------------------------------------------------------------------
// PROBABILITY LEVELS
// ----------------------------------------------------------------------------

export const PROBABILITY_LEVELS = {
  VERY_LIKELY: 'very_likely',
  LIKELY: 'likely',
  POSSIBLE: 'possible',
  UNLIKELY: 'unlikely',
  RARE: 'rare',
} as const;

export type ProbabilityLevel = typeof PROBABILITY_LEVELS[keyof typeof PROBABILITY_LEVELS];

export const PROBABILITY_LEVEL_CONFIG: Record<ProbabilityLevel, {
  label: string;
  percentage: string;
  score: number;
}> = {
  [PROBABILITY_LEVELS.VERY_LIKELY]: { label: 'Very Likely', percentage: '80-100%', score: 5 },
  [PROBABILITY_LEVELS.LIKELY]: { label: 'Likely', percentage: '60-80%', score: 4 },
  [PROBABILITY_LEVELS.POSSIBLE]: { label: 'Possible', percentage: '40-60%', score: 3 },
  [PROBABILITY_LEVELS.UNLIKELY]: { label: 'Unlikely', percentage: '20-40%', score: 2 },
  [PROBABILITY_LEVELS.RARE]: { label: 'Rare', percentage: '0-20%', score: 1 },
};

// ----------------------------------------------------------------------------
// SIGNAL TYPES
// ----------------------------------------------------------------------------

export const SIGNAL_TYPES = {
  WEAK: 'weak',
  MODERATE: 'moderate',
  STRONG: 'strong',
} as const;

export type SignalType = typeof SIGNAL_TYPES[keyof typeof SIGNAL_TYPES];

export const SIGNAL_TYPE_CONFIG: Record<SignalType, {
  label: string;
  description: string;
  color: string;
  urgency: string;
}> = {
  [SIGNAL_TYPES.WEAK]: {
    label: 'Weak Signal',
    description: 'Early indicator, requires monitoring',
    color: '#90CAF9',
    urgency: 'Monitor',
  },
  [SIGNAL_TYPES.MODERATE]: {
    label: 'Moderate Signal',
    description: 'Developing trend, requires analysis',
    color: '#FFA726',
    urgency: 'Analyze',
  },
  [SIGNAL_TYPES.STRONG]: {
    label: 'Strong Signal',
    description: 'Clear trend, requires action',
    color: '#EF5350',
    urgency: 'Act',
  },
};

// ----------------------------------------------------------------------------
// SIGNAL SOURCES
// ----------------------------------------------------------------------------

export const SIGNAL_SOURCES = {
  NEWS: 'news',
  GOVERNMENT: 'government',
  INDUSTRY: 'industry',
  RESEARCH: 'research',
  SOCIAL: 'social',
  COMPETITOR: 'competitor',
  CUSTOMER: 'customer',
  INTERNAL: 'internal',
  EXPERT: 'expert',
  DATA: 'data',
} as const;

export type SignalSource = typeof SIGNAL_SOURCES[keyof typeof SIGNAL_SOURCES];

export const SIGNAL_SOURCE_CONFIG: Record<SignalSource, {
  label: string;
  icon: string;
  reliability: 'high' | 'medium' | 'low';
}> = {
  [SIGNAL_SOURCES.NEWS]: { label: 'News Media', icon: 'Newspaper', reliability: 'medium' },
  [SIGNAL_SOURCES.GOVERNMENT]: { label: 'Government', icon: 'AccountBalance', reliability: 'high' },
  [SIGNAL_SOURCES.INDUSTRY]: { label: 'Industry Reports', icon: 'Business', reliability: 'high' },
  [SIGNAL_SOURCES.RESEARCH]: { label: 'Research Papers', icon: 'Science', reliability: 'high' },
  [SIGNAL_SOURCES.SOCIAL]: { label: 'Social Media', icon: 'Share', reliability: 'low' },
  [SIGNAL_SOURCES.COMPETITOR]: { label: 'Competitor Activity', icon: 'Visibility', reliability: 'medium' },
  [SIGNAL_SOURCES.CUSTOMER]: { label: 'Customer Feedback', icon: 'Forum', reliability: 'medium' },
  [SIGNAL_SOURCES.INTERNAL]: { label: 'Internal Analysis', icon: 'Analytics', reliability: 'medium' },
  [SIGNAL_SOURCES.EXPERT]: { label: 'Expert Opinion', icon: 'Person', reliability: 'medium' },
  [SIGNAL_SOURCES.DATA]: { label: 'Data Analysis', icon: 'Assessment', reliability: 'high' },
};

// ----------------------------------------------------------------------------
// SIGNAL STATUS
// ----------------------------------------------------------------------------

export const SIGNAL_STATUSES = {
  NEW: 'new',
  MONITORING: 'monitoring',
  ANALYZING: 'analyzing',
  VALIDATED: 'validated',
  INVALIDATED: 'invalidated',
  ACTED_UPON: 'acted_upon',
  ARCHIVED: 'archived',
} as const;

export type SignalStatus = typeof SIGNAL_STATUSES[keyof typeof SIGNAL_STATUSES];

export const SIGNAL_STATUS_CONFIG: Record<SignalStatus, {
  label: string;
  color: string;
  allowedTransitions: SignalStatus[];
}> = {
  [SIGNAL_STATUSES.NEW]: {
    label: 'New',
    color: '#42A5F5',
    allowedTransitions: ['monitoring', 'analyzing', 'invalidated'],
  },
  [SIGNAL_STATUSES.MONITORING]: {
    label: 'Monitoring',
    color: '#66BB6A',
    allowedTransitions: ['analyzing', 'validated', 'invalidated'],
  },
  [SIGNAL_STATUSES.ANALYZING]: {
    label: 'Analyzing',
    color: '#FFA726',
    allowedTransitions: ['validated', 'invalidated', 'monitoring'],
  },
  [SIGNAL_STATUSES.VALIDATED]: {
    label: 'Validated',
    color: '#26A69A',
    allowedTransitions: ['acted_upon', 'archived'],
  },
  [SIGNAL_STATUSES.INVALIDATED]: {
    label: 'Invalidated',
    color: '#BDBDBD',
    allowedTransitions: ['archived'],
  },
  [SIGNAL_STATUSES.ACTED_UPON]: {
    label: 'Acted Upon',
    color: '#7E57C2',
    allowedTransitions: ['archived'],
  },
  [SIGNAL_STATUSES.ARCHIVED]: {
    label: 'Archived',
    color: '#78909C',
    allowedTransitions: [],
  },
};

// ----------------------------------------------------------------------------
// REGULATORY CATEGORIES
// ----------------------------------------------------------------------------

export const REGULATORY_CATEGORIES = {
  TAX: 'tax',
  LABOR: 'labor',
  ENVIRONMENTAL: 'environmental',
  FINANCIAL: 'financial',
  CORPORATE: 'corporate',
  SECTOR_SPECIFIC: 'sector_specific',
  TRADE: 'trade',
  DATA_PRIVACY: 'data_privacy',
  HEALTH_SAFETY: 'health_safety',
  COMPETITION: 'competition',
} as const;

export type RegulatoryCategory = typeof REGULATORY_CATEGORIES[keyof typeof REGULATORY_CATEGORIES];

export const REGULATORY_CATEGORY_CONFIG: Record<RegulatoryCategory, {
  label: string;
  description: string;
  color: string;
  ugandaAuthorities: string[];
}> = {
  [REGULATORY_CATEGORIES.TAX]: {
    label: 'Tax & Revenue',
    description: 'Tax laws, revenue regulations, customs',
    color: '#E53935',
    ugandaAuthorities: ['Uganda Revenue Authority (URA)', 'Ministry of Finance'],
  },
  [REGULATORY_CATEGORIES.LABOR]: {
    label: 'Labor & Employment',
    description: 'Employment laws, labor relations, benefits',
    color: '#1E88E5',
    ugandaAuthorities: ['Ministry of Gender, Labour & Social Development', 'NSSF'],
  },
  [REGULATORY_CATEGORIES.ENVIRONMENTAL]: {
    label: 'Environmental',
    description: 'Environmental protection, sustainability',
    color: '#43A047',
    ugandaAuthorities: ['NEMA', 'Ministry of Water and Environment'],
  },
  [REGULATORY_CATEGORIES.FINANCIAL]: {
    label: 'Financial Services',
    description: 'Banking, capital markets, insurance',
    color: '#FB8C00',
    ugandaAuthorities: ['Bank of Uganda', 'Capital Markets Authority', 'Insurance Regulatory Authority'],
  },
  [REGULATORY_CATEGORIES.CORPORATE]: {
    label: 'Corporate Governance',
    description: 'Company registration, governance, reporting',
    color: '#8E24AA',
    ugandaAuthorities: ['URSB', 'FIA'],
  },
  [REGULATORY_CATEGORIES.SECTOR_SPECIFIC]: {
    label: 'Sector-Specific',
    description: 'Industry-specific regulations',
    color: '#00897B',
    ugandaAuthorities: ['Various sector regulators'],
  },
  [REGULATORY_CATEGORIES.TRADE]: {
    label: 'Trade & Commerce',
    description: 'Import/export, trade agreements, competition',
    color: '#5C6BC0',
    ugandaAuthorities: ['MTIC', 'Uganda Export Promotions Board'],
  },
  [REGULATORY_CATEGORIES.DATA_PRIVACY]: {
    label: 'Data Privacy',
    description: 'Data protection, privacy regulations',
    color: '#26A69A',
    ugandaAuthorities: ['NITA-U', 'Personal Data Protection Office'],
  },
  [REGULATORY_CATEGORIES.HEALTH_SAFETY]: {
    label: 'Health & Safety',
    description: 'Occupational health, safety standards',
    color: '#EF5350',
    ugandaAuthorities: ['Ministry of Health', 'DGSM'],
  },
  [REGULATORY_CATEGORIES.COMPETITION]: {
    label: 'Competition',
    description: 'Anti-trust, fair competition',
    color: '#AB47BC',
    ugandaAuthorities: ['Competition Bureau (proposed)'],
  },
};

// ----------------------------------------------------------------------------
// REGULATORY STATUS
// ----------------------------------------------------------------------------

export const REGULATORY_STATUSES = {
  PROPOSED: 'proposed',
  CONSULTATION: 'consultation',
  PENDING: 'pending',
  ENACTED: 'enacted',
  IN_FORCE: 'in_force',
  AMENDED: 'amended',
  REPEALED: 'repealed',
} as const;

export type RegulatoryStatus = typeof REGULATORY_STATUSES[keyof typeof REGULATORY_STATUSES];

export const REGULATORY_STATUS_CONFIG: Record<RegulatoryStatus, {
  label: string;
  description: string;
  color: string;
  requiresAction: boolean;
}> = {
  [REGULATORY_STATUSES.PROPOSED]: {
    label: 'Proposed',
    description: 'Initial proposal stage',
    color: '#90CAF9',
    requiresAction: false,
  },
  [REGULATORY_STATUSES.CONSULTATION]: {
    label: 'Public Consultation',
    description: 'Open for stakeholder input',
    color: '#FFA726',
    requiresAction: true,
  },
  [REGULATORY_STATUSES.PENDING]: {
    label: 'Pending Enactment',
    description: 'Approved, awaiting implementation',
    color: '#FFEE58',
    requiresAction: true,
  },
  [REGULATORY_STATUSES.ENACTED]: {
    label: 'Enacted',
    description: 'Passed, implementation date set',
    color: '#66BB6A',
    requiresAction: true,
  },
  [REGULATORY_STATUSES.IN_FORCE]: {
    label: 'In Force',
    description: 'Currently effective',
    color: '#26A69A',
    requiresAction: true,
  },
  [REGULATORY_STATUSES.AMENDED]: {
    label: 'Amended',
    description: 'Modified version in effect',
    color: '#7E57C2',
    requiresAction: true,
  },
  [REGULATORY_STATUSES.REPEALED]: {
    label: 'Repealed',
    description: 'No longer in effect',
    color: '#BDBDBD',
    requiresAction: false,
  },
};

// ----------------------------------------------------------------------------
// COMPLIANCE STATUS
// ----------------------------------------------------------------------------

export const COMPLIANCE_STATUSES = {
  COMPLIANT: 'compliant',
  PARTIALLY_COMPLIANT: 'partially_compliant',
  NON_COMPLIANT: 'non_compliant',
  NOT_APPLICABLE: 'not_applicable',
  UNDER_REVIEW: 'under_review',
} as const;

export type ComplianceStatus = typeof COMPLIANCE_STATUSES[keyof typeof COMPLIANCE_STATUSES];

export const COMPLIANCE_STATUS_CONFIG: Record<ComplianceStatus, {
  label: string;
  color: string;
  icon: string;
}> = {
  [COMPLIANCE_STATUSES.COMPLIANT]: {
    label: 'Compliant',
    color: '#43A047',
    icon: 'CheckCircle',
  },
  [COMPLIANCE_STATUSES.PARTIALLY_COMPLIANT]: {
    label: 'Partially Compliant',
    color: '#FFA726',
    icon: 'Warning',
  },
  [COMPLIANCE_STATUSES.NON_COMPLIANT]: {
    label: 'Non-Compliant',
    color: '#E53935',
    icon: 'Cancel',
  },
  [COMPLIANCE_STATUSES.NOT_APPLICABLE]: {
    label: 'Not Applicable',
    color: '#BDBDBD',
    icon: 'RemoveCircle',
  },
  [COMPLIANCE_STATUSES.UNDER_REVIEW]: {
    label: 'Under Review',
    color: '#42A5F5',
    icon: 'HourglassEmpty',
  },
};

// ----------------------------------------------------------------------------
// SCENARIO TYPES
// ----------------------------------------------------------------------------

export const SCENARIO_TYPES = {
  BASELINE: 'baseline',
  OPTIMISTIC: 'optimistic',
  PESSIMISTIC: 'pessimistic',
  DISRUPTIVE: 'disruptive',
  BLACK_SWAN: 'black_swan',
  CUSTOM: 'custom',
} as const;

export type ScenarioType = typeof SCENARIO_TYPES[keyof typeof SCENARIO_TYPES];

export const SCENARIO_TYPE_CONFIG: Record<ScenarioType, {
  label: string;
  description: string;
  color: string;
  defaultProbability: number;
}> = {
  [SCENARIO_TYPES.BASELINE]: {
    label: 'Baseline',
    description: 'Most likely scenario based on current trends',
    color: '#42A5F5',
    defaultProbability: 50,
  },
  [SCENARIO_TYPES.OPTIMISTIC]: {
    label: 'Optimistic',
    description: 'Best-case scenario with favorable conditions',
    color: '#66BB6A',
    defaultProbability: 25,
  },
  [SCENARIO_TYPES.PESSIMISTIC]: {
    label: 'Pessimistic',
    description: 'Worst-case scenario with adverse conditions',
    color: '#EF5350',
    defaultProbability: 20,
  },
  [SCENARIO_TYPES.DISRUPTIVE]: {
    label: 'Disruptive',
    description: 'Scenario with major market disruption',
    color: '#AB47BC',
    defaultProbability: 10,
  },
  [SCENARIO_TYPES.BLACK_SWAN]: {
    label: 'Black Swan',
    description: 'Rare, high-impact event scenario',
    color: '#424242',
    defaultProbability: 5,
  },
  [SCENARIO_TYPES.CUSTOM]: {
    label: 'Custom',
    description: 'User-defined scenario',
    color: '#78909C',
    defaultProbability: 0,
  },
};

// ----------------------------------------------------------------------------
// TIME HORIZONS
// ----------------------------------------------------------------------------

export const TIME_HORIZONS = {
  SHORT_TERM: 'short_term',
  MEDIUM_TERM: 'medium_term',
  LONG_TERM: 'long_term',
} as const;

export type TimeHorizon = typeof TIME_HORIZONS[keyof typeof TIME_HORIZONS];

export const TIME_HORIZON_CONFIG: Record<TimeHorizon, {
  label: string;
  months: { min: number; max: number };
  color: string;
}> = {
  [TIME_HORIZONS.SHORT_TERM]: {
    label: 'Short Term',
    months: { min: 0, max: 12 },
    color: '#FFA726',
  },
  [TIME_HORIZONS.MEDIUM_TERM]: {
    label: 'Medium Term',
    months: { min: 12, max: 36 },
    color: '#42A5F5',
  },
  [TIME_HORIZONS.LONG_TERM]: {
    label: 'Long Term',
    months: { min: 36, max: 120 },
    color: '#7E57C2',
  },
};

// ----------------------------------------------------------------------------
// ALERT PRIORITIES
// ----------------------------------------------------------------------------

export const ALERT_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
} as const;

export type AlertPriority = typeof ALERT_PRIORITIES[keyof typeof ALERT_PRIORITIES];

export const ALERT_PRIORITY_CONFIG: Record<AlertPriority, {
  label: string;
  color: string;
  icon: string;
  notificationLevel: string;
}> = {
  [ALERT_PRIORITIES.CRITICAL]: {
    label: 'Critical',
    color: '#D32F2F',
    icon: 'Error',
    notificationLevel: 'Immediate + SMS',
  },
  [ALERT_PRIORITIES.HIGH]: {
    label: 'High',
    color: '#F57C00',
    icon: 'Warning',
    notificationLevel: 'Immediate',
  },
  [ALERT_PRIORITIES.MEDIUM]: {
    label: 'Medium',
    color: '#FBC02D',
    icon: 'Info',
    notificationLevel: 'Daily Digest',
  },
  [ALERT_PRIORITIES.LOW]: {
    label: 'Low',
    color: '#7CB342',
    icon: 'Notifications',
    notificationLevel: 'Weekly Summary',
  },
  [ALERT_PRIORITIES.INFO]: {
    label: 'Informational',
    color: '#42A5F5',
    icon: 'NotificationsNone',
    notificationLevel: 'On-Demand',
  },
};

// ----------------------------------------------------------------------------
// TRIGGER CONDITIONS
// ----------------------------------------------------------------------------

export const TRIGGER_CONDITIONS = {
  THRESHOLD_EXCEEDED: 'threshold_exceeded',
  THRESHOLD_BELOW: 'threshold_below',
  CHANGE_DETECTED: 'change_detected',
  PATTERN_MATCH: 'pattern_match',
  TIME_BASED: 'time_based',
  COMBINATION: 'combination',
} as const;

export type TriggerCondition = typeof TRIGGER_CONDITIONS[keyof typeof TRIGGER_CONDITIONS];

export const TRIGGER_CONDITION_CONFIG: Record<TriggerCondition, {
  label: string;
  description: string;
  requiresThreshold: boolean;
}> = {
  [TRIGGER_CONDITIONS.THRESHOLD_EXCEEDED]: {
    label: 'Threshold Exceeded',
    description: 'Alert when value exceeds threshold',
    requiresThreshold: true,
  },
  [TRIGGER_CONDITIONS.THRESHOLD_BELOW]: {
    label: 'Threshold Below',
    description: 'Alert when value falls below threshold',
    requiresThreshold: true,
  },
  [TRIGGER_CONDITIONS.CHANGE_DETECTED]: {
    label: 'Change Detected',
    description: 'Alert on significant change',
    requiresThreshold: false,
  },
  [TRIGGER_CONDITIONS.PATTERN_MATCH]: {
    label: 'Pattern Match',
    description: 'Alert when pattern is detected',
    requiresThreshold: false,
  },
  [TRIGGER_CONDITIONS.TIME_BASED]: {
    label: 'Time-Based',
    description: 'Alert based on schedule or deadline',
    requiresThreshold: false,
  },
  [TRIGGER_CONDITIONS.COMBINATION]: {
    label: 'Combination',
    description: 'Alert when multiple conditions met',
    requiresThreshold: false,
  },
};

// ----------------------------------------------------------------------------
// UGANDA ECONOMIC INDICATORS
// ----------------------------------------------------------------------------

export const UGANDA_ECONOMIC_INDICATORS = {
  GDP_GROWTH: 'gdp_growth',
  INFLATION: 'inflation',
  EXCHANGE_RATE: 'exchange_rate',
  INTEREST_RATE: 'interest_rate',
  UNEMPLOYMENT: 'unemployment',
  TRADE_BALANCE: 'trade_balance',
  FDI_INFLOWS: 'fdi_inflows',
  REMITTANCES: 'remittances',
  COFFEE_PRICES: 'coffee_prices',
  OIL_PRODUCTION: 'oil_production',
} as const;

export type UgandaEconomicIndicator = typeof UGANDA_ECONOMIC_INDICATORS[keyof typeof UGANDA_ECONOMIC_INDICATORS];

export const UGANDA_ECONOMIC_INDICATOR_CONFIG: Record<UgandaEconomicIndicator, {
  label: string;
  unit: string;
  source: string;
  frequency: string;
  baselineValue: number;
}> = {
  [UGANDA_ECONOMIC_INDICATORS.GDP_GROWTH]: {
    label: 'GDP Growth Rate',
    unit: '%',
    source: 'UBOS',
    frequency: 'Quarterly',
    baselineValue: 5.5,
  },
  [UGANDA_ECONOMIC_INDICATORS.INFLATION]: {
    label: 'Inflation Rate',
    unit: '%',
    source: 'UBOS/BoU',
    frequency: 'Monthly',
    baselineValue: 3.5,
  },
  [UGANDA_ECONOMIC_INDICATORS.EXCHANGE_RATE]: {
    label: 'USD/UGX Exchange Rate',
    unit: 'UGX',
    source: 'BoU',
    frequency: 'Daily',
    baselineValue: 3750,
  },
  [UGANDA_ECONOMIC_INDICATORS.INTEREST_RATE]: {
    label: 'Central Bank Rate',
    unit: '%',
    source: 'BoU',
    frequency: 'Monthly',
    baselineValue: 9.5,
  },
  [UGANDA_ECONOMIC_INDICATORS.UNEMPLOYMENT]: {
    label: 'Unemployment Rate',
    unit: '%',
    source: 'UBOS',
    frequency: 'Annual',
    baselineValue: 9.0,
  },
  [UGANDA_ECONOMIC_INDICATORS.TRADE_BALANCE]: {
    label: 'Trade Balance',
    unit: 'USD Millions',
    source: 'BoU',
    frequency: 'Monthly',
    baselineValue: -350,
  },
  [UGANDA_ECONOMIC_INDICATORS.FDI_INFLOWS]: {
    label: 'FDI Inflows',
    unit: 'USD Millions',
    source: 'UNCTAD/UIA',
    frequency: 'Annual',
    baselineValue: 1200,
  },
  [UGANDA_ECONOMIC_INDICATORS.REMITTANCES]: {
    label: 'Remittance Inflows',
    unit: 'USD Millions',
    source: 'BoU',
    frequency: 'Quarterly',
    baselineValue: 1500,
  },
  [UGANDA_ECONOMIC_INDICATORS.COFFEE_PRICES]: {
    label: 'Coffee Export Price',
    unit: 'USD/kg',
    source: 'UCDA',
    frequency: 'Weekly',
    baselineValue: 4.5,
  },
  [UGANDA_ECONOMIC_INDICATORS.OIL_PRODUCTION]: {
    label: 'Oil Production',
    unit: 'Barrels/Day',
    source: 'PAU',
    frequency: 'Monthly',
    baselineValue: 0,
  },
};

// ----------------------------------------------------------------------------
// AFFECTED BUSINESS AREAS
// ----------------------------------------------------------------------------

export const AFFECTED_BUSINESS_AREAS = {
  OPERATIONS: 'operations',
  FINANCE: 'finance',
  HR: 'hr',
  SALES: 'sales',
  MARKETING: 'marketing',
  LEGAL: 'legal',
  IT: 'it',
  SUPPLY_CHAIN: 'supply_chain',
  STRATEGY: 'strategy',
  ALL: 'all',
} as const;

export type AffectedBusinessArea = typeof AFFECTED_BUSINESS_AREAS[keyof typeof AFFECTED_BUSINESS_AREAS];

export const AFFECTED_BUSINESS_AREA_LABELS: Record<AffectedBusinessArea, string> = {
  [AFFECTED_BUSINESS_AREAS.OPERATIONS]: 'Operations',
  [AFFECTED_BUSINESS_AREAS.FINANCE]: 'Finance',
  [AFFECTED_BUSINESS_AREAS.HR]: 'Human Resources',
  [AFFECTED_BUSINESS_AREAS.SALES]: 'Sales',
  [AFFECTED_BUSINESS_AREAS.MARKETING]: 'Marketing',
  [AFFECTED_BUSINESS_AREAS.LEGAL]: 'Legal & Compliance',
  [AFFECTED_BUSINESS_AREAS.IT]: 'Information Technology',
  [AFFECTED_BUSINESS_AREAS.SUPPLY_CHAIN]: 'Supply Chain',
  [AFFECTED_BUSINESS_AREAS.STRATEGY]: 'Strategy',
  [AFFECTED_BUSINESS_AREAS.ALL]: 'All Areas',
};

// ----------------------------------------------------------------------------
// FIRESTORE COLLECTIONS
// ----------------------------------------------------------------------------

export const SCANNING_COLLECTIONS = {
  PESTEL_ANALYSES: 'pestel_analyses',
  SIGNALS: 'environment_signals',
  REGULATIONS: 'regulatory_items',
  SCENARIOS: 'scenarios',
  ALERTS: 'early_warning_alerts',
  TRIGGERS: 'alert_triggers',
  INDICATORS: 'tracked_indicators',
} as const;
