/**
 * Procurement Requirement Service
 * Generates, queries, and consolidates procurement requirements from manufacturing orders.
 * Enables cross-MO PO consolidation by grouping requirements by supplier.
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
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ProcurementRequirement,
  ProcurementRequirementStatus,
  SupplierRequirementGroup,
  ProcurementFilters,
  BOMSyncResult,
} from '../types/procurement';
import type { BOMEntry } from '../types';
import type { ManufacturingOrder } from '../types';
import type { POLineItem } from '../types/purchaseOrder';
import { DEFAULT_LANDED_COSTS } from '../types/purchaseOrder';
import { getManufacturingOrder } from './manufacturingOrderService';
import { createPurchaseOrder } from './purchaseOrderService';
import { getSupplierById } from './supplierBridgeService';
import { getMOProjectSalesOrderGroupKey } from '../utils/moGrouping';
import { normalizeMaterialName, extractThickness } from '@/modules/design-manager/services/materialHarvester';

const REQUIREMENTS_COLLECTION = 'procurementRequirements';
const MO_COLLECTION = 'manufacturingOrders';

interface RequirementMaterialContext {
  projectId?: string | null;
  salesOrderId?: string | null;
  inventoryItemId?: string | null;
  itemDescription: string;
  category?: string | null;
  unit?: string | null;
  sourceRunId?: string | null;
  sheetSignature?: {
    normalizedName: string;
    thickness: number;
    sheetLength: number;
    sheetWidth: number;
  } | null;
}

function normalizeMaterialToken(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeForMatching(value: string): string {
  return normalizeMaterialToken(normalizeMaterialName(value));
}

function isSheetCategory(category?: string | null): boolean {
  if (!category) return false;
  const normalized = normalizeMaterialToken(category);
  return normalized.includes('sheet') || normalized.includes('panel');
}

function isSheetRequirement(requirement: ProcurementRequirement): boolean {
  return isSheetCategory(requirement.materialCategory) || requirement.unit === 'sheet';
}

function isSheetCategoryOrUnit(category?: string | null, unit?: string | null): boolean {
  return isSheetCategory(category) || normalizeMaterialToken(unit ?? '') === 'sheet';
}

function buildProjectSalesOrderGrouping(mo: ManufacturingOrder): {
  projectId: string | null;
  designProjectId: string | null;
  salesOrderId: string | null;
  projectSalesOrderGroupKey: string;
} {
  const projectId = mo.designProjectId ?? mo.projectId ?? null;
  const salesOrderId = mo.salesOrderId ?? null;
  return {
    projectId,
    designProjectId: mo.designProjectId ?? mo.projectId ?? null,
    salesOrderId,
    projectSalesOrderGroupKey: getMOProjectSalesOrderGroupKey(mo),
  };
}

function buildRequirementMaterialGroupKey(context: RequirementMaterialContext): string {
  const projectToken = context.projectId ?? 'unlinked';
  const salesOrderToken = context.salesOrderId ?? 'no-so';
  const categoryToken = normalizeMaterialToken(context.category ?? 'unknown');
  const unitToken = normalizeMaterialToken(context.unit ?? 'unit');
  const sourceToken = context.sourceRunId ? `run:${context.sourceRunId}` : 'run:na';
  if (context.sheetSignature) {
    const { normalizedName, thickness, sheetLength, sheetWidth } = context.sheetSignature;
    return [
      projectToken,
      salesOrderToken,
      categoryToken,
      `sheet:${normalizedName}`,
      `t:${thickness}`,
      `sz:${sheetLength}x${sheetWidth}`,
      sourceToken,
    ].join('|');
  }
  const identityToken = context.inventoryItemId
    ? `inv:${context.inventoryItemId}`
    : `desc:${normalizeMaterialToken(context.itemDescription)}`;
  return `${projectToken}|${salesOrderToken}|${categoryToken}|${identityToken}|${unitToken}|${sourceToken}`;
}

type ProjectSheetAlignment = {
  sourceRunId: string | null;
  byMaterialAndThickness: Map<
    string,
    {
      normalizedName: string;
      thickness: number;
      sheetLength: number;
      sheetWidth: number;
    }
  >;
};

type SupportedPartType = 'sheet' | 'timber' | 'bar' | 'fabric' | 'slab' | 'component';

type ProjectOptimizedDemand = {
  byKey: Map<string, number>;
  byNameAndType: Map<string, number[]>;
};

function timestampToMillis(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
  if (typeof candidate.toMillis === 'function') {
    try {
      return candidate.toMillis();
    } catch {
      return null;
    }
  }
  if (typeof candidate.seconds === 'number') {
    return Math.floor(candidate.seconds * 1000 + (candidate.nanoseconds ?? 0) / 1_000_000);
  }
  return null;
}

function resolveSourceRunId(projectData: Record<string, unknown>): string | null {
  const optimization = projectData.optimizationState as
    | {
        lastProductionRun?: unknown;
        lastEstimationRun?: unknown;
        production?: { validAt?: unknown } | null;
        estimation?: { validAt?: unknown } | null;
      }
    | undefined;
  if (!optimization) return null;

  const productionMs =
    timestampToMillis(optimization.lastProductionRun) ??
    timestampToMillis(optimization.production?.validAt);
  if (productionMs) return `production:${productionMs}`;

  const estimationMs =
    timestampToMillis(optimization.lastEstimationRun) ??
    timestampToMillis(optimization.estimation?.validAt);
  if (estimationMs) return `estimation:${estimationMs}`;

  return null;
}

async function loadProjectSheetAlignment(
  designProjectId?: string | null,
): Promise<ProjectSheetAlignment> {
  if (!designProjectId) {
    return { sourceRunId: null, byMaterialAndThickness: new Map() };
  }

  try {
    const snap = await getDoc(doc(db, 'designProjects', designProjectId));
    if (!snap.exists()) {
      return { sourceRunId: null, byMaterialAndThickness: new Map() };
    }
    const projectData = snap.data() as Record<string, unknown>;
    const optimization = projectData.optimizationState as
      | {
          estimation?: { sheetSummary?: unknown[] } | null;
        }
      | undefined;
    const summaries = optimization?.estimation?.sheetSummary;
    const byMaterialAndThickness = new Map<
      string,
      { normalizedName: string; thickness: number; sheetLength: number; sheetWidth: number }
    >();
    if (Array.isArray(summaries)) {
      for (const raw of summaries) {
        const summary = raw as {
          materialName?: string;
          thickness?: number;
          sheetSize?: { length?: number; width?: number };
        };
        const materialName = summary.materialName ?? '';
        const thickness = Number(summary.thickness ?? NaN);
        const sheetLength = Number(summary.sheetSize?.length ?? NaN);
        const sheetWidth = Number(summary.sheetSize?.width ?? NaN);
        if (!materialName || Number.isNaN(thickness) || Number.isNaN(sheetLength) || Number.isNaN(sheetWidth)) {
          continue;
        }
        const normalizedName = normalizeForMatching(materialName);
        const key = `${normalizedName}|${thickness}`;
        if (!byMaterialAndThickness.has(key)) {
          byMaterialAndThickness.set(key, {
            normalizedName,
            thickness,
            sheetLength,
            sheetWidth,
          });
        }
      }
    }

    return {
      sourceRunId: resolveSourceRunId(projectData),
      byMaterialAndThickness,
    };
  } catch {
    return { sourceRunId: null, byMaterialAndThickness: new Map() };
  }
}

function inferPartTypeFromRequirement(requirement: ProcurementRequirement): SupportedPartType {
  const category = normalizeMaterialToken(requirement.materialCategory ?? '');
  const unit = normalizeMaterialToken(requirement.unit ?? '');
  const label = normalizeForMatching(requirement.itemDescription ?? '');

  if (category.includes('component') || category.includes('hardware')) return 'component';
  if (category.includes('fabric') || category.includes('uphol') || label.includes('fabric') || label.includes('uphol')) {
    return 'fabric';
  }
  if (category.includes('timber') || label.includes('timber')) return 'timber';
  if (category.includes('bar') || category.includes('linear') || category.includes('metal') || unit === 'bar') {
    return 'bar';
  }
  if (category.includes('slab') || category.includes('stone') || category.includes('glass')) return 'slab';
  if (isSheetCategory(category) || unit === 'sheet') return 'sheet';

  return 'sheet';
}

async function loadProjectOptimizedDemand(
  projectId?: string | null,
): Promise<ProjectOptimizedDemand> {
  if (!projectId) return { byKey: new Map(), byNameAndType: new Map() };

  try {
    const snap = await getDoc(doc(db, 'designProjects', projectId));
    if (!snap.exists()) return { byKey: new Map(), byNameAndType: new Map() };
    const projectData = snap.data() as Record<string, unknown>;
    const demandByKey = new Map<string, number>();
    const demandByNameAndType = new Map<string, number[]>();

    const pushDemand = (partType: SupportedPartType, materialName: string, quantity: number, thickness?: number) => {
      if (!materialName || !Number.isFinite(quantity) || quantity <= 0) return;
      const normalizedName = normalizeForMatching(materialName);
      const keyWithThickness =
        thickness !== undefined ? `${partType}|${normalizedName}|${thickness}` : `${partType}|${normalizedName}`;
      demandByKey.set(keyWithThickness, quantity);

      const keyWithoutThickness = `${partType}|${normalizedName}`;
      const existing = demandByNameAndType.get(keyWithoutThickness) ?? [];
      existing.push(quantity);
      demandByNameAndType.set(keyWithoutThickness, existing);
    };

    const groups = ((projectData.consolidatedCutlist as { materialGroups?: unknown[] } | undefined)?.materialGroups ??
      []) as Array<{
      partType?: string;
      materialName?: string;
      thickness?: number;
      estimatedSheets?: number;
      estimatedBars?: number;
      estimatedSlabs?: number;
      estimatedRollLength?: number;
      totalQuantity?: number;
    }>;
    for (const group of groups) {
      const partType = (group.partType ?? 'sheet') as SupportedPartType;
      const materialName = group.materialName ?? '';
      switch (partType) {
        case 'sheet':
          pushDemand('sheet', materialName, Number(group.estimatedSheets ?? 0), group.thickness);
          break;
        case 'timber':
          pushDemand('timber', materialName, Number(group.estimatedBars ?? 0));
          break;
        case 'bar':
          pushDemand('bar', materialName, Number(group.estimatedBars ?? 0));
          break;
        case 'fabric':
          pushDemand('fabric', materialName, Number(group.estimatedRollLength ?? 0));
          break;
        case 'slab':
          pushDemand('slab', materialName, Number(group.estimatedSlabs ?? 0));
          break;
        case 'component':
          pushDemand('component', materialName, Number(group.totalQuantity ?? 0));
          break;
      }
    }

    const sheetSummary = ((projectData.optimizationState as { estimation?: { sheetSummary?: unknown[] } } | undefined)
      ?.estimation?.sheetSummary ?? []) as Array<{ materialName?: string; thickness?: number; sheetsRequired?: number }>;
    for (const sheet of sheetSummary) {
      pushDemand('sheet', sheet.materialName ?? '', Number(sheet.sheetsRequired ?? 0), Number(sheet.thickness ?? NaN));
    }

    return { byKey: demandByKey, byNameAndType: demandByNameAndType };
  } catch {
    return { byKey: new Map(), byNameAndType: new Map() };
  }
}

function resolveOptimizedQuantityForBucket(
  requirements: ProcurementRequirement[],
  demand: ProjectOptimizedDemand,
): number | null {
  if (requirements.length === 0) return null;
  const exemplar = requirements[0];
  const partType = inferPartTypeFromRequirement(exemplar);
  const normalizedName = normalizeForMatching(exemplar.itemDescription);
  if (!normalizedName) return null;

  if (partType === 'sheet') {
    const thickness = extractThickness(exemplar.itemDescription);
    const exactKey = `${partType}|${normalizedName}|${thickness}`;
    const exact = demand.byKey.get(exactKey);
    if (typeof exact === 'number' && exact > 0) return exact;
  }

  const broadKey = `${partType}|${normalizedName}`;
  const broad = demand.byKey.get(broadKey);
  if (typeof broad === 'number' && broad > 0) return broad;

  const candidates = demand.byNameAndType.get(broadKey) ?? [];
  if (candidates.length === 1 && candidates[0] > 0) return candidates[0];

  return null;
}

function resolveSheetSignature(
  entry: { itemDescription: string; category?: string | null; unit?: string | null },
  alignment: ProjectSheetAlignment,
): {
  normalizedName: string;
  thickness: number;
  sheetLength: number;
  sheetWidth: number;
} | null {
  if (!isSheetCategoryOrUnit(entry.category, entry.unit)) return null;

  const normalizedName = normalizeForMatching(entry.itemDescription);
  const inferredThickness = extractThickness(entry.itemDescription);
  const exact = alignment.byMaterialAndThickness.get(`${normalizedName}|${inferredThickness}`);
  if (exact) return exact;

  // Fallback: if name matches and there is only one thickness variant in this project summary, use it.
  const candidates = Array.from(alignment.byMaterialAndThickness.values()).filter(
    (s) => s.normalizedName === normalizedName,
  );
  if (candidates.length === 1) return candidates[0];
  return null;
}

// ============================================
// Generate Requirements from MO
// ============================================

/**
 * Scan a manufacturing order's BOM and create procurement requirements
 * for outsourced items (those with a supplier or in the 'special' category).
 */
