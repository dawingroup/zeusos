/**
 * Leave Management React Hooks
 * DawinOS HR Central - Leave Module
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LeaveRequest,
  LeaveBalance,
  TeamCalendarEntry,
  CreateLeaveRequestInput,
  ProcessApprovalInput,
  LeaveRequestFilter,
  TeamCalendarFilter,
  AdjustBalanceInput,
  PublicHoliday,
} from '../types/leave.types';
import { LeaveType } from '../constants/leave.constants';
import {
  createLeaveRequest,
  submitLeaveRequest,
  processLeaveApproval,
  cancelLeaveRequest,
  withdrawLeaveRequest,
  getLeaveRequest,
  getEmployeeLeaves,
  getPendingApprovals,
  getLeaveRequests,
} from '../services/leave-request.service';
import {
  getLeaveBalance,
  adjustBalance,
  getBalanceHistory,
} from '../services/leave-balance.service';
import {
  getCalendarEntries,
  getTeamAvailability,
  getPublicHolidays,
} from '../services/team-calendar.service';
import { getCurrentLeaveYear } from '../utils/leave.utils';

// ============================================================================
// useLeaveRequests - List of Leave Requests
// ============================================================================

interface UseLeaveRequestsReturn {
  requests: LeaveRequest[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLeaveRequests(
  subsidiaryId: string,
  filter?: Partial<LeaveRequestFilter>
): UseLeaveRequestsReturn {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchRequests = useCallback(async () => {
    if (!subsidiaryId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await getLeaveRequests({
        subsidiaryId,
        ...filter,
      });
      
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leave requests');
    } finally {
      setIsLoading(false);
    }
  }, [subsidiaryId, filter]);
  
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);
  
  return {
    requests,
    isLoading,
    error,
    refresh: fetchRequests,
  };
}

// ============================================================================
// useLeaveRequest - Single Leave Request Management
// ============================================================================

interface UseLeaveRequestReturn {
  request: LeaveRequest | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  createRequest: (input: CreateLeaveRequestInput) => Promise<LeaveRequest>;
  submitRequest: () => Promise<LeaveRequest | undefined>;
  cancelRequest: (reason: string) => Promise<LeaveRequest | undefined>;
  withdrawRequest: () => Promise<LeaveRequest | undefined>;
  refresh: () => Promise<void>;
}

export function useLeaveRequest(
  requestId?: string,
  userId?: string
): UseLeaveRequestReturn {
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchRequest = useCallback(async () => {
    if (!requestId) {
      setRequest(null);
      return;
    }
    
    try {
      setIsLoading(true);
      const data = await getLeaveRequest(requestId);
      setRequest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch request');
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);
  
  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);
  
  const createRequestFn = useCallback(async (input: CreateLeaveRequestInput) => {
    if (!userId) throw new Error('User not authenticated');
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const newRequest = await createLeaveRequest(input, userId);
      setRequest(newRequest);
      
      return newRequest;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create request';
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [userId]);
  
  const submitRequestFn = useCallback(async () => {
    if (!request?.id || !userId) return;
    
    try {
      setIsSubmitting(true);
      const updated = await submitLeaveRequest(request.id, userId);
      setRequest(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [request?.id, userId]);
  
  const cancelRequestFn = useCallback(async (reason: string) => {
    if (!request?.id || !userId) return;
    
    try {
      setIsSubmitting(true);
      const updated = await cancelLeaveRequest(request.id, userId, reason);
      setRequest(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [request?.id, userId]);
  
  const withdrawRequestFn = useCallback(async () => {
    if (!request?.id || !userId) return;
    
    try {
      setIsSubmitting(true);
      const updated = await withdrawLeaveRequest(request.id, userId);
      setRequest(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw request');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [request?.id, userId]);
  
  return {
    request,
    isLoading,
    isSubmitting,
    error,
    createRequest: createRequestFn,
    submitRequest: submitRequestFn,
    cancelRequest: cancelRequestFn,
    withdrawRequest: withdrawRequestFn,
    refresh: fetchRequest,
  };
}

// ============================================================================
// useLeaveApprovals - Pending Approvals
// ============================================================================

interface UseLeaveApprovalsReturn {
  pendingApprovals: LeaveRequest[];
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  processApproval: (input: ProcessApprovalInput) => Promise<LeaveRequest | undefined>;
  refresh: () => Promise<void>;
}

export function useLeaveApprovals(userId?: string): UseLeaveApprovalsReturn {
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchApprovals = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const data = await getPendingApprovals(userId);
      setPendingApprovals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending approvals');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  
  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);
  
  const processApprovalFn = useCallback(async (input: ProcessApprovalInput) => {
    if (!userId) return;
    
    try {
      setIsProcessing(true);
      const updated = await processLeaveApproval(input, userId);
      await fetchApprovals();
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process approval');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, fetchApprovals]);
  
  return {
    pendingApprovals,
    isLoading,
    isProcessing,
    error,
    processApproval: processApprovalFn,
    refresh: fetchApprovals,
  };
}

// ============================================================================
// useLeaveBalance - Employee Leave Balance
// ============================================================================

interface UseLeaveBalanceReturn {
  balance: LeaveBalance | null;
  isLoading: boolean;
  error: string | null;
  adjustBalance: (input: AdjustBalanceInput) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLeaveBalance(
  employeeId?: string,
  leaveYear?: number,
  userId?: string
): UseLeaveBalanceReturn {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const year = leaveYear || getCurrentLeaveYear();
  
  const fetchBalance = useCallback(async () => {
    if (!employeeId) return;
    
    try {
      setIsLoading(true);
      const data = await getLeaveBalance(employeeId, year);
      setBalance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, year]);
  
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);
  
  const adjustBalanceFn = useCallback(async (input: AdjustBalanceInput) => {
    if (!userId) return;
    
    try {
      await adjustBalance(input, userId);
      await fetchBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust balance');
      throw err;
    }
  }, [userId, fetchBalance]);
  
  return {
    balance,
    isLoading,
    error,
    adjustBalance: adjustBalanceFn,
    refresh: fetchBalance,
  };
}

// ============================================================================
// useTeamCalendar - Team Calendar Entries
// ============================================================================

interface UseTeamCalendarReturn {
  entries: TeamCalendarEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTeamCalendar(filter: TeamCalendarFilter): UseTeamCalendarReturn {
  const [entries, setEntries] = useState<TeamCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getCalendarEntries(filter);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar entries');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);
  
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);
  
  return {
    entries,
    isLoading,
    error,
    refresh: fetchEntries,
  };
}

// ============================================================================
// useTeamAvailability - Team Availability Data
// ============================================================================

interface UseTeamAvailabilityReturn {
  availability: {
    date: string;
    totalEmployees: number;
    onLeave: number;
    available: number;
    employeesOnLeave: { id: string; name: string; leaveType: LeaveType }[];
  }[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTeamAvailability(
  subsidiaryId: string,
  departmentId: string,
  startDate: string,
  endDate: string
): UseTeamAvailabilityReturn {
  const [availability, setAvailability] = useState<UseTeamAvailabilityReturn['availability']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchAvailability = useCallback(async () => {
    if (!subsidiaryId || !departmentId) return;
    
    try {
      setIsLoading(true);
      const data = await getTeamAvailability(
        subsidiaryId,
        departmentId,
        startDate,
        endDate
      );
      setAvailability(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch availability');
    } finally {
      setIsLoading(false);
    }
  }, [subsidiaryId, departmentId, startDate, endDate]);
  
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);
  
  return {
    availability,
    isLoading,
    error,
    refresh: fetchAvailability,
  };
}

// ============================================================================
// useMyLeaves - Employee Self-Service Leaves
// ============================================================================

interface UseMyLeavesReturn {
  leaves: LeaveRequest[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMyLeaves(employeeId?: string): UseMyLeavesReturn {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchLeaves = useCallback(async () => {
    if (!employeeId) return;
    
    try {
      setIsLoading(true);
      const data = await getEmployeeLeaves(employeeId);
      setLeaves(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaves');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);
  
  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);
  
  return {
    leaves,
    isLoading,
    error,
    refresh: fetchLeaves,
  };
}

// ============================================================================
// usePublicHolidays - Public Holidays
// ============================================================================

interface UsePublicHolidaysReturn {
  holidays: PublicHoliday[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePublicHolidays(
  subsidiaryId: string,
  year: number
): UsePublicHolidaysReturn {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchHolidays = useCallback(async () => {
    if (!subsidiaryId) return;
    
    try {
      setIsLoading(true);
      const data = await getPublicHolidays(subsidiaryId, year);
      setHolidays(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch holidays');
    } finally {
      setIsLoading(false);
    }
  }, [subsidiaryId, year]);
  
  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);
  
  return {
    holidays,
    isLoading,
    error,
    refresh: fetchHolidays,
  };
}

// ============================================================================
// useBalanceHistory - Leave Balance History
// ============================================================================

interface UseBalanceHistoryReturn {
  history: Awaited<ReturnType<typeof getBalanceHistory>>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBalanceHistory(
  employeeId?: string,
  leaveYear?: number,
  leaveType?: LeaveType
): UseBalanceHistoryReturn {
  const [history, setHistory] = useState<UseBalanceHistoryReturn['history']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchHistory = useCallback(async () => {
    if (!employeeId) return;
    
    try {
      setIsLoading(true);
      const data = await getBalanceHistory(employeeId, leaveYear, leaveType);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance history');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, leaveYear, leaveType]);
  
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);
  
  return {
    history,
    isLoading,
    error,
    refresh: fetchHistory,
  };
}
