/**
 * Deliverable Auto-Generation Service
 *
 * Auto-generates Cut List, BOM, and Material Specification Sheet
 * as CSV deliverables when parts are fully defined.
 *
 * Non-blocking: failures never break primary operations.
 * Uses dynamic imports to avoid circular dependencies.
 */

import type {
  PartEntry,
  ManufacturingCost,
  DeliverableType,
  DesignStage,
} from '../types';
import type { InventoryNameResolver } from './materialHarvester';

// ============================================
// Change Detection
// ============================================

/**
 * Simple 32-bit hash for change detection.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Compute a hash from parts + manufacturing data for change detection.
 */
function computeDataHash(
  parts: PartEntry[],
  manufacturing?: ManufacturingCost
): string {
  const partsData = parts.map(p => ({
    pn: p.partNumber, n: p.name, t: p.partType,
    l: p.length, w: p.width, th: p.thickness, bp: p.barProfile,
    mn: p.materialName, mc: p.materialCode,
    q: p.quantity, gd: p.grainDirection, eb: p.edgeBanding,
    cnc: p.hasCNCOperations, notes: p.notes,
  }));

  const mfgData = manufacturing ? {
    sm: manufacturing.sheetMaterials?.length ?? 0,
    sp: manufacturing.standardParts?.length ?? 0,
    xp: manufacturing.specialParts?.length ?? 0,
    ps: manufacturing.processingSteps?.length ?? 0,
    tc: manufacturing.totalCost,
  } : null;

  return hashString(JSON.stringify({ p: partsData, m: mfgData }));
}

// ============================================
// CSV Generators
// ============================================

function esc(val: string | undefined | null): string {
  if (!val) return '';
  return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
}

/**
 * Generate Cut List CSV from parts.
 */
export function generateCutListCSV(
  parts: PartEntry[],
  itemName: string,
  itemCode: string,
  resolve?: InventoryNameResolver
): string {
  const r = resolve ?? ((n: string) => n);
  const rows: string[] = [];
  rows.push(`Cut List - ${itemName} [${itemCode}]`);
  rows.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  rows.push('');
  rows.push('Part#,Name,Type,Material,Thickness(mm),Length(mm),Width(mm),Profile,Qty,Grain,Edge-T,Edge-B,Edge-L,Edge-R,CNC,Notes');

  for (const p of parts) {
    const isLinear = p.partType === 'bar' || p.partType === 'timber';
    const isBar = isLinear; // linear handling (no width/thickness/edging cells)
    const typeLabel = p.partType === 'timber' ? 'Timber' : isBar ? 'Bar' : 'Sheet';
    rows.push([
      p.partNumber,
      esc(p.name),
      typeLabel,
      esc(r(p.materialName, isBar ? undefined : p.thickness)),
      isBar ? '' : p.thickness,
      p.length,
      isBar ? '' : p.width,
      isBar ? esc(p.barProfile) : '',
      p.quantity,
      isBar ? '' : p.grainDirection,
      isBar ? '' : (p.edgeBanding?.top ? 'Y' : 'N'),
      isBar ? '' : (p.edgeBanding?.bottom ? 'Y' : 'N'),
      isBar ? '' : (p.edgeBanding?.left ? 'Y' : 'N'),
      isBar ? '' : (p.edgeBanding?.right ? 'Y' : 'N'),
      p.hasCNCOperations ? 'Y' : 'N',
      esc(p.notes),
    ].join(','));
  }

  // Summary
  rows.push('');
  rows.push(`Total Parts:,${parts.reduce((s, p) => s + p.quantity, 0)}`);
  rows.push(`Unique Parts:,${parts.length}`);

  return rows.join('\n');
}

/**
 * Generate Bill of Materials CSV from parts + manufacturing data.
 */
