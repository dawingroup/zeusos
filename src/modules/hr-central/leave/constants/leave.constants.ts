/**
 * Leave Management Constants
 * DawinOS HR Central - Leave Module
 * 
 * Based on Uganda Employment Act 2006 and company policies
 */

// ============================================================================
// Leave Types
// ============================================================================

export const LEAVE_TYPES = {
  // Statutory Leave (Uganda Employment Act 2006)
  ANNUAL: 'annual',
  SICK: 'sick',
  MATERNITY: 'maternity',
  PATERNITY: 'paternity',
  
  // Company Policy Leave
  COMPASSIONATE: 'compassionate',
  STUDY: 'study',
  UNPAID: 'unpaid',
  COMPENSATORY: 'compensatory',
  PUBLIC_DUTY: 'public_duty',
  MARRIAGE: 'marriage',
  SABBATICAL: 'sabbatical',
} as const;

export type LeaveType = typeof LEAVE_TYPES[keyof typeof LEAVE_TYPES];

// ============================================================================
// Accrual Methods
// ============================================================================

export const ACCRUAL_METHODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUAL: 'annual',
  ENTITLEMENT: 'entitlement',
  EARNED: 'earned',
  SERVICE_BASED: 'service_based',
  NONE: 'none',
} as const;

export type AccrualMethod = typeof ACCRUAL_METHODS[keyof typeof ACCRUAL_METHODS];

// ============================================================================
// Statutory Leave Entitlements (Uganda Employment Act 2006)
// ============================================================================

export const STATUTORY_LEAVE_ENTITLEMENTS = {
  [LEAVE_TYPES.ANNUAL]: {
    daysPerYear: 21,
    accrualMethod: ACCRUAL_METHODS.MONTHLY,
    accrualRate: 1.75, // 21/12 = 1.75 days per month
    minServiceMonths: 4,
    carryOverAllowed: true,
    maxCarryOverDays: 10,
    carryOverExpiryMonths: 6,
    minNoticeDays: 14,
    documentRequired: false,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 21,
    genderRestriction: null as 'male' | 'female' | null,
  },
  [LEAVE_TYPES.SICK]: {
    daysPerYear: 30,
    halfPayDays: 22,
    accrualMethod: ACCRUAL_METHODS.ENTITLEMENT,
    accrualRate: 0,
    minServiceMonths: 0,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 0,
    documentRequired: true,
    documentRequiredAfterDays: 2,
    paymentRate: 1.0,
    halfPayRate: 0.5,
    maxConsecutiveDays: 44,
    genderRestriction: null as 'male' | 'female' | null,
  },
  [LEAVE_TYPES.MATERNITY]: {
    daysPerYear: 60,
    accrualMethod: ACCRUAL_METHODS.ENTITLEMENT,
    accrualRate: 0,
    minServiceMonths: 6,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 30,
    documentRequired: true,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 60,
    genderRestriction: 'female' as 'male' | 'female' | null,
    preDeliveryMinDays: 14,
    postDeliveryMandatoryDays: 42,
    nursingBreakMinutes: 60,
    nursingBreakMonths: 6,
  },
  [LEAVE_TYPES.PATERNITY]: {
    daysPerYear: 4,
    accrualMethod: ACCRUAL_METHODS.ENTITLEMENT,
    accrualRate: 0,
    minServiceMonths: 1,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 0,
    documentRequired: true,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 4,
    genderRestriction: 'male' as 'male' | 'female' | null,
    mustUsedWithinDays: 14,
  },
} as const;

// ============================================================================
// Company Policy Leave Entitlements
// ============================================================================

