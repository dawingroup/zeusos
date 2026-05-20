/**
 * Leave Management Utility Functions
 * DawinOS HR Central - Leave Module
 */

import {
  LeaveType,
  LEAVE_TYPES,
  STATUTORY_LEAVE_ENTITLEMENTS,
  COMPANY_LEAVE_ENTITLEMENTS,
  WORKING_DAYS_CONFIG,
  LEAVE_YEAR_CONFIG,
  LEAVE_APPROVAL_MATRIX,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  ApprovalLevel,
  DayType,
  DAY_TYPES,
} from '../constants/leave.constants';
import { LeaveDayConfig, PublicHoliday } from '../types/leave.types';

// ============================================================================
// Leave Entitlement Configuration
// ============================================================================

export function getLeaveEntitlementConfig(leaveType: LeaveType) {
  if (leaveType in STATUTORY_LEAVE_ENTITLEMENTS) {
    return STATUTORY_LEAVE_ENTITLEMENTS[leaveType as keyof typeof STATUTORY_LEAVE_ENTITLEMENTS];
  }
  if (leaveType in COMPANY_LEAVE_ENTITLEMENTS) {
    return COMPANY_LEAVE_ENTITLEMENTS[leaveType as keyof typeof COMPANY_LEAVE_ENTITLEMENTS];
  }
  throw new Error(`Unknown leave type: ${leaveType}`);
}

// ============================================================================
// Working Days Calculation
// ============================================================================

