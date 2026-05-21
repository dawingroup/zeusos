// ============================================================================
// REFUND SERVICE
// ZeusOS v2.0 - Financial Management Module
// Firestore CRUD service for refund requests
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { RefundRequest } from '../types/operations.types';

const COLLECTION_NAME = 'refundRequests';

function collectionRef(companyId: string) {
  return collection(db, 'companies', companyId, COLLECTION_NAME);
}

function docRef(companyId: string, id: string) {
  return doc(db, 'companies', companyId, COLLECTION_NAME, id);
}

/**
 * Get all refund requests with optional status filter
 */
export async function getRefundRequests(
  companyId: string,
  status?: string
): Promise<RefundRequest[]> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

  if (status) {
    constraints.unshift(where('status', '==', status));
  }

  const q = query(collectionRef(companyId), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RefundRequest[];
}

/**
 * Create a new refund request
 */
export async function createRefundRequest(
  companyId: string,
  data: Omit<RefundRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RefundRequest> {
  const docData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collectionRef(companyId), docData);
  return { id: docRef.id, ...data } as RefundRequest;
}

/**
 * Update an existing refund request
 */
export async function updateRefundRequest(
  companyId: string,
  id: string,
  data: Partial<RefundRequest>
): Promise<void> {
  const { id: _id, ...updateData } = data as any;
  await updateDoc(docRef(companyId, id), {
    ...updateData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Approve a refund request
 */
export async function approveRefundRequest(
  companyId: string,
  id: string,
  approvedBy: string,
  notes?: string
): Promise<void> {
  await updateDoc(docRef(companyId, id), {
    status: 'approved',
    approvedBy,
    ...(notes ? { approvalNotes: notes } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reject a refund request
 */
export async function rejectRefundRequest(
  companyId: string,
  id: string,
  approvedBy: string,
  notes: string
): Promise<void> {
  await updateDoc(docRef(companyId, id), {
    status: 'rejected',
    approvedBy,
    approvalNotes: notes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Complete a refund request (mark as processed)
 */
export async function completeRefundRequest(
  companyId: string,
  id: string
): Promise<void> {
  await updateDoc(docRef(companyId, id), {
    status: 'completed',
    processedDate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
