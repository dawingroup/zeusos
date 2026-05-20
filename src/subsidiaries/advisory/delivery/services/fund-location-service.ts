/**
 * FUND LOCATION SERVICE
 *
 * Manages fund locations (treasury, regional/field offices) and inter-location
 * fund transfers. Computes real-time balances from confirmed transfers and
 * payments disbursed from each location.
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
  serverTimestamp,
  Firestore,
  QueryConstraint,
} from 'firebase/firestore';
import type {
  FundLocation,
  FundLocationBalance,
  FundTransfer,
  FundTransferStatus,
  TransferLineItem,
} from '../types/fund-location';
import type { Money } from '../../core/types/money';
import type { TransactionExchangeRate } from '../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const BASE_PATH = 'organizations/default/advisory_programs';
const PAYMENTS_PATH = 'payments';

// ─────────────────────────────────────────────────────────────────
// FUND LOCATION SERVICE
// ─────────────────────────────────────────────────────────────────

export class FundLocationService {
  private static instance: FundLocationService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): FundLocationService {
    if (!FundLocationService.instance) {
      FundLocationService.instance = new FundLocationService(db);
    }
    return FundLocationService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private getLocationsRef(programId: string) {
    return collection(this.db, `${BASE_PATH}/${programId}/fund_locations`);
  }

  private getTransfersRef(programId: string) {
    return collection(this.db, `${BASE_PATH}/${programId}/fund_transfers`);
  }

  // ─────────────────────────────────────────────────────────────────
  // LOCATION CRUD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new fund location within a program.
   */
  async createLocation(
    programId: string,
    data: Omit<FundLocation, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<string> {
    const colRef = this.getLocationsRef(programId);

    const docData = {
      ...data,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  }

  /**
   * Get all fund locations for a program, ordered by type then name.
   */
  async getLocations(programId: string): Promise<FundLocation[]> {
    const colRef = this.getLocationsRef(programId);

    const q = query(colRef, orderBy('type', 'asc'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as FundLocation[];
  }

  /**
   * Update fields on a fund location.
   */
  async updateLocation(
    programId: string,
    locationId: string,
    updates: Partial<FundLocation>,
    _userId: string
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_locations`,
      locationId
    );

    // Strip id to avoid overwriting the doc key
    const { id: _id, ...rest } = updates;

    await updateDoc(docRef, {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Deactivate a fund location (soft-delete).
   */
  async deactivateLocation(
    programId: string,
    locationId: string,
    _userId: string
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_locations`,
      locationId
    );

    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // TRANSFER OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new inter-location fund transfer.
   */
  async createTransfer(
    programId: string,
    data: Omit<FundTransfer, 'id' | 'createdBy' | 'createdAt'>,
    userId: string
  ): Promise<string> {
    const colRef = this.getTransfersRef(programId);

    // Filter out undefined values — Firestore rejects them
    const docData = Object.fromEntries(
      Object.entries({
        ...data,
        createdBy: userId,
        createdAt: serverTimestamp(),
      }).filter(([_, v]) => v !== undefined)
    );

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  }

  /**
   * Get a single fund transfer by ID.
   */
  async getTransfer(
    programId: string,
    transferId: string
  ): Promise<FundTransfer | null> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_transfers`,
      transferId
    );
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as FundTransfer;
  }

  /**
   * Update a pending fund transfer's editable fields.
   * Only allowed when status is 'pending'.
   */
  async updateTransfer(
    programId: string,
    transferId: string,
    updates: {
      amount?: Money;
      exchangeRate?: TransactionExchangeRate;
      convertedAmount?: Money;
      reference?: string;
      purpose?: string;
      lineItems?: TransferLineItem[];
      transferDate?: Date;
    },
    userId: string
  ): Promise<void> {
    const existing = await this.getTransfer(programId, transferId);
    if (!existing) {
      throw new Error(`Transfer ${transferId} not found`);
    }
    if (existing.status !== 'pending') {
      throw new Error(`Cannot update transfer with status '${existing.status}'. Only pending transfers can be edited.`);
    }

    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_transfers`,
      transferId
    );

    // Filter out undefined values — Firestore rejects them
    const updateData = Object.fromEntries(
      Object.entries({
        ...updates,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      }).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(docRef, updateData);
  }

  /**
   * Get transfers for a program with optional filters.
   */
  async getTransfers(
    programId: string,
    options: {
      locationId?: string;
      status?: FundTransferStatus;
    } = {}
  ): Promise<FundTransfer[]> {
    const colRef = this.getTransfersRef(programId);
    const constraints: QueryConstraint[] = [];

    if (options.status) {
      constraints.push(where('status', '==', options.status));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);

    let transfers = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as FundTransfer[];

    // Client-side filter for locationId (matches either from or to)
    if (options.locationId) {
      transfers = transfers.filter(
        t =>
          t.fromLocationId === options.locationId ||
          t.toLocationId === options.locationId
      );
    }

    return transfers;
  }

  /**
   * Confirm a pending transfer.
   */
  async confirmTransfer(
    programId: string,
    transferId: string,
    userId: string
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_transfers`,
      transferId
    );

    await updateDoc(docRef, {
      status: 'confirmed',
      confirmedAt: Timestamp.now(),
      confirmedBy: userId,
    });
  }

  /**
   * Cancel a pending transfer.
   */
  async cancelTransfer(
    programId: string,
    transferId: string,
    _userId: string
  ): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_transfers`,
      transferId
    );

    await updateDoc(docRef, {
      status: 'cancelled',
    });
  }

  async deleteTransfer(
    programId: string,
    transferId: string
  ): Promise<void> {
    const existing = await this.getTransfer(programId, transferId);
    if (!existing) throw new Error(`Transfer ${transferId} not found`);
    if (existing.status === 'confirmed') {
      throw new Error('Cannot delete a confirmed transfer. Cancel it first.');
    }
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_transfers`,
      transferId
    );
    await deleteDoc(docRef);
  }

  // ─────────────────────────────────────────────────────────────────
  // BALANCE CALCULATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Calculate the real-time balance for a fund location.
   *
   * totalReceived   = sum of confirmed inbound transfers
   * totalDisbursed  = sum of confirmed outbound transfers + paid payments
   * totalPending    = sum of approved/processing payments not yet paid
   * availableBalance = totalReceived - totalDisbursed - totalPending
   */
  async calculateBalance(
    programId: string,
    locationId: string
  ): Promise<FundLocationBalance> {
    // 1. Get the location document for metadata
    const locationRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/fund_locations`,
      locationId
    );
    const locationSnap = await getDoc(locationRef);

    if (!locationSnap.exists()) {
      throw new Error(`Fund location ${locationId} not found`);
    }

    const locationData = {
      id: locationSnap.id,
      ...locationSnap.data(),
    } as FundLocation;

    // 2. Inbound confirmed transfers (toLocationId = this location)
    const inboundQ = query(
      this.getTransfersRef(programId),
      where('toLocationId', '==', locationId),
      where('status', '==', 'confirmed')
    );
    const inboundSnap = await getDocs(inboundQ);
    const totalReceived = inboundSnap.docs.reduce((sum, d) => {
      const transfer = d.data() as FundTransfer;
      // Use convertedAmount if available (cross-currency), otherwise use amount
      const value = transfer.convertedAmount
        ? transfer.convertedAmount.amount
        : transfer.amount.amount;
      return sum + value;
    }, 0);

    // 3. Outbound confirmed transfers (fromLocationId = this location)
    const outboundQ = query(
      this.getTransfersRef(programId),
      where('fromLocationId', '==', locationId),
      where('status', '==', 'confirmed')
    );
    const outboundSnap = await getDocs(outboundQ);
    const transfersDisbursed = outboundSnap.docs.reduce((sum, d) => {
      const transfer = d.data() as FundTransfer;
      return sum + transfer.amount.amount;
    }, 0);

    // 4. Paid payments from this location
    const paidPaymentsQ = query(
      collection(this.db, PAYMENTS_PATH),
      where('fundLocationId', '==', locationId),
      where('status', '==', 'paid')
    );
    const paidPaymentsSnap = await getDocs(paidPaymentsQ);
    const paymentsDisbursed = paidPaymentsSnap.docs.reduce((sum, d) => {
      const payment = d.data();
      return sum + (payment.netAmount || 0);
    }, 0);

    const totalDisbursed = transfersDisbursed + paymentsDisbursed;

    // 5. Pending payments (approved or processing, not yet paid)
    const pendingPaymentsQ = query(
      collection(this.db, PAYMENTS_PATH),
      where('fundLocationId', '==', locationId),
      where('status', 'in', ['approved', 'processing'])
    );
    const pendingPaymentsSnap = await getDocs(pendingPaymentsQ);
    const totalPending = pendingPaymentsSnap.docs.reduce((sum, d) => {
      const payment = d.data();
      return sum + (payment.netAmount || 0);
    }, 0);

    // 6. Compute available balance
    const availableBalance = totalReceived - totalDisbursed - totalPending;

    return {
      locationId,
      locationName: locationData.name,
      locationType: locationData.type,
      currency: locationData.currency,
      totalReceived,
      totalDisbursed,
      totalPending,
      availableBalance,
      lastUpdated: new Date(),
    };
  }
}

// Export singleton factory
export function getFundLocationService(db: Firestore): FundLocationService {
  return FundLocationService.getInstance(db);
}
