/**
 * Handover Service
 * Bridge between Design Manager and Manufacturing module
 * Validates readiness and creates manufacturing orders from production-ready design items
 */

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { DesignItem, ManufacturingCost, PartEntry } from '@/modules/design-manager/types';
import type { BOMEntry, MOPartEntry, MOReferenceDocument } from '../types';
import type { InventoryNameResolver, InventoryMaterialResolver } from '@/modules/design-manager/services/materialHarvester';
import { createManufacturingOrder } from './manufacturingOrderService';
import { getStockLevels } from '@/modules/inventory/services/stockLevelService';
import { resolveSupplierFromText } from '@/modules/procurement/services/supplierBridgeService';
import { generateRequirementsFromMO } from '@/modules/procurement/services/procurementRequirementService';

const PROJECTS_COLLECTION = 'designProjects';
const ITEMS_SUBCOLLECTION = 'designItems';

// ============================================
// Readiness Validation
// ============================================

export interface HandoverValidationResult {
  isReady: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Validate that a design item is ready for manufacturing handover
 */
export function validateHandoverReadiness(
  designItem: DesignItem,
): HandoverValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Must be correct sourcing type
  if (
    designItem.sourcingType !== 'CUSTOM_FURNITURE_MILLWORK' &&
    designItem.sourcingType !== 'MANUFACTURED'
  ) {
    issues.push('Item must be Custom Furniture/Millwork or Manufactured type');
  }

  // Must be at production-ready stage
  if (designItem.currentStage !== 'production-ready') {
    issues.push(
      `Item is at stage "${designItem.currentStage}", must be "production-ready"`,
    );
  }

  // Must have manufacturing cost data
  if (!designItem.manufacturing) {
    issues.push('No manufacturing cost data available');
  } else {
    if (designItem.manufacturing.totalCost <= 0) {
      warnings.push('Manufacturing total cost is zero');
    }
  }

  // Check RAG manufacturing readiness aspects
  const mfgReadiness = designItem.ragStatus?.manufacturingReadiness;
  if (mfgReadiness) {
    const criticalAspects = [
      { key: 'materialAvailability', label: 'Material Availability' },
      { key: 'processDocumentation', label: 'Process Documentation' },
      { key: 'costValidation', label: 'Cost Validation' },
    ] as const;

    for (const aspect of criticalAspects) {
      const status = mfgReadiness[aspect.key]?.status;
      if (status === 'red') {
        issues.push(`${aspect.label} is RED - must be resolved before handover`);
      } else if (status === 'amber') {
        warnings.push(`${aspect.label} is AMBER - consider resolving before handover`);
      }
    }
  }

  // Check for production drawings (workshop viewer print packages)
  // This is a warning, not a blocker — drawings improve but aren't required for handover
  // Note: deliverables are in a Firestore subcollection, so this is an advisory check
  // based on the ragStatus field which gets auto-updated when print packages are saved
  const drawingStatus = (designItem.ragStatus as unknown as Record<string, unknown>)?.designCompleteness as unknown as Record<string, unknown> | undefined;
  if (!drawingStatus?.productionDrawings || (drawingStatus.productionDrawings as string) !== 'green') {
    warnings.push('No shop drawings found — consider generating a Workshop Viewer print package before production');
  }

  return {
    isReady: issues.length === 0,
    issues,
    warnings,
  };
}

// ============================================
// BOM Generation
// ============================================

/**
 * Build a bill of materials from a design item's manufacturing cost data and parts.
 * Resolves supplier text from special parts to matflow supplier records.
 * Uses metadata resolver to populate inventoryItemId and sku from the palette.
 */
