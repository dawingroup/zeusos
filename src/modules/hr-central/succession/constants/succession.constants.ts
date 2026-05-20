// ============================================================================
// SUCCESSION CONSTANTS
// DawinOS v2.0 - HR Module
// Constants for Succession Planning & Talent Pipeline
// ============================================================================

// ----------------------------------------------------------------------------
// ROLE CRITICALITY
// ----------------------------------------------------------------------------

export const ROLE_CRITICALITY_LEVELS = {
  MISSION_CRITICAL: 'mission_critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type RoleCriticalityLevel = typeof ROLE_CRITICALITY_LEVELS[keyof typeof ROLE_CRITICALITY_LEVELS];

export const ROLE_CRITICALITY_LABELS: Record<RoleCriticalityLevel, string> = {
  [ROLE_CRITICALITY_LEVELS.MISSION_CRITICAL]: 'Mission Critical',
  [ROLE_CRITICALITY_LEVELS.HIGH]: 'High Impact',
  [ROLE_CRITICALITY_LEVELS.MEDIUM]: 'Medium Impact',
  [ROLE_CRITICALITY_LEVELS.LOW]: 'Standard',
};

export const ROLE_CRITICALITY_COLORS: Record<RoleCriticalityLevel, string> = {
  [ROLE_CRITICALITY_LEVELS.MISSION_CRITICAL]: '#D32F2F',
  [ROLE_CRITICALITY_LEVELS.HIGH]: '#F57C00',
  [ROLE_CRITICALITY_LEVELS.MEDIUM]: '#FBC02D',
  [ROLE_CRITICALITY_LEVELS.LOW]: '#388E3C',
};

export const CRITICALITY_FACTORS = {
  REVENUE_IMPACT: 'revenue_impact',
  CLIENT_RELATIONSHIPS: 'client_relationships',
  SPECIALIZED_KNOWLEDGE: 'specialized_knowledge',
  REGULATORY_COMPLIANCE: 'regulatory_compliance',
  TEAM_DEPENDENCY: 'team_dependency',
  MARKET_SCARCITY: 'market_scarcity',
  STRATEGIC_IMPORTANCE: 'strategic_importance',
} as const;

export type CriticalityFactor = typeof CRITICALITY_FACTORS[keyof typeof CRITICALITY_FACTORS];

export const CRITICALITY_FACTOR_LABELS: Record<CriticalityFactor, string> = {
  [CRITICALITY_FACTORS.REVENUE_IMPACT]: 'Revenue Impact',
  [CRITICALITY_FACTORS.CLIENT_RELATIONSHIPS]: 'Client Relationships',
  [CRITICALITY_FACTORS.SPECIALIZED_KNOWLEDGE]: 'Specialized Knowledge',
  [CRITICALITY_FACTORS.REGULATORY_COMPLIANCE]: 'Regulatory Compliance',
  [CRITICALITY_FACTORS.TEAM_DEPENDENCY]: 'Team Dependency',
  [CRITICALITY_FACTORS.MARKET_SCARCITY]: 'Market Scarcity',
  [CRITICALITY_FACTORS.STRATEGIC_IMPORTANCE]: 'Strategic Importance',
};

// ----------------------------------------------------------------------------
// SUCCESSOR READINESS
// ----------------------------------------------------------------------------

export const READINESS_LEVELS = {
  READY_NOW: 'ready_now',
  READY_1_YEAR: 'ready_1_year',
  READY_2_YEARS: 'ready_2_years',
  READY_3_PLUS: 'ready_3_plus',
  NOT_READY: 'not_ready',
} as const;

export type ReadinessLevel = typeof READINESS_LEVELS[keyof typeof READINESS_LEVELS];

export const READINESS_LABELS: Record<ReadinessLevel, string> = {
  [READINESS_LEVELS.READY_NOW]: 'Ready Now',
  [READINESS_LEVELS.READY_1_YEAR]: 'Ready in 1 Year',
  [READINESS_LEVELS.READY_2_YEARS]: 'Ready in 2 Years',
  [READINESS_LEVELS.READY_3_PLUS]: 'Ready in 3+ Years',
  [READINESS_LEVELS.NOT_READY]: 'Not Ready',
};

export const READINESS_COLORS: Record<ReadinessLevel, string> = {
  [READINESS_LEVELS.READY_NOW]: '#2E7D32',
  [READINESS_LEVELS.READY_1_YEAR]: '#558B2F',
  [READINESS_LEVELS.READY_2_YEARS]: '#F9A825',
  [READINESS_LEVELS.READY_3_PLUS]: '#EF6C00',
  [READINESS_LEVELS.NOT_READY]: '#C62828',
};

// ----------------------------------------------------------------------------
// TALENT POTENTIAL
// ----------------------------------------------------------------------------

export const POTENTIAL_RATINGS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type PotentialRating = typeof POTENTIAL_RATINGS[keyof typeof POTENTIAL_RATINGS];

export const POTENTIAL_LABELS: Record<PotentialRating, string> = {
  [POTENTIAL_RATINGS.HIGH]: 'High Potential',
  [POTENTIAL_RATINGS.MEDIUM]: 'Moderate Potential',
  [POTENTIAL_RATINGS.LOW]: 'Limited Potential',
};

// 9-Box Grid categories (Performance x Potential)
export const NINE_BOX_CATEGORIES = {
  STAR: 'star',
  HIGH_POTENTIAL: 'high_potential',
  FUTURE_STAR: 'future_star',
  HIGH_PERFORMER: 'high_performer',
  CORE_PLAYER: 'core_player',
  INCONSISTENT: 'inconsistent',
  SOLID_PERFORMER: 'solid_performer',
  AVERAGE_PERFORMER: 'average_performer',
  UNDERPERFORMER: 'underperformer',
} as const;

export type NineBoxCategory = typeof NINE_BOX_CATEGORIES[keyof typeof NINE_BOX_CATEGORIES];

export const NINE_BOX_LABELS: Record<NineBoxCategory, string> = {
  [NINE_BOX_CATEGORIES.STAR]: 'Star (Promote)',
  [NINE_BOX_CATEGORIES.HIGH_POTENTIAL]: 'High Potential (Develop)',
  [NINE_BOX_CATEGORIES.FUTURE_STAR]: 'Future Star (Challenge)',
  [NINE_BOX_CATEGORIES.HIGH_PERFORMER]: 'High Performer (Reward)',
  [NINE_BOX_CATEGORIES.CORE_PLAYER]: 'Core Player (Maintain)',
  [NINE_BOX_CATEGORIES.INCONSISTENT]: 'Inconsistent (Coach)',
  [NINE_BOX_CATEGORIES.SOLID_PERFORMER]: 'Solid Performer (Utilize)',
  [NINE_BOX_CATEGORIES.AVERAGE_PERFORMER]: 'Average Performer (Monitor)',
  [NINE_BOX_CATEGORIES.UNDERPERFORMER]: 'Underperformer (Action)',
};

export const NINE_BOX_COLORS: Record<NineBoxCategory, string> = {
  [NINE_BOX_CATEGORIES.STAR]: '#1B5E20',
  [NINE_BOX_CATEGORIES.HIGH_POTENTIAL]: '#2E7D32',
  [NINE_BOX_CATEGORIES.FUTURE_STAR]: '#43A047',
  [NINE_BOX_CATEGORIES.HIGH_PERFORMER]: '#1565C0',
  [NINE_BOX_CATEGORIES.CORE_PLAYER]: '#1976D2',
  [NINE_BOX_CATEGORIES.INCONSISTENT]: '#42A5F5',
  [NINE_BOX_CATEGORIES.SOLID_PERFORMER]: '#F57F17',
  [NINE_BOX_CATEGORIES.AVERAGE_PERFORMER]: '#FBC02D',
  [NINE_BOX_CATEGORIES.UNDERPERFORMER]: '#D32F2F',
};

export const NINE_BOX_MAPPING: Record<string, NineBoxCategory> = {
  'high-high': NINE_BOX_CATEGORIES.STAR,
  'high-medium': NINE_BOX_CATEGORIES.HIGH_PERFORMER,
  'high-low': NINE_BOX_CATEGORIES.SOLID_PERFORMER,
  'medium-high': NINE_BOX_CATEGORIES.HIGH_POTENTIAL,
  'medium-medium': NINE_BOX_CATEGORIES.CORE_PLAYER,
  'medium-low': NINE_BOX_CATEGORIES.AVERAGE_PERFORMER,
  'low-high': NINE_BOX_CATEGORIES.FUTURE_STAR,
  'low-medium': NINE_BOX_CATEGORIES.INCONSISTENT,
  'low-low': NINE_BOX_CATEGORIES.UNDERPERFORMER,
};

// ----------------------------------------------------------------------------
// RISK LEVELS
// ----------------------------------------------------------------------------

export const SUCCESSION_RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type SuccessionRiskLevel = typeof SUCCESSION_RISK_LEVELS[keyof typeof SUCCESSION_RISK_LEVELS];

export const SUCCESSION_RISK_LABELS: Record<SuccessionRiskLevel, string> = {
  [SUCCESSION_RISK_LEVELS.CRITICAL]: 'Critical Risk',
  [SUCCESSION_RISK_LEVELS.HIGH]: 'High Risk',
  [SUCCESSION_RISK_LEVELS.MEDIUM]: 'Medium Risk',
  [SUCCESSION_RISK_LEVELS.LOW]: 'Low Risk',
};

export const SUCCESSION_RISK_COLORS: Record<SuccessionRiskLevel, string> = {
  [SUCCESSION_RISK_LEVELS.CRITICAL]: '#D32F2F',
  [SUCCESSION_RISK_LEVELS.HIGH]: '#F57C00',
  [SUCCESSION_RISK_LEVELS.MEDIUM]: '#FBC02D',
  [SUCCESSION_RISK_LEVELS.LOW]: '#388E3C',
};

export const FLIGHT_RISK_FACTORS = {
  TENURE_LONG: 'tenure_long',
  COMPENSATION_GAP: 'compensation_gap',
  CAREER_STALL: 'career_stall',
  LOW_ENGAGEMENT: 'low_engagement',
  MARKET_DEMAND: 'market_demand',
  LIFE_CHANGE: 'life_change',
} as const;

export type FlightRiskFactor = typeof FLIGHT_RISK_FACTORS[keyof typeof FLIGHT_RISK_FACTORS];

export const FLIGHT_RISK_FACTOR_LABELS: Record<FlightRiskFactor, string> = {
  [FLIGHT_RISK_FACTORS.TENURE_LONG]: 'Long Tenure in Same Role',
  [FLIGHT_RISK_FACTORS.COMPENSATION_GAP]: 'Below Market Compensation',
  [FLIGHT_RISK_FACTORS.CAREER_STALL]: 'Career Stagnation',
  [FLIGHT_RISK_FACTORS.LOW_ENGAGEMENT]: 'Low Engagement Scores',
  [FLIGHT_RISK_FACTORS.MARKET_DEMAND]: 'High Market Demand for Skills',
  [FLIGHT_RISK_FACTORS.LIFE_CHANGE]: 'Known Life Changes',
};

// ----------------------------------------------------------------------------
// DEVELOPMENT ACTIONS
// ----------------------------------------------------------------------------

export const DEVELOPMENT_ACTION_TYPES = {
  STRETCH_ASSIGNMENT: 'stretch_assignment',
  JOB_ROTATION: 'job_rotation',
  MENTORING: 'mentoring',
  COACHING: 'coaching',
  TRAINING: 'training',
  CERTIFICATION: 'certification',
  EXPOSURE: 'exposure',
  PROJECT_LEAD: 'project_lead',
  ACTING_ROLE: 'acting_role',
  SHADOWING: 'shadowing',
} as const;

export type DevelopmentActionType = typeof DEVELOPMENT_ACTION_TYPES[keyof typeof DEVELOPMENT_ACTION_TYPES];

export const DEVELOPMENT_ACTION_LABELS: Record<DevelopmentActionType, string> = {
  [DEVELOPMENT_ACTION_TYPES.STRETCH_ASSIGNMENT]: 'Stretch Assignment',
  [DEVELOPMENT_ACTION_TYPES.JOB_ROTATION]: 'Job Rotation',
  [DEVELOPMENT_ACTION_TYPES.MENTORING]: 'Mentoring Program',
  [DEVELOPMENT_ACTION_TYPES.COACHING]: 'Executive Coaching',
  [DEVELOPMENT_ACTION_TYPES.TRAINING]: 'Training Course',
  [DEVELOPMENT_ACTION_TYPES.CERTIFICATION]: 'Professional Certification',
  [DEVELOPMENT_ACTION_TYPES.EXPOSURE]: 'Leadership Exposure',
  [DEVELOPMENT_ACTION_TYPES.PROJECT_LEAD]: 'Project Leadership',
  [DEVELOPMENT_ACTION_TYPES.ACTING_ROLE]: 'Acting/Interim Role',
  [DEVELOPMENT_ACTION_TYPES.SHADOWING]: 'Job Shadowing',
};

// ----------------------------------------------------------------------------
// SUCCESSION PLAN STATUS
// ----------------------------------------------------------------------------

export const SUCCESSION_PLAN_STATUSES = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export type SuccessionPlanStatus = typeof SUCCESSION_PLAN_STATUSES[keyof typeof SUCCESSION_PLAN_STATUSES];

export const SUCCESSION_PLAN_STATUS_LABELS: Record<SuccessionPlanStatus, string> = {
  [SUCCESSION_PLAN_STATUSES.DRAFT]: 'Draft',
  [SUCCESSION_PLAN_STATUSES.UNDER_REVIEW]: 'Under Review',
  [SUCCESSION_PLAN_STATUSES.APPROVED]: 'Approved',
  [SUCCESSION_PLAN_STATUSES.ACTIVE]: 'Active',
  [SUCCESSION_PLAN_STATUSES.ARCHIVED]: 'Archived',
};

// ----------------------------------------------------------------------------
// DEVELOPMENT PLAN STATUS
// ----------------------------------------------------------------------------

export const DEVELOPMENT_PLAN_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type DevelopmentPlanStatus = typeof DEVELOPMENT_PLAN_STATUSES[keyof typeof DEVELOPMENT_PLAN_STATUSES];

// ----------------------------------------------------------------------------
// ACTION STATUS
// ----------------------------------------------------------------------------

export const ACTION_STATUSES = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DEFERRED: 'deferred',
  CANCELLED: 'cancelled',
} as const;

