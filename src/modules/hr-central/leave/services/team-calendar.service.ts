/**
 * Team Calendar Service
 * DawinOS HR Central - Leave Module
 * 
 * Manages team leave calendar entries and availability views
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';
import {
  TeamCalendarEntry,
  TeamCalendarFilter,
  LeaveRequest,
  PublicHoliday,
  TeamAvailability,
  DepartmentLeaveSummary,
} from '../types/leave.types';
import {
  LEAVE_COLLECTIONS,
  LEAVE_REQUEST_STATUS,
  LeaveType,
  LEAVE_TYPE_COLORS,
  UGANDA_PUBLIC_HOLIDAYS_RECURRING,
} from '../constants/leave.constants';
import { formatDateString } from '../utils/leave.utils';

// ============================================================================
// Collection References
// ============================================================================

const calendarRef = collection(db, LEAVE_COLLECTIONS.TEAM_CALENDAR);
const holidaysRef = collection(db, LEAVE_COLLECTIONS.PUBLIC_HOLIDAYS);

// ============================================================================
// Calendar Entry Management
// ============================================================================

/**
 * Update calendar entries from a leave request
 */
export async function updateCalendarFromRequest(request: LeaveRequest): Promise<void> {
  if (
    request.status !== LEAVE_REQUEST_STATUS.APPROVED &&
    request.status !== LEAVE_REQUEST_STATUS.PENDING_APPROVAL &&
    request.status !== LEAVE_REQUEST_STATUS.PENDING_HR_REVIEW
  ) {
    return;
  }
  
  const batch = writeBatch(db);
  
  for (const dayConfig of request.dayConfigs) {
    if (!dayConfig.isWorkingDay || dayConfig.isHoliday) {
      continue;
    }
    
    const entryId = `${request.id}_${dayConfig.date}`;
    const entry: TeamCalendarEntry = {
      id: entryId,
      subsidiaryId: request.subsidiaryId,
      departmentId: request.departmentId,
      employeeId: request.employeeId,
      employeeNumber: request.employeeNumber,
      employeeName: request.employeeName,
      leaveRequestId: request.id,
      leaveType: request.leaveType,
      date: dayConfig.date,
      dayType: dayConfig.dayType,
      status: request.status === LEAVE_REQUEST_STATUS.APPROVED ? 'approved' : 'pending',
      color: LEAVE_TYPE_COLORS[request.leaveType],
    };
    
    batch.set(doc(calendarRef, entryId), entry);
  }
  
  await batch.commit();
}

/**
 * Delete calendar entries for a cancelled/rejected request
 */