export function generateBOMCSV(
  parts: PartEntry[],
  manufacturing: ManufacturingCost | undefined,
  itemName: string,
  itemCode: string,
  resolve?: InventoryNameResolver
): string {
  const r = resolve ?? ((n: string) => n);
  const rows: string[] = [];
  rows.push(`Bill of Materials - ${itemName} [${itemCode}]`);
  rows.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  rows.push('');

  // Sheet Materials
  if (manufacturing?.sheetMaterials?.length) {
    rows.push('=== SHEET MATERIALS ===');
    rows.push('Material,Thickness(mm),Parts Count,Total Area(m2),Est. Sheets,Unit Cost,Total Cost');
    for (const sm of manufacturing.sheetMaterials) {
      rows.push([
        esc(r(sm.materialName, sm.thickness)), sm.thickness, sm.partsCount,
        sm.totalArea.toFixed(3), sm.sheetsRequired,
        sm.unitCost, sm.totalCost,
      ].join(','));
    }
    rows.push('');
  }

  // Timber Materials
  if (manufacturing?.timberMaterials?.length) {
    rows.push('=== TIMBER MATERIALS ===');
    rows.push('Material,Section,Pricing,Total Volume(m3),Total Length(m),Unit Cost,Total Cost');
    for (const tm of manufacturing.timberMaterials) {
      rows.push([
        esc(r(tm.materialName)),
        `${tm.crossSection.thickness}x${tm.crossSection.width}mm`,
        tm.pricingMethod,
        tm.totalVolumeCubicMeters.toFixed(4),
        tm.totalLinearMeters.toFixed(2),
        tm.unitCost, tm.totalCost,
      ].join(','));
    }
    rows.push('');
  }

  // Linear Materials
  if (manufacturing?.linearMaterials?.length) {
    rows.push('=== LINEAR MATERIALS ===');
    rows.push('Material,Profile,Total Length(m),Unit Cost(/m),Total Cost');
    for (const lm of manufacturing.linearMaterials) {
      rows.push([
        esc(r(lm.materialName)), esc(lm.profile),
        lm.totalLinearMeters.toFixed(2),
        lm.unitCost, lm.totalCost,
      ].join(','));
    }
    rows.push('');
  }

  // Edge Banding
  if (manufacturing?.edgingMaterials?.length) {
    rows.push('=== EDGE BANDING ===');
    rows.push('Material,Profile,Total Length(m),Unit Cost(/m),Total Cost');
    for (const em of manufacturing.edgingMaterials) {
      rows.push([
        esc(r(em.materialName)), esc(em.profile),
        em.totalLinearMeters.toFixed(2),
        em.unitCost, em.totalCost,
      ].join(','));
    }
    rows.push('');
  }

  // Standard Parts (Hardware)
  if (manufacturing?.standardParts?.length) {
    rows.push('=== STANDARD PARTS (Hardware) ===');
    rows.push('Category,Name,SKU,Qty,Unit Cost,Total Cost,Notes');
    for (const sp of manufacturing.standardParts) {
      rows.push([
        sp.category, esc(sp.name), esc(sp.sku),
        sp.quantity, sp.unitCost, sp.totalCost, esc(sp.notes),
      ].join(','));
    }
    rows.push('');
  }

  // Special Parts
  if (manufacturing?.specialParts?.length) {
    rows.push('=== SPECIAL PARTS ===');
    rows.push('Name,Supplier,Part#,Category,Qty,Unit Cost,Total Cost,Notes');
    for (const xp of manufacturing.specialParts) {
      rows.push([
        esc(xp.name), esc(xp.supplier), esc(xp.partNumber),
        xp.category, xp.quantity, xp.unitCost ?? '',
        xp.unitCost ? xp.quantity * xp.unitCost : '',
        esc(xp.notes),
      ].join(','));
    }
    rows.push('');
  }

  // Processing Steps
  if (manufacturing?.processingSteps?.length) {
    rows.push('=== PROCESSING STEPS ===');
    rows.push('Step,Quantity,Unit,Rate/Unit,Total Cost');
    for (const ps of manufacturing.processingSteps) {
      rows.push([
        esc(ps.label), ps.quantity, ps.unit,
        ps.ratePerUnit, ps.totalCost,
      ].join(','));
    }
    rows.push('');
  }

  // Fallback: derive material summary from parts if no manufacturing data
  if (!manufacturing) {
    rows.push('=== MATERIALS (derived from parts) ===');
    rows.push('Material,Thickness(mm),Type,Parts Count,Total Qty,Total Area(m2)');
    const groups = new Map<string, { name: string; thickness: number; type: string; parts: number; qty: number; area: number }>();
    for (const p of parts) {
      const isLinear = p.partType === 'bar' || p.partType === 'timber';
      const typeLabel = p.partType === 'timber' ? 'Timber' : isLinear ? 'Bar' : 'Sheet';
      const key = `${p.materialName}-${isLinear ? p.partType : p.thickness}`;
      const g = groups.get(key) || { name: r(p.materialName, isLinear ? undefined : p.thickness), thickness: p.thickness, type: typeLabel, parts: 0, qty: 0, area: 0 };
      g.parts++;
      g.qty += p.quantity;
      if (!isLinear) g.area += (p.length * p.width * p.quantity) / 1_000_000;
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      const isLinear = g.type === 'Bar' || g.type === 'Timber';
      rows.push([esc(g.name), isLinear ? '' : g.thickness, g.type, g.parts, g.qty, g.area.toFixed(3)].join(','));
    }
    rows.push('');
  }

  // Summary
  rows.push('=== SUMMARY ===');
  if (manufacturing) {
    rows.push('Category,Total Cost');
    if (manufacturing.sheetMaterialsCost) rows.push(`Sheet Materials,${manufacturing.sheetMaterialsCost}`);
    if (manufacturing.timberMaterialsCost) rows.push(`Timber Materials,${manufacturing.timberMaterialsCost}`);
    if (manufacturing.linearMaterialsCost) rows.push(`Linear Materials,${manufacturing.linearMaterialsCost}`);
    if (manufacturing.edgingMaterialsCost) rows.push(`Edge Banding,${manufacturing.edgingMaterialsCost}`);
    if (manufacturing.standardPartsCost) rows.push(`Standard Parts,${manufacturing.standardPartsCost}`);
    if (manufacturing.specialPartsCost) rows.push(`Special Parts,${manufacturing.specialPartsCost}`);
    if (manufacturing.processingCost) rows.push(`Processing,${manufacturing.processingCost}`);
    if (manufacturing.laborCost) rows.push(`Labor (${manufacturing.laborHours}hrs @ ${manufacturing.laborRate}/hr),${manufacturing.laborCost}`);
    rows.push(`TOTAL,${manufacturing.totalCost}`);
  } else {
    rows.push(`Total Parts,${parts.reduce((s, p) => s + p.quantity, 0)}`);
  }

  return rows.join('\n');
}

