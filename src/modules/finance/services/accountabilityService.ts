// ============================================================================
// ACCOUNTABILITY SERVICE
// ZeusOS v2.0 - Financial Management Module
// Firestore CRUD service for accountability reports
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { AccountabilityReport } from '../types/operations.types';

const COLLECTION_NAME = 'accountabilityReports';

function collectionRef(companyId: string) {
  return collection(db, 'companies', companyId, COLLECTION_NAME);
}

function docRef(companyId: string, id: string) {
  return doc(db, 'companies', companyId, COLLECTION_NAME, id);
}

/**
 * Get all accountability reports with optional status filter
 */
export async function getAccountabilityReports(
  companyId: string,
  status?: string
): Promise<AccountabilityReport[]> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

  if (status) {
    constraints.unshift(where('status', '==', status));
  }

  const q = query(collectionRef(companyId), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as AccountabilityReport[];
}

/**
 * Get a single accountability report by ID
 */
export async function getAccountabilityReport(
  companyId: string,
  id: string
): Promise<AccountabilityReport | null> {
  const docSnap = await getDoc(docRef(companyId, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as AccountabilityReport;
}

/**
 * Create a new accountability report
 */
export async function createAccountabilityReport(
  companyId: string,
  data: Omit<AccountabilityReport, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AccountabilityReport> {
  const docData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collectionRef(companyId), docData);
  return { id: docRef.id, ...data } as AccountabilityReport;
}

/**
 * Update an existing accountability report
 */
export async function updateAccountabilityReport(
  companyId: string,
  id: string,
  data: Partial<AccountabilityReport>
): Promise<void> {
  const { id: _id, ...updateData } = data as any;
  await updateDoc(docRef(companyId, id), {
    ...updateData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Approve an accountability report
 */
export async function approveAccountabilityReport(
  companyId: string,
  id: string,
  reviewedBy: string,
  reviewedByName: string,
  notes?: string
): Promise<void> {
  await updateDoc(docRef(companyId, id), {
    status: 'approved',
    reviewedBy,
    reviewedByName,
    ...(notes ? { reviewNotes: notes } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reject an accountability report
 */
export async function rejectAccountabilityReport(
  companyId: string,
  id: string,
  reviewedBy: string,
  reviewedByName: string,
  notes: string
): Promise<void> {
  await updateDoc(docRef(companyId, id), {
    status: 'rejected',
    reviewedBy,
    reviewedByName,
    reviewNotes: notes,
    updatedAt: serverTimestamp(),
  });
}
