/**
 * Project-Level Optimization Actions
 * Runs optimization on project data and saves results to optimizationState
 */

import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  serverTimestamp,
  deleteField,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Project,
  EstimationResult,
  ProductionResult,
  SheetSummary,
  NestingSheet,
  CutOperation,
  OptimizationConfig,
  PartPlacement,
  WasteRegion,
  MaterialType,
  TimberSummary,
  LinearStockSummary,
  LinearCuttingResult,
  MaterialProcessingSummary,
  WorkshopProcessingRates,
  EdgeOperationSpec,
  FabricRollDefinition,
  FabricBay,
  FabricSummary,
} from '@/shared/types';
import type { UsedOffcut, GeneratedOffcut } from '@/shared/types/offcut';
import type { PartEntry } from '@/modules/design-manager/types';
import { optimizationService, type Panel, type OptimizationResult } from './OptimizationService';
import { TimberOptimizationService, type AvailableOffcut } from './TimberOptimizationService';
import { LinearStockOptimizationService } from './LinearStockOptimizationService';
import { GlassOptimizationService } from './GlassOptimizationService';
import { FabricOptimizationService, type FabricPart } from './FabricOptimizationService';
import { isCuttablePart } from './cuttableParts';
import { formatOptimizationPanelLabel } from '@/shared/utils/cutPatternPartLabel';
import {
  getEffectiveRates,
  calculateTimberProcessingCosts,
  calculatePanelProcessingCosts,
  calculateGlassProcessingCosts,
  calculateLinearProcessingCosts,
  buildProcessingSummary,
  type TimberPartForProcessing,
  type PanelPartForProcessing,
  type GlassPartForProcessing,
  type LinearPartForProcessing,
} from './ProcessingCostService';
import { DEFAULT_WORKSHOP_PROCESSING_RATES } from '../../types/processingSteps';
import type { PricingAssumptions } from '../../types/pricingAssumptions';
import { DEFAULT_PRICING_ASSUMPTIONS, resolvePricingAssumptions, getDefaultCostByThickness } from '../../types/pricingAssumptions';
import {
  queryMatchingOffcuts,
  registerOffcutsFromProduction,
  buildTimberOffcuts,
  buildPanelOffcuts,
  releaseReservedOffcuts,
} from '../offcutLibraryService';
import { getMaterialValuationPriceByName } from '@/modules/inventory/services/inventoryPriceService';
import { fetchFabricRollFromInventory } from '@/modules/inventory/services/fabricInventorySync';
import { updateOptimizationRAG } from '../ragService';

// Collection names
const PROJECTS_COLLECTION = 'designProjects';
const DESIGN_ITEMS_SUBCOLLECTION = 'designItems';

// ============================================
// Workshop Rate Helpers
// ============================================

/**
 * Fetch workshop processing rates from organization settings.
 * Falls back to defaults if no settings are configured.
 */
async function fetchWorkshopRates(): Promise<WorkshopProcessingRates> {
  try {
    const settingsRef = doc(db, 'organizationSettings', 'default');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data.workshopProcessingRates) {
        return data.workshopProcessingRates as WorkshopProcessingRates;
      }
    }
  } catch (err) {
    console.warn('[Optimization] Failed to fetch workshop rates, using defaults:', err);
  }
  return DEFAULT_WORKSHOP_PROCESSING_RATES;
}

/**
 * Fetch pricing assumptions from organization settings.
 * Falls back to defaults if no settings are configured.
 */
async function fetchPricingAssumptions(): Promise<PricingAssumptions> {
  try {
    const settingsRef = doc(db, 'organizationSettings', 'default');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data.pricingAssumptions) {
        return resolvePricingAssumptions(data.pricingAssumptions);
      }
    }
  } catch (err) {
    console.warn('[Optimization] Failed to fetch pricing assumptions, using defaults:', err);
  }
  return DEFAULT_PRICING_ASSUMPTIONS;
}

/**
 * Query available timber offcuts for a specific material and cross-section.
 */
async function queryTimberOffcuts(
  materialName: string,
  crossSection: { thickness: number; width: number },
  minLength: number
): Promise<AvailableOffcut[]> {
  try {
    const offcuts = await queryMatchingOffcuts({
      materialType: 'TIMBER',
      materialName,
      minLength,
      crossSection,
    });

    return offcuts.map(o => ({
      offcutId: o.id,
      length: o.length,
      crossSection: o.crossSection || { thickness: o.thickness, width: o.width },
      materialName: o.materialName,
      costSaved: o.originalCostAllocation,
    }));
  } catch (err) {
    console.warn('[Optimization] Failed to query timber offcuts:', err);
    return [];
  }
}

/**
 * Surface available panel offcuts for a material so estimation can warn the
 * user when there are reusable remnants in the library.
 *
 * Note: this does NOT yet feed offcuts into the 2D panel nester (which would
 * require an OptimizationService API change to accept available offcuts as
 * candidate sheets). For now we count them and report potential savings as
 * an audit warning. Closing the full asymmetry with timber is tracked
 * separately.
 */
async function countAvailablePanelOffcuts(
  materialName: string,
  thickness: number,
  minLength: number,
  minWidth: number
): Promise<{ count: number; potentialSavings: number }> {
  try {
    const offcuts = await queryMatchingOffcuts({
      materialType: 'PANEL',
      materialName,
      minLength,
      minWidth,
      minThickness: thickness,
    });
    const potentialSavings = offcuts.reduce(
      (sum, o) => sum + (o.originalCostAllocation ?? 0),
      0,
    );
    return { count: offcuts.length, potentialSavings };
  } catch (err) {
    console.warn('[Optimization] Failed to query panel offcuts:', err);
    return { count: 0, potentialSavings: 0 };
  }
}

// ============================================
// Types
// ============================================

export interface CutlistPart {
  id: string;
  partNumber: string;
  name: string;
  designItemId: string;
  designItemName: string;
  /** Item code (e.g. DF-2026-584) — short label for nesting / cut diagrams. */
  designItemCode?: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  materialId: string;
  materialName: string;
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
    front?: boolean;
    material?: string;
    thickness?: number;
    edges?: {
      top?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      bottom?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      left?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      right?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      front?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
    };
  };
}

export interface MaterialBreakdown {
  materialId: string;
  materialName: string;
  thickness: number;
  totalParts: number;
  totalArea: number;
  sheetsRequired: number;
  estimatedCost: number;
}

export interface Remnant {
  id: string;
  sheetId: string;
  x: number;
  y: number;
  length: number;
  width: number;
  area: number;
  reusable: boolean;
}

export interface EdgeBandItem {
  partId: string;
  partName: string;
  edge: 'top' | 'bottom' | 'left' | 'right';
  length: number;
  material: string;
}

// ============================================
// Part Aggregation
// ============================================

/**
 * Aggregate all parts from design items in a project
 * Multiplies part quantities by the design item's requiredQuantity
 * When `itemIds` is provided, only parts from those design items are included.
 */
export async function aggregatePartsFromProject(
  projectId: string,
  itemIds?: string[]
): Promise<CutlistPart[]> {
  const parts: CutlistPart[] = [];
  const itemIdFilter = itemIds && itemIds.length > 0 ? new Set(itemIds) : null;

  // Get all design items for this project (subcollection under project)
  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);
  const itemsSnapshot = await getDocs(itemsRef);

  for (const itemDoc of itemsSnapshot.docs) {
    if (itemIdFilter && !itemIdFilter.has(itemDoc.id)) continue;
    const itemData = itemDoc.data();
    const designItemId = itemDoc.id;
    const designItemName = itemData.name || itemData.itemCode || 'Unknown';
    const designItemCode = typeof itemData.itemCode === 'string' ? itemData.itemCode : undefined;

    // Get the design item's required quantity (how many of this item are needed)
    const requiredQuantity = itemData.requiredQuantity || 1;

    // Get parts from the design item
    const itemParts: PartEntry[] = itemData.parts || [];

    for (const part of itemParts) {
      // Skip scene-origin component parts (hardware mesh nodes). Their
      // `materialName` is the mesh-node name, which would otherwise feed
      // phantom panels into the nesting/estimation engine. Hardware is
      // procured by SKU via the hardware schedule, not cut from panel stock.
      if (!isCuttablePart(part as { partType?: string; source?: string })) {
        continue;
      }

      // Multiply part quantity by design item's required quantity
      const totalQuantity = part.quantity * requiredQuantity;

      parts.push({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        designItemId,
        designItemName,
        designItemCode,
        length: part.length,
        width: part.width,
        thickness: part.thickness,
        quantity: totalQuantity,  // Total = part qty × design item qty
        materialId: part.materialId || '',
        materialName: part.materialName,
        grainDirection: part.grainDirection,
        edgeBanding: part.edgeBanding,
      });
    }
  }
  
  return parts;
}

/**
 * Aggregate standard parts (hinges, screws, edging) from all design items
 * Multiplies quantities by design item's requiredQuantity
 * When `itemIds` is provided, only parts from those design items are included.
 */
export async function aggregateStandardPartsFromProject(
  projectId: string,
  itemIds?: string[]
): Promise<Array<{
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  designItemId: string;
  designItemName: string;
}>> {
  const parts: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitCost: number;
    designItemId: string;
    designItemName: string;
  }> = [];
  const itemIdFilter = itemIds && itemIds.length > 0 ? new Set(itemIds) : null;

  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);
  const itemsSnapshot = await getDocs(itemsRef);

  for (const itemDoc of itemsSnapshot.docs) {
    if (itemIdFilter && !itemIdFilter.has(itemDoc.id)) continue;
    const itemData = itemDoc.data();
    const designItemId = itemDoc.id;
    const designItemName = itemData.name || itemData.itemCode || 'Unknown';
    const requiredQuantity = itemData.requiredQuantity || 1;
    
    const manufacturing = itemData.manufacturing || {};
    const standardParts = manufacturing.standardParts || [];
    
    for (const part of standardParts) {
      parts.push({
        id: part.id,
        name: part.name,
        category: part.category || 'other',
        quantity: (part.quantity || 1) * requiredQuantity,
        unitCost: part.unitCost || 0,
        designItemId,
        designItemName,
      });
    }
  }
  
  return parts;
}

/**
 * Aggregate special parts (luxury/approved items) from all design items
 * Multiplies quantities by design item's requiredQuantity
 * When `itemIds` is provided, only parts from those design items are included.
 */
export async function aggregateSpecialPartsFromProject(
  projectId: string,
  itemIds?: string[]
): Promise<Array<{
  id: string;
  name: string;
  category: string;
  quantity: number;
  supplier: string;
  costing?: {
    currency: string;
    unitCost: number;
    totalLandedCost: number;
  };
  designItemId: string;
  designItemName: string;
}>> {
  const parts: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    supplier: string;
    costing?: {
      currency: string;
      unitCost: number;
      totalLandedCost: number;
    };
    designItemId: string;
    designItemName: string;
  }> = [];
  const itemIdFilter = itemIds && itemIds.length > 0 ? new Set(itemIds) : null;

  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);
  const itemsSnapshot = await getDocs(itemsRef);

  for (const itemDoc of itemsSnapshot.docs) {
    if (itemIdFilter && !itemIdFilter.has(itemDoc.id)) continue;
    const itemData = itemDoc.data();
    const designItemId = itemDoc.id;
    const designItemName = itemData.name || itemData.itemCode || 'Unknown';
    const requiredQuantity = itemData.requiredQuantity || 1;
    
    const manufacturing = itemData.manufacturing || {};
    const specialParts = manufacturing.specialParts || [];
    
    for (const part of specialParts) {
      parts.push({
        id: part.id,
        name: part.name,
        category: part.category || 'other',
        quantity: (part.quantity || 1) * requiredQuantity,
        supplier: part.supplier || '',
        costing: part.costing,
        designItemId,
        designItemName,
      });
    }
  }
  
  return parts;
}

