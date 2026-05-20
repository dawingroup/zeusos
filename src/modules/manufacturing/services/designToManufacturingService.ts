/**
 * Design to Manufacturing Service
 * Orchestrates releasing design items to production and syncing design changes to MOs
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  RoutingTemplate,
  ReleaseToProductionOptions,
  ReleaseResult,
  BOMCategory,
} from '../types';
import { bomService } from './bomService';
import { cleanArrayForFirestore } from './manufacturingOrderService';

const MO_COLLECTION = 'manufacturingOrders';
const STEPS_SUBCOLLECTION = 'steps';
const BOM_SUBCOLLECTION = 'bom';
const TEMPLATES_COLLECTION = 'routing_templates';
const DESIGN_PROJECTS_COLLECTION = 'designProjects';
const DESIGN_ITEMS_SUBCOLLECTION = 'designItems';

// ============================================
// Helpers
// ============================================

/**
 * Recursively strip undefined values from an object/array so Firestore doesn't reject the write.
 * Handles nested objects AND arrays (previously arrays were skipped).
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item !== null && typeof item === 'object' && !(item instanceof Date)
          ? stripUndefined(item as Record<string, unknown>)
          : item
      );
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      result[key] = stripUndefined(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// ============================================
// Main Release Flow
// ============================================

/**
 * Release design items to production
 */