export const COMPANY_LEAVE_ENTITLEMENTS = {
  [LEAVE_TYPES.COMPASSIONATE]: {
    daysPerYear: 5,
    accrualMethod: ACCRUAL_METHODS.ENTITLEMENT,
    accrualRate: 0,
    minServiceMonths: 0,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 0,
    documentRequired: true,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 5,
    genderRestriction: null as 'male' | 'female' | null,
    applicableReasons: ['death', 'critical_illness'],
    applicableFamilyMembers: ['spouse', 'child', 'parent', 'sibling'],
  },
  [LEAVE_TYPES.STUDY]: {
    daysPerYear: 10,
    accrualMethod: ACCRUAL_METHODS.ENTITLEMENT,
    accrualRate: 0,
    minServiceMonths: 12,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 30,
    documentRequired: true,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 10,
    genderRestriction: null as 'male' | 'female' | null,
  },
  [LEAVE_TYPES.UNPAID]: {
    daysPerYear: 30,
    accrualMethod: ACCRUAL_METHODS.NONE,
    accrualRate: 0,
    minServiceMonths: 0,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 14,
    documentRequired: false,
    paymentRate: 0,
    halfPayDays: 0,
    maxConsecutiveDays: 30,
    genderRestriction: null as 'male' | 'female' | null,
    affectsServiceCalculation: true,
  },
  [LEAVE_TYPES.COMPENSATORY]: {
    daysPerYear: 10,
    accrualMethod: ACCRUAL_METHODS.EARNED,
    accrualRate: 0,
    minServiceMonths: 0,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 3,
    documentRequired: false,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 5,
    genderRestriction: null as 'male' | 'female' | null,
    expiryMonths: 3,
    overtimeHoursPerDay: 8,
  },
  [LEAVE_TYPES.PUBLIC_DUTY]: {
    daysPerYear: 10,
    accrualMethod: ACCRUAL_METHODS.ENTITLEMENT,
    accrualRate: 0,
    minServiceMonths: 0,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 0,
    documentRequired: true,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 10,
    genderRestriction: null as 'male' | 'female' | null,
    applicableDuties: ['jury_duty', 'election_duty', 'military_reserve'],
  },
  [LEAVE_TYPES.MARRIAGE]: {
    daysPerYear: 3,
    accrualMethod: ACCRUAL_METHODS.NONE,
    accrualRate: 0,
    minServiceMonths: 0,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 30,
    documentRequired: true,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 3,
    genderRestriction: null as 'male' | 'female' | null,
    maxOccurrences: 1,
  },
  [LEAVE_TYPES.SABBATICAL]: {
    daysPerYear: 20,
    accrualMethod: ACCRUAL_METHODS.SERVICE_BASED,
    accrualRate: 0,
    minServiceMonths: 84,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    carryOverExpiryMonths: 0,
    minNoticeDays: 180,
    documentRequired: false,
    paymentRate: 1.0,
    halfPayDays: 0,
    maxConsecutiveDays: 20,
    genderRestriction: null as 'male' | 'female' | null,
    frequencyYears: 7,
  },
} as const;

// ============================================================================
// Leave Request Status
// ============================================================================

export const LEAVE_REQUEST_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  PENDING_HR_REVIEW: 'pending_hr_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  WITHDRAWN: 'withdrawn',
} as const;

export type LeaveRequestStatus = typeof LEAVE_REQUEST_STATUS[keyof typeof LEAVE_REQUEST_STATUS];

// Valid status transitions
export const VALID_LEAVE_STATUS_TRANSITIONS: Record<LeaveRequestStatus, LeaveRequestStatus[]> = {
  [LEAVE_REQUEST_STATUS.DRAFT]: [
    LEAVE_REQUEST_STATUS.PENDING_APPROVAL,
    LEAVE_REQUEST_STATUS.WITHDRAWN,
  ],
  [LEAVE_REQUEST_STATUS.PENDING_APPROVAL]: [
    LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW,
    LEAVE_REQUEST_STATUS.APPROVED,
    LEAVE_REQUEST_STATUS.REJECTED,
    LEAVE_REQUEST_STATUS.CANCELLED,
  ],
  [LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW]: [
    LEAVE_REQUEST_STATUS.APPROVED,
    LEAVE_REQUEST_STATUS.REJECTED,
    LEAVE_REQUEST_STATUS.CANCELLED,
  ],
  [LEAVE_REQUEST_STATUS.APPROVED]: [
    LEAVE_REQUEST_STATUS.CANCELLED,
  ],
  [LEAVE_REQUEST_STATUS.REJECTED]: [],
  [LEAVE_REQUEST_STATUS.CANCELLED]: [],
  [LEAVE_REQUEST_STATUS.WITHDRAWN]: [],
};

// ============================================================================
// Leave Priority
// ============================================================================

export const LEAVE_PRIORITY = {
  NORMAL: 'normal',
  URGENT: 'urgent',
  EMERGENCY: 'emergency',
} as const;

export type LeavePriority = typeof LEAVE_PRIORITY[keyof typeof LEAVE_PRIORITY];

