/**
 * Design Manager Firestore Service
 * CRUD operations and real-time subscriptions for Design Manager entities
 */

import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  runTransaction,
  Timestamp as FirestoreTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  DesignProject,
  DesignItem,
  RAGValue,
  RAGStatusValue,
  DesignStage,
  StageTransition,
  DesignCategory,
  Approval,
  ApprovalType,
  ApprovalStatus,
  Deliverable,
  DeliverableType,
  ClientInteraction,
  InteractionType,
  DeliverableRequirementsProfile,
} from '../types';
import {
  createInitialRAGStatus,
  calculateOverallReadiness,
  updateRAGAspect as updateRAGAspectUtil,
} from '../utils/rag-calculations';
import { applyNADefaults } from './ragAutoUpdateService';
import { formatItemCode } from '../utils/formatting';

/**
 * Recursively remove undefined values from an object so Firestore doesn't reject the write.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    result[key] = stripValue(value);
  }
  return result as T;
}

function stripValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripValue(v));
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return stripUndefined(value as Record<string, unknown>);
  }
  return value;
}

// Collection names
const PROJECTS_COLLECTION = 'designProjects';
const ITEMS_SUBCOLLECTION = 'designItems';
const APPROVALS_SUBCOLLECTION = 'approvals';
const DELIVERABLES_SUBCOLLECTION = 'deliverables';
const INTERACTIONS_SUBCOLLECTION = 'clientInteractions';

// ============================================
// Project CRUD Operations
// ============================================

/**
 * Thrown when a DesignProject create is attempted without a valid
 * `customerId`. P5 (audit finding F4) — every project must be linked to a
 * customer. Catch this at the UI layer and prompt the user to pick one.
 */
export class MissingCustomerIdError extends Error {
  readonly code = 'project/missing-customer-id';
  constructor(reason: string) {
    super(`DesignProject creation blocked — ${reason}. A project must be linked to a customer (P5/F4).`);
    this.name = 'MissingCustomerIdError';
  }
}

/**
 * Guard: reject creates that would violate the P5 rule. Kept as a tiny
 * named helper so the two parallel `createProject` modules (design-manager
 * + finishes/design-manager) share the same check by copy, and the error
 * message stays consistent. Firestore security rules also block these at
 * the server — this is the *pre-flight* check that fails fast with a
 * useful error instead of an opaque `PERMISSION_DENIED`.
 */
export function assertCustomerIdPresent(
  input: { customerId?: unknown },
): asserts input is { customerId: string } {
  const id = input.customerId;
  if (id == null) throw new MissingCustomerIdError('customerId is missing');
  if (typeof id !== 'string') throw new MissingCustomerIdError(`customerId is not a string (got ${typeof id})`);
  if (id.trim() === '') throw new MissingCustomerIdError('customerId is empty');
}

/**
 * Create a new design project.
 *
 * @throws {MissingCustomerIdError} if `data.customerId` is missing, empty,
 *   or not a string. Enforced in-app so callers get a typed error before
 *   the Firestore rule rejects the write.
 */
export async function createProject(
  data: Omit<DesignProject, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<string> {
  assertCustomerIdPresent(data);

  const projectData = stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  });

  const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), projectData);
  return docRef.id;
}

/**
 * Update an existing project
 */
export async function updateProject(
  projectId: string, 
  data: Partial<DesignProject>,
  userId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  await updateDoc(docRef, stripUndefined({
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<DesignProject | null> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as DesignProject;
}

/**
 * Delete a project and all its design items
 */
export async function deleteProject(projectId: string): Promise<void> {
  const batch = writeBatch(db);
  
  // Delete all design items in the project
  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION);
  const itemsSnapshot = await getDocs(itemsRef);
  
  for (const itemDoc of itemsSnapshot.docs) {
    // Delete approvals subcollection
    const approvalsRef = collection(itemDoc.ref, APPROVALS_SUBCOLLECTION);
    const approvalsSnapshot = await getDocs(approvalsRef);
    approvalsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete deliverables subcollection
    const deliverablesRef = collection(itemDoc.ref, DELIVERABLES_SUBCOLLECTION);
    const deliverablesSnapshot = await getDocs(deliverablesRef);
    deliverablesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete the item itself
    batch.delete(itemDoc.ref);
  }
  
  // Delete the project
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  batch.delete(projectRef);
  
  await batch.commit();
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<DesignProject[]> {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DesignProject));
}

/**
 * Subscribe to project changes
 */
export function subscribeToProject(
  projectId: string, 
  callback: (project: DesignProject | null) => void
): () => void {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as DesignProject);
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribe to projects (most recently updated first).
 * Capped to prevent downloading the full collection on initial load.
 */
export function subscribeToProjects(
  callback: (projects: DesignProject[]) => void,
  maxResults = 50
): () => void {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    orderBy('updatedAt', 'desc'),
    limit(maxResults)
  );
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DesignProject));
    callback(projects);
  });
}

