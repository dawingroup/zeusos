/**
 * Journal Entry service — read JEs posted by the Phase 4.1 finance consumer
 * (postJournalEntryOnInvoicePaid).
 *
 * Writes are Cloud-Function-only (firestore.rules enforces this).
 *
 * Org-scoping: queries are filtered by orgId so subsidiaries don't see
 * each other's GL postings (spec §7.4 commercial gravity).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as limitFn,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { JournalEntry, JournalEntryKind } from '../types/journal-entry.types';

const JES_COLL = 'journal_entries';

export async function getJournalEntry(jeId: string): Promise<JournalEntry | null> {
  const snap = await getDoc(doc(db, JES_COLL, jeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<JournalEntry, 'id'>) };
}

export async function listJournalEntries(filters: {
  orgId: string;
  kind?: JournalEntryKind;
  sourceDocId?: string;
  limit?: number;
} = { orgId: '' }): Promise<JournalEntry[]> {
  if (!filters.orgId) {
    throw new Error('[journal-entry] orgId filter is required (spec §7.4 commercial gravity)');
  }

  const constraints = [where('orgId', '==', filters.orgId)];
  if (filters.kind) constraints.push(where('kind', '==', filters.kind));
  if (filters.sourceDocId) constraints.push(where('sourceDocId', '==', filters.sourceDocId));

  const q = filters.limit
    ? query(collection(db, JES_COLL), ...constraints, orderBy('createdAt', 'desc'), limitFn(filters.limit))
    : query(collection(db, JES_COLL), ...constraints, orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JournalEntry, 'id'>) }));
}

export async function getJournalEntryForPO(poId: string): Promise<JournalEntry | null> {
  const q = query(
    collection(db, JES_COLL),
    where('sourceDocId', '==', poId),
    limitFn(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<JournalEntry, 'id'>) };
}

/**
 * Validate that a journal entry is balanced (sum debits === sum credits).
 * Both sides should already be balanced by the CFn writer, but this is
 * a defense-in-depth check that the UI can surface if Firestore returns
 * stale or partial data.
 */
export function isBalanced(je: JournalEntry): boolean {
  const totalDebits = je.debits.reduce((sum, line) => sum + line.amountMinor, 0);
  const totalCredits = je.credits.reduce((sum, line) => sum + line.amountMinor, 0);
  return totalDebits === totalCredits;
}
