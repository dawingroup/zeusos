/**
 * Fabric / upholstery optimizer.
 *
 * Roll-based, bay-cut model. Parts are nested into bays of fixed
 * width (rollWidth — set by the manufacturer) and a manageable length
 * (bayLength — chosen so an upholsterer can physically cut the section
 * from the roll without unrolling 50m at a time). Each bay = one
 * cut-section. Total fabric consumed = baysRequired × bayLength.
 *
 * Two paths, planned:
 *   bbox     — parts as axis-aligned rectangles. Reuses the existing
 *              guillotine + FFD 2D nester. Used for estimation today
 *              and for production until polygon outlines are flowing
 *              from the design studio.
 *   polygon  — NFP-based BLF placer. Activates when parts carry
 *              detailed outlines. Not implemented in this service yet
 *              (week 4+ work); the polygon field on FabricPart is
 *              accepted and forwarded for future use.
 *
 * Caller responsibility: pass an array of fabric parts grouped under a
 * single roll definition. Materials with different rolls should be
 * processed in separate calls.
 */

import { OptimizationService } from './OptimizationService';
import type { Panel, SheetLayout } from './OptimizationService';
import type {
  FabricRollDefinition,
  FabricBay,
  FabricPlacement,
  FabricSummary,
  WasteRegion,
} from '@/shared/types';

/**
 * One fabric part as accepted by the optimizer.
 *
 * Includes both bbox dimensions (always required — minimum input for the
 * bbox path) and an optional polygon outline (used by the future
 * polygon-aware path for tighter packing of curved cushion panels and
 * leather hides). Today the polygon is carried through but not
 * consulted.
 */
export interface FabricPart {
  id: string;
  partName: string;
  partNumber?: string;
  designItemId: string;
  designItemName: string;
  /** Bounding box dimensions — always required. */
  length: number;
  width: number;
  /** Quantity of this part to nest. */
  quantity: number;
  /** Optional polygon outline relative to the bbox origin. When the
   *  design studio supplies detailed shapes this populates; the
   *  bbox-path optimizer ignores it (forwarded onto the placement
   *  for downstream rendering). */
  polygon?: Array<[number, number]>;
}

export interface FabricNestingResult {
  /** One bay per cut-section the upholsterer needs to take from the roll. */
  bays: FabricBay[];
  /** Aggregate row for the cost / summary table. */
  summary: FabricSummary;
}

export class FabricOptimizationService {
  private readonly optimizer: OptimizationService;

  constructor() {
    this.optimizer = new OptimizationService();
  }

  /**
   * Pack the given parts into bays of the configured roll. Single-pass
   * estimate — fast enough to call in the cost-estimation pipeline.
   */
  estimateFabric(parts: FabricPart[], roll: FabricRollDefinition): FabricNestingResult {
    return this.run(parts, roll, 'ESTIMATION');
  }

  /**
   * Production-quality pack — same bbox path today; once polygons land,
   * this is the dispatch site that will pick the NFP placer for parts
   * that carry detailed outlines.
   */
  optimizeFabric(parts: FabricPart[], roll: FabricRollDefinition): FabricNestingResult {
    return this.run(parts, roll, 'PRODUCTION');
  }