async function releaseToProduction(
  options: ReleaseToProductionOptions,
  userId: string,
): Promise<ReleaseResult> {
  const result: ReleaseResult = {
    success: true,
    manufacturingOrderIds: [],
    errors: [],
    warnings: [],
  };

  // 1. Fetch design project
  const projectSnap = await getDoc(doc(db, DESIGN_PROJECTS_COLLECTION, options.designProjectId));
  if (!projectSnap.exists()) {
    return { ...result, success: false, errors: [{ designItemId: '*', error: 'Project not found' }] };
  }
  const project = projectSnap.data();

  // 2. Get routing template
  let template: RoutingTemplate | null = null;
  if (options.routingTemplateId) {
    const tSnap = await getDoc(doc(db, TEMPLATES_COLLECTION, options.routingTemplateId));
    if (tSnap.exists()) {
      template = { id: tSnap.id, ...tSnap.data() } as RoutingTemplate;
    }
  }

  // 3. Process each design item
  for (const itemId of options.designItemIds) {
    try {
      // Fetch the design item from the project's designItems subcollection
      let itemSnap = await getDoc(
        doc(db, DESIGN_PROJECTS_COLLECTION, options.designProjectId, DESIGN_ITEMS_SUBCOLLECTION, itemId),
      );
      // Fallback: try top-level designItems collection (legacy)
      if (!itemSnap.exists()) {
        itemSnap = await getDoc(doc(db, 'designItems', itemId));
      }
      if (!itemSnap.exists()) {
        result.errors.push({ designItemId: itemId, error: 'Design item not found' });
        continue;
      }
      const item = itemSnap.data();
      const estimatedItemCost =
        (item?.manufacturing as Record<string, unknown> | undefined)?.totalCost as number | undefined
        ?? (item?.construction as Record<string, unknown> | undefined)?.totalCost as number | undefined
        ?? 0;

      // Auto-detect template if not provided
      if (!template) {
        template = await detectRoutingTemplate(item, options.designProjectId);
      }

      if (!template) {
        result.warnings.push(`No routing template found for "${item.name}". Using default steps.`);
      }

      // Generate MO number
      const year = new Date().getFullYear();
      const countSnap = await getDocs(
        query(collection(db, MO_COLLECTION), where('subsidiaryId', '==', 'finishes')),
      );
      const moNumber = `MO-${year}-${String(countSnap.size + 1 + result.manufacturingOrderIds.length).padStart(4, '0')}`;

      // Create Manufacturing Order
      const now = serverTimestamp();
      const moData: Record<string, unknown> = {
        moNumber,
        status: 'draft',
        mesStatus: 'draft',
        sourceType: 'design_handover',
        sourceRef: {
          designProjectId: options.designProjectId,
          designItemId: itemId,
        },
        designItemId: itemId,
        designProjectId: options.designProjectId,
        projectId: options.designProjectId,
        projectCode: project.code ?? '',
        salesOrderId: options.salesOrderId ?? null,
        projectPhase: options.projectPhase ?? null,
        demandSource: options.salesOrderId
          ? { type: 'sales_order', referenceId: options.salesOrderId }
          : undefined,
        designItemName: item.name ?? '',
        itemName: item.name ?? '',
        quantity: item.requiredQuantity ?? 1,
        priority: options.priority,
        bom: [],
        parts: item.parts ?? [],
        instructions: options.notes ?? '',
        handoverNotes: '',
        scheduling: {
          scheduledStart: options.scheduledStartDate ?? null,
        },
        materialReservations: [],
        materialConsumptions: [],
        stageHistory: [],
        currentStage: 'queued',
        stageEnteredAt: now,
        costSummary: {
          materialCost: estimatedItemCost,
          laborCost: 0, // Labor tracked at payroll level, not per MO
          totalCost: estimatedItemCost,
          currency: 'UGX',
        },
        linkedPOIds: [],
        subsidiaryId: 'finishes',
        routingTemplateId: template?.id ?? null,
        totalSteps: template?.steps.length ?? 0,
        completedSteps: 0,
        currentStepIndex: 0,
        dueDate: options.dueDate ?? null,
        scheduledStartDate: options.scheduledStartDate ?? null,
        estimatedLaborHours: template ? template.estimatedTotalMinutes / 60 : 0,
        actualLaborHours: 0,
        estimatedMaterialCost: estimatedItemCost,
        actualMaterialCost: 0,
        estimatedTotalCost: estimatedItemCost,
        actualTotalCost: 0,
        defectCount: 0,
        reworkOrderIds: [],
        bomLineCount: 0,
        bomTotalMaterialCost: 0,
        customerName: project.customerName ?? null,
        customerId: project.customerId ?? null,
        projectName: project.name ?? null,
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
        updatedBy: userId,
      };

      const moRef = await addDoc(collection(db, MO_COLLECTION), stripUndefined(moData));

      // Generate steps from template
      if (template) {
        await generateStepsFromTemplate(moRef.id, template, item.features ?? []);
      } else {
        await generateDefaultSteps(moRef.id, item);
      }

      // Generate BOM from design item (with inventory identifiers + resolved names from palette)
      await generateBOMFromDesignItem(moRef.id, item, options.designProjectId);

      // Back-link: set manufacturingOrderId on the design item
      try {
        const itemRef = doc(
          db,
          DESIGN_PROJECTS_COLLECTION,
          options.designProjectId,
          DESIGN_ITEMS_SUBCOLLECTION,
          itemId,
        );
        // P7 phase 3 — `manufacturingOrderId` is the canonical signal;
        // derivation handles the handover-status view. No flat mirror.
        await updateDoc(itemRef, stripUndefined({
          manufacturingOrderId: moRef.id,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        }));
      } catch {
        result.warnings.push(`Could not back-link MO to design item "${item.name}"`);
      }

      result.manufacturingOrderIds.push(moRef.id);
    } catch (err) {
      result.errors.push({
        designItemId: itemId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Check material availability
  if (result.manufacturingOrderIds.length > 0) {
    try {
      const lastMoId = result.manufacturingOrderIds[result.manufacturingOrderIds.length - 1];
      result.availabilityReport = await bomService.checkMaterialAvailability(lastMoId);
    } catch {
      result.warnings.push('Could not check material availability');
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

// ============================================
// Template Detection
// ============================================

/**
 * Detect the best routing template based on design item features
 */
async function detectRoutingTemplate(
  designItem: Record<string, unknown>,
  _projectId: string,
): Promise<RoutingTemplate | null> {
  const snap = await getDocs(
    query(
      collection(db, TEMPLATES_COLLECTION),
      where('isActive', '==', true),
      orderBy('name', 'asc'),
    ),
  );

  if (snap.empty) return null;

  const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }) as RoutingTemplate);

  // Try to match by product type
  const category = designItem.category as string ?? '';
  const matched = templates.find(t =>
    t.productType.toLowerCase() === category.toLowerCase(),
  );

  if (matched) return matched;

  // Fall back to default template
  return templates.find(t => t.isDefault) ?? templates[0] ?? null;
}

/**
 * Generate manufacturing steps from a routing template
 */
async function generateStepsFromTemplate(
  orderId: string,
  template: RoutingTemplate,
  designItemFeatures: string[],
): Promise<void> {
  const now = serverTimestamp();

  for (const templateStep of template.steps) {
    // Skip optional steps whose trigger features don't match
    if (templateStep.isOptional && templateStep.triggerFeatures && templateStep.triggerFeatures.length > 0) {
      const hasMatchingFeature = templateStep.triggerFeatures.some(f =>
        designItemFeatures.includes(f),
      );
      if (!hasMatchingFeature) continue;
    }

    const stepData = {
      orderId,
      stepIndex: templateStep.stepIndex,
      name: templateStep.name,
      workstationType: templateStep.workstationType,
      workstationId: templateStep.defaultWorkstationId ?? null,
      status: 'queued' as const,
      statusHistory: [],
      estimatedDurationMinutes: templateStep.estimatedDurationMinutes,
      timeEntries: [],
      qcRequired: templateStep.qcRequired,
      materialsConsumed: [],
      dependsOnStepIds: [],
      isRework: false,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(
      collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
      stepData,
    );
  }
}

/**
 * Generate default steps when no template matches
 */
async function generateDefaultSteps(
  orderId: string,
  _designItem: Record<string, unknown>,
): Promise<void> {
  const now = serverTimestamp();
  const defaultSteps = [
    { name: 'Cutting', workstationType: 'cutting_panel_saw' as const, duration: 60 },
    { name: 'Edge Banding', workstationType: 'edgebanding' as const, duration: 45 },
    { name: 'Drilling', workstationType: 'drilling' as const, duration: 30 },
    { name: 'Assembly', workstationType: 'assembly' as const, duration: 90 },
    { name: 'Finishing', workstationType: 'finishing_spray' as const, duration: 60 },
    { name: 'Quality Check', workstationType: 'quality_control' as const, duration: 20, qcRequired: true },
    { name: 'Packing', workstationType: 'packing' as const, duration: 15 },
  ];

  for (let i = 0; i < defaultSteps.length; i++) {
    const step = defaultSteps[i];
    await addDoc(collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION), {
      orderId,
      stepIndex: i,
      name: step.name,
      workstationType: step.workstationType,
      status: 'queued',
      statusHistory: [],
      estimatedDurationMinutes: step.duration,
      timeEntries: [],
      qcRequired: step.qcRequired ?? false,
      materialsConsumed: [],
      dependsOnStepIds: [],
      isRework: false,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Generate BOM lines from design item materials, including inventory identifiers.
 * Resolves actual material names from the project's material palette (e.g. "Sonae White MDF 16mm"
 * instead of generic "MDF").
 */
async function generateBOMFromDesignItem(
  orderId: string,
  designItem: Record<string, unknown>,
  projectId?: string,
): Promise<void> {
  const manufacturing = designItem.manufacturing as Record<string, unknown> | undefined;
  if (!manufacturing) return;

  // Build name + metadata resolvers from the project's material palette
  let resolveName: (materialName: string, thickness?: number) => string = (n) => n;
  let resolveMaterial: (materialName: string, thickness?: number) => {
    name: string;
    inventoryItemId?: string;
    inventorySku?: string;
    offcutIds?: string[];
  } = (n) => ({ name: n });

  if (projectId) {
    try {
      const projectSnap = await getDoc(doc(db, DESIGN_PROJECTS_COLLECTION, projectId));
      if (projectSnap.exists()) {
        const palette = projectSnap.data()?.materialPalette;
        if (palette) {
          const { buildInventoryNameResolver, buildInventoryMaterialResolver } = await import(
            '@/modules/design-manager/services/materialHarvester'
          );
          resolveName = buildInventoryNameResolver(palette);
          resolveMaterial = buildInventoryMaterialResolver(palette);
        }
      }
    } catch {
      // If palette resolution fails, fall back to raw names
    }
  }

  // Build inline BOM array (BOMEntry format) for the MO document
  const inlineBom: Array<Record<string, unknown>> = [];

  let lineNumber = 1;

  // Use writeBatch to create all BOM lines in a single commit (instead of N sequential writes)
  const batch = writeBatch(db);
  const bomCollRef = collection(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION);
  const now = Timestamp.now();

  /** Helper: add a BOM line to the batch and inline array */
  function addLineToBatch(
    lineData: Record<string, unknown>,
    inlineEntry: Record<string, unknown>,
  ) {
    const lineRef = doc(bomCollRef);
    batch.set(lineRef, stripUndefined({
      ...lineData,
      orderId,
      createdAt: now,
      updatedAt: now,
    }));
    inlineBom.push(inlineEntry);
  }

  // Sheet materials — resolve actual inventory names via palette
  const sheetMaterials = manufacturing.sheetMaterials as Array<Record<string, unknown>> ?? [];
  for (const mat of sheetMaterials) {
    const rawName = (mat.materialName as string) ?? 'Sheet Material';
    const thickness = mat.thickness as number | undefined;
    const meta = resolveMaterial(rawName, thickness);
    const resolvedName = meta.name ?? resolveName(rawName, thickness);
    const nameChanged = resolvedName !== rawName;
    const invId = meta.inventoryItemId ?? (mat.inventoryItemId as string) ?? (mat.materialId as string) ?? '';
    const sku = meta.inventorySku ?? '';
    const itemName = nameChanged ? resolvedName : (thickness ? `${rawName} ${thickness}mm` : rawName);
    const qty = (mat.quantity as number) ?? (mat.sheetsRequired as number) ?? 1;
    const cost = (mat.unitCost as number) ?? 0;
    const total = (mat.totalCost as number) ?? 0;
    addLineToBatch({
      lineNumber: lineNumber++,
      category: 'sheet_material' as BOMCategory,
      materialName: itemName,
      specification: mat.dimensions ? `${mat.dimensions}` : null,
      inventoryItemId: invId || undefined,
      materialCode: sku || undefined,
      requiredQuantity: qty,
      unit: 'sheets',
      unitCost: cost,
      totalEstimatedCost: total,
      totalActualCost: 0,
      reservedQuantity: 0,
      consumedQuantity: 0,
      wasteQuantity: 0,
      procurementStatus: 'pending',
      fromOptimization: false,
    }, {
      id: `BOM-SHEET-${lineNumber - 1}`,
      inventoryItemId: invId, sku, itemName,
      category: 'sheet-goods', quantityRequired: qty, unit: 'sheet', unitCost: cost, totalCost: total,
    });
  }

  // Timber/linear materials — resolve names via palette
  const timberMaterials = manufacturing.timberMaterials as Array<Record<string, unknown>> ?? [];
  for (const mat of timberMaterials) {
    const rawName = (mat.materialName as string) ?? 'Timber';
    const thickness = mat.thickness as number | undefined;
    const meta = resolveMaterial(rawName, thickness);
    const resolvedName = meta.name ?? resolveName(rawName, thickness);
    const invId = meta.inventoryItemId ?? (mat.inventoryItemId as string) ?? (mat.materialId as string) ?? '';
    const sku = meta.inventorySku ?? '';
    const itemName = resolvedName !== rawName ? resolvedName : rawName;
    const qty = (mat.quantity as number) ?? 1;
    const cost = (mat.unitCost as number) ?? 0;
    const total = (mat.totalCost as number) ?? 0;
    addLineToBatch({
      lineNumber: lineNumber++,
      category: 'linear_material' as BOMCategory,
      materialName: itemName,
      specification: mat.dimensions ? `${mat.dimensions}` : null,
      inventoryItemId: invId || undefined,
      materialCode: sku || undefined,
      requiredQuantity: qty,
      unit: (mat.unit as string) ?? 'pcs',
      unitCost: cost,
      totalEstimatedCost: total,
      totalActualCost: 0,
      reservedQuantity: 0,
      consumedQuantity: 0,
      wasteQuantity: 0,
      procurementStatus: 'pending',
      fromOptimization: false,
    }, {
      id: `BOM-TIMBER-${lineNumber - 1}`,
      inventoryItemId: invId, sku, itemName,
      category: 'timber', quantityRequired: qty, unit: (mat.unit as string) ?? 'pcs', unitCost: cost, totalCost: total,
    });
  }

  // Edging materials — resolve names via palette
  const edgingMaterials = manufacturing.edgingMaterials as Array<Record<string, unknown>> ?? [];
  for (const mat of edgingMaterials) {
    const rawName = (mat.materialName as string) ?? 'Edge Banding';
    const thickness = mat.thickness as number | undefined;
    const meta = resolveMaterial(rawName, thickness);
    const resolvedName = meta.name ?? resolveName(rawName, thickness);
    const invId = meta.inventoryItemId ?? (mat.inventoryItemId as string) ?? (mat.materialId as string) ?? '';
    const sku = meta.inventorySku ?? '';
    const itemName = resolvedName !== rawName ? resolvedName : rawName;
    const qty = (mat.quantity as number) ?? 1;
    const cost = (mat.unitCost as number) ?? 0;
    const total = (mat.totalCost as number) ?? 0;
    addLineToBatch({
      lineNumber: lineNumber++,
      category: 'linear_material' as BOMCategory,
      materialName: itemName,
      inventoryItemId: invId || undefined,
      materialCode: sku || undefined,
      requiredQuantity: qty,
      unit: 'lm',
      unitCost: cost,
      totalEstimatedCost: total,
      totalActualCost: 0,
      reservedQuantity: 0,
      consumedQuantity: 0,
      wasteQuantity: 0,
      procurementStatus: 'pending',
      fromOptimization: false,
    }, {
      id: `BOM-EDGE-${lineNumber - 1}`,
      inventoryItemId: invId, sku, itemName,
      category: 'edging', quantityRequired: qty, unit: 'lm', unitCost: cost, totalCost: total,
    });
  }

  // Standard parts (hardware)
  const standardParts = manufacturing.standardParts as Array<Record<string, unknown>> ?? [];
  for (const part of standardParts) {
    const itemName = (part.name as string) ?? 'Hardware';
    const invId = (part.inventoryItemId as string) ?? '';
    const sku = (part.sku as string) ?? '';
    const qty = (part.quantity as number) ?? 1;
    const cost = (part.unitCost as number) ?? 0;
    const total = (part.totalCost as number) ?? 0;
    addLineToBatch({
      lineNumber: lineNumber++,
      category: 'hardware' as BOMCategory,
      materialName: itemName,
      inventoryItemId: invId || undefined,
      materialCode: sku || undefined,
      requiredQuantity: qty,
      unit: 'pcs',
      unitCost: cost,
      totalEstimatedCost: total,
      totalActualCost: 0,
      reservedQuantity: 0,
      consumedQuantity: 0,
      wasteQuantity: 0,
      procurementStatus: 'pending',
      fromOptimization: false,
    }, {
      id: `BOM-STD-${lineNumber - 1}`,
      inventoryItemId: invId, sku, itemName,
      category: (part.category as string) ?? 'hardware', quantityRequired: qty, unit: 'pcs', unitCost: cost, totalCost: total,
    });
  }

  // Special parts (luxury/outsourced items)
  const specialParts = manufacturing.specialParts as Array<Record<string, unknown>> ?? [];
  for (const part of specialParts) {
    const costing = part.costing as Record<string, unknown> | undefined;
    const itemName = (part.name as string) ?? 'Special Part';
    const invId = (part.inventoryItemId as string) ?? '';
    const sku = (part.partNumber as string) ?? '';
    const qty = (part.quantity as number) ?? 1;
    const cost = (costing?.landedUnitCost as number) ?? (part.unitCost as number) ?? 0;
    const total = (costing?.totalLandedCost as number) ?? (cost * qty);
    addLineToBatch({
      lineNumber: lineNumber++,
      category: 'hardware' as BOMCategory,
      materialName: itemName,
      materialCode: sku || undefined,
      inventoryItemId: invId || undefined,
      requiredQuantity: qty,
      unit: 'pcs',
      unitCost: cost,
      totalEstimatedCost: total,
      totalActualCost: 0,
      reservedQuantity: 0,
      consumedQuantity: 0,
      wasteQuantity: 0,
      procurementStatus: 'pending',
      fromOptimization: false,
      notes: (part.supplier as string) ? `Supplier: ${part.supplier as string}` : undefined,
    }, {
      id: `BOM-SPL-${lineNumber - 1}`,
      inventoryItemId: invId, sku, itemName,
      category: (part.category as string) ?? 'special', quantityRequired: qty, unit: 'pcs', unitCost: cost, totalCost: total,
      supplierId: '', supplierName: (part.supplier as string) ?? '',
    });
  }

  // Commit all BOM lines in a single batch (instead of N individual writes)
  await batch.commit();

  // Write inline BOM array to MO document (keeps both systems in sync)
  if (inlineBom.length > 0) {
    await updateDoc(doc(db, MO_COLLECTION, orderId), { bom: cleanArrayForFirestore(inlineBom) });
  }
}

// ============================================
// Design Change → MO Sync
// ============================================

export interface DesignSyncResult {
  synced: boolean;
  moId: string;
  moNumber?: string;
  changes: string[];
  error?: string;
}

/**
 * Sync design item changes to its linked Manufacturing Order.
 * Only syncs if the MO is in draft or approved status (before production starts).
 * Rebuilds BOM, updates parts, quantity, and cost summary.
 */
async function syncDesignItemToMO(
  projectId: string,
  designItemId: string,
  userId: string,
): Promise<DesignSyncResult> {
  // 1. Fetch design item
  const itemRef = doc(
    db,
    DESIGN_PROJECTS_COLLECTION,
    projectId,
    DESIGN_ITEMS_SUBCOLLECTION,
    designItemId,
  );
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) {
    return { synced: false, moId: '', changes: [], error: 'Design item not found' };
  }
  const item = itemSnap.data();
  const moId = item.manufacturingOrderId as string | undefined;
  if (!moId) {
    return { synced: false, moId: '', changes: [], error: 'No linked Manufacturing Order' };
  }

  // 2. Fetch linked MO
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) {
    return { synced: false, moId, changes: [], error: 'Linked MO not found' };
  }
  const mo = moSnap.data();
  const moNumber = mo.moNumber as string;

  // 3. Only allow sync for pre-production MOs
  const status = mo.status as string;
  if (status !== 'draft' && status !== 'approved' && status !== 'pending-approval') {
    return {
      synced: false,
      moId,
      moNumber,
      changes: [],
      error: `MO is "${status}" — cannot sync changes after production has started. Create a new MO instead.`,
    };
  }

  const changes: string[] = [];

  // 4. Update MO core fields
  const manufacturing = item.manufacturing as Record<string, unknown> | undefined;
  const newQuantity = (item.requiredQuantity as number) ?? 1;
  const newName = (item.name as string) ?? '';

  const moUpdate: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  if (mo.quantity !== newQuantity) {
    moUpdate.quantity = newQuantity;
    changes.push(`Quantity: ${mo.quantity} → ${newQuantity}`);
  }
  if (mo.designItemName !== newName) {
    moUpdate.designItemName = newName;
    moUpdate.itemName = newName;
    changes.push(`Name: "${mo.designItemName}" → "${newName}"`);
  }

  // Update parts array
  const newParts = (item.parts as unknown[]) ?? [];
  moUpdate.parts = newParts;
  changes.push(`Parts list refreshed (${Array.isArray(newParts) ? newParts.length : 0} parts)`);

  // Update cost summary
  if (manufacturing) {
    const materialCost = (manufacturing.totalCost as number) ?? 0;
    moUpdate.costSummary = {
      materialCost,
      laborCost: 0, // Labor tracked at payroll level, not per MO
      totalCost: materialCost,
      currency: 'UGX',
    };
    moUpdate.estimatedMaterialCost = materialCost;
    moUpdate.estimatedTotalCost = materialCost;
    changes.push(`Cost updated: ${materialCost.toLocaleString()} UGX`);
  }

  await updateDoc(moRef, stripUndefined(moUpdate));

  // 5. Rebuild BOM — batch-delete existing BOM subcollection lines, then regenerate
  const existingBOM = await getDocs(
    query(collection(db, MO_COLLECTION, moId, BOM_SUBCOLLECTION)),
  );
  if (existingBOM.size > 0) {
    const deleteBatch = writeBatch(db);
    for (const bomDoc of existingBOM.docs) {
      deleteBatch.delete(bomDoc.ref);
    }
    await deleteBatch.commit();
  }
  changes.push(`BOM rebuilt (${existingBOM.size} old lines removed)`);

  // Regenerate BOM from current design item data (with resolved names from palette)
  await generateBOMFromDesignItem(moId, item, projectId);

  // Re-count new BOM lines
  const newBOM = await getDocs(
    query(collection(db, MO_COLLECTION, moId, BOM_SUBCOLLECTION)),
  );
  changes.push(`${newBOM.size} new BOM lines created`);

  return { synced: true, moId, moNumber, changes };
}

// ============================================
// Exports
// ============================================

export const designToManufacturingService = {
  releaseToProduction,
  detectRoutingTemplate,
  generateStepsFromTemplate,
  generateBOMFromDesignItem,
  syncDesignItemToMO,
};