/**
 * Subscribe to projects for a specific customer
 */
export function subscribeToProjectsByCustomer(
  customerId: string,
  callback: (projects: DesignProject[]) => void
): () => void {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where('customerId', '==', customerId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as DesignProject));
    callback(projects);
  }, (error) => {
    console.error('subscribeToProjectsByCustomer error:', error);
    callback([]);
  });
}

// ============================================
// Design Item CRUD Operations
// ============================================

/**
 * Get the items collection reference for a project
 */
function getItemsCollection(projectId: string) {
  return collection(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION);
}

/**
 * Get item document reference
 */
function getItemDoc(projectId: string, itemId: string) {
  return doc(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, itemId);
}

/**
 * Create a new design item
 */
export async function createDesignItem(
  projectId: string,
  data: Partial<DesignItem>,
  userId: string,
  projectProfile?: DeliverableRequirementsProfile
): Promise<string> {
  // Get existing items count for code generation and sortOrder
  const existingItems = await getDocs(getItemsCollection(projectId));
  const sequence = existingItems.size + 1;
  const maxSortOrder = existingItems.docs.reduce((max, d) => {
    const so = (d.data() as any).sortOrder ?? -1;
    return Math.max(max, so);
  }, -1);

  // Get project for code prefix
  const project = await getProject(projectId);
  const projectCode = project?.code || 'DF-000';

  // Build initial RAG status with sourcing-type N/A defaults
  const initialRag = data.ragStatus || createInitialRAGStatus(userId);
  const ragWithDefaults = applyNADefaults(initialRag, data.sourcingType, userId);

  // Apply project-level N/A overrides from deliverable profile
  if (projectProfile?.naOverrides) {
    const sourcingKey = data.sourcingType || 'CUSTOM_FURNITURE_MILLWORK';
    const overridePaths = projectProfile.naOverrides[sourcingKey] || [];
    for (const path of overridePaths) {
      const [category, aspect] = path.split('.');
      if (category && aspect) {
        const cat = (ragWithDefaults as unknown as Record<string, Record<string, RAGValue>>)[category];
        if (cat?.[aspect]?.status === 'red') {
          cat[aspect] = {
            status: 'not-applicable',
            notes: 'N/A per project requirements',
            updatedAt: FirestoreTimestamp.now(),
            updatedBy: userId,
          };
        }
      }
    }
  }

  const itemData: Omit<DesignItem, 'id'> = {
    itemCode: data.itemCode || formatItemCode(projectCode, sequence),
    name: data.name || 'Untitled Item',
    description: data.description || '',
    category: data.category || 'casework',
    projectId,
    projectCode,
    currentStage: data.currentStage || 'concept',
    ragStatus: ragWithDefaults,
    overallReadiness: 0,
    sortOrder: data.sortOrder ?? maxSortOrder + 1,
    stageHistory: [],
    approvals: [],
    createdAt: FirestoreTimestamp.now(),
    createdBy: userId,
    updatedAt: FirestoreTimestamp.now(),
    updatedBy: userId,
    ...data,
  };

  // Calculate initial readiness (accounting for N/A defaults)
  itemData.overallReadiness = calculateOverallReadiness(itemData.ragStatus);
  
  const docRef = await addDoc(getItemsCollection(projectId), stripUndefined({
    ...itemData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    stageEnteredAt: serverTimestamp(), // Track when item entered initial stage
  }));
  
  return docRef.id;
}

/**
 * Update a design item.
 * If the item has a linked Manufacturing Order and manufacturing-relevant fields changed,
 * the MO is automatically synced (only for pre-production MOs).
 */