export async function generateRequirementsFromMO(
  moId: string,
  userId: string,
): Promise<string[]> {
  const mo = await getManufacturingOrder(moId);
  if (!mo) throw new Error('Manufacturing order not found');

  const createdIds: string[] = [];

  const grouping = buildProjectSalesOrderGrouping(mo);
  const alignment = await loadProjectSheetAlignment(grouping.designProjectId);

  for (const entry of mo.bom) {
    // Generate requirements for items with a supplier or special-category items
    const isOutsourced = !!entry.supplierId || entry.category === 'special';
    if (!isOutsourced) continue;

    const reqData = {
      subsidiaryId: mo.subsidiaryId,
      moId: mo.id,
      moNumber: mo.moNumber,
      bomEntryId: entry.id,
      designItemName: mo.designItemName,
      projectCode: mo.projectCode,
      projectId: grouping.projectId,
      designProjectId: grouping.designProjectId,
      salesOrderId: grouping.salesOrderId,
      projectSalesOrderGroupKey: grouping.projectSalesOrderGroupKey,
      inventoryItemId: entry.inventoryItemId || null,
      itemDescription: entry.itemName,
      quantityRequired: entry.quantityRequired,
      unit: entry.unit,
      estimatedUnitCost: entry.unitCost,
      estimatedTotalCost: entry.totalCost,
      currency: mo.costSummary.currency,
      materialCategory: entry.category ?? null,
      materialGroupKey: buildRequirementMaterialGroupKey({
        projectId: grouping.projectId,
        salesOrderId: grouping.salesOrderId,
        inventoryItemId: entry.inventoryItemId ?? null,
        itemDescription: entry.itemName,
        category: entry.category ?? null,
        unit: entry.unit,
        sourceRunId: alignment.sourceRunId,
        sheetSignature: resolveSheetSignature(
          {
            itemDescription: entry.itemName,
            category: entry.category ?? null,
            unit: entry.unit,
          },
          alignment,
        ),
      }),
      sourceRunId: alignment.sourceRunId,
      supplierId: entry.supplierId || null,
      supplierName: entry.supplierName || null,
      status: 'pending' as ProcurementRequirementStatus,
      poId: null,
      poLineItemId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, REQUIREMENTS_COLLECTION), reqData);
    createdIds.push(docRef.id);
  }

  return createdIds;
}

