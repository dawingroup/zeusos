/**
 * BOQ Service - CRUD operations for BOQ items
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type { BOQItem } from '../types';
import { ConstructionStage, MeasurementUnit } from '../types';
import { stripUndefined } from '../utils/stripUndefined';

const boqCollection = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'advisory_projects', projectId, 'boq_items');

// CREATE
export interface CreateBOQItemInput {
  itemCode: string;
  description: string;
  unit: MeasurementUnit | string;
  quantityContract: number;
  rate?: number;
  stage: ConstructionStage;
  formulaId?: string;
  formulaCode?: string;
  // Hierarchy fields
  hierarchyLevel?: number;
  billNumber?: string;
  billName?: string;
  elementCode?: string;
  elementName?: string;
  sectionCode?: string;
  sectionName?: string;
  itemNumber?: string;
  itemName?: string;
  hierarchyPath?: string;
  isSummaryRow?: boolean;
  // Additional fields
  quantity?: number;
  unitRate?: number;
  specifications?: string;
  status?: 'draft' | 'reviewed' | 'approved' | 'rejected';
}

export async function createBOQItem(
  orgId: string,
  projectId: string,
  userId: string,
  input: CreateBOQItemInput
): Promise<string> {
  const amount = input.rate ? input.quantityContract * input.rate : 0;

  const docRef = await addDoc(boqCollection(orgId, projectId), stripUndefined({
    projectId,
    ...input,
    itemNumber: input.itemNumber || input.itemCode,
    amount,
    quantityExecuted: 0,
    quantityRemaining: input.quantityContract,
    materialRequirements: [],
    isVerified: false,
    status: input.status || 'draft',
    source: { type: 'manual' },
    version: 1,
    lastModifiedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  return docRef.id;
}

// READ
export async function getBOQItems(
  orgId: string,
  projectId: string,
  filters?: { stage?: ConstructionStage }
): Promise<BOQItem[]> {
  let q = query(
    boqCollection(orgId, projectId),
    orderBy('stage'),
    orderBy('itemCode')
  );
  
  if (filters?.stage) {
    q = query(q, where('stage', '==', filters.stage));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as BOQItem[];
}

export function subscribeToBOQItems(
  orgId: string,
  projectId: string,
  callback: (items: BOQItem[]) => void
): () => void {
  const q = query(
    boqCollection(orgId, projectId),
    orderBy('stage'),
    orderBy('itemCode')
  );
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as BOQItem[];
    callback(items);
  });
}

// UPDATE
export async function updateBOQItem(
  orgId: string,
  projectId: string,
  itemId: string,
  userId: string,
  updates: Partial<BOQItem>
): Promise<void> {
  const docRef = doc(boqCollection(orgId, projectId), itemId);
  await updateDoc(docRef, stripUndefined({
    ...updates,
    version: increment(1),
    lastModifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));
}

// DELETE
export async function deleteBOQItem(
  orgId: string,
  projectId: string,
  itemId: string
): Promise<void> {
  await deleteDoc(doc(boqCollection(orgId, projectId), itemId));
}

// BULK OPERATIONS
export async function bulkUpdateStage(
  orgId: string,
  projectId: string,
  itemIds: string[],
  stage: ConstructionStage,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);

  for (const itemId of itemIds) {
    batch.update(doc(boqCollection(orgId, projectId), itemId), {
      stage,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  await batch.commit();
}

// MATERIAL REQUIREMENTS
export async function updateBOQItemMaterials(
  orgId: string,
  projectId: string,
  itemId: string,
  userId: string,
  materialRequirements: any[],
  formulaId?: string,
  formulaCode?: string
): Promise<void> {
  const docRef = doc(boqCollection(orgId, projectId), itemId);
  // Strip undefined values — Firestore rejects them
  const sanitized = materialRequirements.map(req =>
    Object.fromEntries(Object.entries(req).filter(([, v]) => v !== undefined))
  );
  await updateDoc(docRef, {
    materialRequirements: sanitized,
    formulaId: formulaId || null,
    formulaCode: formulaCode || null,
    lastModifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
