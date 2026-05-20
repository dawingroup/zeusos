/**
 * Scene BOM Rollup Service — Aggregated BOM at project/cabinet/assembly level
 *
 * Computes rollups with per-cabinet attribution for project-level views.
 */
import type {
  SceneBOMRollup,
  BOMCategoryRollup,
  BOMRollupLine,
  SceneAssembly,
  ScenePart,
  ProjectCutList,
  CabinetCutListSection,
  AssemblyCutListSection,
} from '../types/assembly.types';
import type { SceneCabinet } from '../types/scene.types';
import type { PartCategory } from '../constants/assembly.constants';
import { ASSEMBLY_BOM_GROUP_ORDER } from '../constants/assembly.constants';
import { buildAggregatedCutList, extractHardwareSchedule } from './partProcessing.service';
import { getCabinetRequiredQuantity } from '../utils/cabinetQuantity';

/**
 * Multiply a scene part's quantity + totalCost by the cabinet's
 * requiredQuantity multiplier. Returns a CLONE so the cabinet's
 * authored "template" part stays at qty=1 in the source tree — only
 * rollup views see the multiplied figure.
 */
function scaleForCabinet(part: ScenePart, multiplier: number): ScenePart {
  if (multiplier === 1) return part;
  return {
    ...part,
    quantity: (part.quantity ?? 1) * multiplier,
    totalCost: (part.totalCost ?? 0) * multiplier,
  };
}

/**
 * Top-level project rollup across all cabinets.
 */
export function getProjectRollup(
  cabinets: SceneCabinet[],
  assembliesByCabinet: Record<string, SceneAssembly[]>,
): SceneBOMRollup {
  const allParts: Array<ScenePart & { cabinetName: string }> = [];

  for (const cab of cabinets) {
    const assemblies = assembliesByCabinet[cab.id] ?? [];
    const multiplier = getCabinetRequiredQuantity(cab);
    for (const assembly of assemblies) {
      for (const part of assembly.parts) {
        allParts.push({ ...scaleForCabinet(part, multiplier), cabinetName: cab.displayName });
      }
    }
  }

  return buildRollup('project', cabinets[0]?.sceneId ?? '', 'Project Total', allParts);
}

/**
 * Cabinet-scoped rollup.
 */
export function getCabinetRollup(
  cabinet: SceneCabinet,
  assemblies: SceneAssembly[],
): SceneBOMRollup {
  const allParts: Array<ScenePart & { cabinetName: string }> = [];
  const multiplier = getCabinetRequiredQuantity(cabinet);

  for (const assembly of assemblies) {
    for (const part of assembly.parts) {
      allParts.push({ ...scaleForCabinet(part, multiplier), cabinetName: cabinet.displayName });
    }
  }

  return buildRollup('cabinet', cabinet.id, cabinet.displayName, allParts);
}

/**
 * Assembly-scoped rollup.
 */
export function getAssemblyRollup(
  assembly: SceneAssembly,
  cabinetName: string,
): SceneBOMRollup {
  const allParts = assembly.parts.map(p => ({ ...p, cabinetName }));
  return buildRollup('assembly', assembly.id, assembly.displayName, allParts);
}

/**
 * Build the full ProjectCutList for a scene.
 */
export function getProjectCutList(
  cabinets: SceneCabinet[],
  assembliesByCabinet: Record<string, SceneAssembly[]>,
  sceneId: string,
): ProjectCutList {
  const byCabinet: CabinetCutListSection[] = [];
  const allParts: ScenePart[] = [];

  for (const cab of cabinets) {
    const assemblies = assembliesByCabinet[cab.id] ?? [];
    const multiplier = getCabinetRequiredQuantity(cab);
    const byAssembly: AssemblyCutListSection[] = [];

    for (const assembly of assemblies) {
      const parts = assembly.parts.map(p => scaleForCabinet(p, multiplier));
      allParts.push(...parts);

      byAssembly.push({
        assemblyId: assembly.id,
        assemblyCode: assembly.assemblyCode,
        assemblyName: assembly.displayName,
        parts,
        assemblyTotal: {
          partCount: parts.length,
          area: parts.reduce((sum, p) => {
            if (!p.dimensions) return sum;
            return sum + (p.dimensions.length * p.dimensions.width * p.quantity) / 1_000_000;
          }, 0),
          cost: parts.reduce((sum, p) => sum + p.totalCost, 0),
        },
      });
    }

    // Use already-scaled parts for the cabinet total so the displayed
    // area + cost match the per-assembly sums above. Same multiplier
    // applies to every assembly under this cabinet.
    const cabinetParts = assemblies.flatMap(a => a.parts.map(p => scaleForCabinet(p, multiplier)));
    byCabinet.push({
      cabinetId: cab.id,
      cabinetCode: cab.cabinetCode,
      cabinetName: cab.displayName,
      byAssembly,
      cabinetTotal: {
        partCount: cabinetParts.length,
        area: cabinetParts.reduce((sum, p) => {
          if (!p.dimensions) return sum;
          return sum + (p.dimensions.length * p.dimensions.width * p.quantity) / 1_000_000;
        }, 0),
        cost: cabinetParts.reduce((sum, p) => sum + p.totalCost, 0),
      },
    });
  }

  // Aggregated view
  const aggregated = buildAggregatedCutList(allParts);

  // Sheet count estimates (standard PG Bison sheet: 2750 × 1830mm)
  const totalSheetCount: Record<string, number> = {};
  for (const matGroup of aggregated.byMaterial) {
    const sheetArea = 2750 * 1830 / 1_000_000; // m²
    totalSheetCount[matGroup.material] = Math.ceil(matGroup.totalArea / (sheetArea * 0.9)); // 10% waste
  }

  // Edge banding totals
  const totalEdgeBandingByType: Record<string, number> = {};
  for (const part of allParts) {
    if (!part.edgeBanding) continue;
    for (const edge of [part.edgeBanding.top, part.edgeBanding.bottom, part.edgeBanding.left, part.edgeBanding.right, part.edgeBanding.front]) {
      if (!edge) continue;
      totalEdgeBandingByType[edge.type] = (totalEdgeBandingByType[edge.type] ?? 0) + edge.length * part.quantity;
    }
  }

  return {
    sceneId,
    generatedAt: null as unknown as import('firebase/firestore').Timestamp,
    byCabinet,
    aggregated,
    totalSheetCount,
    totalEdgeBandingByType,
    totalHardwareItems: extractHardwareSchedule(allParts),
  };
}

