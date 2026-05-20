/**
 * Material Harvester Service
 * Scans design items to build and maintain project material palette
 */

import {
  doc,
  documentId,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  limit as fsLimit,
  serverTimestamp,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Project,
  MaterialPalette,
  MaterialPaletteEntry,
  MaterialType,
  OptimizationStockSheet,
  GlassStockDefinition,
  TimberStockDefinition,
  LinearStockDefinition,
  FabricRollDefinition,
  TimberCrossSectionUsage,
} from '@/shared/types';
import { releaseOffcut } from '@/shared/services/offcutLibraryService';
import { getFamilyStockRollup } from '@/modules/inventory/services/inventoryService';
import { isCuttablePart } from '@/shared/services/optimization/cuttableParts';
import type { PartEntry } from '../types';

// Collection names
const PROJECTS_COLLECTION = 'designProjects';

/** Recursively strip undefined values before writing to Firestore */
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && !(obj instanceof FirestoreTimestamp)) {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        cleaned[k] = typeof v === 'object' && v !== null ? stripUndefined(v) : v;
      }
    }
    return cleaned;
  }
  return obj;
}
const DESIGN_ITEMS_SUBCOLLECTION = 'designItems';

/**
 * Resolve an inventory item's valuation cost on stock UoM.
 * Uses functional-currency valuation when present, then applies
 * purchase→stock UoM conversion if configured.
 */
function resolveInventoryValuationCost(
  inventoryData: Record<string, unknown>,
): { costPerUnit: number; costUnit?: string } {
  const pricing = inventoryData.pricing as {
    costPerUnit?: number;
    functionalCurrencyCost?: number;
    costPerCubicMetre?: number;
    pricingBasis?: 'per-unit' | 'per-cbm';
    unit?: string;
  } | undefined;
  // Volume-priced timber: keep pricing on cubic-metre basis so downstream
  // costing stays volumetric (m³) instead of being misread as linear.
  if (pricing?.pricingBasis === 'per-cbm' && (pricing.costPerCubicMetre ?? 0) > 0) {
    return { costPerUnit: pricing.costPerCubicMetre as number, costUnit: 'cbm' };
  }

  const purchaseCost = pricing?.costPerUnit ?? 0;
  const purchaseUom = (inventoryData.purchaseUom as string | undefined) ?? pricing?.unit;
  const stockUom = (inventoryData.stockUom as string | undefined) ?? purchaseUom ?? pricing?.unit;

  if (purchaseCost <= 0) {
    return { costPerUnit: 0, costUnit: stockUom };
  }

  const functionalCost = pricing?.functionalCurrencyCost ?? purchaseCost;
  if (functionalCost <= 0) {
    return { costPerUnit: 0, costUnit: stockUom };
  }

  if (purchaseUom && stockUom && purchaseUom !== stockUom) {
    const conversion = typeof inventoryData.uomConversion === 'number' ? inventoryData.uomConversion : 0;
    if (conversion > 0) {
      return {
        costPerUnit: functionalCost / conversion,
        costUnit: stockUom,
      };
    }
    return { costPerUnit: 0, costUnit: stockUom };
  }

  return {
    costPerUnit: functionalCost,
    costUnit: stockUom,
  };
}

// ============================================
// Types
// ============================================

export interface HarvestResult {
  newMaterials: string[];
  existingMaterials: string[];
  removedMaterials: string[];
  totalMaterials: number;
  unmappedCount: number;
}

export interface MaterialUsage {
  designName: string;
  normalizedName: string;
  thickness: number;
  usageCount: number;
  designItemIds: Set<string>;
  /** Explicit material type forced from partType to avoid name-based misclassification. */
  forcedMaterialType?: MaterialType;
  /** When true, this entry represents edge banding (linear meters) not a sheet material */
  isEdgeBanding?: boolean;
  /** When true, this entry is a timber species aggregation (ignores thickness in the key). */
  isTimber?: boolean;
  /** Per-cross-section usage for timber entries, keyed by `${thickness}x${width}`. */
  timberCrossSections?: Map<string, TimberCrossSectionUsage>;
}

/**
 * Strip a trailing cross-section suffix (e.g. "Mahogany 45x20" → "Mahogany",
 * "Mvule 50 x 75 mm" → "Mvule") so timber species collapse into a single
 * palette entry regardless of how the user labelled the cross-section in the
 * design item's material field.
 */
function stripCrossSectionSuffix(name: string): string {
  if (!name) return name;
  const stripped = name
    .replace(/\s*\d+(?:\.\d+)?\s*[xX×]\s*\d+(?:\.\d+)?(?:\s*mm)?\s*$/, '')
    .trim();
  return stripped || name;
}

// ============================================
// Normalization Utilities
// ============================================

/**
 * Normalize material name for consistent matching
 */
export function normalizeMaterialName(name: string): string {
  if (!name) return 'unknown';
  
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .replace(/[_-]+/g, ' ')         // Replace underscores/dashes with spaces
    .replace(/\bmm\b/gi, '')        // Remove "mm" unit
    .replace(/\d+\s*mm/gi, '')      // Remove thickness like "18mm"
    .replace(/\s+/g, ' ')           // Collapse again
    .trim();
}

/**
 * Extract thickness from material name
 */