  private run(
    parts: FabricPart[],
    roll: FabricRollDefinition,
    mode: 'ESTIMATION' | 'PRODUCTION',
  ): FabricNestingResult {
    if (parts.length === 0) {
      return {
        bays: [],
        summary: this.emptySummary(roll),
      };
    }

    // Convert fabric parts into the existing optimizer's Panel format.
    // The roll's "across-roll" axis (rollWidth) becomes the panel WIDTH;
    // the "along-roll" axis (bayLength) becomes the panel LENGTH.
    // Panels are flattened by quantity so each cut gets its own placement.
    const panels: Panel[] = [];
    const sourceById = new Map<string, FabricPart>();
    for (const part of parts) {
      sourceById.set(part.id, part);
      for (let i = 0; i < part.quantity; i++) {
        panels.push({
          id: part.quantity > 1 ? `${part.id}-${i + 1}` : part.id,
          label: part.partName,
          material: roll.materialName,
          // Fabric has no thickness in the geometric sense — set to 1 so
          // the optimizer's group-by-(material, thickness) keys cleanly.
          thickness: 1,
          length: part.length,
          width: part.width,
          quantity: 1,
          grain: roll.allowRotation ? 0 : 1,
        });
      }
    }

    // Floor the nesting bay length so no part is silently dropped by
    // the bbox optimizer (which rejects panels exceeding the stock).
    // The configured defaultBayLength acts as a *preferred* size; we
    // grow it when needed to fit the longest part, then trim each bay
    // back down to its actual occupied length post-nest.
    const nestingBayLength = Math.max(
      roll.defaultBayLength,
      this.computeMinRequiredBayLength(parts, roll),
    );

    // Cost-per-bay is provisional here — the optimizer needs *some*
    // value to surface, but real cost is computed below from trimmed
    // bay lengths and costPerLinearMeter.
    const costPerBay = roll.costPerLinearMeter * (nestingBayLength / 1000);

    const stockSheets = {
      [roll.materialName]: {
        material: roll.materialName,
        length: nestingBayLength,      // bayLength = "sheet length"
        width: roll.rollWidth,         // rollWidth = "sheet width"
        thickness: 1,
        cost: costPerBay,
      },
    };

    const result = this.optimizer.optimize(panels, {
      mode,
      stockSheets,
    });

    // result.sheets is empty in ESTIMATION mode of the upstream optimizer
    // (counts only). Synthesize bays from sheetsByMaterial in that case.
    const sheets = result.sheets.length > 0
      ? result.sheets
      : this.synthesizeEstimationLayouts(result.totalSheets, roll, panels, nestingBayLength);

    const bays: FabricBay[] = sheets.map((sheet, idx) =>
      this.toFabricBay(sheet, idx, roll, sourceById, nestingBayLength),
    );

    const partsOnRoll = bays.reduce((sum, b) => sum + b.placements.length, 0);
    const totalLinearMetersConsumed =
      bays.reduce((sum, b) => sum + b.bayLength, 0) / 1000;

    const utilizationPercents = bays
      .map(b => b.utilizationPercent)
      .filter(u => u > 0);
    const avgUtilization = utilizationPercents.length > 0
      ? utilizationPercents.reduce((a, b) => a + b, 0) / utilizationPercents.length
      : 0;

    // Report the largest trimmed bay length on the summary so consumers
    // see the effective cut size rather than the configured default.
    const effectiveBayLength = bays.length > 0
      ? Math.max(...bays.map(b => b.bayLength))
      : roll.defaultBayLength;

    const summary: FabricSummary = {
      materialId: roll.materialId,
      materialName: roll.materialName,
      rollWidth: roll.rollWidth,
      bayLength: effectiveBayLength,
      baysRequired: bays.length,
      totalLinearMetersConsumed,
      partsOnRoll,
      averageUtilizationPercent: avgUtilization,
      estimatedCost: Math.round(totalLinearMetersConsumed * roll.costPerLinearMeter),
    };

    return { bays, summary };
  }

  /**
   * Smallest bay length that lets every part fit into a bay of this roll.
   *
   * Axis convention (matches OptimizationService.packSingleSheet):
   *   stock.length ↔ bay length (along-roll, horizontal)
   *   stock.width  ↔ roll width (across-roll, vertical)
   *   panel.width  is laid along stock.length
   *   panel.length is laid along stock.width
   *
   * So unrotated, a part needs `bayLength >= part.width`. When rotation
   * is allowed, the part can swap axes; we still need *some* dimension
   * to fit the across-roll direction. If a part is too wide for the
   * roll itself, it can never fit and we ignore it for the floor (the
   * caller will see it as unplaced).
   */
  private computeMinRequiredBayLength(
    parts: FabricPart[],
    roll: FabricRollDefinition,
  ): number {
    let minRequired = 0;
    for (const part of parts) {
      if (part.quantity <= 0) continue;
      if (roll.allowRotation) {
        const longSide = Math.max(part.length, part.width);
        const shortSide = Math.min(part.length, part.width);
        if (shortSide > roll.rollWidth) continue; // un-fittable either way
        if (longSide > roll.rollWidth) {
          // Long side cannot lie across the roll — must run along the bay.
          minRequired = Math.max(minRequired, longSide);
        } else {
          // Either orientation works; the smaller demand on bayLength wins.
          minRequired = Math.max(minRequired, shortSide);
        }
      } else {
        // Grain locked: part.width runs along the bay.
        minRequired = Math.max(minRequired, part.width);
      }
    }
    return minRequired;
  }

  /**
   * Round bay length up to a 100mm cut increment — keeps cuts physically
   * realistic for a tape-and-shears cut while still trimming the long
   * tail of empty roll past the last placed part.
   */
  private static readonly BAY_CUT_INCREMENT_MM = 100;

