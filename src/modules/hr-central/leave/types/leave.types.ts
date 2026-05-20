/**
 * Leave Management Types
 * DawinOS HR Central - Leave Module
 */

import { Timestamp } from 'firebase/firestore';
import {
  LeaveType,
  LeaveRequestStatus,
  LeavePriority,
  DayType,
  BalanceAdjustmentType,
  ApprovalLevel,
  AccrualMethod,
} from '../constants/leave.constants';

// ============================================================================
// Leave Policy Configuration
// ============================================================================

export interface LeavePolicy {
  id: string;
  subsidiaryId: string;
  name: string;
  description: string;
  leaveTypeConfigs: Record<LeaveType, LeaveTypeConfig>;
  applicableTo: {
    employmentTypes: string[];
    departments?: string[];
    jobGrades?: string[];
  };
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface LeaveTypeConfig {
  enabled: boolean;
  entitlement: {
    daysPerYear: number;
    accrualMethod: AccrualMethod;
    accrualRate: number;
    proRataForNewJoiners: boolean;
  };
  carryOver: {
    allowed: boolean;
    maxDays: number;
    expiryMonths: number;
  };
  advance: {
    allowed: boolean;
    maxDays: number;
  };
  payment: {
    paid: boolean;
    rate: number;
    halfPayDays?: number;
    halfPayRate?: number;
  };
  eligibility: {
    minServiceMonths: number;
    genderRestriction?: 'male' | 'female' | null;
    maxOccurrences?: number;
  };
  approval: {
    requiresApproval: boolean;
    minNoticeDays: number;
    documentRequired: boolean;
    documentRequiredAfterDays?: number;
  };
  restrictions: {
    maxConsecutiveDays: number;
    blackoutPeriods?: { start: string; end: string; reason: string }[];
    minGapBetweenRequests?: number;
  };
}

// ============================================================================
// Leave Request
// ============================================================================

export interface LeaveRequest {
  id: string;
  requestNumber: string;
  subsidiaryId: string;
  
  // Employee Reference
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  
  // Leave Details
  leaveType: LeaveType;
  startDate: Timestamp;
  endDate: Timestamp;
  totalWorkingDays: number;
  
  // Day Configuration
  dayConfigs: LeaveDayConfig[];
  
  // Reason and Priority
  reason: string;
  priority: LeavePriority;
  
  // Supporting Documents
  documents?: LeaveDocument[];
  
  // Delegation
  delegation?: {
    delegateToId: string;
    delegateToName: string;
    handoverNotes?: string;
  };
  
  // Emergency Contact
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Status
  status: LeaveRequestStatus;
  statusHistory: LeaveStatusHistory[];
  
  // Approval Chain
  approvalChain: {
    levels: ApprovalLevel[];
    currentLevel: number;
    approvers: LeaveApprover[];
  };
  
  // Approval Records
  approvals: LeaveApproval[];
  
  // Balance Impact
  balanceImpact: {
    daysTaken: number;
    balanceBefore: number;
    balanceAfter: number;
    carryOverUsed: number;
    advanceUsed: number;
  };
  
  // Payroll Impact
  payrollImpact?: {
    unpaidDays: number;
    halfPaidDays: number;
    deductionAmount: number;
  };
  
  // Related Requests
  relatedRequests?: string[];
  parentRequestId?: string;
  
  // Return to Work
  returnToWork?: {
    expectedDate: Timestamp;
    actualReturnDate?: Timestamp;
    fitnessCertificateRequired: boolean;
    fitnessCertificateSubmitted?: boolean;
  };
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  cancelledAt?: Timestamp;
}

export interface LeaveDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: Timestamp;
}

export interface LeaveStatusHistory {
  status: LeaveRequestStatus;
  changedAt: Timestamp;
  changedBy: string;
  changedByName: string;
  comments?: string;
}

export interface LeaveApprover {
  level: ApprovalLevel;
  approverId: string;
  approverName: string;
  sequence: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  processedAt?: Timestamp;
  comments?: string;
}

// ============================================================================
// Leave Day Configuration
// ============================================================================

