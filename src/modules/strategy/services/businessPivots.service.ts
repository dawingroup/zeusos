// ============================================================================
// BUSINESS PIVOTS SERVICE - ZeusOS CEO Strategy Command
// Firestore CRUD for company-level business pivots
// Collection: companies/{companyId}/business_pivots/{pivotId}
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import type { BusinessPivot } from '../types/strategy.types';

const COLLECTION = 'business_pivots';

function getPivotsCollection(companyId: string) {
  return collection(db, 'companies', companyId, COLLECTION);
}

function getPivotDoc(companyId: string, pivotId: string) {
  return doc(db, 'companies', companyId, COLLECTION, pivotId);
}

// ----------------------------------------------------------------------------
// CRUD Operations
// ----------------------------------------------------------------------------

export async function createPivot(
  companyId: string,
  pivot: Omit<BusinessPivot, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<BusinessPivot> {
  const now = new Date().toISOString();
  const pivotRef = doc(getPivotsCollection(companyId));
  const newPivot: BusinessPivot = {
    ...pivot,
    id: pivotRef.id,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(pivotRef, newPivot);
  return newPivot;
}

export async function getPivot(
  companyId: string,
  pivotId: string,
): Promise<BusinessPivot | null> {
  const snap = await getDoc(getPivotDoc(companyId, pivotId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as BusinessPivot;
}

export async function listPivots(
  companyId: string,
  statusFilter?: string,
): Promise<BusinessPivot[]> {
  let q = query(getPivotsCollection(companyId), orderBy('pivotDate', 'desc'));
  if (statusFilter) {
    q = query(
      getPivotsCollection(companyId),
      where('status', '==', statusFilter),
      orderBy('pivotDate', 'desc'),
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessPivot));
}

export async function updatePivot(
  companyId: string,
  pivotId: string,
  data: Partial<BusinessPivot>,
): Promise<void> {
  await updateDoc(getPivotDoc(companyId, pivotId), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deletePivot(
  companyId: string,
  pivotId: string,
): Promise<void> {
  await deleteDoc(getPivotDoc(companyId, pivotId));
}

export function subscribeToPivots(
  companyId: string,
  callback: (pivots: BusinessPivot[]) => void,
): Unsubscribe {
  const q = query(getPivotsCollection(companyId), orderBy('pivotDate', 'desc'));
  return onSnapshot(q, (snap) => {
    const pivots = snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessPivot));
    callback(pivots);
  });
}

export const businessPivotsService = {
  createPivot,
  getPivot,
  listPivots,
  updatePivot,
  deletePivot,
  subscribeToPivots,
};