export type ActionStatus = typeof ACTION_STATUSES[keyof typeof ACTION_STATUSES];

// ----------------------------------------------------------------------------
// VACANCY REASONS
// ----------------------------------------------------------------------------

export const VACANCY_REASONS = {
  RETIREMENT: 'retirement',
  PROMOTION: 'promotion',
  RESIGNATION: 'resignation',
  PLANNED_EXIT: 'planned_exit',
  UNKNOWN: 'unknown',
} as const;

export type VacancyReason = typeof VACANCY_REASONS[keyof typeof VACANCY_REASONS];

// ----------------------------------------------------------------------------
// POOL TYPES
// ----------------------------------------------------------------------------

export const TALENT_POOL_TYPES = {
  LEADERSHIP: 'leadership',
  TECHNICAL: 'technical',
  FUNCTIONAL: 'functional',
  GENERAL: 'general',
} as const;

export type TalentPoolType = typeof TALENT_POOL_TYPES[keyof typeof TALENT_POOL_TYPES];

// ----------------------------------------------------------------------------
// REVIEW CYCLES
// ----------------------------------------------------------------------------

export const SUCCESSION_REVIEW_CYCLES = {
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi_annual',
  ANNUAL: 'annual',
} as const;

export type SuccessionReviewCycle = typeof SUCCESSION_REVIEW_CYCLES[keyof typeof SUCCESSION_REVIEW_CYCLES];

// ----------------------------------------------------------------------------
// COMPETENCY GAP PRIORITY
// ----------------------------------------------------------------------------

export const COMPETENCY_GAP_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type CompetencyGapPriority = typeof COMPETENCY_GAP_PRIORITIES[keyof typeof COMPETENCY_GAP_PRIORITIES];

// ----------------------------------------------------------------------------
// FIRESTORE COLLECTIONS
// ----------------------------------------------------------------------------

export const CRITICAL_ROLES_COLLECTION = 'critical_roles';
export const DEVELOPMENT_PLANS_COLLECTION = 'development_plans';
export const TALENT_POOLS_COLLECTION = 'talent_pools';
export const SUCCESSION_PLANS_COLLECTION = 'succession_plans';