// ============================================================================
// Day Types
// ============================================================================

export const DAY_TYPES = {
  FULL_DAY: 'full_day',
  HALF_DAY_AM: 'half_day_am',
  HALF_DAY_PM: 'half_day_pm',
} as const;

export type DayType = typeof DAY_TYPES[keyof typeof DAY_TYPES];

// ============================================================================
// Balance Adjustment Types
// ============================================================================

export const BALANCE_ADJUSTMENT_TYPES = {
  ACCRUAL: 'accrual',
  MANUAL_CREDIT: 'manual_credit',
  MANUAL_DEBIT: 'manual_debit',
  CARRY_OVER: 'carry_over',
  EXPIRY: 'expiry',
  ENCASHMENT: 'encashment',
  COMPENSATORY_EARNED: 'compensatory_earned',
  CORRECTION: 'correction',
  LEAVE_TAKEN: 'leave_taken',
  LEAVE_CANCELLED: 'leave_cancelled',
} as const;

export type BalanceAdjustmentType = typeof BALANCE_ADJUSTMENT_TYPES[keyof typeof BALANCE_ADJUSTMENT_TYPES];

// ============================================================================
// Approval Levels
// ============================================================================

export const APPROVAL_LEVELS = {
  SUPERVISOR: 'supervisor',
  DEPARTMENT_HEAD: 'department_head',
  HR_MANAGER: 'hr_manager',
  GENERAL_MANAGER: 'general_manager',
  CEO: 'ceo',
} as const;

export type ApprovalLevel = typeof APPROVAL_LEVELS[keyof typeof APPROVAL_LEVELS];

// ============================================================================
// Approval Matrix
// ============================================================================

export const LEAVE_APPROVAL_MATRIX: Record<LeaveType, {
  levels: ApprovalLevel[];
  durationThresholds?: { days: number; levels: ApprovalLevel[] }[];
}> = {
  [LEAVE_TYPES.ANNUAL]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR],
    durationThresholds: [
      { days: 5, levels: [APPROVAL_LEVELS.SUPERVISOR] },
      { days: 10, levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.DEPARTMENT_HEAD] },
      { days: 21, levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.DEPARTMENT_HEAD, APPROVAL_LEVELS.HR_MANAGER] },
    ],
  },
  [LEAVE_TYPES.SICK]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR],
    durationThresholds: [
      { days: 5, levels: [APPROVAL_LEVELS.SUPERVISOR] },
      { days: 10, levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.HR_MANAGER] },
      { days: 30, levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.HR_MANAGER, APPROVAL_LEVELS.GENERAL_MANAGER] },
    ],
  },
  [LEAVE_TYPES.MATERNITY]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.HR_MANAGER],
  },
  [LEAVE_TYPES.PATERNITY]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR],
  },
  [LEAVE_TYPES.COMPASSIONATE]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR],
  },
  [LEAVE_TYPES.STUDY]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.DEPARTMENT_HEAD, APPROVAL_LEVELS.HR_MANAGER],
  },
  [LEAVE_TYPES.UNPAID]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.DEPARTMENT_HEAD, APPROVAL_LEVELS.HR_MANAGER, APPROVAL_LEVELS.GENERAL_MANAGER],
  },
  [LEAVE_TYPES.COMPENSATORY]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR],
  },
  [LEAVE_TYPES.PUBLIC_DUTY]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.HR_MANAGER],
  },
  [LEAVE_TYPES.MARRIAGE]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.HR_MANAGER],
  },
  [LEAVE_TYPES.SABBATICAL]: {
    levels: [APPROVAL_LEVELS.SUPERVISOR, APPROVAL_LEVELS.DEPARTMENT_HEAD, APPROVAL_LEVELS.HR_MANAGER, APPROVAL_LEVELS.CEO],
  },
};

// ============================================================================
// Uganda Public Holidays
// ============================================================================

export const UGANDA_PUBLIC_HOLIDAYS_RECURRING = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 1, day: 26, name: 'NRM Liberation Day' },
  { month: 2, day: 16, name: "Archbishop Janani Luwum Day" },
  { month: 3, day: 8, name: "International Women's Day" },
  { month: 5, day: 1, name: 'Labour Day' },
  { month: 6, day: 3, name: 'Martyrs Day' },
  { month: 6, day: 9, name: "National Heroes Day" },
  { month: 10, day: 9, name: 'Independence Day' },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 26, name: 'Boxing Day' },
];

