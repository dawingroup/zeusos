/**
 * Fulfillment Query Service
 * Queries design items across all projects by fulfillment status
 */

import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { FulfillmentStatus } from '@/modules/design-manager/types';
import { deriveFulfillmentStatus } from '@/modules/design-manager/services/designItemStatusDerivation';
import type { ManufacturingOrderStatus } from '@/modules/manufacturing/types';

export interface FulfillmentItem {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  customerName: string;
  fulfillmentStatus: FulfillmentStatus;
  fulfillment?: Record<string, any>;
  manufacturingOrderId?: string;
  moNumber?: string;
  updatedAt?: any;
  createdAt?: any;
  source?: 'fulfillment' | 'manufacturing-ready';
}

// Statuses that appear in the fulfillment pipeline.
// `awaiting_receipt` is the intake queue fed by manufacturing-ready orders.
const ACTIVE_FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  'awaiting_receipt',
  'received',
  'packing',
  'ready_for_dispatch',
  'dispatched',
  'delivered',
  'installed',
  'complete',
];

const MANUFACTURING_READY_STATUSES: ManufacturingOrderStatus[] = ['completed', 'closed-out'];

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime();
  }
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function mergeItems(
  pipelineItems: FulfillmentItem[],
  manufacturingReadyItems: FulfillmentItem[],
): FulfillmentItem[] {
  const byId = new Map<string, FulfillmentItem>();

  for (const item of pipelineItems) {
    byId.set(item.id, item);
  }

  // Only add manufacturing-ready intake rows if the item is not already
  // in the active fulfillment stream.
  for (const item of manufacturingReadyItems) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt),
  );
}

/**
 * Subscribe to all design items with active fulfillment status
 */