export async function updateDesignItem(
  projectId: string,
  itemId: string,
  data: Partial<DesignItem>,
  userId: string
): Promise<{ moSyncResult?: import('@/modules/manufacturing/services/designToManufacturingService').DesignSyncResult }> {
  const docRef = getItemDoc(projectId, itemId);

  // If RAG status is being updated, recalculate readiness
  let updateData: Record<string, unknown> = { ...data };
  if (data.ragStatus) {
    updateData.overallReadiness = calculateOverallReadiness(data.ragStatus);
  }

  await updateDoc(docRef, stripUndefined({
    ...updateData,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  // Auto-sync to linked MO when structural manufacturing fields change
  // Only trigger for parts array, structural manufacturing changes, quantity, or name
  const hasPartsChange = !!(data as Record<string, unknown>).parts;
  const hasStructuralMfgChange = !!(
    data.manufacturing && (
      (data.manufacturing as any).standardParts ||
      (data.manufacturing as any).specialParts ||
      (data.manufacturing as any).sheetMaterials ||
      (data.manufacturing as any).timberMaterials ||
      (data.manufacturing as any).edgingMaterials
    )
  );
  const hasCoreFieldChange = data.requiredQuantity !== undefined || data.name !== undefined;
  const shouldSyncMO = hasPartsChange || hasStructuralMfgChange || hasCoreFieldChange;

  if (shouldSyncMO) {
    // Check if design item has a linked MO — fire-and-forget the sync itself
    getDoc(docRef).then(async (snap) => {
      const current = snap.exists() ? snap.data() : null;
      const moId = current?.manufacturingOrderId;
      if (!moId) return;

      try {
        const { designToManufacturingService } = await import(
          '@/modules/manufacturing/services/designToManufacturingService'
        );
        const syncResult = await designToManufacturingService.syncDesignItemToMO(
          projectId,
          itemId,
          userId,
        );
        console.log('[updateDesignItem] MO sync complete:', syncResult.changes?.length, 'changes');
      } catch (err) {
        console.warn('Auto-sync to MO failed:', err);
      }
    }).catch(err => console.warn('MO sync check failed:', err));
  }

  return {};
}

/**
 * Delete a design item
 */
export async function deleteDesignItem(
  projectId: string, 
  itemId: string
): Promise<void> {
  const docRef = getItemDoc(projectId, itemId);
  await deleteDoc(docRef);
}

/**
 * Batch update sortOrder for multiple design items
 */
export async function updateDesignItemOrder(
  projectId: string,
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const item of items) {
    const docRef = getItemDoc(projectId, item.id);
    batch.update(docRef, { sortOrder: item.sortOrder });
  }
  await batch.commit();
}

/**
 * Get a single design item
 */
export async function getDesignItem(
  projectId: string, 
  itemId: string
): Promise<DesignItem | null> {
  const docRef = getItemDoc(projectId, itemId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as DesignItem;
}

/**
 * Get all design items for a project
 */
export async function getDesignItems(
  projectId: string,
  filters?: {
    stage?: DesignStage;
    category?: DesignCategory;
  }
): Promise<DesignItem[]> {
  const constraints: QueryConstraint[] = [];
  
  if (filters?.stage) {
    constraints.unshift(where('currentStage', '==', filters.stage));
  }
  if (filters?.category) {
    constraints.unshift(where('category', '==', filters.category));
  }
  
  const q = query(getItemsCollection(projectId), ...constraints);
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DesignItem));
  // Do client-side sorting so legacy rows without updatedAt are still returned.
  return items.sort((a, b) => {
    const at = (a.updatedAt as any)?.seconds ?? 0;
    const bt = (b.updatedAt as any)?.seconds ?? 0;
    return bt - at;
  });
}

/**
 * Subscribe to design items changes
 */
export function subscribeToDesignItems(
  projectId: string, 
  callback: (items: DesignItem[]) => void,
  filters?: {
    stage?: DesignStage;
    category?: DesignCategory;
  }
): () => void {
  const constraints: QueryConstraint[] = [orderBy('updatedAt', 'desc')];
  
  if (filters?.stage) {
    constraints.unshift(where('currentStage', '==', filters.stage));
  }
  if (filters?.category) {
    constraints.unshift(where('category', '==', filters.category));
  }
  
  const q = query(getItemsCollection(projectId), ...constraints);
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as DesignItem));
    callback(items);
  });
}

/**
 * Subscribe to a single design item
 */
export function subscribeToDesignItem(
  projectId: string,
  itemId: string,
  callback: (item: DesignItem | null) => void
): () => void {
  const docRef = getItemDoc(projectId, itemId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as DesignItem);
    } else {
      callback(null);
    }
  });
}

// ============================================
// RAG Status Updates
// ============================================

/**
 * Update a single RAG aspect
 */
