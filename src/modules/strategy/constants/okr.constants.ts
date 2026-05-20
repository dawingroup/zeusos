// ============================================================================
// OKR CONSTANTS - DawinOS CEO Strategy Command
// Constants for OKR (Objectives and Key Results) management
// ============================================================================

// ----------------------------------------------------------------------------
// OKR Level
// ----------------------------------------------------------------------------
export const OKR_LEVEL = {
  COMPANY: 'company',
  SUBSIDIARY: 'subsidiary',
  DEPARTMENT: 'department',
  TEAM: 'team',
  INDIVIDUAL: 'individual',
} as const;

export type OKRLevel = typeof OKR_LEVEL[keyof typeof OKR_LEVEL];

export const OKR_LEVEL_LABELS: Record<OKRLevel, string> = {
  [OKR_LEVEL.COMPANY]: 'Company',
  [OKR_LEVEL.SUBSIDIARY]: 'Subsidiary',
  [OKR_LEVEL.DEPARTMENT]: 'Department',
  [OKR_LEVEL.TEAM]: 'Team',
  [OKR_LEVEL.INDIVIDUAL]: 'Individual',
};

export const OKR_LEVEL_ORDER: OKRLevel[] = [
  OKR_LEVEL.COMPANY,
  OKR_LEVEL.SUBSIDIARY,
  OKR_LEVEL.DEPARTMENT,
  OKR_LEVEL.TEAM,
  OKR_LEVEL.INDIVIDUAL,
];

export const OKR_LEVEL_ICONS: Record<OKRLevel, string> = {
  [OKR_LEVEL.COMPANY]: 'business',
  [OKR_LEVEL.SUBSIDIARY]: 'domain',
  [OKR_LEVEL.DEPARTMENT]: 'account_tree',
  [OKR_LEVEL.TEAM]: 'groups',
  [OKR_LEVEL.INDIVIDUAL]: 'person',
};

// ----------------------------------------------------------------------------
// OKR Status
// ----------------------------------------------------------------------------
export const OKR_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DEFERRED: 'deferred',
} as const;

export type OKRStatus = typeof OKR_STATUS[keyof typeof OKR_STATUS];

export const OKR_STATUS_LABELS: Record<OKRStatus, string> = {
  [OKR_STATUS.DRAFT]: 'Draft',
  [OKR_STATUS.ACTIVE]: 'Active',
  [OKR_STATUS.COMPLETED]: 'Completed',
  [OKR_STATUS.CANCELLED]: 'Cancelled',
  [OKR_STATUS.DEFERRED]: 'Deferred',
};

export const OKR_STATUS_COLORS: Record<OKRStatus, string> = {
  [OKR_STATUS.DRAFT]: 'default',
  [OKR_STATUS.ACTIVE]: 'info',
  [OKR_STATUS.COMPLETED]: 'success',
  [OKR_STATUS.CANCELLED]: 'error',
  [OKR_STATUS.DEFERRED]: 'warning',
};

// ----------------------------------------------------------------------------
// Key Result Type
// ----------------------------------------------------------------------------
export const KEY_RESULT_TYPE = {
  NUMERIC: 'numeric',
  PERCENTAGE: 'percentage',
  CURRENCY: 'currency',
  BINARY: 'binary',
  MILESTONE: 'milestone',
} as const;

export type KeyResultType = typeof KEY_RESULT_TYPE[keyof typeof KEY_RESULT_TYPE];

export const KEY_RESULT_TYPE_LABELS: Record<KeyResultType, string> = {
  [KEY_RESULT_TYPE.NUMERIC]: 'Numeric',
  [KEY_RESULT_TYPE.PERCENTAGE]: 'Percentage',
  [KEY_RESULT_TYPE.CURRENCY]: 'Currency',
  [KEY_RESULT_TYPE.BINARY]: 'Yes/No',
  [KEY_RESULT_TYPE.MILESTONE]: 'Milestones',
};

export const KEY_RESULT_TYPE_ICONS: Record<KeyResultType, string> = {
  [KEY_RESULT_TYPE.NUMERIC]: 'tag',
  [KEY_RESULT_TYPE.PERCENTAGE]: 'percent',
  [KEY_RESULT_TYPE.CURRENCY]: 'payments',
  [KEY_RESULT_TYPE.BINARY]: 'check_circle',
  [KEY_RESULT_TYPE.MILESTONE]: 'flag',
};

// ----------------------------------------------------------------------------
// Confidence Level
// ----------------------------------------------------------------------------
export const CONFIDENCE_LEVEL = {
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  OFF_TRACK: 'off_track',
} as const;

export type ConfidenceLevel = typeof CONFIDENCE_LEVEL[keyof typeof CONFIDENCE_LEVEL];

export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  [CONFIDENCE_LEVEL.ON_TRACK]: 'On Track',
  [CONFIDENCE_LEVEL.AT_RISK]: 'At Risk',
  [CONFIDENCE_LEVEL.OFF_TRACK]: 'Off Track',
};