export function subscribeToFulfillmentItems(
  callback: (items: FulfillmentItem[]) => void,
): () => void {
  // Stream A: active fulfillment items (received and beyond).
  const q = query(
    collectionGroup(db, 'designItems'),
    orderBy('fulfillment.receivedAt', 'desc'),
  );

  // Stream B: manufacturing-complete items that still need fulfillment intake.
  // These may be missing `fulfillment.receivedAt` due to legacy handoff gaps,
  // so they would not appear in Stream A.
  const moQuery = query(
    collection(db, 'manufacturingOrders'),
    where('status', 'in', MANUFACTURING_READY_STATUSES),
  );

  // Cache project data to avoid repeated lookups
  const projectCache = new Map<string, { name: string; customerName: string }>();
  let pipelineItems: FulfillmentItem[] = [];
  let manufacturingReadyItems: FulfillmentItem[] = [];

  const emit = () => callback(mergeItems(pipelineItems, manufacturingReadyItems));

  const unsubscribePipeline = onSnapshot(q, async (snapshot) => {
    const items: FulfillmentItem[] = [];
    const projectIdsToFetch = new Set<string>();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const projectId = data.projectId as string;
      if (projectId && !projectCache.has(projectId)) {
        projectIdsToFetch.add(projectId);
      }
    }

    // Fetch missing project data
    const fetchPromises = Array.from(projectIdsToFetch).map(async (pid) => {
      try {
        const projSnap = await getDoc(doc(db, 'designProjects', pid));
        if (projSnap.exists()) {
          const projData = projSnap.data();
          projectCache.set(pid, {
            name: projData.name || 'Unknown Project',
            customerName: projData.customerName || '—',
          });
        }
      } catch {
        projectCache.set(pid, { name: 'Unknown', customerName: '—' });
      }
    });
    await Promise.all(fetchPromises);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const projectId = data.projectId as string;
      const proj = projectCache.get(projectId) || { name: 'Unknown', customerName: '—' };

      // P7 phase 4: status is derived from timestamps, not read from
      // the deprecated flat `fulfillmentStatus` field.
      const derived = deriveFulfillmentStatus(data as {
        fulfillmentStatus?: FulfillmentStatus;
        fulfillment?: Record<string, unknown>;
      });
      if (!ACTIVE_FULFILLMENT_STATUSES.includes(derived)) continue;

      items.push({
        id: docSnap.id,
        name: data.name || 'Untitled Item',
        projectId,
        projectName: proj.name,
        customerName: proj.customerName,
        fulfillmentStatus: derived,
        fulfillment: data.fulfillment,
        manufacturingOrderId: data.manufacturingOrderId,
        moNumber: data.fulfillment?.moNumber,
        updatedAt: data.updatedAt,
        createdAt: data.createdAt,
        source: 'fulfillment',
      });
    }

    pipelineItems = items;
    emit();
  });

  const unsubscribeManufacturingReady = onSnapshot(moQuery, async (snapshot) => {
    const readyRows: FulfillmentItem[] = [];
    const projectIdsToFetch = new Set<string>();

    for (const moDoc of snapshot.docs) {
      const mo = moDoc.data();
      const designItemId = mo.designItemId as string | undefined;
      if (!designItemId) continue;

      const projectId = (mo.projectId as string | undefined) ?? '';
      if (projectId && !projectCache.has(projectId)) {
        projectIdsToFetch.add(projectId);
      }
    }

    const fetchPromises = Array.from(projectIdsToFetch).map(async (pid) => {
      try {
        const projSnap = await getDoc(doc(db, 'designProjects', pid));
        if (projSnap.exists()) {
          const projData = projSnap.data();
          projectCache.set(pid, {
            name: projData.name || 'Unknown Project',
            customerName: projData.customerName || '—',
          });
        }
      } catch {
        projectCache.set(pid, { name: 'Unknown', customerName: '—' });
      }
    });
    await Promise.all(fetchPromises);

    for (const moDoc of snapshot.docs) {
      const mo = moDoc.data();
      const designItemId = mo.designItemId as string | undefined;
      if (!designItemId) continue;

      const candidateRefs = [
        ...(designItemId.includes('/') ? [doc(db, designItemId)] : []),
        ...(mo.projectId ? [doc(db, 'designProjects', mo.projectId as string, 'designItems', designItemId)] : []),
        doc(db, 'designItems', designItemId),
      ];

      let designItemData: Record<string, any> | null = null;
      for (const candidateRef of candidateRefs) {
        const snapDoc = await getDoc(candidateRef);
        if (snapDoc.exists()) {
          designItemData = snapDoc.data() as Record<string, any>;
          break;
        }
      }

      if (!designItemData) continue;

      // Only include rows that still need intake.
      if (designItemData.fulfillment?.receivedAt) continue;

      const derived = deriveFulfillmentStatus({
        fulfillmentStatus: 'awaiting_receipt',
        fulfillment: designItemData.fulfillment,
      });
      if (derived !== 'awaiting_receipt' && derived !== 'in_production') continue;

      const projectId = (mo.projectId as string | undefined) ?? (designItemData.projectId as string | undefined) ?? '';
      const proj = projectCache.get(projectId) || { name: 'Unknown', customerName: '—' };

      readyRows.push({
        id: designItemId,
        name: (designItemData.name as string | undefined) || (mo.designItemName as string | undefined) || (mo.itemName as string | undefined) || 'Untitled Item',
        projectId,
        projectName: proj.name,
        customerName: proj.customerName,
        fulfillmentStatus: 'awaiting_receipt',
        fulfillment: designItemData.fulfillment || {},
        manufacturingOrderId: moDoc.id,
        moNumber: mo.moNumber as string | undefined,
        updatedAt: mo.updatedAt ?? designItemData.updatedAt,
        createdAt: designItemData.createdAt,
        source: 'manufacturing-ready',
      });
    }

    manufacturingReadyItems = readyRows;
    emit();
  });

  return () => {
    unsubscribePipeline();
    unsubscribeManufacturingReady();
  };
}

/**
 * After any terminal status transition, check if all items in the project
 * are terminal and auto-complete the project if so.
 */
export async function checkAndAutoCompleteProject(projectId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'designItems'), where('projectId', '==', projectId)),
  );

  if (snap.empty) return;

  const terminal: FulfillmentStatus[] = ['delivered', 'installed', 'complete'];
  // P7 phase 4: derive the status from timestamps. Post-phase-3 writers
  // only stamp the flat `fulfillmentStatus` for the terminal 'complete'
  // state, so reading `d.data().fulfillmentStatus` directly misses items
  // that have reached 'delivered' or 'installed' via the timestamp path.
  const allTerminal = snap.docs.every((d) => {
    const status = deriveFulfillmentStatus(d.data() as {
      fulfillmentStatus?: FulfillmentStatus;
      fulfillment?: Record<string, unknown>;
    });
    return terminal.includes(status);
  });

  if (allTerminal) {
    await updateDoc(doc(db, 'designProjects', projectId), {
      status: 'completed',
      completedAt: serverTimestamp(),
    });
  }
}
