/**
 * Procurement Request Service
 * CRUD operations for material-driven procurement requests.
 * These requests originate from the Materials Library (often from Clipper clips)
 * and flow into Purchase Orders.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ProcurementRequest,
  ProcurementRequestStatus,
  ProcurementRequestFilters,
} from '../types/procurementRequest';
import type { Material } from '@/modules/design-manager/types/materials';

const COLLECTION = 'procurementRequests';

// ============================================
// Create
// ============================================

interface CreateProcurementRequestData {
  materialId: string;
  quantity: number;
  unit: string;
  urgency: ProcurementRequest['urgency'];
  notes?: string;
  targetProjectId?: string;
  targetProjectName?: string;
}

/**
 * Create a procurement request from a material.
 * Pulls material metadata to populate the request.
 */
export async function createProcurementRequest(
  data: CreateProcurementRequestData,
  material: Pick<Material, 'id' | 'code' | 'name' | 'pricing' | 'sourceUrl' | 'sourceImageUrl' | 'clipId'> & {
    suggestedSupplier?: string;
    suggestedSupplierId?: string;
  },
  userId: string,
  userName: string,
  subsidiaryId: string,
): Promise<string> {
  const docData = {
    materialId: material.id,
    materialName: material.name,
    materialCode: material.code,
    quantity: data.quantity,
    unit: data.unit,
    estimatedUnitCost: material.pricing?.unitCost ?? 0,
    currency: material.pricing?.currency ?? 'USD',
    sourceUrl: material.sourceUrl ?? undefined,
    sourceImageUrl: material.sourceImageUrl ?? undefined,
    suggestedSupplier: material.suggestedSupplier ?? material.pricing?.supplier ?? undefined,
    suggestedSupplierId: material.suggestedSupplierId ?? undefined,
    requestedBy: userId,
    requestedByName: userName,
    requestedAt: serverTimestamp(),
    urgency: data.urgency,
    notes: data.notes ?? undefined,
    targetProjectId: data.targetProjectId ?? undefined,
    targetProjectName: data.targetProjectName ?? undefined,
    status: 'pending' as ProcurementRequestStatus,
    subsidiaryId,
    clipId: material.clipId ?? undefined,
  };

  const ref = await addDoc(collection(db, COLLECTION), docData);
  return ref.id;
}

// ============================================
// Read / Subscribe
// ============================================

/**
 * Subscribe to procurement requests with optional filters.
 */
export function subscribeToProcurementRequests(
  subsidiaryId: string,
  callback: (requests: ProcurementRequest[]) => void,
  onError?: (error: Error) => void,
  filters?: ProcurementRequestFilters,
): () => void {
  const constraints: QueryConstraint[] = [
    where('subsidiaryId', '==', subsidiaryId),
    orderBy('requestedAt', 'desc'),
  ];

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      constraints.push(where('status', 'in', filters.status));
    } else {
      constraints.push(where('status', '==', filters.status));
    }
  }

  if (filters?.urgency) {
    constraints.push(where('urgency', '==', filters.urgency));
  }

  if (filters?.requestedBy) {
    constraints.push(where('requestedBy', '==', filters.requestedBy));
  }

  const q = query(collection(db, COLLECTION), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      let requests = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ProcurementRequest[];

      // Client-side search filter (Firestore doesn't support text search)
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        requests = requests.filter(
          (r) =>
            r.materialName.toLowerCase().includes(s) ||
            r.materialCode.toLowerCase().includes(s) ||
            r.suggestedSupplier?.toLowerCase().includes(s) ||
            r.notes?.toLowerCase().includes(s),
        );
      }

      callback(requests);
    },
    (error) => {
      console.error('Procurement request subscription error:', error);
      onError?.(error);
    },
  );
}

/**
 * Get a single procurement request by ID.
 */
export async function getProcurementRequest(id: string): Promise<ProcurementRequest | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ProcurementRequest;
}

/**
 * Get count of pending procurement requests (for dashboard cards).
 */
export async function getPendingRequestCount(subsidiaryId: string): Promise<number> {
  const q = query(
    collection(db, COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', 'in', ['pending', 'in-progress']),
  );
  const snap = await getDocs(q);
  return snap.size;
}

// ============================================
// Update
// ============================================

/**
 * Assign a request to a team member.
 */
export async function assignRequest(
  requestId: string,
  assigneeId: string,
  assigneeName: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, requestId), {
    assignedTo: assigneeId,
    assignedToName: assigneeName,
    status: 'in-progress',
  });
}

/**
 * Mark requests as ordered after PO creation.
 */
export async function markRequestsOrdered(
  requestIds: string[],
  poId: string,
  poNumber: string,
): Promise<void> {
  const batch = requestIds.map((id) =>
    updateDoc(doc(db, COLLECTION, id), {
      status: 'ordered' as ProcurementRequestStatus,
      poId,
      poNumber,
      resolvedAt: serverTimestamp(),
    }),
  );
  await Promise.all(batch);
}

/**
 * Cancel a procurement request.
 */
export async function cancelRequest(
  requestId: string,
  reason: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'cancelled' as ProcurementRequestStatus,
    cancellationReason: reason,
    resolvedAt: serverTimestamp(),
  });
}

// ============================================
// PO Pre-population Helpers
// ============================================

/**
 * Build PO line item data from procurement requests.
 * Used to pre-populate the CreatePurchaseOrderDialog.
 */
export function buildPOLineItemsFromRequests(
  requests: ProcurementRequest[],
): Array<{
  description: string;
  sku: string;
  quantity: number;
  unitCost: number;
  unit: string;
  weight: string;
  sourceUrl?: string;
}> {
  return requests.map((r) => ({
    description: `${r.materialName} (${r.materialCode})`,
    sku: '',
    quantity: r.quantity,
    unitCost: r.estimatedUnitCost,
    unit: r.unit,
    weight: '',
    sourceUrl: r.sourceUrl,
  }));
}