export interface LeaveDayConfig {
  date: string; // YYYY-MM-DD
  dayType: DayType;
  dayValue: number;
  isWorkingDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

// ============================================================================
// Leave Approval
// ============================================================================

export interface LeaveApproval {
  id: string;
  requestId: string;
  level: ApprovalLevel;
  sequence: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  action: 'approve' | 'reject' | 'return' | 'escalate';
  comments?: string;
  isDelegated: boolean;
  delegatedFrom?: string;
  delegatedFromName?: string;
  processedAt: Timestamp;
}

// ============================================================================
// Leave Balance
// ============================================================================

export interface LeaveBalance {
  id: string;
  employeeId: string;
  employeeNumber: string;
  subsidiaryId: string;
  leaveYear: number;
  balances: LeaveTypeBalance[];
  lastAccrualDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LeaveTypeBalance {
  leaveType: LeaveType;
  
  // Entitlement
  annualEntitlement: number;
  proratedEntitlement: number;
  
  // Accrual
  accruedToDate: number;
  accrualRate: number;
  
  // Carry Over
  carriedOver: number;
  carriedOverUsed: number;
  carriedOverExpiry?: Timestamp;
  carriedOverExpired: number;
  
  // Usage
  taken: number;
  pending: number;
  scheduled: number;
  
  // Available
  available: number;
  
  // Advance
  advanceTaken: number;
  maxAdvance: number;
  
  // Encashment
  encashable: number;
  encashed: number;
  
  // Compensatory
  earned?: number;
  earnedExpiry?: Timestamp;
}

// ============================================================================
// Leave Balance History
// ============================================================================

export interface LeaveBalanceHistory {
  id: string;
  employeeId: string;
  leaveYear: number;
  leaveType: LeaveType;
  transactionType: BalanceAdjustmentType;
  transactionDate: Timestamp;
  balanceBefore: number;
  adjustment: number;
  balanceAfter: number;
  referenceType?: 'leave_request' | 'accrual' | 'carry_over' | 'manual' | 'encashment';
  referenceId?: string;
  description: string;
  accrualPeriod?: {
    month: number;
    year: number;
  };
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// Approval Delegation
// ============================================================================

export interface ApprovalDelegation {
  id: string;
  subsidiaryId: string;
  delegatorId: string;
  delegatorName: string;
  delegateId: string;
  delegateName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  scope: {
    leaveTypes?: LeaveType[];
    departments?: string[];
    maxDays?: number;
  };
  isActive: boolean;
  reason: string;
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// Team Calendar
// ============================================================================

export interface TeamCalendarEntry {
  id: string;
  subsidiaryId: string;
  departmentId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveRequestId: string;
  leaveType: LeaveType;
  date: string;
  dayType: DayType;
  status: 'pending' | 'approved';
  color: string;
}

// ============================================================================
// Public Holiday
// ============================================================================

export interface PublicHoliday {
  id: string;
  subsidiaryId: string;
  year: number;
  date: string;
  name: string;
  isNational: boolean;
  isRecurring: boolean;
  isOptional: boolean;
  applicableDepartments?: string[];
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateLeaveRequestInput {
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  priority?: LeavePriority;
  dayConfigs?: {
    date: string;
    dayType: DayType;
  }[];
  delegation?: {
    delegateToId: string;
    handoverNotes?: string;
  };
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  saveAsDraft?: boolean;
}

export interface UpdateLeaveRequestInput {
  startDate?: string;
  endDate?: string;
  reason?: string;
  priority?: LeavePriority;
  dayConfigs?: {
    date: string;
    dayType: DayType;
  }[];
  delegation?: {
    delegateToId: string;
    handoverNotes?: string;
  };
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface ProcessApprovalInput {
  requestId: string;
  action: 'approve' | 'reject' | 'return';
  comments?: string;
}

export interface AdjustBalanceInput {
  employeeId: string;
  leaveYear: number;
  leaveType: LeaveType;
  adjustmentType: BalanceAdjustmentType;
  adjustment: number;
  reason: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface LeaveBalanceFilter {
  subsidiaryId: string;
  departmentId?: string;
  employeeId?: string;
  leaveYear?: number;
  leaveType?: LeaveType;
}

export interface LeaveRequestFilter {
  subsidiaryId: string;
  departmentId?: string;
  employeeId?: string;
  status?: LeaveRequestStatus | LeaveRequestStatus[];
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  pendingApproverId?: string;
}

export interface TeamCalendarFilter {
  subsidiaryId: string;
  departmentId?: string;
  startDate: string;
  endDate: string;
  leaveTypes?: LeaveType[];
  includeApproved: boolean;
  includePending: boolean;
}

// ============================================================================
// Summary Types
// ============================================================================

export interface LeaveBalanceSummary {
  employeeId: string;
  employeeName: string;
  leaveYear: number;
  balances: {
    leaveType: LeaveType;
    entitlement: number;
    taken: number;
    pending: number;
    available: number;
  }[];
}

export interface TeamAvailability {
  date: string;
  totalEmployees: number;
  onLeave: number;
  available: number;
  employeesOnLeave: {
    id: string;
    name: string;
    leaveType: LeaveType;
  }[];
}

export interface DepartmentLeaveSummary {
  byLeaveType: Record<LeaveType, number>;
  byEmployee: {
    id: string;
    name: string;
    days: number;
  }[];
}