/**
 * Generate Material Specification Sheet CSV from parts.
 */
export function generateMaterialSpecCSV(
  parts: PartEntry[],
  itemName: string,
  itemCode: string,
  resolve?: InventoryNameResolver
): string {
  const r = resolve ?? ((n: string) => n);
  const rows: string[] = [];
  rows.push(`Material Specification Sheet - ${itemName} [${itemCode}]`);
  rows.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  rows.push('');
  rows.push('Material,Code,Type,Thickness(mm),Grain Required,Parts Using,Total Qty,Total Area/Length,Notes');

  // Group by material
  const groups = new Map<string, {
    name: string; code: string; type: string; thickness: number;
    grainRequired: boolean; partsCount: number; totalQty: number;
    totalArea: number; totalLength: number; isBar: boolean;
  }>();

  for (const p of parts) {
    const isLinear = p.partType === 'bar' || p.partType === 'timber';
    const isBar = isLinear; // kept for downstream structural field handling
    const typeLabel = p.partType === 'timber' ? 'Timber' : isBar ? 'Bar' : 'Sheet';
    const key = `${p.materialName}-${isLinear ? `${p.partType}-${p.barProfile}` : p.thickness}`;
    const g = groups.get(key) || {
      name: r(p.materialName, isLinear ? undefined : p.thickness), code: p.materialCode || '', type: typeLabel,
      thickness: p.thickness, grainRequired: false, partsCount: 0, totalQty: 0,
      totalArea: 0, totalLength: 0, isBar,
    };
    g.partsCount++;
    g.totalQty += p.quantity;
    if (p.grainDirection && p.grainDirection !== 'none') g.grainRequired = true;
    if (isLinear) {
      g.totalLength += (p.length * p.quantity) / 1_000; // mm → m
    } else {
      g.totalArea += (p.length * p.width * p.quantity) / 1_000_000; // mm² → m²
    }
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    const measure = g.isBar
      ? `${g.totalLength.toFixed(2)}m (linear)`
      : `${g.totalArea.toFixed(3)} m2`;
    rows.push([
      esc(g.name), esc(g.code), g.type,
      g.isBar ? '' : g.thickness,
      g.grainRequired ? 'Yes' : 'No',
      g.partsCount, g.totalQty, measure, '',
    ].join(','));
  }

  // Edge banding summary (derived from parts) — exclude linear parts (bar, timber)
  const edgeParts = parts.filter(p => p.partType !== 'bar' && p.partType !== 'timber' && (
    p.edgeBanding?.top || p.edgeBanding?.bottom || p.edgeBanding?.left || p.edgeBanding?.right
  ));
  if (edgeParts.length > 0) {
    let totalEdgeLength = 0;
    for (const p of edgeParts) {
      const edgeL = ((p.edgeBanding?.top ? p.length : 0) + (p.edgeBanding?.bottom ? p.length : 0)) * p.quantity;
      const edgeW = ((p.edgeBanding?.left ? p.width : 0) + (p.edgeBanding?.right ? p.width : 0)) * p.quantity;
      totalEdgeLength += (edgeL + edgeW) / 1_000; // mm → m
    }
    rows.push([
      'Edge Banding (total)', '', 'Edge Banding', '',
      'No', edgeParts.length, '', `${totalEdgeLength.toFixed(2)}m (linear)`, '',
    ].join(','));
  }

  return rows.join('\n');
}