/**
 * Get project-level pricing by aggregating all cabinet pricing.
 */
export function getProjectPricing(
  cabinets: SceneCabinet[],
): import('../types/constraintEngine.types').PricingBreakdown {
  let materialsCost = 0, edgeBandingCost = 0, hardwareCost = 0;
  let laborCost = 0, overheadCost = 0, marginAmount = 0;
  let subtotal = 0, vatAmount = 0, total = 0;

  for (const cab of cabinets) {
    const p = cab.estimatedPrice;
    if (!p) continue;
    // `estimatedPrice` is a PER-UNIT figure (authored once for the
    // cabinet design); multiply by requiredQuantity so a cabinet with
    // qty=4 contributes 4× to the project pricing.
    const m = getCabinetRequiredQuantity(cab);
    materialsCost += (p.materialsCost ?? 0) * m;
    edgeBandingCost += (p.edgeBandingCost ?? 0) * m;
    hardwareCost += (p.hardwareCost ?? 0) * m;
    laborCost += (p.laborCost ?? 0) * m;
    overheadCost += (p.overheadCost ?? 0) * m;
    marginAmount += (p.marginAmount ?? 0) * m;
    subtotal += (p.subtotal ?? 0) * m;
    vatAmount += (p.vatAmount ?? 0) * m;
    total += (p.total ?? 0) * m;
  }

  return {
    materialsCost, edgeBandingCost, hardwareCost,
    laborCost, overheadCost, marginAmount,
    subtotal, vatAmount, total,
    currency: cabinets[0]?.estimatedPrice?.currency ?? 'UGX',
    lineItems: [],
  };
}

// ── Internal helpers ──

function buildRollup(
  level: 'project' | 'cabinet' | 'assembly',
  scopeId: string,
  scopeName: string,
  parts: Array<ScenePart & { cabinetName: string }>,
): SceneBOMRollup {
  const byCategory: Record<string, BOMCategoryRollup> = {};

  for (const cat of ASSEMBLY_BOM_GROUP_ORDER) {
    const catParts = parts.filter(p => p.partCategory === cat);
    if (catParts.length === 0) continue;

    // Group by inventoryItemId
    const lineMap = new Map<string, BOMRollupLine>();
    for (const part of catParts) {
      const key = part.inventoryItemId;
      const existing = lineMap.get(key);
      if (existing) {
        existing.quantity += part.quantity;
        existing.totalCost += part.totalCost;
        const cabEntry = existing.appearingIn.find(a => a.cabinetId === part.cabinetId);
        if (cabEntry) {
          cabEntry.qty += part.quantity;
        } else {
          existing.appearingIn.push({
            cabinetId: part.cabinetId,
            cabinetName: part.cabinetName,
            qty: part.quantity,
          });
        }
      } else {
        lineMap.set(key, {
          inventoryItemId: part.inventoryItemId,
          inventoryItemName: part.inventoryItemName,
          description: part.materialDescription,
          quantity: part.quantity,
          unit: part.unit,
          unitCost: part.unitCost,
          totalCost: part.totalCost,
          appearingIn: [{
            cabinetId: part.cabinetId,
            cabinetName: part.cabinetName,
            qty: part.quantity,
          }],
        });
      }
    }

    byCategory[cat] = {
      category: cat as PartCategory,
      lineItems: Array.from(lineMap.values()),
      subtotal: catParts.reduce((sum, p) => sum + p.totalCost, 0),
      partCount: catParts.length,
    };
  }

  return {
    level,
    scopeId,
    scopeName,
    byCategory,
    totalCost: parts.reduce((sum, p) => sum + p.totalCost, 0),
    totalParts: parts.length,
    currency: parts[0]?.currency ?? 'UGX',
  };
}