export async function buildBOMFromDesignItem(
  manufacturing: ManufacturingCost,
  parts: PartEntry[],
  resolveName?: InventoryNameResolver,
  resolveMaterial?: InventoryMaterialResolver,
): Promise<BOMEntry[]> {
  const resolve = resolveName ?? ((n: string) => n);
  const bom: BOMEntry[] = [];

  // Sheet materials from manufacturing cost breakdown
  if (manufacturing.sheetMaterials) {
    for (const sheet of manufacturing.sheetMaterials) {
      // Resolve full inventory metadata (name, inventoryItemId, sku)
      const meta = resolveMaterial?.(sheet.materialName, sheet.thickness);
      const resolvedName = meta?.name ?? resolve(sheet.materialName, sheet.thickness);
      const nameChanged = resolvedName !== sheet.materialName;
      const offcutId = meta?.offcutIds?.[0]; // Use first reserved offcut for this material

      // Find min purchasePriority among parts using this material+thickness
      const relevantParts = parts.filter(
        (p) => p.materialName === sheet.materialName && p.thickness === sheet.thickness,
      );
      const priorities = relevantParts
        .map((p) => p.purchasePriority)
        .filter((v): v is number => v != null);
      const minPriority = priorities.length > 0 ? Math.min(...priorities) : undefined;

      bom.push({
        id: `BOM-SHEET-${sheet.materialName}-${sheet.thickness}`,
        inventoryItemId: meta?.inventoryItemId || sheet.materialId || '',
        sku: meta?.inventorySku || '',
        // Inventory names often include thickness — don't double-append
        itemName: nameChanged ? resolvedName : `${sheet.materialName} ${sheet.thickness}mm`,
        category: 'sheet-goods',
        quantityRequired: sheet.sheetsRequired,
        unit: 'sheet',
        unitCost: sheet.unitCost,
        totalCost: sheet.totalCost,
        ...(offcutId && { offcutId }),
        ...(minPriority != null && { purchasePriority: minPriority, prioritySource: 'design' as const }),
      });
    }
  }

  // Standard parts (hardware from inventory)
  if (manufacturing.standardParts) {
    for (const part of manufacturing.standardParts) {
      bom.push({
        id: `BOM-STD-${part.id}`,
        inventoryItemId: '',
        sku: part.sku ?? '',
        itemName: part.name,
        category: part.category,
        quantityRequired: part.quantity,
        unit: 'pcs',
        unitCost: part.unitCost,
        totalCost: part.totalCost,
        ...(part.purchasePriority != null && { purchasePriority: part.purchasePriority, prioritySource: 'design' as const }),
      });
    }
  }

  // Special parts (luxury items) — resolve supplier text to matflow supplier
  if (manufacturing.specialParts) {
    for (const part of manufacturing.specialParts) {
      let supplierId: string | undefined;
      let supplierName: string | undefined;

      if (part.supplier) {
        const resolved = await resolveSupplierFromText(part.supplier);
        if (resolved) {
          supplierId = resolved.supplierId;
          supplierName = resolved.supplierName;
        } else {
          // Could not resolve — keep original text in notes
          supplierName = part.supplier;
        }
      }

      bom.push({
        id: `BOM-SPL-${part.id}`,
        inventoryItemId: '',
        sku: part.partNumber ?? '',
        itemName: part.name,
        category: part.category,
        quantityRequired: part.quantity,
        unit: 'pcs',
        unitCost: part.costing?.landedUnitCost ?? 0,
        totalCost: part.costing?.totalLandedCost ?? 0,
        supplierId,
        supplierName,
        notes: !supplierId && part.supplier ? `Supplier (unresolved): ${part.supplier}` : undefined,
        ...(part.purchasePriority != null && { purchasePriority: part.purchasePriority, prioritySource: 'design' as const }),
      });
    }
  }

  // Note: Labor is tracked at payroll level, not per MO — no labor BOM lines created

  // Edge banding from parts
  const edgeBandingParts = parts.filter(
    (p) =>
      p.edgeBanding &&
      (p.edgeBanding.top || p.edgeBanding.bottom || p.edgeBanding.left || p.edgeBanding.right),
  );
  if (edgeBandingParts.length > 0) {
    // Calculate total linear meters of edge banding needed
    let totalEdgeMeters = 0;
    for (const part of edgeBandingParts) {
      const eb = part.edgeBanding;
      const lengthM = part.length / 1000;
      const widthM = part.width / 1000;
      const edgeLength =
        (eb.top ? lengthM : 0) +
        (eb.bottom ? lengthM : 0) +
        (eb.left ? widthM : 0) +
        (eb.right ? widthM : 0);
      totalEdgeMeters += edgeLength * part.quantity;
    }

    if (totalEdgeMeters > 0) {
      // Find min purchasePriority among edge-banding parts
      const ebPriorities = edgeBandingParts
        .map((p) => p.purchasePriority)
        .filter((v): v is number => v != null);
      const minEbPriority = ebPriorities.length > 0 ? Math.min(...ebPriorities) : undefined;

      bom.push({
        id: 'BOM-EDGE-TOTAL',
        inventoryItemId: '',
        sku: '',
        itemName: 'Edge Banding (estimated)',
        category: 'edge-banding',
        quantityRequired: Math.ceil(totalEdgeMeters * 1.1), // 10% waste
        unit: 'lm',
        unitCost: 0,
        totalCost: 0,
        notes: `Calculated from ${edgeBandingParts.length} parts`,
        ...(minEbPriority != null && { purchasePriority: minEbPriority, prioritySource: 'design' as const }),
      });
    }
  }

  return bom;
}

