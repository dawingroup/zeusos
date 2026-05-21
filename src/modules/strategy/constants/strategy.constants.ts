// ============================================================================
// STRATEGY CONSTANTS - ZeusOS CEO Strategy Command
// Constants for strategy document management
// ============================================================================

// ----------------------------------------------------------------------------
// Strategy Document Types
// ----------------------------------------------------------------------------
export const STRATEGY_DOCUMENT_TYPE = {
  VISION: 'vision',
  MISSION: 'mission',
  STRATEGIC_PLAN: 'strategic_plan',
  BUSINESS_PLAN: 'business_plan',
  ANNUAL_PLAN: 'annual_plan',
  QUARTERLY_PLAN: 'quarterly_plan',
  INITIATIVE: 'initiative',
  POLICY: 'policy',
} as const;

export type StrategyDocumentType = typeof STRATEGY_DOCUMENT_TYPE[keyof typeof STRATEGY_DOCUMENT_TYPE];

export const STRATEGY_DOCUMENT_TYPE_LABELS: Record<StrategyDocumentType, string> = {
  [STRATEGY_DOCUMENT_TYPE.VISION]: 'Vision Statement',
  [STRATEGY_DOCUMENT_TYPE.MISSION]: 'Mission Statement',
  [STRATEGY_DOCUMENT_TYPE.STRATEGIC_PLAN]: 'Strategic Plan',
  [STRATEGY_DOCUMENT_TYPE.BUSINESS_PLAN]: 'Business Plan',
  [STRATEGY_DOCUMENT_TYPE.ANNUAL_PLAN]: 'Annual Plan',
  [STRATEGY_DOCUMENT_TYPE.QUARTERLY_PLAN]: 'Quarterly Plan',
  [STRATEGY_DOCUMENT_TYPE.INITIATIVE]: 'Strategic Initiative',
  [STRATEGY_DOCUMENT_TYPE.POLICY]: 'Policy Document',
};

export const STRATEGY_DOCUMENT_TYPE_ICONS: Record<StrategyDocumentType, string> = {
  [STRATEGY_DOCUMENT_TYPE.VISION]: 'visibility',
  [STRATEGY_DOCUMENT_TYPE.MISSION]: 'flag',
  [STRATEGY_DOCUMENT_TYPE.STRATEGIC_PLAN]: 'map',
  [STRATEGY_DOCUMENT_TYPE.BUSINESS_PLAN]: 'business',
  [STRATEGY_DOCUMENT_TYPE.ANNUAL_PLAN]: 'calendar_today',
  [STRATEGY_DOCUMENT_TYPE.QUARTERLY_PLAN]: 'date_range',
  [STRATEGY_DOCUMENT_TYPE.INITIATIVE]: 'rocket_launch',
  [STRATEGY_DOCUMENT_TYPE.POLICY]: 'policy',
};

// ----------------------------------------------------------------------------
// Strategy Document Status
// ----------------------------------------------------------------------------
export const STRATEGY_DOCUMENT_STATUS = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  ARCHIVED: 'archived',
} as const;

export type StrategyDocumentStatus = typeof STRATEGY_DOCUMENT_STATUS[keyof typeof STRATEGY_DOCUMENT_STATUS];

export const STRATEGY_DOCUMENT_STATUS_LABELS: Record<StrategyDocumentStatus, string> = {
  [STRATEGY_DOCUMENT_STATUS.DRAFT]: 'Draft',
  [STRATEGY_DOCUMENT_STATUS.IN_REVIEW]: 'In Review',
  [STRATEGY_DOCUMENT_STATUS.APPROVED]: 'Approved',
  [STRATEGY_DOCUMENT_STATUS.ACTIVE]: 'Active',
  [STRATEGY_DOCUMENT_STATUS.SUPERSEDED]: 'Superseded',
  [STRATEGY_DOCUMENT_STATUS.ARCHIVED]: 'Archived',
};

