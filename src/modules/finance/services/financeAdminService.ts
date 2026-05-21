// ============================================================================
// FINANCE ADMIN SERVICE
// ZeusOS v2.0 - Financial Management Module
// CRUD for reconciliation schedules, finance documents, and tax portal links
// ============================================================================

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
  limit,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ReconciliationSchedule,
  ReconciliationScheduleInput,
  ReconciliationTask,
  ReconciliationTaskStatus,
  FinanceDocument,
  FinanceDocumentInput,
  FinanceDocumentFilter,
  TaxPortalLink,
} from '../types/integrations.types';
import {
  RECONCILIATION_FREQUENCY_DAYS,
  DEFAULT_TAX_PORTAL_LINKS,
} from '../constants/integrations.constants';

// ============================================================================
// RECONCILIATION SCHEDULES
// ============================================================================

const SCHEDULES_COLLECTION = 'reconciliation_schedules';
const TASKS_COLLECTION = 'reconciliation_tasks';

/**
 * Create a reconciliation schedule
 */
export async function createReconciliationSchedule(
  companyId: string,
  input: ReconciliationScheduleInput,
  userId: string
): Promise<ReconciliationSchedule> {
  const data = {
    companyId,
    name: input.name,
    description: input.description || null,
    type: input.type,
    frequency: input.frequency,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    bankAccountId: input.bankAccountId || null,
    bankAccountName: input.bankAccountName || null,
    nextDueDate: Timestamp.fromDate(input.nextDueDate),
    lastCompletedDate: undefined,
    lastCompletedBy: undefined,
    isActive: true,
    reminderDaysBefore: input.reminderDaysBefore ?? 2,
    notes: input.notes || null,
    createdAt: Timestamp.now(),
    createdBy: userId,
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, 'companies', companyId, SCHEDULES_COLLECTION),
    data
  );

  return { id: docRef.id, ...data } as ReconciliationSchedule;
}

/**
 * Get all reconciliation schedules for a company
 */
export async function getReconciliationSchedules(
  companyId: string,
  activeOnly = true
): Promise<ReconciliationSchedule[]> {
  let q;
  if (activeOnly) {
    q = query(
      collection(db, 'companies', companyId, SCHEDULES_COLLECTION),
      where('isActive', '==', true),
      orderBy('nextDueDate', 'asc')
    );
  } else {
    q = query(
      collection(db, 'companies', companyId, SCHEDULES_COLLECTION),
      orderBy('nextDueDate', 'asc')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as ReconciliationSchedule[];
}

/**
 * Get a single reconciliation schedule
 */
export async function getReconciliationSchedule(
  companyId: string,
  scheduleId: string
): Promise<ReconciliationSchedule | null> {
  const docSnap = await getDoc(
    doc(db, 'companies', companyId, SCHEDULES_COLLECTION, scheduleId)
  );
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as ReconciliationSchedule;
}

/**
 * Update a reconciliation schedule
 */
export async function updateReconciliationSchedule(
  companyId: string,
  scheduleId: string,
  updates: Partial<ReconciliationScheduleInput>
): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
  if (updates.assigneeName !== undefined) updateData.assigneeName = updates.assigneeName;
  if (updates.bankAccountId !== undefined) updateData.bankAccountId = updates.bankAccountId;
  if (updates.bankAccountName !== undefined) updateData.bankAccountName = updates.bankAccountName;
  if (updates.nextDueDate !== undefined) updateData.nextDueDate = Timestamp.fromDate(updates.nextDueDate);
  if (updates.reminderDaysBefore !== undefined) updateData.reminderDaysBefore = updates.reminderDaysBefore;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  await updateDoc(
    doc(db, 'companies', companyId, SCHEDULES_COLLECTION, scheduleId),
    updateData
  );
}

/**
 * Toggle active status
 */
export async function toggleReconciliationSchedule(
  companyId: string,
  scheduleId: string,
  isActive: boolean
): Promise<void> {
  await updateDoc(
    doc(db, 'companies', companyId, SCHEDULES_COLLECTION, scheduleId),
    { isActive, updatedAt: Timestamp.now() }
  );
}

/**
 * Delete a reconciliation schedule
 */
export async function deleteReconciliationSchedule(
  companyId: string,
  scheduleId: string
): Promise<void> {
  await deleteDoc(
    doc(db, 'companies', companyId, SCHEDULES_COLLECTION, scheduleId)
  );
}

/**
 * Complete a reconciliation and advance due date
 */
export async function completeReconciliationSchedule(
  companyId: string,
  scheduleId: string,
  userId: string,
  notes?: string
): Promise<void> {
  const schedule = await getReconciliationSchedule(companyId, scheduleId);
  if (!schedule) throw new Error('Schedule not found');

  const now = Timestamp.now();
  const days = RECONCILIATION_FREQUENCY_DAYS[schedule.frequency] || 30;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);

  // Create task record
  await addDoc(
    collection(db, 'companies', companyId, TASKS_COLLECTION),
    {
      scheduleId,
      companyId,
      name: schedule.name,
      type: schedule.type,
      status: 'completed' as ReconciliationTaskStatus,
      dueDate: schedule.nextDueDate,
      assigneeId: schedule.assigneeId,
      assigneeName: schedule.assigneeName,
      completedAt: now,
      completedBy: userId,
      notes: notes || null,
      createdAt: now,
    }
  );

  // Advance the schedule
  await updateDoc(
    doc(db, 'companies', companyId, SCHEDULES_COLLECTION, scheduleId),
    {
      nextDueDate: Timestamp.fromDate(nextDate),
      lastCompletedDate: now,
      lastCompletedBy: userId,
      updatedAt: now,
    }
  );
}

