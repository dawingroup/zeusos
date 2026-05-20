/**
 * Compliance Document Service
 * Firestore CRUD + Firebase Storage upload/delete + status scanning +
 * checklist tracking + compliance history.
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import { uploadFile, deleteFile, getFileUrl } from '@/core/services/firebase/storage';
import type {
  ComplianceDocument,
  ComplianceDocumentInput,
  ComplianceDocumentStatus,
  ComplianceChecklistItem,
  ComplianceHistoryEntry,
  ComplianceHistoryAction,
  DocumentFilters,
} from '../types';
import { emitDocumentStatusChange, emitDocumentUploaded } from './complianceEventService';

const COLLECTION = 'complianceDocuments';

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getComplianceDocuments(
  companyId: string,
  filters?: DocumentFilters
): Promise<ComplianceDocument[]> {
  const constraints = [where('companyId', '==', companyId)];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.category) {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters?.regulatoryBody) {
    constraints.push(where('regulatoryBody', '==', filters.regulatoryBody));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplianceDocument));
  // Sort client-side to avoid composite index requirement
  docs.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    docs = docs.filter(
      d =>
        d.name.toLowerCase().includes(search) ||
        d.documentType.toLowerCase().includes(search) ||
        d.referenceNumber?.toLowerCase().includes(search)
    );
  }

  return docs;
}

export async function getComplianceDocument(id: string): Promise<ComplianceDocument | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ComplianceDocument;
}

export async function createComplianceDocument(
  input: Partial<ComplianceDocumentInput>
): Promise<ComplianceDocument> {
  const now = Timestamp.now();
  const data = stripUndefined({
    ...input,
    status: input.status || 'missing',
    createdAt: now,
    updatedAt: now,
    uploadedAt: input.uploadedAt || now,
  });

  const ref = await addDoc(collection(db, COLLECTION), data);
  return { id: ref.id, ...data } as ComplianceDocument;
}

export async function updateComplianceDocument(
  id: string,
  updates: Partial<ComplianceDocument>
): Promise<void> {
  const { id: _id, ...rest } = updates;
  const data = stripUndefined({
    ...rest,
    updatedAt: Timestamp.now(),
  });
  await updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteComplianceDocument(id: string): Promise<void> {
  const existing = await getComplianceDocument(id);
  if (existing?.storagePath) {
    try {
      await deleteFile(existing.storagePath);
    } catch {
      // File may already be deleted
    }
  }
  await deleteDoc(doc(db, COLLECTION, id));
}

// ── File Upload ────────────────────────────────────────────────────────────

export async function uploadDocumentFile(
  documentId: string,
  companyId: string,
  category: string,
  documentType: string,
  file: File
): Promise<{ fileUrl: string; storagePath: string }> {
  const timestamp = Date.now();
  const storagePath = `compliance/${companyId}/${category}/${documentType}/${timestamp}_${file.name}`;

  await uploadFile(storagePath, file);
  const fileUrl = await getFileUrl(storagePath);

  await updateComplianceDocument(documentId, {
    fileUrl,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    status: 'pending_verification',
  } as Partial<ComplianceDocument>);

  // Add history entry for upload
  await addHistoryEntry(documentId, {
    action: 'uploaded',
    description: `File uploaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
    performedBy: 'current_user',
    performedAt: Timestamp.now(),
  });

  emitDocumentUploaded(documentId, companyId).catch(() => {});

  return { fileUrl, storagePath };
}

// ── Pre-populate Templates ─────────────────────────────────────────────────

export async function ensureTemplatesExist(companyId: string): Promise<boolean> {
  const existing = await getComplianceDocuments(companyId);
  if (existing.length > 0) return false;

  const { DOCUMENT_TEMPLATES } = await import('../types/constants');
  const now = Timestamp.now();

  for (const t of DOCUMENT_TEMPLATES) {
    // Build checklist from template steps
    const checklist: ComplianceChecklistItem[] = (t.checklistSteps || []).map((step, idx) => {
      const item: ComplianceChecklistItem = {
        id: generateId(),
        title: step.title,
        isRequired: step.isRequired,
        completed: false,
        order: idx,
      };
      if (step.description) item.description = step.description;
      return item;
    });

    const data = stripUndefined({
      companyId,
      name: t.name,
      documentType: t.documentType,
      category: t.category,
      regulatoryBody: t.regulatoryBody,
      renewalFrequency: t.renewalFrequency,
      alertDaysBefore: t.alertDaysBefore,
      description: t.description,
      requirements: t.requirements || [],
      checklist,
      history: [{
        id: generateId(),
        action: 'status_changed' as const,
        description: 'Compliance requirement created from template',
        performedBy: 'system',
        performedAt: now,
      }],
      complianceProgress: 0,
      status: 'missing' as const,
      uploadedBy: 'system',
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await addDoc(collection(db, COLLECTION), data);
  }

  return true;
}

// ── Checklist Management ──────────────────────────────────────────────────

export async function toggleChecklistItem(
  docId: string,
  itemId: string,
  userId: string
): Promise<ComplianceDocument> {
  const existing = await getComplianceDocument(docId);
  if (!existing) throw new Error('Document not found');

  const checklist = [...(existing.checklist || [])];
  const itemIndex = checklist.findIndex(c => c.id === itemId);
  if (itemIndex === -1) throw new Error('Checklist item not found');

  const item = checklist[itemIndex];
  const nowTimestamp = Timestamp.now();

  if (item.completed) {
    // Uncomplete — omit completedAt/completedBy (Firestore rejects undefined)
    const { completedAt: _a, completedBy: _b, ...rest } = item;
    checklist[itemIndex] = { ...rest, completed: false };
  } else {
    // Complete
    checklist[itemIndex] = {
      ...item,
      completed: true,
      completedAt: nowTimestamp,
      completedBy: userId,
    };
  }

  // Recalculate progress
  const completedCount = checklist.filter(c => c.completed).length;
  const complianceProgress = checklist.length > 0
    ? Math.round((completedCount / checklist.length) * 100)
    : 0;

  // Add history entry
  const history = [...(existing.history || [])];
  history.push({
    id: generateId(),
    action: 'checklist_updated' as ComplianceHistoryAction,
    description: item.completed
      ? `Unchecked: "${item.title}"`
      : `Completed: "${item.title}"`,
    performedBy: userId,
    performedAt: nowTimestamp,
  });

  await updateComplianceDocument(docId, {
    checklist,
    complianceProgress,
    history,
  } as Partial<ComplianceDocument>);

  return { ...existing, checklist, complianceProgress, history };
}

// ── History Management ────────────────────────────────────────────────────

export async function addHistoryEntry(
  docId: string,
  entry: Omit<ComplianceHistoryEntry, 'id'>
): Promise<void> {
  const existing = await getComplianceDocument(docId);
  if (!existing) return;

  const history = [...(existing.history || [])];
  history.push({
    ...entry,
    id: generateId(),
  });

  await updateDoc(doc(db, COLLECTION, docId), {
    history,
    updatedAt: Timestamp.now(),
  });
}

// ── Status Change with History ────────────────────────────────────────────

export async function changeDocumentStatus(
  docId: string,
  newStatus: ComplianceDocumentStatus,
  userId: string
): Promise<void> {
  const existing = await getComplianceDocument(docId);
  if (!existing) throw new Error('Document not found');

  const oldStatus = existing.status;

  await updateComplianceDocument(docId, {
    status: newStatus,
  } as Partial<ComplianceDocument>);

  await addHistoryEntry(docId, {
    action: 'status_changed',
    description: `Status changed from "${oldStatus}" to "${newStatus}"`,
    performedBy: userId,
    performedAt: Timestamp.now(),
  });

  emitDocumentStatusChange(docId, existing.companyId, oldStatus, newStatus).catch(() => {});
}

// ── Status Scanning ────────────────────────────────────────────────────────

export async function scanAndUpdateStatuses(companyId: string): Promise<{
  transitioned: { id: string; from: ComplianceDocumentStatus; to: ComplianceDocumentStatus }[];
}> {
  const docs = await getComplianceDocuments(companyId);
  const now = new Date();
  const transitioned: { id: string; from: ComplianceDocumentStatus; to: ComplianceDocumentStatus }[] = [];

  for (const d of docs) {
    if (!d.expiryDate || d.status === 'not_applicable' || d.status === 'missing') continue;

    const expiryDate = d.expiryDate.toDate();
    const alertDate = new Date(expiryDate);
    alertDate.setDate(alertDate.getDate() - (d.alertDaysBefore || 30));

    let newStatus: ComplianceDocumentStatus | null = null;

    if (now > expiryDate && d.status !== 'expired') {
      newStatus = 'expired';
    } else if (now >= alertDate && now <= expiryDate && d.status === 'valid') {
      newStatus = 'expiring_soon';
    }

    if (newStatus) {
      const oldStatus = d.status;
      await updateComplianceDocument(d.id, { status: newStatus } as Partial<ComplianceDocument>);

      await addHistoryEntry(d.id, {
        action: newStatus === 'expired' ? 'expired' : 'status_changed',
        description: `Auto-detected: status changed from "${oldStatus}" to "${newStatus}"`,
        performedBy: 'system',
        performedAt: Timestamp.now(),
      });

      transitioned.push({ id: d.id, from: oldStatus, to: newStatus });
      emitDocumentStatusChange(d.id, companyId, oldStatus, newStatus).catch(() => {});
    }
  }

  return { transitioned };
}