export const CONFIDENCE_LEVEL_COLORS: Record<ConfidenceLevel, string> = {
  [CONFIDENCE_LEVEL.ON_TRACK]: 'success',
  [CONFIDENCE_LEVEL.AT_RISK]: 'warning',
  [CONFIDENCE_LEVEL.OFF_TRACK]: 'error',
};

export const CONFIDENCE_LEVEL_RANGES: Record<ConfidenceLevel, { min: number; max: number }> = {
  [CONFIDENCE_LEVEL.ON_TRACK]: { min: 70, max: 100 },
  [CONFIDENCE_LEVEL.AT_RISK]: { min: 40, max: 69 },
  [CONFIDENCE_LEVEL.OFF_TRACK]: { min: 0, max: 39 },
};

// ----------------------------------------------------------------------------
// OKR Cycle
// ----------------------------------------------------------------------------
export const OKR_CYCLE = {
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
  ANNUAL: 'annual',
  CUSTOM: 'custom',
} as const;

export type OKRCycle = typeof OKR_CYCLE[keyof typeof OKR_CYCLE];

export const OKR_CYCLE_LABELS: Record<OKRCycle, string> = {
  [OKR_CYCLE.Q1]: 'Q1 (Jan-Mar)',
  [OKR_CYCLE.Q2]: 'Q2 (Apr-Jun)',
  [OKR_CYCLE.Q3]: 'Q3 (Jul-Sep)',
  [OKR_CYCLE.Q4]: 'Q4 (Oct-Dec)',
  [OKR_CYCLE.ANNUAL]: 'Annual',
  [OKR_CYCLE.CUSTOM]: 'Custom Period',
};

export const QUARTER_MONTHS: Record<string, { start: number; end: number }> = {
  Q1: { start: 0, end: 2 },   // Jan-Mar (0-indexed months)
  Q2: { start: 3, end: 5 },   // Apr-Jun
  Q3: { start: 6, end: 8 },   // Jul-Sep
  Q4: { start: 9, end: 11 },  // Oct-Dec
};

// ----------------------------------------------------------------------------
// OKR Cycle Status
// ----------------------------------------------------------------------------
export const OKR_CYCLE_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  REVIEW: 'review',
  CLOSED: 'closed',
} as const;

export type OKRCycleStatus = typeof OKR_CYCLE_STATUS[keyof typeof OKR_CYCLE_STATUS];

export const OKR_CYCLE_STATUS_LABELS: Record<OKRCycleStatus, string> = {
  [OKR_CYCLE_STATUS.PLANNING]: 'Planning',
  [OKR_CYCLE_STATUS.ACTIVE]: 'Active',
  [OKR_CYCLE_STATUS.REVIEW]: 'Under Review',
  [OKR_CYCLE_STATUS.CLOSED]: 'Closed',
};

// ----------------------------------------------------------------------------
// OKR Scoring
// ----------------------------------------------------------------------------
export const OKR_SCORE_RANGE = {
  STRETCH: { min: 0.7, max: 1.0, label: 'Stretch Goal Achieved', color: '#4caf50' },
  TARGET: { min: 0.5, max: 0.69, label: 'Target Met', color: '#8bc34a' },
  PARTIAL: { min: 0.3, max: 0.49, label: 'Partial Progress', color: '#ff9800' },
  MISS: { min: 0, max: 0.29, label: 'Missed', color: '#f44336' },
} as const;

export type OKRScoreRangeKey = keyof typeof OKR_SCORE_RANGE;

export function getScoreRange(score: number): typeof OKR_SCORE_RANGE[OKRScoreRangeKey] {
  if (score >= 0.7) return OKR_SCORE_RANGE.STRETCH;
  if (score >= 0.5) return OKR_SCORE_RANGE.TARGET;
  if (score >= 0.3) return OKR_SCORE_RANGE.PARTIAL;
  return OKR_SCORE_RANGE.MISS;
}

export function getScoreLabel(score: number): string {
  return getScoreRange(score).label;
}

export function getScoreColor(score: number): string {
  return getScoreRange(score).color;
}

// ----------------------------------------------------------------------------
// Check-In Frequency
// ----------------------------------------------------------------------------
export const CHECK_IN_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BI_WEEKLY: 'bi_weekly',
  MONTHLY: 'monthly',
} as const;

export type CheckInFrequency = typeof CHECK_IN_FREQUENCY[keyof typeof CHECK_IN_FREQUENCY];

export const CHECK_IN_FREQUENCY_LABELS: Record<CheckInFrequency, string> = {
  [CHECK_IN_FREQUENCY.DAILY]: 'Daily',
  [CHECK_IN_FREQUENCY.WEEKLY]: 'Weekly',
  [CHECK_IN_FREQUENCY.BI_WEEKLY]: 'Bi-Weekly',
  [CHECK_IN_FREQUENCY.MONTHLY]: 'Monthly',
};