// ============================================
// Upload Helper
// ============================================

async function uploadCSVAsDeliverable(
  csvContent: string,
  fileName: string,
  deliverableType: DeliverableType,
  deliverableName: string,
  projectId: string,
  itemId: string,
  itemName: string,
  currentStage: DesignStage,
  userId: string
): Promise<string | null> {
  const { uploadAutoGenDeliverableFile } = await import('./storage');
  const { createDeliverable } = await import('./firestore');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const file = new File([blob], fileName, { type: 'text/csv' });

  // Use deterministic storage path — overwrites previous blob in place
  const { promise } = uploadAutoGenDeliverableFile(file, projectId, itemId, deliverableType);
  const result = await promise;

  const deliverableId = await createDeliverable(
    projectId,
    itemId,
    {
      name: deliverableName,
      type: deliverableType,
      description: 'Auto-generated from parts data',
      fileName: result.fileName,
      fileType: result.fileType,
      fileSize: result.fileSize,
      storageUrl: result.storageUrl,
      storagePath: result.storagePath,
      mimeType: result.mimeType,
      isAutoGenerated: true,
      autoGenSource: 'parts-data',
      itemName,
    },
    userId,
    currentStage
  );

  return deliverableId;
}

// ============================================
// Main Orchestrator
// ============================================

/**
 * Auto-generate Cut List, BOM, and Material Spec deliverables
 * from a design item's parts data.
 *
 * Skips if data hasn't changed since last generation (hash check).
 * Non-blocking — failures are logged and swallowed.
 */