/**
 * Build a mapping from design material names to inventory material names
 * Multiple design materials may map to the same inventory material
 * This consolidation prevents over-buying sheets
 */
function buildDesignToInventoryMaterialMap(
  project: Project
): Map<string, { inventoryName: string; inventoryId?: string }> {
  const mapping = new Map<string, { inventoryName: string; inventoryId?: string }>();
  const materialPalette = project.materialPalette?.entries || [];
  
  for (const entry of materialPalette) {
    if (entry.inventoryName) {
      mapping.set(entry.designName, {
        inventoryName: entry.inventoryName,
        inventoryId: entry.inventoryId,
      });
      // Also map by normalized name for fuzzy matching
      if (entry.normalizedName && entry.normalizedName !== entry.designName) {
        mapping.set(entry.normalizedName, {
          inventoryName: entry.inventoryName,
          inventoryId: entry.inventoryId,
        });
      }
    }
  }
  
  return mapping;
}

/**
 * Determine material type for a part based on material palette
 */
/**
 * Heuristic-only material-type inference for parts that have no palette
 * entry. Used as a fallback so timber parts with un-configured material
 * palettes don't silently get routed into the 2D sheet nester.
 */
function inferMaterialTypeFromHeuristics(part: CutlistPart): MaterialType | null {
  const name = (part.materialName || '').toLowerCase();

  // Explicit panel markers — these win over any other inference, since
  // sheet products (MDF, plywood, etc.) often live as long thin strips
  // that would otherwise look "timber-like" geometrically.
  if (/\b(mdf|plywood|particle\s?board|chipboard|melamine|block\s?board|veneer|hpl|hdf|osb)\b/i.test(name)
      || /\b(brd|sht)-/i.test(name)) {
    return 'PANEL';
  }
  // Explicit timber markers — wood-class names + species commonly used at DawinOS.
  if (/\b(timber|hardwood|softwood|lumber|hardboard|solid\s*wood)\b/i.test(name)
      || /\b(mahogany|pine|mvule|muvule|mukwa|oak|teak|cedar|maple|walnut|cypress|eucalyptus|munyenye|nkalati)\b/i.test(name)
      || /\btim-/i.test(name)) {
    return 'TIMBER';
  }
  if (/\b(edge\s*band|edgeband|banding|edge\s*tape|abs\s+tape)\b/i.test(name)) {
    return 'EDGE';
  }
  if (/\b(glass|tempered|float\s*glass|laminated\s*glass)\b/i.test(name)) {
    return 'GLASS';
  }
  if (/\b(fabric|leather|vinyl|cloth|upholstery|foam|webbing|batting)\b/i.test(name)) {
    return 'FABRIC';
  }
  if (/\b(stone|granite|quartz|marble)\b/i.test(name)) {
    return 'STONE';
  }
  if (/\b(aluminium|aluminum)\b/i.test(name)) {
    return 'ALUMINIUM';
  }
  if (/\b(steel\s*bar|metal\s*bar|rebar|tube\s*steel)\b/i.test(name)) {
    return 'METAL_BAR';
  }

  // Geometric heuristic — a "stick-shaped" part (thick + narrow + long) is
  // almost certainly timber, not a sheet good. We require ALL of:
  //   - thickness >= 25mm                 (panels are usually 18 / 22mm)
  //   - width <= 150mm                    (sticks are narrow vs panels)
  //   - length / width >= 4               (long-narrow aspect)
  // Conservative on purpose: easier to leave a misclassified part as
  // PANEL than to wrongly treat a long thin panel as TIMBER.
  if (
    part.thickness >= 25 &&
    part.width > 0 &&
    part.width <= 150 &&
    part.length / part.width >= 4
  ) {
    return 'TIMBER';
  }

  return null;
}

interface MaterialTypeContext {
  /** Mutable bag — callers push (materialName, type, source) tuples so we can
   *  emit one warning per material at the end of the optimization run. */
  inferenceLog?: Map<string, { type: MaterialType; source: 'palette' | 'inferred' | 'default' }>;
}

function getMaterialType(
  part: CutlistPart,
  project: Project,
  ctx?: MaterialTypeContext,
): MaterialType {
  const materialPalette = project.materialPalette?.entries || [];

  // 1. Direct palette match — authoritative.
  const paletteEntry = materialPalette.find(
    entry => entry.designName === part.materialName || entry.normalizedName === part.materialName
  );
  if (paletteEntry) {
    if (ctx?.inferenceLog && !ctx.inferenceLog.has(part.materialName)) {
      ctx.inferenceLog.set(part.materialName, { type: paletteEntry.materialType, source: 'palette' });
    }
    return paletteEntry.materialType;
  }

  // 2. Heuristic — name + geometry. Catches the common case where a project
  // hasn't had its material palette populated yet, so a timber part with
  // an obvious species name in it doesn't land on the panel nester.
  const inferred = inferMaterialTypeFromHeuristics(part);
  if (inferred) {
    if (ctx?.inferenceLog && !ctx.inferenceLog.has(part.materialName)) {
      ctx.inferenceLog.set(part.materialName, { type: inferred, source: 'inferred' });
    }
    return inferred;
  }

  // 3. Final fallback. Legacy default — PANEL. Logged so the user can fix
  // the palette to make classification explicit.
  if (ctx?.inferenceLog && !ctx.inferenceLog.has(part.materialName)) {
    ctx.inferenceLog.set(part.materialName, { type: 'PANEL', source: 'default' });
  }
  return 'PANEL';
}

/**
 * Group parts by material type
 */
function groupPartsByMaterialType(
  parts: CutlistPart[],
  project: Project,
  ctx?: MaterialTypeContext,
): Record<MaterialType, CutlistPart[]> {
  const groups: Record<MaterialType, CutlistPart[]> = {
    PANEL: [],
    SOLID: [],
    VENEER: [],
    EDGE: [],
    TIMBER: [],
    GLASS: [],
    METAL_BAR: [],
    ALUMINIUM: [],
    STONE: [],
    FABRIC: [],
    COMPONENT: [],
  };

  for (const part of parts) {
    const materialType = getMaterialType(part, project, ctx);
    groups[materialType].push(part);
  }

  return groups;
}

/**
 * Extract timber stock definitions from material palette
 */
function extractTimberStock(project: Project) {
  const materialPalette = project.materialPalette?.entries || [];
  const timberStock = materialPalette
    .filter(entry => entry.materialType === 'TIMBER' && entry.timberStock)
    .flatMap(entry => entry.timberStock || []);

  return timberStock;
}

/**
 * Extract linear stock definitions from material palette
 */
function extractLinearStock(project: Project) {
  const materialPalette = project.materialPalette?.entries || [];
  const linearStock = materialPalette
    .filter(entry => (entry.materialType === 'METAL_BAR' || entry.materialType === 'ALUMINIUM') && entry.linearStock)
    .flatMap(entry => entry.linearStock || []);

  return linearStock;
}

/**
 * Extract glass stock definitions from material palette
 */
function extractGlassStock(project: Project) {
  const materialPalette = project.materialPalette?.entries || [];
  const glassStock = materialPalette
    .filter(entry => entry.materialType === 'GLASS' && entry.glassStock)
    .flatMap(entry => entry.glassStock || []);

  return glassStock;
}

/**
 * Resolve a fabric roll definition for the given material name.
 *
 * Priority:
 *   1. Palette entry's `fabricStock[0]` (per-project configured roll).
 *   2. Prefetched inventory `fabricSpec` for the palette entry's inventoryId.
 *   3. Sensible default (1400mm wide × 3000mm bay × 50,000 UGX/m).
 *
 * The default keeps the optimizer running when neither source has data —
 * the warning makes it visible so users know they're getting placeholder
 * pricing.
 */
function resolveFabricRoll(
  project: Project,
  materialName: string,
  warnings?: string[],
  inventoryRollsByMaterialName?: Map<string, FabricRollDefinition>,
): FabricRollDefinition {
  const materialPalette = project.materialPalette?.entries || [];
  const entry = materialPalette.find(
    e => e.designName === materialName || e.normalizedName === materialName ||
         e.inventoryName === materialName,
  );
  const configured = entry?.fabricStock?.[0];
  if (configured) {
    return {
      ...configured,
      // Defensive normalization — palette persistence may have
      // optional ids missing on legacy entries.
      id: configured.id || `roll-${entry?.id ?? materialName}`,
      materialId: configured.materialId || entry?.inventoryId || materialName,
      materialName: configured.materialName || materialName,
    };
  }

  const fromInventory = inventoryRollsByMaterialName?.get(materialName);
  if (fromInventory) {
    return {
      ...fromInventory,
      materialName,
    };
  }

  warnings?.push(
    `Fabric "${materialName}" has no roll configured on its palette entry or in inventory — ` +
    `using placeholder defaults (1400mm wide × 3000mm bay @ 50,000 UGX/m). ` +
    `Set a roll specification on the inventory item or configure one in Stock Configuration before quoting.`,
  );
  return {
    id: `roll-default-${materialName}`,
    materialId: entry?.inventoryId || materialName,
    materialName,
    rollWidth: 1400,
    defaultBayLength: 3000,
    costPerLinearMeter: 50_000,
    allowRotation: false,
  };
}

/**
 * Prefetch FabricRollDefinitions from inventory for every fabric material
 * referenced by the given material map. Returns a map keyed by the same
 * material name the caller already uses (post-mapping inventoryName when
 * available, original material name otherwise) so resolveFabricRoll can do
 * a synchronous lookup inside the per-material loop.
 *
 * Only inventoryIds present in the palette are queried. Items without a
 * `fabricSpec` are silently skipped — they fall through to the placeholder
 * default with a warning.
 */
async function prefetchFabricRollsFromInventory(
  project: Project,
  fabricMaterialNames: Set<string>,
  warnings: string[],
): Promise<Map<string, FabricRollDefinition>> {
  const out = new Map<string, FabricRollDefinition>();
  const palette = project.materialPalette?.entries || [];

  const targets: Array<{ matName: string; inventoryId: string }> = [];
  for (const matName of fabricMaterialNames) {
    const entry = palette.find(
      e => e.designName === matName || e.normalizedName === matName ||
           e.inventoryName === matName,
    );
    if (!entry?.inventoryId) continue;
    if (entry.fabricStock && entry.fabricStock.length > 0) continue; // palette wins
    targets.push({ matName, inventoryId: entry.inventoryId });
  }

  if (targets.length === 0) return out;

  const results = await Promise.all(
    targets.map(t =>
      fetchFabricRollFromInventory(t.inventoryId)
        .then(res => ({ matName: t.matName, ...res }))
        .catch((err: unknown) => ({
          matName: t.matName,
          roll: null as FabricRollDefinition | null,
          warnings: [`Failed to read fabric inventory for ${t.matName}: ${err instanceof Error ? err.message : String(err)}`],
        })),
    ),
  );

  for (const r of results) {
    if (r.roll) out.set(r.matName, r.roll);
    for (const w of r.warnings) warnings.push(w);
  }

  return out;
}

/**
 * Extract panel stock definitions from material palette
 * Returns stock sheets keyed by inventory material name
 */
function extractPanelStock(project: Project): Record<string, { material: string; length: number; width: number; thickness: number; cost: number }> {
  const materialPalette = project.materialPalette?.entries || [];
  const stockSheets: Record<string, { material: string; length: number; width: number; thickness: number; cost: number }> = {};

  for (const entry of materialPalette) {
    // Only process panel-type materials with stockSheets configured
    if (['PANEL', 'SOLID', 'VENEER'].includes(entry.materialType) && entry.stockSheets && entry.stockSheets.length > 0) {
      const materialKey = entry.inventoryName || entry.designName;

      // Use the first (or largest) stock sheet for this material
      // In future, we could support multiple stock sizes per material
      const sheet = entry.stockSheets[0];

      stockSheets[materialKey] = {
        material: materialKey,
        length: sheet.length,
        width: sheet.width,
        thickness: sheet.thickness,
        cost: sheet.costPerSheet || entry.unitCost || 0,
      };
    }
  }

  return stockSheets;
}