export const STRATEGY_DOCUMENT_STATUS_COLORS: Record<StrategyDocumentStatus, string> = {
  [STRATEGY_DOCUMENT_STATUS.DRAFT]: 'default',
  [STRATEGY_DOCUMENT_STATUS.IN_REVIEW]: 'warning',
  [STRATEGY_DOCUMENT_STATUS.APPROVED]: 'info',
  [STRATEGY_DOCUMENT_STATUS.ACTIVE]: 'success',
  [STRATEGY_DOCUMENT_STATUS.SUPERSEDED]: 'secondary',
  [STRATEGY_DOCUMENT_STATUS.ARCHIVED]: 'default',
};

// ----------------------------------------------------------------------------
// Strategy Scope
// ----------------------------------------------------------------------------
export const STRATEGY_SCOPE = {
  GROUP: 'group',
  SUBSIDIARY: 'subsidiary',
  DEPARTMENT: 'department',
  TEAM: 'team',
} as const;

export type StrategyScope = typeof STRATEGY_SCOPE[keyof typeof STRATEGY_SCOPE];

export const STRATEGY_SCOPE_LABELS: Record<StrategyScope, string> = {
  [STRATEGY_SCOPE.GROUP]: 'Group-Wide',
  [STRATEGY_SCOPE.SUBSIDIARY]: 'Subsidiary',
  [STRATEGY_SCOPE.DEPARTMENT]: 'Department',
  [STRATEGY_SCOPE.TEAM]: 'Team',
};

export const STRATEGY_SCOPE_ORDER: StrategyScope[] = [
  STRATEGY_SCOPE.GROUP,
  STRATEGY_SCOPE.SUBSIDIARY,
  STRATEGY_SCOPE.DEPARTMENT,
  STRATEGY_SCOPE.TEAM,
];

// ----------------------------------------------------------------------------
// Time Horizons
// ----------------------------------------------------------------------------
export const TIME_HORIZON = {
  SHORT_TERM: 'short_term',     // < 1 year
  MEDIUM_TERM: 'medium_term',   // 1-3 years
  LONG_TERM: 'long_term',       // 3-5 years
  VISION: 'vision',             // 5+ years
} as const;

export type TimeHorizon = typeof TIME_HORIZON[keyof typeof TIME_HORIZON];

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  [TIME_HORIZON.SHORT_TERM]: 'Short-term (< 1 year)',
  [TIME_HORIZON.MEDIUM_TERM]: 'Medium-term (1-3 years)',
  [TIME_HORIZON.LONG_TERM]: 'Long-term (3-5 years)',
  [TIME_HORIZON.VISION]: 'Vision (5+ years)',
};

export const TIME_HORIZON_MONTHS: Record<TimeHorizon, { min: number; max: number }> = {
  [TIME_HORIZON.SHORT_TERM]: { min: 0, max: 12 },
  [TIME_HORIZON.MEDIUM_TERM]: { min: 12, max: 36 },
  [TIME_HORIZON.LONG_TERM]: { min: 36, max: 60 },
  [TIME_HORIZON.VISION]: { min: 60, max: 120 },
};

// ----------------------------------------------------------------------------
// Strategic Pillar Categories
// ----------------------------------------------------------------------------
export const PILLAR_CATEGORY = {
  GROWTH: 'growth',
  OPERATIONAL_EXCELLENCE: 'operational_excellence',
  INNOVATION: 'innovation',
  PEOPLE: 'people',
  FINANCIAL: 'financial',
  CUSTOMER: 'customer',
  SUSTAINABILITY: 'sustainability',
  TECHNOLOGY: 'technology',
} as const;

export type PillarCategory = typeof PILLAR_CATEGORY[keyof typeof PILLAR_CATEGORY];

export const PILLAR_CATEGORY_LABELS: Record<PillarCategory, string> = {
  [PILLAR_CATEGORY.GROWTH]: 'Growth & Expansion',
  [PILLAR_CATEGORY.OPERATIONAL_EXCELLENCE]: 'Operational Excellence',
  [PILLAR_CATEGORY.INNOVATION]: 'Innovation',
  [PILLAR_CATEGORY.PEOPLE]: 'People & Culture',
  [PILLAR_CATEGORY.FINANCIAL]: 'Financial Performance',
  [PILLAR_CATEGORY.CUSTOMER]: 'Customer Success',
  [PILLAR_CATEGORY.SUSTAINABILITY]: 'Sustainability & Impact',
  [PILLAR_CATEGORY.TECHNOLOGY]: 'Technology & Digital',
};

