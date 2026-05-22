/**
 * Media Actuals service — post and list reconciliation records.
 *
 * Collection: media_plans/{planId}/actuals/{actualId}
 *
 * After posting an actual, this service also updates the parent buy's
 * `actualMinor` field so the buy grid shows a live reconciled figure
 * without a subcollection query per row.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { MediaActual } from '../types/media-actual.types';

const PLANS_COLL   = 'media_plans';
const ACTUALS_SUBCOLL = 'actuals';
const BUYS_SUBCOLL    = 'media_buys';

export async function postActual(
  planId: string,
  input: Omit<MediaActual, 'id' | 'planId' | 'createdAt'>,
): Promise<MediaActual> {
  const actualsRef = collection(db, PLANS_COLL, planId, ACTUALS_SUBCOLL);
  const ref = await addDoc(actualsRef, {
    ...input,
    planId,
    createdAt: serverTimestamp(),
  });

  // Reflect actualMinor onto the parent buy for quick grid reads.
  await updateDoc(
    doc(db, PLANS_COLL, planId, BUYS_SUBCOLL, input.buyId),
    { actualMinor: input.actualMinor, updatedAt: serverTimestamp() },
  );

  return { id: ref.id, planId, ...input, createdAt: new Date().toISOString() };
}

export async function listActuals(planId: string): Promise<MediaActual[]> {
  const snap = await getDocs(
    query(
      collection(db, PLANS_COLL, planId, ACTUALS_SUBCOLL),
      orderBy('reportedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaActual, 'id'>) }));
}