/**
 * Intelligently send BOM shortage items to the procurement queue.
 * Unlike generateRequirementsFromMO (which only looks at supplier/category),
 * this function uses live stock data to identify actual shortages and creates
 * procurement requirements only for items that truly need procurement.
 * It skips items that already have an existing procurement requirement.
 */
export async function sendShortagesToProcurement(
  moId: string,
  shortages: Array<{
    bomEntryId: string;
    itemName: string;
    sku?: string;
    inventoryItemId: string;
    shortageQuantity: number;
    availableQuantity: number;
    requiredQuantity: number;
    unit: string;
    unitCost: number;
    category?: string;
    supplierId?: string;
    supplierName?: string;
  }>,
  userId: string,
): Promise<{ created: number; skipped: number; ids: string[] }> {
  const mo = await getManufacturingOrder(moId);
  if (!mo) throw new Error('Manufacturing order not found');
  const grouping = buildProjectSalesOrderGrouping(mo);
  const alignment = await loadProjectSheetAlignment(grouping.designProjectId);

  // Check existing procurement requirements for this MO to avoid duplicates
  const existingReqs = await getDocs(
    query(
      collection(db, REQUIREMENTS_COLLECTION),
      where('moId', '==', moId),
      where('status', 'in', ['pending', 'added-to-po', 'ordered']),
    ),
  );
  const existingBomEntryIds = new Set(
    existingReqs.docs.map((d) => d.data().bomEntryId).filter(Boolean),
  );

  const createdIds: string[] = [];
  let skipped = 0;

  for (const shortage of shortages) {
    // Skip if a procurement requirement already exists for this BOM entry
    if (existingBomEntryIds.has(shortage.bomEntryId)) {
      skipped++;
      continue;
    }

    const reqData = {
      subsidiaryId: mo.subsidiaryId,
      moId: mo.id,
      moNumber: mo.moNumber,
      bomEntryId: shortage.bomEntryId,
      designItemName: mo.designItemName,
      projectCode: mo.projectCode,
      projectId: grouping.projectId,
      designProjectId: grouping.designProjectId,
      salesOrderId: grouping.salesOrderId,
      projectSalesOrderGroupKey: grouping.projectSalesOrderGroupKey,
      inventoryItemId: shortage.inventoryItemId || null,
      itemDescription: shortage.itemName,
      quantityRequired: shortage.shortageQuantity, // Only the shortage amount, not full qty
      quantityInStock: shortage.availableQuantity,
      quantityNeededTotal: shortage.requiredQuantity,
      unit: shortage.unit,
      estimatedUnitCost: shortage.unitCost,
      estimatedTotalCost: shortage.shortageQuantity * shortage.unitCost,
      currency: mo.costSummary.currency,
      materialCategory: shortage.category || null,
      materialGroupKey: buildRequirementMaterialGroupKey({
        projectId: grouping.projectId,
        salesOrderId: grouping.salesOrderId,
        inventoryItemId: shortage.inventoryItemId ?? null,
        itemDescription: shortage.itemName,
        category: shortage.category ?? null,
        unit: shortage.unit,
        sourceRunId: alignment.sourceRunId,
        sheetSignature: resolveSheetSignature(
          {
            itemDescription: shortage.itemName,
            category: shortage.category ?? null,
            unit: shortage.unit,
          },
          alignment,
        ),
      }),
      sourceRunId: alignment.sourceRunId,
      supplierId: shortage.supplierId || null,
      supplierName: shortage.supplierName || null,
      status: 'pending' as ProcurementRequirementStatus,
      poId: null,
      poLineItemId: null,
      source: 'shortage_detection',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, REQUIREMENTS_COLLECTION), reqData);
    createdIds.push(docRef.id);
  }

  return { created: createdIds.length, skipped, ids: createdIds };
}