export const PILLAR_CATEGORY_COLORS: Record<PillarCategory, string> = {
  [PILLAR_CATEGORY.GROWTH]: '#1976d2',
  [PILLAR_CATEGORY.OPERATIONAL_EXCELLENCE]: '#388e3c',
  [PILLAR_CATEGORY.INNOVATION]: '#7b1fa2',
  [PILLAR_CATEGORY.PEOPLE]: '#f57c00',
  [PILLAR_CATEGORY.FINANCIAL]: '#0097a7',
  [PILLAR_CATEGORY.CUSTOMER]: '#d32f2f',
  [PILLAR_CATEGORY.SUSTAINABILITY]: '#689f38',
  [PILLAR_CATEGORY.TECHNOLOGY]: '#512da8',
};

export const PILLAR_CATEGORY_ICONS: Record<PillarCategory, string> = {
  [PILLAR_CATEGORY.GROWTH]: 'trending_up',
  [PILLAR_CATEGORY.OPERATIONAL_EXCELLENCE]: 'settings',
  [PILLAR_CATEGORY.INNOVATION]: 'lightbulb',
  [PILLAR_CATEGORY.PEOPLE]: 'people',
  [PILLAR_CATEGORY.FINANCIAL]: 'account_balance',
  [PILLAR_CATEGORY.CUSTOMER]: 'support_agent',
  [PILLAR_CATEGORY.SUSTAINABILITY]: 'eco',
  [PILLAR_CATEGORY.TECHNOLOGY]: 'computer',
};

// ----------------------------------------------------------------------------
// Review Frequencies
// ----------------------------------------------------------------------------
export const REVIEW_FREQUENCY = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi_annual',
  ANNUAL: 'annual',
} as const;

export type ReviewFrequency = typeof REVIEW_FREQUENCY[keyof typeof REVIEW_FREQUENCY];

export const REVIEW_FREQUENCY_LABELS: Record<ReviewFrequency, string> = {
  [REVIEW_FREQUENCY.WEEKLY]: 'Weekly',
  [REVIEW_FREQUENCY.MONTHLY]: 'Monthly',
  [REVIEW_FREQUENCY.QUARTERLY]: 'Quarterly',
  [REVIEW_FREQUENCY.SEMI_ANNUAL]: 'Semi-Annual',
  [REVIEW_FREQUENCY.ANNUAL]: 'Annual',
};

export const REVIEW_FREQUENCY_DAYS: Record<ReviewFrequency, number> = {
  [REVIEW_FREQUENCY.WEEKLY]: 7,
  [REVIEW_FREQUENCY.MONTHLY]: 30,
  [REVIEW_FREQUENCY.QUARTERLY]: 90,
  [REVIEW_FREQUENCY.SEMI_ANNUAL]: 180,
  [REVIEW_FREQUENCY.ANNUAL]: 365,
};

// ----------------------------------------------------------------------------
// Approval Levels
// ----------------------------------------------------------------------------
export const STRATEGY_APPROVAL_LEVEL = {
  BOARD: 'board',
  CEO: 'ceo',
  EXECUTIVE_TEAM: 'executive_team',
  DEPARTMENT_HEAD: 'department_head',
} as const;

export type StrategyApprovalLevel = typeof STRATEGY_APPROVAL_LEVEL[keyof typeof STRATEGY_APPROVAL_LEVEL];

export const STRATEGY_APPROVAL_LEVEL_LABELS: Record<StrategyApprovalLevel, string> = {
  [STRATEGY_APPROVAL_LEVEL.BOARD]: 'Board of Directors',
  [STRATEGY_APPROVAL_LEVEL.CEO]: 'CEO',
  [STRATEGY_APPROVAL_LEVEL.EXECUTIVE_TEAM]: 'Executive Team',
  [STRATEGY_APPROVAL_LEVEL.DEPARTMENT_HEAD]: 'Department Head',
};

