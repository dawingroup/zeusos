/**
 * MO Closeout Service
 * Handles the formal close-out of completed manufacturing orders:
 * - Builds a summary of cost variance, QC, reservations, and QBO sync status
 * - Releases remaining material reservations
 * - Transitions MO to 'closed-out' status
 */

import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { releaseStock } from '@/modules/inventory/services/stockLevelService';
import type {
  ManufacturingOrder,
  BOMEntry,
  MOFinalCost,
  MOCogsRecorded,
  MOCloseoutData,
} from '../types';

const MO_COLLECTION = 'manufacturingOrders';
const CLIENT_QUOTES_COLLECTION = 'clientQuotes';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents';
const QBO_CONFIG_PATH = 'integrations/quickbooks_config';

// ============================================
// Closeout Summary
// ============================================

export interface MaterialVarianceLine {
  bomEntryId: string;
  itemName: string;
  plannedQty: number;
  actualQty: number;
  wasteQty: number;
  plannedCost: number;
  actualCost: number;
  variancePercent: number;
}

export interface QboInvoiceStatus {
  synced: boolean;
  pending: boolean;
  qboInvoiceId?: string;
  qboInvoiceDocNumber?: string;
  quoteId?: string;
  missingSalesOrder?: boolean;
  error?: string;
}

export interface QboJournalStatus {
  synced: boolean;
  pending: boolean;
  qboJournalEntryId?: string;
  qboSyncStatus?: string;
  cogsRecorded?: MOCogsRecorded;
  error?: string;
}

export interface CogsAccountOption {
  id: string;
  name: string;
  key: string; // config key e.g. 'cogs', 'cogsMaterials'
}

export interface QboAccountsConfig {
  cogsAccounts: CogsAccountOption[];
  inventoryAccountName: string;
  defaultForInstallation: string; // account id
  defaultForFinishedGoods: string; // account id
}

export interface CloseoutSummary {
  materialLines: MaterialVarianceLine[];
  finalCost: MOFinalCost | null;
  qcPassed: boolean | null;
  qcDefects: string[];
  activeReservationCount: number;
  scheduleDaysVariance: number | null;
  qboInvoice: QboInvoiceStatus;
  qboJournal: QboJournalStatus;
  qboAccountsConfig: QboAccountsConfig | null;
}

/**
 * Build a comprehensive closeout summary from the MO document
 */