export async function deleteEntriesForRequest(requestId: string): Promise<void> {
  const q = query(
    calendarRef,
    where('leaveRequestId', '==', requestId)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  
  await batch.commit();
}

// ============================================================================
// Calendar Queries
// ============================================================================

/**
 * Get calendar entries for a date range
 */
export async function getCalendarEntries(filter: TeamCalendarFilter): Promise<TeamCalendarEntry[]> {
  let q = query(
    calendarRef,
    where('subsidiaryId', '==', filter.subsidiaryId),
    where('date', '>=', filter.startDate),
    where('date', '<=', filter.endDate)
  );
  
  if (filter.departmentId) {
    q = query(q, where('departmentId', '==', filter.departmentId));
  }
  
  const snapshot = await getDocs(q);
  let entries = snapshot.docs.map(d => d.data() as TeamCalendarEntry);
  
  // Filter by status
  if (!filter.includeApproved) {
    entries = entries.filter(e => e.status !== 'approved');
  }
  if (!filter.includePending) {
    entries = entries.filter(e => e.status !== 'pending');
  }
  
  // Filter by leave types
  if (filter.leaveTypes && filter.leaveTypes.length > 0) {
    entries = entries.filter(e => filter.leaveTypes!.includes(e.leaveType));
  }
  
  return entries;
}

/**
 * Get team availability for a date range
 */
export async function getTeamAvailability(
  subsidiaryId: string,
  departmentId: string,
  startDate: string,
  endDate: string
): Promise<TeamAvailability[]> {
  // Get all approved leave entries
  const entries = await getCalendarEntries({
    subsidiaryId,
    departmentId,
    startDate,
    endDate,
    includeApproved: true,
    includePending: false,
  });
  
  // Group by date
  const entriesByDate = new Map<string, TeamCalendarEntry[]>();
  entries.forEach(entry => {
    const existing = entriesByDate.get(entry.date) || [];
    entriesByDate.set(entry.date, [...existing, entry]);
  });
  
  // Get total employees in department
  const employeesQuery = query(
    collection(db, 'employees'),
    where('subsidiaryId', '==', subsidiaryId),
    where('departmentId', '==', departmentId),
    where('status', '==', 'active')
  );
  const employeesSnapshot = await getDocs(employeesQuery);
  const totalEmployees = employeesSnapshot.size;
  
  // Build availability data
  const availability: TeamAvailability[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dateStr = formatDateString(current);
    const dayEntries = entriesByDate.get(dateStr) || [];
    
    availability.push({
      date: dateStr,
      totalEmployees,
      onLeave: dayEntries.length,
      available: totalEmployees - dayEntries.length,
      employeesOnLeave: dayEntries.map(e => ({
        id: e.employeeId,
        name: e.employeeName,
        leaveType: e.leaveType,
      })),
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  return availability;
}

/**
 * Get department leave summary for a month
 */
export async function getDepartmentLeaveSummary(
  subsidiaryId: string,
  departmentId: string,
  year: number,
  month: number
): Promise<DepartmentLeaveSummary> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  
  const entries = await getCalendarEntries({
    subsidiaryId,
    departmentId,
    startDate,
    endDate,
    includeApproved: true,
    includePending: false,
  });
  
  // Aggregate by leave type
  const byLeaveType: Record<string, number> = {};
  entries.forEach(entry => {
    byLeaveType[entry.leaveType] = (byLeaveType[entry.leaveType] || 0) + 1;
  });
  
  // Aggregate by employee
  const byEmployeeMap = new Map<string, { name: string; days: number }>();
  entries.forEach(entry => {
    const existing = byEmployeeMap.get(entry.employeeId);
    if (existing) {
      existing.days += 1;
    } else {
      byEmployeeMap.set(entry.employeeId, {
        name: entry.employeeName,
        days: 1,
      });
    }
  });
  
  return {
    byLeaveType: byLeaveType as Record<LeaveType, number>,
    byEmployee: Array.from(byEmployeeMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    })),
  };
}

// ============================================================================
// Public Holidays
// ============================================================================

/**
 * Get public holidays
 */
export async function getPublicHolidays(
  subsidiaryId: string,
  year: number
): Promise<PublicHoliday[]> {
  const q = query(
    holidaysRef,
    where('subsidiaryId', '==', subsidiaryId),
    where('year', '==', year)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as PublicHoliday);
}

/**
 * Add a public holiday
 */
export async function addPublicHoliday(
  holiday: Omit<PublicHoliday, 'id' | 'createdAt' | 'createdBy'>,
  userId: string
): Promise<PublicHoliday> {
  const id = `${holiday.subsidiaryId}_${holiday.date}`;
  
  const newHoliday: PublicHoliday = {
    id,
    ...holiday,
    createdAt: Timestamp.now(),
    createdBy: userId,
  };
  
  await setDoc(doc(holidaysRef, id), newHoliday);
  return newHoliday;
}

/**
 * Delete a public holiday
 */
export async function deletePublicHoliday(holidayId: string): Promise<void> {
  await deleteDoc(doc(holidaysRef, holidayId));
}

/**
 * Initialize Uganda public holidays for a year
 */
export async function initializeUgandaHolidays(
  subsidiaryId: string,
  year: number,
  userId: string
): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;
  
  for (const h of UGANDA_PUBLIC_HOLIDAYS_RECURRING) {
    const date = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
    const id = `${subsidiaryId}_${date}`;
    
    const holiday: PublicHoliday = {
      id,
      subsidiaryId,
      year,
      date,
      name: h.name,
      isNational: true,
      isRecurring: true,
      isOptional: false,
      createdAt: Timestamp.now(),
      createdBy: userId,
    };
    
    batch.set(doc(holidaysRef, id), holiday);
    count++;
  }
  
  await batch.commit();
  return count;
}

/**
 * Get employee calendar for a date range
 */
export async function getEmployeeCalendar(
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<TeamCalendarEntry[]> {
  const q = query(
    calendarRef,
    where('employeeId', '==', employeeId),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as TeamCalendarEntry);
}

/**
 * Check for conflicts (multiple team members on leave same day)
 */
export async function checkTeamConflicts(
  subsidiaryId: string,
  departmentId: string,
  startDate: string,
  endDate: string,
  excludeEmployeeId?: string,
  maxAllowedOnLeave: number = 2
): Promise<{ hasConflict: boolean; conflictDates: string[]; message?: string }> {
  const entries = await getCalendarEntries({
    subsidiaryId,
    departmentId,
    startDate,
    endDate,
    includeApproved: true,
    includePending: true,
  });
  
  // Filter out the requesting employee if provided
  const relevantEntries = excludeEmployeeId
    ? entries.filter(e => e.employeeId !== excludeEmployeeId)
    : entries;
  
  // Group by date
  const entriesByDate = new Map<string, TeamCalendarEntry[]>();
  relevantEntries.forEach(entry => {
    const existing = entriesByDate.get(entry.date) || [];
    entriesByDate.set(entry.date, [...existing, entry]);
  });
  
  // Find conflict dates
  const conflictDates: string[] = [];
  entriesByDate.forEach((dateEntries, date) => {
    if (dateEntries.length >= maxAllowedOnLeave) {
      conflictDates.push(date);
    }
  });
  
  if (conflictDates.length > 0) {
    return {
      hasConflict: true,
      conflictDates,
      message: `Too many team members already on leave on: ${conflictDates.join(', ')}`,
    };
  }
  
  return { hasConflict: false, conflictDates: [] };
}