// ----------------------------------------------------------------------------
// Objective Priority
// ----------------------------------------------------------------------------
export const OBJECTIVE_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type ObjectivePriority = typeof OBJECTIVE_PRIORITY[keyof typeof OBJECTIVE_PRIORITY];

export const OBJECTIVE_PRIORITY_LABELS: Record<ObjectivePriority, string> = {
  [OBJECTIVE_PRIORITY.CRITICAL]: 'Critical',
  [OBJECTIVE_PRIORITY.HIGH]: 'High',
  [OBJECTIVE_PRIORITY.MEDIUM]: 'Medium',
  [OBJECTIVE_PRIORITY.LOW]: 'Low',
};

export const OBJECTIVE_PRIORITY_COLORS: Record<ObjectivePriority, string> = {
  [OBJECTIVE_PRIORITY.CRITICAL]: 'error',
  [OBJECTIVE_PRIORITY.HIGH]: 'warning',
  [OBJECTIVE_PRIORITY.MEDIUM]: 'info',
  [OBJECTIVE_PRIORITY.LOW]: 'default',
};

// ----------------------------------------------------------------------------
// Objective Status
// ----------------------------------------------------------------------------
export const OBJECTIVE_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DEFERRED: 'deferred',
  CANCELLED: 'cancelled',
} as const;

export type ObjectiveStatus = typeof OBJECTIVE_STATUS[keyof typeof OBJECTIVE_STATUS];

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  [OBJECTIVE_STATUS.NOT_STARTED]: 'Not Started',
  [OBJECTIVE_STATUS.IN_PROGRESS]: 'In Progress',
  [OBJECTIVE_STATUS.COMPLETED]: 'Completed',
  [OBJECTIVE_STATUS.DEFERRED]: 'Deferred',
  [OBJECTIVE_STATUS.CANCELLED]: 'Cancelled',
};

export const OBJECTIVE_STATUS_COLORS: Record<ObjectiveStatus, string> = {
  [OBJECTIVE_STATUS.NOT_STARTED]: 'default',
  [OBJECTIVE_STATUS.IN_PROGRESS]: 'info',
  [OBJECTIVE_STATUS.COMPLETED]: 'success',
  [OBJECTIVE_STATUS.DEFERRED]: 'warning',
  [OBJECTIVE_STATUS.CANCELLED]: 'error',
};

// ----------------------------------------------------------------------------
// Pillar Status
// ----------------------------------------------------------------------------
export const PILLAR_STATUS = {
  NOT_STARTED: 'not_started',
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  BEHIND: 'behind',
} as const;

export type PillarStatus = typeof PILLAR_STATUS[keyof typeof PILLAR_STATUS];

export const PILLAR_STATUS_LABELS: Record<PillarStatus, string> = {
  [PILLAR_STATUS.NOT_STARTED]: 'Not Started',
  [PILLAR_STATUS.ON_TRACK]: 'On Track',
  [PILLAR_STATUS.AT_RISK]: 'At Risk',
  [PILLAR_STATUS.BEHIND]: 'Behind',
};

export const PILLAR_STATUS_COLORS: Record<PillarStatus, string> = {
  [PILLAR_STATUS.NOT_STARTED]: 'default',
  [PILLAR_STATUS.ON_TRACK]: 'success',
  [PILLAR_STATUS.AT_RISK]: 'warning',
  [PILLAR_STATUS.BEHIND]: 'error',
};

// ----------------------------------------------------------------------------
// Risk Levels
// ----------------------------------------------------------------------------
export const RISK_LIKELIHOOD = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type RiskLikelihood = typeof RISK_LIKELIHOOD[keyof typeof RISK_LIKELIHOOD];

export const RISK_IMPACT = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type RiskImpact = typeof RISK_IMPACT[keyof typeof RISK_IMPACT];

export const RISK_STATUS = {
  IDENTIFIED: 'identified',
  MITIGATING: 'mitigating',
  MITIGATED: 'mitigated',
  ACCEPTED: 'accepted',
} as const;

export type RiskStatus = typeof RISK_STATUS[keyof typeof RISK_STATUS];

