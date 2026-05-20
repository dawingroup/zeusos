/**
 * Stock Service
 * Atomic stock mutations for product variants using Firestore transactions.
 * All stock changes go through this service — never update quantityOnHand directly.
 *
 * Subcollections:
 * - `productVariants/{variantId}/stockTransactions/{txnId}`
 * - `productVariants/{variantId}/reservations/{resId}`
 */

import {
  doc,
  collection,
  collectionGroup,
  runTransaction,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Timestamp } from 'firebase/firestore';
import type {
  StockTransaction,
  TransactionType,
  StockReservation,
  ReservationReleaseReason,
} from '../types';

const VARIANT_COLLECTION = 'productVariants';

// ============================================
// Stock Transactions
// ============================================

interface RecordStockTransactionOptions {
  unitCost?: number;
  referenceType?: 'purchase_order' | 'goods_receipt' | 'project' | 'estimate' | 'manual';
  referenceId?: string;
  referenceName?: string;
  locationId?: string;
  locationName?: string;
  notes?: string;
}

/**
 * Record a stock transaction and update the variant's running totals.
 * Uses a Firestore transaction for atomicity.
 */
export async function recordStockTransaction(
  variantId: string,
  type: TransactionType,
  quantity: number,
  options?: RecordStockTransactionOptions
): Promise<StockTransaction> {
  const variantRef = doc(db, VARIANT_COLLECTION, variantId);

  return runTransaction(db, async (txn) => {
    const variantSnap = await txn.get(variantRef);
    if (!variantSnap.exists()) throw new Error(`Variant not found: ${variantId}`);

    const variant = variantSnap.data();

    // Compute new balance
    const newOnHand = (variant.quantityOnHand || 0) + quantity;
    const newAvailable = newOnHand - (variant.quantityReserved || 0);

    // Prevent negative stock
    if (newOnHand < 0) {
      throw new Error(`Insufficient stock: current ${variant.quantityOnHand}, requested ${quantity}`);
    }

    // Update average cost on goods receipt
    let newAvgCost = variant.averageCost || 0;
    if (type === 'goods_receipt' && options?.unitCost && quantity > 0) {
      const totalExistingValue = (variant.averageCost || 0) * (variant.quantityOnHand || 0);
      const incomingValue = options.unitCost * quantity;
      newAvgCost = newOnHand > 0 ? (totalExistingValue + incomingValue) / newOnHand : 0;
    }

    // Create transaction record in subcollection
    const txnCollRef = collection(db, VARIANT_COLLECTION, variantId, 'stockTransactions');
    const txnDocRef = doc(txnCollRef);

    const transaction: Omit<StockTransaction, 'id'> = {
      variantId,
      variantKey: variant.variantKey,
      productId: variant.productId,
      type,
      quantity,
      unitCost: options?.unitCost,
      totalCost: options?.unitCost ? options.unitCost * Math.abs(quantity) : undefined,
      referenceType: options?.referenceType,
      referenceId: options?.referenceId,
      referenceName: options?.referenceName,
      locationId: options?.locationId || 'main',
      locationName: options?.locationName || 'Main Workshop',
      balanceAfter: newOnHand,
      notes: options?.notes,
      createdAt: Timestamp.now(),
      createdBy: '', // Will be set by caller context
    };

    txn.set(txnDocRef, { ...transaction, id: txnDocRef.id });

    // Update variant totals
    const variantUpdates: Record<string, unknown> = {
      quantityOnHand: newOnHand,
      quantityAvailable: newAvailable,
      averageCost: newAvgCost,
      updatedAt: serverTimestamp(),
    };

    if (type === 'goods_receipt' && options?.unitCost) {
      variantUpdates.lastPurchaseCost = options.unitCost;
    }

    txn.update(variantRef, variantUpdates);

    return { ...transaction, id: txnDocRef.id } as StockTransaction;
  });
}

// ============================================
// Stock Reservations
// ============================================

const DEFAULT_EXPIRY_DAYS = 30;

/**
 * Reserve stock for an estimate/order.
 * Creates a tracked reservation with an expiry date.
 */
export async function reserveStock(
  variantId: string,
  quantity: number,
  reference: { type: 'estimate' | 'project' | 'order'; id: string; name: string },
  userId: string,
  expiryDays: number = DEFAULT_EXPIRY_DAYS
): Promise<StockReservation> {
  const variantRef = doc(db, VARIANT_COLLECTION, variantId);

  return runTransaction(db, async (txn) => {
    const variantSnap = await txn.get(variantRef);
    if (!variantSnap.exists()) throw new Error(`Variant not found: ${variantId}`);

    const variant = variantSnap.data();
    const available = variant.quantityAvailable || 0;

    if (available < quantity) {
      throw new Error(`Only ${available} available, cannot reserve ${quantity}`);
    }

    const resCollRef = collection(db, VARIANT_COLLECTION, variantId, 'reservations');
    const resDocRef = doc(resCollRef);

    const reservation: Omit<StockReservation, 'id'> = {
      variantId,
      quantity,
      referenceType: reference.type,
      referenceId: reference.id,
      referenceName: reference.name,
      status: 'active',
      expiresAt: Timestamp.fromDate(
        new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      ),
      createdAt: Timestamp.now(),
      createdBy: userId,
    };

    txn.set(resDocRef, { ...reservation, id: resDocRef.id });

    txn.update(variantRef, {
      quantityReserved: (variant.quantityReserved || 0) + quantity,
      quantityAvailable: available - quantity,
      updatedAt: serverTimestamp(),
    });

    return { ...reservation, id: resDocRef.id } as StockReservation;
  });
}

/**
 * Release a specific reservation.
 */
export async function releaseReservation(
  variantId: string,
  reservationId: string,
  reason: ReservationReleaseReason
): Promise<void> {
  const variantRef = doc(db, VARIANT_COLLECTION, variantId);
  const reservationRef = doc(db, VARIANT_COLLECTION, variantId, 'reservations', reservationId);

  return runTransaction(db, async (txn) => {
    const resSnap = await txn.get(reservationRef);
    if (!resSnap.exists()) return;

    const reservation = resSnap.data();
    if (reservation.status !== 'active') return; // already released

    const variantSnap = await txn.get(variantRef);
    if (!variantSnap.exists()) return;

    const variant = variantSnap.data();
    const newReserved = Math.max(0, (variant.quantityReserved || 0) - reservation.quantity);

    txn.update(reservationRef, {
      status: reason === 'fulfilled' ? 'fulfilled' : 'released',
      releasedAt: serverTimestamp(),
      releaseReason: reason,
    });

    txn.update(variantRef, {
      quantityReserved: newReserved,
      quantityAvailable: (variant.quantityOnHand || 0) - newReserved,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Release all expired reservations across all variants.
 * Run as a scheduled Cloud Function or on-demand.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = Timestamp.now();
  const expiredQuery = query(
    collectionGroup(db, 'reservations'),
    where('status', '==', 'active'),
    where('expiresAt', '<=', now)
  );

  const expired = await getDocs(expiredQuery);
  let released = 0;

  for (const expiredDoc of expired.docs) {
    const reservation = expiredDoc.data() as StockReservation;
    await releaseReservation(reservation.variantId, expiredDoc.id, 'expired');
    released++;
  }

  return released;
}
