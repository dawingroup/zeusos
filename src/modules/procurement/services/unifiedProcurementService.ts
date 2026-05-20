/**
 * Unified Procurement Service
 * Subscribes to both procurementRequests (material-driven) and
 * procurementRequirements (MO-driven), normalizes into a single list.
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ProcurementRequest } from '../types/procurementRequest';
import type { ProcurementRequirement } from '../types/procurement';
import type {
  UnifiedProcurementItem,
  UnifiedQueueFilters,
} from '../types/procurement';

const REQUESTS_COLLECTION = 'procurementRequests';
const REQUIREMENTS_COLLECTION = 'procurementRequirements';

// ============================================
// Normalization
// ============================================

function normalizeRequest(req: ProcurementRequest): UnifiedProcurementItem {
  return {
    id: `req-${req.id}`,
    source: 'material',
    itemName: req.materialName,
    itemCode: req.materialCode,
    quantity: req.quantity,
    unit: req.unit,
    estimatedUnitCost: req.estimatedUnitCost,
    estimatedTotalCost: req.estimatedUnitCost * req.quantity,
    currency: req.currency,
    supplierName: req.suggestedSupplier,
    supplierId: req.suggestedSupplierId,
    projectRef: req.targetProjectName,
    sourceUrl: req.sourceUrl,
    status: req.status,
    poId: req.poId,
    poNumber: req.poNumber,
    requestedBy: req.requestedBy,
    requestedByName: req.requestedByName,
    requestedAt: req.requestedAt,
    urgency: req.urgency,
    originalId: req.id,
  };
}

function normalizeRequirement(req: ProcurementRequirement): UnifiedProcurementItem {
  return {
    id: `mo-${req.id}`,
    source: 'manufacturing',
    itemName: req.itemDescription,
    itemCode: req.moNumber,
    quantity: req.quantityRequired,
    unit: req.unit,
    estimatedUnitCost: req.estimatedUnitCost,
    estimatedTotalCost: req.estimatedTotalCost,
    currency: req.currency,
    supplierName: req.supplierName,
    supplierId: req.supplierId,
    projectRef: req.projectCode,
    moNumber: req.moNumber,
    designItemName: req.designItemName,
    status: req.status,
    poId: req.poId,
    requestedBy: req.createdBy,
    requestedByName: req.createdBy,
    requestedAt: req.createdAt,
    // Purchase priority (from design/manufacturing BOM)
    ...(req.purchasePriority != null && {
      purchasePriority: req.purchasePriority,
      prioritySource: req.prioritySource,
    }),
    originalId: req.id,
  };
}

// ============================================
// Unified Subscription
// ============================================

/**
 * Subscribe to both procurement collections and emit a merged, sorted list.
 * Returns an unsubscribe function.
 */
export function subscribeToUnifiedQueue(
  subsidiaryId: string,
  callback: (items: UnifiedProcurementItem[]) => void,
  onError?: (error: Error) => void,
  filters?: UnifiedQueueFilters,
): () => void {
  let materialItems: UnifiedProcurementItem[] = [];
  let moItems: UnifiedProcurementItem[] = [];
  let materialReady = false;
  let moReady = false;

  const emit = () => {
    if (!materialReady || !moReady) return;

    let merged = [...materialItems, ...moItems];

    // Client-side source filter
    if (filters?.source) {
      merged = merged.filter((item) => item.source === filters.source);
    }

    // Client-side search filter
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      merged = merged.filter(
        (item) =>
          item.itemName.toLowerCase().includes(s) ||
          item.itemCode?.toLowerCase().includes(s) ||
          item.supplierName?.toLowerCase().includes(s) ||
          item.moNumber?.toLowerCase().includes(s) ||
          item.designItemName?.toLowerCase().includes(s) ||
          item.projectRef?.toLowerCase().includes(s),
      );
    }

    // Sort: purchasePriority ASC (nulls last), then date descending
    merged.sort((a, b) => {
      const aPri = a.purchasePriority ?? Infinity;
      const bPri = b.purchasePriority ?? Infinity;
      if (aPri !== bPri) return aPri - bPri;

      const toMs = (ts: any): number => {
        if (!ts) return 0;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (ts.seconds) return ts.seconds * 1000;
        return 0;
      };
      return toMs(b.requestedAt) - toMs(a.requestedAt);
    });

    callback(merged);
  };

  // --- Subscribe to procurementRequests ---
  const reqConstraints: QueryConstraint[] = [
    where('subsidiaryId', '==', subsidiaryId),
    orderBy('requestedAt', 'desc'),
  ];

  if (filters?.status && !filters.source) {
    // Map unified statuses to request-compatible statuses
    const requestStatuses = filters.status.filter(
      (s) => ['pending', 'in-progress', 'ordered', 'cancelled'].includes(s),
    );
    if (requestStatuses.length > 0) {
      reqConstraints.push(where('status', 'in', requestStatuses));
    }
  } else if (filters?.status && filters.source === 'material') {
    const requestStatuses = filters.status.filter(
      (s) => ['pending', 'in-progress', 'ordered', 'cancelled'].includes(s),
    );
    if (requestStatuses.length > 0) {
      reqConstraints.push(where('status', 'in', requestStatuses));
    }
  }

  if (filters?.urgency) {
    reqConstraints.push(where('urgency', '==', filters.urgency));
  }

  const reqQuery = query(collection(db, REQUESTS_COLLECTION), ...reqConstraints);
  const unsubRequests = onSnapshot(
    reqQuery,
    (snapshot) => {
      materialItems = snapshot.docs.map((d) =>
        normalizeRequest({ id: d.id, ...d.data() } as ProcurementRequest),
      );
      materialReady = true;
      emit();
    },
    (error) => {
      console.error('Unified queue — procurementRequests error:', error);
      materialItems = [];
      materialReady = true;
      emit();
      onError?.(error);
    },
  );

  // --- Subscribe to procurementRequirements ---
  const moConstraints: QueryConstraint[] = [
    where('subsidiaryId', '==', subsidiaryId),
    orderBy('createdAt', 'desc'),
  ];

  if (filters?.status && !filters.source) {
    const moStatuses = filters.status.filter(
      (s) => ['pending', 'added-to-po', 'ordered', 'received', 'cancelled'].includes(s),
    );
    if (moStatuses.length > 0) {
      moConstraints.push(where('status', 'in', moStatuses));
    }
  } else if (filters?.status && filters.source === 'manufacturing') {
    const moStatuses = filters.status.filter(
      (s) => ['pending', 'added-to-po', 'ordered', 'received', 'cancelled'].includes(s),
    );
    if (moStatuses.length > 0) {
      moConstraints.push(where('status', 'in', moStatuses));
    }
  }

  const moQuery = query(collection(db, REQUIREMENTS_COLLECTION), ...moConstraints);
  const unsubRequirements = onSnapshot(
    moQuery,
    (snapshot) => {
      moItems = snapshot.docs.map((d) =>
        normalizeRequirement({ id: d.id, ...d.data() } as ProcurementRequirement),
      );
      moReady = true;
      emit();
    },
    (error) => {
      console.error('Unified queue — procurementRequirements error:', error);
      moItems = [];
      moReady = true;
      emit();
      onError?.(error);
    },
  );

  return () => {
    unsubRequests();
    unsubRequirements();
  };
}