  private toFabricBay(
    sheet: SheetLayout,
    index: number,
    roll: FabricRollDefinition,
    sourceById: Map<string, FabricPart>,
    nestingBayLength: number,
  ): FabricBay {
    const placements: FabricPlacement[] = sheet.placements.map(p => {
      // Resolve back to source part. Quantity-expanded ids look like
      // "<base>-<n>"; strip one trailing -<digits> and try again.
      const panelId = p.panel.id || '';
      let source = sourceById.get(panelId);
      if (!source) {
        const m = panelId.match(/^(.*)-(\d+)$/);
        if (m) source = sourceById.get(m[1]);
      }
      return {
        partId: panelId || source?.id || `fab-${index}`,
        partName: p.label,
        partNumber: source?.partNumber,
        designItemId: source?.designItemId ?? '',
        designItemName: source?.designItemName ?? '',
        x: p.x,
        y: p.y,
        // Placement width/height already account for rotation.
        length: p.width,
        width: p.height,
        rotated: p.rotated,
        ...(source?.polygon ? { polygon: source.polygon } : {}),
      };
    });

    // Trim the bay to its actual occupied length so the cut aligns with
    // the parts and doesn't waste roll past the last placement. Floor at
    // the configured default to keep tiny bays from looking unrealistic
    // (e.g. one small remainder part), and cap at the nesting size.
    const occupiedExtent = placements.reduce(
      (max, pl) => Math.max(max, pl.x + pl.length),
      0,
    );
    const increment = FabricOptimizationService.BAY_CUT_INCREMENT_MM;
    const trimmedExtent = occupiedExtent > 0
      ? Math.ceil(occupiedExtent / increment) * increment
      : nestingBayLength;
    const bayLength = Math.min(
      nestingBayLength,
      Math.max(roll.defaultBayLength, trimmedExtent),
    );

    // Clip waste regions to the trimmed bay extent — anything past the
    // cut isn't waste, it stays on the roll.
    const wasteRegions: WasteRegion[] = (sheet.wasteRegions ?? [])
      .map(r => {
        const clippedW = Math.min(r.width, Math.max(0, bayLength - r.x));
        return { ...r, width: clippedW };
      })
      .filter(r => r.width >= 50 && r.height >= 50)
      .map(r => ({
        x: r.x,
        y: r.y,
        length: r.width,
        width: r.height,
        area: r.width * r.height,
        reusable: r.width >= 200 && r.height >= 200,
      }));

    // Recompute utilization against the trimmed bay area so the
    // percentage reflects what actually got used vs. what was cut.
    const usedArea = placements.reduce(
      (sum, pl) => sum + pl.length * pl.width,
      0,
    );
    const trimmedArea = bayLength * roll.rollWidth;
    const utilizationPercent = trimmedArea > 0
      ? Math.min(100, (usedArea / trimmedArea) * 100)
      : sheet.utilization;

    return {
      id: sheet.id || `${roll.materialId}-bay-${index}`,
      bayIndex: index,
      materialId: roll.materialId,
      materialName: roll.materialName,
      rollWidth: roll.rollWidth,
      bayLength,
      placements,
      utilizationPercent,
      ...(wasteRegions.length > 0 ? { wasteRegions } : {}),
    };
  }

  /**
   * Estimation mode of OptimizationService returns `sheets: []` — we get
   * counts, not layouts. Synthesize one placeholder sheet per bay so the
   * caller still gets a valid FabricBay array (without placements).
   * This is purely defensive; in practice we now run the layout-aware
   * estimation path, but kept for safety.
   */
  private synthesizeEstimationLayouts(
    bayCount: number,
    roll: FabricRollDefinition,
    panels: Panel[],
    nestingBayLength: number,
  ): SheetLayout[] {
    const stockArea = roll.rollWidth * nestingBayLength;
    const totalPanelArea = panels.reduce((sum, p) => sum + (p.length * p.width), 0);
    const utilization =
      bayCount > 0 ? Math.min(100, (totalPanelArea / (bayCount * stockArea)) * 100) : 0;

    const synthetic: SheetLayout[] = [];
    for (let i = 0; i < bayCount; i++) {
      synthetic.push({
        id: `${roll.materialId}-bay-${i}`,
        sheetNumber: i + 1,
        material: roll.materialName,
        thickness: 1,
        stockSheet: {
          material: roll.materialName,
          length: nestingBayLength,
          width: roll.rollWidth,
          thickness: 1,
        },
        width: nestingBayLength,
        height: roll.rollWidth,
        placements: [],
        usedArea: 0,
        wastedArea: stockArea,
        utilization,
        wasteRegions: [],
      });
    }
    return synthetic;
  }

  private emptySummary(roll: FabricRollDefinition): FabricSummary {
    return {
      materialId: roll.materialId,
      materialName: roll.materialName,
      rollWidth: roll.rollWidth,
      bayLength: roll.defaultBayLength,
      baysRequired: 0,
      totalLinearMetersConsumed: 0,
      partsOnRoll: 0,
      averageUtilizationPercent: 0,
      estimatedCost: 0,
    };
  }
}

export const fabricOptimizationService = new FabricOptimizationService();