export async function buildCloseoutSummary(
  mo: ManufacturingOrder,
): Promise<CloseoutSummary> {
  // Material variance lines
  const consumptionByBom = new Map<string, { qty: number; cost: number }>();
  for (const c of mo.materialConsumptions || []) {
    const existing = consumptionByBom.get(c.bomEntryId) || { qty: 0, cost: 0 };
    existing.qty += c.quantityConsumed ?? 0;
    existing.cost += c.totalCost ?? 0;
    consumptionByBom.set(c.bomEntryId, existing);
  }

  const materialLines: MaterialVarianceLine[] = (mo.bom || []).map((b: BOMEntry) => {
    const actual = consumptionByBom.get(b.id) || { qty: 0, cost: 0 };
    const plannedQty = b.quantityRequired ?? 0;
    const plannedCost = b.totalCost ?? 0;
    const wasteQty = Math.max(0, actual.qty - plannedQty);
    const variancePercent =
      plannedCost > 0
        ? ((actual.cost - plannedCost) / plannedCost) * 100
        : 0;
    return {
      bomEntryId: b.id,
      itemName: b.itemName ?? 'Unknown',
      plannedQty,
      actualQty: actual.qty,
      wasteQty,
      plannedCost,
      actualCost: actual.cost,
      variancePercent,
    };
  });

  // QC
  const qcPassed = mo.qualityCheck?.passed ?? null;
  const qcDefects = mo.qualityCheck?.defects || [];

  // Active reservations
  const activeReservationCount = (mo.materialReservations || []).filter(
    (r) => r.status === 'active',
  ).length;

  // Schedule variance
  let scheduleDaysVariance: number | null = null;
  if (mo.scheduling?.scheduledEnd && mo.scheduling?.actualEnd) {
    const scheduled = mo.scheduling.scheduledEnd instanceof Date
      ? mo.scheduling.scheduledEnd
      : (mo.scheduling.scheduledEnd as any).toDate?.() ?? new Date(mo.scheduling.scheduledEnd as any);
    const actual = mo.scheduling.actualEnd instanceof Date
      ? mo.scheduling.actualEnd
      : (mo.scheduling.actualEnd as any).toDate?.() ?? new Date(mo.scheduling.actualEnd as any);
    scheduleDaysVariance = Math.round(
      (actual.getTime() - scheduled.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  // QBO Invoice status (from linked quote)
  const qboInvoice = await getQboInvoiceStatus(mo);

  // QBO Journal status (from MO document)
  const qboJournal = getQboJournalStatus(mo);

  // QBO account mapping — all available COGS accounts
  const qboAccountsConfig = await fetchAvailableCogsAccounts();

  return {
    materialLines,
    finalCost: mo.finalCost || null,
    qcPassed,
    qcDefects,
    activeReservationCount,
    scheduleDaysVariance,
    qboInvoice,
    qboJournal,
    qboAccountsConfig,
  };
}

// ============================================
// QBO Account Config
// ============================================

const COGS_ACCOUNT_KEYS: { key: string; label: string }[] = [
  { key: 'cogs', label: 'COGS (Default)' },
  { key: 'cogsMaterials', label: 'COGS - Materials' },
  { key: 'cogsProducts', label: 'COGS - Products' },
  { key: 'cogsServicesAndProjects', label: 'COGS - Services & Projects' },
  { key: 'cogsLabour', label: 'COGS - Labour' },
  { key: 'cogsOutsourced', label: 'COGS - Outsourced Services' },
];

/**
 * Fetch all configured COGS accounts from the QBO config.
 * Returns only accounts that have been mapped (have a QBO account ID).
 */
async function fetchAvailableCogsAccounts(): Promise<QboAccountsConfig | null> {
  try {
    const configSnap = await getDoc(doc(db, QBO_CONFIG_PATH));
    if (!configSnap.exists()) return null;

    const config = configSnap.data();
    const mapping = config.accountMapping || {};

    if (!mapping.cogs) return null;

    const accountNames = config.accountNames || {};

    // Build list of available COGS accounts (only those that are configured)
    const cogsAccounts: CogsAccountOption[] = [];
    for (const { key, label } of COGS_ACCOUNT_KEYS) {
      const accountId = mapping[key];
      if (accountId) {
        cogsAccounts.push({
          id: accountId,
          name: accountNames[accountId] || label,
          key,
        });
      }
    }

    // Deduplicate by account ID (multiple keys may map to same account)
    const seen = new Set<string>();
    const uniqueAccounts = cogsAccounts.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    const inventoryName = accountNames[mapping.inventory] || 'Inventory Asset';

    return {
      cogsAccounts: uniqueAccounts,
      inventoryAccountName: inventoryName,
      defaultForInstallation: mapping.cogsServicesAndProjects || mapping.cogs,
      defaultForFinishedGoods: mapping.cogsMaterials || mapping.cogs,
    };
  } catch (err) {
    console.warn('Failed to fetch QBO account config:', (err as Error).message);
    return null;
  }
}

// ============================================
// QBO Status Helpers
// ============================================

/**
 * Fetch QBO invoice status from the linked approved quote
 */
export async function getQboInvoiceStatus(
  mo: ManufacturingOrder,
): Promise<QboInvoiceStatus> {
  if (!mo.projectId) {
    return { synced: false, pending: false, error: 'No linked project' };
  }

  try {
    const q = query(
      collection(db, CLIENT_QUOTES_COLLECTION),
      where('projectId', '==', mo.projectId),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { synced: false, pending: false, error: 'No approved quote found' };
    }

    const quoteId = snap.docs[0].id;
    const quote = snap.docs[0].data();
    if (quote.qboInvoiceId) {
      return {
        synced: true,
        pending: false,
        qboInvoiceId: quote.qboInvoiceId,
        qboInvoiceDocNumber: quote.qboInvoiceDocNumber,
        quoteId,
      };
    }

    // No invoice yet — show as pending with info about Sales Order status
    return {
      synced: false,
      pending: true,
      quoteId,
      missingSalesOrder: !quote.qboSalesOrderId,
    };
  } catch (err) {
    return { synced: false, pending: false, error: (err as Error).message };
  }
}

/**
 * Get COGS journal entry status from MO document fields
 */
export function getQboJournalStatus(mo: ManufacturingOrder): QboJournalStatus {
  if (mo.qboJournalEntryId && mo.qboSyncStatus === 'synced') {
    return {
      synced: true,
      pending: false,
      qboJournalEntryId: mo.qboJournalEntryId,
      qboSyncStatus: mo.qboSyncStatus,
      cogsRecorded: mo.cogsRecorded,
    };
  }

  if (mo.qboSyncStatus === 'error') {
    return {
      synced: false,
      pending: false,
      error: 'COGS journal sync failed',
    };
  }

  // No status yet — pending
  return { synced: false, pending: true };
}

// ============================================
// Closeout Execution
// ============================================

export interface CloseoutInput {
  closeoutNotes: string;
  qcConfirmed: boolean;
  finishedGoodsConfirmed: boolean;
  varianceAcknowledged: boolean;
  cogsJournalVerified: boolean;
  routeTo: 'installation' | 'finished-goods';
  cogsAccountId?: string;
  cogsAccountName?: string;
}

/**
 * Close out a completed manufacturing order.
 * - Releases remaining active material reservations
 * - Updates MO status to 'closed-out'
 * - Emits business event
 */
export async function closeoutManufacturingOrder(
  moId: string,
  data: CloseoutInput,
  userId: string,
): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('Manufacturing order not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

  if (mo.status !== 'completed') {
    throw new Error(`Cannot close out MO in "${mo.status}" status. Must be "completed".`);
  }

  // Release remaining active reservations that haven't been consumed.
  // consumeStock() already decrements quantityReserved on the stock level,
  // so we must NOT call releaseStock() for consumed items (would double-decrement).
  const consumedItemIds = new Set(
    (mo.materialConsumptions || []).map((c) => c.inventoryItemId),
  );

  const activeReservations = (mo.materialReservations || []).filter(
    (r) => r.status === 'active',
  );

  for (const res of activeReservations) {
    // Only release stock if the item was NOT consumed
    // (consumed items already had quantityReserved decremented by consumeStock)
    if (!consumedItemIds.has(res.inventoryItemId)) {
      try {
        await releaseStock(
          res.inventoryItemId,
          res.warehouseId,
          res.quantityReserved,
          moId,
          userId,
        );
      } catch (err) {
        console.warn(
          `Failed to release reservation for ${res.inventoryItemId}:`,
          (err as Error).message,
        );
      }
    }
  }

  // Mark all active reservations as released/consumed
  const updatedReservations = (mo.materialReservations || []).map((r) => {
    if (r.status !== 'active') return r;
    const wasConsumed = consumedItemIds.has(r.inventoryItemId);
    return { ...r, status: (wasConsumed ? 'consumed' : 'released') as 'consumed' | 'released' };
  });

  // Build closeout data
  const closeout: MOCloseoutData = {
    closeoutNotes: data.closeoutNotes,
    qcConfirmed: data.qcConfirmed,
    finishedGoodsConfirmed: data.finishedGoodsConfirmed,
    varianceAcknowledged: data.varianceAcknowledged,
    cogsJournalVerified: data.cogsJournalVerified,
    routeTo: data.routeTo,
    cogsAccountId: data.cogsAccountId,
    cogsAccountName: data.cogsAccountName,
    closedOutAt: new Date() as any,
    closedOutBy: userId,
  };

  // Update MO
  await updateDoc(moRef, {
    status: 'closed-out',
    closeout,
    materialReservations: updatedReservations,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Route linked design item into fulfillment pipeline
  if (mo.designItemId) {
    try {
      // Resolve design-item location across both data layouts:
      // - nested: designProjects/{projectId}/designItems/{itemId} (current)
      // - legacy: designItems/{itemId} (top-level)
      // Also support persisted full-document paths.
      const candidateRefs = [
        ...(mo.designItemId.includes('/') ? [doc(db, mo.designItemId)] : []),
        ...(mo.projectId ? [doc(db, 'designProjects', mo.projectId, 'designItems', mo.designItemId)] : []),
        doc(db, 'designItems', mo.designItemId),
      ];

      let designItemRef: ReturnType<typeof doc> | null = null;
      const seenPaths = new Set<string>();
      for (const candidateRef of candidateRefs) {
        if (seenPaths.has(candidateRef.path)) continue;
        seenPaths.add(candidateRef.path);
        const snap = await getDoc(candidateRef);
        if (snap.exists()) {
          designItemRef = candidateRef;
          break;
        }
      }

      if (!designItemRef) {
        console.warn(
          `[MOCloseout] Could not locate design item ${mo.designItemId} for MO ${moId}; fulfillment handoff skipped.`,
        );
      } else {
        // P7 phase 3 — `fulfillment.receivedAt` is the canonical signal
        // for 'received' state; `deriveFulfillmentStatus` returns
        // 'received' whenever this timestamp is set.
        await updateDoc(designItemRef, {
          'fulfillment.receivedAt': serverTimestamp(),
          'fulfillment.receivedBy': userId,
          'fulfillment.routedFrom': 'manufacturing',
          'fulfillment.routeTo': data.routeTo,
          'fulfillment.moId': moId,
          'fulfillment.moNumber': mo.moNumber,
          updatedAt: serverTimestamp(),
        });
        console.log(
          `[MOCloseout] Design item ${mo.designItemId} routed to fulfillment (${data.routeTo})`,
        );
      }
    } catch (err) {
      console.warn(`[MOCloseout] Failed to update design item fulfillment:`, (err as Error).message);
      // Don't block closeout — MO is already closed
    }
  }

  // Emit business event
  await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
    eventType: 'manufacturing_order_closed_out',
    category: 'workflow_transition',
    severity: 'medium',
    sourceModule: 'manufacturing',
    subsidiary: 'finishes',
    entityType: 'manufacturing_order',
    entityId: moId,
    entityName: mo.moNumber,
    projectId: mo.projectId ?? null,
    projectName: mo.projectCode ?? null,
    title: `Manufacturing order closed out`,
    description: `MO ${mo.moNumber} for ${mo.designItemName ?? mo.itemName ?? 'unknown item'} closed out. Routed to: ${data.routeTo}`,
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: {
      routeTo: data.routeTo,
      activeReservationsReleased: activeReservations.length,
      costVariancePercent: mo.finalCost?.costVariancePercent ?? null,
    },
    createdAt: serverTimestamp(),
  });
}
