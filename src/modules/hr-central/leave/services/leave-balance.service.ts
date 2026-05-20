/**
 * Leave Balance Service
 * DawinOS HR Central - Leave Module
 * 
 * Manages leave balance calculations, accruals, and adjustments
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
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';
import {
  LeaveBalance,
  LeaveTypeBalance,
  LeaveBalanceHistory,
  AdjustBalanceInput,
} from '../types/leave.types';
import {
  LEAVE_COLLECTIONS,
  LEAVE_TYPES,
  LeaveType,
  ACCRUAL_METHODS,
  BALANCE_ADJUSTMENT_TYPES,
  BalanceAdjustmentType,
} from '../constants/leave.constants';
import {
  getLeaveEntitlementConfig,
  calculateProratedEntitlement,
  calculateMonthlyAccrual,
  getCurrentLeaveYear,
  formatDateString,
  calculateAvailableBalance,
} from '../utils/leave.utils';

// ============================================================================
// Leave Balance Service
// ============================================================================

const balancesRef = collection(db, LEAVE_COLLECTIONS.LEAVE_BALANCES);
const historyRef = collection(db, LEAVE_COLLECTIONS.LEAVE_BALANCE_HISTORY);

/**
 * Initialize leave balance for a new employee or new leave year
 */
export async function initializeLeaveBalance(
  employeeId: string,
  employeeNumber: string,
  subsidiaryId: string,
  joiningDate: Date,
  gender: 'male' | 'female',
  _employmentType: string,
  leaveYear: number = getCurrentLeaveYear(),
  userId: string
): Promise<LeaveBalance> {
  const balanceId = `${employeeId}_${leaveYear}`;
  
  const balances: LeaveTypeBalance[] = [];
  
  const allLeaveTypes = [
    ...Object.values(LEAVE_TYPES),
  ] as LeaveType[];
  
  for (const leaveType of allLeaveTypes) {
    const config = getLeaveEntitlementConfig(leaveType);
    
    // Skip gender-restricted leave types
    if (config.genderRestriction && config.genderRestriction !== gender) {
      continue;
    }
    
    const annualEntitlement = config.daysPerYear;
    const proratedEntitlement = calculateProratedEntitlement(
      annualEntitlement,
      joiningDate,
      leaveYear
    );
    
    const accrualRate = config.accrualMethod === ACCRUAL_METHODS.MONTHLY
      ? calculateMonthlyAccrual(annualEntitlement, config.accrualMethod)
      : 0;
    
    // For entitlement-based accrual, full amount is available immediately
    const accruedToDate = config.accrualMethod === ACCRUAL_METHODS.ENTITLEMENT
      ? proratedEntitlement
      : 0;
    
    balances.push({
      leaveType,
      annualEntitlement,
      proratedEntitlement,
      accruedToDate,
      accrualRate,
      carriedOver: 0,
      carriedOverUsed: 0,
      carriedOverExpired: 0,
      taken: 0,
      pending: 0,
      scheduled: 0,
      available: accruedToDate,
      advanceTaken: 0,
      maxAdvance: 0,
      encashable: 0,
      encashed: 0,
    });
  }
  
  const leaveBalance: LeaveBalance = {
    id: balanceId,
    employeeId,
    employeeNumber,
    subsidiaryId,
    leaveYear,
    balances,
    lastAccrualDate: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(doc(balancesRef, balanceId), leaveBalance);
  
  // Create initial history entry
  for (const balance of balances) {
    if (balance.accruedToDate > 0) {
      await createBalanceHistory({
        employeeId,
        leaveYear,
        leaveType: balance.leaveType,
        transactionType: BALANCE_ADJUSTMENT_TYPES.ACCRUAL,
        balanceBefore: 0,
        adjustment: balance.accruedToDate,
        balanceAfter: balance.accruedToDate,
        description: `Initial entitlement for ${leaveYear}`,
        userId,
      });
    }
  }
  
  return leaveBalance;
}

/**
 * Get leave balance for an employee
 */
export async function getLeaveBalance(
  employeeId: string,
  leaveYear: number = getCurrentLeaveYear()
): Promise<LeaveBalance | null> {
  const balanceId = `${employeeId}_${leaveYear}`;
  const docRef = doc(balancesRef, balanceId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return docSnap.data() as LeaveBalance;
}

/**
 * Get balance for a specific leave type
 */
export async function getLeaveTypeBalance(
  employeeId: string,
  leaveType: LeaveType,
  leaveYear: number = getCurrentLeaveYear()
): Promise<LeaveTypeBalance | null> {
  const balance = await getLeaveBalance(employeeId, leaveYear);
  
  if (!balance) {
    return null;
  }
  
  return balance.balances.find(b => b.leaveType === leaveType) || null;
}

/**
 * Check if employee has sufficient balance
 */
export async function checkSufficientBalance(
  employeeId: string,
  leaveType: LeaveType,
  daysRequired: number,
  leaveYear: number = getCurrentLeaveYear()
): Promise<{ sufficient: boolean; available: number; message?: string }> {
  const balance = await getLeaveTypeBalance(employeeId, leaveType, leaveYear);
  
  if (!balance) {
    return {
      sufficient: false,
      available: 0,
      message: 'No leave balance found. Please contact HR.',
    };
  }
  
  const available = calculateAvailableBalance(
    balance.accruedToDate,
    balance.carriedOver - balance.carriedOverUsed,
    balance.taken,
    balance.pending,
    balance.advanceTaken
  );
  
  if (daysRequired > available) {
    return {
      sufficient: false,
      available,
      message: `Insufficient balance. Required: ${daysRequired} days, Available: ${available} days.`,
    };
  }
  
  return { sufficient: true, available };
}

/**
 * Reserve balance for a pending leave request
 */
export async function reserveBalance(
  employeeId: string,
  leaveType: LeaveType,
  days: number,
  leaveYear: number = getCurrentLeaveYear()
): Promise<void> {
  const balanceId = `${employeeId}_${leaveYear}`;
  const balance = await getLeaveBalance(employeeId, leaveYear);
  
  if (!balance) {
    throw new Error('Leave balance not found');
  }
  
  const typeBalance = balance.balances.find(b => b.leaveType === leaveType);
  if (!typeBalance) {
    throw new Error(`Balance for ${leaveType} not found`);
  }
  
  const updatedBalances = balance.balances.map(b => {
    if (b.leaveType === leaveType) {
      return {
        ...b,
        pending: b.pending + days,
        available: b.available - days,
      };
    }
    return b;
  });
  
  await updateDoc(doc(balancesRef, balanceId), {
    balances: updatedBalances,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Release reserved balance (for cancelled/rejected requests)
 */
export async function releaseReservedBalance(
  employeeId: string,
  leaveType: LeaveType,
  days: number,
  leaveYear: number = getCurrentLeaveYear()
): Promise<void> {
  const balanceId = `${employeeId}_${leaveYear}`;
  const balance = await getLeaveBalance(employeeId, leaveYear);
  
  if (!balance) {
    throw new Error('Leave balance not found');
  }
  
  const updatedBalances = balance.balances.map(b => {
    if (b.leaveType === leaveType) {
      return {
        ...b,
        pending: Math.max(0, b.pending - days),
        available: b.available + days,
      };
    }
    return b;
  });
  
  await updateDoc(doc(balancesRef, balanceId), {
    balances: updatedBalances,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Confirm leave taken (move from pending to taken)
 */
export async function confirmLeaveTaken(
  employeeId: string,
  leaveType: LeaveType,
  days: number,
  leaveYear: number,
  userId: string,
  requestId?: string
): Promise<void> {
  const balanceId = `${employeeId}_${leaveYear}`;
  const balance = await getLeaveBalance(employeeId, leaveYear);
  
  if (!balance) {
    throw new Error('Leave balance not found');
  }
  
  const typeBalance = balance.balances.find(b => b.leaveType === leaveType);
  if (!typeBalance) {
    throw new Error(`Balance for ${leaveType} not found`);
  }
  
  const balanceBefore = typeBalance.taken;
  
  // Determine how much comes from carry over vs current accrual
  let carryOverToUse = 0;
  const availableCarryOver = typeBalance.carriedOver - typeBalance.carriedOverUsed;
  if (availableCarryOver > 0 && days > 0) {
    carryOverToUse = Math.min(availableCarryOver, days);
  }
  
  const updatedBalances = balance.balances.map(b => {
    if (b.leaveType === leaveType) {
      return {
        ...b,
        taken: b.taken + days,
        pending: Math.max(0, b.pending - days),
        carriedOverUsed: b.carriedOverUsed + carryOverToUse,
      };
    }
    return b;
  });
  
  await updateDoc(doc(balancesRef, balanceId), {
    balances: updatedBalances,
    updatedAt: Timestamp.now(),
  });
  
  // Create history entry
  await createBalanceHistory({
    employeeId,
    leaveYear,
    leaveType,
    transactionType: BALANCE_ADJUSTMENT_TYPES.LEAVE_TAKEN,
    balanceBefore,
    adjustment: -days,
    balanceAfter: balanceBefore + days,
    description: `Leave taken: ${days} days`,
    referenceType: 'leave_request',
    referenceId: requestId,
    userId,
  });
}

/**
 * Adjust balance manually
 */
export async function adjustBalance(
  input: AdjustBalanceInput,
  userId: string
): Promise<void> {
  const { employeeId, leaveYear, leaveType, adjustmentType, adjustment, reason } = input;
  const balanceId = `${employeeId}_${leaveYear}`;
  
  const balance = await getLeaveBalance(employeeId, leaveYear);
  if (!balance) {
    throw new Error('Leave balance not found');
  }
  
  const typeBalance = balance.balances.find(b => b.leaveType === leaveType);
  if (!typeBalance) {
    throw new Error(`Balance for ${leaveType} not found`);
  }
  
  const balanceBefore = typeBalance.accruedToDate;
  let newAccrued = balanceBefore;
  let newAvailable = typeBalance.available;
  
  switch (adjustmentType) {
    case BALANCE_ADJUSTMENT_TYPES.MANUAL_CREDIT:
    case BALANCE_ADJUSTMENT_TYPES.CORRECTION:
    case BALANCE_ADJUSTMENT_TYPES.COMPENSATORY_EARNED:
      newAccrued += adjustment;
      newAvailable += adjustment;
      break;
    case BALANCE_ADJUSTMENT_TYPES.MANUAL_DEBIT:
    case BALANCE_ADJUSTMENT_TYPES.ENCASHMENT:
      newAccrued -= Math.abs(adjustment);
      newAvailable -= Math.abs(adjustment);
      break;
  }
  
  const updatedBalances = balance.balances.map(b => {
    if (b.leaveType === leaveType) {
      return {
        ...b,
        accruedToDate: newAccrued,
        available: newAvailable,
        ...(adjustmentType === BALANCE_ADJUSTMENT_TYPES.ENCASHMENT ? {
          encashed: b.encashed + Math.abs(adjustment),
        } : {}),
        ...(adjustmentType === BALANCE_ADJUSTMENT_TYPES.COMPENSATORY_EARNED ? {
          earned: (b.earned || 0) + adjustment,
        } : {}),
      };
    }
    return b;
  });
  
  await updateDoc(doc(balancesRef, balanceId), {
    balances: updatedBalances,
    updatedAt: Timestamp.now(),
  });
  
  await createBalanceHistory({
    employeeId,
    leaveYear,
    leaveType,
    transactionType: adjustmentType,
    balanceBefore,
    adjustment,
    balanceAfter: newAccrued,
    description: reason,
    referenceType: 'manual',
    userId,
  });
}

/**
 * Process monthly accrual for an employee
 */
export async function processMonthlyAccrual(
  employeeId: string,
  leaveYear: number,
  month: number,
  userId: string
): Promise<void> {
  const balance = await getLeaveBalance(employeeId, leaveYear);
  if (!balance) {
    throw new Error('Leave balance not found');
  }
  
  const batch = writeBatch(db);
  const balanceId = `${employeeId}_${leaveYear}`;
  
  const updatedBalances = balance.balances.map(b => {
    const config = getLeaveEntitlementConfig(b.leaveType);
    
    if (config.accrualMethod !== ACCRUAL_METHODS.MONTHLY) {
      return b;
    }
    
    const monthlyAccrual = b.accrualRate;
    const newAccrued = Math.min(b.accruedToDate + monthlyAccrual, b.proratedEntitlement);
    const accrualAmount = newAccrued - b.accruedToDate;
    
    if (accrualAmount > 0) {
      // Create history entry
      const historyId = `${employeeId}_${leaveYear}_${b.leaveType}_${month}`;
      const historyEntry: LeaveBalanceHistory = {
        id: historyId,
        employeeId,
        leaveYear,
        leaveType: b.leaveType,
        transactionType: BALANCE_ADJUSTMENT_TYPES.ACCRUAL,
        transactionDate: Timestamp.now(),
        balanceBefore: b.accruedToDate,
        adjustment: accrualAmount,
        balanceAfter: newAccrued,
        referenceType: 'accrual',
        description: `Monthly accrual for ${month}/${leaveYear}`,
        accrualPeriod: { month, year: leaveYear },
        createdAt: Timestamp.now(),
        createdBy: userId,
      };
      
      batch.set(doc(historyRef, historyId), historyEntry);
    }
    
    return {
      ...b,
      accruedToDate: newAccrued,
      available: calculateAvailableBalance(
        newAccrued,
        b.carriedOver - b.carriedOverUsed,
        b.taken,
        b.pending,
        b.advanceTaken
      ),
    };
  });
  
  batch.update(doc(balancesRef, balanceId), {
    balances: updatedBalances,
    lastAccrualDate: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  await batch.commit();
}

/**
 * Process carry over at year end
 */
export async function processCarryOver(
  employeeId: string,
  fromYear: number,
  toYear: number,
  userId: string
): Promise<void> {
  const fromBalance = await getLeaveBalance(employeeId, fromYear);
  if (!fromBalance) {
    throw new Error('Previous year balance not found');
  }
  
  let toBalance = await getLeaveBalance(employeeId, toYear);
  
  // Initialize new year balance if not exists
  if (!toBalance) {
    // Get employee data (simplified - in real app, fetch from employees collection)
    const employeeDoc = await getDoc(doc(db, 'employees', employeeId));
    const employee = employeeDoc.data();
    
    if (!employee) {
      throw new Error('Employee not found');
    }
    
    toBalance = await initializeLeaveBalance(
      employeeId,
      employee.employeeNumber,
      employee.subsidiaryId,
      employee.joiningDate?.toDate() || new Date(),
      employee.gender,
      employee.employmentType,
      toYear,
      userId
    );
  }
  
  const batch = writeBatch(db);
  const toBalanceId = `${employeeId}_${toYear}`;
  
  const updatedBalances = toBalance.balances.map(b => {
    const fromTypeBalance = fromBalance.balances.find(fb => fb.leaveType === b.leaveType);
    if (!fromTypeBalance) return b;
    
    const config = getLeaveEntitlementConfig(b.leaveType);
    if (!config.carryOverAllowed) return b;
    
    // Calculate unused balance from previous year
    const unused = fromTypeBalance.accruedToDate - fromTypeBalance.taken;
    const carryOverAmount = Math.min(unused, config.maxCarryOverDays);
    
    if (carryOverAmount > 0) {
      // Calculate expiry date
      const expiryDate = new Date(toYear, config.carryOverExpiryMonths - 1, 28);
      
      // Create history entry
      const historyId = `${employeeId}_${toYear}_${b.leaveType}_carryover`;
      const historyEntry: LeaveBalanceHistory = {
        id: historyId,
        employeeId,
        leaveYear: toYear,
        leaveType: b.leaveType,
        transactionType: BALANCE_ADJUSTMENT_TYPES.CARRY_OVER,
        transactionDate: Timestamp.now(),
        balanceBefore: b.carriedOver,
        adjustment: carryOverAmount,
        balanceAfter: carryOverAmount,
        referenceType: 'carry_over',
        description: `Carried over ${carryOverAmount} days from ${fromYear}`,
        createdAt: Timestamp.now(),
        createdBy: userId,
      };
      
      batch.set(doc(historyRef, historyId), historyEntry);
      
      return {
        ...b,
        carriedOver: carryOverAmount,
        carriedOverExpiry: Timestamp.fromDate(expiryDate),
        available: b.available + carryOverAmount,
      };
    }
    
    return b;
  });
  
  batch.update(doc(balancesRef, toBalanceId), {
    balances: updatedBalances,
    updatedAt: Timestamp.now(),
  });
  
  await batch.commit();
}

/**
 * Process carry over expiry
 */
export async function processCarryOverExpiry(
  employeeId: string,
  leaveYear: number,
  userId: string
): Promise<void> {
  const balance = await getLeaveBalance(employeeId, leaveYear);
  if (!balance) return;
  
  const now = new Date();
  const batch = writeBatch(db);
  const balanceId = `${employeeId}_${leaveYear}`;
  
  const updatedBalances = balance.balances.map(b => {
    if (!b.carriedOverExpiry) return b;
    
    const expiryDate = b.carriedOverExpiry.toDate();
    if (expiryDate > now) return b;
    
    const unusedCarryOver = b.carriedOver - b.carriedOverUsed;
    if (unusedCarryOver <= 0) return b;
    
    // Create history entry
    const historyId = `${employeeId}_${leaveYear}_${b.leaveType}_expiry_${formatDateString(now)}`;
    const historyEntry: LeaveBalanceHistory = {
      id: historyId,
      employeeId,
      leaveYear,
      leaveType: b.leaveType,
      transactionType: BALANCE_ADJUSTMENT_TYPES.EXPIRY,
      transactionDate: Timestamp.now(),
      balanceBefore: b.available,
      adjustment: -unusedCarryOver,
      balanceAfter: b.available - unusedCarryOver,
      referenceType: 'carry_over',
      description: `Carry over expired: ${unusedCarryOver} days`,
      createdAt: Timestamp.now(),
      createdBy: userId,
    };
    
    batch.set(doc(historyRef, historyId), historyEntry);
    
    return {
      ...b,
      carriedOverExpired: unusedCarryOver,
      available: b.available - unusedCarryOver,
    };
  });
  
  batch.update(doc(balancesRef, balanceId), {
    balances: updatedBalances,
    updatedAt: Timestamp.now(),
  });
  
  await batch.commit();
}

/**
 * Get balance history
 */
export async function getBalanceHistory(
  employeeId: string,
  leaveYear?: number,
  leaveType?: LeaveType
): Promise<LeaveBalanceHistory[]> {
  let q = query(historyRef, where('employeeId', '==', employeeId));
  
  if (leaveYear) {
    q = query(q, where('leaveYear', '==', leaveYear));
  }
  
  if (leaveType) {
    q = query(q, where('leaveType', '==', leaveType));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as LeaveBalanceHistory);
}

/**
 * Get all balances for a subsidiary
 */
export async function getSubsidiaryBalances(
  subsidiaryId: string,
  leaveYear: number = getCurrentLeaveYear()
): Promise<LeaveBalance[]> {
  const q = query(
    balancesRef,
    where('subsidiaryId', '==', subsidiaryId),
    where('leaveYear', '==', leaveYear)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as LeaveBalance);
}

// ============================================================================
// Helper Functions
// ============================================================================

async function createBalanceHistory(params: {
  employeeId: string;
  leaveYear: number;
  leaveType: LeaveType;
  transactionType: BalanceAdjustmentType;
  balanceBefore: number;
  adjustment: number;
  balanceAfter: number;
  description: string;
  referenceType?: 'leave_request' | 'accrual' | 'carry_over' | 'manual' | 'encashment';
  referenceId?: string;
  userId: string;
}): Promise<void> {
  const historyId = doc(historyRef).id;
  
  const entry: LeaveBalanceHistory = {
    id: historyId,
    employeeId: params.employeeId,
    leaveYear: params.leaveYear,
    leaveType: params.leaveType,
    transactionType: params.transactionType,
    transactionDate: Timestamp.now(),
    balanceBefore: params.balanceBefore,
    adjustment: params.adjustment,
    balanceAfter: params.balanceAfter,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    description: params.description,
    createdAt: Timestamp.now(),
    createdBy: params.userId,
  };
  
  await setDoc(doc(historyRef, historyId), entry);
}
