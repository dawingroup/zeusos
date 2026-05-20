/**
 * Cutlist Aggregation Service
 * Aggregates parts from all design items into a consolidated cutlist.
 *
 * **What is included in `consolidatedCutlist.totalParts`**
 * - Every **design item** document under `designProjects/{id}/designItems` is read
 *   (no stage filter — same as a full `getDocs` on the subcollection).
 * - For each item, every row in `item.parts[]` is processed; `totalParts` is the
 *   **sum of `part.quantity × item.requiredQuantity`** on all **cuttable** rows
 *   (see `isCuttablePart`; defaults requiredQuantity to 1).
 * - **Excluded** from the cutlist: `partType === 'component' && source === 'design-studio'`
 *   (scene hardware meshes). Those still appear on the item Parts tab under
 *   Components but must not enter sheet stock / nesting.
 *
 * **What is NOT in the consolidated cutlist** (but may appear elsewhere on the project)
 * - `manufacturing.standardParts` and `manufacturing.specialParts` — kept on the
 *   Cutlist tab as separate “Standard / Special” summaries; they are **not** stored
 *   in `item.parts` and are **not** summed into `consolidatedCutlist.totalParts`.
 *   Summing board cutlist totals + standard + special will **exceed** the sum of
 *   `parts` lines alone.
 *
 * **Cross-check vs a design item**
 * - Per-item Parts tab totals use the same `parts` array (sheet/bar/… quantities).
 * - If the project cutlist total exceeds the sum across items, check: (1) you
 *   included **all** items; (2) you are comparing **sum of Qty** not **row count**;
 *   (3) you did not add **Standard/Special** to the board-material total.
 *
 * **Sheet-typed parts vs the project “Sheet / Timber (palette)” split**
 * - Rows with `partType` unset or `sheet` group as **panel** stock (`materialName + thickness`).
 * - The project UI can show a **Timber** card for the same panel geometry when the material
 *   is classified as **TIMBER** in the project palette. Structural `partType: timber` lumber
 *   is grouped separately from `partType: bar` and tracked volumetrically (m³).
 * - **Project Sheet + Timber (palette) quantities** should match the per-item **Sheet**
 *   subtotal (all sheet-typed `parts` lines) summed across the project.
 */

import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ConsolidatedCutlist,
  MaterialGroup,
  AggregatedPart,
  DesignItem,
  PartEntry,
} from '../types';
import type { MaterialType, MaterialPaletteEntry } from '@/shared/types';
import type { PricingAssumptions } from '@/shared/types/pricingAssumptions';
import {
  resolveMaterialPricingRule,
  resolvePricingAssumptions,
} from '@/shared/types/pricingAssumptions';
import { getOrganizationSettings } from '@/core/settings/settingsService';
import { isCuttablePart } from '@/shared/services/optimization/cuttableParts';

const DEFAULT_SHEET_SIZE = { length: 2440, width: 1220 }; // Standard 8x4 sheet in mm