export async function updateRAGAspect(
  projectId: string, 
  itemId: string, 
  aspectPath: string, 
  value: { status: RAGStatusValue; notes: string },
  userId: string
): Promise<void> {
  const item = await getDesignItem(projectId, itemId);
  if (!item) throw new Error('Design item not found');
  
  const newRagValue: RAGValue = {
    status: value.status,
    notes: value.notes,
    updatedAt: FirestoreTimestamp.now(),
    updatedBy: userId,
    checked: true,
  };

  const updatedRagStatus = updateRAGAspectUtil(item.ragStatus, aspectPath, newRagValue);
  const newReadiness = calculateOverallReadiness(updatedRagStatus);
  
  await updateDesignItem(projectId, itemId, {
    ragStatus: updatedRagStatus,
    overallReadiness: newReadiness,
  }, userId);
}

// ============================================
// Stage Transitions
// ============================================

/**
 * Transition a design item to a new stage
 */
export async function transitionStage(
  projectId: string,
  itemId: string,
  targetStage: DesignStage,
  userId: string,
  notes: string = '',
  overrideGate: boolean = false
): Promise<void> {
  const item = await getDesignItem(projectId, itemId);
  if (!item) throw new Error('Design item not found');
  
  const transition: StageTransition = {
    fromStage: item.currentStage,
    toStage: targetStage,
    transitionedAt: FirestoreTimestamp.now(),
    transitionedBy: userId,
    notes: overrideGate ? `[OVERRIDE] ${notes}` : notes,
  };
  
  await updateDesignItem(projectId, itemId, {
    currentStage: targetStage,
    overallReadiness: calculateOverallReadiness(item.ragStatus),
    stageEnteredAt: serverTimestamp() as any, // FieldValue converted to Timestamp by Firestore
    stageHistory: [...item.stageHistory, transition],
  }, userId);

  // Auto-release: when a construction item reaches `const-approve`, spawn
  // the Construction Order (mirrors MO's release-to-production at
  // production-ready). Idempotent on the service side.
  if (targetStage === 'const-approve') {
    try {
      const { releaseToConstruction } = await import(
        '@/modules/construction/services/designToConstructionService'
      );
      await releaseToConstruction(projectId, itemId, userId);
    } catch (err) {
      // Non-fatal — stage advanced but CO could not be created (e.g., totalCost=0).
      // eslint-disable-next-line no-console
      console.warn('[transitionStage] releaseToConstruction failed', err);
    }
  }
}

// ============================================
// Batch Operations
// ============================================

/**
 * Update multiple items' RAG aspects at once
 */