// ============================================================================
// Working Days Configuration
// ============================================================================

export const WORKING_DAYS_CONFIG = {
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday (0 = Sunday)
  workingHoursStart: 8,
  workingHoursEnd: 17,
  hoursPerDay: 8,
  lunchBreakMinutes: 60,
};

// ============================================================================
// Leave Year Configuration
// ============================================================================

export const LEAVE_YEAR_CONFIG = {
  type: 'calendar' as 'calendar' | 'fiscal',
  startMonth: 1,
  carryOverProcessingMonth: 1,
};

// ============================================================================
// Firestore Collections
// ============================================================================

export const LEAVE_COLLECTIONS = {
  LEAVE_REQUESTS: 'leave_requests',
  LEAVE_BALANCES: 'leave_balances',
  LEAVE_BALANCE_HISTORY: 'leave_balance_history',
  LEAVE_POLICIES: 'leave_policies',
  LEAVE_APPROVALS: 'leave_approvals',
  LEAVE_DELEGATION: 'leave_delegation',
  TEAM_CALENDAR: 'team_calendar',
  PUBLIC_HOLIDAYS: 'public_holidays',
} as const;

// ============================================================================
// UI Labels and Colors
// ============================================================================

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  [LEAVE_TYPES.ANNUAL]: 'Annual Leave',
  [LEAVE_TYPES.SICK]: 'Sick Leave',
  [LEAVE_TYPES.MATERNITY]: 'Maternity Leave',
  [LEAVE_TYPES.PATERNITY]: 'Paternity Leave',
  [LEAVE_TYPES.COMPASSIONATE]: 'Compassionate Leave',
  [LEAVE_TYPES.STUDY]: 'Study Leave',
  [LEAVE_TYPES.UNPAID]: 'Unpaid Leave',
  [LEAVE_TYPES.COMPENSATORY]: 'Compensatory Leave',
  [LEAVE_TYPES.PUBLIC_DUTY]: 'Public Duty Leave',
  [LEAVE_TYPES.MARRIAGE]: 'Marriage Leave',
  [LEAVE_TYPES.SABBATICAL]: 'Sabbatical Leave',
};

export const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  [LEAVE_TYPES.ANNUAL]: '#4CAF50',
  [LEAVE_TYPES.SICK]: '#F44336',
  [LEAVE_TYPES.MATERNITY]: '#E91E63',
  [LEAVE_TYPES.PATERNITY]: '#2196F3',
  [LEAVE_TYPES.COMPASSIONATE]: '#9C27B0',
  [LEAVE_TYPES.STUDY]: '#FF9800',
  [LEAVE_TYPES.UNPAID]: '#607D8B',
  [LEAVE_TYPES.COMPENSATORY]: '#00BCD4',
  [LEAVE_TYPES.PUBLIC_DUTY]: '#795548',
  [LEAVE_TYPES.MARRIAGE]: '#FFEB3B',
  [LEAVE_TYPES.SABBATICAL]: '#673AB7',
};

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  [LEAVE_REQUEST_STATUS.DRAFT]: 'Draft',
  [LEAVE_REQUEST_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW]: 'Pending HR Review',
  [LEAVE_REQUEST_STATUS.APPROVED]: 'Approved',
  [LEAVE_REQUEST_STATUS.REJECTED]: 'Rejected',
  [LEAVE_REQUEST_STATUS.CANCELLED]: 'Cancelled',
  [LEAVE_REQUEST_STATUS.WITHDRAWN]: 'Withdrawn',
};

export const LEAVE_STATUS_COLORS: Record<LeaveRequestStatus, string> = {
  [LEAVE_REQUEST_STATUS.DRAFT]: 'gray',
  [LEAVE_REQUEST_STATUS.PENDING_APPROVAL]: 'orange',
  [LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW]: 'yellow',
  [LEAVE_REQUEST_STATUS.APPROVED]: 'green',
  [LEAVE_REQUEST_STATUS.REJECTED]: 'red',
  [LEAVE_REQUEST_STATUS.CANCELLED]: 'gray',
  [LEAVE_REQUEST_STATUS.WITHDRAWN]: 'gray',
};
