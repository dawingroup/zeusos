/**
 * Regulatory-change service — Phase 2.4.
 *
 * Firestore CRUD for the top-level `regulatory_changes` register. Reads are
 * group-wide reference data (any staff principal); writes are gated to
 * compliance/parent-org in firestore.rules.
 *
 * `getRegulatoryChangesForSectors` is the read the client Strategy Assistant
 * (Phase 3) uses to surface a client's regulatory exposure.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { RegulatoryChange, RegulatoryChangeInput } from '../types/regulatory.types';

const COLLECTION = 'regulatory_changes';

/** All regulatory changes, newest effective-date first. */
export async function getRegulatoryChanges(): Promise<RegulatoryChange[]> {
  const q = query(collection(db, COLLECTION), orderBy('effectiveDate', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegulatoryChange));
}

/**
 * Regulatory changes touching any of the given sectors, newest first.
 * Firestore `array-contains-any` caps at 10 sectors — clients rarely carry
 * more than a couple, so a single query suffices.
 */
export async function getRegulatoryChangesForSectors(
  sectors: string[],
): Promise<RegulatoryChange[]> {
  const tags = (sectors || []).map((s) => s.toLowerCase()).filter(Boolean).slice(0, 10);
  if (tags.length === 0) return [];
  const q = query(
    collection(db, COLLECTION),
    where('sector', 'array-contains-any', tags),
    orderBy('effectiveDate', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegulatoryChange));
}

export async function getRegulatoryChange(id: string): Promise<RegulatoryChange | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as RegulatoryChange) : null;
}

export async function createRegulatoryChange(
  input: RegulatoryChangeInput,
  createdBy?: string,
): Promise<string> {
  const data = {
    ...input,
    sector: (input.sector || []).map((s) => s.toLowerCase()).filter(Boolean),
    createdBy: createdBy || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, COLLECTION), data);
  return ref.id;
}

export async function updateRegulatoryChange(
  id: string,
  patch: Partial<RegulatoryChangeInput>,
): Promise<void> {
  const data: Record<string, unknown> = { ...patch, updatedAt: Timestamp.now() };
  if (patch.sector) data.sector = patch.sector.map((s) => s.toLowerCase()).filter(Boolean);
  await updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteRegulatoryChange(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