export const CHECK_IN_FREQUENCY_DAYS: Record<CheckInFrequency, number> = {
  [CHECK_IN_FREQUENCY.DAILY]: 1,
  [CHECK_IN_FREQUENCY.WEEKLY]: 7,
  [CHECK_IN_FREQUENCY.BI_WEEKLY]: 14,
  [CHECK_IN_FREQUENCY.MONTHLY]: 30,
};

// ----------------------------------------------------------------------------
// Alignment Type
// ----------------------------------------------------------------------------
export const OKR_ALIGNMENT_TYPE = {
  PARENT: 'parent',
  CONTRIBUTES_TO: 'contributes_to',
  SHARED: 'shared',
} as const;

export type OKRAlignmentType = typeof OKR_ALIGNMENT_TYPE[keyof typeof OKR_ALIGNMENT_TYPE];

export const OKR_ALIGNMENT_TYPE_LABELS: Record<OKRAlignmentType, string> = {
  [OKR_ALIGNMENT_TYPE.PARENT]: 'Directly Supports',
  [OKR_ALIGNMENT_TYPE.CONTRIBUTES_TO]: 'Contributes To',
  [OKR_ALIGNMENT_TYPE.SHARED]: 'Co-Owned',
};

// ----------------------------------------------------------------------------
// OKR Visibility
// ----------------------------------------------------------------------------
export const OKR_VISIBILITY = {
  PUBLIC: 'public',
  TEAM: 'team',
  PRIVATE: 'private',
} as const;

export type OKRVisibility = typeof OKR_VISIBILITY[keyof typeof OKR_VISIBILITY];

export const OKR_VISIBILITY_LABELS: Record<OKRVisibility, string> = {
  [OKR_VISIBILITY.PUBLIC]: 'Public (Company-wide)',
  [OKR_VISIBILITY.TEAM]: 'Team Only',
  [OKR_VISIBILITY.PRIVATE]: 'Private',
};

// ----------------------------------------------------------------------------
// Owner Type
// ----------------------------------------------------------------------------
export const OKR_OWNER_TYPE = {
  USER: 'user',
  SUBSIDIARY: 'subsidiary',
  DEPARTMENT: 'department',
  TEAM: 'team',
} as const;

export type OKROwnerType = typeof OKR_OWNER_TYPE[keyof typeof OKR_OWNER_TYPE];

// ----------------------------------------------------------------------------
// Scoring Method
// ----------------------------------------------------------------------------
export const OKR_SCORING_METHOD = {
  AVERAGE: 'average',
  WEIGHTED: 'weighted',
} as const;

export type OKRScoringMethod = typeof OKR_SCORING_METHOD[keyof typeof OKR_SCORING_METHOD];

// ----------------------------------------------------------------------------
// Collections
// ----------------------------------------------------------------------------
export const OKR_COLLECTIONS = {
  OBJECTIVES: 'okrs',
  CYCLES: 'okrCycles',
  ALIGNMENTS: 'okrAlignments',
  CHECK_INS: 'okrCheckIns',
  SCORE_HISTORY: 'okrScoreHistory',
} as const;

// ----------------------------------------------------------------------------
// Defaults & Limits
// ----------------------------------------------------------------------------
export const OKR_DEFAULTS = {
  MAX_KEY_RESULTS_PER_OBJECTIVE: 5,
  MAX_OBJECTIVES_PER_PERSON: 5,
  MAX_MILESTONES_PER_KEY_RESULT: 10,
  MAX_BLOCKERS_PER_CHECKIN: 5,
  MAX_WINS_PER_CHECKIN: 5,
  MAX_TAGS: 10,
  DEFAULT_CHECK_IN_FREQUENCY: CHECK_IN_FREQUENCY.WEEKLY,
  STRETCH_GOAL_MULTIPLIER: 1.3,
  CONFIDENCE_UPDATE_REMINDER_DAYS: 7,
  STALE_OKR_DAYS: 14,
  MIN_KEY_RESULTS_TO_ACTIVATE: 1,
};

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------
export function getCurrentQuarter(): OKRCycle {
  const month = new Date().getMonth();
  if (month <= 2) return OKR_CYCLE.Q1;
  if (month <= 5) return OKR_CYCLE.Q2;
  if (month <= 8) return OKR_CYCLE.Q3;
  return OKR_CYCLE.Q4;
}

export function getQuarterDates(year: number, quarter: OKRCycle): { start: Date; end: Date } {
  const quarterMonths = QUARTER_MONTHS[quarter];
  if (!quarterMonths) {
    // For annual or custom, return full year
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59),
    };
  }
  return {
    start: new Date(year, quarterMonths.start, 1),
    end: new Date(year, quarterMonths.end + 1, 0, 23, 59, 59), // Last day of end month
  };
}

export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function formatProgress(progress: number): string {
  return `${Math.round(progress)}%`;
}
