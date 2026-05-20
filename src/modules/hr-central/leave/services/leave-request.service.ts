/**
 * Leave Request Service
 * DawinOS HR Central - Leave Module
 * 
 * Handles leave request creation, approval workflow, and status management
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';
import {
  LeaveRequest,
  LeaveApproval,
  CreateLeaveRequestInput,
  ProcessApprovalInput,
  LeaveRequestFilter,
  PublicHoliday,
  LeaveApprover,
} from '../types/leave.types';
import {
  LEAVE_COLLECTIONS,
  LEAVE_REQUEST_STATUS,
  LeaveRequestStatus,
  VALID_LEAVE_STATUS_TRANSITIONS,
  LEAVE_PRIORITY,
  APPROVAL_LEVELS,
  ApprovalLevel,
  LeaveType,
} from '../constants/leave.constants';
import {
  getLeaveEntitlementConfig,
  generateLeaveDayConfigs,
  calculateTotalLeaveDays,
  checkLeaveEligibility,
  validateNoticePeriod,
  getApprovalChain,
  generateLeaveRequestNumber,
  checkDateOverlap,
  formatDateString,
  getCurrentLeaveYear,
} from '../utils/leave.utils';
import {
  getLeaveBalance,
  checkSufficientBalance,
  reserveBalance,
  releaseReservedBalance,
  confirmLeaveTaken,
  adjustBalance,
} from './leave-balance.service';

// ============================================================================
// Collection References
// ============================================================================

const requestsRef = collection(db, LEAVE_COLLECTIONS.LEAVE_REQUESTS);
const approvalsRef = collection(db, LEAVE_COLLECTIONS.LEAVE_APPROVALS);
const holidaysRef = collection(db, LEAVE_COLLECTIONS.PUBLIC_HOLIDAYS);
const delegationsRef = collection(db, LEAVE_COLLECTIONS.LEAVE_DELEGATION);

// ============================================================================
// Create Leave Request
// ============================================================================

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
  userId: string
): Promise<LeaveRequest> {
  // Get employee data
  const employee = await getEmployee(input.employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Check eligibility
  const eligibility = checkLeaveEligibility(input.leaveType, {
    gender: employee.gender,
    joiningDate: employee.joiningDate.toDate(),
    employmentType: employee.employmentType,
  });
  
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason);
  }
  
  // Get leave configuration
  const leaveConfig = getLeaveEntitlementConfig(input.leaveType);
  
  // Get public holidays
  const holidays = await getPublicHolidays(
    employee.subsidiaryId,
    new Date(input.startDate).getFullYear()
  );
  
  // Generate day configurations
  const dayConfigs = generateLeaveDayConfigs(
    input.startDate,
    input.endDate,
    holidays,
    input.dayConfigs
  );
  
  // Calculate working days
  const totalWorkingDays = calculateTotalLeaveDays(dayConfigs);
  
  if (totalWorkingDays === 0) {
    throw new Error('No working days in the selected period. Please check dates and holidays.');
  }
  
  // Check for overlapping leaves
  const existingLeaves = await getEmployeeLeaves(input.employeeId, {
    status: [
      LEAVE_REQUEST_STATUS.PENDING_APPROVAL,
      LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW,
      LEAVE_REQUEST_STATUS.APPROVED,
    ],
  });
  
  for (const leave of existingLeaves) {
    const startStr = formatDateString(leave.startDate.toDate());
    const endStr = formatDateString(leave.endDate.toDate());
    
    if (checkDateOverlap(input.startDate, input.endDate, startStr, endStr)) {
      throw new Error(`You already have a leave request (${leave.requestNumber}) during this period.`);
    }
  }
  
  // Validate notice period (skip for drafts and emergencies)
  if (!input.saveAsDraft && input.priority !== LEAVE_PRIORITY.EMERGENCY) {
    const noticeValidation = validateNoticePeriod(
      input.startDate,
      leaveConfig.minNoticeDays,
      false
    );
    
    if (!noticeValidation.valid) {
      throw new Error(noticeValidation.message);
    }
  }
  
  // Check balance (skip for unpaid leave)
  const leaveYear = getCurrentLeaveYear();
  if (input.leaveType !== 'unpaid') {
    const balanceCheck = await checkSufficientBalance(
      input.employeeId,
      input.leaveType,
      totalWorkingDays,
      leaveYear
    );
    
    if (!balanceCheck.sufficient && !input.saveAsDraft) {
      throw new Error(balanceCheck.message);
    }
  }
  
  // Generate request number
  const sequence = await getNextSequence(employee.employeeNumber);
  const requestNumber = generateLeaveRequestNumber(
    employee.employeeNumber,
    new Date(),
    sequence
  );
  
  // Build approval chain
  const approvalLevels = getApprovalChain(
    input.leaveType,
    totalWorkingDays,
    {
      supervisorId: employee.supervisorId,
      departmentHeadId: employee.departmentHeadId,
      hrManagerId: employee.hrManagerId,
    }
  );
  
  // Get approver details
  const approvers: LeaveApprover[] = await Promise.all(
    approvalLevels.map(async (level, index) => {
      const approverId = getApproverId(level, employee);
      const approver = await getEmployee(approverId);
      
      return {
        level,
        approverId,
        approverName: approver?.fullName || 'Unknown',
        sequence: index + 1,
        status: 'pending' as const,
      };
    })
  );
  
  // Determine initial status
  const initialStatus = input.saveAsDraft
    ? LEAVE_REQUEST_STATUS.DRAFT
    : LEAVE_REQUEST_STATUS.PENDING_APPROVAL;
  
  // Get balance for impact calculation
  const balance = await getLeaveBalance(input.employeeId, leaveYear);
  const typeBalance = balance?.balances.find(b => b.leaveType === input.leaveType);
  
  // Get delegate name if delegation provided
  let delegateToName = '';
  if (input.delegation?.delegateToId) {
    const delegate = await getEmployee(input.delegation.delegateToId);
    delegateToName = delegate?.fullName || '';
  }
  
  // Create request
  const requestId = doc(requestsRef).id;
  const request: LeaveRequest = {
    id: requestId,
    requestNumber,
    subsidiaryId: employee.subsidiaryId,
    
    employeeId: input.employeeId,
    employeeNumber: employee.employeeNumber,
    employeeName: employee.fullName,
    departmentId: employee.departmentId,
    departmentName: employee.departmentName,
    
    leaveType: input.leaveType,
    startDate: Timestamp.fromDate(new Date(input.startDate)),
    endDate: Timestamp.fromDate(new Date(input.endDate)),
    totalWorkingDays,
    
    dayConfigs,
    
    reason: input.reason,
    priority: input.priority || LEAVE_PRIORITY.NORMAL,
    
    documents: [],
    
    delegation: input.delegation ? {
      delegateToId: input.delegation.delegateToId,
      delegateToName,
      handoverNotes: input.delegation.handoverNotes,
    } : undefined,
    
    emergencyContact: input.emergencyContact,
    
    status: initialStatus,
    statusHistory: [{
      status: initialStatus,
      changedAt: Timestamp.now(),
      changedBy: userId,
      changedByName: employee.fullName,
      comments: input.saveAsDraft ? 'Saved as draft' : 'Submitted for approval',
    }],
    
    approvalChain: {
      levels: approvalLevels,
      currentLevel: 0,
      approvers,
    },
    
    approvals: [],
    
    balanceImpact: {
      daysTaken: totalWorkingDays,
      balanceBefore: typeBalance?.available || 0,
      balanceAfter: (typeBalance?.available || 0) - totalWorkingDays,
      carryOverUsed: 0,
      advanceUsed: 0,
    },
    
    returnToWork: {
      expectedDate: Timestamp.fromDate(
        calculateReturnDate(new Date(input.endDate))
      ),
      fitnessCertificateRequired: input.leaveType === 'sick' && totalWorkingDays > 5,
    },
    
    createdAt: Timestamp.now(),
    createdBy: userId,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
    submittedAt: input.saveAsDraft ? undefined : Timestamp.now(),
  };
  
  await setDoc(doc(requestsRef, requestId), request);
  
  // Reserve balance if not draft
  if (!input.saveAsDraft && input.leaveType !== 'unpaid') {
    await reserveBalance(
      input.employeeId,
      input.leaveType,
      totalWorkingDays,
      leaveYear
    );
  }
  
  return request;
}

// ============================================================================
// Submit Draft Request
// ============================================================================

export async function submitLeaveRequest(
  requestId: string,
  userId: string
): Promise<LeaveRequest> {
  const request = await getLeaveRequest(requestId);
  
  if (!request) {
    throw new Error('Leave request not found');
  }
  
  if (request.status !== LEAVE_REQUEST_STATUS.DRAFT) {
    throw new Error('Only draft requests can be submitted');
  }
  
  // Re-validate eligibility, balance, etc.
  const leaveYear = getCurrentLeaveYear();
  
  if (request.leaveType !== 'unpaid') {
    const balanceCheck = await checkSufficientBalance(
      request.employeeId,
      request.leaveType,
      request.totalWorkingDays,
      leaveYear
    );
    
    if (!balanceCheck.sufficient) {
      throw new Error(balanceCheck.message);
    }
    
    // Reserve balance
    await reserveBalance(
      request.employeeId,
      request.leaveType,
      request.totalWorkingDays,
      leaveYear
    );
  }
  
  // Update status
  return updateLeaveStatus(
    requestId,
    LEAVE_REQUEST_STATUS.PENDING_APPROVAL,
    userId,
    'Submitted for approval'
  );
}

// ============================================================================
// Process Approval
// ============================================================================

export async function processLeaveApproval(
  input: ProcessApprovalInput,
  approverId: string
): Promise<LeaveRequest> {
  const { requestId, action, comments } = input;
  
  const request = await getLeaveRequest(requestId);
  if (!request) {
    throw new Error('Leave request not found');
  }
  
  // Validate status
  if (
    request.status !== LEAVE_REQUEST_STATUS.PENDING_APPROVAL &&
    request.status !== LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW
  ) {
    throw new Error('Request is not pending approval');
  }
  
  // Check if approver is authorized
  const currentApprover = request.approvalChain.approvers.find(
    a => a.sequence === request.approvalChain.currentLevel + 1 && a.status === 'pending'
  );
  
  if (!currentApprover) {
    throw new Error('No pending approver found');
  }
  
  // Check if this is the designated approver or a delegate
  const isDesignatedApprover = currentApprover.approverId === approverId;
  const delegation = await checkApprovalDelegation(
    currentApprover.approverId,
    approverId,
    request.leaveType,
    request.totalWorkingDays
  );
  
  if (!isDesignatedApprover && !delegation) {
    throw new Error('You are not authorized to approve this request');
  }
  
  // Get approver details
  const approver = await getEmployee(approverId);
  
  // Create approval record
  const approval: LeaveApproval = {
    id: doc(approvalsRef).id,
    requestId,
    level: currentApprover.level,
    sequence: currentApprover.sequence,
    approverId,
    approverName: approver?.fullName || 'Unknown',
    approverRole: currentApprover.level,
    action,
    comments,
    isDelegated: !!delegation,
    delegatedFrom: delegation?.delegatorId,
    delegatedFromName: delegation?.delegatorName,
    processedAt: Timestamp.now(),
  };
  
  // Determine new status
  let newStatus: LeaveRequestStatus;
  let nextLevel = request.approvalChain.currentLevel;
  
  if (action === 'approve') {
    if (currentApprover.sequence < request.approvalChain.approvers.length) {
      nextLevel = currentApprover.sequence;
      newStatus = LEAVE_REQUEST_STATUS.PENDING_APPROVAL;
    } else {
      newStatus = LEAVE_REQUEST_STATUS.APPROVED;
    }
  } else if (action === 'reject') {
    newStatus = LEAVE_REQUEST_STATUS.REJECTED;
  } else {
    // Return to previous level or draft
    if (currentApprover.sequence > 1) {
      nextLevel = currentApprover.sequence - 2;
      newStatus = LEAVE_REQUEST_STATUS.PENDING_APPROVAL;
    } else {
      newStatus = LEAVE_REQUEST_STATUS.DRAFT;
    }
  }
  
  // Update approver status in chain
  const updatedApprovers = request.approvalChain.approvers.map(a => {
    if (a.sequence === currentApprover.sequence) {
      return {
        ...a,
        status: action === 'approve' ? 'approved' as const : 
                action === 'reject' ? 'rejected' as const : 'pending' as const,
        processedAt: Timestamp.now(),
        comments,
      };
    }
    return a;
  });
  
  // Update request
  await updateDoc(doc(requestsRef, requestId), {
    status: newStatus,
    'approvalChain.currentLevel': nextLevel,
    'approvalChain.approvers': updatedApprovers,
    approvals: [...request.approvals, approval],
    statusHistory: [
      ...request.statusHistory,
      {
        status: newStatus,
        changedAt: Timestamp.now(),
        changedBy: approverId,
        changedByName: approver?.fullName || 'Unknown',
        comments: `${action.charAt(0).toUpperCase() + action.slice(1)}ed: ${comments || ''}`,
      },
    ],
    updatedAt: Timestamp.now(),
    updatedBy: approverId,
    ...(newStatus === LEAVE_REQUEST_STATUS.APPROVED ? { approvedAt: Timestamp.now() } : {}),
    ...(newStatus === LEAVE_REQUEST_STATUS.REJECTED ? { rejectedAt: Timestamp.now() } : {}),
  });
  
  // Handle balance updates
  const leaveYear = getCurrentLeaveYear();
  
  if (action === 'approve' && newStatus === LEAVE_REQUEST_STATUS.APPROVED) {
    await confirmLeaveTaken(
      request.employeeId,
      request.leaveType,
      request.totalWorkingDays,
      leaveYear,
      approverId,
      requestId
    );
  } else if (action === 'reject') {
    if (request.leaveType !== 'unpaid') {
      await releaseReservedBalance(
        request.employeeId,
        request.leaveType,
        request.totalWorkingDays,
        leaveYear
      );
    }
  }
  
  return (await getLeaveRequest(requestId))!;
}

// ============================================================================
// Cancel Leave Request
// ============================================================================

export async function cancelLeaveRequest(
  requestId: string,
  userId: string,
  reason: string
): Promise<LeaveRequest> {
  const request = await getLeaveRequest(requestId);
  if (!request) {
    throw new Error('Leave request not found');
  }
  
  const user = await getEmployee(userId);
  const isHR = user?.roles?.includes('hr_manager');
  
  const validStatuses: LeaveRequestStatus[] = [
    LEAVE_REQUEST_STATUS.PENDING_APPROVAL,
    LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW,
    LEAVE_REQUEST_STATUS.APPROVED,
  ];
  
  if (!validStatuses.includes(request.status)) {
    throw new Error('This request cannot be cancelled');
  }
  
  // Check if leave has started (only for approved leaves)
  if (request.status === LEAVE_REQUEST_STATUS.APPROVED) {
    const startDate = request.startDate.toDate();
    if (startDate <= new Date()) {
      throw new Error('Cannot cancel leave that has already started');
    }
  }
  
  // Only requester or HR can cancel
  if (request.employeeId !== userId && !isHR) {
    throw new Error('You are not authorized to cancel this request');
  }
  
  // Release balance
  const leaveYear = getCurrentLeaveYear();
  if (request.leaveType !== 'unpaid') {
    if (request.status === LEAVE_REQUEST_STATUS.APPROVED) {
      await adjustBalance(
        {
          employeeId: request.employeeId,
          leaveYear,
          leaveType: request.leaveType,
          adjustmentType: 'correction',
          adjustment: request.totalWorkingDays,
          reason: `Leave cancelled: ${reason}`,
        },
        userId
      );
    } else {
      await releaseReservedBalance(
        request.employeeId,
        request.leaveType,
        request.totalWorkingDays,
        leaveYear
      );
    }
  }
  
  return updateLeaveStatus(
    requestId,
    LEAVE_REQUEST_STATUS.CANCELLED,
    userId,
    reason
  );
}

// ============================================================================
// Withdraw Draft Request
// ============================================================================

export async function withdrawLeaveRequest(
  requestId: string,
  userId: string
): Promise<LeaveRequest> {
  const request = await getLeaveRequest(requestId);
  if (!request) {
    throw new Error('Leave request not found');
  }
  
  if (request.status !== LEAVE_REQUEST_STATUS.DRAFT) {
    throw new Error('Only draft requests can be withdrawn');
  }
  
  if (request.employeeId !== userId) {
    throw new Error('Only the requester can withdraw this request');
  }
  
  return updateLeaveStatus(
    requestId,
    LEAVE_REQUEST_STATUS.WITHDRAWN,
    userId,
    'Withdrawn by requester'
  );
}

// ============================================================================
// Get Requests
// ============================================================================

export async function getLeaveRequest(requestId: string): Promise<LeaveRequest | null> {
  const docRef = doc(requestsRef, requestId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return docSnap.data() as LeaveRequest;
}

export async function getEmployeeLeaves(
  employeeId: string,
  filter?: { status?: LeaveRequestStatus[] }
): Promise<LeaveRequest[]> {
  const q = query(
    requestsRef,
    where('employeeId', '==', employeeId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  let requests = snapshot.docs.map(d => d.data() as LeaveRequest);
  
  if (filter?.status) {
    requests = requests.filter(r => filter.status!.includes(r.status));
  }
  
  return requests;
}

export async function getPendingApprovals(approverId: string): Promise<LeaveRequest[]> {
  const q = query(
    requestsRef,
    where('status', 'in', [
      LEAVE_REQUEST_STATUS.PENDING_APPROVAL,
      LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW,
    ])
  );
  
  const snapshot = await getDocs(q);
  const allPending = snapshot.docs.map(d => d.data() as LeaveRequest);
  
  const pendingForUser: LeaveRequest[] = [];
  
  for (const request of allPending) {
    const currentApprover = request.approvalChain.approvers.find(
      a => a.sequence === request.approvalChain.currentLevel + 1 && a.status === 'pending'
    );
    
    if (!currentApprover) continue;
    
    if (currentApprover.approverId === approverId) {
      pendingForUser.push(request);
      continue;
    }
    
    const delegation = await checkApprovalDelegation(
      currentApprover.approverId,
      approverId,
      request.leaveType,
      request.totalWorkingDays
    );
    
    if (delegation) {
      pendingForUser.push(request);
    }
  }
  
  return pendingForUser;
}

export async function getLeaveRequests(filter: LeaveRequestFilter): Promise<LeaveRequest[]> {
  let q = query(
    requestsRef,
    where('subsidiaryId', '==', filter.subsidiaryId)
  );
  
  if (filter.departmentId) {
    q = query(q, where('departmentId', '==', filter.departmentId));
  }
  
  if (filter.employeeId) {
    q = query(q, where('employeeId', '==', filter.employeeId));
  }
  
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    q = query(q, where('status', 'in', statuses));
  }
  
  if (filter.leaveType) {
    q = query(q, where('leaveType', '==', filter.leaveType));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as LeaveRequest);
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getEmployee(employeeId: string): Promise<any> {
  const docRef = doc(db, 'employees', employeeId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

async function getPublicHolidays(subsidiaryId: string, year: number): Promise<PublicHoliday[]> {
  const q = query(
    holidaysRef,
    where('subsidiaryId', '==', subsidiaryId),
    where('year', '==', year)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as PublicHoliday);
}

async function getNextSequence(employeeNumber: string): Promise<number> {
  const today = formatDateString(new Date());
  const prefix = `LR-${employeeNumber}-${today.replace(/-/g, '')}`;
  
  const q = query(
    requestsRef,
    where('requestNumber', '>=', prefix),
    where('requestNumber', '<=', prefix + '\uf8ff')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size + 1;
}

function getApproverId(level: ApprovalLevel, employee: any): string {
  switch (level) {
    case APPROVAL_LEVELS.SUPERVISOR:
      return employee.supervisorId;
    case APPROVAL_LEVELS.DEPARTMENT_HEAD:
      return employee.departmentHeadId;
    case APPROVAL_LEVELS.HR_MANAGER:
      return employee.hrManagerId;
    case APPROVAL_LEVELS.GENERAL_MANAGER:
      return employee.generalManagerId;
    case APPROVAL_LEVELS.CEO:
      return employee.ceoId;
    default:
      return employee.supervisorId;
  }
}

function calculateReturnDate(endDate: Date): Date {
  const returnDate = new Date(endDate);
  returnDate.setDate(returnDate.getDate() + 1);
  
  while (returnDate.getDay() === 0 || returnDate.getDay() === 6) {
    returnDate.setDate(returnDate.getDate() + 1);
  }
  
  return returnDate;
}

async function updateLeaveStatus(
  requestId: string,
  newStatus: LeaveRequestStatus,
  userId: string,
  comments?: string
): Promise<LeaveRequest> {
  const request = await getLeaveRequest(requestId);
  if (!request) {
    throw new Error('Request not found');
  }
  
  if (!VALID_LEAVE_STATUS_TRANSITIONS[request.status]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${request.status} to ${newStatus}` 
    );
  }
  
  const user = await getEmployee(userId);
  
  await updateDoc(doc(requestsRef, requestId), {
    status: newStatus,
    statusHistory: [
      ...request.statusHistory,
      {
        status: newStatus,
        changedAt: Timestamp.now(),
        changedBy: userId,
        changedByName: user?.fullName || 'Unknown',
        comments,
      },
    ],
    updatedAt: Timestamp.now(),
    updatedBy: userId,
    ...(newStatus === LEAVE_REQUEST_STATUS.CANCELLED ? { cancelledAt: Timestamp.now() } : {}),
  });
  
  return (await getLeaveRequest(requestId))!;
}

async function checkApprovalDelegation(
  delegatorId: string,
  delegateId: string,
  leaveType: LeaveType,
  days: number
): Promise<any | null> {
  const now = Timestamp.now();
  
  const q = query(
    delegationsRef,
    where('delegatorId', '==', delegatorId),
    where('delegateId', '==', delegateId),
    where('isActive', '==', true),
    where('startDate', '<=', now),
    where('endDate', '>=', now)
  );
  
  const snapshot = await getDocs(q);
  
  for (const docSnap of snapshot.docs) {
    const delegation = docSnap.data();
    
    if (delegation.scope?.leaveTypes && 
        !delegation.scope.leaveTypes.includes(leaveType)) {
      continue;
    }
    
    if (delegation.scope?.maxDays && days > delegation.scope.maxDays) {
      continue;
    }
    
    return delegation;
  }
  
  return null;
}