// ============================================
// Sync Requirements with BOM Changes
// ============================================

/**
 * Reconcile procurement requirements after a BOM edit.
 * - Cancelled requirements for deleted BOM entries (if still pending)
 * - Updates pending requirements whose BOM entry changed (qty, cost, supplier, etc.)
 * - Creates new requirements for newly-outsourced BOM entries
 * - Skips requirements already on a PO (added-to-po, ordered, received)
 */
export async function syncRequirementsWithBOM(
  moId: string,
  newBom: BOMEntry[],
  userId: string,
): Promise<BOMSyncResult> {
  const mo = await getManufacturingOrder(moId);
  if (!mo) throw new Error('Manufacturing order not found');
  const grouping = buildProjectSalesOrderGrouping(mo);
  const alignment = await loadProjectSheetAlignment(grouping.designProjectId);

  // 1. Fetch all existing non-cancelled requirements for this MO
  const snap = await getDocs(
    query(collection(db, REQUIREMENTS_COLLECTION), where('moId', '==', moId)),
  );
  const existingReqs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ProcurementRequirement))
    .filter((r) => r.status !== 'cancelled');

  // 2. Build lookup maps
  const reqByBomEntryId = new Map<string, ProcurementRequirement>();
  for (const req of existingReqs) {
    reqByBomEntryId.set(req.bomEntryId, req);
  }
  const newBomEntryIds = new Set(newBom.map((e) => e.id));

  const isOutsourced = (entry: BOMEntry): boolean =>
    !!entry.supplierId || entry.category === 'special';

  // 3. Batch all writes for atomicity
  const batch = writeBatch(db);
  const result: BOMSyncResult = { created: [], updated: [], cancelled: [], skippedNonPending: [] };

  // ── A. Deleted BOM entries: cancel pending requirements ──
  for (const req of existingReqs) {
    if (!newBomEntryIds.has(req.bomEntryId)) {
      if (req.status === 'pending') {
        batch.update(doc(db, REQUIREMENTS_COLLECTION, req.id), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
        result.cancelled.push(req.id);
      } else {
        result.skippedNonPending.push(req.id);
      }
    }
  }

  // ── B. Existing BOM entries: update or cancel depending on outsource status ──
  for (const entry of newBom) {
    const existingReq = reqByBomEntryId.get(entry.id);
    if (!existingReq) continue; // Handled in section C

    if (!isOutsourced(entry)) {
      // Supplier removed → cancel pending requirement
      if (existingReq.status === 'pending') {
        batch.update(doc(db, REQUIREMENTS_COLLECTION, existingReq.id), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
        result.cancelled.push(existingReq.id);
      } else {
        result.skippedNonPending.push(existingReq.id);
      }
      continue;
    }

    // Still outsourced — check for field changes on pending requirements
    if (existingReq.status === 'pending') {
      const updates: Record<string, unknown> = {};
      let hasChanges = false;
      const nextMaterialGroupKey = buildRequirementMaterialGroupKey({
        projectId: grouping.projectId,
        salesOrderId: grouping.salesOrderId,
        inventoryItemId: entry.inventoryItemId ?? null,
        itemDescription: entry.itemName,
        category: entry.category ?? null,
        unit: entry.unit,
        sourceRunId: alignment.sourceRunId,
        sheetSignature: resolveSheetSignature(
          {
            itemDescription: entry.itemName,
            category: entry.category ?? null,
            unit: entry.unit,
          },
          alignment,
        ),
      });

      if (existingReq.quantityRequired !== entry.quantityRequired) {
        updates.quantityRequired = entry.quantityRequired;
        hasChanges = true;
      }
      if (existingReq.estimatedUnitCost !== entry.unitCost) {
        updates.estimatedUnitCost = entry.unitCost;
        hasChanges = true;
      }
      if (existingReq.estimatedTotalCost !== entry.totalCost) {
        updates.estimatedTotalCost = entry.totalCost;
        hasChanges = true;
      }
      if ((existingReq.supplierId || null) !== (entry.supplierId || null)) {
        updates.supplierId = entry.supplierId || null;
        updates.supplierName = entry.supplierName || null;
        hasChanges = true;
      }
      if (existingReq.itemDescription !== entry.itemName) {
        updates.itemDescription = entry.itemName;
        hasChanges = true;
      }
      if (existingReq.unit !== entry.unit) {
        updates.unit = entry.unit;
        hasChanges = true;
      }
      if ((existingReq.inventoryItemId || null) !== (entry.inventoryItemId || null)) {
        updates.inventoryItemId = entry.inventoryItemId || null;
        hasChanges = true;
      }
      if ((existingReq.materialCategory || null) !== (entry.category || null)) {
        updates.materialCategory = entry.category || null;
        hasChanges = true;
      }
      if ((existingReq.materialGroupKey || null) !== nextMaterialGroupKey) {
        updates.materialGroupKey = nextMaterialGroupKey;
        hasChanges = true;
      }
      if ((existingReq.sourceRunId || null) !== (alignment.sourceRunId || null)) {
        updates.sourceRunId = alignment.sourceRunId;
        hasChanges = true;
      }
      if ((existingReq.projectSalesOrderGroupKey || null) !== grouping.projectSalesOrderGroupKey) {
        updates.projectSalesOrderGroupKey = grouping.projectSalesOrderGroupKey;
        updates.projectId = grouping.projectId;
        updates.designProjectId = grouping.designProjectId;
        updates.salesOrderId = grouping.salesOrderId;
        hasChanges = true;
      }

      if (hasChanges) {
        updates.updatedAt = serverTimestamp();
        batch.update(doc(db, REQUIREMENTS_COLLECTION, existingReq.id), updates);
        result.updated.push(existingReq.id);
      }
    } else {
      // Non-pending: can't modify, track as skipped
      result.skippedNonPending.push(existingReq.id);
    }
  }

  // ── C. New outsourced BOM entries: create requirements ──
  for (const entry of newBom) {
    if (reqByBomEntryId.has(entry.id)) continue; // Already handled above
    if (!isOutsourced(entry)) continue;

    const reqRef = doc(collection(db, REQUIREMENTS_COLLECTION));
    batch.set(reqRef, {
      subsidiaryId: mo.subsidiaryId,
      moId: mo.id,
      moNumber: mo.moNumber,
      bomEntryId: entry.id,
      designItemName: mo.designItemName,
      projectCode: mo.projectCode,
      projectId: grouping.projectId,
      designProjectId: grouping.designProjectId,
      salesOrderId: grouping.salesOrderId,
      projectSalesOrderGroupKey: grouping.projectSalesOrderGroupKey,
      inventoryItemId: entry.inventoryItemId || null,
      itemDescription: entry.itemName,
      quantityRequired: entry.quantityRequired,
      unit: entry.unit,
      estimatedUnitCost: entry.unitCost,
      estimatedTotalCost: entry.totalCost,
      currency: mo.costSummary.currency,
      materialCategory: entry.category || null,
      materialGroupKey: buildRequirementMaterialGroupKey({
        projectId: grouping.projectId,
        salesOrderId: grouping.salesOrderId,
        inventoryItemId: entry.inventoryItemId ?? null,
        itemDescription: entry.itemName,
        category: entry.category ?? null,
        unit: entry.unit,
        sourceRunId: alignment.sourceRunId,
        sheetSignature: resolveSheetSignature(
          {
            itemDescription: entry.itemName,
            category: entry.category ?? null,
            unit: entry.unit,
          },
          alignment,
        ),
      }),
      sourceRunId: alignment.sourceRunId,
      supplierId: entry.supplierId || null,
      supplierName: entry.supplierName || null,
      status: 'pending' as ProcurementRequirementStatus,
      poId: null,
      poLineItemId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    });
    result.created.push(reqRef.id);
  }

  await batch.commit();
  return result;
}

// ============================================
// Queries
// ============================================

/**
 * Get all procurement requirements matching filters
 */
export async function getProcurementRequirements(
  filters: ProcurementFilters & { subsidiaryId: string },
): Promise<ProcurementRequirement[]> {
  const constraints: QueryConstraint[] = [
    where('subsidiaryId', '==', filters.subsidiaryId),
  ];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) {
      constraints.push(where('status', '==', statuses[0]));
    }
  }

  if (filters.supplierId) {
    constraints.push(where('supplierId', '==', filters.supplierId));
  }

  if (filters.moId) {
    constraints.push(where('moId', '==', filters.moId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, REQUIREMENTS_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  let results = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ProcurementRequirement),
  );

  // Client-side search filter
  if (filters.search) {
    const term = filters.search.toLowerCase();
    results = results.filter(
      (r) =>
        r.itemDescription.toLowerCase().includes(term) ||
        r.moNumber.toLowerCase().includes(term) ||
        r.supplierName?.toLowerCase().includes(term) ||
        r.designItemName.toLowerCase().includes(term),
    );
  }

  return results;
}