/**
 * Convert design item parts to MO part entries
 */
function convertToMOParts(parts: PartEntry[], resolveName?: InventoryNameResolver): MOPartEntry[] {
  const resolve = resolveName ?? ((n: string) => n);
  return parts.map((p) => ({
    id: p.id,
    partNumber: p.partNumber ?? '',
    name: p.name ?? '',
    materialName: resolve(p.materialName ?? '', p.partType === 'bar' ? undefined : p.thickness) ?? '',
    length: p.length ?? 0,
    width: p.width ?? 0,
    thickness: p.thickness ?? 0,
    quantity: p.quantity ?? 1,
    grainDirection: p.grainDirection ?? 'none',
    edgeBanding: {
      top: p.edgeBanding?.top ?? false,
      bottom: p.edgeBanding?.bottom ?? false,
      left: p.edgeBanding?.left ?? false,
      right: p.edgeBanding?.right ?? false,
    },
    hasCNCOperations: p.hasCNCOperations ?? false,
    ...(p.purchasePriority != null && { purchasePriority: p.purchasePriority }),
  }));
}

// ============================================
// Material Availability Check
// ============================================

export interface MaterialAvailabilityReport {
  bomEntry: BOMEntry;
  totalAvailable: number;
  isSufficient: boolean;
}

/**
 * Check material availability for a BOM
 */
export async function checkMaterialAvailability(
  bom: BOMEntry[],
): Promise<MaterialAvailabilityReport[]> {
  const report: MaterialAvailabilityReport[] = [];

  for (const entry of bom) {
    if (!entry.inventoryItemId) {
      report.push({
        bomEntry: entry,
        totalAvailable: 0,
        isSufficient: false,
      });
      continue;
    }

    const stockLevels = await getStockLevels(entry.inventoryItemId);
    const totalAvailable = stockLevels.reduce(
      (sum, sl) => sum + sl.quantityAvailable,
      0,
    );

    report.push({
      bomEntry: entry,
      totalAvailable,
      isSufficient: totalAvailable >= entry.quantityRequired,
    });
  }

  return report;
}

// ============================================
// Handover Execution
// ============================================

/**
 * Initiate handover from design manager to manufacturing.
 *
 * Phase 3: after the MO is created this also produces an immutable
 * **handoff bundle** — a ZIP of every `isLatest` file for the item
 * stored as a `projectFiles` doc with `status='approved'` and
 * auto-shared to the client portal. The bundle is linked back via
 * `MO.handoffBundleFileId` and `MO.projectFileIds`, and constituent
 * files are frozen (`status='approved'`) so no post-handoff silent
 * edit can diverge the workshop copy from the client-signed copy.
 *
 * Idempotency: if the design item already has a `manufacturingOrderId`
 * set (from a prior successful handoff), we return the existing MO
 * without re-bundling or double-creating.
 */
