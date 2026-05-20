// ============================================================================
// PERFORMANCE REVIEW CONSTANTS
// DawinOS v2.0 - HR Module
// Constants for Performance Management System
// ============================================================================

// ----------------------------------------------------------------------------
// REVIEW CYCLES
// ----------------------------------------------------------------------------

export const REVIEW_CYCLES = {
  ANNUAL: 'annual',
  SEMI_ANNUAL: 'semi_annual',
  QUARTERLY: 'quarterly',
  MONTHLY: 'monthly',
  PROBATION: 'probation',
  PROJECT_END: 'project_end',
  AD_HOC: 'ad_hoc',
} as const;

export type ReviewCycle = typeof REVIEW_CYCLES[keyof typeof REVIEW_CYCLES];

export const REVIEW_CYCLE_LABELS: Record<ReviewCycle, string> = {
  annual: 'Annual Review',
  semi_annual: 'Semi-Annual Review',
  quarterly: 'Quarterly Review',
  monthly: 'Monthly Check-in',
  probation: 'Probation Review',
  project_end: 'Project Completion Review',
  ad_hoc: 'Ad-hoc Review',
};

export const REVIEW_CYCLE_MONTHS: Record<ReviewCycle, number> = {
  annual: 12,
  semi_annual: 6,
  quarterly: 3,
  monthly: 1,
  probation: 3, // Uganda standard probation period
  project_end: 0,
  ad_hoc: 0,
};

// ----------------------------------------------------------------------------
// REVIEW STATUS
// ----------------------------------------------------------------------------

export const REVIEW_STATUS = {
  DRAFT: 'draft',
  SELF_ASSESSMENT: 'self_assessment',
  MANAGER_REVIEW: 'manager_review',
  CALIBRATION: 'calibration',
  ACKNOWLEDGEMENT: 'acknowledgement',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ReviewStatus = typeof REVIEW_STATUS[keyof typeof REVIEW_STATUS];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: 'Draft',
  self_assessment: 'Self Assessment',
  manager_review: 'Manager Review',
  calibration: 'Calibration',
  acknowledgement: 'Employee Acknowledgement',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  draft: 'default',
  self_assessment: 'info',
  manager_review: 'primary',
  calibration: 'secondary',
  acknowledgement: 'warning',
  completed: 'success',
  cancelled: 'error',
};

// ----------------------------------------------------------------------------
// RATING SCALES
// ----------------------------------------------------------------------------

export const RATING_SCALES = {
  FIVE_POINT: 'five_point',
  FOUR_POINT: 'four_point',
  THREE_POINT: 'three_point',
  PERCENTAGE: 'percentage',
} as const;

export type RatingScale = typeof RATING_SCALES[keyof typeof RATING_SCALES];

export const FIVE_POINT_RATINGS = {
  EXCEPTIONAL: { value: 5, label: 'Exceptional', description: 'Consistently exceeds all expectations' },
  EXCEEDS: { value: 4, label: 'Exceeds Expectations', description: 'Frequently exceeds expectations' },
  MEETS: { value: 3, label: 'Meets Expectations', description: 'Consistently meets expectations' },
  DEVELOPING: { value: 2, label: 'Developing', description: 'Partially meets expectations, needs improvement' },
  UNSATISFACTORY: { value: 1, label: 'Unsatisfactory', description: 'Does not meet expectations' },
} as const;

export const FOUR_POINT_RATINGS = {
  OUTSTANDING: { value: 4, label: 'Outstanding', description: 'Exceptional performance in all areas' },
  PROFICIENT: { value: 3, label: 'Proficient', description: 'Strong performance, meets all expectations' },
  DEVELOPING: { value: 2, label: 'Developing', description: 'Growing skills, some areas need attention' },
  NEEDS_IMPROVEMENT: { value: 1, label: 'Needs Improvement', description: 'Significant gaps in performance' },
} as const;

// ----------------------------------------------------------------------------
// COMPETENCY CATEGORIES
// ----------------------------------------------------------------------------

export const COMPETENCY_CATEGORIES = {
  CORE: 'core',
  TECHNICAL: 'technical',
  LEADERSHIP: 'leadership',
  FUNCTIONAL: 'functional',
  BEHAVIORAL: 'behavioral',
} as const;