/**
 * Get pending requirements grouped by supplier for consolidation
 */
export async function getRequirementsGroupedBySupplier(
  subsidiaryId: string,
): Promise<SupplierRequirementGroup[]> {
  const requirements = await getProcurementRequirements({
    subsidiaryId,
    status: 'pending',
  });

  const groupMap = new Map<string, ProcurementRequirement[]>();

  for (const req of requirements) {
    const key = req.supplierId ?? 'unassigned';
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(req);
  }

  const groups: SupplierRequirementGroup[] = [];

  for (const [supplierId, reqs] of groupMap.entries()) {
    const uniqueMOs = new Set(reqs.map((r) => r.moId));
    groups.push({
      supplierId,
      supplierName: reqs[0]?.supplierName ?? 'Unassigned',
      requirements: reqs,
      totalEstimatedCost: reqs.reduce((sum, r) => sum + r.estimatedTotalCost, 0),
      currency: reqs[0]?.currency ?? 'USD',
      moCount: uniqueMOs.size,
    });
  }

  // Sort by total cost descending
  groups.sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost);

  return groups;
}

// ============================================
// Real-time Subscriptions
// ============================================

/**
 * Subscribe to procurement requirements (real-time)
 */
export function subscribeToProcurementRequirements(
  filters: ProcurementFilters & { subsidiaryId: string },
  callback: (requirements: ProcurementRequirement[]) => void,
): () => void {
  const constraints: QueryConstraint[] = [
    where('subsidiaryId', '==', filters.subsidiaryId),
  ];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) {
      constraints.push(where('status', '==', statuses[0]));
    }
  }

  if (filters.supplierId) {
    constraints.push(where('supplierId', '==', filters.supplierId));
  }

  if (filters.moId) {
    constraints.push(where('moId', '==', filters.moId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, REQUIREMENTS_COLLECTION), ...constraints);

  return onSnapshot(q, (snapshot) => {
    let results = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as ProcurementRequirement),
    );

    if (filters.search) {
      const term = filters.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.itemDescription.toLowerCase().includes(term) ||
          r.moNumber.toLowerCase().includes(term) ||
          r.supplierName?.toLowerCase().includes(term),
      );
    }

    callback(results);
  });
}

