/**
 * Media Plan & Buy service — CRUD operations against Firestore.
 *
 * Collections:
 *   media_plans/{planId}
 *   media_plans/{planId}/media_buys/{buyId}
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { MediaPlan, MediaPlanStatus } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';

const PLANS_COLL = 'media_plans';
const BUYS_SUBCOLL = 'media_buys';

// ─────────────────────────────────────────────────────────────────
// MediaPlan CRUD
// ─────────────────────────────────────────────────────────────────

export async function createMediaPlan(
  input: Omit<MediaPlan, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<MediaPlan> {
  const ref = await addDoc(collection(db, PLANS_COLL), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getMediaPlan(ref.id) as Promise<MediaPlan>;
}

export async function getMediaPlan(planId: string): Promise<MediaPlan | null> {
  const snap = await getDoc(doc(db, PLANS_COLL, planId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<MediaPlan, 'id'>) };
}

export async function listMediaPlans(filters: {
  masterJobId?: string;
  campaignId?: string;
  status?: MediaPlanStatus;
  subsidiaryOrgId?: string;
} = {}): Promise<MediaPlan[]> {
  const constraints = [];
  if (filters.masterJobId) constraints.push(where('masterJobId', '==', filters.masterJobId));
  if (filters.campaignId)  constraints.push(where('campaignId',  '==', filters.campaignId));
  if (filters.status)      constraints.push(where('status',      '==', filters.status));
  if (filters.subsidiaryOrgId) constraints.push(where('subsidiaryOrgId', '==', filters.subsidiaryOrgId));

  const q = constraints.length
    ? query(collection(db, PLANS_COLL), ...constraints, orderBy('createdAt', 'desc'))
    : query(collection(db, PLANS_COLL), orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaPlan, 'id'>) }));
}

export async function updateMediaPlan(
  planId: string,
  updates: Partial<Omit<MediaPlan, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<void> {
  await updateDoc(doc(db, PLANS_COLL, planId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function closeMediaPlan(planId: string): Promise<void> {
  await updateMediaPlan(planId, { status: 'CLOSED' });
}

// ─────────────────────────────────────────────────────────────────
// MediaBuy CRUD
// ─────────────────────────────────────────────────────────────────

export async function addMediaBuy(
  planId: string,
  input: Omit<MediaBuy, 'id' | 'planId' | 'actualMinor' | 'createdAt' | 'updatedAt'>,
): Promise<MediaBuy> {
  const buysRef = collection(db, PLANS_COLL, planId, BUYS_SUBCOLL);
  const ref = await addDoc(buysRef, {
    ...input,
    planId,
    actualMinor: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<MediaBuy, 'id'>) };
}

export async function listMediaBuys(planId: string): Promise<MediaBuy[]> {
  const snap = await getDocs(
    query(
      collection(db, PLANS_COLL, planId, BUYS_SUBCOLL),
      orderBy('startDate'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaBuy, 'id'>) }));
}

export async function updateMediaBuy(
  planId: string,
  buyId: string,
  updates: Partial<Omit<MediaBuy, 'id' | 'planId' | 'createdAt' | 'createdBy'>>,
): Promise<void> {
  await updateDoc(doc(db, PLANS_COLL, planId, BUYS_SUBCOLL, buyId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMediaBuy(planId: string, buyId: string): Promise<void> {
  await deleteDoc(doc(db, PLANS_COLL, planId, BUYS_SUBCOLL, buyId));
}

// ─────────────────────────────────────────────────────────────────
// Variance helper
// ─────────────────────────────────────────────────────────────────

/**
 * Compute the variance percentage between planned and actual spend.
 * Returns a positive number when actual > planned (overspend),
 * negative when underspent. Returns 0 when planned is zero.
 */
export function computeVariancePct(
  plannedMinor: number,
  actualMinor: number,
): number {
  if (plannedMinor === 0) return 0;
  return ((actualMinor - plannedMinor) / plannedMinor) * 100;
}
