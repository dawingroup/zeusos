/**
 * BUDGET PERIOD SERVICE
 *
 * Calendar-year budget period management with carry-forward workflow.
 * Each program has one active budget period per year. Unspent funds
 * require explicit carry-forward approval to roll into the next year.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  Firestore,
  QueryConstraint,
} from 'firebase/firestore';
import type {
  BudgetPeriod,
  CarryForwardRequest,
  CarryForwardStatus,
  CarryForwardProjectItem,
} from '../types/budget-period';
import { initializeBudgetPeriod } from '../types/budget-period';
import type { Money } from '../../core/types/money';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const BASE_PATH = 'organizations/default/advisory_programs';

// ─────────────────────────────────────────────────────────────────
// BUDGET PERIOD SERVICE
// ─────────────────────────────────────────────────────────────────

export class BudgetPeriodService {
  private static instance: BudgetPeriodService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): BudgetPeriodService {
    if (!BudgetPeriodService.instance) {
      BudgetPeriodService.instance = new BudgetPeriodService(db);
    }
    return BudgetPeriodService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private getPeriodsRef(programId: string) {
    return collection(this.db, `${BASE_PATH}/${programId}/budget_periods`);
  }

  private getCarryForwardRef(programId: string) {
    return collection(
      this.db,
      `${BASE_PATH}/${programId}/carry_forward_requests`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // BUDGET PERIOD CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new budget period for a calendar year.
   * Uses the `initializeBudgetPeriod` helper to build defaults.
   */
  async createPeriod(
    programId: string,
    year: number,
    allocatedBudget: Money,
    carryForward?: Money,
    userId?: string
  ): Promise<string> {
    const colRef = this.getPeriodsRef(programId);

    const periodData = initializeBudgetPeriod(
      programId,
      year,
      allocatedBudget,
      carryForward
    );

    const docData = {
      ...periodData,
      createdBy: userId || '',
      createdAt: serverTimestamp(),
      updatedBy: userId || '',
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  }

  /**
   * Get all budget periods for a program, ordered by year descending.
   */
  async getPeriods(programId: string): Promise<BudgetPeriod[]> {
    const colRef = this.getPeriodsRef(programId);

    const q = query(colRef, orderBy('year', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as BudgetPeriod[];
  }

  /**
   * Get the currently active budget period for a program.
   */
  async getActivePeriod(programId: string): Promise<BudgetPeriod | null> {
    const colRef = this.getPeriodsRef(programId);

    const q = query(
      colRef,
      where('status', '==', 'active'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as BudgetPeriod;
  }

  /**
   * Update fields on a budget period.
   */
  async updatePeriod(
    programId: string,
    periodId: string,
    updates: Partial<BudgetPeriod>,
    userId: string
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/budget_periods`,
      periodId
    );

    // Strip id to avoid overwriting the doc key
    const { id: _id, ...rest } = updates;

    await updateDoc(docRef, {
      ...rest,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Close a budget period (no further spending allowed).
   */
  async closePeriod(
    programId: string,
    periodId: string,
    userId: string
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/budget_periods`,
      periodId
    );

    await updateDoc(docRef, {
      status: 'closed',
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Activate a budget period (transition from planning to active).
   */
  async activatePeriod(
    programId: string,
    periodId: string,
    userId: string
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/budget_periods`,
      periodId
    );

    await updateDoc(docRef, {
      status: 'active',
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // CARRY-FORWARD WORKFLOW
  // ─────────────────────────────────────────────────────────────────

  /**
   * Submit a carry-forward request for unspent funds.
   */
  async requestCarryForward(
    programId: string,
    data: {
      fromPeriodId: string;
      fromYear: number;
      toYear: number;
      amount: Money;
      justification: string;
      projectBreakdown: CarryForwardProjectItem[];
    },
    userId: string
  ): Promise<string> {
    const colRef = this.getCarryForwardRef(programId);

    const docData: Omit<CarryForwardRequest, 'id'> = {
      programId,
      fromPeriodId: data.fromPeriodId,
      fromYear: data.fromYear,
      toYear: data.toYear,
      amount: data.amount,
      justification: data.justification,
      projectBreakdown: data.projectBreakdown,
      status: 'pending',
      requestedBy: userId,
      requestedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  }

  /**
   * Get carry-forward requests for a program, with optional filters.
   */
  async getCarryForwardRequests(
    programId: string,
    options: {
      year?: number;
      status?: CarryForwardStatus;
    } = {}
  ): Promise<CarryForwardRequest[]> {
    const colRef = this.getCarryForwardRef(programId);
    const constraints: QueryConstraint[] = [];

    if (options.year) {
      constraints.push(where('fromYear', '==', options.year));
    }

    if (options.status) {
      constraints.push(where('status', '==', options.status));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as CarryForwardRequest[];
  }

  /**
   * Approve a carry-forward request.
   *
   * 1. Marks the request as approved.
   * 2. Finds or creates the target budget period for toYear.
   * 3. Updates the target period's carryForwardReceived and totalAvailable.
   */
  async approveCarryForward(
    programId: string,
    requestId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    // 1. Get the carry-forward request
    const requestRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/carry_forward_requests`,
      requestId
    );
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error('Carry-forward request not found');
    }

    const request = {
      id: requestSnap.id,
      ...requestSnap.data(),
    } as CarryForwardRequest;

    // 2. Update the request status
    await updateDoc(requestRef, {
      status: 'approved',
      reviewedBy: userId,
      reviewedAt: Timestamp.now(),
      ...(notes ? { reviewNotes: notes } : {}),
    });

    // 3. Find the target budget period for toYear
    const periodsRef = this.getPeriodsRef(programId);
    const targetQ = query(
      periodsRef,
      where('year', '==', request.toYear),
      limit(1)
    );
    const targetSnap = await getDocs(targetQ);

    let targetPeriodId: string;

    if (targetSnap.empty) {
      // Create a new budget period for the target year with zero allocation
      const zeroBudget: Money = {
        amount: 0,
        currency: request.amount.currency,
      };
      targetPeriodId = await this.createPeriod(
        programId,
        request.toYear,
        zeroBudget,
        request.amount,
        userId
      );
    } else {
      // Update existing target period
      targetPeriodId = targetSnap.docs[0].id;
      const targetPeriod = {
        id: targetSnap.docs[0].id,
        ...targetSnap.docs[0].data(),
      } as BudgetPeriod;

      const newCarryForwardReceived: Money = {
        amount:
          targetPeriod.carryForwardReceived.amount + request.amount.amount,
        currency: targetPeriod.carryForwardReceived.currency,
      };

      const newTotalAvailable: Money = {
        amount: targetPeriod.totalAvailable.amount + request.amount.amount,
        currency: targetPeriod.totalAvailable.currency,
      };

      const targetRef = doc(
        this.db,
        `${BASE_PATH}/${programId}/budget_periods`,
        targetPeriodId
      );
      await updateDoc(targetRef, {
        carryForwardReceived: newCarryForwardReceived,
        totalAvailable: newTotalAvailable,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      });
    }

    // 4. Link the request to the target period
    await updateDoc(requestRef, {
      toPeriodId: targetPeriodId,
    });
  }

  /**
   * Reject a carry-forward request.
   */
  async rejectCarryForward(
    programId: string,
    requestId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const requestRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/carry_forward_requests`,
      requestId
    );

    await updateDoc(requestRef, {
      status: 'rejected',
      reviewedBy: userId,
      reviewedAt: Timestamp.now(),
      ...(notes ? { reviewNotes: notes } : {}),
    });
  }
}

// Export singleton factory
export function getBudgetPeriodService(db: Firestore): BudgetPeriodService {
  return BudgetPeriodService.getInstance(db);
}