// ============================================
// Consolidation into PO
// ============================================

/**
 * Consolidate selected procurement requirements into a new draft Purchase Order.
 * All requirements must share the same supplier.
 * Links PO to all originating MOs and marks requirements as added-to-po.
 */
export async function consolidateIntoPO(
  requirementIds: string[],
  supplierId: string,
  userId: string,
): Promise<string> {
  if (requirementIds.length === 0) {
    throw new Error('No requirements selected');
  }

  // Fetch all requirements
  const requirements: ProcurementRequirement[] = [];
  for (const reqId of requirementIds) {
    const reqDoc = await getDoc(doc(db, REQUIREMENTS_COLLECTION, reqId));
    if (reqDoc.exists()) {
      requirements.push({ id: reqDoc.id, ...reqDoc.data() } as ProcurementRequirement);
    }
  }

  if (requirements.length === 0) {
    throw new Error('No valid requirements found');
  }

  // Validate all requirements are pending and share the same supplier
  for (const req of requirements) {
    if (req.status !== 'pending') {
      throw new Error(`Requirement ${req.id} is not in pending status`);
    }
    if (req.supplierId && req.supplierId !== supplierId) {
      throw new Error(`Requirement ${req.id} has a different supplier`);
    }
  }

  // Fetch supplier info
  const supplier = await getSupplierById(supplierId);
  const supplierName = supplier?.name ?? requirements[0]?.supplierName ?? 'Unknown';
  const supplierContact = supplier
    ? `${supplier.contactPerson} — ${supplier.phone}`
    : undefined;

  type ConsolidationBucket = {
    lineItemId: string;
    requirements: ProcurementRequirement[];
    quantity: number;
    totalCost: number;
    unit: string;
    currency: string;
    inventoryItemId?: string;
    descriptionBase: string;
    projectCodes: Set<string>;
    moNumbers: Set<string>;
    optimizationApplied?: boolean;
  };

  const bucketMap = new Map<string, ConsolidationBucket>();
  const requirementToLineItemId = new Map<string, string>();

  for (const req of requirements) {
    const shouldMergeAsSheet = isSheetRequirement(req);
    const projectBucketToken = req.projectId ?? req.designProjectId ?? 'unlinked';
    const mergeKey = shouldMergeAsSheet
      ? `sheet|${projectBucketToken}|${req.materialGroupKey ?? `${req.inventoryItemId ?? req.itemDescription}|${req.unit}`}`
      : `line|${req.id}`;

    if (!bucketMap.has(mergeKey)) {
      const lineItemId = `LI-${Date.now()}-${bucketMap.size}`;
      bucketMap.set(mergeKey, {
        lineItemId,
        requirements: [],
        quantity: 0,
        totalCost: 0,
        unit: req.unit,
        currency: req.currency,
        inventoryItemId: req.inventoryItemId ?? undefined,
        descriptionBase: req.itemDescription,
        projectCodes: new Set([req.projectCode]),
        moNumbers: new Set([req.moNumber]),
      });
    }

    const bucket = bucketMap.get(mergeKey)!;
    bucket.requirements.push(req);
    bucket.quantity += req.quantityRequired;
    bucket.totalCost += req.estimatedTotalCost;
    bucket.projectCodes.add(req.projectCode);
    bucket.moNumbers.add(req.moNumber);
    if (bucket.inventoryItemId && req.inventoryItemId && bucket.inventoryItemId !== req.inventoryItemId) {
      bucket.inventoryItemId = undefined;
    }
    requirementToLineItemId.set(req.id, bucket.lineItemId);
  }

  // Build PO line items from merged buckets.
  const optimizationDemandCache = new Map<string, ProjectOptimizedDemand>();
  const lineItems: POLineItem[] = [];
  for (const bucket of Array.from(bucketMap.values())) {
    const summedUnitCost = bucket.quantity > 0 ? bucket.totalCost / bucket.quantity : 0;
    const projectIds = new Set(
      bucket.requirements.map((r) => r.projectId ?? r.designProjectId).filter(Boolean) as string[],
    );
    if (projectIds.size === 1) {
      const projectId = Array.from(projectIds)[0];
      if (!optimizationDemandCache.has(projectId)) {
        optimizationDemandCache.set(projectId, await loadProjectOptimizedDemand(projectId));
      }
      const demand = optimizationDemandCache.get(projectId)!;
      const optimizedQty = resolveOptimizedQuantityForBucket(bucket.requirements, demand);
      if (typeof optimizedQty === 'number' && optimizedQty > 0 && optimizedQty !== bucket.quantity) {
        bucket.quantity = optimizedQty;
        bucket.totalCost = summedUnitCost * optimizedQty;
        bucket.optimizationApplied = true;
      }
    }

    const unitCost = bucket.quantity > 0 ? bucket.totalCost / bucket.quantity : summedUnitCost;
    const isMerged = bucket.requirements.length > 1;
    const projectLabel = Array.from(bucket.projectCodes).filter(Boolean).join(', ') || 'Unlinked Project';
    const moCount = bucket.moNumbers.size;
    const baseDescription = isMerged
      ? `${bucket.descriptionBase} (Consolidated for ${projectLabel} — ${moCount} MO${moCount !== 1 ? 's' : ''})`
      : `${bucket.descriptionBase} (MO: ${Array.from(bucket.moNumbers)[0]})`;
    const description = bucket.optimizationApplied
      ? `${baseDescription} [Optimization-adjusted demand]`
      : baseDescription;

    lineItems.push({
      id: bucket.lineItemId,
      inventoryItemId: bucket.inventoryItemId,
      description,
      quantity: bucket.quantity,
      unitCost,
      totalCost: bucket.totalCost,
      currency: bucket.currency,
      unit: bucket.unit,
      quantityReceived: 0,
    });
  }

  // Collect unique MO IDs
  const linkedMOIds = [...new Set(requirements.map((r) => r.moId))];

  // Create the PO
  const poId = await createPurchaseOrder(
    {
      supplierName,
      supplierContact,
      supplierId,
      lineItems,
      landedCosts: { ...DEFAULT_LANDED_COSTS, currency: requirements[0].currency },
      linkedMOIds,
      subsidiaryId: requirements[0].subsidiaryId,
      notes: `Auto-created from ${requirements.length} procurement requirement(s) across ${linkedMOIds.length} MO(s); merged into ${lineItems.length} PO line(s)`,
    },
    userId,
  );

  // Mark requirements as added-to-po
  const batch = writeBatch(db);
  for (let i = 0; i < requirements.length; i++) {
    const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirements[i].id);
    batch.update(reqRef, {
      status: 'added-to-po',
      poId,
      poLineItemId: requirementToLineItemId.get(requirements[i].id) ?? lineItems[0]?.id,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  // Link PO to originating MOs (add poId to each MO's linkedPOIds)
  for (const moId of linkedMOIds) {
    const moRef = doc(db, MO_COLLECTION, moId);
    const moDoc = await getDoc(moRef);
    if (moDoc.exists()) {
      const existingPOIds = (moDoc.data() as ManufacturingOrder).linkedPOIds ?? [];
      if (!existingPOIds.includes(poId)) {
        await updateDoc(moRef, {
          linkedPOIds: [...existingPOIds, poId],
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  return poId;
}

// ============================================
// Status Updates
// ============================================

/**
 * Mark a requirement as ordered (when its PO is sent)
 */
export async function markRequirementOrdered(
  requirementId: string,
): Promise<void> {
  const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirementId);
  await updateDoc(reqRef, {
    status: 'ordered',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark a requirement as received (when goods are received)
 */
export async function markRequirementReceived(
  requirementId: string,
): Promise<void> {
  const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirementId);
  await updateDoc(reqRef, {
    status: 'received',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Cancel a procurement requirement
 */
export async function cancelRequirement(
  requirementId: string,
): Promise<void> {
  const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirementId);
  await updateDoc(reqRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update all requirements linked to a PO when PO status changes
 */
export async function updateRequirementsByPOStatus(
  poId: string,
  newStatus: 'ordered' | 'received',
): Promise<void> {
  const q = query(
    collection(db, REQUIREMENTS_COLLECTION),
    where('poId', '==', poId),
  );
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  for (const reqDoc of snap.docs) {
    const current = reqDoc.data() as ProcurementRequirement;
    // Only advance status forward
    if (
      (newStatus === 'ordered' && current.status === 'added-to-po') ||
      (newStatus === 'received' && ['added-to-po', 'ordered'].includes(current.status))
    ) {
      batch.update(reqDoc.ref, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