export function extractThickness(name: string): number {
  const match = name.match(/(\d+)\s*mm/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 18; // Default thickness
}

/**
 * Detect material type from name
 */
export function detectMaterialType(name: string): MaterialType {
  const lower = name.toLowerCase();

  // Edge banding
  if (lower.includes('edge') || lower.includes('banding')) {
    return 'EDGE';
  }

  // Veneer
  if (lower.includes('veneer')) {
    return 'VENEER';
  }

  // Stone / countertop
  if (lower.includes('granite') || lower.includes('marble') || lower.includes('limestone') ||
      lower.includes('slate') || lower.includes('travertine') || lower.includes('onyx') ||
      lower.includes('soapstone') || lower.includes('terrazzo') || lower.includes('stone slab') ||
      lower.includes('countertop stone') || lower.includes('quartz countertop') ||
      (lower.includes('quartz') && !lower.includes('quartz glass'))) {
    return 'STONE';
  }

  // Glass
  if (lower.includes('glass')) {
    return 'GLASS';
  }

  // Aluminium
  if (lower.includes('aluminium') || lower.includes('aluminum') || lower.includes('alu ')) {
    return 'ALUMINIUM';
  }

  // Metal bars
  if (lower.includes('steel') || lower.includes('metal') || lower.includes('bar') ||
      lower.includes('tube') || lower.includes('pipe') || lower.includes('angle') ||
      lower.includes('channel') || lower.includes('shs') || lower.includes('rhs')) {
    return 'METAL_BAR';
  }

  // Fabric / upholstery — sold by linear meter of fixed-width roll.
  // `uphost` covers both the correct spelling (upholstery, upholster) and the
  // common typo "uphostry" that shows up in scene imports. Includes common
  // upholstery fabrics by fiber/weave name so that e.g. "Linen Beige" or
  // "Cotton Twill" classify correctly without manual reclassification.
  if (lower.includes('uphost') || lower.includes('fabric') || lower.includes('leather') ||
      lower.includes('vinyl') || lower.includes('velvet') || lower.includes('suede') ||
      lower.includes('pleather') || lower.includes('linen') || lower.includes('cotton') ||
      lower.includes('silk') || lower.includes('canvas') || lower.includes('wool') ||
      lower.includes('polyester') || lower.includes('jute') || lower.includes('burlap') ||
      lower.includes('tweed') || lower.includes('chenille') || lower.includes('nylon')) {
    return 'FABRIC';
  }

  // Timber (dimensional lumber) — common species and structural terms
  if (lower.includes('timber') || lower.includes('lumber') || lower.includes('pine') ||
      lower.includes('oak') || lower.includes('meranti') || lower.includes('par') ||
      lower.includes('hardwood') || lower.includes('softwood') || lower.includes('beam') ||
      lower.includes('post') || lower.includes('joist') ||
      // African / tropical species
      lower.includes('mahogany') || lower.includes('sapele') || lower.includes('iroko') ||
      lower.includes('mvule') || lower.includes('teak') || lower.includes('musizi') ||
      lower.includes('elgon') || lower.includes('nkalati') || lower.includes('markhamia') ||
      // Common global species
      lower.includes('cedar') || lower.includes('cypress') || lower.includes('walnut') ||
      lower.includes('ash') || lower.includes('birch') || lower.includes('maple') ||
      lower.includes('cherry') || lower.includes('poplar') || lower.includes('spruce') ||
      lower.includes('fir') || lower.includes('eucalyptus') ||
      // Structural terms
      lower.includes('rafter') || lower.includes('purlin') || lower.includes('stud') ||
      lower.includes('batten') || lower.includes('plank') || lower.includes('sawn') ||
      lower.includes('dressed') || lower.includes('rough sawn') || lower.includes('kiln dried')) {
    return 'TIMBER';
  }

  // Solid wood (legacy - less specific than timber)
  if (lower.includes('solid')) {
    return 'SOLID';
  }

  // Default to panel (sheet goods)
  return 'PANEL';
}

// ============================================
// Harvester Functions
// ============================================

/**
 * Scan all design items, extract materials, update palette
 * Returns what changed for invalidation detection
 */
export async function harvestMaterials(
  projectId: string,
  userId: string
): Promise<HarvestResult> {
  // Fetch project and its items in parallel (eliminates sequential waterfall)
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);

  const [projectSnap, itemsSnapshot] = await Promise.all([
    getDoc(projectRef),
    getDocs(itemsRef),
  ]);

  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }

  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  const previousPalette = project.materialPalette?.entries || [];
  const previousNames = new Set(previousPalette.map(e => e.normalizedName));

  // Aggregate all materials from design items (subcollection under project)
  const materialUsage = new Map<string, MaterialUsage>();
  
  console.log('[MaterialHarvester] Found design items:', itemsSnapshot.docs.length);
  
  for (const itemDoc of itemsSnapshot.docs) {
    const itemData = itemDoc.data();
    const designItemId = itemDoc.id;
    const parts: PartEntry[] = itemData.parts || [];
    
    console.log(`[MaterialHarvester] Item ${designItemId} has ${parts.length} parts`);
    
    // Design-level edge banding material name (fallback when part-level is not set)
    const designEdgeMaterial: string | undefined =
      (itemData.parameters?.edgeBanding?.material as string | undefined);

    for (const part of parts) {
      // Skip scene-origin component parts (hardware mesh nodes like door handles
      // or drawer fronts). Their `materialName` is the mesh node's own name,
      // which would mint a phantom palette entry per node. Hardware is procured
      // by SKU via the hardware schedule, not cut from a palette material.
      if (!isCuttablePart(part as { partType?: string; source?: string })) {
        continue;
      }

      const rawDesignName = part.materialName || part.materialId || 'Unknown';
      // Detect timber up front so we can aggregate by species (ignoring cross-section)
      // and drop the "18mm", "45x20" suffixes that would otherwise fragment the palette.
      const detectedType = detectMaterialType(rawDesignName);
      const explicitPartType = part.partType;
      const canInferTimberFromName = !explicitPartType || explicitPartType === 'sheet';
      const isTimber = explicitPartType === 'timber' || (canInferTimberFromName && detectedType === 'TIMBER');

      const forcedMaterialType: MaterialType | undefined =
        explicitPartType === 'bar'
          ? 'METAL_BAR'
          : explicitPartType === 'timber'
            ? 'TIMBER'
            : explicitPartType === 'slab'
              ? 'STONE'
              : explicitPartType === 'fabric'
                ? 'FABRIC'
                : explicitPartType === 'component'
                  ? 'COMPONENT'
                  : undefined;

      const designName = isTimber ? stripCrossSectionSuffix(rawDesignName) : rawDesignName;
      const normalizedName = normalizeMaterialName(designName);
      const thickness = isTimber ? 0 : (part.thickness || extractThickness(designName));

      // Timber collapses by species; other materials key on (name, thickness).
      const key = isTimber
        ? `__timber__|${normalizedName}`
        : `${normalizedName}|${thickness}`;

      if (!materialUsage.has(key)) {
        materialUsage.set(key, {
          designName,
          normalizedName,
          thickness,
          usageCount: 0,
          designItemIds: new Set(),
          ...(forcedMaterialType ? { forcedMaterialType } : {}),
          ...(isTimber ? { isTimber: true, timberCrossSections: new Map() } : {}),
        });
      }

      const usage = materialUsage.get(key)!;
      usage.usageCount += part.quantity || 1;
      usage.designItemIds.add(designItemId);

      // For timber, capture per-cross-section demand so nesting/BOM can plan
      // against the actual finished sizes even though pricing is species-level.
      if (isTimber && usage.timberCrossSections) {
        const th = part.thickness || 0;
        const wd = part.width || 0;
        const ln = part.length || 0;
        const qty = part.quantity || 1;
        if (th > 0 && wd > 0 && ln > 0) {
          const csKey = `${th}x${wd}`;
          const linearMm = ln * qty;
          const volumeM3 = (th * wd * ln * qty) / 1_000_000_000;
          const existing = usage.timberCrossSections.get(csKey);
          if (existing) {
            existing.partCount += qty;
            existing.totalLinearMm += linearMm;
            existing.totalVolumeM3 += volumeM3;
          } else {
            usage.timberCrossSections.set(csKey, {
              thickness: th,
              width: wd,
              partCount: qty,
              totalLinearMm: linearMm,
              totalVolumeM3: volumeM3,
            });
          }
        }
      }

      // Harvest edge banding material as separate EDGE-type palette entries.
      // P1.1: when rich per-edge data is available, aggregate per distinct
      // edge material instead of lumping all edges under one shared name.
      const eb = part.edgeBanding;
      if (eb && (eb.top || eb.bottom || eb.left || eb.right || eb.front)) {
        const lengthMm = part.length || 0;
        const widthMm = part.width || 0;
        const qty = part.quantity || 1;
        const sharedMaterial = eb.material || designEdgeMaterial || 'Edge Banding';

        // Collect edges with their material + length
        const edgeSides: Array<{ applied: boolean; side: 'top' | 'bottom' | 'left' | 'right' | 'front'; fallbackLenMm: number }> = [
          { applied: eb.top, side: 'top', fallbackLenMm: lengthMm },
          { applied: eb.bottom, side: 'bottom', fallbackLenMm: lengthMm },
          { applied: eb.left, side: 'left', fallbackLenMm: widthMm },
          { applied: eb.right, side: 'right', fallbackLenMm: widthMm },
          { applied: !!eb.front, side: 'front', fallbackLenMm: 0 },
        ];

        for (const { applied, side, fallbackLenMm } of edgeSides) {
          if (!applied) continue;
          const rich = eb.edges?.[side];
          const edgeMaterialName = rich?.material || sharedMaterial;
          const edgeLenMm = rich?.length || fallbackLenMm;
          const edgeMeters = (edgeLenMm / 1000) * qty;
          const normalizedEdgeName = normalizeMaterialName(edgeMaterialName);
          const edgeKey = `__edge__|${normalizedEdgeName}`;

          if (!materialUsage.has(edgeKey)) {
            materialUsage.set(edgeKey, {
              designName: edgeMaterialName,
              normalizedName: normalizedEdgeName,
              thickness: rich?.thickness ?? 0,
              usageCount: 0,
              designItemIds: new Set(),
              isEdgeBanding: true,
            });
          }

          const edgeUsage = materialUsage.get(edgeKey)!;
          edgeUsage.usageCount += edgeMeters; // linear meters
          edgeUsage.designItemIds.add(designItemId);
        }
      }
    }
  }
  
  // Detect changes
  const currentNames = new Set(Array.from(materialUsage.values()).map(u => u.normalizedName));
  
  const result: HarvestResult = {
    newMaterials: [],
    existingMaterials: [],
    removedMaterials: [],
    totalMaterials: materialUsage.size,
    unmappedCount: 0,
  };
  
  // Find new materials
  for (const name of currentNames) {
    if (previousNames.has(name)) {
      result.existingMaterials.push(name);
    } else {
      result.newMaterials.push(name);
    }
  }
  
  // Find removed materials
  for (const name of previousNames) {
    if (!currentNames.has(name)) {
      result.removedMaterials.push(name);
    }
  }
  
  console.log('[MaterialHarvester] Total unique materials found:', materialUsage.size);
  
  // Build new palette
  const timestamp = FirestoreTimestamp.now();
  
  const newEntries: MaterialPaletteEntry[] = [];
  
  for (const [_key, usage] of materialUsage) {
    // Check if we have an existing entry to preserve mappings.
    // Timber collapses by species, so a prior "Mahogany 45" mapping should
    // still seed the new aggregated "Mahogany" entry.
    const existingEntry = usage.isTimber
      ? previousPalette.find(
          e =>
            e.normalizedName === usage.normalizedName &&
            (e.materialType === 'TIMBER' ||
              (e.timberStock && e.timberStock.length > 0)),
        )
      : previousPalette.find(
          e =>
            e.normalizedName === usage.normalizedName &&
            e.thickness === usage.thickness,
        );
    
    // Build entry without undefined values (Firestore doesn't accept undefined)
    // Preserve existing materialType if entry was previously set (user may have manually reclassified),
    // unless the usage is unambiguously timber — a species aggregation must stay TIMBER.
    const materialType = usage.forcedMaterialType
      ? usage.forcedMaterialType
      : usage.isTimber
      ? 'TIMBER'
      : existingEntry
        ? existingEntry.materialType   // Preserve user/existing classification
        : (usage.isEdgeBanding ? 'EDGE' : detectMaterialType(usage.designName));  // Force EDGE for banding; auto-detect for others

    const entry: MaterialPaletteEntry = {
      id: existingEntry?.id || generateId(),
      designName: usage.designName,
      normalizedName: usage.normalizedName,
      thickness: usage.thickness,
      materialType,
      usageCount: usage.usageCount,
      designItemIds: Array.from(usage.designItemIds),
      stockSheets: existingEntry?.stockSheets || [],
      createdAt: existingEntry?.createdAt || timestamp,
      updatedAt: timestamp,
    };

    // Only add optional mapping fields if they exist
    if (existingEntry?.inventoryId) {
      entry.inventoryId = existingEntry.inventoryId;
      entry.inventoryName = existingEntry.inventoryName;
      entry.inventorySku = existingEntry.inventorySku;
      entry.unitCost = existingEntry.unitCost;
      entry.mappedAt = existingEntry.mappedAt;
      entry.mappedBy = existingEntry.mappedBy;
    }

    // Timber cross-section breakdown — always refreshed from the latest scan
    // (it's derived data, not user-edited).
    if (usage.timberCrossSections && usage.timberCrossSections.size > 0) {
      entry.timberCrossSections = Array.from(usage.timberCrossSections.values())
        .sort((a, b) =>
          a.thickness - b.thickness || a.width - b.width,
        );
    }

    // Preserve inventory family link (set when mapped to an isFamily=true item)
    if (existingEntry?.inventoryFamilyId) {
      entry.inventoryFamilyId = existingEntry.inventoryFamilyId;
    }

    // Preserve type-specific stock configurations across re-harvests
    if (existingEntry?.timberStock && existingEntry.timberStock.length > 0) {
      entry.timberStock = existingEntry.timberStock;
    }
    if (existingEntry?.linearStock && existingEntry.linearStock.length > 0) {
      entry.linearStock = existingEntry.linearStock;
    }
    if (existingEntry?.glassStock && existingEntry.glassStock.length > 0) {
      entry.glassStock = existingEntry.glassStock;
    }

    // Preserve offcut reservations
    if (existingEntry?.offcutIds && existingEntry.offcutIds.length > 0) {
      entry.offcutIds = existingEntry.offcutIds;
    }

    // Preserve quality-tier alternative mappings across re-harvests
    if (existingEntry?.alternatives && existingEntry.alternatives.length > 0) {
      entry.alternatives = existingEntry.alternatives;
    }
    if (existingEntry?.baseQualityTier) {
      entry.baseQualityTier = existingEntry.baseQualityTier;
    }
    
    if (!entry.inventoryId) {
      result.unmappedCount++;
    }
    
    newEntries.push(entry);
  }
  
  // Update palette
  const newPalette: MaterialPalette = {
    entries: newEntries,
    lastHarvestedAt: timestamp,
    unmappedCount: result.unmappedCount,
    mappedCount: newEntries.length - result.unmappedCount,
  };
  
  // Save to project (strip undefined — Firestore rejects it)
  await updateDoc(projectRef, {
    materialPalette: stripUndefined(newPalette),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  // If new materials added, invalidate estimation
  if (result.newMaterials.length > 0) {
    await invalidateEstimation(
      projectId, 
      userId,
      `New materials: ${result.newMaterials.join(', ')}`
    );
  }
  
  return result;
}

/**
 * Map a material to inventory
 * If unitCost is 0 or undefined, automatically fetches price from inventory item
 */
export async function mapMaterialToInventory(
  projectId: string,
  paletteEntryId: string,
  inventoryId: string,
  inventoryName: string,
  inventorySku: string,
  unitCost: number | undefined,
  stockSheets: OptimizationStockSheet[],
  userId: string,
  glassStock?: GlassStockDefinition[],
  timberStock?: TimberStockDefinition[],
  linearStock?: LinearStockDefinition[],
  /**
   * P21.12 — optional Finish Library binding. When supplied (e.g. from the
   * "Finish" mapping tab), these values are written verbatim and the
   * Firestore lookup is skipped. When omitted, the function auto-resolves
   * by querying `finishLibrary` for an active doc with matching
   * `inventoryItemId`.
   */
  finishBinding?: { finishId?: string; finishCode?: string; finishName?: string },
): Promise<void> {
  // Auto-fetch price and unit from inventory if not provided or zero
  let resolvedUnitCost = unitCost || 0;
  let resolvedCostUnit: string | undefined;
  let resolvedFamilyId: string | undefined;
  // Structured sheet dimensions from the inventory item. When present, we
  // refresh stockSheets[0].length/width to match — otherwise the UI's default
  // 2440×1220 sticks even when the mapped SKU is (say) a 2750×1830 board,
  // inflating cost-per-m² by the ratio of the two sheet areas.
  let resolvedSheetDimensions: { length: number; width: number; thickness?: number } | undefined;
  try {
    const inventoryRef = doc(db, 'inventoryItems', inventoryId);
    const inventorySnap = await getDoc(inventoryRef);
    if (inventorySnap.exists()) {
      const inventoryData = inventorySnap.data();
      const valuation = resolveInventoryValuationCost(inventoryData as Record<string, unknown>);
      resolvedCostUnit = valuation.costUnit;

      const dims = inventoryData.dimensions;
      if (dims && typeof dims.length === 'number' && typeof dims.width === 'number' &&
          dims.length > 0 && dims.width > 0) {
        resolvedSheetDimensions = {
          length: dims.length,
          width: dims.width,
          thickness: typeof dims.thickness === 'number' ? dims.thickness : undefined,
        };
      }

      // Family mapping: when the target is an inventory family (isFamily=true),
      // compute a stock-weighted average cost across its active child SKUs and
      // record the family id so downstream nesting can still fan out to SKUs.
      if (inventoryData.isFamily) {
        resolvedFamilyId = inventoryId;
        try {
          const rollup = await getFamilyStockRollup(inventoryId);
          const familyAvgCost =
            rollup?.weightedAvgCost && rollup.weightedAvgCost > 0
              ? rollup.weightedAvgCost
              : rollup?.simpleAvgCost && rollup.simpleAvgCost > 0
                ? rollup.simpleAvgCost
                : rollup?.costFrom && rollup.costFrom > 0
                  ? rollup.costFrom
                  : 0;

          if (familyAvgCost > 0 && resolvedUnitCost === 0) {
            resolvedUnitCost = familyAvgCost;
            console.log(
              `[MaterialHarvester] Family ${inventoryName}: derived avg cost ${resolvedUnitCost.toFixed(2)} across ${rollup?.variantCount ?? 0} variants (stock ${rollup?.totalStockQty ?? 0}).`,
            );
          }

          // If the family parent itself has no pricing unit, borrow one from
          // an active child SKU so palette calculations use the right denominator.
          if (!resolvedCostUnit) {
            const childQ = query(
              collection(db, 'inventoryItems'),
              where('familyId', '==', inventoryId),
              where('status', '==', 'active'),
              fsLimit(1),
            );
            const childSnap = await getDocs(childQ);
            if (!childSnap.empty) {
              const childData = childSnap.docs[0].data();
              resolvedCostUnit = childData.pricing?.unit;
            }
          }
        } catch (rollupErr) {
          console.warn('[MaterialHarvester] Failed to roll up family stock pricing:', rollupErr);
        }
      }

      if (resolvedUnitCost === 0) {
        resolvedUnitCost = valuation.costPerUnit || 0;
        console.log(`[MaterialHarvester] Auto-fetched price for ${inventoryName}: ${resolvedUnitCost} per ${resolvedCostUnit}`);
      }
    }
  } catch (error) {
    console.warn(`[MaterialHarvester] Failed to auto-fetch price/unit for ${inventoryName}:`, error);
  }
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  
  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  const palette = project.materialPalette;
  
  if (!palette) {
    throw new Error('Material palette not initialized. Run harvest first.');
  }
  
  const entryIndex = palette.entries.findIndex(e => e.id === paletteEntryId);
  if (entryIndex === -1) {
    throw new Error('Palette entry not found');
  }
  
  const entry = palette.entries[entryIndex];
  const previousInventoryId = entry.inventoryId;
  const wasUnmapped = !previousInventoryId;
  
  const timestamp = FirestoreTimestamp.now();
  
  // Update entry with resolved price (auto-fetched from inventory if needed)
  // Include type-specific stock configurations if provided
  // Extract offcut IDs from offcut-prefixed inventoryId (e.g., "offcut:abc123")
  const offcutIds = inventoryId.startsWith('offcut:')
    ? [...(entry.offcutIds || []), inventoryId.replace('offcut:', '')]
    : entry.offcutIds;

  // P21.12 — resolve the Finish Library binding. Caller-supplied wins;
  // otherwise look up the first active finish whose `inventoryItemId`
  // matches. Missing/failed lookups are non-fatal — palette still maps to
  // inventory, just without the finish chip.
  let finishId = finishBinding?.finishId;
  let finishCode = finishBinding?.finishCode;
  let finishName = finishBinding?.finishName;
  if (!finishId && !inventoryId.startsWith('offcut:')) {
    try {
      const finishesQ = query(
        collection(db, 'finishLibrary'),
        where('inventoryItemId', '==', inventoryId),
        where('isActive', '==', true),
        fsLimit(1),
      );
      const fs = await getDocs(finishesQ);
      if (!fs.empty) {
        const fDoc = fs.docs[0];
        const f = fDoc.data() as { code?: string; name?: string };
        finishId = fDoc.id;
        finishCode = f.code;
        finishName = f.name;
      }
    } catch (error) {
      console.warn('[MaterialHarvester] Finish lookup failed:', error);
    }
  }

  // Refresh stock-sheet dimensions from the mapped inventory's structured
  // `dimensions`. This prevents the UI default (2440×1220) from sticking on
  // palette entries mapped to non-standard-size boards (e.g. 2750×1830 MFC)
  // — which would otherwise inflate cost-per-m² via
  // estimateService.calculateSheetMaterialsFromParts (sheetArea is derived
  // from these dims, so a too-small sheetArea over-charges each m² of usage).
  const refreshedStockSheets: OptimizationStockSheet[] =
    resolvedSheetDimensions && stockSheets.length > 0
      ? stockSheets.map((ss, idx) =>
          idx === 0
            ? {
                ...ss,
                length: resolvedSheetDimensions!.length,
                width: resolvedSheetDimensions!.width,
                ...(resolvedSheetDimensions!.thickness !== undefined && {
                  thickness: resolvedSheetDimensions!.thickness,
                }),
              }
            : ss,
        )
      : stockSheets;

  palette.entries[entryIndex] = {
    ...entry,
    inventoryId,
    inventoryItemId: inventoryId, // P21.12 — mirror to the canonical field
    inventoryName,
    inventorySku,
    unitCost: resolvedUnitCost,
    ...(resolvedCostUnit && { costUnit: resolvedCostUnit }),
    ...(resolvedFamilyId && { inventoryFamilyId: resolvedFamilyId }),
    stockSheets: refreshedStockSheets,
    ...(glassStock && { glassStock }),
    ...(timberStock && { timberStock }),
    ...(linearStock && { linearStock }),
    ...(offcutIds && offcutIds.length > 0 && { offcutIds }),
    ...(finishId ? { finishId, finishCode, finishName } : {}),
    mappedAt: timestamp,
    mappedBy: userId,
    updatedAt: timestamp,
  };
  
  // Update counts
  if (wasUnmapped) {
    palette.unmappedCount = Math.max(0, palette.unmappedCount - 1);
    palette.mappedCount++;
  }
  
  // Save to project
  await updateDoc(projectRef, {
    materialPalette: stripUndefined(palette),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  // If stock sheets changed (by id OR dimensions), invalidate estimation.
  // Dimension-change matters because sheetArea drives cost-per-m² downstream
  // even when the stock-sheet id is unchanged (e.g. a dim-refresh on remap).
  const fingerprint = (sheets: OptimizationStockSheet[]) =>
    sheets
      .map((s) => `${s.id}|${s.length}|${s.width}|${s.thickness}|${s.costPerSheet}`)
      .sort()
      .join(',');
  const previousFingerprint = fingerprint(entry.stockSheets);
  const newFingerprint = fingerprint(refreshedStockSheets);

  if (previousFingerprint !== newFingerprint) {
    await invalidateEstimation(
      projectId,
      userId,
      `Stock sheets changed for: ${entry.designName}`
    );
  }
}

/**
 * Update stock configuration on a palette entry without going through the full mapping flow.
 * Allows users to configure stock (timber, glass, linear, panel) independently.
 */
export async function updatePaletteEntryStock(
  projectId: string,
  paletteEntryId: string,
  config: {
    stockSheets?: OptimizationStockSheet[];
    glassStock?: GlassStockDefinition[];
    timberStock?: TimberStockDefinition[];
    linearStock?: LinearStockDefinition[];
    fabricStock?: FabricRollDefinition[];
  },
  userId: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }

  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  const palette = project.materialPalette;

  if (!palette) {
    throw new Error('Material palette not initialized');
  }

  const entryIndex = palette.entries.findIndex(e => e.id === paletteEntryId);
  if (entryIndex === -1) {
    throw new Error('Palette entry not found');
  }

  const now = FirestoreTimestamp.now();

  palette.entries[entryIndex] = {
    ...palette.entries[entryIndex],
    ...(config.stockSheets !== undefined && { stockSheets: config.stockSheets }),
    ...(config.glassStock !== undefined && { glassStock: config.glassStock }),
    ...(config.timberStock !== undefined && { timberStock: config.timberStock }),
    ...(config.linearStock !== undefined && { linearStock: config.linearStock }),
    ...(config.fabricStock !== undefined && { fabricStock: config.fabricStock }),
    updatedAt: now,
  };

  await updateDoc(projectRef, {
    materialPalette: stripUndefined(palette),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await invalidateEstimation(
    projectId,
    userId,
    `Stock configuration updated for: ${palette.entries[entryIndex].designName}`
  );
}

/**
 * Unmap a material from inventory
 */
export async function unmapMaterial(
  projectId: string,
  paletteEntryId: string,
  userId: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  
  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  const palette = project.materialPalette;
  
  if (!palette) {
    throw new Error('Material palette not initialized');
  }
  
  const entryIndex = palette.entries.findIndex(e => e.id === paletteEntryId);
  if (entryIndex === -1) {
    throw new Error('Palette entry not found');
  }
  
  const entry = palette.entries[entryIndex];
  const wasMapped = !!entry.inventoryId;

  // Release any offcuts that were reserved for this mapping
  if (entry.offcutIds && entry.offcutIds.length > 0) {
    await Promise.all(
      entry.offcutIds.map(id => releaseOffcut(id).catch(err =>
        console.warn(`[MaterialHarvester] Failed to release offcut ${id}:`, err)
      ))
    );
  }

  const now = FirestoreTimestamp.now();

  // Clear mapping (delete fields rather than setting undefined — Firestore rejects undefined)
  // P21.12 — also drop the Finish Library binding so the row re-enters the "unmapped" state.
  const { inventoryId, inventoryItemId, inventoryName, inventorySku, unitCost, mappedAt, mappedBy, offcutIds, inventoryFamilyId, finishId, finishCode, finishName, ...rest } = entry;
  palette.entries[entryIndex] = {
    ...rest,
    stockSheets: [],
    updatedAt: now,
  };

  // Update counts
  if (wasMapped) {
    palette.unmappedCount++;
    palette.mappedCount = Math.max(0, palette.mappedCount - 1);
  }
  
  // Save to project
  await updateDoc(projectRef, {
    materialPalette: stripUndefined(palette),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
}

// ============================================
// Invalidation Helpers
// ============================================

/**
 * Invalidate estimation results
 */
async function invalidateEstimation(
  projectId: string,
  userId: string,
  reason: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) return;
  
  const project = projectSnap.data() as Project;
  
  if (project.optimizationState?.estimation && !project.optimizationState.estimation.invalidatedAt) {
    const now = FirestoreTimestamp.now();
    
    await updateDoc(projectRef, {
      'optimizationState.estimation.invalidatedAt': {
        seconds: now.seconds,
        nanoseconds: now.nanoseconds,
      },
      'optimizationState.estimation.invalidationReasons': [reason],
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a simple ID
 */
function generateId(): string {
  return `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sync material palette prices from linked inventory items
 * Updates unitCost from the latest inventory prices
 */
export async function syncPalettePricesFromInventory(
  projectId: string,
  userId: string
): Promise<{ updated: number; errors: string[] }> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  
  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  const palette = project.materialPalette;
  
  if (!palette || palette.entries.length === 0) {
    return { updated: 0, errors: [] };
  }
  
  const result = { updated: 0, errors: [] as string[] };
  let hasChanges = false;
  
  // Fetch only the inventory items referenced by palette entries (scoped query).
  // Firestore 'in' operator supports up to 30 values per query, so we chunk.
  const inventoryRef = collection(db, 'inventoryItems');
  const inventoryByIdMap = new Map<string, { costPerUnit: number; costUnit: string; inStock: number }>();
  const inventoryBySkuMap = new Map<string, { costPerUnit: number; costUnit: string; inStock: number }>();

  const neededIds = palette.entries
    .map((e) => e.inventoryItemId || e.inventoryId)
    .filter((id): id is string => !!id);
  const uniqueIds = [...new Set(neededIds)];

  // Fetch in chunks of 30 (Firestore 'in' limit)
  for (let i = 0; i < uniqueIds.length; i += 30) {
    const chunk = uniqueIds.slice(i, i + 30);
    const q = query(inventoryRef, where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const valuation = resolveInventoryValuationCost(data as Record<string, unknown>);
      let costPerUnit = valuation.costPerUnit || 0;
      let costUnit = valuation.costUnit || 'sheet';
      const inStock = data.inventory?.inStock || 0;

      // Family-mapped palette entries should follow child SKU rollup pricing.
      if (data.isFamily) {
        try {
          const rollup = await getFamilyStockRollup(docSnap.id);
          const familyAvgCost =
            rollup?.weightedAvgCost && rollup.weightedAvgCost > 0
              ? rollup.weightedAvgCost
              : rollup?.simpleAvgCost && rollup.simpleAvgCost > 0
                ? rollup.simpleAvgCost
                : rollup?.costFrom && rollup.costFrom > 0
                  ? rollup.costFrom
                  : 0;

          if (familyAvgCost > 0) {
            costPerUnit = familyAvgCost;
          }

          // If family parent has no unit, borrow one from an active child SKU.
          if (!data.pricing?.unit) {
            const childQ = query(
              inventoryRef,
              where('familyId', '==', docSnap.id),
              where('status', '==', 'active'),
              fsLimit(1),
            );
            const childSnap = await getDocs(childQ);
            if (!childSnap.empty) {
              const child = childSnap.docs[0].data();
              if (child.pricing?.unit) {
                costUnit = child.pricing.unit;
              }
            }
          }
        } catch (err) {
          console.warn('[MaterialHarvester] Family rollup failed during palette sync:', err);
        }
      }

      inventoryByIdMap.set(docSnap.id, { costPerUnit, costUnit, inStock });
      if (data.sku) {
        inventoryBySkuMap.set(data.sku, { costPerUnit, costUnit, inStock });
      }
    }
  }
  
  // Update palette entries with latest prices
  for (let i = 0; i < palette.entries.length; i++) {
    const entry = palette.entries[i];
    
    if (!entry.inventoryId && !entry.inventoryItemId && !entry.inventorySku) {
      continue; // Not mapped to inventory
    }
    
    // Look up by ID first, then by SKU
    let inventoryData = entry.inventoryItemId
      ? inventoryByIdMap.get(entry.inventoryItemId)
      : entry.inventoryId
        ? inventoryByIdMap.get(entry.inventoryId)
        : undefined;
    
    if (!inventoryData && entry.inventorySku) {
      inventoryData = inventoryBySkuMap.get(entry.inventorySku);
    }
    
    if (inventoryData && inventoryData.costPerUnit > 0) {
      const currentCost = entry.unitCost || 0;
      
      // Only update if price changed
      if (currentCost !== inventoryData.costPerUnit || entry.costUnit !== inventoryData.costUnit) {
        palette.entries[i] = {
          ...entry,
          unitCost: inventoryData.costPerUnit,
          costUnit: inventoryData.costUnit,
          updatedAt: FirestoreTimestamp.now(),
        };
        hasChanges = true;
        result.updated++;
        console.log(`[MaterialHarvester] Updated price for ${entry.designName}: ${currentCost} -> ${inventoryData.costPerUnit}`);
      }
    }
  }
  
  // Save if changes were made
  if (hasChanges) {
    await updateDoc(projectRef, {
      materialPalette: stripUndefined(palette),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    
    // Invalidate estimation since costs changed
    await invalidateEstimation(
      projectId,
      userId,
      `Material prices updated from inventory sync (${result.updated} items)`
    );
  }
  
  return result;
}

/**
 * Sync all projects' material palette prices from inventory
 * Propagates price changes across all projects
 */
export async function syncAllProjectPricesFromInventory(
  userId: string
): Promise<{ projectsUpdated: number; totalMaterialsUpdated: number }> {
  const projectsRef = collection(db, PROJECTS_COLLECTION);
  const projectsSnapshot = await getDocs(projectsRef);
  
  let projectsUpdated = 0;
  let totalMaterialsUpdated = 0;
  
  for (const projectDoc of projectsSnapshot.docs) {
    const projectData = projectDoc.data();
    
    // Only process projects with material palettes that have mapped materials
    if (projectData.materialPalette?.mappedCount > 0) {
      try {
        const result = await syncPalettePricesFromInventory(projectDoc.id, userId);
        if (result.updated > 0) {
          projectsUpdated++;
          totalMaterialsUpdated += result.updated;
        }
      } catch (error) {
        console.error(`Failed to sync prices for project ${projectDoc.id}:`, error);
      }
    }
  }
  
  console.log(`[MaterialHarvester] Synced prices: ${totalMaterialsUpdated} materials across ${projectsUpdated} projects`);
  
  return { projectsUpdated, totalMaterialsUpdated };
}

/**
 * Get palette statistics
 */
export function getPaletteStats(palette: MaterialPalette | undefined): {
  total: number;
  mapped: number;
  unmapped: number;
  percentMapped: number;
} {
  if (!palette) {
    return { total: 0, mapped: 0, unmapped: 0, percentMapped: 0 };
  }
  
  const total = palette.entries.length;
  const mapped = palette.mappedCount;
  const unmapped = palette.unmappedCount;
  
  return {
    total,
    mapped,
    unmapped,
    percentMapped: total > 0 ? Math.round((mapped / total) * 100) : 0,
  };
}

/**
 * Check if all materials are mapped (required for BOM export)
 */
export function allMaterialsMapped(palette: MaterialPalette | undefined): boolean {
  if (!palette) return false;
  return palette.unmappedCount === 0 && palette.entries.length > 0;
}

// ============================================
// Inventory Name Resolution
// ============================================

export type InventoryNameResolver = (materialName: string, thickness?: number) => string;

/**
 * Build a resolver that maps design material names to inventory product names
 * using the project's material palette. Falls back to original name if no mapping.
 */
export function buildInventoryNameResolver(palette?: MaterialPalette | null): InventoryNameResolver {
  if (!palette?.entries?.length) return (name) => name;

  // Build map: "normalizedName|thickness" → inventoryName
  const map = new Map<string, string>();
  for (const entry of palette.entries) {
    if (entry.inventoryName) {
      map.set(`${entry.normalizedName}|${entry.thickness}`, entry.inventoryName);
    }
  }
  if (map.size === 0) return (name) => name;

  return (materialName: string, thickness?: number) => {
    const normalized = normalizeMaterialName(materialName);
    // Exact match with thickness
    if (thickness !== undefined) {
      const exact = map.get(`${normalized}|${thickness}`);
      if (exact) return exact;
    }
    // Fuzzy: match by normalized name only (for bars, edge banding, etc.)
    for (const [key, invName] of map) {
      if (key.startsWith(normalized + '|')) return invName;
    }
    return materialName; // No mapping found
  };
}

// ============================================
// Full Inventory Metadata Resolution
// ============================================

export interface ResolvedInventoryMaterial {
  name: string;
  inventoryItemId?: string;
  inventorySku?: string;
  offcutIds?: string[];
}

export type InventoryMaterialResolver = (materialName: string, thickness?: number) => ResolvedInventoryMaterial;

/**
 * Build a resolver that maps design material names to full inventory metadata
 * (name, inventoryItemId, sku) from the project's material palette.
 * Used by handover to populate BOM entries with inventory links.
 */
export function buildInventoryMaterialResolver(palette?: MaterialPalette | null): InventoryMaterialResolver {
  if (!palette?.entries?.length) return (name) => ({ name });

  const map = new Map<string, ResolvedInventoryMaterial>();
  for (const entry of palette.entries) {
    if (entry.inventoryName || entry.inventoryItemId || entry.inventoryId) {
      map.set(`${entry.normalizedName}|${entry.thickness}`, {
        name: entry.inventoryName || entry.designName,
        // inventoryId holds the document ID; inventoryItemId is an alias
        inventoryItemId: entry.inventoryItemId || entry.inventoryId,
        inventorySku: entry.inventorySku,
        offcutIds: entry.offcutIds,
      });
    }
  }
  if (map.size === 0) return (name) => ({ name });

  return (materialName: string, thickness?: number) => {
    const normalized = normalizeMaterialName(materialName);
    if (thickness !== undefined) {
      const exact = map.get(`${normalized}|${thickness}`);
      if (exact) return exact;
    }
    for (const [key, meta] of map) {
      if (key.startsWith(normalized + '|')) return meta;
    }
    return { name: materialName };
  };
}