// ----------------------------------------------------------------------------
// Alignment Types
// ----------------------------------------------------------------------------
export const ALIGNMENT_ENTITY_TYPE = {
  SUBSIDIARY: 'subsidiary',
  DEPARTMENT: 'department',
  OKR: 'okr',
  KPI: 'kpi',
  PROJECT: 'project',
  INITIATIVE: 'initiative',
} as const;

export type AlignmentEntityType = typeof ALIGNMENT_ENTITY_TYPE[keyof typeof ALIGNMENT_ENTITY_TYPE];

export const ALIGNMENT_STRENGTH = {
  STRONG: 'strong',
  MODERATE: 'moderate',
  WEAK: 'weak',
} as const;

export type AlignmentStrength = typeof ALIGNMENT_STRENGTH[keyof typeof ALIGNMENT_STRENGTH];

// ----------------------------------------------------------------------------
// Metric Direction
// ----------------------------------------------------------------------------
export const METRIC_DIRECTION = {
  HIGHER_IS_BETTER: 'higher_is_better',
  LOWER_IS_BETTER: 'lower_is_better',
  TARGET: 'target',
} as const;

export type MetricDirection = typeof METRIC_DIRECTION[keyof typeof METRIC_DIRECTION];

// ----------------------------------------------------------------------------
// Collections
// ----------------------------------------------------------------------------
export const STRATEGY_COLLECTIONS = {
  DOCUMENTS: 'strategyDocuments',
  VERSIONS: 'versions',
  ALIGNMENTS: 'strategyAlignments',
  REVIEWS: 'strategyReviews',
  DOCUMENT_SECTIONS: 'document_sections',
  SECTION_AUDIT_LOG: 'section_audit_log',
} as const;

/** Subcollection path builders for document sections and audit log */
export const DOCUMENT_SECTIONS = (companyId: string, reviewId: string) =>
  `companies/${companyId}/strategy_reviews/${reviewId}/document_sections`;

export const SECTION_AUDIT_LOG = (companyId: string, reviewId: string) =>
  `companies/${companyId}/strategy_reviews/${reviewId}/section_audit_log`;

// ----------------------------------------------------------------------------
// Defaults & Limits
// ----------------------------------------------------------------------------
export const STRATEGY_DEFAULTS = {
  MAX_PILLARS: 8,
  MAX_OBJECTIVES_PER_PILLAR: 5,
  MAX_METRICS_PER_PILLAR: 10,
  MAX_RISKS: 20,
  MAX_VALUES: 10,
  MAX_ASSUMPTIONS: 10,
  MAX_DEPENDENCIES: 10,
  MAX_SUCCESS_CRITERIA: 10,
  MAX_TAGS: 10,
  VERSION_RETENTION_DAYS: 365,
  REVIEW_REMINDER_DAYS: 7,
};

// ----------------------------------------------------------------------------
// Zeus Group Subsidiaries
// ----------------------------------------------------------------------------
export const ZEUS_SUBSIDIARIES = {
  DAWIN_GROUP: 'dawin_group',
  DAWIN_FINISHES: 'dawin_finishes',
  DAWIN_ADVISORY: 'zeus_group',
  ZEUS_TECHNOLOGY: 'dawin_technology',
  ZEUS_CAPITAL: 'dawin_capital',
} as const;

export type DawinSubsidiary = typeof ZEUS_SUBSIDIARIES[keyof typeof ZEUS_SUBSIDIARIES];

export const DAWIN_SUBSIDIARY_LABELS: Record<DawinSubsidiary, string> = {
  [ZEUS_SUBSIDIARIES.DAWIN_GROUP]: 'Zeus Group',
  [ZEUS_SUBSIDIARIES.DAWIN_FINISHES]: 'Zeus Group',
  [ZEUS_SUBSIDIARIES.DAWIN_ADVISORY]: 'Zeus Group',
  [ZEUS_SUBSIDIARIES.ZEUS_TECHNOLOGY]: 'Zeus Technology',
  [ZEUS_SUBSIDIARIES.ZEUS_CAPITAL]: 'Zeus Capital',
};