export async function autoGenerateDeliverables(
  projectId: string,
  itemId: string,
  parts: PartEntry[],
  userId: string
): Promise<void> {
  if (parts.length === 0) return;

  // Fetch item to get manufacturing data, name, code, stage, hash
  const { getDesignItem } = await import('./firestore');
  let item;
  try {
    item = await getDesignItem(projectId, itemId);
  } catch {
    return;
  }
  if (!item) return;

  const manufacturing = (item as any).manufacturing as ManufacturingCost | undefined;
  const lastHash = (item as any).lastAutoGenHash as string | undefined;

  // Change detection
  const newHash = computeDataHash(parts, manufacturing);
  if (lastHash === newHash) return;

  const itemName = item.name;
  const itemCode = item.itemCode;
  const stage = item.currentStage;

  // Build inventory name resolver from project's material palette
  let resolveName: InventoryNameResolver | undefined;
  try {
    const { getProjectWithOptimization } = await import('@/shared/services/projectService');
    const project = await getProjectWithOptimization(projectId);
    const { buildInventoryNameResolver } = await import('./materialHarvester');
    resolveName = buildInventoryNameResolver(project?.materialPalette ?? null);
  } catch { /* non-critical — fall back to design names */ }

  // Generate each document independently
  const generators: Array<{
    type: DeliverableType;
    name: string;
    fileName: string;
    generate: () => string;
  }> = [
    {
      type: 'cut-list',
      name: `Cut List - ${itemName}`,
      fileName: `CutList-${itemCode}.csv`,
      generate: () => generateCutListCSV(parts, itemName, itemCode, resolveName),
    },
    {
      type: 'bom',
      name: `Bill of Materials - ${itemName}`,
      fileName: `BOM-${itemCode}.csv`,
      generate: () => generateBOMCSV(parts, manufacturing, itemName, itemCode, resolveName),
    },
    {
      type: 'specification-sheet',
      name: `Material Specification - ${itemName}`,
      fileName: `MaterialSpec-${itemCode}.csv`,
      generate: () => generateMaterialSpecCSV(parts, itemName, itemCode, resolveName),
    },
  ];

  for (const gen of generators) {
    try {
      const csv = gen.generate();
      await uploadCSVAsDeliverable(
        csv, gen.fileName, gen.type, gen.name,
        projectId, itemId, itemName, stage, userId
      );
    } catch (err) {
      console.warn(`[AutoGenDeliverables] Failed to generate ${gen.type}:`, err);
    }
  }

  // Save hash to prevent regeneration on next call
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('@/shared/services/firebase');
    const itemRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
    await updateDoc(itemRef, { lastAutoGenHash: newHash });
  } catch (err) {
    console.warn('[AutoGenDeliverables] Failed to save hash:', err);
  }
}

// ============================================
// PDF Upload Helper
// ============================================

/**
 * Upload a PDF blob as a deliverable.
 * Returns the deliverable ID on success, null on failure.
 */
async function uploadPDFAsDeliverable(
  blob: Blob,
  fileName: string,
  deliverableType: DeliverableType,
  deliverableName: string,
  projectId: string,
  itemId: string,
  itemName: string,
  currentStage: DesignStage,
  userId: string
): Promise<string | null> {
  const { uploadAutoGenDeliverableFile } = await import('./storage');
  const { createDeliverable } = await import('./firestore');

  const file = new File([blob], fileName, { type: 'application/pdf' });
  // Use deterministic storage path — overwrites previous blob in place
  const { promise } = uploadAutoGenDeliverableFile(
    file, projectId, itemId, deliverableType
  );
  const result = await promise;

  const deliverableId = await createDeliverable(
    projectId,
    itemId,
    {
      name: deliverableName,
      type: deliverableType,
      description: 'Auto-generated Shop Traveler from production optimization',
      fileName: result.fileName,
      fileType: result.fileType,
      fileSize: result.fileSize,
      storageUrl: result.storageUrl,
      storagePath: result.storagePath,
      mimeType: result.mimeType,
      isAutoGenerated: true,
      autoGenSource: 'production-optimization',
      itemName,
    },
    userId,
    currentStage
  );

  return deliverableId;
}