/**
 * Convert CutlistParts to optimization Panel format
 * Uses inventory material name for grouping when available (via materialMap)
 * This ensures parts with different design materials but same inventory material
 * are nested together on the same sheets
 */
function partsToOptimizationPanels(
  parts: CutlistPart[],
  materialMap?: Map<string, { inventoryName: string; inventoryId?: string }>
): Panel[] {
  return parts.map(part => {
    // Use inventory material if mapped, otherwise use design material
    const mappedMaterial = materialMap?.get(part.materialName);
    const nestingMaterial = mappedMaterial?.inventoryName || part.materialName;

    return {
      id: part.id,
      label: formatOptimizationPanelLabel(part),
      cabinet: part.designItemName,
      material: nestingMaterial, // Use inventory material for nesting grouping
      thickness: part.thickness,
      length: part.length,
      width: part.width,
      quantity: part.quantity,
      grain: part.grainDirection === 'none' ? 0 : 1,
    };
  });
}

/**
 * Fetch dynamic material costs from material palette mappings
 * Uses the MAPPED inventory material's cost, not the design material name
 * Returns a map of design material name -> cost per sheet
 */
async function fetchMaterialCosts(
  parts: CutlistPart[],
  project: Project,
  assumptions: PricingAssumptions = DEFAULT_PRICING_ASSUMPTIONS
): Promise<Record<string, number>> {
  const costs: Record<string, number> = {};
  const uniqueMaterials = new Map<string, number>(); // material -> thickness
  
  // Get unique materials from parts
  for (const part of parts) {
    if (part.materialName && !uniqueMaterials.has(part.materialName)) {
      uniqueMaterials.set(part.materialName, part.thickness);
    }
  }
  
  // Get material palette from project
  const materialPalette = project.materialPalette?.entries || [];
  
  for (const [designMaterialName, thickness] of uniqueMaterials) {
    const normalizedName = designMaterialName.toLowerCase().trim();
    
    // 1. First priority: Look up in material palette (mapped materials)
    // Use flexible matching: case-insensitive and check both designName and normalizedName
    const paletteEntry = materialPalette.find(entry => {
      const entryDesignName = entry.designName?.toLowerCase().trim() || '';
      const entryNormalizedName = entry.normalizedName?.toLowerCase().trim() || '';
      const searchName = normalizedName;

      // Direct match
      if (entryDesignName === searchName || entryNormalizedName === searchName) {
        return true;
      }

      // Fuzzy match: Check if search name starts with entry name (handles suffixes like " 1", " 2")
      if (searchName.startsWith(entryDesignName + ' ') || searchName.startsWith(entryNormalizedName + ' ')) {
        return true;
      }

      return false;
    });

    if (paletteEntry?.unitCost && paletteEntry.unitCost > 0) {
      // Use the mapped material's cost from palette
      costs[designMaterialName] = paletteEntry.unitCost;
      console.log(`[Estimation] Using palette price for "${designMaterialName}": ${paletteEntry.unitCost} UGX`);
      continue;
    }
    
    // 2. Second priority: Try inventory lookup by mapped inventory name
    if (paletteEntry?.inventoryName) {
      try {
        const priceResult = await getMaterialValuationPriceByName(
          paletteEntry.inventoryName, 
          thickness, 
          project.id
        );
        if (priceResult.found && priceResult.price?.costPerUnit) {
          costs[designMaterialName] = priceResult.price.costPerUnit;
          continue;
        }
      } catch {
        // Continue to fallback
      }
    }
    
    // 3. Third priority: Try inventory lookup by design name (legacy)
    try {
      const priceResult = await getMaterialValuationPriceByName(designMaterialName, thickness, project.id);
      if (priceResult.found && priceResult.price?.costPerUnit) {
        costs[designMaterialName] = priceResult.price.costPerUnit;
        continue;
      }
    } catch {
      // Continue to fallback
    }
    
    // 4. Fallback pricing (from pricing assumptions)
    if (!costs[designMaterialName]) {
      costs[designMaterialName] = getDefaultCostByThickness(thickness, assumptions);
      console.warn(`[Estimation] No mapped cost for "${designMaterialName}", using fallback`);
    }
  }
  
  return costs;
}

// ============================================
// Estimation Mode
// ============================================

/**
 * Run estimation and save to project.optimizationState.estimation
 * Fast mode with ~70% utilization assumption, adds 15% buffer
 */