export type CompetencyCategory = typeof COMPETENCY_CATEGORIES[keyof typeof COMPETENCY_CATEGORIES];

export const COMPETENCY_CATEGORY_LABELS: Record<CompetencyCategory, string> = {
  core: 'Core Competencies',
  technical: 'Technical Skills',
  leadership: 'Leadership Competencies',
  functional: 'Functional Competencies',
  behavioral: 'Behavioral Competencies',
};

// ----------------------------------------------------------------------------
// CORE COMPETENCIES (Uganda Business Context)
// ----------------------------------------------------------------------------

export const CORE_COMPETENCIES = [
  {
    id: 'communication',
    name: 'Communication',
    description: 'Ability to communicate effectively in English and local languages',
    category: 'core',
  },
  {
    id: 'teamwork',
    name: 'Teamwork & Collaboration',
    description: 'Works effectively with diverse teams and stakeholders',
    category: 'core',
  },
  {
    id: 'problem_solving',
    name: 'Problem Solving',
    description: 'Identifies issues and develops practical solutions',
    category: 'core',
  },
  {
    id: 'adaptability',
    name: 'Adaptability',
    description: 'Adjusts to changing priorities and circumstances',
    category: 'core',
  },
  {
    id: 'integrity',
    name: 'Integrity & Ethics',
    description: 'Demonstrates honesty, transparency, and ethical behavior',
    category: 'core',
  },
  {
    id: 'customer_focus',
    name: 'Customer Focus',
    description: 'Prioritizes client and stakeholder needs',
    category: 'core',
  },
  {
    id: 'results_orientation',
    name: 'Results Orientation',
    description: 'Focuses on achieving goals and delivering outcomes',
    category: 'core',
  },
  {
    id: 'continuous_learning',
    name: 'Continuous Learning',
    description: 'Actively seeks to improve skills and knowledge',
    category: 'core',
  },
] as const;

// ----------------------------------------------------------------------------
// LEADERSHIP COMPETENCIES
// ----------------------------------------------------------------------------

export const LEADERSHIP_COMPETENCIES = [
  {
    id: 'strategic_thinking',
    name: 'Strategic Thinking',
    description: 'Develops and communicates long-term vision',
    category: 'leadership',
  },
  {
    id: 'people_development',
    name: 'People Development',
    description: 'Coaches and develops team members',
    category: 'leadership',
  },
  {
    id: 'decision_making',
    name: 'Decision Making',
    description: 'Makes timely, sound decisions',
    category: 'leadership',
  },
  {
    id: 'change_management',
    name: 'Change Management',
    description: 'Leads and manages organizational change',
    category: 'leadership',
  },
  {
    id: 'stakeholder_management',
    name: 'Stakeholder Management',
    description: 'Builds and maintains key relationships',
    category: 'leadership',
  },
  {
    id: 'delegation',
    name: 'Delegation',
    description: 'Effectively assigns work and empowers others',
    category: 'leadership',
  },
] as const;

// ----------------------------------------------------------------------------
// GOAL TYPES
// ----------------------------------------------------------------------------

export const GOAL_TYPES = {
  PERFORMANCE: 'performance',
  DEVELOPMENT: 'development',
  PROJECT: 'project',
  BEHAVIORAL: 'behavioral',
  STRETCH: 'stretch',
} as const;

export type GoalType = typeof GOAL_TYPES[keyof typeof GOAL_TYPES];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  performance: 'Performance Goal',
  development: 'Development Goal',
  project: 'Project Goal',
  behavioral: 'Behavioral Goal',
  stretch: 'Stretch Goal',
};

// ----------------------------------------------------------------------------
// GOAL STATUS
// ----------------------------------------------------------------------------

export const GOAL_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  COMPLETED: 'completed',
  EXCEEDED: 'exceeded',
  CANCELLED: 'cancelled',
} as const;

export type GoalStatus = typeof GOAL_STATUS[keyof typeof GOAL_STATUS];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  on_track: 'On Track',
  at_risk: 'At Risk',
  completed: 'Completed',
  exceeded: 'Exceeded',
  cancelled: 'Cancelled',
};

