/**
 * Inventory Issue Service
 * CRUD for "Issue from Stores" documents in the inventoryIssues collection.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  InventoryIssue,
  IssueFormData,
  IssueLineItem,
} from '../types/inventoryIssue';

const COLLECTION = 'inventoryIssues';

function docToIssue(id: string, data: DocumentData): InventoryIssue {
  return {
    id,
    issueNumber: data.issueNumber ?? '',
    organizationId: data.organizationId ?? '',
    subsidiaryId: data.subsidiaryId ?? null,
    status: data.status ?? 'draft',
    reason: data.reason ?? 'other',
    notes: data.notes ?? '',
    issuedTo: data.issuedTo ?? '',
    projectId: data.projectId ?? null,
    manufacturingOrderId: data.manufacturingOrderId ?? null,
    lineItems: (data.lineItems ?? []) as IssueLineItem[],
    totalValue: data.totalValue ?? 0,
    lineCount: data.lineCount ?? 0,
    qboJournalEntryId: data.qboJournalEntryId ?? null,
    qboSyncStatus: data.qboSyncStatus ?? 'pending',
    createdBy: data.createdBy ?? '',
    createdAt: data.createdAt ?? Timestamp.now(),
    updatedAt: data.updatedAt ?? Timestamp.now(),
  };
}

/**
 * Create a new issue (status: issued — immediately deducts stock).
 */
export async function createInventoryIssue(
  data: IssueFormData,
  userId: string,
  organizationId: string,
  subsidiaryId?: string,
): Promise<string> {
  const totalValue = data.lineItems.reduce((sum, li) => sum + li.totalCost, 0);

  const docData = {
    organizationId,
    subsidiaryId: subsidiaryId || null,
    status: 'issued',
    reason: data.reason,
    notes: data.notes,
    issuedTo: data.issuedTo,
    projectId: data.projectId || null,
    manufacturingOrderId: data.manufacturingOrderId || null,
    lineItems: data.lineItems,
    totalValue,
    lineCount: data.lineItems.length,
    issueNumber: '', // Set by Cloud Function trigger
    qboJournalEntryId: null,
    qboSyncStatus: 'pending',
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), docData);
  return ref.id;
}

/**
 * Subscribe to issues (real-time).
 */
export function subscribeToIssues(
  organizationId: string,
  onData: (issues: InventoryIssue[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const issues = snap.docs.map((d) => docToIssue(d.id, d.data()));
      onData(issues);
    },
    (err) => onError?.(err),
  );
}

/**
 * Reverse an issue (returns stock, marks reversed).
 */
export async function reverseIssue(issueId: string): Promise<void> {
  const ref = doc(db, COLLECTION, issueId);
  await updateDoc(ref, {
    status: 'reversed',
    updatedAt: serverTimestamp(),
  });
}