export async function runProjectEstimation(
  projectId: string,
  userId: string
): Promise<EstimationResult> {
  // Get project
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  
  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  
  // Aggregate parts from all design items
  const parts = await aggregatePartsFromProject(projectId);
  
  if (parts.length === 0) {
    throw new Error('No parts found in project design items');
  }

  // Audit trail — warnings collected during estimation. Surfaced on the
  // EstimationResult so the UI can show "we silently substituted defaults
  // for X" / "Y parts have no price" / "Z material types weren't optimized".
  const warnings: string[] = [];

  // Build material map to consolidate design materials to inventory materials
  // This prevents over-buying when multiple design materials map to the same inventory material
  const materialMap = buildDesignToInventoryMaterialMap(project);

  // Get config or use defaults
  const config = project.optimizationState?.config;

  // Fetch pricing assumptions from organization settings
  const assumptions = await fetchPricingAssumptions();

  // Fetch dynamic material costs from material palette mappings
  const dynamicCosts = await fetchMaterialCosts(parts, project, assumptions);

  // Build stock sheets with dynamic costs
  const stockSheets: Record<string, { material: string; length: number; width: number; thickness: number; cost: number }> = {};

  // First, extract panel stock from material palette (user-configured stock sizes)
  const paletteStock = extractPanelStock(project);
  for (const [materialKey, sheet] of Object.entries(paletteStock)) {
    stockSheets[materialKey] = {
      ...sheet,
      // Override with dynamic cost from inventory if available
      cost: dynamicCosts[materialKey] || sheet.cost,
    };
  }

  // Second, use config stock sheets (legacy config-based stock)
  if (config?.stockSheets) {
    for (const sheet of config.stockSheets) {
      // Only add if not already defined from palette
      if (!stockSheets[sheet.materialName]) {
        stockSheets[sheet.materialName] = {
          material: sheet.materialName,
          length: sheet.length,
          width: sheet.width,
          thickness: sheet.thickness,
          cost: dynamicCosts[sheet.materialName] || sheet.costPerSheet,
        };
      }
    }
  }

  // Add any materials from parts that aren't in config or palette
  // Use inventory material name for grouping (matches what partsToOptimizationPanels uses)
  for (const part of parts) {
    const mappedMaterial = materialMap.get(part.materialName);
    const inventoryMaterial = mappedMaterial?.inventoryName || part.materialName;

    if (inventoryMaterial && !stockSheets[inventoryMaterial]) {
      const resolvedCost = dynamicCosts[part.materialName];
      stockSheets[inventoryMaterial] = {
        material: inventoryMaterial,
        length: 2440,  // Default sheet size
        width: 1220,
        thickness: part.thickness,
        cost: resolvedCost || assumptions.fallbackSheetCost,
      };
      if (!resolvedCost) {
        warnings.push(
          `Sheet material "${inventoryMaterial}" has no inventory mapping or palette price — ` +
          `using fallback price ${assumptions.fallbackSheetCost} per sheet. ` +
          `Add a material palette entry or inventory item before quoting.`
        );
      }
    }
  }

  // ============================================
  // Fetch workshop processing rates and resolve effective rates
  // ============================================
  const workshopRates = await fetchWorkshopRates();
  const { rates: effectiveRates, planingAllowance } = getEffectiveRates(
    workshopRates,
    config?.processingOverrides
  );
  const useOffcutLibrary = config?.useOffcutLibrary !== false; // Default true

  // ============================================
  // Group parts by material type and run type-specific optimization
  // ============================================
  const inferenceLog = new Map<string, { type: MaterialType; source: 'palette' | 'inferred' | 'default' }>();
  const partsByType = groupPartsByMaterialType(parts, project, { inferenceLog });

  // Log material type breakdown for diagnostics
  const typeBreakdown = Object.entries(partsByType)
    .filter(([, p]) => p.length > 0)
    .map(([type, p]) => `${type}: ${p.length}`)
    .join(', ');
  console.log(`[ProjectOptimization] Parts by material type: ${typeBreakdown || 'none'}`);

  // Surface materials whose type wasn't directly resolved from the palette.
  // Inferred = heuristic-classified (probably correct, but worth confirming).
  // Default = nothing matched, fell back to PANEL (high risk of bad nesting).
  const inferredMaterials: Array<[string, MaterialType]> = [];
  const defaultedMaterials: Array<[string, MaterialType]> = [];
  for (const [matName, info] of inferenceLog) {
    if (info.source === 'inferred') inferredMaterials.push([matName, info.type]);
    if (info.source === 'default') defaultedMaterials.push([matName, info.type]);
  }
  if (inferredMaterials.length > 0) {
    const sample = inferredMaterials.slice(0, 4)
      .map(([n, t]) => `"${n}" → ${t}`)
      .join(', ');
    const more = inferredMaterials.length > 4 ? ` (+${inferredMaterials.length - 4} more)` : '';
    warnings.push(
      `${inferredMaterials.length} material(s) had no palette entry and were classified by heuristic — ${sample}${more}. ` +
      `Add explicit palette entries to lock in the correct optimizer (sheet vs timber vs linear).`
    );
  }
  if (defaultedMaterials.length > 0) {
    const sample = defaultedMaterials.slice(0, 4).map(([n]) => `"${n}"`).join(', ');
    const more = defaultedMaterials.length > 4 ? ` (+${defaultedMaterials.length - 4} more)` : '';
    warnings.push(
      `${defaultedMaterials.length} material(s) couldn't be classified at all — ${sample}${more} — ` +
      `defaulted to PANEL. If any of these are timber/linear/glass, the cutting maps will be WRONG. ` +
      `Add palette entries to fix.`
    );
  }

  // Surface material types the optimizer doesn't know how to nest. Without
  // this, parts of these types disappear into a 0-cost void in the estimate.
  // (FABRIC moved out of this list — it now goes through the FabricOptimizationService.)
  for (const unhandledType of ['STONE', 'COMPONENT'] as const) {
    const bucket = partsByType[unhandledType];
    if (bucket.length > 0) {
      const totalQty = bucket.reduce((sum, p) => sum + (p.quantity || 0), 0);
      warnings.push(
        `${bucket.length} ${unhandledType} part(s) (${totalQty} unit(s) total) are not optimized by the nesting studio ` +
        `and their cost is NOT included in this estimate. Procure them separately and add the cost to the quote.`
      );
    }
  }

  // Track processing summaries and offcut usage across all material types
  const allProcessingSummaries: MaterialProcessingSummary[] = [];
  const allOffcutsUsed: UsedOffcut[] = [];
  let totalOffcutSavings = 0;

  // Panel materials (sheet goods) - existing optimization
  let sheetSummary: SheetSummary[] = [];
  let estimationNestingSheets: NestingSheet[] | undefined;
  let panelCost = 0;
  let totalSheetsCount = 0;
  let wasteEstimate = 0;

  if (partsByType.PANEL.length > 0 || partsByType.SOLID.length > 0 || partsByType.VENEER.length > 0) {
    const panelParts = [...partsByType.PANEL, ...partsByType.SOLID, ...partsByType.VENEER];
    const panelPanels = partsToOptimizationPanels(panelParts, materialMap);

    const panelResult = optimizationService.optimize(panelPanels, {
      mode: 'ESTIMATION',
      bladeKerf: config?.kerf || assumptions.cutting.panelKerfMm,
      stockSheets: Object.keys(stockSheets).length > 0 ? stockSheets : undefined,
    });

    sheetSummary = buildSheetSummary(panelResult, panelParts);
    wasteEstimate = panelResult.totalWastedArea / (panelResult.totalUsedArea + panelResult.totalWastedArea) * 100;
    panelCost = (panelResult.estimatedMaterialCost || 0) * assumptions.buffers.panelBuffer;
    totalSheetsCount = panelResult.totalSheets;

    // Surface visualizable layouts for the studio — same builder production
    // uses, so the rendering component can be shared.
    if (panelResult.sheets.length > 0) {
      estimationNestingSheets = buildNestingSheets(panelResult, panelParts);
    }

    // Calculate panel processing costs (cutting + edge banding)
    const panelPartsForProcessing: PanelPartForProcessing[] = panelParts.map(p => ({
      partId: p.id,
      partName: formatOptimizationPanelLabel({
        partNumber: p.partNumber,
        name: p.name,
        designItemName: p.designItemName,
        designItemCode: p.designItemCode,
      }),
      length: p.length,
      width: p.width,
      quantity: p.quantity,
      materialName: p.materialName,
      edgeBanding: p.edgeBanding,
    }));
    const panelProcessingSteps = calculatePanelProcessingCosts(panelPartsForProcessing, effectiveRates);
    if (panelProcessingSteps.length > 0) {
      allProcessingSummaries.push(
        buildProcessingSummary('Sheet Materials', 'PANEL', panelProcessingSteps)
      );
    }

    // Surface available panel offcuts to the user. Today the panel optimizer
    // doesn't consume offcuts (only timber does), so this is informational —
    // a nudge to use Production mode where offcut bookkeeping happens.
    if (useOffcutLibrary) {
      const panelMaterials = new Set(panelParts.map(p => {
        const mapped = materialMap.get(p.materialName);
        return mapped?.inventoryName || p.materialName;
      }));
      for (const matName of panelMaterials) {
        const matParts = panelParts.filter(p => {
          const mapped = materialMap.get(p.materialName);
          return (mapped?.inventoryName || p.materialName) === matName;
        });
        const minLength = Math.min(...matParts.map(p => p.length));
        const minWidth = Math.min(...matParts.map(p => p.width));
        const thickness = matParts[0].thickness;
        const { count, potentialSavings } = await countAvailablePanelOffcuts(matName, thickness, minLength, minWidth);
        if (count > 0) {
          warnings.push(
            `${count} reusable panel offcut(s) available for "${matName}" (≥${thickness}mm) — ` +
            `potential savings of ~${Math.round(potentialSavings).toLocaleString()} UGX. ` +
            `Estimation does not yet auto-consume panel offcuts; switch to Production mode to use them.`
          );
        }
      }
    }
  }

  // Timber materials (dimensional lumber)
  let timberSummary: TimberSummary[] | undefined;
  let timberCost = 0;
  let totalTimberSticks = 0;

  if (partsByType.TIMBER.length > 0) {
    const timberStock = extractTimberStock(project);

    if (timberStock.length === 0) {
      console.warn(
        `[ProjectOptimization] ${partsByType.TIMBER.length} timber parts found but NO timber stock configured. ` +
        `Check that TIMBER palette entries have timberStock definitions with pricing.`
      );
    }

    if (timberStock.length > 0) {
      const timberService = new TimberOptimizationService(
        config?.kerf || assumptions.cutting.timberKerfMm,
        config?.minimumUsableOffcut || assumptions.minimums.timberMinOffcutMm,
        planingAllowance
      );
      // Map timber parts using inventory material names for matching with stock
      const timberParts = partsByType.TIMBER.map(part => {
        const mappedMaterial = materialMap.get(part.materialName);
        return {
          partId: part.id,
          partName: formatOptimizationPanelLabel({
            partNumber: part.partNumber,
            name: part.name,
            designItemName: part.designItemName,
            designItemCode: part.designItemCode,
          }),
          designItemId: part.designItemId,
          designItemName: part.designItemName,
          length: part.length,
          width: part.width,
          thickness: part.thickness,
          quantity: part.quantity,
          materialName: mappedMaterial?.inventoryName || part.materialName,
          hasCNCOperations: (part as any).hasCNCOperations,
        };
      });

      // Query available timber offcuts if offcut library is enabled
      let timberOffcuts: AvailableOffcut[] = [];
      if (useOffcutLibrary) {
        // Query offcuts for each unique material in the timber parts
        const uniqueTimberMaterials = [...new Set(timberParts.map(p => p.materialName))];
        for (const matName of uniqueTimberMaterials) {
          const matParts = timberParts.filter(p => p.materialName === matName);
          const minLength = Math.min(...matParts.map(p => p.length));
          const crossSection = { thickness: matParts[0].thickness, width: matParts[0].width };
          const offcuts = await queryTimberOffcuts(matName, crossSection, minLength);
          timberOffcuts.push(...offcuts);
        }
      }

      timberSummary = await timberService.estimateTimber(timberParts, timberStock, timberOffcuts, assumptions.buffers.timberBuffer, warnings);
      timberCost = timberSummary.reduce((sum, s) => sum + s.estimatedCost, 0);
      totalTimberSticks = timberSummary.reduce((sum, s) => sum + s.sticksRequired, 0);

      // Calculate timber processing costs per material group
      for (const summary of timberSummary) {
        const groupParts: TimberPartForProcessing[] = timberParts
          .filter(p => p.materialName === summary.materialName &&
            p.thickness === summary.crossSection.thickness &&
            p.width === summary.crossSection.width);

        const matchedStock = timberStock.find(s =>
          s.materialName === summary.materialName &&
          (s.thickness >= summary.crossSection.thickness) &&
          (s.width >= summary.crossSection.width)
        ) || null;

        const processingSteps = calculateTimberProcessingCosts(
          groupParts,
          matchedStock,
          effectiveRates,
          planingAllowance
        );

        if (processingSteps.length > 0) {
          summary.processingSteps = processingSteps;
          summary.totalProcessingCost = processingSteps.reduce((sum, s) => sum + s.totalCost, 0);
          allProcessingSummaries.push(
            buildProcessingSummary(summary.materialName, 'TIMBER', processingSteps)
          );
        }

        // Track offcut savings
        if (summary.offcutsUsed && summary.offcutsUsed > 0) {
          const usedOffcutData = timberOffcuts.slice(0, summary.offcutsUsed);
          for (const o of usedOffcutData) {
            allOffcutsUsed.push({
              offcutId: o.offcutId,
              materialName: o.materialName,
              dimensions: `${o.crossSection.thickness}×${o.crossSection.width}mm × ${o.length}mm`,
              savedCost: o.costSaved,
            });
            totalOffcutSavings += o.costSaved;
          }
        }
      }
    }
  }

  // Fabric / upholstery — roll-based, bay-cut model.
  let fabricSummary: FabricSummary[] | undefined;
  let fabricBays: FabricBay[] | undefined;
  let fabricCost = 0;
  let totalFabricBays = 0;

  if (partsByType.FABRIC.length > 0) {
    // Group fabric parts by their (mapped) inventory material name so each
    // fabric type gets its own roll. A project with two upholstery
    // materials (e.g. "Premium Velvet" + "Polyurethane Backing") needs
    // two distinct nesting passes, one per roll.
    const fabricService = new FabricOptimizationService();
    const byMaterial = new Map<string, FabricPart[]>();
    for (const part of partsByType.FABRIC) {
      const mapped = materialMap.get(part.materialName);
      const matName = mapped?.inventoryName || part.materialName;
      const fabricPart: FabricPart = {
        id: part.id,
        partName: formatOptimizationPanelLabel({
          partNumber: part.partNumber,
          name: part.name,
          designItemName: part.designItemName,
          designItemCode: part.designItemCode,
        }),
        partNumber: part.partNumber,
        designItemId: part.designItemId,
        designItemName: part.designItemName,
        length: part.length,
        width: part.width,
        quantity: part.quantity,
        // Polygon outlines aren't yet captured on CutlistPart — when the
        // design studio starts emitting them, drop them in here.
      };
      if (!byMaterial.has(matName)) byMaterial.set(matName, []);
      byMaterial.get(matName)!.push(fabricPart);
    }

    const inventoryRolls = await prefetchFabricRollsFromInventory(
      project,
      new Set(byMaterial.keys()),
      warnings,
    );

    fabricSummary = [];
    fabricBays = [];
    for (const [matName, parts] of byMaterial) {
      const roll = resolveFabricRoll(project, matName, warnings, inventoryRolls);
      const result = fabricService.estimateFabric(parts, roll);
      fabricSummary.push(result.summary);
      fabricBays.push(...result.bays);
      fabricCost += result.summary.estimatedCost;
      totalFabricBays += result.summary.baysRequired;
    }
  }

  // Linear stock materials (metal bars, aluminium)
  let linearStockSummary: LinearStockSummary[] | undefined;
  let linearStockCost = 0;
  let totalLinearBars = 0;

  if (partsByType.METAL_BAR.length > 0 || partsByType.ALUMINIUM.length > 0) {
    const linearStock = extractLinearStock(project);

    if (linearStock.length > 0) {
      const linearService = new LinearStockOptimizationService(
        config?.kerf || assumptions.cutting.timberKerfMm,
        config?.minimumUsableOffcut || assumptions.minimums.linearMinOffcutMm
      );
      // Map linear parts using inventory material names for matching with stock
      const linearMaterialPalette = project.materialPalette?.entries || [];
      const linearParts = [...partsByType.METAL_BAR, ...partsByType.ALUMINIUM].map(part => {
        const mappedMaterial = materialMap.get(part.materialName);
        const paletteEntry = linearMaterialPalette.find(
          e => e.designName === part.materialName || e.normalizedName === part.materialName
        );
        const paletteProfile = paletteEntry?.linearStock?.[0]?.profile;
        return {
          partId: part.id,
          partName: formatOptimizationPanelLabel({
            partNumber: part.partNumber,
            name: part.name,
            designItemName: part.designItemName,
            designItemCode: part.designItemCode,
          }),
          designItemId: part.designItemId,
          designItemName: part.designItemName,
          length: part.length,
          quantity: part.quantity,
          // Use inventory material name for matching with stock
          materialName: mappedMaterial?.inventoryName || part.materialName,
          profile: paletteProfile || `${part.thickness}x${part.width}`,
        };
      });

      linearStockSummary = await linearService.estimateLinearStock(linearParts, linearStock, assumptions.buffers.linearBuffer, assumptions.yields.estimationUtilization / 100);
      linearStockCost = linearStockSummary.reduce((sum, s) => sum + s.estimatedCost, 0);
      totalLinearBars = linearStockSummary.reduce((sum, s) => sum + s.barsRequired, 0);

      // Calculate linear stock processing costs (metal saw cutting)
      const linearPartsForProcessing: LinearPartForProcessing[] = linearParts.map(p => ({
        partId: p.partId,
        partName: p.partName,
        length: p.length,
        quantity: p.quantity,
        materialName: p.materialName,
      }));
      const linearProcessingSteps = calculateLinearProcessingCosts(linearPartsForProcessing, effectiveRates);
      if (linearProcessingSteps.length > 0) {
        allProcessingSummaries.push(
          buildProcessingSummary('Linear Stock', 'LINEAR', linearProcessingSteps)
        );
      }
    }
  }

  // Glass materials (handled similarly to panels but with safety margins)
  if (partsByType.GLASS.length > 0) {
    const glassStock = extractGlassStock(project);

    if (glassStock.length > 0) {
      const glassService = new GlassOptimizationService(config?.kerf || assumptions.cutting.glassKerfMm);
      // Map glass parts using inventory material names for matching with stock
      const glassParts = partsByType.GLASS.map(part => {
        const mappedMaterial = materialMap.get(part.materialName);
        return {
          partId: part.id,
          partName: formatOptimizationPanelLabel({
            partNumber: part.partNumber,
            name: part.name,
            designItemName: part.designItemName,
            designItemCode: part.designItemCode,
          }),
          designItemId: part.designItemId,
          designItemName: part.designItemName,
          length: part.length,
          width: part.width,
          thickness: part.thickness,
          quantity: part.quantity,
          // Use inventory material name for matching with stock
          materialName: mappedMaterial?.inventoryName || part.materialName,
          grain: part.grainDirection === 'none' ? 0 : 1,
        };
      });

      const glassSummary = await glassService.estimateGlass(
        glassParts,
        glassStock,
        assumptions.glass.safetyMarginMm,
        assumptions.yields.glassTargetYield / 100,
        assumptions.buffers.glassBuffer
      );
      // Add glass to sheet summary
      sheetSummary.push(...glassSummary);
      const glassCost = glassSummary.reduce((sum, s) => sum + s.estimatedCost, 0);
      panelCost += glassCost;
      totalSheetsCount += glassSummary.reduce((sum, s) => sum + s.sheetsRequired, 0);

      // Calculate glass processing costs (scoring/cutting)
      const glassPartsForProcessing: GlassPartForProcessing[] = glassParts.map(p => ({
        partId: p.partId,
        partName: p.partName,
        length: p.length,
        width: p.width,
        quantity: p.quantity,
        materialName: p.materialName,
      }));
      const glassProcessingSteps = calculateGlassProcessingCosts(glassPartsForProcessing, effectiveRates);
      if (glassProcessingSteps.length > 0) {
        allProcessingSummaries.push(
          buildProcessingSummary('Glass', 'GLASS', glassProcessingSteps)
        );
      }
    }
  }

  // Edge banding materials (EDGE type) — consumable cost, no nesting
  let edgeMaterialCost = 0;
  if (partsByType.EDGE.length > 0) {
    const materialPalette = project.materialPalette?.entries || [];
    const fallbackEdgeRate = workshopRates?.edgeBandMaterialCostPerMeter;
    const HARDCODED_EDGE_RATE = 2000;
    const fallbackMaterials = new Set<string>();
    for (const part of partsByType.EDGE) {
      const paletteEntry = materialPalette.find(
        e => e.designName === part.materialName || e.normalizedName === part.materialName
      );
      // Cost per meter: use palette unit cost if mapped, otherwise fall back to workshop default
      const costPerMeter = paletteEntry?.unitCost || fallbackEdgeRate || HARDCODED_EDGE_RATE;
      // Part length is edge band length in mm → convert to meters
      edgeMaterialCost += (part.length / 1000) * part.quantity * costPerMeter;
      if (!paletteEntry?.unitCost && !fallbackEdgeRate) {
        fallbackMaterials.add(part.materialName);
      }
    }
    edgeMaterialCost = Math.round(edgeMaterialCost);
    if (fallbackMaterials.size > 0) {
      warnings.push(
        `Edge banding material(s) ${[...fallbackMaterials].map(n => `"${n}"`).join(', ')} have no palette entry ` +
        `and no workshop default rate — using hardcoded fallback of ${HARDCODED_EDGE_RATE} UGX/m. ` +
        `Configure pricing in the material palette or workshop settings.`
      );
    }
  }

  // Aggregate standard and special parts for cost calculation
  const [standardParts, specialParts] = await Promise.all([
    aggregateStandardPartsFromProject(projectId),
    aggregateSpecialPartsFromProject(projectId),
  ]);

  // Calculate standard parts cost (quantity × unitCost)
  const standardPartsCost = standardParts.reduce(
    (sum, p) => sum + (p.quantity * p.unitCost), 0
  );
  const unpricedStandardParts = standardParts.filter(p => !p.unitCost || p.unitCost <= 0);
  if (unpricedStandardParts.length > 0) {
    const sample = unpricedStandardParts.slice(0, 3).map(p => `"${p.name || p.id}"`).join(', ');
    const more = unpricedStandardParts.length > 3 ? ` (+${unpricedStandardParts.length - 3} more)` : '';
    warnings.push(
      `${unpricedStandardParts.length} standard part(s) have no unit cost — including ${sample}${more}. ` +
      `Their cost is excluded from the estimate (treated as 0). Set unit costs on these inventory items.`
    );
  }

  // Calculate special parts cost (unitCost × quantity for proper multiplication)
  const specialPartsCost = specialParts.reduce(
    (sum, p) => sum + (p.quantity * (p.costing?.unitCost || 0)), 0
  );
  const unpricedSpecialParts = specialParts.filter(p => !p.costing?.unitCost || p.costing.unitCost <= 0);
  if (unpricedSpecialParts.length > 0) {
    const sample = unpricedSpecialParts.slice(0, 3).map(p => `"${p.name || p.id}"`).join(', ');
    const more = unpricedSpecialParts.length > 3 ? ` (+${unpricedSpecialParts.length - 3} more)` : '';
    warnings.push(
      `${unpricedSpecialParts.length} special part(s) have no costing.unitCost — including ${sample}${more}. ` +
      `Their cost is excluded from the estimate (treated as 0).`
    );
  }

  // Calculate total processing cost
  const totalProcessingCost = allProcessingSummaries.reduce(
    (sum, s) => sum + s.totalProcessingCost, 0
  );

  // Total cost includes all material types + processing costs + edge material - offcut savings
  const totalCost = panelCost + timberCost + linearStockCost + fabricCost
    + standardPartsCost + specialPartsCost + edgeMaterialCost
    + totalProcessingCost - totalOffcutSavings;

  const timestamp = FirestoreTimestamp.now();

  const estimation: EstimationResult = {
    // Panel materials
    sheetSummary,
    nestingSheets: estimationNestingSheets,
    roughCost: panelCost,

    // Timber materials
    timberSummary,
    timberCost,

    // Linear stock (metal bars, aluminium)
    linearStockSummary,
    linearStockCost,

    // Fabric / upholstery (roll-based)
    fabricSummary,
    fabricBays,
    fabricCost: fabricCost > 0 ? fabricCost : undefined,

    // Edge banding materials
    edgeMaterialCost: edgeMaterialCost > 0 ? edgeMaterialCost : undefined,

    // Processing costs (planing, cutting, routing, edge banding, glass, metal)
    processingSummary: allProcessingSummaries.length > 0 ? allProcessingSummaries : undefined,
    totalProcessingCost: totalProcessingCost > 0 ? totalProcessingCost : undefined,

    // Offcut library savings
    offcutsUsed: allOffcutsUsed.length > 0 ? allOffcutsUsed : undefined,
    offcutSavings: totalOffcutSavings > 0 ? totalOffcutSavings : undefined,

    // Other costs
    standardPartsCost,
    specialPartsCost,
    totalCost,

    // Statistics
    wasteEstimate,
    totalPartsCount: parts.length,
    totalSheetsCount,
    totalTimberSticks,
    totalLinearBars,
    totalFabricBays: totalFabricBays > 0 ? totalFabricBays : undefined,
    totalStandardParts: standardParts.reduce((sum, p) => sum + p.quantity, 0),
    totalSpecialParts: specialParts.reduce((sum, p) => sum + p.quantity, 0),

    // Audit trail
    warnings: warnings.length > 0 ? warnings : undefined,

    validAt: timestamp,
  };

  if (warnings.length > 0) {
    console.warn(`[ProjectOptimization] Estimation finished with ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  
  // Strip fields Firestore can't store from the persistence payload while
  // leaving the in-memory return value untouched (the UI still has them
  // for the immediate render).
  //
  // Specifically: TimberSummary.operationsPerStick is TimberStickOperation[][]
  // — a literal nested array, which Firestore rejects with "Nested arrays
  // are not supported". The studio reads operationsPerStick from the
  // in-memory result, never from a reload, so dropping it from persistence
  // is harmless: every fresh estimation run regenerates it, and the UI
  // recomputes on rerun.
  const persistableTimberSummary = estimation.timberSummary?.map(s => {
    const { operationsPerStick: _ops, ...rest } = s;
    return rest;
  });

  // Cap layout persistence to avoid Firestore's 1MB doc limit. Layouts are
  // recomputed cheaply on rerun, so dropping them from persistence on
  // pathological projects is harmless — the in-memory return value still
  // carries them for the immediate UI render.
  const SHEETS_PERSIST_BUDGET_BYTES = 700_000;
  let persistableNestingSheets: NestingSheet[] | undefined = estimation.nestingSheets;
  if (persistableNestingSheets) {
    const approxSize = JSON.stringify(persistableNestingSheets).length;
    if (approxSize > SHEETS_PERSIST_BUDGET_BYTES) {
      console.warn(
        `[ProjectOptimization] Estimation nestingSheets payload is ${approxSize} bytes ` +
        `(over ${SHEETS_PERSIST_BUDGET_BYTES}) — skipping persistence; layouts will recompute on next run.`,
      );
      persistableNestingSheets = undefined;
      warnings.push(
        `Estimation layouts (~${Math.round(approxSize / 1024)} KB) too large to persist — ` +
        `they'll be recomputed on the next run. The current view still shows them.`,
      );
    }
  }

  // Save to project - explicitly set fields and clear invalidation
  await updateDoc(projectRef, {
    // Panel materials
    'optimizationState.estimation.sheetSummary': estimation.sheetSummary,
    'optimizationState.estimation.nestingSheets': persistableNestingSheets || deleteField(),
    'optimizationState.estimation.roughCost': estimation.roughCost,

    // Timber materials
    'optimizationState.estimation.timberSummary': persistableTimberSummary || deleteField(),
    'optimizationState.estimation.timberCost': estimation.timberCost || deleteField(),

    // Linear stock
    'optimizationState.estimation.linearStockSummary': estimation.linearStockSummary || deleteField(),
    'optimizationState.estimation.linearStockCost': estimation.linearStockCost || deleteField(),

    // Fabric / upholstery
    'optimizationState.estimation.fabricSummary': estimation.fabricSummary || deleteField(),
    'optimizationState.estimation.fabricBays': estimation.fabricBays || deleteField(),
    'optimizationState.estimation.fabricCost': estimation.fabricCost || deleteField(),

    // Edge banding materials
    'optimizationState.estimation.edgeMaterialCost': estimation.edgeMaterialCost || deleteField(),

    // Processing costs
    'optimizationState.estimation.processingSummary': estimation.processingSummary || deleteField(),
    'optimizationState.estimation.totalProcessingCost': estimation.totalProcessingCost || deleteField(),

    // Offcut library
    'optimizationState.estimation.offcutsUsed': estimation.offcutsUsed || deleteField(),
    'optimizationState.estimation.offcutSavings': estimation.offcutSavings || deleteField(),

    // Other costs
    'optimizationState.estimation.standardPartsCost': estimation.standardPartsCost,
    'optimizationState.estimation.specialPartsCost': estimation.specialPartsCost,
    'optimizationState.estimation.totalCost': estimation.totalCost,

    // Statistics
    'optimizationState.estimation.wasteEstimate': estimation.wasteEstimate,
    'optimizationState.estimation.totalPartsCount': estimation.totalPartsCount,
    'optimizationState.estimation.totalSheetsCount': estimation.totalSheetsCount,
    'optimizationState.estimation.totalTimberSticks': estimation.totalTimberSticks || deleteField(),
    'optimizationState.estimation.totalLinearBars': estimation.totalLinearBars || deleteField(),
    'optimizationState.estimation.totalFabricBays': estimation.totalFabricBays || deleteField(),
    'optimizationState.estimation.totalStandardParts': estimation.totalStandardParts,
    'optimizationState.estimation.totalSpecialParts': estimation.totalSpecialParts,

    // Audit trail
    'optimizationState.estimation.warnings': estimation.warnings || deleteField(),

    // Metadata
    'optimizationState.estimation.validAt': estimation.validAt,
    'optimizationState.estimation.invalidatedAt': deleteField(),
    'optimizationState.estimation.invalidationReasons': deleteField(),
    'optimizationState.lastEstimationRun': timestamp,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  // Update RAG status
  const updatedProject = { ...project, optimizationState: { ...project.optimizationState, estimation } } as Project;
  const ragStatus = updateOptimizationRAG(updatedProject);
  
  await updateDoc(projectRef, {
    optimizationRAG: ragStatus,
  });
  
  return estimation;
}

/**
 * Build sheet summary from optimization result
 */
function buildSheetSummary(result: OptimizationResult, parts: CutlistPart[]): SheetSummary[] {
  const summaries: SheetSummary[] = [];
  
  for (const [material, sheetCount] of Object.entries(result.sheetsByMaterial)) {
    const materialParts = parts.filter(p => p.materialName === material);
    const thickness = materialParts[0]?.thickness || 18;
    
    // Estimate based on area
    const totalArea = materialParts.reduce((sum, p) => sum + (p.length * p.width * p.quantity), 0);
    const stockArea = 2440 * 1220; // Default sheet size
    const utilizationPercent = (totalArea / (sheetCount * stockArea)) * 100;
    
    summaries.push({
      materialId: material,
      materialName: material,
      thickness,
      sheetSize: { length: 2440, width: 1220 },
      sheetsRequired: sheetCount,
      partsOnSheet: Math.ceil(materialParts.reduce((sum, p) => sum + p.quantity, 0) / sheetCount),
      utilizationPercent: Math.min(utilizationPercent, 100),
      wasteArea: (sheetCount * stockArea) - totalArea,
      estimatedCost: (result.estimatedMaterialCost || 0) * (sheetCount / result.totalSheets),
    });
  }
  
  return summaries;
}

// ============================================
// Production Mode
// ============================================

/**
 * Run production optimization and save to project.optimizationState.production
 * Full nesting with guillotine algorithm, targets 85%+ yield
 *
 * When `options.itemIds` is provided, only those design items' parts are included.
 * When `options.persist === false`, results are returned in-memory with no Firestore
 * writes and no side effects (no offcut registration, no RAG update, no auto shop
 * traveler). This enables per-item preview/export flows.
 */
export async function runProjectProduction(
  projectId: string,
  userId: string,
  options?: { itemIds?: string[]; persist?: boolean }
): Promise<ProductionResult> {
  const persist = options?.persist !== false;
  const itemIds = options?.itemIds;

  // Get project
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }

  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;

  // Check if estimation exists (only required for persisting full-project runs)
  if (persist && !itemIds && !project.optimizationState?.estimation) {
    throw new Error('Run estimation first before production optimization');
  }

  // Aggregate parts from design items (optionally filtered to a subset)
  const parts = await aggregatePartsFromProject(projectId, itemIds);

  if (parts.length === 0) {
    throw new Error('No parts found in project design items');
  }
  
  // Build material map to consolidate design materials to inventory materials
  // This prevents over-buying when multiple design materials map to the same inventory material
  const materialMap = buildDesignToInventoryMaterialMap(project);

  // Get config
  const config = project.optimizationState?.config;

  // Fetch pricing assumptions from organization settings
  const assumptions = await fetchPricingAssumptions();

  // Fetch dynamic material costs from material palette mappings
  const dynamicCosts = await fetchMaterialCosts(parts, project, assumptions);

  // Build stock sheets with dynamic costs
  const stockSheets: Record<string, { material: string; length: number; width: number; thickness: number; cost: number }> = {};

  // First, extract panel stock from material palette (user-configured stock sizes)
  const paletteStock = extractPanelStock(project);
  for (const [materialKey, sheet] of Object.entries(paletteStock)) {
    stockSheets[materialKey] = {
      ...sheet,
      // Override with dynamic cost from inventory if available
      cost: dynamicCosts[materialKey] || sheet.cost,
    };
  }

  // Second, use config stock sheets (legacy config-based stock)
  if (config?.stockSheets) {
    for (const sheet of config.stockSheets) {
      // Only add if not already defined from palette
      if (!stockSheets[sheet.materialName]) {
        stockSheets[sheet.materialName] = {
          material: sheet.materialName,
          length: sheet.length,
          width: sheet.width,
          thickness: sheet.thickness,
          cost: dynamicCosts[sheet.materialName] || sheet.costPerSheet,
        };
      }
    }
  }

  // Add any materials from parts that aren't in config or palette
  // Use inventory material name for grouping (matches what partsToOptimizationPanels uses)
  for (const part of parts) {
    const mappedMaterial = materialMap.get(part.materialName);
    const inventoryMaterial = mappedMaterial?.inventoryName || part.materialName;

    if (inventoryMaterial && !stockSheets[inventoryMaterial]) {
      stockSheets[inventoryMaterial] = {
        material: inventoryMaterial,
        length: 2440,
        width: 1220,
        thickness: part.thickness,
        cost: dynamicCosts[part.materialName] || assumptions.fallbackSheetCost,
      };
    }
  }

  // ============================================
  // Fetch workshop processing rates and resolve effective rates
  // ============================================
  const workshopRates = await fetchWorkshopRates();
  const { rates: effectiveRates, planingAllowance } = getEffectiveRates(
    workshopRates,
    config?.processingOverrides
  );
  const useOffcutLibrary = config?.useOffcutLibrary !== false; // Default true

  // ============================================
  // Group parts by material type and run type-specific optimization
  // ============================================
  const partsByType = groupPartsByMaterialType(parts, project);

  // Track processing summaries, offcut usage, and generated offcuts
  const allProcessingSummaries: MaterialProcessingSummary[] = [];
  const allOffcutsUsed: UsedOffcut[] = [];
  const allOffcutsGenerated: GeneratedOffcut[] = [];
  let totalOffcutSavings = 0;

  // Panel materials (sheet goods) - existing optimization
  let nestingSheets: NestingSheet[] = [];
  let panelYield = 0;

  if (partsByType.PANEL.length > 0 || partsByType.SOLID.length > 0 || partsByType.VENEER.length > 0) {
    const panelParts = [...partsByType.PANEL, ...partsByType.SOLID, ...partsByType.VENEER];
    const panelPanels = partsToOptimizationPanels(panelParts, materialMap);

    const panelResult = optimizationService.optimize(panelPanels, {
      mode: 'PRODUCTION',
      bladeKerf: config?.kerf || assumptions.cutting.panelKerfMm,
      stockSheets,
    });

    nestingSheets = buildNestingSheets(panelResult, panelParts);
    panelYield = panelResult.averageUtilization;

    // Calculate panel processing costs (cutting + edge banding)
    const panelPartsForProcessing: PanelPartForProcessing[] = panelParts.map(p => ({
      partId: p.id,
      partName: formatOptimizationPanelLabel({
        partNumber: p.partNumber,
        name: p.name,
        designItemName: p.designItemName,
        designItemCode: p.designItemCode,
      }),
      length: p.length,
      width: p.width,
      quantity: p.quantity,
      materialName: p.materialName,
      edgeBanding: p.edgeBanding,
    }));
    const panelProcessingSteps = calculatePanelProcessingCosts(panelPartsForProcessing, effectiveRates);
    if (panelProcessingSteps.length > 0) {
      allProcessingSummaries.push(
        buildProcessingSummary('Sheet Materials', 'PANEL', panelProcessingSteps)
      );
    }

    // Register reusable panel offcuts from production waste regions
    for (const sheet of nestingSheets) {
      if (sheet.wasteRegions && sheet.wasteRegions.length > 0) {
        const stockSheet = stockSheets[sheet.materialName];
        const costPerSqMm = stockSheet
          ? stockSheet.cost / (stockSheet.length * stockSheet.width)
          : 0;

        const panelOffcuts = buildPanelOffcuts(
          sheet.wasteRegions,
          sheet.materialName,
          sheet.sheetSize.width, // thickness — stored at sheet level or default
          costPerSqMm
        );
        allOffcutsGenerated.push(...panelOffcuts);
      }
    }
  }

  // Timber materials (dimensional lumber) - FFD linear cutting
  let timberCuttingResults: LinearCuttingResult[] | undefined;
  let timberYield = 0;

  if (partsByType.TIMBER.length > 0) {
    const timberStock = extractTimberStock(project);

    if (timberStock.length === 0) {
      console.warn(
        `[ProjectOptimization:Production] ${partsByType.TIMBER.length} timber parts but NO timber stock. ` +
        `Timber cutting optimization skipped.`
      );
    }

    if (timberStock.length > 0) {
      const timberService = new TimberOptimizationService(
        config?.kerf || assumptions.cutting.timberKerfMm,
        config?.minimumUsableOffcut || assumptions.minimums.timberMinOffcutMm,
        planingAllowance
      );
      // Map timber parts using inventory material names for matching with stock
      const timberParts = partsByType.TIMBER.map(part => {
        const mappedMaterial = materialMap.get(part.materialName);
        return {
          partId: part.id,
          partName: formatOptimizationPanelLabel({
            partNumber: part.partNumber,
            name: part.name,
            designItemName: part.designItemName,
            designItemCode: part.designItemCode,
          }),
          designItemId: part.designItemId,
          designItemName: part.designItemName,
          length: part.length,
          width: part.width,
          thickness: part.thickness,
          quantity: part.quantity,
          materialName: mappedMaterial?.inventoryName || part.materialName,
          hasCNCOperations: (part as any).hasCNCOperations,
        };
      });

      // Query available timber offcuts if offcut library is enabled
      let timberOffcuts: AvailableOffcut[] = [];
      if (useOffcutLibrary) {
        const uniqueTimberMaterials = [...new Set(timberParts.map(p => p.materialName))];
        for (const matName of uniqueTimberMaterials) {
          const matParts = timberParts.filter(p => p.materialName === matName);
          const minLength = Math.min(...matParts.map(p => p.length));
          const crossSection = { thickness: matParts[0].thickness, width: matParts[0].width };
          const offcuts = await queryTimberOffcuts(matName, crossSection, minLength);
          timberOffcuts.push(...offcuts);
        }
      }

      timberCuttingResults = await timberService.optimizeTimber(timberParts, timberStock, config?.targetYield || assumptions.yields.timberTargetYield, timberOffcuts);

      // Calculate average utilization
      if (timberCuttingResults.length > 0) {
        timberYield = timberCuttingResults.reduce((sum, r) => sum + r.utilizationPercent, 0) / timberCuttingResults.length;
      }

      // Calculate timber processing costs per material group and register offcuts
      for (const result of timberCuttingResults) {
        const groupParts: TimberPartForProcessing[] = timberParts
          .filter(p => p.materialName === result.materialName);

        const matchedStock = timberStock.find(s =>
          s.materialName === result.materialName &&
          (s.thickness >= groupParts[0]?.thickness) &&
          (s.width >= groupParts[0]?.width)
        ) || null;

        const processingSteps = calculateTimberProcessingCosts(
          groupParts,
          matchedStock,
          effectiveRates,
          planingAllowance
        );

        if (processingSteps.length > 0) {
          allProcessingSummaries.push(
            buildProcessingSummary(result.materialName, 'TIMBER', processingSteps)
          );
        }

        // Register timber offcuts from waste segments
        if (result.wasteSegments && result.wasteSegments.length > 0 && matchedStock) {
          const costPerLinearMm = matchedStock.costPerLinearMeter
            ? matchedStock.costPerLinearMeter / 1000 // Convert per-meter to per-mm
            : 0;
          const crossSection = {
            thickness: matchedStock.thickness,
            width: matchedStock.width,
          };
          const timberGeneratedOffcuts = buildTimberOffcuts(
            result.wasteSegments,
            result.materialName,
            crossSection,
            costPerLinearMm
          );
          allOffcutsGenerated.push(...timberGeneratedOffcuts);
        }

        // Track offcut usage from optimization results
        if (result.isOffcut && result.offcutId) {
          const usedOffcut = timberOffcuts.find(o => o.offcutId === result.offcutId);
          if (usedOffcut) {
            allOffcutsUsed.push({
              offcutId: usedOffcut.offcutId,
              materialName: usedOffcut.materialName,
              dimensions: `${usedOffcut.crossSection.thickness}×${usedOffcut.crossSection.width}mm × ${usedOffcut.length}mm`,
              savedCost: usedOffcut.costSaved,
            });
            totalOffcutSavings += usedOffcut.costSaved;
          }
        }
      }
    }
  }

  // Linear stock materials (metal bars, aluminium) - FFD linear cutting
  let linearStockCuttingResults: LinearCuttingResult[] | undefined;
  let linearStockYield = 0;

  if (partsByType.METAL_BAR.length > 0 || partsByType.ALUMINIUM.length > 0) {
    const linearStock = extractLinearStock(project);

    if (linearStock.length > 0) {
      const linearService = new LinearStockOptimizationService(
        config?.kerf || assumptions.cutting.timberKerfMm,
        config?.minimumUsableOffcut || assumptions.minimums.linearMinOffcutMm
      );
      // Map linear parts using inventory material names for matching with stock
      const linearMaterialPalette = project.materialPalette?.entries || [];
      const linearParts = [...partsByType.METAL_BAR, ...partsByType.ALUMINIUM].map(part => {
        const mappedMaterial = materialMap.get(part.materialName);
        const paletteEntry = linearMaterialPalette.find(
          e => e.designName === part.materialName || e.normalizedName === part.materialName
        );
        const paletteProfile = paletteEntry?.linearStock?.[0]?.profile;
        return {
          partId: part.id,
          partName: formatOptimizationPanelLabel({
            partNumber: part.partNumber,
            name: part.name,
            designItemName: part.designItemName,
            designItemCode: part.designItemCode,
          }),
          designItemId: part.designItemId,
          designItemName: part.designItemName,
          length: part.length,
          quantity: part.quantity,
          // Use inventory material name for matching with stock
          materialName: mappedMaterial?.inventoryName || part.materialName,
          profile: paletteProfile || `${part.thickness}x${part.width}`,
        };
      });

      linearStockCuttingResults = await linearService.optimizeLinearStock(linearParts, linearStock, config?.targetYield || assumptions.yields.linearTargetYield);

      // Calculate average utilization
      if (linearStockCuttingResults.length > 0) {
        linearStockYield = linearStockCuttingResults.reduce((sum, r) => sum + r.utilizationPercent, 0) / linearStockCuttingResults.length;
      }
    }
  }

  // Glass materials (2D nesting with safety margins)
  if (partsByType.GLASS.length > 0) {
    const glassStock = extractGlassStock(project);

    if (glassStock.length > 0) {
      const glassService = new GlassOptimizationService(config?.kerf || assumptions.cutting.glassKerfMm);
      // Map glass parts using inventory material names for matching with stock
      const glassParts = partsByType.GLASS.map(part => {
        const mappedMaterial = materialMap.get(part.materialName);
        return {
          partId: part.id,
          partName: formatOptimizationPanelLabel({
            partNumber: part.partNumber,
            name: part.name,
            designItemName: part.designItemName,
            designItemCode: part.designItemCode,
          }),
          designItemId: part.designItemId,
          designItemName: part.designItemName,
          length: part.length,
          width: part.width,
          thickness: part.thickness,
          quantity: part.quantity,
          // Use inventory material name for matching with stock
          materialName: mappedMaterial?.inventoryName || part.materialName,
          grain: part.grainDirection === 'none' ? 0 : 1,
        };
      });

      const glassSheets = await glassService.optimizeGlass(glassParts, glassStock, config?.targetYield || assumptions.yields.glassTargetYield);
      nestingSheets.push(...glassSheets);

      // Update panel yield to include glass
      const glassYield = glassSheets.reduce((sum, s) => sum + s.utilizationPercent, 0) / (glassSheets.length || 1);
      if (nestingSheets.length > glassSheets.length) {
        // Weighted average if we have both panels and glass
        const panelSheetCount = nestingSheets.length - glassSheets.length;
        panelYield = (panelYield * panelSheetCount + glassYield * glassSheets.length) / nestingSheets.length;
      } else {
        panelYield = glassYield;
      }
    }
  }

  // Calculate overall yield (weighted average across all material types)
  const yields = [];
  if (nestingSheets.length > 0) yields.push({ yield: panelYield, weight: nestingSheets.length });
  if (timberCuttingResults && timberCuttingResults.length > 0) yields.push({ yield: timberYield, weight: timberCuttingResults.length });
  if (linearStockCuttingResults && linearStockCuttingResults.length > 0) yields.push({ yield: linearStockYield, weight: linearStockCuttingResults.length });

  const totalWeight = yields.reduce((sum, y) => sum + y.weight, 0);
  const optimizedYield = yields.length > 0
    ? yields.reduce((sum, y) => sum + (y.yield * y.weight), 0) / totalWeight
    : 0;

  // Build cut sequence from nesting sheets (panels and glass only)
  const cutSequence = buildCutSequence(nestingSheets);

  // Calculate total processing cost
  const totalProcessingCost = allProcessingSummaries.reduce(
    (sum, s) => sum + s.totalProcessingCost, 0
  );

  const timestamp = FirestoreTimestamp.now();

  // Register generated offcuts in the offcut library (Firestore) — full-project runs only
  const reusableOffcuts = allOffcutsGenerated.filter(o => o.reusable);
  if (persist && reusableOffcuts.length > 0) {
    try {
      await registerOffcutsFromProduction(projectId, project.name || projectId, reusableOffcuts);
      console.log(`[Production] Registered ${reusableOffcuts.length} reusable offcuts from production`);
    } catch (err) {
      console.warn('[Production] Failed to register offcuts:', err);
    }
  }

  // Mark used offcuts as consumed — full-project runs only
  if (persist && allOffcutsUsed.length > 0) {
    try {
      // Release any previously reserved offcuts first, then re-reserve won't conflict
      await releaseReservedOffcuts(projectId);
    } catch (err) {
      console.warn('[Production] Failed to release previously reserved offcuts:', err);
    }
  }

  const production: ProductionResult = {
    // Panel materials (sheet goods)
    nestingSheets,
    cutSequence,

    // Timber materials (dimensional lumber)
    timberCuttingResults,

    // Linear stock (metal bars, aluminium)
    linearStockCuttingResults,

    // Processing costs (planing, cutting, routing, edge banding)
    processingSummary: allProcessingSummaries.length > 0 ? allProcessingSummaries : undefined,
    totalProcessingCost: totalProcessingCost > 0 ? totalProcessingCost : undefined,

    // Offcut library
    offcutsUsed: allOffcutsUsed.length > 0 ? allOffcutsUsed : undefined,
    offcutsGenerated: allOffcutsGenerated.length > 0 ? allOffcutsGenerated : undefined,

    // Optimization metrics
    optimizedYield,
    sheetYield: nestingSheets.length > 0 ? panelYield : undefined,
    timberYield: timberCuttingResults && timberCuttingResults.length > 0 ? timberYield : undefined,
    linearStockYield: linearStockCuttingResults && linearStockCuttingResults.length > 0 ? linearStockYield : undefined,

    totalCuttingLength: calculateTotalCuttingLength(cutSequence),
    estimatedCutTime: estimateCutTime(cutSequence),

    validAt: timestamp,
  };

  // Ephemeral in-memory runs (e.g. per-item shop traveler) skip all Firestore writes
  // and downstream side effects to avoid polluting the project-wide production state.
  if (!persist) {
    return production;
  }

  // Save to project - explicitly set fields and clear invalidation
  await updateDoc(projectRef, {
    // Panel materials
    'optimizationState.production.nestingSheets': production.nestingSheets,
    'optimizationState.production.cutSequence': production.cutSequence,

    // Timber materials
    'optimizationState.production.timberCuttingResults': production.timberCuttingResults || deleteField(),

    // Linear stock
    'optimizationState.production.linearStockCuttingResults': production.linearStockCuttingResults || deleteField(),

    // Processing costs
    'optimizationState.production.processingSummary': production.processingSummary || deleteField(),
    'optimizationState.production.totalProcessingCost': production.totalProcessingCost || deleteField(),

    // Offcut library
    'optimizationState.production.offcutsUsed': production.offcutsUsed || deleteField(),
    'optimizationState.production.offcutsGenerated': production.offcutsGenerated || deleteField(),

    // Optimization metrics
    'optimizationState.production.optimizedYield': production.optimizedYield,
    'optimizationState.production.sheetYield': production.sheetYield || deleteField(),
    'optimizationState.production.timberYield': production.timberYield || deleteField(),
    'optimizationState.production.linearStockYield': production.linearStockYield || deleteField(),

    'optimizationState.production.totalCuttingLength': production.totalCuttingLength,
    'optimizationState.production.estimatedCutTime': production.estimatedCutTime,

    // Metadata
    'optimizationState.production.validAt': production.validAt,
    'optimizationState.production.invalidatedAt': deleteField(),
    'optimizationState.production.invalidationReasons': deleteField(),
    'optimizationState.lastProductionRun': timestamp,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Update RAG status
  const updatedProject = { ...project, optimizationState: { ...project.optimizationState, production } } as Project;
  const ragStatus = updateOptimizationRAG(updatedProject);

  await updateDoc(projectRef, {
    optimizationRAG: ragStatus,
  });

  // Collect contributing design item IDs for downstream auto-updates
  const contributingItemIds = [...new Set(parts.map(p => p.designItemId).filter(Boolean))];

  // Auto-update design item RAG aspects (production drawings, process docs, tooling, etc.)
  try {
    if (contributingItemIds.length > 0) {
      const { autoUpdateRAGForItems } = await import(
        '@/modules/design-manager/services/ragAutoUpdateService'
      );
      await autoUpdateRAGForItems(projectId, 'production-optimization-completed', contributingItemIds, userId);
    }
  } catch (err) {
    console.warn('[ProjectOptimization] Auto-RAG update failed:', err);
  }

  // Auto-generate Shop Traveler PDF as deliverable for each contributing item
  try {
    if (contributingItemIds.length > 0) {
      const { autoGenerateShopTravelerDeliverable } = await import(
        '@/modules/design-manager/services/deliverableAutoGenService'
      );
      await autoGenerateShopTravelerDeliverable(projectId, contributingItemIds, userId);
    }
  } catch (err) {
    console.warn('[ProjectOptimization] Auto Shop Traveler generation failed:', err);
  }

  return production;
}

/**
 * Run production optimization for a single design item.
 * Ephemeral — returns the result in-memory without touching
 * `project.optimizationState.production` or any other shared state.
 * Use this to generate a per-item Shop Traveler without disturbing the
 * full-project production run.
 */
export async function runItemProduction(
  projectId: string,
  itemId: string,
  userId: string
): Promise<ProductionResult> {
  return runProjectProduction(projectId, userId, {
    itemIds: [itemId],
    persist: false,
  });
}

/**
 * Build nesting sheets from optimization result
 */
function buildNestingSheets(result: OptimizationResult, parts: CutlistPart[]): NestingSheet[] {
  const cloneOperations = (operations: EdgeOperationSpec[] | undefined): EdgeOperationSpec[] | undefined => {
    if (!operations || operations.length === 0) return undefined;
    return operations.map(op => {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(op)) {
        if (value !== undefined) clean[key] = value;
      }
      return clean as unknown as EdgeOperationSpec;
    });
  };

  const toPlacementEdgeData = (
    sourceEdgeBanding: CutlistPart['edgeBanding'] | undefined
  ): Pick<PartPlacement, 'edgeBanding' | 'edgeOperationsBySide'> => {
    if (!sourceEdgeBanding) return {};

    const edgeBanding: PartPlacement['edgeBanding'] = {
      top: sourceEdgeBanding.top,
      bottom: sourceEdgeBanding.bottom,
      left: sourceEdgeBanding.left,
      right: sourceEdgeBanding.right,
      ...(sourceEdgeBanding.front !== undefined ? { front: sourceEdgeBanding.front } : {}),
      ...(sourceEdgeBanding.material !== undefined ? { material: sourceEdgeBanding.material } : {}),
      ...(sourceEdgeBanding.thickness !== undefined ? { thickness: sourceEdgeBanding.thickness } : {}),
      ...(sourceEdgeBanding.edges ? {
        edges: {
          ...(sourceEdgeBanding.edges.top ? {
            top: {
              ...(sourceEdgeBanding.edges.top.material !== undefined ? { material: sourceEdgeBanding.edges.top.material } : {}),
              ...(sourceEdgeBanding.edges.top.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.top.thickness } : {}),
              ...(sourceEdgeBanding.edges.top.length !== undefined ? { length: sourceEdgeBanding.edges.top.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.top.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.top.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.bottom ? {
            bottom: {
              ...(sourceEdgeBanding.edges.bottom.material !== undefined ? { material: sourceEdgeBanding.edges.bottom.material } : {}),
              ...(sourceEdgeBanding.edges.bottom.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.bottom.thickness } : {}),
              ...(sourceEdgeBanding.edges.bottom.length !== undefined ? { length: sourceEdgeBanding.edges.bottom.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.bottom.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.bottom.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.left ? {
            left: {
              ...(sourceEdgeBanding.edges.left.material !== undefined ? { material: sourceEdgeBanding.edges.left.material } : {}),
              ...(sourceEdgeBanding.edges.left.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.left.thickness } : {}),
              ...(sourceEdgeBanding.edges.left.length !== undefined ? { length: sourceEdgeBanding.edges.left.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.left.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.left.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.right ? {
            right: {
              ...(sourceEdgeBanding.edges.right.material !== undefined ? { material: sourceEdgeBanding.edges.right.material } : {}),
              ...(sourceEdgeBanding.edges.right.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.right.thickness } : {}),
              ...(sourceEdgeBanding.edges.right.length !== undefined ? { length: sourceEdgeBanding.edges.right.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.right.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.right.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.front ? {
            front: {
              ...(sourceEdgeBanding.edges.front.material !== undefined ? { material: sourceEdgeBanding.edges.front.material } : {}),
              ...(sourceEdgeBanding.edges.front.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.front.thickness } : {}),
              ...(sourceEdgeBanding.edges.front.length !== undefined ? { length: sourceEdgeBanding.edges.front.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.front.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.front.operations) } : {}),
            },
          } : {}),
        },
      } : {}),
    };

    const edgeOperationsBySide = {
      ...(cloneOperations(sourceEdgeBanding.edges?.top?.operations) ? { top: cloneOperations(sourceEdgeBanding.edges?.top?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.right?.operations) ? { right: cloneOperations(sourceEdgeBanding.edges?.right?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.bottom?.operations) ? { bottom: cloneOperations(sourceEdgeBanding.edges?.bottom?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.left?.operations) ? { left: cloneOperations(sourceEdgeBanding.edges?.left?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.front?.operations) ? { front: cloneOperations(sourceEdgeBanding.edges?.front?.operations) } : {}),
    };

    return {
      edgeBanding,
      ...(Object.keys(edgeOperationsBySide).length > 0 ? { edgeOperationsBySide } : {}),
    };
  };

  const partsById = new Map(parts.map(part => [part.id, part]));
  const inferPlacementQuarterTurns = (
    placement: { width: number; height: number; rotated: boolean },
    originalPart: CutlistPart | undefined
  ): number => {
    if (originalPart) {
      const epsilon = 0.001;
      const sameOrientation =
        Math.abs(placement.width - originalPart.length) < epsilon &&
        Math.abs(placement.height - originalPart.width) < epsilon;
      if (sameOrientation) return 0;
      const quarterTurnOrientation =
        Math.abs(placement.width - originalPart.width) < epsilon &&
        Math.abs(placement.height - originalPart.length) < epsilon;
      if (quarterTurnOrientation) return 1;
    }
    // Fallback for unresolved source metadata.
    return placement.rotated ? 0 : 1;
  };

  const resolveOriginalPart = (panelId: string): CutlistPart | undefined => {
    if (!panelId) return undefined;

    // 1) Exact ID match always wins.
    const exact = partsById.get(panelId);
    if (exact) return exact;

    // 2) Quantity-expanded IDs are created as `${baseId}-${n}` by optimizer.
    // Only strip one trailing numeric segment when exact lookup fails.
    const suffixMatch = panelId.match(/^(.*)-(\d+)$/);
    if (!suffixMatch) return undefined;

    return partsById.get(suffixMatch[1]);
  };

  return result.sheets.map((sheet, index) => {
    const placements: PartPlacement[] = sheet.placements.map(p => {
      const panelId = p.panel.id || '';
      const originalPart = resolveOriginalPart(panelId);
      const sourceEdgeBanding = originalPart?.edgeBanding;
      const edgeData = toPlacementEdgeData(sourceEdgeBanding);
      
      // Store PLACED dimensions (already accounting for rotation)
      // These match what the NestingStudio displays
      const rotationQuarterTurns = inferPlacementQuarterTurns(p, originalPart);
      return {
        partId: p.panel.id || `part-${index}`,
        partName: p.label,
        partNumber: originalPart?.partNumber,
        designItemId: originalPart?.designItemId || '',
        designItemName: originalPart?.designItemName || '',
        x: p.x,
        y: p.y,
        length: p.width,   // Placed width (horizontal on sheet)
        width: p.height,   // Placed height (vertical on sheet)
        rotated: p.rotated,
        rotationQuarterTurns,
        grainAligned: !p.rotated || p.panel.grain === 0,
        // Keep source edge sides from cutlist; PDF layer applies rotation-aware
        // display mapping so edge markers stay locked to part orientation.
        ...edgeData,
      };
    });
    
    // Calculate waste regions from guillotine cut algorithm
    const wasteRegions = calculateWasteRegions({
      width: sheet.width,
      height: sheet.height,
      wastedArea: sheet.wastedArea,
      wasteRegions: sheet.wasteRegions,
    }, placements);
    
    return {
      id: sheet.id,
      sheetIndex: index,
      stockSheetId: sheet.stockSheet.material,
      materialId: sheet.material,
      materialName: sheet.material,
      sheetSize: { length: sheet.width, width: sheet.height },
      placements,
      utilizationPercent: sheet.utilization,
      wasteArea: sheet.wastedArea,
      wasteRegions,
    };
  });
}

/**
 * Calculate waste regions on a sheet from guillotine cut free rectangles
 * For panel saw cutting, waste regions are the remaining free rectangles after all parts are placed
 */
function calculateWasteRegions(
  sheet: { width: number; height: number; wastedArea: number; wasteRegions?: { x: number; y: number; width: number; height: number }[] },
  _placements: PartPlacement[],
  minimumUsableSize: { width: number; height: number } = { width: 200, height: 200 }
): WasteRegion[] {
  const regions: WasteRegion[] = [];
  
  // Use actual waste regions from guillotine algorithm if available
  if (sheet.wasteRegions && sheet.wasteRegions.length > 0) {
    for (const rect of sheet.wasteRegions) {
      const area = rect.width * rect.height;
      // A region is reusable if both dimensions are >= minimum usable size
      const reusable = rect.width >= minimumUsableSize.width && rect.height >= minimumUsableSize.height;
      
      regions.push({
        x: rect.x,
        y: rect.y,
        length: rect.width,   // Horizontal dimension
        width: rect.height,   // Vertical dimension
        area,
        reusable,
      });
    }
  } else if (sheet.wastedArea > 0) {
    // Fallback: create estimated waste region if no detailed regions available
    // This shouldn't happen with panel saw cuts but provides backwards compatibility
    const estimatedSide = Math.sqrt(sheet.wastedArea);
    regions.push({
      x: sheet.width - estimatedSide,
      y: sheet.height - estimatedSide,
      length: estimatedSide,
      width: estimatedSide,
      area: sheet.wastedArea,
      reusable: estimatedSide >= minimumUsableSize.width && estimatedSide >= minimumUsableSize.height,
    });
  }
  
  return regions;
}

/**
 * Build cut sequence from nesting sheets
 */
function buildCutSequence(sheets: NestingSheet[]): CutOperation[] {
  const operations: CutOperation[] = [];
  let sequence = 1;
  
  for (const sheet of sheets) {
    // Generate cuts for each sheet
    // Simplified: just create horizontal and vertical cuts based on placements
    const placements = [...sheet.placements].sort((a, b) => a.y - b.y || a.x - b.x);
    
    for (const placement of placements) {
      // Rip cut (vertical)
      operations.push({
        id: `cut-${sequence}`,
        sheetId: sheet.id,
        sequence: sequence++,
        type: 'rip',
        startX: placement.x + placement.length,
        startY: 0,
        endX: placement.x + placement.length,
        endY: sheet.sheetSize.width,
        length: sheet.sheetSize.width,
        resultingParts: [placement.partId],
      });
      
      // Crosscut (horizontal)
      operations.push({
        id: `cut-${sequence}`,
        sheetId: sheet.id,
        sequence: sequence++,
        type: 'crosscut',
        startX: 0,
        startY: placement.y + placement.width,
        endX: placement.x + placement.length,
        endY: placement.y + placement.width,
        length: placement.x + placement.length,
        resultingParts: [placement.partId],
      });
    }
  }
  
  return operations;
}

/**
 * Calculate total cutting length
 */
function calculateTotalCuttingLength(cuts: CutOperation[]): number {
  return cuts.reduce((sum, cut) => sum + cut.length, 0);
}

/**
 * Estimate cut time based on cut sequence
 */
function estimateCutTime(cuts: CutOperation[]): number {
  // Assume 2 seconds per 100mm of cutting
  const totalLength = calculateTotalCuttingLength(cuts);
  return Math.ceil(totalLength / 100 * 2 / 60); // minutes
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if optimization needs re-run
 */
export function needsReOptimization(
  project: Project,
  mode: 'estimation' | 'production'
): boolean {
  const state = project.optimizationState?.[mode];
  return !state || !!state.invalidatedAt;
}

/**
 * Get optimization status summary
 */
export function getOptimizationStatus(project: Project): {
  estimationStatus: 'none' | 'valid' | 'stale';
  productionStatus: 'none' | 'valid' | 'stale';
  canRunProduction: boolean;
} {
  const estimation = project.optimizationState?.estimation;
  const production = project.optimizationState?.production;
  
  return {
    estimationStatus: !estimation ? 'none' : estimation.invalidatedAt ? 'stale' : 'valid',
    productionStatus: !production ? 'none' : production.invalidatedAt ? 'stale' : 'valid',
    canRunProduction: !!estimation && !estimation.invalidatedAt,
  };
}

/**
 * Update optimization config
 */
export async function updateProjectConfig(
  projectId: string, 
  changes: Partial<OptimizationConfig>,
  userId: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  // Build update object for each changed field
  const updates: Record<string, any> = {
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };
  
  if (changes.kerf !== undefined) {
    updates['optimizationState.config.kerf'] = changes.kerf;
  }
  if (changes.targetYield !== undefined) {
    updates['optimizationState.config.targetYield'] = changes.targetYield;
  }
  if (changes.grainMatching !== undefined) {
    updates['optimizationState.config.grainMatching'] = changes.grainMatching;
  }
  if (changes.allowRotation !== undefined) {
    updates['optimizationState.config.allowRotation'] = changes.allowRotation;
  }
  if (changes.stockSheets !== undefined) {
    updates['optimizationState.config.stockSheets'] = changes.stockSheets;
  }
  
  await updateDoc(projectRef, updates);
}

/**
 * Clear estimation and mark for re-run
 */
export async function clearEstimation(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  await updateDoc(projectRef, {
    'optimizationState.estimation': null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Clear production and mark for re-run
 */
export async function clearProduction(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  await updateDoc(projectRef, {
    'optimizationState.production': null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