/**
 * Get reconciliation task history
 */
export async function getReconciliationTasks(
  companyId: string,
  scheduleId?: string,
  maxResults = 50
): Promise<ReconciliationTask[]> {
  let q;
  if (scheduleId) {
    q = query(
      collection(db, 'companies', companyId, TASKS_COLLECTION),
      where('scheduleId', '==', scheduleId),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );
  } else {
    q = query(
      collection(db, 'companies', companyId, TASKS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as ReconciliationTask[];
}

/**
 * Subscribe to reconciliation schedules (real-time)
 */
export function subscribeToReconciliationSchedules(
  companyId: string,
  callback: (schedules: ReconciliationSchedule[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'companies', companyId, SCHEDULES_COLLECTION),
    where('isActive', '==', true),
    orderBy('nextDueDate', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const schedules = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ReconciliationSchedule[];
    callback(schedules);
  }, (error) => {
    console.warn('[FinanceAdmin] Reconciliation schedules listener error:', error.message);
  });
}

// ============================================================================
// FINANCE DOCUMENTS
// ============================================================================

const DOCUMENTS_COLLECTION = 'finance_documents';

/**
 * Create a finance document entry
 */
export async function createFinanceDocument(
  companyId: string,
  input: FinanceDocumentInput,
  userId: string,
  userName: string
): Promise<FinanceDocument> {
  const data = {
    companyId,
    name: input.name,
    description: input.description || null,
    category: input.category,
    status: 'filed' as const,
    fileUrl: input.fileUrl || '',
    googleDriveFileId: input.googleDriveFileId || null,
    googleDriveUrl: input.googleDriveUrl || null,
    mimeType: input.mimeType || null,
    fileSize: input.fileSize || null,
    tags: input.tags || [],
    fiscalYear: input.fiscalYear || null,
    fiscalPeriod: input.fiscalPeriod || null,
    relatedEntityType: input.relatedEntityType || null,
    relatedEntityId: input.relatedEntityId || null,
    uploadedBy: userId,
    uploadedByName: userName,
    uploadedAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, 'companies', companyId, DOCUMENTS_COLLECTION),
    data
  );

  return { id: docRef.id, ...data } as FinanceDocument;
}

/**
 * Get finance documents with filtering
 */
export async function getFinanceDocuments(
  companyId: string,
  filter?: FinanceDocumentFilter,
  maxResults = 100
): Promise<FinanceDocument[]> {
  const constraints = [];

  if (filter?.category && filter.category.length > 0) {
    constraints.push(where('category', 'in', filter.category));
  }
  if (filter?.status && filter.status.length > 0) {
    constraints.push(where('status', 'in', filter.status));
  }
  if (filter?.fiscalYear) {
    constraints.push(where('fiscalYear', '==', filter.fiscalYear));
  }
  if (filter?.uploadedBy) {
    constraints.push(where('uploadedBy', '==', filter.uploadedBy));
  }

  constraints.push(orderBy('uploadedAt', 'desc'));
  constraints.push(limit(maxResults));

  const q = query(
    collection(db, 'companies', companyId, DOCUMENTS_COLLECTION),
    ...constraints
  );

  const snapshot = await getDocs(q);
  let docs = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as FinanceDocument[];

  // Client-side search filter
  if (filter?.search) {
    const searchLower = filter.search.toLowerCase();
    docs = docs.filter(
      (d) =>
        d.name.toLowerCase().includes(searchLower) ||
        d.description?.toLowerCase().includes(searchLower) ||
        d.tags.some((t) => t.toLowerCase().includes(searchLower))
    );
  }

  return docs;
}

/**
 * Get a single finance document
 */
export async function getFinanceDocument(
  companyId: string,
  documentId: string
): Promise<FinanceDocument | null> {
  const docSnap = await getDoc(
    doc(db, 'companies', companyId, DOCUMENTS_COLLECTION, documentId)
  );
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as FinanceDocument;
}

/**
 * Update a finance document
 */
export async function updateFinanceDocument(
  companyId: string,
  documentId: string,
  updates: Partial<FinanceDocumentInput> & { status?: string }
): Promise<void> {
  await updateDoc(
    doc(db, 'companies', companyId, DOCUMENTS_COLLECTION, documentId),
    updates
  );
}

/**
 * Delete a finance document
 */
export async function deleteFinanceDocument(
  companyId: string,
  documentId: string
): Promise<void> {
  await deleteDoc(
    doc(db, 'companies', companyId, DOCUMENTS_COLLECTION, documentId)
  );
}

/**
 * Subscribe to finance documents (real-time)
 */
export function subscribeToFinanceDocuments(
  companyId: string,
  callback: (docs: FinanceDocument[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'companies', companyId, DOCUMENTS_COLLECTION),
    orderBy('uploadedAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as FinanceDocument[];
    callback(docs);
  }, (error) => {
    console.warn('[FinanceAdmin] Finance documents listener error:', error.message);
  });
}

// ============================================================================
// TAX PORTAL LINKS
// ============================================================================

const TAX_LINKS_COLLECTION = 'tax_portal_links';

/**
 * Get tax portal links (defaults + company overrides)
 */
export async function getTaxPortalLinks(
  companyId: string
): Promise<TaxPortalLink[]> {
  // Get company-specific custom links
  const snapshot = await getDocs(
    collection(db, 'companies', companyId, TAX_LINKS_COLLECTION)
  );

  const customLinks = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as TaxPortalLink[];

  // Merge: custom links override defaults by id
  const customIds = new Set(customLinks.map((l) => l.id));
  const merged = [
    ...DEFAULT_TAX_PORTAL_LINKS.filter((l) => !customIds.has(l.id)),
    ...customLinks,
  ];

  return merged.sort((a, b) => a.order - b.order);
}

/**
 * Add a custom tax portal link
 */
export async function addTaxPortalLink(
  companyId: string,
  link: Omit<TaxPortalLink, 'id' | 'isDefault'>
): Promise<TaxPortalLink> {
  const data = {
    ...link,
    isDefault: false,
    companyId,
  };

  const docRef = await addDoc(
    collection(db, 'companies', companyId, TAX_LINKS_COLLECTION),
    data
  );

  return { id: docRef.id, ...data };
}

/**
 * Update a tax portal link
 */
export async function updateTaxPortalLink(
  companyId: string,
  linkId: string,
  updates: Partial<TaxPortalLink>
): Promise<void> {
  await updateDoc(
    doc(db, 'companies', companyId, TAX_LINKS_COLLECTION, linkId),
    updates
  );
}

/**
 * Delete a custom tax portal link
 */
export async function deleteTaxPortalLink(
  companyId: string,
  linkId: string
): Promise<void> {
  await deleteDoc(
    doc(db, 'companies', companyId, TAX_LINKS_COLLECTION, linkId)
  );
}