export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  holidays: PublicHoliday[],
  dayConfigs?: { date: string; dayType: DayType }[]
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workingDays = 0;
  
  const holidayDates = new Set(holidays.map(h => h.date));
  const dayConfigMap = new Map(dayConfigs?.map(dc => [dc.date, dc.dayType]));
  
  const current = new Date(start);
  while (current <= end) {
    const dateStr = formatDateString(current);
    const dayOfWeek = current.getDay();
    
    if (
      WORKING_DAYS_CONFIG.workingDays.includes(dayOfWeek) &&
      !holidayDates.has(dateStr)
    ) {
      const dayType = dayConfigMap.get(dateStr) || DAY_TYPES.FULL_DAY;
      workingDays += dayType === DAY_TYPES.FULL_DAY ? 1 : 0.5;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

export function generateLeaveDayConfigs(
  startDate: string,
  endDate: string,
  holidays: PublicHoliday[],
  customDayConfigs?: { date: string; dayType: DayType }[]
): LeaveDayConfig[] {
  const configs: LeaveDayConfig[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const holidayMap = new Map(holidays.map(h => [h.date, h.name]));
  const customConfigMap = new Map(customDayConfigs?.map(dc => [dc.date, dc.dayType]));
  
  const current = new Date(start);
  while (current <= end) {
    const dateStr = formatDateString(current);
    const dayOfWeek = current.getDay();
    const isWorkingDay = WORKING_DAYS_CONFIG.workingDays.includes(dayOfWeek);
    const isHoliday = holidayMap.has(dateStr);
    const holidayName = holidayMap.get(dateStr);
    
    const dayType = customConfigMap.get(dateStr) || DAY_TYPES.FULL_DAY;
    const dayValue = dayType === DAY_TYPES.FULL_DAY ? 1.0 : 0.5;
    
    configs.push({
      date: dateStr,
      dayType,
      dayValue: isWorkingDay && !isHoliday ? dayValue : 0,
      isWorkingDay,
      isHoliday,
      holidayName,
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  return configs;
}

export function calculateTotalLeaveDays(dayConfigs: LeaveDayConfig[]): number {
  return dayConfigs.reduce((total, config) => {
    if (config.isWorkingDay && !config.isHoliday) {
      return total + config.dayValue;
    }
    return total;
  }, 0);
}

// ============================================================================
// Date Formatting
// ============================================================================

export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLeavePeriod(startDate: Date, endDate: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  
  const start = startDate.toLocaleDateString('en-UG', options);
  const end = endDate.toLocaleDateString('en-UG', options);
  
  if (start === end) {
    return start;
  }
  
  return `${start} - ${end}`;
}

// ============================================================================
// Leave Year Functions
// ============================================================================

export function getCurrentLeaveYear(): number {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  
  if (LEAVE_YEAR_CONFIG.type === 'calendar') {
    return now.getFullYear();
  }
  
  if (currentMonth >= LEAVE_YEAR_CONFIG.startMonth) {
    return now.getFullYear();
  }
  return now.getFullYear() - 1;
}

export function getLeaveYearDates(year: number): { start: Date; end: Date } {
  if (LEAVE_YEAR_CONFIG.type === 'calendar') {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
    };
  }
  
  const startMonth = LEAVE_YEAR_CONFIG.startMonth - 1;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year + 1, startMonth, 0),
  };
}

// ============================================================================
// Entitlement Calculations
// ============================================================================

export function calculateProratedEntitlement(
  annualEntitlement: number,
  joiningDate: Date,
  leaveYear: number
): number {
  const { start, end } = getLeaveYearDates(leaveYear);
  
  if (joiningDate <= start) {
    return annualEntitlement;
  }
  
  if (joiningDate > end) {
    return 0;
  }
  
  const totalMonths = 12;
  const monthsRemaining = 12 - joiningDate.getMonth();
  
  const prorated = (annualEntitlement / totalMonths) * monthsRemaining;
  return Math.round(prorated * 2) / 2;
}

export function calculateMonthlyAccrual(
  annualEntitlement: number,
  accrualMethod: string
): number {
  switch (accrualMethod) {
    case 'monthly':
      return annualEntitlement / 12;
    case 'quarterly':
      return annualEntitlement / 4;
    default:
      return 0;
  }
}

// ============================================================================
// Service Calculation
// ============================================================================

export function calculateServiceMonths(joiningDate: Date): number {
  const now = new Date();
  const years = now.getFullYear() - joiningDate.getFullYear();
  const months = now.getMonth() - joiningDate.getMonth();
  return years * 12 + months;
}

export function calculateServiceYears(joiningDate: Date): number {
  const months = calculateServiceMonths(joiningDate);
  return Math.floor(months / 12);
}

// ============================================================================
// Eligibility Check
// ============================================================================

export function checkLeaveEligibility(
  leaveType: LeaveType,
  employeeData: {
    gender: 'male' | 'female';
    joiningDate: Date;
    employmentType: string;
  }
): { eligible: boolean; reason?: string } {
  const config = getLeaveEntitlementConfig(leaveType);
  
  const serviceMonths = calculateServiceMonths(employeeData.joiningDate);
  if (serviceMonths < config.minServiceMonths) {
    return {
      eligible: false,
      reason: `Minimum ${config.minServiceMonths} months service required. Current service: ${serviceMonths} months.`,
    };
  }
  
  if (config.genderRestriction && config.genderRestriction !== employeeData.gender) {
    return {
      eligible: false,
      reason: `${LEAVE_TYPE_LABELS[leaveType]} is only available for ${config.genderRestriction} employees.`,
    };
  }
  
  if (
    leaveType === LEAVE_TYPES.SABBATICAL &&
    employeeData.employmentType !== 'permanent'
  ) {
    return {
      eligible: false,
      reason: 'Sabbatical leave is only available for permanent employees.',
    };
  }
  
  return { eligible: true };
}

// ============================================================================
// Approval Chain
// ============================================================================

export function getApprovalChain(
  leaveType: LeaveType,
  days: number,
  _employeeHierarchy: {
    supervisorId?: string;
    departmentHeadId?: string;
    hrManagerId?: string;
    generalManagerId?: string;
    ceoId?: string;
  }
): ApprovalLevel[] {
  const matrix = LEAVE_APPROVAL_MATRIX[leaveType];
  
  if (!matrix) {
    return [];
  }
  
  if (matrix.durationThresholds) {
    for (const threshold of matrix.durationThresholds) {
      if (days <= threshold.days) {
        return threshold.levels;
      }
    }
    return matrix.durationThresholds[matrix.durationThresholds.length - 1].levels;
  }
  
  return matrix.levels;
}

// ============================================================================
// Validation
// ============================================================================

export function checkDateOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  
  return s1 <= e2 && e1 >= s2;
}

export function validateNoticePeriod(
  startDate: string,
  minNoticeDays: number,
  isEmergency: boolean
): { valid: boolean; message?: string } {
  if (isEmergency || minNoticeDays === 0) {
    return { valid: true };
  }
  
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < minNoticeDays) {
    return {
      valid: false,
      message: `Minimum ${minNoticeDays} days notice required. Only ${diffDays} days notice provided.`,
    };
  }
  
  return { valid: true };
}

// ============================================================================
// Generators
// ============================================================================

export function generateLeaveRequestNumber(
  employeeNumber: string,
  date: Date,
  sequence: number
): string {
  const dateStr = formatDateString(date).replace(/-/g, '');
  const seq = String(sequence).padStart(3, '0');
  return `LR-${employeeNumber}-${dateStr}-${seq}`;
}

// ============================================================================
// UI Helpers
// ============================================================================

export function getLeaveTypeLabel(leaveType: LeaveType): string {
  return LEAVE_TYPE_LABELS[leaveType] || leaveType;
}

export function getLeaveTypeColor(leaveType: LeaveType): string {
  return LEAVE_TYPE_COLORS[leaveType] || '#9E9E9E';
}

// ============================================================================
// Working Day Helpers
// ============================================================================

export function isWorkingDay(date: Date, holidays: PublicHoliday[]): boolean {
  const dayOfWeek = date.getDay();
  const dateStr = formatDateString(date);
  
  if (!WORKING_DAYS_CONFIG.workingDays.includes(dayOfWeek)) {
    return false;
  }
  
  return !holidays.some(h => h.date === dateStr);
}

export function getNextWorkingDay(date: Date, holidays: PublicHoliday[]): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);
  
  while (!isWorkingDay(result, holidays)) {
    result.setDate(result.getDate() + 1);
  }
  
  return result;
}

// ============================================================================
// Balance Calculations
// ============================================================================

export function calculateAvailableBalance(
  accrued: number,
  carriedOver: number,
  taken: number,
  pending: number,
  advanceTaken: number
): number {
  return accrued + carriedOver - taken - pending - advanceTaken;
}

// ============================================================================
// Cancellation Validation
// ============================================================================

export function canCancelLeave(
  status: string,
  startDate: Date,
  requesterId: string,
  currentUserId: string,
  isHR: boolean
): { canCancel: boolean; reason?: string } {
  if (!['pending_approval', 'pending_hr_review', 'approved'].includes(status)) {
    return { canCancel: false, reason: 'Only pending or approved leaves can be cancelled.' };
  }
  
  const now = new Date();
  if (startDate <= now && status === 'approved') {
    return { canCancel: false, reason: 'Cannot cancel leave that has already started.' };
  }
  
  if (requesterId !== currentUserId && !isHR) {
    return { canCancel: false, reason: 'Only the requester or HR can cancel this leave.' };
  }
  
  return { canCancel: true };
}

// ============================================================================
// Holiday Generation
// ============================================================================

export function generateRecurringHolidaysForYear(
  year: number,
  recurringHolidays: { month: number; day: number; name: string }[]
): { date: string; name: string }[] {
  return recurringHolidays.map(h => ({
    date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
    name: h.name,
  }));
}
