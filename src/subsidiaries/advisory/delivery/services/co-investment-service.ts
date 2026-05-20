/**
 * CO-INVESTMENT SERVICE
 *
 * CRUD operations for program-level co-investment tracking.
 * Tracks donor and client contributions with pledged, disbursed, and spent amounts.
 * Stored in `organizations/default/advisory_programs/{programId}/co_investments`.
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  Firestore,
  CollectionReference,
} from 'firebase/firestore';
import type {
  CoInvestmentEntry,
  CoInvestmentSourceType,
} from '../types/program-budget';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const BASE_PATH = 'organizations/default/advisory_programs';

// ─────────────────────────────────────────────────────────────────
// CO-INVESTMENT SERVICE
// ─────────────────────────────────────────────────────────────────

export class CoInvestmentService {
  private static instance: CoInvestmentService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): CoInvestmentService {
    if (!CoInvestmentService.instance) {
      CoInvestmentService.instance = new CoInvestmentService(db);
    }
    return CoInvestmentService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private getCollectionRef(programId: string): CollectionReference {
    return collection(
      this.db,
      `${BASE_PATH}/${programId}/co_investments`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get all co-investment entries for a program, ordered by creation date desc.
   */
  async getEntries(programId: string): Promise<CoInvestmentEntry[]> {
    const colRef = this.getCollectionRef(programId);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        programId: data.programId,
        projectId: data.projectId ?? '',
        projectName: data.projectName ?? '',
        sourceType: data.sourceType,
        sourceName: data.sourceName,
        pledged: data.pledged,
        disbursed: data.disbursed,
        spent: data.spent,
        conditions: data.conditions,
        isConfirmed: data.isConfirmed ?? false,
        budgetPeriodId: data.budgetPeriodId,
        notes: data.notes,
        createdBy: data.createdBy,
        createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : data.updatedAt,
      } as CoInvestmentEntry;
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // WRITE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a new co-investment entry.
   */
  async addEntry(
    programId: string,
    data: {
      projectId: string;
      projectName: string;
      sourceType: CoInvestmentSourceType;
      sourceName: string;
      pledgedAmount: number;
      currency: string;
      conditions?: string;
      isConfirmed?: boolean;
      budgetPeriodId?: string;
      notes?: string;
    },
    userId: string
  ): Promise<string> {
    const colRef = this.getCollectionRef(programId);
    const now = Timestamp.now();
    const currency = data.currency;

    const docData = {
      programId,
      projectId: data.projectId,
      projectName: data.projectName,
      sourceType: data.sourceType,
      sourceName: data.sourceName,
      pledged: { amount: data.pledgedAmount, currency },
      disbursed: { amount: 0, currency },
      spent: { amount: 0, currency },
      isConfirmed: data.isConfirmed ?? false,
      ...(data.conditions ? { conditions: data.conditions } : {}),
      ...(data.budgetPeriodId ? { budgetPeriodId: data.budgetPeriodId } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  }

  /**
   * Update disbursed and/or spent amounts for a co-investment entry.
   */
  async updateAmounts(
    programId: string,
    entryId: string,
    updates: {
      disbursedAmount?: number;
      spentAmount?: number;
      pledgedAmount?: number;
      isConfirmed?: boolean;
      notes?: string;
      projectId?: string;
      projectName?: string;
    }
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/co_investments`,
      entryId
    );

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (updates.disbursedAmount !== undefined) {
      updateData['disbursed.amount'] = updates.disbursedAmount;
    }
    if (updates.spentAmount !== undefined) {
      updateData['spent.amount'] = updates.spentAmount;
    }
    if (updates.pledgedAmount !== undefined) {
      updateData['pledged.amount'] = updates.pledgedAmount;
    }
    if (updates.isConfirmed !== undefined) {
      updateData.isConfirmed = updates.isConfirmed;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }
    if (updates.projectId !== undefined) {
      updateData.projectId = updates.projectId;
    }
    if (updates.projectName !== undefined) {
      updateData.projectName = updates.projectName;
    }

    await updateDoc(docRef, updateData);
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Delete a co-investment entry.
   */
  async deleteEntry(programId: string, entryId: string): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/co_investments`,
      entryId
    );
    await deleteDoc(docRef);
  }
}

// Export singleton factory
export function getCoInvestmentService(db: Firestore): CoInvestmentService {
  return CoInvestmentService.getInstance(db);
}