export async function initiateHandover(
  projectId: string,
  designItemId: string,
  userId: string,
  handoverNotes: string = '',
  userName?: string,
): Promise<{ moId: string; validation: HandoverValidationResult; bundleFileId?: string }> {
  // Fetch design item
  const itemRef = doc(
    db,
    PROJECTS_COLLECTION,
    projectId,
    ITEMS_SUBCOLLECTION,
    designItemId,
  );
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw new Error('Design item not found');

  const designItem = { id: itemSnap.id, ...itemSnap.data() } as DesignItem;

  // Idempotency guard — if handoff already happened for this item, don't
  // create a second MO or a second bundle. Reuse the existing MO; if the
  // MO doesn't yet have a bundle, Phase 3 will attach one.
  if (designItem.manufacturingOrderId) {
    const existingMoId = designItem.manufacturingOrderId;
    const validation: HandoverValidationResult = { isReady: true, issues: [], warnings: [] };
    // Best-effort: ensure the existing MO has a bundle. If it doesn't,
    // create one now and link it.
    let bundleFileId: string | undefined;
    try {
      const moSnap = await getDoc(doc(db, 'manufacturingOrders', existingMoId));
      const existingBundleId = moSnap.exists()
        ? (moSnap.data()?.handoffBundleFileId as string | undefined)
        : undefined;
      if (!existingBundleId) {
        const { createHandoffBundle, linkBundleToMO } = await import('./handoffBundleService');
        const projectCodeForReuse = (await getDoc(doc(db, PROJECTS_COLLECTION, projectId))).data()?.code;
        const bundle = await createHandoffBundle({
          projectId,
          projectCode: projectCodeForReuse,
          itemId: designItemId,
          itemName: designItem.name,
          userId,
          userName,
          manufacturingOrderId: existingMoId,
        });
        await linkBundleToMO(existingMoId, bundle.bundleFileId, bundle.constituentFileIds);
        bundleFileId = bundle.bundleFileId;
      } else {
        bundleFileId = existingBundleId;
      }
    } catch (err) {
      console.warn('[Handover] Idempotent-reuse bundle creation failed — proceeding without bundle link', err);
    }
    return { moId: existingMoId, validation, bundleFileId };
  }

  // Validate readiness
  const validation = validateHandoverReadiness(designItem);
  if (!validation.isReady) {
    return { moId: '', validation };
  }

  // Check if a sales order exists for this project — if so, all gates must pass
  const { getSalesOrderByProject } = await import('@/modules/sales-orders/services/salesOrderService');
  const linkedSO = await getSalesOrderByProject(projectId);
  if (linkedSO && linkedSO.status !== 'released_to_production' && linkedSO.status !== 'in_progress' && linkedSO.status !== 'completed') {
    validation.isReady = false;
    validation.issues.push(
      `Sales order ${linkedSO.orderNumber} has not been released to production. Current status: ${linkedSO.status}. All approval gates must pass before handover.`
    );
    return { moId: '', validation };
  }

  // Fetch project for code
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  const projectCode = projectSnap.exists()
    ? (projectSnap.data()?.code ?? projectId)
    : projectId;

  // Parts are stored as a field on the design item document, not a subcollection
  const parts: PartEntry[] = (itemSnap.data()?.parts as PartEntry[]) || [];

  // Build name + metadata resolvers from project's material palette
  const { buildInventoryNameResolver, buildInventoryMaterialResolver } = await import(
    '@/modules/design-manager/services/materialHarvester'
  );
  const palette = projectSnap.exists() ? projectSnap.data()?.materialPalette : null;
  const resolveName = buildInventoryNameResolver(palette);
  const resolveMaterial = buildInventoryMaterialResolver(palette);

  // Build BOM (async — resolves suppliers) and parts
  const bom = await buildBOMFromDesignItem(designItem.manufacturing!, parts, resolveName, resolveMaterial);
  const moParts = convertToMOParts(parts, resolveName);

  // Create manufacturing order — inherit design position as initial production rank
  const moId = await createManufacturingOrder(
    {
      designItemId,
      designProjectId: projectId,
      projectId,
      projectCode,
      salesOrderId: linkedSO?.id,
      designItemName: designItem.name,
      quantity: designItem.requiredQuantity ?? 1,
      priority: designItem.priority ?? 'medium',
      productionRank: designItem.sortOrder ?? 0,
      bom,
      parts: moParts,
      instructions: designItem.notes ?? '',
      handoverNotes,
      subsidiaryId: 'finishes',
    },
    userId,
  );

  // Link MO back to design item.
  // P7 phase 3 — `manufacturingOrderId` is the canonical signal;
  // `deriveHandoverStatus` returns 'handed-over' whenever it's set.
  // The previous `handoverStatus: 'handed-over'` mirror has been
  // removed (it was fully redundant with this FK).
  await updateDoc(itemRef, {
    manufacturingOrderId: moId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Copy Workshop Viewer print packages as MO reference documents
  try {
    const sessionsSnap = await getDocs(
      query(
        collection(db, 'workshop_viewer_sessions'),
        where('linkedDesignItemId', '==', designItemId),
      )
    );
    const refDocs: MOReferenceDocument[] = [];
    for (const sessDoc of sessionsSnap.docs) {
      const sess = sessDoc.data();
      if (sess.lastPrintPackageUrl) {
        refDocs.push({
          id: `ws-${sessDoc.id}`,
          type: 'print-package',
          name: `Print Package — ${designItem.name}`,
          storageUrl: sess.lastPrintPackageUrl,
          source: 'workshop-viewer',
          sourceSessionId: sessDoc.id,
          createdAt: serverTimestamp() as unknown as Timestamp,
          createdBy: userId,
        });
      }
    }
    if (refDocs.length > 0) {
      const moRef = doc(db, 'manufacturingOrders', moId);
      await updateDoc(moRef, { referenceDocuments: refDocs });
    }
  } catch {
    console.warn('Failed to copy workshop viewer print packages to MO:', moId);
  }

  // Phase 3 — produce the immutable handoff bundle + freeze constituent
  // files + portal-share the bundle + stamp canonical FKs on the MO.
  // Non-fatal: a bundle-creation failure does NOT block the handover
  // itself (MO has already been created + linked). The error is logged
  // so operators can retry manually; the MO will simply lack
  // `handoffBundleFileId` until then.
  let bundleFileId: string | undefined;
  try {
    const { createHandoffBundle, linkBundleToMO } = await import('./handoffBundleService');
    const bundle = await createHandoffBundle({
      projectId,
      projectCode,
      itemId: designItemId,
      itemName: designItem.name,
      userId,
      userName,
      manufacturingOrderId: moId,
    });
    await linkBundleToMO(moId, bundle.bundleFileId, bundle.constituentFileIds);
    bundleFileId = bundle.bundleFileId;
  } catch (err) {
    console.warn('[Handover] Bundle creation failed — MO shipped without bundle:', err);
  }

  // Auto-generate procurement requirements for outsourced BOM items
  try {
    await generateRequirementsFromMO(moId, userId);
  } catch {
    // Non-critical — procurement requirements can be generated manually later
    console.warn('Failed to auto-generate procurement requirements for MO:', moId);
  }

  return { moId, validation, bundleFileId };
}

// ============================================
// Batch Release to Production
// ============================================

const BATCHES_COLLECTION = 'productionBatches';

interface BatchReleaseResult {
  designItemId: string;
  designItemName: string;
  moId: string;
  success: boolean;
  error?: string;
}

/**
 * Release multiple design items to production as a batch.
 * Creates individual MOs for each item (reusing initiateHandover)
 * and groups them under a ProductionBatch document.
 */
export async function batchReleaseToProduction(
  projectId: string,
  designItemIds: string[],
  userId: string,
  handoverNotes: string = '',
): Promise<{
  batchId: string;
  batchNumber: string;
  results: BatchReleaseResult[];
}> {
  if (designItemIds.length === 0) {
    throw new Error('No design items selected for release');
  }

  // Fetch project info
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  const projectData = projectSnap.exists() ? projectSnap.data() : {};
  const projectCode = projectData?.code ?? projectId;
  const projectName = projectData?.name ?? '';
  const { getSalesOrderByProject } = await import('@/modules/sales-orders/services/salesOrderService');
  const linkedSO = await getSalesOrderByProject(projectId);

  // Generate batch number
  const year = new Date().getFullYear();
  const batchesQuery = query(
    collection(db, BATCHES_COLLECTION),
    orderBy('createdAt', 'desc'),
  );
  const batchesSnap = await getDocs(batchesQuery);
  const nextBatchNum = batchesSnap.size + 1;
  const batchNumber = `PB-${year}-${String(nextBatchNum).padStart(4, '0')}`;

  // Release each item, collecting results
  const results: BatchReleaseResult[] = [];
  const successfulMoIds: string[] = [];

  for (const designItemId of designItemIds) {
    // Fetch item name for result reporting
    const itemRef = doc(db, PROJECTS_COLLECTION, projectId, ITEMS_SUBCOLLECTION, designItemId);
    const itemSnap = await getDoc(itemRef);
    const itemName = itemSnap.exists() ? (itemSnap.data()?.name ?? designItemId) : designItemId;

    try {
      const { moId, validation } = await initiateHandover(
        projectId,
        designItemId,
        userId,
        handoverNotes,
      );

      if (moId) {
        successfulMoIds.push(moId);
        results.push({ designItemId, designItemName: itemName, moId, success: true });
      } else {
        results.push({
          designItemId,
          designItemName: itemName,
          moId: '',
          success: false,
          error: validation.issues.join('; '),
        });
      }
    } catch (err: unknown) {
      results.push({
        designItemId,
        designItemName: itemName,
        moId: '',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  if (successfulMoIds.length === 0) {
    return { batchId: '', batchNumber: '', results };
  }

  // Create ProductionBatch document
  const batchData = {
    batchNumber,
    projectId,
    projectCode,
    projectName,
    salesOrderId: linkedSO?.id ?? null,
    moIds: successfulMoIds,
    totalItems: successfulMoIds.length,
    completedItems: 0,
    status: 'released' as const,
    subsidiaryId: 'finishes',
    createdAt: serverTimestamp(),
    createdBy: userId,
  };

  const batchRef = await addDoc(collection(db, BATCHES_COLLECTION), batchData);

  // Link each MO back to the batch
  for (const moId of successfulMoIds) {
    await updateDoc(doc(db, 'manufacturingOrders', moId), {
      batchId: batchRef.id,
      batchNumber,
    });
  }

  return { batchId: batchRef.id, batchNumber, results };
}