export async function batchUpdateRAGAspects(
  projectId: string,
  updates: Array<{
    itemId: string;
    aspectPath: string;
    value: { status: RAGStatusValue; notes: string };
  }>,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);

  // Group updates by item so multiple auto-updates for the same item are
  // merged before writing. This ensures readiness/progress reflects the
  // FULL final ragStatus, not only the last aspect update in the batch.
  const updatesByItem = new Map<string, Array<(typeof updates)[number]>>();
  for (const update of updates) {
    const existing = updatesByItem.get(update.itemId) ?? [];
    existing.push(update);
    updatesByItem.set(update.itemId, existing);
  }

  for (const [itemId, itemUpdates] of updatesByItem) {
    const item = await getDesignItem(projectId, itemId);
    if (!item) continue;

    // Legacy-safe: some historical docs can exist without ragStatus.
    // Initialize to defaults so auto updates can still apply and
    // progress/readiness recomputes correctly.
    let mergedRagStatus = item.ragStatus
      ? item.ragStatus
      : applyNADefaults(createInitialRAGStatus(userId), item.sourcingType, userId);
    for (const update of itemUpdates) {
      const newRagValue: RAGValue = {
        status: update.value.status,
        notes: update.value.notes,
        updatedAt: FirestoreTimestamp.now(),
        updatedBy: userId,
        checked: true,
      };
      mergedRagStatus = updateRAGAspectUtil(mergedRagStatus, update.aspectPath, newRagValue);
    }

    const newReadiness = calculateOverallReadiness(mergedRagStatus);
    const docRef = getItemDoc(projectId, itemId);
    batch.update(docRef, {
      ragStatus: mergedRagStatus,
      overallReadiness: newReadiness,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }
  
  await batch.commit();
}

// ============================================
// Approvals CRUD Operations
// ============================================

/**
 * Get approvals subcollection reference
 */
function getApprovalsCollection(projectId: string, itemId: string) {
  return collection(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, itemId, APPROVALS_SUBCOLLECTION);
}

/**
 * Create a new approval request.
 * Uses a single batch write instead of addDoc → getDoc → updateDoc (3 round-trips → 1).
 */
export async function createApproval(
  projectId: string,
  itemId: string,
  data: {
    type: ApprovalType;
    assignedTo: string;
    notes?: string;
  },
  userId: string
): Promise<string> {
  const approvalsRef = getApprovalsCollection(projectId, itemId);
  const approvalDocRef = doc(approvalsRef);

  const approval = {
    type: data.type,
    status: 'pending' as ApprovalStatus,
    assignedTo: data.assignedTo,
    requestedBy: userId,
    requestedAt: serverTimestamp(),
    notes: data.notes || null,
    decision: null,
    decidedAt: null,
    attachments: [],
  };

  const batch = writeBatch(db);

  // 1. Create the approval document
  batch.set(approvalDocRef, approval);

  // 2. Append to item's approvals array using arrayUnion (no read needed)
  const itemRef = getItemDoc(projectId, itemId);
  batch.update(itemRef, {
    approvals: arrayUnion({ id: approvalDocRef.id, ...approval }),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await batch.commit();
  return approvalDocRef.id;
}

/**
 * Respond to an approval request.
 * Uses a transaction to atomically update both the approval doc and the
 * item's denormalized approvals array in a single round-trip.
 */
export async function respondToApproval(
  projectId: string,
  itemId: string,
  approvalId: string,
  status: 'approved' | 'rejected' | 'revision-requested',
  decision: string,
  userId: string
): Promise<void> {
  const approvalRef = doc(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, itemId, APPROVALS_SUBCOLLECTION, approvalId);
  const itemRef = getItemDoc(projectId, itemId);

  await runTransaction(db, async (transaction) => {
    const itemSnap = await transaction.get(itemRef);

    // Update the approval subcollection doc
    transaction.update(approvalRef, {
      status,
      decision,
      decidedAt: serverTimestamp(),
      respondedBy: userId,
    });

    // Update the item's denormalized approvals array
    if (itemSnap.exists()) {
      const currentApprovals = itemSnap.data().approvals || [];
      const updatedApprovals = currentApprovals.map((a: Approval) =>
        a.id === approvalId
          ? { ...a, status, decision, decidedAt: new Date(), respondedBy: userId }
          : a
      );
      transaction.update(itemRef, {
        approvals: updatedApprovals,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }
  });
}

/**
 * Subscribe to approvals for a design item
 */
export function subscribeToApprovals(
  projectId: string,
  itemId: string,
  callback: (approvals: Approval[]) => void
): () => void {
  const approvalsRef = getApprovalsCollection(projectId, itemId);
  const q = query(approvalsRef, orderBy('requestedAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const approvals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Approval[];
    callback(approvals);
  });
}

// ============================================
// Deliverables CRUD Operations
// ============================================

/**
 * Get deliverables subcollection reference
 */
function getDeliverablesCollection(projectId: string, itemId: string) {
  return collection(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, itemId, DELIVERABLES_SUBCOLLECTION);
}

/**
 * Create a new deliverable
 */
export async function createDeliverable(
  projectId: string,
  itemId: string,
  data: {
    name: string;
    type: DeliverableType;
    description?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storageUrl: string;
    storagePath: string;
    mimeType?: string;
    coversTypes?: DeliverableType[];
    isAutoGenerated?: boolean;
    autoGenSource?: 'parts-data' | 'production-optimization' | 'workshop-viewer';
    itemName?: string;
  },
  userId: string,
  currentStage: DesignStage
): Promise<string> {
  const deliverablesRef = getDeliverablesCollection(projectId, itemId);

  const categoryMap: Record<string, string> = {
    'cut-list': 'production-doc',
    'bom': 'production-doc',
    'shop-drawing': 'production-doc',
    'assembly-instructions': 'production-doc',
    'specification-sheet': 'production-doc',
    'concept-sketch': 'deliverable',
    'rendering': 'deliverable',
    'mood-board': 'deliverable',
    'client-presentation': 'deliverable',
    '3d-model': 'deliverable',
    'other': 'deliverable',
  };

  // ── Auto-generated files: UPSERT (overwrite existing doc) ──
  if (data.isAutoGenerated) {
    // Find existing deliverable of the same type for this item
    const existingQuery = query(deliverablesRef, where('type', '==', data.type), where('isAutoGenerated', '==', true));
    const existingSnap = await getDocs(existingQuery);

    if (existingSnap.size > 0) {
      // Update the existing deliverable doc in place
      const existingDoc = existingSnap.docs[0];
      const existingId = existingDoc.id;

      await updateDoc(existingDoc.ref, {
        name: data.name,
        description: data.description || null,
        stage: currentStage,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        storageUrl: data.storageUrl,
        storagePath: data.storagePath,
        mimeType: data.mimeType || null,
        autoGenSource: data.autoGenSource || null,
        uploadedBy: userId,
        uploadedAt: serverTimestamp(),
      });

      // Update the mirrored projectFiles doc in place too
      try {
        const pfQuery = query(
          collection(db, 'projectFiles'),
          where('_sourceId', '==', existingId),
          where('_sourceCollection', '==', 'deliverables'),
        );
        const pfSnap = await getDocs(pfQuery);
        if (pfSnap.size > 0) {
          await updateDoc(pfSnap.docs[0].ref, {
            name: data.name,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType || null,
            storagePath: data.storagePath,
            storageUrl: data.storageUrl,
            itemName: data.itemName || null,
            updatedAt: serverTimestamp(),
            uploadedBy: userId,
          });
        } else {
          // Mirror doc was lost — recreate it
          await addDoc(collection(db, 'projectFiles'), {
            name: data.name,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType || null,
            storagePath: data.storagePath,
            storageUrl: data.storageUrl,
            projectId,
            itemId,
            itemName: data.itemName || null,
            manufacturingOrderId: null,
            module: 'design-manager',
            category: categoryMap[data.type] || 'deliverable',
            deliverableType: data.type,
            version: 1,
            previousVersionId: null,
            isLatest: true,
            isAutoGenerated: true,
            autoGenSource: data.autoGenSource || null,
            autoGenHash: null,
            status: 'draft',
            coversTypes: data.coversTypes || [],
            sharedToPortal: false,
            sharedToPortalAt: null,
            sharedToPortalBy: null,
            portalDisplayName: null,
            uploadedAt: serverTimestamp(),
            uploadedBy: userId,
            uploadedByName: null,
            updatedAt: serverTimestamp(),
            tags: [],
            _sourceId: existingId,
            _sourceCollection: 'deliverables',
          });
        }
      } catch (err) {
        console.warn('[createDeliverable] projectFiles mirror update failed:', err);
      }

      return existingId;
    }
    // else: no existing auto-gen deliverable of this type — fall through to create new
  }

  // ── Manual files / first-time auto-gen: CREATE new doc ──

  // Dedup by storagePath + type for manual uploads
  if (!data.isAutoGenerated && data.storagePath) {
    const dedupQuery = query(deliverablesRef, where('storagePath', '==', data.storagePath), where('type', '==', data.type));
    const dedupSnap = await getDocs(dedupQuery);
    if (dedupSnap.size > 0) {
      return dedupSnap.docs[0].id;
    }
  }

  // Fallback dedup by fileName + type when storagePath not available
  if (!data.storagePath && data.fileName) {
    const nameQuery = query(deliverablesRef, where('fileName', '==', data.fileName), where('type', '==', data.type));
    const nameSnap = await getDocs(nameQuery);
    if (nameSnap.size > 0) {
      return nameSnap.docs[0].id;
    }
  }

  // Get the next version number for this type
  const existingQuery = query(deliverablesRef, where('type', '==', data.type));
  const existingSnap = await getDocs(existingQuery);
  const version = existingSnap.size + 1;

  const deliverable = {
    name: data.name,
    type: data.type,
    description: data.description || null,
    stage: currentStage,
    version,
    status: 'draft' as const,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    storageUrl: data.storageUrl,
    storagePath: data.storagePath,
    mimeType: data.mimeType || null,
    coversTypes: data.coversTypes || null,
    ...(data.isAutoGenerated && {
      isAutoGenerated: true,
      autoGenSource: data.autoGenSource || null,
    }),
    uploadedBy: userId,
    uploadedAt: serverTimestamp(),
    approvedBy: null,
    approvedAt: null,
  };

  const docRef = await addDoc(deliverablesRef, deliverable);

  // Mirror to projectFiles collection for UnifiedFileManager live sync
  try {
    await addDoc(collection(db, 'projectFiles'), {
      name: data.name,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType || null,
      storagePath: data.storagePath,
      storageUrl: data.storageUrl,
      projectId,
      itemId,
      itemName: data.itemName || null,
      manufacturingOrderId: null,
      module: 'design-manager',
      category: categoryMap[data.type] || 'deliverable',
      deliverableType: data.type,
      version: deliverable.version,
      previousVersionId: null,
      isLatest: true,
      isAutoGenerated: data.isAutoGenerated || false,
      autoGenSource: data.autoGenSource || null,
      autoGenHash: null,
      status: deliverable.status || 'draft',
      coversTypes: data.coversTypes || [],
      sharedToPortal: false,
      sharedToPortalAt: null,
      sharedToPortalBy: null,
      portalDisplayName: null,
      uploadedAt: deliverable.uploadedAt,
      uploadedBy: userId,
      uploadedByName: null,
      updatedAt: deliverable.uploadedAt,
      tags: [],
      _sourceId: docRef.id,
      _sourceCollection: 'deliverables',
    });
  } catch (err) {
    console.warn('[createDeliverable] projectFiles mirror failed:', err);
  }

  // Auto-update RAG aspects based on the deliverable type + any covered types
  try {
    const { autoUpdateRAGForDeliverable } = await import('./ragAutoUpdateService');
    await autoUpdateRAGForDeliverable(projectId, itemId, data.type, userId);

    if (data.coversTypes?.length) {
      for (const coveredType of data.coversTypes) {
        await autoUpdateRAGForDeliverable(projectId, itemId, coveredType, userId);
      }
    }
  } catch (err) {
    console.warn('[createDeliverable] Auto-RAG update failed:', err);
  }

  return docRef.id;
}

/**
 * Update deliverable status
 */
export async function updateDeliverableStatus(
  projectId: string,
  itemId: string,
  deliverableId: string,
  status: 'draft' | 'review' | 'approved' | 'superseded',
  userId: string
): Promise<void> {
  const deliverableRef = doc(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, itemId, DELIVERABLES_SUBCOLLECTION, deliverableId);
  
  const updateData: Record<string, unknown> = { status };
  
  if (status === 'approved') {
    updateData.approvedBy = userId;
    updateData.approvedAt = serverTimestamp();
  }
  
  await updateDoc(deliverableRef, updateData);
}

/**
 * Delete a deliverable and its mirrored projectFiles entry (if any).
 */
export async function deleteDeliverable(
  projectId: string,
  itemId: string,
  deliverableId: string
): Promise<void> {
  const deliverableRef = doc(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, itemId, DELIVERABLES_SUBCOLLECTION, deliverableId);
  await deleteDoc(deliverableRef);

  // Cascade: remove the mirrored projectFiles doc that references this deliverable
  try {
    const pfQuery = query(
      collection(db, 'projectFiles'),
      where('_sourceId', '==', deliverableId),
      where('_sourceCollection', '==', 'deliverables'),
    );
    const pfSnap = await getDocs(pfQuery);
    for (const pfDoc of pfSnap.docs) {
      await deleteDoc(pfDoc.ref);
    }
  } catch {
    // Best-effort cleanup — don't fail the primary delete
  }
}

/**
 * Subscribe to deliverables for a design item
 */
export function subscribeToDeliverables(
  projectId: string,
  itemId: string,
  callback: (deliverables: Deliverable[]) => void
): () => void {
  const deliverablesRef = getDeliverablesCollection(projectId, itemId);
  const q = query(deliverablesRef, orderBy('uploadedAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const deliverables = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Deliverable[];
    callback(deliverables);
  });
}

/**
 * Share/unshare a deliverable to client portal
 */
export async function toggleDeliverablePortalSharing(
  projectId: string,
  itemId: string,
  deliverableId: string,
  share: boolean,
  userId: string,
  portalDisplayName?: string
): Promise<void> {
  const deliverableRef = doc(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, itemId, DELIVERABLES_SUBCOLLECTION, deliverableId);
  
  if (share) {
    await updateDoc(deliverableRef, {
      sharedToPortal: true,
      sharedToPortalAt: serverTimestamp(),
      sharedToPortalBy: userId,
      ...(portalDisplayName && { portalDisplayName }),
    });
  } else {
    await updateDoc(deliverableRef, {
      sharedToPortal: false,
      sharedToPortalAt: null,
      sharedToPortalBy: null,
      portalDisplayName: null,
    });
  }
}

/**
 * Get all deliverables shared to portal for a project.
 * Uses a collectionGroup query instead of N+1 per-item queries.
 */
export async function getPortalSharedDeliverables(
  projectId: string
): Promise<Array<Deliverable & { itemId: string; itemName: string }>> {
  // Single collectionGroup query across all deliverables subcollections
  const sharedQuery = query(
    collectionGroup(db, DELIVERABLES_SUBCOLLECTION),
    where('sharedToPortal', '==', true)
  );
  const deliverablesSnap = await getDocs(sharedQuery);

  // Filter to this project's items and build a lookup for item names
  const sharedDeliverables: Array<Deliverable & { itemId: string; itemName: string }> = [];
  const itemNameCache = new Map<string, string>();

  for (const delDoc of deliverablesSnap.docs) {
    // Walk parent refs: deliverable -> items -> project
    const itemRef = delDoc.ref.parent.parent;
    if (!itemRef) continue;
    const projectRef = itemRef.parent.parent;
    if (!projectRef || projectRef.id !== projectId) continue;

    // Lazy-load item name from cache or Firestore
    let itemName = itemNameCache.get(itemRef.id) ?? '';
    if (!itemName) {
      const itemSnap = await getDoc(itemRef);
      itemName = itemSnap.exists() ? (itemSnap.data().name || 'Unknown Item') : 'Unknown Item';
      itemNameCache.set(itemRef.id, itemName);
    }

    sharedDeliverables.push({
      id: delDoc.id,
      itemId: itemRef.id,
      itemName,
      ...delDoc.data(),
    } as Deliverable & { itemId: string; itemName: string });
  }

  return sharedDeliverables;
}

/**
 * Get all deliverables across all items for a project.
 * Issues parallel per-item queries for efficiency (avoids collectionGroup scan).
 */
export async function getProjectDeliverablesPerItem(
  projectId: string,
  itemIds: string[]
): Promise<Map<string, Deliverable[]>> {
  const result = new Map<string, Deliverable[]>();

  const promises = itemIds.map(async (itemId) => {
    const delRef = collection(
      db,
      PROJECTS_COLLECTION,
      projectId,
      ITEMS_SUBCOLLECTION,
      itemId,
      DELIVERABLES_SUBCOLLECTION
    );
    const q = query(delRef, orderBy('uploadedAt', 'desc'));
    const snap = await getDocs(q);
    const deliverables = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as Deliverable[];
    result.set(itemId, deliverables);
  });

  await Promise.all(promises);
  return result;
}

// ============================================
// Client Interactions CRUD Operations
// ============================================

/**
 * Get interactions subcollection reference for a project
 */
function getInteractionsCollection(projectId: string) {
  return collection(db, PROJECTS_COLLECTION, projectId, INTERACTIONS_SUBCOLLECTION);
}

/**
 * Create a new client interaction
 */
export async function createClientInteraction(
  projectId: string,
  data: Omit<ClientInteraction, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<string> {
  const interactionsRef = getInteractionsCollection(projectId);
  
  const interaction = stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  } as Record<string, unknown>);

  const docRef = await addDoc(interactionsRef, interaction);
  return docRef.id;
}

/**
 * Update an existing client interaction
 */
export async function updateClientInteraction(
  projectId: string,
  interactionId: string,
  data: Partial<ClientInteraction>,
  userId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId, INTERACTIONS_SUBCOLLECTION, interactionId);
  await updateDoc(docRef, stripUndefined({
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  } as Record<string, unknown>));
}

/**
 * Delete a client interaction
 */
export async function deleteClientInteraction(
  projectId: string,
  interactionId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId, INTERACTIONS_SUBCOLLECTION, interactionId);
  await deleteDoc(docRef);
}

/**
 * Get a single client interaction
 */
export async function getClientInteraction(
  projectId: string,
  interactionId: string
): Promise<ClientInteraction | null> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId, INTERACTIONS_SUBCOLLECTION, interactionId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as ClientInteraction;
}

/**
 * Get all client interactions for a project
 */
export async function getClientInteractions(
  projectId: string,
  filterType?: InteractionType
): Promise<ClientInteraction[]> {
  const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
  
  if (filterType) {
    constraints.unshift(where('type', '==', filterType));
  }
  
  const q = query(getInteractionsCollection(projectId), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClientInteraction));
}

/**
 * Subscribe to client interactions for a project (real-time)
 */
export function subscribeToClientInteractions(
  projectId: string,
  callback: (interactions: ClientInteraction[]) => void,
  filterType?: InteractionType
): () => void {
  const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
  
  if (filterType) {
    constraints.unshift(where('type', '==', filterType));
  }
  
  const q = query(getInteractionsCollection(projectId), ...constraints);
  
  return onSnapshot(q, (snapshot) => {
    const interactions = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as ClientInteraction));
    callback(interactions);
  });
}
