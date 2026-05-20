/**
 * Procurement Service
 * CRUD operations for material delivery tracking and procurement management
 */

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
  startAfter,
  Timestamp,
  writeBatch,
  runTransaction,
  DocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import { stripUndefined } from '../utils/stripUndefined';
import type {
  ProcurementEntry,
  ProcurementStatus,
  CreateProcurementInput,
  UpdateProcurementInput,
  QualityCheckInput,
  ProcurementFilters,
  ProcurementSortOptions,
  MaterialProcurementSummary,
  ProjectProcurementSummary,
} from '../types/procurement';

// ============================================================================
// COLLECTION REFERENCES
// ============================================================================

const getProcurementCollection = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'advisory_projects', projectId, 'procurement_entries');

const getProcurementSummaryDoc = (orgId: string, projectId: string) =>
  doc(db, 'organizations', orgId, 'advisory_projects', projectId, 'summaries', 'procurement');

// Default org for now
const DEFAULT_ORG_ID = 'default';

// ============================================================================
// REFERENCE NUMBER GENERATION
// ============================================================================

const generateReferenceNumber = async (
  orgId: string,
  projectId: string,
  prefix: 'PRO' | 'PO' | 'ADJ'
): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  
  const q = query(
    getProcurementCollection(orgId, projectId),
    where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
    where('createdAt', '<=', Timestamp.fromDate(endOfDay))
  );
  
  const snapshot = await getDocs(q);
  const count = snapshot.size + 1;
  
  return `${prefix}-${dateStr}-${count.toString().padStart(4, '0')}`;
};

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export const createProcurementEntry = async (
  projectId: string,
  input: CreateProcurementInput,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<ProcurementEntry> => {
  const referenceNumber = await generateReferenceNumber(orgId, projectId, 'PRO');
  const totalAmount = input.quantityAccepted * input.unitPrice;
  
  const entry: Omit<ProcurementEntry, 'id'> = {
    projectId,
    type: input.type,
    status: 'pending',
    referenceNumber,
    externalReference: input.externalReference,
    materialId: input.materialId,
    materialName: input.materialName,
    unit: input.unit,
    quantityReceived: input.quantityReceived,
    quantityAccepted: input.quantityAccepted,
    quantityRejected: input.quantityRejected || 0,
    unitPrice: input.unitPrice,
    totalAmount,
    currency: 'UGX',
    supplierName: input.supplierName,
    supplierContact: input.supplierContact,
    deliveryDate: Timestamp.fromDate(input.deliveryDate),
    deliveryCondition: input.deliveryCondition,
    receivedBy: userId,
    receivedByName: userName,
    boqItemIds: input.boqItemIds,
    stageId: input.stageId,
    deliveryLocation: input.deliveryLocation,
    attachments: [],
    notes: input.notes,
    qualityCheckDone: false,
    efrisValidated: false,
    createdAt: Timestamp.now(),
    createdBy: userId,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };
  
  const docRef = await addDoc(getProcurementCollection(orgId, projectId), entry);
  
  // Update project summary
  await updateProjectProcurementSummary(orgId, projectId);
  
  return {
    id: docRef.id,
    ...entry,
  };
};

export const getProcurementEntry = async (
  projectId: string,
  entryId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<ProcurementEntry | null> => {
  const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as ProcurementEntry;
};

export const updateProcurementEntry = async (
  projectId: string,
  entryId: string,
  input: UpdateProcurementInput,
  userId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
  
  const updates: Record<string, unknown> = {
    ...stripUndefined(input as Record<string, any>),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };
  
  // Recalculate total if quantity changed
  if (input.quantityAccepted !== undefined) {
    const entry = await getProcurementEntry(projectId, entryId, orgId);
    if (entry) {
      updates.totalAmount = input.quantityAccepted * entry.unitPrice;
    }
  }
  
  await updateDoc(docRef, updates);
  await updateProjectProcurementSummary(orgId, projectId);
};

export const deleteProcurementEntry = async (
  projectId: string,
  entryId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
  await deleteDoc(docRef);
  await updateProjectProcurementSummary(orgId, projectId);
};

// ============================================================================
// QUALITY CHECK
// ============================================================================

export const performQualityCheck = async (
  projectId: string,
  entryId: string,
  input: QualityCheckInput,
  userId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const entry = await getProcurementEntry(projectId, entryId, orgId);
  if (!entry) {
    throw new Error('Procurement entry not found');
  }
  
  const totalChecked = input.quantityAccepted + input.quantityRejected;
  if (totalChecked > entry.quantityReceived) {
    throw new Error('Quality check quantities exceed received quantity');
  }
  
  const newTotalAmount = input.quantityAccepted * entry.unitPrice;
  
  const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
  await updateDoc(docRef, {
    quantityAccepted: input.quantityAccepted,
    quantityRejected: input.quantityRejected,
    deliveryCondition: input.condition,
    totalAmount: newTotalAmount,
    qualityCheckDone: true,
    qualityCheckBy: userId,
    qualityCheckDate: Timestamp.now(),
    qualityNotes: input.notes,
    status: 'confirmed',
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
  
  await updateProjectProcurementSummary(orgId, projectId);
};

// ============================================================================
// STATUS OPERATIONS
// ============================================================================

export const confirmProcurementEntry = async (
  projectId: string,
  entryId: string,
  userId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
  await updateDoc(docRef, {
    status: 'confirmed',
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
  await updateProjectProcurementSummary(orgId, projectId);
};

export const cancelProcurementEntry = async (
  projectId: string,
  entryId: string,
  userId: string,
  reason: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
  await updateDoc(docRef, {
    status: 'cancelled',
    notes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
  await updateProjectProcurementSummary(orgId, projectId);
};

export const disputeProcurementEntry = async (
  projectId: string,
  entryId: string,
  userId: string,
  reason: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
  await updateDoc(docRef, {
    status: 'disputed',
    notes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
};

// ============================================================================
// LIST AND FILTER
// ============================================================================

export const listProcurementEntries = async (
  projectId: string,
  filters?: ProcurementFilters,
  sort?: ProcurementSortOptions,
  pageSize: number = 50,
  lastDoc?: DocumentSnapshot,
  orgId: string = DEFAULT_ORG_ID
): Promise<{
  entries: ProcurementEntry[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> => {
  const constraints: QueryConstraint[] = [];
  
  if (filters?.type?.length) {
    constraints.push(where('type', 'in', filters.type));
  }
  
  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }
  
  if (filters?.materialId) {
    constraints.push(where('materialId', '==', filters.materialId));
  }
  
  if (filters?.stageId) {
    constraints.push(where('stageId', '==', filters.stageId));
  }
  
  if (filters?.dateFrom) {
    constraints.push(where('deliveryDate', '>=', Timestamp.fromDate(filters.dateFrom)));
  }
  
  if (filters?.dateTo) {
    constraints.push(where('deliveryDate', '<=', Timestamp.fromDate(filters.dateTo)));
  }
  
  if (filters?.efrisValidated !== undefined) {
    constraints.push(where('efrisValidated', '==', filters.efrisValidated));
  }
  
  const sortField = sort?.field || 'deliveryDate';
  const sortDirection = sort?.direction || 'desc';
  constraints.push(orderBy(sortField, sortDirection));
  
  constraints.push(limit(pageSize + 1));
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }
  
  const q = query(getProcurementCollection(orgId, projectId), ...constraints);
  const snapshot = await getDocs(q);
  
  const entries: ProcurementEntry[] = [];
  let lastDocSnapshot: DocumentSnapshot | null = null;
  
  snapshot.docs.slice(0, pageSize).forEach((docSnap) => {
    entries.push({
      id: docSnap.id,
      ...docSnap.data(),
    } as ProcurementEntry);
    lastDocSnapshot = docSnap;
  });
  
  // Client-side filtering for search
  let filteredEntries = entries;
  
  if (filters?.searchQuery) {
    const searchLower = filters.searchQuery.toLowerCase();
    filteredEntries = filteredEntries.filter(
      (e) =>
        e.materialName.toLowerCase().includes(searchLower) ||
        e.supplierName.toLowerCase().includes(searchLower) ||
        e.referenceNumber.toLowerCase().includes(searchLower) ||
        e.externalReference?.toLowerCase().includes(searchLower)
    );
  }
  
  if (filters?.minAmount !== undefined) {
    filteredEntries = filteredEntries.filter((e) => e.totalAmount >= filters.minAmount!);
  }
  
  if (filters?.maxAmount !== undefined) {
    filteredEntries = filteredEntries.filter((e) => e.totalAmount <= filters.maxAmount!);
  }
  
  return {
    entries: filteredEntries,
    lastDoc: lastDocSnapshot,
    hasMore: snapshot.docs.length > pageSize,
  };
};

// ============================================================================
// SUMMARIES
// ============================================================================

export const getMaterialProcurementSummary = async (
  projectId: string,
  materialId: string,
  plannedQuantity: number,
  plannedCost: number,
  orgId: string = DEFAULT_ORG_ID
): Promise<MaterialProcurementSummary> => {
  const q = query(
    getProcurementCollection(orgId, projectId),
    where('materialId', '==', materialId),
    where('status', 'in', ['confirmed', 'pending'])
  );
  
  const snapshot = await getDocs(q);
  
  let orderedQuantity = 0;
  let receivedQuantity = 0;
  let acceptedQuantity = 0;
  let actualCost = 0;
  let materialName = '';
  let unit = '';
  
  snapshot.docs.forEach((docSnap) => {
    const entry = docSnap.data() as ProcurementEntry;
    orderedQuantity += entry.quantityOrdered || 0;
    receivedQuantity += entry.quantityReceived;
    acceptedQuantity += entry.quantityAccepted;
    actualCost += entry.totalAmount;
    materialName = entry.materialName;
    unit = entry.unit;
  });
  
  const variance = acceptedQuantity - plannedQuantity;
  const variancePercentage = plannedQuantity > 0 
    ? (variance / plannedQuantity) * 100 
    : 0;
  const fulfillmentPercentage = plannedQuantity > 0 
    ? (acceptedQuantity / plannedQuantity) * 100 
    : 0;
  const costVariance = actualCost - plannedCost;
  
  let status: MaterialProcurementSummary['status'];
  if (acceptedQuantity === 0) {
    status = 'not_started';
  } else if (acceptedQuantity < plannedQuantity) {
    status = 'in_progress';
  } else if (acceptedQuantity === plannedQuantity) {
    status = 'complete';
  } else {
    status = 'over_procured';
  }
  
  return {
    materialId,
    materialName,
    unit,
    plannedQuantity,
    orderedQuantity,
    receivedQuantity,
    acceptedQuantity,
    variance,
    variancePercentage,
    fulfillmentPercentage,
    plannedCost,
    actualCost,
    costVariance,
    status,
  };
};

export const getProjectProcurementSummary = async (
  projectId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<ProjectProcurementSummary | null> => {
  const summaryDoc = await getDoc(getProcurementSummaryDoc(orgId, projectId));
  
  if (summaryDoc.exists()) {
    return summaryDoc.data() as ProjectProcurementSummary;
  }
  
  return calculateProjectProcurementSummary(orgId, projectId);
};

const calculateProjectProcurementSummary = async (
  orgId: string,
  projectId: string
): Promise<ProjectProcurementSummary> => {
  const q = query(
    getProcurementCollection(orgId, projectId),
    where('status', 'in', ['confirmed', 'pending'])
  );
  
  const snapshot = await getDocs(q);
  
  let totalActualCost = 0;
  let pendingCount = 0;
  let disputedCount = 0;
  let lastDeliveryDate: Timestamp | undefined;
  
  const materialTotals = new Map<string, number>();
  
  snapshot.docs.forEach((docSnap) => {
    const entry = docSnap.data() as ProcurementEntry;
    totalActualCost += entry.totalAmount;
    
    if (entry.status === 'pending') pendingCount++;
    if (entry.status === 'disputed') disputedCount++;
    
    if (!lastDeliveryDate || entry.deliveryDate.toMillis() > lastDeliveryDate.toMillis()) {
      lastDeliveryDate = entry.deliveryDate;
    }
    
    const current = materialTotals.get(entry.materialId) || 0;
    materialTotals.set(entry.materialId, current + entry.quantityAccepted);
  });
  
  const summary: ProjectProcurementSummary = {
    projectId,
    totalMaterials: materialTotals.size,
    materialsComplete: 0,
    overallProgress: 0,
    totalPlannedCost: 0,
    totalActualCost,
    costVariance: 0,
    costVariancePercentage: 0,
    totalEntries: snapshot.size,
    pendingEntries: pendingCount,
    disputedEntries: disputedCount,
    stageProgress: [],
    lastDeliveryDate,
    lastUpdated: Timestamp.now(),
  };
  
  return summary;
};

const updateProjectProcurementSummary = async (
  orgId: string,
  projectId: string
): Promise<void> => {
  try {
    const summary = await calculateProjectProcurementSummary(orgId, projectId);
    
    await runTransaction(db, async (transaction) => {
      transaction.set(getProcurementSummaryDoc(orgId, projectId), summary, { merge: true });
    });
  } catch (error) {
    console.error('Failed to update procurement summary:', error);
  }
};

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export const bulkUpdateProcurementStatus = async (
  projectId: string,
  entryIds: string[],
  status: ProcurementStatus,
  userId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const batch = writeBatch(db);
  
  for (const entryId of entryIds) {
    const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
    batch.update(docRef, {
      status,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }
  
  await batch.commit();
  await updateProjectProcurementSummary(orgId, projectId);
};

export const bulkDeleteProcurementEntries = async (
  projectId: string,
  entryIds: string[],
  orgId: string = DEFAULT_ORG_ID
): Promise<void> => {
  const batch = writeBatch(db);
  
  for (const entryId of entryIds) {
    const docRef = doc(getProcurementCollection(orgId, projectId), entryId);
    batch.delete(docRef);
  }
  
  await batch.commit();
  await updateProjectProcurementSummary(orgId, projectId);
};

// ============================================================================
// SUPPLIER ANALYTICS
// ============================================================================

export const getSupplierSummary = async (
  projectId: string,
  supplierName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<{
  totalOrders: number;
  totalAmount: number;
  qualityScore: number;
  materials: string[];
}> => {
  const q = query(
    getProcurementCollection(orgId, projectId),
    where('supplierName', '==', supplierName),
    where('status', '==', 'confirmed')
  );
  
  const snapshot = await getDocs(q);
  
  let totalAmount = 0;
  let totalAccepted = 0;
  let totalReceived = 0;
  const materials = new Set<string>();
  
  snapshot.docs.forEach((docSnap) => {
    const entry = docSnap.data() as ProcurementEntry;
    totalAmount += entry.totalAmount;
    totalAccepted += entry.quantityAccepted;
    totalReceived += entry.quantityReceived;
    materials.add(entry.materialName);
  });
  
  const qualityScore = totalReceived > 0 ? (totalAccepted / totalReceived) * 100 : 0;
  
  return {
    totalOrders: snapshot.size,
    totalAmount,
    qualityScore,
    materials: Array.from(materials),
  };
};