export const GOAL_STATUS_COLORS: Record<GoalStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  not_started: 'default',
  in_progress: 'info',
  on_track: 'primary',
  at_risk: 'warning',
  completed: 'success',
  exceeded: 'success',
  cancelled: 'error',
};

// ----------------------------------------------------------------------------
// FEEDBACK TYPES
// ----------------------------------------------------------------------------

export const FEEDBACK_TYPES = {
  SELF: 'self',
  MANAGER: 'manager',
  PEER: 'peer',
  DIRECT_REPORT: 'direct_report',
  EXTERNAL: 'external',
} as const;

export type FeedbackType = typeof FEEDBACK_TYPES[keyof typeof FEEDBACK_TYPES];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  self: 'Self Assessment',
  manager: 'Manager Feedback',
  peer: 'Peer Feedback',
  direct_report: 'Direct Report Feedback',
  external: 'External Feedback',
};

// ----------------------------------------------------------------------------
// REVIEW TEMPLATES
// ----------------------------------------------------------------------------

export const REVIEW_TEMPLATES = {
  STANDARD: 'standard',
  PROBATION: 'probation',
  LEADERSHIP: 'leadership',
  PROJECT: 'project',
  QUICK_CHECK: 'quick_check',
} as const;

export type ReviewTemplate = typeof REVIEW_TEMPLATES[keyof typeof REVIEW_TEMPLATES];

export const REVIEW_TEMPLATE_CONFIG: Record<ReviewTemplate, {
  label: string;
  sections: string[];
  competenciesRequired: boolean;
  goalsRequired: boolean;
  feedbackRequired: boolean;
}> = {
  standard: {
    label: 'Standard Performance Review',
    sections: ['goals', 'competencies', 'achievements', 'development', 'overall'],
    competenciesRequired: true,
    goalsRequired: true,
    feedbackRequired: false,
  },
  probation: {
    label: 'Probation Review',
    sections: ['job_fit', 'competencies', 'training', 'recommendation'],
    competenciesRequired: true,
    goalsRequired: false,
    feedbackRequired: false,
  },
  leadership: {
    label: 'Leadership Review',
    sections: ['goals', 'competencies', 'leadership', 'team_performance', 'development'],
    competenciesRequired: true,
    goalsRequired: true,
    feedbackRequired: true,
  },
  project: {
    label: 'Project Completion Review',
    sections: ['deliverables', 'timeline', 'quality', 'collaboration', 'lessons'],
    competenciesRequired: false,
    goalsRequired: false,
    feedbackRequired: true,
  },
  quick_check: {
    label: 'Quick Check-in',
    sections: ['progress', 'blockers', 'support_needed'],
    competenciesRequired: false,
    goalsRequired: false,
    feedbackRequired: false,
  },
};

// ----------------------------------------------------------------------------
// PERFORMANCE IMPROVEMENT PLAN (PIP)
// ----------------------------------------------------------------------------

export const PIP_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXTENDED: 'extended',
  COMPLETED_SUCCESS: 'completed_success',
  COMPLETED_FAIL: 'completed_fail',
  CANCELLED: 'cancelled',
} as const;

export type PIPStatus = typeof PIP_STATUS[keyof typeof PIP_STATUS];

export const PIP_STATUS_LABELS: Record<PIPStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  extended: 'Extended',
  completed_success: 'Completed - Successful',
  completed_fail: 'Completed - Unsuccessful',
  cancelled: 'Cancelled',
};

export const PIP_DURATION_OPTIONS = [
  { value: 30, label: '30 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' },
];

// ----------------------------------------------------------------------------
// COLLECTIONS
// ----------------------------------------------------------------------------

export const PERFORMANCE_REVIEWS_COLLECTION = 'performance_reviews';
export const PERFORMANCE_GOALS_COLLECTION = 'performance_goals';
export const COMPETENCY_ASSESSMENTS_COLLECTION = 'competency_assessments';
export const FEEDBACK_COLLECTION = 'feedback';
export const PIP_COLLECTION = 'performance_improvement_plans';
export const REVIEW_TEMPLATES_COLLECTION = 'review_templates';