/** Recursively strip undefined values from objects/arrays (Firestore rejects undefined) */
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && !(obj instanceof Timestamp)) {
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

/**
 * Aggregate cutlist from all design items in a project
 */
export async function aggregateCutlist(
  projectId: string,
  userId: string,
  materialPalette?: MaterialPaletteEntry[],
  pricingAssumptionsInput?: PricingAssumptions
): Promise<ConsolidatedCutlist> {
  // Resolve pricing assumptions: provided → org settings → defaults
  let assumptions = pricingAssumptionsInput ?? null;
  if (!assumptions) {
    try {
      const orgSettings = await getOrganizationSettings('default');
      assumptions = resolvePricingAssumptions(orgSettings?.pricingAssumptions);
    } catch {
      assumptions = resolvePricingAssumptions(null);
    }
  }

  // If no palette provided, try to load from project document
  if (!materialPalette) {
    try {
      const projectDoc = await getDoc(doc(db, 'designProjects', projectId));
      const projectData = projectDoc.data();
      materialPalette = projectData?.materialPalette?.entries;
    } catch {
      // Continue without palette — all parts will use partType defaults
    }
  }

  // Fetch all design items with parts
  const itemsRef = collection(db, 'designProjects', projectId, 'designItems');
  const snapshot = await getDocs(itemsRef);

  const allParts: (AggregatedPart & { materialName: string; thickness: number })[] = [];
  let lastUpdate = new Date(0);

  snapshot.forEach((docSnapshot) => {
    const item = docSnapshot.data() as DesignItem & { parts?: PartEntry[] };
    const parts = item.parts || [];
    // Project-level cutlist must represent physical production quantity,
    // so each part row is multiplied by the parent design item's requiredQuantity.
    const rawRequiredQty = Number((item as any).requiredQuantity);
    const requiredQuantity = Number.isFinite(rawRequiredQty) && rawRequiredQty > 0
      ? rawRequiredQty
      : 1;

    parts.forEach((part) => {
      // Skip scene-origin component parts (hardware mesh nodes). These carry
      // their mesh-node name in `materialName` and would pollute the cutlist
      // with phantom `component-<meshNode>` rows. Hardware is procured by SKU
      // via the hardware schedule, not cut from a palette material.
      if (!isCuttablePart(part as { partType?: string; source?: string })) {
        return;
      }
      const partQty = Number(part.quantity) || 0;
      const effectiveQuantity = partQty * requiredQuantity;
      if (effectiveQuantity <= 0) return;

      // Resolve materialType from palette if available
      let resolvedMaterialType: MaterialType | undefined;
      if (materialPalette) {
        const normalizedName = part.materialName.toLowerCase().trim();
        const paletteEntry = materialPalette.find(e => {
          const entryName = (e.designName || e.normalizedName || '').toLowerCase().trim();
          return entryName === normalizedName && Math.abs((e.thickness || 0) - part.thickness) < 0.1;
        });
        resolvedMaterialType = paletteEntry?.materialType;
      }

      allParts.push({
        partId: part.id,
        designItemId: docSnapshot.id,
        designItemName: item.name,
        partNumber: part.partNumber,
        partName: part.name,
        length: part.length,
        width: part.width,
        thickness: part.thickness,
        quantity: effectiveQuantity,
        grainDirection: part.grainDirection,
        edgeBanding: part.edgeBanding,
        materialName: part.materialName,
        materialType: resolvedMaterialType,
        partType: part.partType ?? 'sheet',
        barProfile: part.barProfile,
        slabSize: (part as any).slabSize,
        rollWidth: (part as any).rollWidth,
        componentUnitCost: (part as any).componentUnitCost,
      });

      const partUpdate = part.updatedAt instanceof Timestamp
        ? part.updatedAt.toDate()
        : new Date(0);
      if (partUpdate > lastUpdate) {
        lastUpdate = partUpdate;
      }
    });
  });

  // Group by material, type, and type-specific key
  const materialMap = new Map<string, MaterialGroup>();

  allParts.forEach((part) => {
    const pType = part.partType ?? 'sheet';

    // Build grouping key based on part type
    let key: string;
    switch (pType) {
      case 'bar':
        key = `bar-${part.materialName}-${part.barProfile ?? ''}`;
        break;
      case 'timber':
        key = `timber-${part.materialName}-${part.barProfile ?? ''}`;
        break;
      case 'slab':
        key = `slab-${part.materialName}-${part.thickness}`;
        break;
      case 'fabric':
        key = `fabric-${part.materialName}-${part.rollWidth ?? 0}`;
        break;
      case 'component':
        key = `component-${part.materialName}`;
        break;
      default: // 'sheet'
        key = `${part.materialName}-${part.thickness}`;
        break;
    }

    if (!materialMap.has(key)) {
      const group: MaterialGroup = {
        materialId: '',
        materialCode: key,
        materialName: part.materialName,
        thickness: pType === 'bar' || pType === 'component' ? 0 : part.thickness,
        parts: [],
        totalParts: 0,
        totalArea: 0,
        estimatedSheets: 0,
        partType: pType,
        materialType: part.materialType,
      };
      // Only include fields relevant to the part type (Firestore rejects undefined)
      switch (pType) {
        case 'bar':
          group.totalLength = 0;
          group.estimatedBars = 0;
          break;
        case 'timber':
          group.totalVolumeCubicMeters = 0;
          group.totalLength = 0; // informational only in cutlist UI
          break;
        case 'slab':
          group.slabSize = part.slabSize;
          group.estimatedSlabs = 0;
          break;
        case 'fabric':
          group.rollWidth = part.rollWidth;
          group.estimatedRollLength = 0;
          break;
        case 'component':
          group.totalQuantity = 0;
          break;
        default: // 'sheet'
          group.sheetSize = DEFAULT_SHEET_SIZE;
          break;
      }
      materialMap.set(key, group);
    }

    const group = materialMap.get(key)!;
    group.parts.push({
      partId: part.partId,
      designItemId: part.designItemId,
      designItemName: part.designItemName,
      partNumber: part.partNumber,
      partName: part.partName,
      length: part.length,
      width: part.width,
      thickness: part.thickness,
      quantity: part.quantity,
      grainDirection: part.grainDirection,
      edgeBanding: part.edgeBanding,
      partType: part.partType,
      materialType: part.materialType,
      barProfile: part.barProfile,
      slabSize: part.slabSize,
      rollWidth: part.rollWidth,
      componentUnitCost: part.componentUnitCost,
    });
    group.totalParts += part.quantity;

    switch (pType) {
      case 'bar':
        group.totalLength = (group.totalLength ?? 0) + (part.length * part.quantity) / 1_000;
        break;
      case 'timber':
        group.totalLength = (group.totalLength ?? 0) + (part.length * part.quantity) / 1_000;
        group.totalVolumeCubicMeters =
          (group.totalVolumeCubicMeters ?? 0) +
          ((part.thickness ?? 0) / 1000) * (part.width / 1000) * (part.length / 1000) * part.quantity;
        break;
      case 'component':
        group.totalQuantity = (group.totalQuantity ?? 0) + part.quantity;
        break;
      default:
        // sheet, slab, fabric: all accumulate area
        group.totalArea += (part.length * part.width * part.quantity) / 1_000_000; // mm² → m²
        break;
    }
  });

  // Calculate estimated stock needed per group using configurable pricing rules
  materialMap.forEach((group) => {
    // Resolve material type for the group (from palette or partType mapping)
    const mType: MaterialType = group.materialType ?? (
      group.partType === 'bar' ? 'METAL_BAR' :
      group.partType === 'timber' ? 'TIMBER' :
      group.partType === 'slab' ? 'STONE' :
      group.partType === 'fabric' ? 'FABRIC' :
      group.partType === 'component' ? 'COMPONENT' :
      'PANEL'
    );
    const rule = resolveMaterialPricingRule(mType, assumptions);
    const yieldFactor = rule.defaultYieldFactor;
    group.yieldFactor = yieldFactor;

    switch (group.partType) {
      case 'bar': {
        const stockLengthMm = rule.linearConfig?.defaultStockLengthMm ?? 6000;
        const totalLengthMm = (group.totalLength ?? 0) * 1_000;
        group.estimatedBars = Math.ceil(totalLengthMm / (stockLengthMm * yieldFactor));
        break;
      }
      case 'timber':
        // Timber groups are volumetric; stick-level optimization is handled
        // by timber stock services, not by the bar-length heuristic.
        break;
      case 'slab': {
        const defaultSlabSize = rule.slabConfig?.defaultSlabSize ?? { length: 3000, width: 1500 };
        if (group.slabSize) {
          const slabArea = (group.slabSize.length * group.slabSize.width) / 1_000_000;
          group.estimatedSlabs = Math.ceil(group.totalArea / (slabArea * yieldFactor));
        } else {
          const fallbackArea = (defaultSlabSize.length * defaultSlabSize.width) / 1_000_000;
          group.estimatedSlabs = Math.ceil(group.totalArea / (fallbackArea * yieldFactor));
        }
        break;
      }
      case 'fabric': {
        const defaultRollWidthMm = rule.fabricConfig?.defaultRollWidthMm ?? 1400;
        const rollWidthM = (group.rollWidth ?? defaultRollWidthMm) / 1_000;
        group.estimatedRollLength = group.totalArea / (rollWidthM * yieldFactor);
        break;
      }
      case 'component':
        // No stock calculation for components — just quantity
        break;
      default: { // 'sheet'
        const defaultSheetSize = rule.panelConfig?.defaultSheetSize ?? { length: 2440, width: 1220 };
        const sheetW = group.sheetSize?.width ?? defaultSheetSize.width;
        const sheetL = group.sheetSize?.length ?? defaultSheetSize.length;
        const sheetArea = (sheetL * sheetW) / 1_000_000;
        group.estimatedSheets = Math.ceil(group.totalArea / (sheetArea * yieldFactor));
        break;
      }
    }
  });

  const materialGroups = Array.from(materialMap.values());

  // Build consolidated cutlist (omit staleReason when not stale - Firestore doesn't accept undefined)
  const cutlist = {
    generatedBy: userId,
    isStale: false,
    lastDesignItemUpdate: Timestamp.fromDate(lastUpdate),
    materialGroups,
    totalParts: materialGroups.reduce((sum, g) => sum + g.totalParts, 0),
    totalUniquePartsCount: allParts.length,
    totalMaterials: materialGroups.length,
    totalArea: Math.round(materialGroups.reduce((sum, g) => sum + g.totalArea, 0) * 1000) / 1000,
    estimatedTotalSheets: materialGroups.reduce((sum, g) => sum + g.estimatedSheets, 0),
  };

  // Save to project document (strip undefined from nested objects — Firestore rejects them)
  const projectRef = doc(db, 'designProjects', projectId);
  await updateDoc(projectRef, {
    consolidatedCutlist: {
      ...stripUndefined(cutlist),
      generatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Auto-update RAG aspects for items that contributed parts
  try {
    const contributingItemIds = [...new Set(allParts.map(p => p.designItemId))];
    if (contributingItemIds.length > 0) {
      const { autoUpdateRAGForItems } = await import('./ragAutoUpdateService');
      await autoUpdateRAGForItems(projectId, 'cutlist-generated', contributingItemIds, userId);
    }
  } catch (err) {
    console.warn('[CutlistAggregation] Auto-RAG update failed:', err);
  }

  return {
    ...cutlist,
    generatedAt: Timestamp.now(),
  } as ConsolidatedCutlist;
}

/**
 * Mark cutlist as stale
 */
export async function markCutlistStale(
  projectId: string,
  reason: string
): Promise<void> {
  const projectRef = doc(db, 'designProjects', projectId);
  await updateDoc(projectRef, {
    'consolidatedCutlist.isStale': true,
    'consolidatedCutlist.staleReason': reason,
  });
}

/**
 * Export cutlist to CSV format
 */
export function exportCutlistCSV(cutlist: ConsolidatedCutlist): string {
  const rows: string[] = [];
  rows.push('Material,Thickness (mm),Profile,Type,Part #,Part Name,Design Item,Length (mm),Width (mm),Qty,Grain,Edges,Edging L (mm),Edging W (mm),Edge Code');

  cutlist.materialGroups.forEach((group) => {
    group.parts.forEach((part) => {
      const isBar = part.partType === 'bar';
      const isTimber = part.partType === 'timber';
      const typeLabel = isTimber ? 'Timber' : isBar ? 'Bar' : 'Sheet';
      const edges = isBar ? '-' : [
        part.edgeBanding?.top && 'T',
        part.edgeBanding?.bottom && 'B',
        part.edgeBanding?.left && 'L',
        part.edgeBanding?.right && 'R',
      ].filter(Boolean).join('') || '-';

      // Edging dimensions: L = tape along length edges (top/bottom), W = tape along width edges (left/right)
      const edgingL = isBar ? '-' : (
        (part.edgeBanding?.top ? part.length : 0) + (part.edgeBanding?.bottom ? part.length : 0)
      ) || 0;
      const edgingW = isBar ? '-' : (
        (part.edgeBanding?.left ? part.width : 0) + (part.edgeBanding?.right ? part.width : 0)
      ) || 0;

      // Edge code indicator e.g. 2L2W = 2 length sides + 2 width sides edged
      let edgeCode = '-';
      if (!isBar) {
        const lCount = (part.edgeBanding?.top ? 1 : 0) + (part.edgeBanding?.bottom ? 1 : 0);
        const wCount = (part.edgeBanding?.left ? 1 : 0) + (part.edgeBanding?.right ? 1 : 0);
        const parts: string[] = [];
        if (lCount > 0) parts.push(`${lCount}L`);
        if (wCount > 0) parts.push(`${wCount}W`);
        edgeCode = parts.length > 0 ? parts.join('') : '-';
      }

      rows.push([
        `"${group.materialName}"`,
        isBar ? '-' : group.thickness,
        isBar ? `"${part.barProfile ?? '-'}"` : '-',
        typeLabel,
        part.partNumber,
        `"${part.partName}"`,
        `"${part.designItemName}"`,
        part.length,
        isBar ? '-' : part.width,
        part.quantity,
        isBar ? '-' : part.grainDirection,
        edges,
        edgingL,
        edgingW,
        edgeCode,
      ].join(','));
    });
  });

  return rows.join('\n');
}

/**
 * Export cutlist summary to CSV
 */
export function exportCutlistSummaryCSV(cutlist: ConsolidatedCutlist): string {
  const rows: string[] = [];
  rows.push('Material,Thickness / Profile,Type,Total Parts,Total Area (m²) / Total Length (m) / Volume (m³),Est. Sheets / Est. Bars');

  cutlist.materialGroups.forEach((group) => {
    if (group.partType === 'bar') {
      rows.push([
        `"${group.materialName}"`,
        `"${group.parts[0]?.barProfile ?? '-'}"`,
        'Bar',
        group.totalParts,
        (group.totalLength ?? 0).toFixed(2),
        group.estimatedBars ?? 0,
      ].join(','));
    } else if (group.partType === 'timber') {
      rows.push([
        `"${group.materialName}"`,
        `${group.thickness}mm`,
        'Timber',
        group.totalParts,
        (group.totalVolumeCubicMeters ?? 0).toFixed(4),
        '-',
      ].join(','));
    } else {
      rows.push([
        `"${group.materialName}"`,
        group.thickness,
        'Sheet',
        group.totalParts,
        group.totalArea.toFixed(3),
        group.estimatedSheets,
      ].join(','));
    }
  });

  rows.push('');
  rows.push(`Total,,,${cutlist.totalParts},${cutlist.totalArea.toFixed(3)},${cutlist.estimatedTotalSheets}`);

  return rows.join('\n');
}

/**
 * Download CSV as file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
