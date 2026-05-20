/**
 * Part Processing Service — Part-level operations for production readiness
 *
 * Computes cut lists, groups by material, estimates sheet counts,
 * validates processability, and bulk-validates entire scenes.
 */
import type { ScenePart, AggregatedCutList } from '../types/assembly.types';
import type { CutListEntry, HardwareScheduleEntry } from '../types/mdp.types';

/**
 * Convert a ScenePart into a CutListEntry for manufacturing.
 */
export function computePartCutList(part: ScenePart): CutListEntry | null {
  if (!part.dimensions || part.partCategory !== 'panel') return null;

  return {
    partName: part.partName,
    material: part.materialDescription,
    finishLibraryId: part.finishLibraryId ?? '',
    length: part.dimensions.length,
    width: part.dimensions.width,
    thickness: part.dimensions.thickness,
    quantity: part.quantity,
    grainDirection: part.dimensions.grainDirection,
    edgeBanding: {
      top: part.edgeBanding?.top?.type ?? null,
      bottom: part.edgeBanding?.bottom?.type ?? null,
      left: part.edgeBanding?.left?.type ?? null,
      right: part.edgeBanding?.right?.type ?? null,
    },
    notes: part.notes,
  };
}

/**
 * Group parts by material + finish for sheet nesting.
 */
export function groupPartsByMaterial(parts: ScenePart[]): Map<string, ScenePart[]> {
  const groups = new Map<string, ScenePart[]>();

  for (const part of parts) {
    if (part.partCategory !== 'panel') continue;
    const key = `${part.inventoryItemId}|${part.finishLibraryId ?? 'none'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(part);
  }

  return groups;
}

/**
 * Estimate sheet count for a group of parts on a given sheet size.
 * Simple area + wastage calculation — production nesting refines this.
 */
export function estimateSheetCount(
  parts: ScenePart[],
  sheetSize: { length: number; width: number },
  wastagePercent: number = 10,
): number {
  const sheetArea = sheetSize.length * sheetSize.width;
  const totalPartArea = parts.reduce((sum, p) => {
    if (!p.dimensions) return sum;
    return sum + p.dimensions.length * p.dimensions.width * p.quantity;
  }, 0);

  const areaWithWastage = totalPartArea * (1 + wastagePercent / 100);
  return Math.ceil(areaWithWastage / sheetArea);
}

/**
 * Sum edge banding lengths by edge type across all parts.
 */
export function computeEdgeBandingTotals(parts: ScenePart[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const part of parts) {
    if (!part.edgeBanding) continue;

    const edges = [
      part.edgeBanding.top,
      part.edgeBanding.bottom,
      part.edgeBanding.left,
      part.edgeBanding.right,
      part.edgeBanding.front,
    ];

    for (const edge of edges) {
      if (!edge) continue;
      const key = edge.type;
      const current = totals.get(key) ?? 0;
      totals.set(key, current + edge.length * part.quantity);
    }
  }

  return totals;
}

/**
 * Extract hardware schedule from parts.
 */
export function extractHardwareSchedule(parts: ScenePart[]): HardwareScheduleEntry[] {
  const byItem = new Map<string, { name: string; qty: number; boring: boolean }>();

  for (const part of parts) {
    if (part.partCategory !== 'hardware' && part.partCategory !== 'fastener') continue;

    const key = part.inventoryItemId;
    const existing = byItem.get(key);
    if (existing) {
      existing.qty += part.quantity;
    } else {
      byItem.set(key, {
        name: part.inventoryItemName,
        qty: part.quantity,
        boring: !!part.boringSpec,
      });
    }
  }

  return Array.from(byItem.entries()).map(([id, data]) => ({
    hardwareName: data.name,
    inventoryItemId: id,
    quantity: data.qty,
    perUnit: 'per project',
    boringRequired: data.boring,
  }));
}

/**
 * Validate whether a part is processable for production.
 */
export function validatePartProcessability(
  part: ScenePart,
): { processable: boolean; issues: string[] } {
  const issues: string[] = [];

  if (part.partCategory === 'panel' && !part.dimensions) {
    issues.push('Panel is missing dimensions (length × width × thickness)');
  }

  if (!part.inventoryItemId) {
    issues.push('No inventory item assigned');
  }

  if (!part.materialDescription) {
    issues.push('Material description is empty');
  }

  if (part.quantity <= 0) {
    issues.push('Quantity must be greater than zero');
  }

  if (part.partCategory === 'panel' && part.dimensions) {
    if (part.dimensions.length <= 0 || part.dimensions.width <= 0 || part.dimensions.thickness <= 0) {
      issues.push('Panel has zero or negative dimensions');
    }
    if (part.dimensions.length > 2800 || part.dimensions.width > 2100) {
      issues.push('Panel exceeds maximum sheet dimensions (2800 × 2100mm)');
    }
  }

  return { processable: issues.length === 0, issues };
}

/**
 * Bulk validate all parts across all cabinets in a scene.
 */
export function bulkValidateParts(
  partsByCabinet: Record<string, ScenePart[]>,
): { ready: boolean; issuesByCabinet: Record<string, string[]> } {
  const issuesByCabinet: Record<string, string[]> = {};
  let hasAnyIssue = false;

  for (const [cabinetId, parts] of Object.entries(partsByCabinet)) {
    const cabinetIssues: string[] = [];
    for (const part of parts) {
      const { processable, issues } = validatePartProcessability(part);
      if (!processable) {
        cabinetIssues.push(...issues.map(i => `${part.partName}: ${i}`));
        hasAnyIssue = true;
      }
    }
    if (cabinetIssues.length > 0) {
      issuesByCabinet[cabinetId] = cabinetIssues;
    }
  }

  return { ready: !hasAnyIssue, issuesByCabinet };
}

/**
 * Build aggregated cut list grouped by material for nesting.
 */
export function buildAggregatedCutList(allParts: ScenePart[]): AggregatedCutList {
  const materialGroups = groupPartsByMaterial(allParts);

  return {
    byMaterial: Array.from(materialGroups.entries()).map(([key, parts]) => {
      const [, finishLibraryId] = key.split('|');
      const totalArea = parts.reduce((sum, p) => {
        if (!p.dimensions) return sum;
        return sum + (p.dimensions.length * p.dimensions.width * p.quantity) / 1_000_000;
      }, 0);

      return {
        material: parts[0]?.materialDescription ?? key,
        finishLibraryId: finishLibraryId === 'none' ? '' : finishLibraryId,
        parts,
        totalArea,
      };
    }),
  };
}
