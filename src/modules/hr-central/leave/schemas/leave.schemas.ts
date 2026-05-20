/**
 * Leave Management Validation Schemas
 * DawinOS HR Central - Leave Module
 */

import { z } from 'zod';
import {
  LEAVE_TYPES,
  LEAVE_PRIORITY,
  DAY_TYPES,
  BALANCE_ADJUSTMENT_TYPES,
} from '../constants/leave.constants';

// ============================================================================
// Create Leave Request Schema
// ============================================================================

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  leaveType: z.enum([
    LEAVE_TYPES.ANNUAL,
    LEAVE_TYPES.SICK,
    LEAVE_TYPES.MATERNITY,
    LEAVE_TYPES.PATERNITY,
    LEAVE_TYPES.COMPASSIONATE,
    LEAVE_TYPES.STUDY,
    LEAVE_TYPES.UNPAID,
    LEAVE_TYPES.COMPENSATORY,
    LEAVE_TYPES.PUBLIC_DUTY,
    LEAVE_TYPES.MARRIAGE,
    LEAVE_TYPES.SABBATICAL,
  ], { message: 'Invalid leave type' }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  priority: z.enum([
    LEAVE_PRIORITY.NORMAL,
    LEAVE_PRIORITY.URGENT,
    LEAVE_PRIORITY.EMERGENCY,
  ]).optional().default(LEAVE_PRIORITY.NORMAL),
  dayConfigs: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dayType: z.enum([DAY_TYPES.FULL_DAY, DAY_TYPES.HALF_DAY_AM, DAY_TYPES.HALF_DAY_PM]),
  })).optional(),
  delegation: z.object({
    delegateToId: z.string().min(1),
    handoverNotes: z.string().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    relationship: z.string().min(1),
  }).optional(),
  saveAsDraft: z.boolean().optional().default(false),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

// ============================================================================
// Update Leave Request Schema
// ============================================================================

export const updateLeaveRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().min(10).optional(),
  priority: z.enum([
    LEAVE_PRIORITY.NORMAL,
    LEAVE_PRIORITY.URGENT,
    LEAVE_PRIORITY.EMERGENCY,
  ]).optional(),
  dayConfigs: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dayType: z.enum([DAY_TYPES.FULL_DAY, DAY_TYPES.HALF_DAY_AM, DAY_TYPES.HALF_DAY_PM]),
  })).optional(),
  delegation: z.object({
    delegateToId: z.string().min(1),
    handoverNotes: z.string().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    relationship: z.string().min(1),
  }).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

// ============================================================================
// Process Approval Schema
// ============================================================================

export const processApprovalSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  action: z.enum(['approve', 'reject', 'return'], { message: 'Action must be approve, reject, or return' }),
  comments: z.string().optional(),
}).refine(
  (data) => {
    if (data.action === 'reject' || data.action === 'return') {
      return data.comments && data.comments.length >= 10;
    }
    return true;
  },
  { message: 'Comments are required for rejection or return (minimum 10 characters)', path: ['comments'] }
);

// ============================================================================
// Adjust Balance Schema
// ============================================================================

export const adjustBalanceSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  leaveYear: z.number().int().min(2020).max(2100),
  leaveType: z.enum([
    LEAVE_TYPES.ANNUAL,
    LEAVE_TYPES.SICK,
    LEAVE_TYPES.MATERNITY,
    LEAVE_TYPES.PATERNITY,
    LEAVE_TYPES.COMPASSIONATE,
    LEAVE_TYPES.STUDY,
    LEAVE_TYPES.UNPAID,
    LEAVE_TYPES.COMPENSATORY,
    LEAVE_TYPES.PUBLIC_DUTY,
    LEAVE_TYPES.MARRIAGE,
    LEAVE_TYPES.SABBATICAL,
  ]),
  adjustmentType: z.enum([
    BALANCE_ADJUSTMENT_TYPES.MANUAL_CREDIT,
    BALANCE_ADJUSTMENT_TYPES.MANUAL_DEBIT,
    BALANCE_ADJUSTMENT_TYPES.CORRECTION,
    BALANCE_ADJUSTMENT_TYPES.ENCASHMENT,
    BALANCE_ADJUSTMENT_TYPES.COMPENSATORY_EARNED,
  ]),
  adjustment: z.number().refine((val) => val !== 0, 'Adjustment cannot be zero'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

// ============================================================================
// Leave Request Filter Schema
// ============================================================================

export const leaveRequestFilterSchema = z.object({
  subsidiaryId: z.string().min(1),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
  status: z.union([
    z.string(),
    z.array(z.string()),
  ]).optional(),
  leaveType: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pendingApproverId: z.string().optional(),
});

// ============================================================================
// Team Calendar Filter Schema
// ============================================================================

export const teamCalendarFilterSchema = z.object({
  subsidiaryId: z.string().min(1),
  departmentId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leaveTypes: z.array(z.string()).optional(),
  includeApproved: z.boolean().default(true),
  includePending: z.boolean().default(true),
});

// ============================================================================
// Public Holiday Schema
// ============================================================================

export const createPublicHolidaySchema = z.object({
  subsidiaryId: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1),
  isNational: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  isOptional: z.boolean().default(false),
  applicableDepartments: z.array(z.string()).optional(),
});

// ============================================================================
// Approval Delegation Schema
// ============================================================================

export const createDelegationSchema = z.object({
  subsidiaryId: z.string().min(1),
  delegatorId: z.string().min(1),
  delegateId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.object({
    leaveTypes: z.array(z.string()).optional(),
    departments: z.array(z.string()).optional(),
    maxDays: z.number().int().positive().optional(),
  }).optional(),
  reason: z.string().min(10),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

// ============================================================================
// Validation Functions
// ============================================================================

export function validateCreateLeaveRequest(data: unknown) {
  return createLeaveRequestSchema.safeParse(data);
}

export function validateUpdateLeaveRequest(data: unknown) {
  return updateLeaveRequestSchema.safeParse(data);
}

export function validateProcessApproval(data: unknown) {
  return processApprovalSchema.safeParse(data);
}

export function validateAdjustBalance(data: unknown) {
  return adjustBalanceSchema.safeParse(data);
}

export function validateLeaveRequestFilter(data: unknown) {
  return leaveRequestFilterSchema.safeParse(data);
}

export function validateTeamCalendarFilter(data: unknown) {
  return teamCalendarFilterSchema.safeParse(data);
}

export function validateCreatePublicHoliday(data: unknown) {
  return createPublicHolidaySchema.safeParse(data);
}

export function validateCreateDelegation(data: unknown) {
  return createDelegationSchema.safeParse(data);
}

// ============================================================================
// Type Exports
// ============================================================================

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
export type ProcessApprovalInput = z.infer<typeof processApprovalSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
export type LeaveRequestFilterInput = z.infer<typeof leaveRequestFilterSchema>;
export type TeamCalendarFilterInput = z.infer<typeof teamCalendarFilterSchema>;
export type CreatePublicHolidayInput = z.infer<typeof createPublicHolidaySchema>;
export type CreateDelegationInput = z.infer<typeof createDelegationSchema>;
