/**
 * Payroll Records Service
 * DawinOS HR Central - Advances, Overtime, Attendance Management
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  CreateAttendanceInput,
  BulkAttendanceInput,
  SalaryAdvance,
  CreateAdvanceInput,
  ApproveAdvanceInput,
  DisburseAdvanceInput,
  OvertimeEntry,
  CreateOvertimeInput,
  ApproveOvertimeInput,
  AttendanceFilters,
  AdvanceFilters,
  OvertimeFilters,
  PayrollPeriodSummary,
} from '../types/payroll-records.types';

// Collection names
const ATTENDANCE_COLLECTION = 'attendance';
const ADVANCES_COLLECTION = 'salaryAdvances';
const OVERTIME_COLLECTION = 'overtime';
const OTHER_DEDUCTIONS_COLLECTION = 'employeeDeductions';

// ============================================================================
// ATTENDANCE SERVICE
// ============================================================================

export const attendanceService = {
  /**
   * Create a single attendance record
   */
  async create(input: CreateAttendanceInput, employeeName: string, createdBy: string): Promise<AttendanceRecord> {
    const hoursWorked = input.checkInTime && input.checkOutTime
      ? calculateHoursWorked(input.checkInTime, input.checkOutTime)
      : undefined;

    const record: Omit<AttendanceRecord, 'id'> = {
      employeeId: input.employeeId,
      employeeName,
      date: input.date,
      status: input.status,
      checkInTime: input.checkInTime,
      checkOutTime: input.checkOutTime,
      hoursWorked,
      leaveType: input.leaveType,
      notes: input.notes,
      createdBy,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), record);
    return { id: docRef.id, ...record } as AttendanceRecord;
  },

  /**
   * Create bulk attendance records for a date
   */
  async createBulk(input: BulkAttendanceInput, employeeMap: Record<string, string>, createdBy: string): Promise<number> {
    const batch = writeBatch(db);
    let count = 0;

    for (const record of input.records) {
      const hoursWorked = record.checkInTime && record.checkOutTime
        ? calculateHoursWorked(record.checkInTime, record.checkOutTime)
        : undefined;

      const docRef = doc(collection(db, ATTENDANCE_COLLECTION));
      batch.set(docRef, {
        employeeId: record.employeeId,
        employeeName: employeeMap[record.employeeId] || 'Unknown',
        date: input.date,
        status: record.status,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        hoursWorked,
        notes: record.notes,
        createdBy,
        createdAt: Timestamp.now(),
      });
      count++;
    }

    await batch.commit();
    return count;
  },

  /**
   * Upsert a batch of attendance cells from the matrix UI (or a file
   * import). For each (employeeId, date) pair: update the existing
   * record's status if one exists, otherwise create a new record. Run
   * one read for the period, then chunked writes (Firestore batches cap
   * at 500 ops, we use 400 to leave headroom).
   *
   * Returns counts so the caller can show "X created, Y updated".
   */
  async upsertMatrix(
    cells: Array<{
      employeeId: string;
      date: string;
      status: AttendanceStatus;
      notes?: string;
      hoursWorked?: number;
    }>,
    employeeMap: Record<string, string>,
    createdBy: string,
    period: string, // YYYY-MM — bounds the existence query
  ): Promise<{ created: number; updated: number }> {
    if (cells.length === 0) return { created: 0, updated: 0 };

    const startDate = `${period}-01`;
    const endDate = `${period}-31`;
    const existing = await this.getRecords({ startDate, endDate });
    const existingByKey = new Map<string, string>();
    for (const rec of existing) {
      existingByKey.set(`${rec.employeeId}|${rec.date}`, rec.id);
    }

    let created = 0;
    let updated = 0;
    const CHUNK = 400;

    for (let i = 0; i < cells.length; i += CHUNK) {
      const slice = cells.slice(i, i + CHUNK);
      const batch = writeBatch(db);

      for (const cell of slice) {
        const key = `${cell.employeeId}|${cell.date}`;
        const existingId = existingByKey.get(key);
        if (existingId) {
          const ref = doc(db, ATTENDANCE_COLLECTION, existingId);
          const update: Record<string, unknown> = {
            status: cell.status,
            updatedAt: Timestamp.now(),
          };
          if (cell.notes !== undefined) update.notes = cell.notes;
          if (cell.hoursWorked !== undefined) update.hoursWorked = cell.hoursWorked;
          batch.update(ref, update);
          updated++;
        } else {
          const ref = doc(collection(db, ATTENDANCE_COLLECTION));
          batch.set(ref, {
            employeeId: cell.employeeId,
            employeeName: employeeMap[cell.employeeId] || 'Unknown',
            date: cell.date,
            status: cell.status,
            notes: cell.notes,
            hoursWorked: cell.hoursWorked,
            createdBy,
            createdAt: Timestamp.now(),
          });
          created++;
        }
      }

      await batch.commit();
    }

    return { created, updated };
  },

  /**
   * Update attendance record
   */
  async update(id: string, updates: Partial<CreateAttendanceInput>): Promise<void> {
    const docRef = doc(db, ATTENDANCE_COLLECTION, id);
    
    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    if (updates.checkInTime && updates.checkOutTime) {
      updateData.hoursWorked = calculateHoursWorked(updates.checkInTime, updates.checkOutTime);
    }

    await updateDoc(docRef, updateData);
  },

  /**
   * Delete attendance record
   */
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, ATTENDANCE_COLLECTION, id));
  },

  /**
   * Get attendance records with filters
   */
  async getRecords(filters: AttendanceFilters): Promise<AttendanceRecord[]> {
    let q = query(collection(db, ATTENDANCE_COLLECTION));

    if (filters.employeeId) {
      q = query(q, where('employeeId', '==', filters.employeeId));
    }
    if (filters.startDate && filters.endDate) {
      q = query(q, where('date', '>=', filters.startDate), where('date', '<=', filters.endDate));
    } else if (filters.startDate) {
      q = query(q, where('date', '>=', filters.startDate));
    } else if (filters.endDate) {
      q = query(q, where('date', '<=', filters.endDate));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    q = query(q, orderBy('date', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
  },

  /**
   * Get attendance for a specific month
   */
  async getMonthlyAttendance(period: string): Promise<AttendanceRecord[]> {
    const [year, month] = period.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    return this.getRecords({ startDate, endDate });
  },

  /**
   * Calculate attendance summary for an employee
   */
  async getEmployeeSummary(employeeId: string, employeeName: string, period: string): Promise<AttendanceSummary> {
    const records = await this.getRecords({
      employeeId,
      startDate: `${period}-01`,
      endDate: `${period}-31`,
    });

    const [year, month] = period.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    
    // Calculate working days (excluding weekends)
    let workingDays = 0;
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    const summary: AttendanceSummary = {
      employeeId,
      employeeName,
      period,
      totalDays,
      workingDays,
      daysPresent: records.filter(r => r.status === 'present').length,
      daysAbsent: records.filter(r => r.status === 'absent').length,
      daysLate: records.filter(r => r.status === 'late').length,
      halfDays: records.filter(r => r.status === 'half_day').length,
      leaveDays: records.filter(r => r.status === 'leave').length,
      sickDays: records.filter(r => r.status === 'sick').length,
      holidays: records.filter(r => r.status === 'holiday').length,
      weekends: records.filter(r => r.status === 'weekend').length,
      totalHoursWorked: records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
      totalOvertimeHours: records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
      attendancePercentage: 0,
    };

    // Calculate attendance percentage (present + late + half_day) / working days
    const effectiveDaysWorked = summary.daysPresent + summary.daysLate + (summary.halfDays * 0.5);
    summary.attendancePercentage = workingDays > 0 
      ? Math.round((effectiveDaysWorked / workingDays) * 100) 
      : 0;

    return summary;
  },
};

// ============================================================================
// SALARY ADVANCE SERVICE
// ============================================================================

export const advanceService = {
  /**
   * Create a salary advance request
   */
  async create(input: CreateAdvanceInput, employeeName: string, createdBy: string): Promise<SalaryAdvance> {
    const monthlyDeduction = Math.ceil(input.amount / input.repaymentMonths);

    // Optional backdated request date for entering historical advances.
    const requestDate = input.requestDate
      ? Timestamp.fromDate(new Date(input.requestDate))
      : Timestamp.now();

    const advance: Omit<SalaryAdvance, 'id'> = {
      employeeId: input.employeeId,
      employeeName,
      requestDate,
      amount: input.amount,
      reason: input.reason,
      repaymentMonths: input.repaymentMonths,
      monthlyDeduction,
      status: 'pending',
      totalRecovered: 0,
      balanceRemaining: input.amount,
      recoveryStartMonth: '',
      recoveryHistory: [],
      createdBy,
      createdAt: Timestamp.now(),
      ...(input.notes ? { notes: input.notes } : {}),
    };

    const docRef = await addDoc(collection(db, ADVANCES_COLLECTION), advance);
    return { id: docRef.id, ...advance } as SalaryAdvance;
  },

  /**
   * Approve or reject an advance request
   */
  async approve(input: ApproveAdvanceInput, approvedBy: string): Promise<void> {
    const docRef = doc(db, ADVANCES_COLLECTION, input.advanceId);
    
    await updateDoc(docRef, {
      status: input.approved ? 'approved' : 'rejected',
      approvedBy,
      approvedAt: Timestamp.now(),
      rejectionReason: input.rejectionReason,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Mark advance as disbursed
   */
  async disburse(input: DisburseAdvanceInput, disbursedBy: string): Promise<void> {
    const docRef = doc(db, ADVANCES_COLLECTION, input.advanceId);

    const disbursedAt = input.disbursedAt
      ? Timestamp.fromDate(new Date(input.disbursedAt))
      : Timestamp.now();

    await updateDoc(docRef, {
      status: 'disbursed',
      disbursedBy,
      disbursedAt,
      disbursementMethod: input.disbursementMethod,
      disbursementReference: input.disbursementReference,
      recoveryStartMonth: input.recoveryStartMonth,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Edit any field on an existing advance — used for back-entry
   * corrections (changing the amount, the recoveryStartMonth so the
   * deduction kicks in from the right month, the request /
   * disbursement dates, etc.). Recalculates monthlyDeduction and
   * balanceRemaining when the amount or term change.
   */
  async update(advanceId: string, patch: import('../types/payroll-records.types').UpdateAdvanceInput, updatedBy: string): Promise<void> {
    const docRef = doc(db, ADVANCES_COLLECTION, advanceId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Advance not found');
    const current = docSnap.data() as SalaryAdvance;

    const updates: Record<string, unknown> = {
      updatedBy,
      updatedAt: Timestamp.now(),
    };

    if (patch.amount !== undefined) updates.amount = patch.amount;
    if (patch.reason !== undefined) updates.reason = patch.reason;
    if (patch.repaymentMonths !== undefined) updates.repaymentMonths = patch.repaymentMonths;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.disbursementMethod !== undefined) updates.disbursementMethod = patch.disbursementMethod;
    if (patch.disbursementReference !== undefined) updates.disbursementReference = patch.disbursementReference;
    if (patch.recoveryStartMonth !== undefined) updates.recoveryStartMonth = patch.recoveryStartMonth;

    if (patch.requestDate) {
      updates.requestDate = Timestamp.fromDate(new Date(patch.requestDate));
    }
    if (patch.disbursedAt) {
      updates.disbursedAt = Timestamp.fromDate(new Date(patch.disbursedAt));
    }

    // Recalculate derived fields when amount or term changes.
    const nextAmount = patch.amount ?? current.amount;
    const nextMonths = patch.repaymentMonths ?? current.repaymentMonths;
    if (patch.amount !== undefined || patch.repaymentMonths !== undefined) {
      updates.monthlyDeduction = Math.ceil(nextAmount / nextMonths);
    }
    if (patch.amount !== undefined) {
      updates.balanceRemaining = Math.max(0, nextAmount - current.totalRecovered);
    }

    await updateDoc(docRef, updates);
  },

  /**
   * Reverse a previously-applied recovery. Looks up the entry keyed by
   * payrollId in recoveryHistory; if found, removes it and adds the
   * amount back to balanceRemaining. Idempotent — calling twice for
   * the same payrollId is a no-op after the first.
   */
  async reverseRecovery(advanceId: string, payrollId: string): Promise<void> {
    const docRef = doc(db, ADVANCES_COLLECTION, advanceId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const advance = docSnap.data() as SalaryAdvance;
    const history = advance.recoveryHistory || [];
    const entry = history.find(h => h.payrollId === payrollId);
    if (!entry) return;

    const remainingHistory = history.filter(h => h.payrollId !== payrollId);
    const newTotalRecovered = Math.max(0, (advance.totalRecovered || 0) - entry.amount);
    const newBalance = Math.max(0, advance.amount - newTotalRecovered);
    const lastMonth = remainingHistory.length > 0
      ? remainingHistory[remainingHistory.length - 1].month
      : undefined;

    await updateDoc(docRef, {
      totalRecovered: newTotalRecovered,
      balanceRemaining: newBalance,
      lastRecoveryMonth: lastMonth ?? null,
      // Roll back the auto-flip to fully_recovered if the balance is
      // back above zero; preserve 'disbursed' for the no-history case.
      status: newBalance <= 0
        ? 'fully_recovered'
        : remainingHistory.length > 0 ? 'partially_recovered' : 'disbursed',
      recoveryHistory: remainingHistory,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Record a recovery payment. Idempotent on payrollId — re-marking the
   * same payroll paid (e.g. after regenerate) is a no-op so we never
   * double-decrement the balance.
   */
  async recordRecovery(advanceId: string, amount: number, month: string, payrollId?: string): Promise<void> {
    const docRef = doc(db, ADVANCES_COLLECTION, advanceId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Advance not found');
    }

    const advance = docSnap.data() as SalaryAdvance;
    const history = advance.recoveryHistory || [];

    // Idempotency guard
    if (payrollId && history.some(h => h.payrollId === payrollId)) {
      return;
    }

    const newTotalRecovered = (advance.totalRecovered || 0) + amount;
    const newBalance = Math.max(0, advance.amount - newTotalRecovered);

    const recoveryEntry = {
      month,
      amount,
      payrollId,
      date: Timestamp.now(),
    };

    await updateDoc(docRef, {
      totalRecovered: newTotalRecovered,
      balanceRemaining: newBalance,
      lastRecoveryMonth: month,
      status: newBalance <= 0 ? 'fully_recovered' : 'partially_recovered',
      recoveryHistory: [...history, recoveryEntry],
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Get advances with filters
   */
  async getAdvances(filters: AdvanceFilters): Promise<SalaryAdvance[]> {
    let q = query(collection(db, ADVANCES_COLLECTION));

    if (filters.employeeId) {
      q = query(q, where('employeeId', '==', filters.employeeId));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryAdvance));
  },

  /**
   * Get active advances for payroll deduction
   */
  async getActiveAdvancesForPayroll(period: string): Promise<SalaryAdvance[]> {
    const q = query(
      collection(db, ADVANCES_COLLECTION),
      where('status', 'in', ['disbursed', 'partially_recovered']),
      where('recoveryStartMonth', '<=', period)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryAdvance));
  },

  /**
   * Hard-delete an advance. Firestore rules gate this to Admin only.
   */
  async delete(advanceId: string): Promise<void> {
    await deleteDoc(doc(db, ADVANCES_COLLECTION, advanceId));
  },

  /**
   * Get employee's active advance balance
   */
  async getEmployeeAdvanceBalance(employeeId: string): Promise<number> {
    const advances = await this.getAdvances({ 
      employeeId, 
      status: 'partially_recovered' 
    });
    
    // Also get disbursed advances
    const disbursed = await this.getAdvances({
      employeeId,
      status: 'disbursed' as any,
    });

    const allActive = [...advances, ...disbursed.filter(a => a.status === 'disbursed')];
    return allActive.reduce((sum, a) => sum + a.balanceRemaining, 0);
  },
};

// ============================================================================
// OVERTIME SERVICE
// ============================================================================

// ============================================================================
// OTHER DEDUCTIONS SERVICE (food contributions, property damage, etc.)
// ============================================================================

export const otherDeductionsService = {
  async create(
    input: import('../types/payroll-records.types').CreateEmployeeDeductionInput,
    employeeName: string,
    createdBy: string,
  ): Promise<import('../types/payroll-records.types').EmployeeDeduction> {
    const totalAmount = input.schedule === 'installments' ? Number(input.totalAmount || 0) : undefined;

    const record: Omit<import('../types/payroll-records.types').EmployeeDeduction, 'id'> = {
      employeeId: input.employeeId,
      employeeName,
      type: input.type,
      description: input.description,
      schedule: input.schedule,
      installmentAmount: Number(input.installmentAmount) || 0,
      // Deductions enter the system as `pending` and require an
      // explicit activate step (typically HR/Finance review) before
      // the payroll calculator picks them up — getOtherDeductionsForPeriod
      // filters status == 'active'.
      status: 'pending',
      createdBy,
      createdAt: Timestamp.now(),
      ...(input.effectivePeriod ? { effectivePeriod: input.effectivePeriod } : {}),
      ...(input.startMonth ? { startMonth: input.startMonth } : {}),
      ...(input.endMonth ? { endMonth: input.endMonth } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(totalAmount ? { totalAmount, totalRecovered: 0, balanceRemaining: totalAmount } : {}),
    };

    const docRef = await addDoc(collection(db, OTHER_DEDUCTIONS_COLLECTION), record);
    return { id: docRef.id, ...record } as import('../types/payroll-records.types').EmployeeDeduction;
  },

  /**
   * Create the same deduction for multiple employees in one atomic batch.
   * Each employee gets an independent record so it can be edited or
   * cancelled per-employee later (e.g. one worker leaves a SACCO mid-year).
   * For installments, every employee starts with the same totalAmount /
   * balanceRemaining — adjust per-employee via update() if needed.
   */
  async createBulk(
    input: Omit<import('../types/payroll-records.types').CreateEmployeeDeductionInput, 'employeeId'>,
    employees: Array<{ id: string; fullName: string }>,
    createdBy: string,
  ): Promise<import('../types/payroll-records.types').EmployeeDeduction[]> {
    if (employees.length === 0) return [];
    const totalAmount = input.schedule === 'installments' ? Number(input.totalAmount || 0) : undefined;
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const created: import('../types/payroll-records.types').EmployeeDeduction[] = [];

    for (const emp of employees) {
      const ref = doc(collection(db, OTHER_DEDUCTIONS_COLLECTION));
      const record: Omit<import('../types/payroll-records.types').EmployeeDeduction, 'id'> = {
        employeeId: emp.id,
        employeeName: emp.fullName,
        type: input.type,
        description: input.description,
        schedule: input.schedule,
        installmentAmount: Number(input.installmentAmount) || 0,
        // Same gate as single create — pending until activated.
        status: 'pending',
        createdBy,
        createdAt: now,
        ...(input.effectivePeriod ? { effectivePeriod: input.effectivePeriod } : {}),
        ...(input.startMonth ? { startMonth: input.startMonth } : {}),
        ...(input.endMonth ? { endMonth: input.endMonth } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(totalAmount ? { totalAmount, totalRecovered: 0, balanceRemaining: totalAmount } : {}),
      };
      batch.set(ref, record);
      created.push({ id: ref.id, ...record } as import('../types/payroll-records.types').EmployeeDeduction);
    }

    await batch.commit();
    return created;
  },

  async update(
    deductionId: string,
    patch: import('../types/payroll-records.types').UpdateEmployeeDeductionInput,
    updatedBy: string,
  ): Promise<void> {
    const ref = doc(db, OTHER_DEDUCTIONS_COLLECTION, deductionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Deduction not found');
    const current = snap.data() as import('../types/payroll-records.types').EmployeeDeduction;

    const updates: Record<string, unknown> = {
      updatedBy,
      updatedAt: Timestamp.now(),
    };
    if (patch.type !== undefined) updates.type = patch.type;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.schedule !== undefined) updates.schedule = patch.schedule;
    if (patch.effectivePeriod !== undefined) updates.effectivePeriod = patch.effectivePeriod;
    if (patch.startMonth !== undefined) updates.startMonth = patch.startMonth;
    if (patch.endMonth !== undefined) updates.endMonth = patch.endMonth ?? null;
    if (patch.installmentAmount !== undefined) updates.installmentAmount = Number(patch.installmentAmount);
    if (patch.totalAmount !== undefined) {
      updates.totalAmount = Number(patch.totalAmount);
      // Recompute balance against the new total (preserve totalRecovered).
      const totalRecovered = current.totalRecovered ?? 0;
      updates.balanceRemaining = Math.max(0, Number(patch.totalAmount) - totalRecovered);
    }
    if (patch.reason !== undefined) updates.reason = patch.reason;
    if (patch.status !== undefined) updates.status = patch.status;

    await updateDoc(ref, updates);
  },

  async cancel(deductionId: string, cancelledBy: string): Promise<void> {
    await updateDoc(doc(db, OTHER_DEDUCTIONS_COLLECTION, deductionId), {
      status: 'cancelled',
      updatedBy: cancelledBy,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Activate a pending deduction — flips status pending → active so the
   * payroll calculator starts picking it up on the next run. No-op if
   * the record is already active; refuses for completed / cancelled.
   */
  async activate(deductionId: string, activatedBy: string): Promise<void> {
    const ref = doc(db, OTHER_DEDUCTIONS_COLLECTION, deductionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Deduction not found');
    const current = snap.data() as import('../types/payroll-records.types').EmployeeDeduction;
    if (current.status === 'active') return;
    if (current.status !== 'pending') {
      throw new Error(`Cannot activate a deduction with status: ${current.status}`);
    }
    await updateDoc(ref, {
      status: 'active',
      updatedBy: activatedBy,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Hard-delete a deduction. Firestore rules gate this to Admin only.
   */
  async delete(deductionId: string): Promise<void> {
    await deleteDoc(doc(db, OTHER_DEDUCTIONS_COLLECTION, deductionId));
  },

  async list(filters?: { employeeId?: string; status?: import('../types/payroll-records.types').OtherDeductionStatus }): Promise<import('../types/payroll-records.types').EmployeeDeduction[]> {
    let q = query(collection(db, OTHER_DEDUCTIONS_COLLECTION));
    if (filters?.employeeId) q = query(q, where('employeeId', '==', filters.employeeId));
    if (filters?.status) q = query(q, where('status', '==', filters.status));
    q = query(q, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as import('../types/payroll-records.types').EmployeeDeduction));
  },

  /**
   * Reverse a previously-applied installment recovery. Symmetric to
   * recordRecovery — looks up the entry by payrollId, removes it, and
   * adds the amount back to balanceRemaining. No-op if the entry isn't
   * present (idempotent) or the deduction isn't an installment schedule.
   */
  async reverseRecovery(deductionId: string, payrollId: string): Promise<void> {
    const docRef = doc(db, OTHER_DEDUCTIONS_COLLECTION, deductionId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const ded = docSnap.data() as import('../types/payroll-records.types').EmployeeDeduction;
    if (ded.schedule !== 'installments') return;

    const history = ded.recoveryHistory || [];
    const entry = history.find(h => h.payrollId === payrollId);
    if (!entry) return;

    const remainingHistory = history.filter(h => h.payrollId !== payrollId);
    const newTotalRecovered = Math.max(0, (ded.totalRecovered || 0) - entry.amount);
    const totalAmount = ded.totalAmount || 0;
    const newBalance = Math.max(0, totalAmount - newTotalRecovered);

    await updateDoc(docRef, {
      totalRecovered: newTotalRecovered,
      balanceRemaining: newBalance,
      recoveryHistory: remainingHistory,
      // Re-open if it had been auto-completed by the final installment.
      status: ded.status === 'completed' && newBalance > 0 ? 'active' : ded.status,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Record a recovery payment for an installment-schedule deduction.
   * Idempotent on payrollId so re-marking a regenerated payroll paid
   * doesn't double-decrement. No-op for non-installment schedules —
   * those have no balance state to maintain.
   */
  async recordRecovery(deductionId: string, amount: number, month: string, payrollId?: string): Promise<void> {
    const docRef = doc(db, OTHER_DEDUCTIONS_COLLECTION, deductionId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const ded = docSnap.data() as import('../types/payroll-records.types').EmployeeDeduction;
    if (ded.schedule !== 'installments') return;

    const history = ded.recoveryHistory || [];
    if (payrollId && history.some(h => h.payrollId === payrollId)) {
      return;
    }

    const newTotalRecovered = (ded.totalRecovered || 0) + amount;
    const totalAmount = ded.totalAmount || 0;
    const newBalance = Math.max(0, totalAmount - newTotalRecovered);

    await updateDoc(docRef, {
      totalRecovered: newTotalRecovered,
      balanceRemaining: newBalance,
      recoveryHistory: [...history, { month, amount, payrollId, date: Timestamp.now() }],
      status: newBalance <= 0 ? 'completed' : ded.status,
      updatedAt: Timestamp.now(),
    });
  },
};

// Overtime multipliers based on Uganda labor laws
const OVERTIME_MULTIPLIERS: Record<string, number> = {
  regular: 1.5,        // Normal overtime
  weekend: 2.0,        // Weekend work
  holiday: 2.0,        // Public holiday
  night: 1.25,         // Night shift differential
  straight_time: 1.0,  // Extra hours at base rate (no premium)
};

export const overtimeService = {
  /**
   * Create overtime entry
   */
  async create(input: CreateOvertimeInput, employeeName: string, hourlyRate: number, createdBy: string): Promise<OvertimeEntry> {
    const multiplier = OVERTIME_MULTIPLIERS[input.type] || 1.5;
    const amount = input.hours * hourlyRate * multiplier;

    const entry: Omit<OvertimeEntry, 'id'> = {
      employeeId: input.employeeId,
      employeeName,
      date: input.date,
      type: input.type,
      hours: input.hours,
      startTime: input.startTime,
      endTime: input.endTime,
      hourlyRate,
      multiplier,
      amount,
      reason: input.reason,
      status: 'pending',
      createdBy,
      createdAt: Timestamp.now(),
      notes: input.notes,
    };

    const docRef = await addDoc(collection(db, OVERTIME_COLLECTION), entry);
    return { id: docRef.id, ...entry } as OvertimeEntry;
  },

  /**
   * Approve or reject overtime
   */
  async approve(input: ApproveOvertimeInput, approvedBy: string): Promise<void> {
    const docRef = doc(db, OVERTIME_COLLECTION, input.overtimeId);
    
    await updateDoc(docRef, {
      status: input.approved ? 'approved' : 'rejected',
      approvedBy,
      approvedAt: Timestamp.now(),
      rejectionReason: input.rejectionReason,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Edit an existing overtime entry. Used for back-entry corrections
   * (changing the date so a previously-recorded session moves into the
   * right month, fixing the hour count, switching the type/multiplier).
   * Recalculates `amount` whenever hours, hourlyRate, or type change.
   * Refuses changes once status is 'processed'.
   */
  async update(
    overtimeId: string,
    patch: {
      date?: string;
      type?: OvertimeEntry['type'];
      hours?: number;
      hourlyRate?: number;
      startTime?: string;
      endTime?: string;
      reason?: string;
      notes?: string;
    },
    updatedBy: string,
  ): Promise<void> {
    const ref = doc(db, OVERTIME_COLLECTION, overtimeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Overtime entry not found');
    const current = snap.data() as OvertimeEntry;

    if (current.status === 'processed') {
      throw new Error('Cannot edit overtime that has already been processed in payroll');
    }

    const updates: Record<string, unknown> = {
      updatedBy,
      updatedAt: Timestamp.now(),
    };

    if (patch.date !== undefined) updates.date = patch.date;
    if (patch.type !== undefined) updates.type = patch.type;
    if (patch.hours !== undefined) updates.hours = Number(patch.hours);
    if (patch.hourlyRate !== undefined) updates.hourlyRate = Number(patch.hourlyRate);
    if (patch.startTime !== undefined) updates.startTime = patch.startTime;
    if (patch.endTime !== undefined) updates.endTime = patch.endTime;
    if (patch.reason !== undefined) updates.reason = patch.reason;
    if (patch.notes !== undefined) updates.notes = patch.notes;

    // Recompute amount + multiplier if any of the inputs changed.
    const recomputeNeeded =
      patch.hours !== undefined ||
      patch.hourlyRate !== undefined ||
      patch.type !== undefined;
    if (recomputeNeeded) {
      const nextType = patch.type ?? current.type;
      const nextHours = Number(patch.hours ?? current.hours);
      const nextRate = Number(patch.hourlyRate ?? current.hourlyRate);
      const multiplier = OVERTIME_MULTIPLIERS[nextType] || 1.5;
      updates.multiplier = multiplier;
      updates.amount = nextHours * nextRate * multiplier;
    }

    await updateDoc(ref, updates);
  },

  /**
   * Mark overtime as processed in payroll
   */
  async markProcessed(overtimeId: string, payrollPeriod: string): Promise<void> {
    const docRef = doc(db, OVERTIME_COLLECTION, overtimeId);
    
    await updateDoc(docRef, {
      status: 'processed',
      payrollPeriod,
      processedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Get overtime entries with filters
   */
  async getEntries(filters: OvertimeFilters): Promise<OvertimeEntry[]> {
    let q = query(collection(db, OVERTIME_COLLECTION));

    if (filters.employeeId) {
      q = query(q, where('employeeId', '==', filters.employeeId));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.type) {
      q = query(q, where('type', '==', filters.type));
    }
    if (filters.startDate && filters.endDate) {
      q = query(q, where('date', '>=', filters.startDate), where('date', '<=', filters.endDate));
    }

    q = query(q, orderBy('date', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OvertimeEntry));
  },

  /**
   * Get approved overtime for payroll period
   */
  async getApprovedForPayroll(period: string): Promise<OvertimeEntry[]> {
    const [year, month] = period.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    // Explicit orderBy to align with the declared composite index
    // (status ASC + date DESC). Same gotcha as in payroll-calculator's
    // getApprovedOvertimeForPeriod — without it Firestore wants an ASC
    // variant of the index.
    const q = query(
      collection(db, OVERTIME_COLLECTION),
      where('status', '==', 'approved'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc'),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OvertimeEntry));
  },

  /**
   * Get employee's total approved overtime for a period
   */
  async getEmployeeOvertimeTotal(employeeId: string, period: string): Promise<{ hours: number; amount: number }> {
    const [year, month] = period.split('-');
    const entries = await this.getEntries({
      employeeId,
      status: 'approved',
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-31`,
    });

    return {
      hours: entries.reduce((sum, e) => sum + e.hours, 0),
      amount: entries.reduce((sum, e) => sum + e.amount, 0),
    };
  },
};

// ============================================================================
// PAYROLL PERIOD SUMMARY SERVICE
// ============================================================================

export const payrollSummaryService = {
  /**
   * Get comprehensive summary for a payroll period
   */
  async getPeriodSummary(period: string, employeeCount: number): Promise<PayrollPeriodSummary> {
    const [year, month] = period.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    // Get attendance
    const attendance = await attendanceService.getRecords({ startDate, endDate });
    const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const absentDays = attendance.filter(a => a.status === 'absent').length;
    const leaveDays = attendance.filter(a => a.status === 'leave' || a.status === 'sick').length;
    
    // Calculate working days in month
    const totalDays = new Date(parseInt(year), parseInt(month), 0).getDate();
    let workingDays = 0;
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(parseInt(year), parseInt(month) - 1, day);
      if (date.getDay() !== 0 && date.getDay() !== 6) workingDays++;
    }

    // Get overtime
    const overtime = await overtimeService.getEntries({ startDate, endDate });
    const approvedOvertime = overtime.filter(o => o.status === 'approved' || o.status === 'processed');

    // Get advances
    const advances = await advanceService.getAdvances({});
    const activeAdvances = advances.filter(a => 
      a.status === 'disbursed' || a.status === 'partially_recovered'
    );
    const pendingAdvances = advances.filter(a => a.status === 'pending');

    return {
      period,
      attendance: {
        totalEmployees: employeeCount,
        avgAttendanceRate: attendance.length > 0 
          ? Math.round((presentDays / (workingDays * employeeCount)) * 100)
          : 0,
        totalWorkingDays: workingDays,
        totalAbsentDays: absentDays,
        totalLeaveDays: leaveDays,
      },
      overtime: {
        totalEntries: approvedOvertime.length,
        totalHours: approvedOvertime.reduce((sum, o) => sum + o.hours, 0),
        totalAmount: approvedOvertime.reduce((sum, o) => sum + o.amount, 0),
        pendingApproval: overtime.filter(o => o.status === 'pending').length,
      },
      advances: {
        activeAdvances: activeAdvances.length,
        totalOutstanding: activeAdvances.reduce((sum, a) => sum + a.balanceRemaining, 0),
        monthlyRecovery: activeAdvances.reduce((sum, a) => sum + a.monthlyDeduction, 0),
        newRequests: pendingAdvances.length,
      },
    };
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateHoursWorked(checkIn: string, checkOut: string): number {
  const [inHours, inMins] = checkIn.split(':').map(Number);
  const [outHours, outMins] = checkOut.split(':').map(Number);
  
  const inMinutes = inHours * 60 + inMins;
  const outMinutes = outHours * 60 + outMins;
  
  const totalMinutes = outMinutes - inMinutes;
  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
}

// Export all services
export default {
  attendance: attendanceService,
  advance: advanceService,
  overtime: overtimeService,
  summary: payrollSummaryService,
};