// ============================================
// Shop Traveler Auto-Generation
// ============================================

/**
 * Auto-generate Shop Traveler PDF and save as a deliverable
 * for each contributing design item after production optimization.
 *
 * Non-blocking — failures are logged and swallowed.
 */
export async function autoGenerateShopTravelerDeliverable(
  projectId: string,
  contributingItemIds: string[],
  userId: string
): Promise<void> {
  if (contributingItemIds.length === 0) return;

  const { generateShopTravelerPDF } = await import(
    '@/shared/services/pdf/shopTravelerService.tsx'
  );
  const { getDesignItem, getProject } = await import('./firestore');

  // Generate the PDF once (it's a project-level document)
  let blob: Blob;
  try {
    blob = await generateShopTravelerPDF(projectId);
  } catch (err) {
    console.warn('[AutoGenShopTraveler] PDF generation failed:', err);
    return;
  }

  // Get project code for filename
  let projectCode = projectId.substring(0, 8);
  try {
    const project = await getProject(projectId);
    if (project?.code) projectCode = project.code;
  } catch {
    // Fall back to truncated ID
  }

  const date = new Date().toISOString().split('T')[0];
  const fileName = `ShopTraveler-${projectCode}-${date}.pdf`;

  // Upload as deliverable for each contributing design item
  for (const itemId of contributingItemIds) {
    try {
      const item = await getDesignItem(projectId, itemId);
      if (!item) continue;

      await uploadPDFAsDeliverable(
        blob,
        fileName,
        'shop-drawing',
        `Shop Traveler - ${item.name}`,
        projectId,
        itemId,
        item.name,
        item.currentStage,
        userId
      );
    } catch (err) {
      console.warn(`[AutoGenShopTraveler] Failed for item ${itemId}:`, err);
    }
  }
}

/**
 * Run a per-item nesting in-memory and upload the resulting Shop Traveler PDF
 * as a deliverable on that single design item. Does NOT touch the
 * project-wide `optimizationState.production`.
 *
 * Throws on failure so the caller can surface errors to the user.
 */
export async function autoGenerateItemShopTraveler(
  projectId: string,
  itemId: string,
  userId: string
): Promise<void> {
  const { runItemProduction } = await import(
    '@/shared/services/optimization'
  );
  const { generateShopTravelerPDF } = await import(
    '@/shared/services/pdf/shopTravelerService.tsx'
  );
  const { getDesignItem, getProject } = await import('./firestore');

  // 1. Run nesting optimization for only this item's parts (ephemeral).
  const production = await runItemProduction(projectId, itemId, userId);

  // 2. Generate the Shop Traveler PDF scoped to this item.
  const blob = await generateShopTravelerPDF(
    projectId,
    undefined,
    { itemId, production }
  );

  // 3. Resolve filename bits.
  let projectCode = projectId.substring(0, 8);
  try {
    const project = await getProject(projectId);
    if (project?.code) projectCode = project.code;
  } catch {
    // Fall back to truncated ID
  }

  const item = await getDesignItem(projectId, itemId);
  if (!item) {
    throw new Error(`Design item ${itemId} not found`);
  }

  const date = new Date().toISOString().split('T')[0];
  const itemSlug = (item.itemCode || item.name || itemId).replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `ShopTraveler-${projectCode}-${itemSlug}-${date}.pdf`;

  // 4. Upload as a deliverable on this design item only.
  await uploadPDFAsDeliverable(
    blob,
    fileName,
    'shop-drawing',
    `Shop Traveler - ${item.name}`,
    projectId,
    itemId,
    item.name,
    item.currentStage,
    userId
  );
}
