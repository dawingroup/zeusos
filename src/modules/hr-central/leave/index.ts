/**
 * Leave Management Module Index
 * DawinOS HR Central - Leave Module
 * 
 * Exports all leave types, constants, services, utilities, and hooks.
 */

// ============================================================================
// Constants
// ============================================================================

export {
  LEAVE_TYPES,
  ACCRUAL_METHODS,
  STATUTORY_LEAVE_ENTITLEMENTS,
  COMPANY_LEAVE_ENTITLEMENTS,
  LEAVE_REQUEST_STATUS,
  VALID_LEAVE_STATUS_TRANSITIONS,
  LEAVE_PRIORITY,
  DAY_TYPES,
  BALANCE_ADJUSTMENT_TYPES,
  APPROVAL_LEVELS,
  LEAVE_APPROVAL_MATRIX,
  UGANDA_PUBLIC_HOLIDAYS_RECURRING,
  WORKING_DAYS_CONFIG,
  LEAVE_YEAR_CONFIG,
  LEAVE_COLLECTIONS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
} from './constants/leave.constants';

export type {
  LeaveType,
  AccrualMethod,
  LeaveRequestStatus,
  LeavePriority,
  DayType,
  BalanceAdjustmentType,
  ApprovalLevel,
} from './constants/leave.constants';

// ============================================================================
// Types
// ============================================================================

export type {
  LeavePolicy,
  LeaveTypeConfig,
  LeaveRequest,
  LeaveDocument,
  LeaveStatusHistory,
  LeaveApprover,
  LeaveDayConfig,
  LeaveApproval,
  LeaveBalance,
  LeaveTypeBalance,
  LeaveBalanceHistory,
  ApprovalDelegation,
  TeamCalendarEntry,
  PublicHoliday,
  CreateLeaveRequestInput,
  UpdateLeaveRequestInput,
  ProcessApprovalInput,
  AdjustBalanceInput,
  LeaveBalanceFilter,
  LeaveRequestFilter,
  TeamCalendarFilter,
  LeaveBalanceSummary,
  TeamAvailability,
  DepartmentLeaveSummary,
} from './types/leave.types';

// ============================================================================
// Schemas
// ============================================================================

export {
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  processApprovalSchema,
  adjustBalanceSchema,
  leaveRequestFilterSchema,
  teamCalendarFilterSchema,
  createPublicHolidaySchema,
  createDelegationSchema,
  validateCreateLeaveRequest,
  validateUpdateLeaveRequest,
  validateProcessApproval,
  validateAdjustBalance,
  validateLeaveRequestFilter,
  validateTeamCalendarFilter,
  validateCreatePublicHoliday,
  validateCreateDelegation,
} from './schemas/leave.schemas';

// ============================================================================
// Utility Functions
// ============================================================================

export {
  getLeaveEntitlementConfig,
  calculateWorkingDays,
  generateLeaveDayConfigs,
  calculateTotalLeaveDays,
  formatDateString,
  parseDateString,
  formatLeavePeriod,
  getCurrentLeaveYear,
  getLeaveYearDates,
  calculateProratedEntitlement,
  calculateMonthlyAccrual,
  calculateServiceMonths,
  calculateServiceYears,
  checkLeaveEligibility,
  getApprovalChain,
  checkDateOverlap,
  validateNoticePeriod,
  generateLeaveRequestNumber,
  getLeaveTypeLabel,
  getLeaveTypeColor,
  isWorkingDay,
  getNextWorkingDay,
  calculateAvailableBalance,
  canCancelLeave,
  generateRecurringHolidaysForYear,
} from './utils/leave.utils';

// ============================================================================
// Leave Balance Service
// ============================================================================

export {
  initializeLeaveBalance,
  getLeaveBalance,
  getLeaveTypeBalance,
  checkSufficientBalance,
  reserveBalance,
  releaseReservedBalance,
  confirmLeaveTaken,
  adjustBalance,
  processMonthlyAccrual,
  processCarryOver,
  processCarryOverExpiry,
  getBalanceHistory,
  getSubsidiaryBalances,
} from './services/leave-balance.service';

// ============================================================================
// Leave Request Service
// ============================================================================

export {
  createLeaveRequest,
  submitLeaveRequest,
  processLeaveApproval,
  cancelLeaveRequest,
  withdrawLeaveRequest,
  getLeaveRequest,
  getEmployeeLeaves,
  getPendingApprovals,
  getLeaveRequests,
} from './services/leave-request.service';

// ============================================================================
// Team Calendar Service
// ============================================================================

export {
  updateCalendarFromRequest,
  deleteEntriesForRequest,
  getCalendarEntries,
  getTeamAvailability,
  getDepartmentLeaveSummary,
  getPublicHolidays,
  addPublicHoliday,
  deletePublicHoliday,
  initializeUgandaHolidays,
  getEmployeeCalendar,
  checkTeamConflicts,
} from './services/team-calendar.service';

// ============================================================================
// React Hooks
// ============================================================================

export {
  useLeaveRequests,
  useLeaveRequest,
  useLeaveApprovals,
  useLeaveBalance,
  useTeamCalendar,
  useTeamAvailability,
  useMyLeaves,
  usePublicHolidays,
  useBalanceHistory,
} from './hooks/useLeave';
