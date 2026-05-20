/**
 * Timber Optimization Service
 *
 * Implements 1D cutting stock optimization for dimensional lumber with varying cross-sections.
 * Uses First Fit Decreasing (FFD) algorithm for linear cutting optimization.
 *
 * Enhanced with:
 * - Planing allowance for rough-sawn timber (raw dimensions → finished dimensions)
 * - Quick FFD estimation (replaces blanket 70% assumption)
 * - Offcut library integration (use existing remnants before new stock)
 * - Processing cost hooks for downstream costing
 */

import type {
  TimberStockDefinition,
  LinearCuttingResult,
  LinearCutPlacement,
  LinearWasteSegment,
  TimberSummary,
  TimberStickOperation,
  TimberStockChoiceRationale,
} from '../../types/project';
import { calculatePlaningDimensions } from './ProcessingCostService';

// ============================================
// Types
// ============================================

export interface TimberPart {
  partId: string;
  partName: string;
  designItemId: string;
  designItemName: string;
  length: number;           // Required length in mm (finished)
  width: number;            // Required width in mm (finished)
  thickness: number;        // Required thickness in mm (finished)
  quantity: number;
  materialName: string;
  hasCNCOperations?: boolean;
}

interface CrossSectionGroup {
  thickness: number;
  width: number;
  parts: TimberPart[];
  matchedStock: TimberStockDefinition | null;
  rippedFromStock: TimberStockDefinition | null;  // If need to rip from wider stock
  /** Raw cross-section needed (accounts for planing allowance if stock is rough-sawn) */
  rawThickness?: number;
  rawWidth?: number;
  /** How the chosen stock will be processed into the finished cross-section. */
  choice?: TimberStockChoiceRationale;
}

/**
 * Candidate stock option considered during matching. The scorer ranks these
 * by wasted volume per finished strip so we can pick the option that
 * minimises plane/rip waste rather than just the first match.
 */
interface StockCandidate {
  stock: TimberStockDefinition;
  mode: TimberStockChoiceRationale['mode'];
  /** Raw (pre-planing) dimensions needed per finished strip. */
  rawThickness: number;
  rawWidth: number;
  stripsPerBoard: number;
  /** Stock volume per linear metre minus useful volume per linear metre, normalised. */
  wasteRatio: number;
  /** Tie-breaker — fewer ops is preferred when waste ratios are close. */
  operationCount: number;
}

interface OpenStick {
  stockLength: number;
  remainingLength: number;
  cuts: LinearCutPlacement[];
  wasteSegments: LinearWasteSegment[];
  /** If this stick is from the offcut library */
  offcutId?: string;
}

/**
 * Available offcuts passed into the optimizer for reuse.
 */
export interface AvailableOffcut {
  offcutId: string;
  length: number;           // mm
  crossSection: { thickness: number; width: number };
  materialName: string;
  costSaved: number;        // Cost that would be saved by using this instead of new stock
}

// ============================================
// Timber Optimization Service
// ============================================

export class TimberOptimizationService {
  private kerf: number;                    // Saw kerf in mm (default 4mm)
  private minimumUsableOffcut: number;     // Minimum reusable length (default 300mm)
  private planingAllowance: number;        // mm removed per side when planing (default 3mm)

  constructor(
    kerf: number = 4,
    minimumUsableOffcut: number = 300,
    planingAllowance: number = 3
  ) {
    this.kerf = kerf;
    this.minimumUsableOffcut = minimumUsableOffcut;
    this.planingAllowance = planingAllowance;
  }

  /**
   * Run estimation for timber materials using quick FFD simulation.
   * Replaces the old blanket 70% utilization assumption with actual optimization
   * for more accurate stock requirements and cost estimates.
   */
  public async estimateTimber(
    parts: TimberPart[],
    timberStock: TimberStockDefinition[],
    availableOffcuts?: AvailableOffcut[],
    costBuffer: number = 1.10,
    warnings?: string[]
  ): Promise<TimberSummary[]> {
    // Group parts by cross-section
    const groups = this.groupByCrossSection(parts);

    // Match each group to available stock (with planing allowance)
    const matchedGroups = this.matchStockToCrossSections(groups, timberStock);

    const summaries: TimberSummary[] = [];

    for (const group of matchedGroups) {
      if (!group.matchedStock && !group.rippedFromStock) {
        console.warn(`No matching stock for ${group.thickness}×${group.width}mm`);
        continue;
      }

      const stock = group.matchedStock || group.rippedFromStock!;

      // Filter offcuts matching this cross-section group
      const groupOffcuts = availableOffcuts?.filter(o =>
        o.materialName === stock.materialName &&
        o.crossSection.thickness >= group.thickness &&
        o.crossSection.width >= group.width
      ) || [];

      // Run quick FFD to get accurate stick count (instead of 70% assumption)
      const ffdResult = this.runQuickFFD(group.parts, stock, groupOffcuts);

      const totalLinearMeters = (ffdResult.totalStockLength) / 1000;

      // Calculate cost — volumetric (m³) takes priority, then linear, then per-piece
      let estimatedCost = 0;
      let pricingMethod: 'linear' | 'volumetric' | 'per-piece' = 'linear';

      // Volume of stock consumed: nominal cross-section × total length
      const volumeCubicMeters =
        (stock.thickness / 1000) * (stock.width / 1000) * (ffdResult.totalStockLength / 1000);

      if (stock.costPerCubicMeter) {
        estimatedCost = volumeCubicMeters * stock.costPerCubicMeter;
        pricingMethod = 'volumetric';
      } else if (stock.costPerLinearMeter) {
        estimatedCost = totalLinearMeters * stock.costPerLinearMeter;
        pricingMethod = 'linear';
      } else if (stock.costPerPiece && stock.costPerPiece.length > 0) {
        // Sum cost per stick based on actual lengths used
        for (const stickLength of ffdResult.stickLengths) {
          const matchingCost = stock.costPerPiece.find(c => c.length === stickLength);
          estimatedCost += matchingCost?.cost || 0;
        }
        pricingMethod = 'per-piece';
      } else {
        // No pricing configured anywhere — estimation will report 0 cost for this group.
        // Surface this loudly so the user knows their quote is missing money for it.
        warnings?.push(
          `Timber material "${stock.materialName}" (${group.thickness}×${group.width}mm) has no pricing configured ` +
          `(no costPerCubicMeter / costPerLinearMeter / costPerPiece on the timber stock definition) — ` +
          `estimated cost for this material is 0. Add pricing to the material palette before quoting.`
        );
      }

      // Subtract savings from offcuts used
      estimatedCost -= ffdResult.offcutSavings;

      // Apply cost buffer from pricing assumptions
      estimatedCost *= costBuffer;

      const totalParts = group.parts.reduce((sum, part) => sum + part.quantity, 0);

      const summary: TimberSummary = {
        materialId: stock.materialId,
        materialName: stock.materialName,
        crossSection: {
          thickness: group.thickness,
          width: group.width,
        },
        stockLength: ffdResult.stickLengths.length > 0
          ? ffdResult.stickLengths[0]  // Most common length
          : Math.max(...stock.availableLengths),
        sticksRequired: ffdResult.newSticksOpened,
        totalLinearMeters,
        totalVolumeCubicMeters: volumeCubicMeters,
        pricingMethod,
        partsOnSticks: totalParts,
        averageUtilizationPercent: ffdResult.averageUtilization,
        totalWasteLength: ffdResult.totalWasteLength,
        estimatedCost: Math.max(0, Math.round(estimatedCost)),
      };

      // Add raw cross-section if stock is rough-sawn
      if (!stock.isDressed) {
        summary.rawCrossSection = {
          thickness: group.rawThickness || group.thickness + (2 * this.planingAllowance),
          width: group.rawWidth || group.width + (2 * this.planingAllowance),
        };
      }

      // Track offcut usage
      if (ffdResult.offcutsUsedCount > 0) {
        summary.offcutsUsed = ffdResult.offcutsUsedCount;
      }

      // Surface the nester's stock-selection rationale + per-stick operations.
      if (group.choice) {
        summary.stockChoice = group.choice;
        const hasRouting = group.parts.some(p => p.hasCNCOperations);
        // Aggregate ops for the estimation pass: one op sequence per new stick
        // opened. Stick length mirrors the most-common length FFD reached for,
        // which is what the shop will actually see.
        const opsPerStick: TimberStickOperation[][] = ffdResult.stickLengths.map(len =>
          buildStickOperations(group.choice!, len, 0, hasRouting),
        );
        if (opsPerStick.length > 0) {
          summary.operationsPerStick = opsPerStick;
        }
      }

      summaries.push(summary);
    }

    return summaries;
  }

  /**
   * Run production optimization for timber materials (full FFD algorithm).
   * Enhanced with offcut integration and planing-aware stock matching.
   */
  public async optimizeTimber(
    parts: TimberPart[],
    timberStock: TimberStockDefinition[],
    _targetYield: number = 85,
    availableOffcuts?: AvailableOffcut[]
  ): Promise<LinearCuttingResult[]> {
    // Group parts by cross-section
    const groups = this.groupByCrossSection(parts);

    // Match each group to available stock (with planing allowance)
    const matchedGroups = this.matchStockToCrossSections(groups, timberStock);

    const allResults: LinearCuttingResult[] = [];

    for (const group of matchedGroups) {
      if (!group.matchedStock && !group.rippedFromStock) {
        console.warn(`No matching stock for ${group.thickness}×${group.width}mm`);
        continue;
      }

      const stock = group.matchedStock || group.rippedFromStock!;

      // Filter offcuts matching this cross-section group
      const groupOffcuts = availableOffcuts?.filter(o =>
        o.materialName === stock.materialName &&
        o.crossSection.thickness >= group.thickness &&
        o.crossSection.width >= group.width
      ) || [];

      const hasRouting = group.parts.some(p => p.hasCNCOperations);

      // Run FFD algorithm with offcut integration, then attach the ordered
      // plane/rip/crosscut/route operations to each emitted stick so the
      // shop traveler can drive work to the right machines in sequence.
      const results = this.runFFDOptimization(group.parts, stock, groupOffcuts);
      for (const result of results) {
        if (group.choice) {
          result.operations = buildStickOperations(
            group.choice,
            result.stockLength,
            result.cuts.length,
            hasRouting,
          );
        }
      }
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * Group parts by cross-section (thickness × width)
   */
  private groupByCrossSection(parts: TimberPart[]): CrossSectionGroup[] {
    const groupMap = new Map<string, CrossSectionGroup>();

    for (const part of parts) {
      const key = `${part.thickness}×${part.width}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          thickness: part.thickness,
          width: part.width,
          parts: [],
          matchedStock: null,
          rippedFromStock: null,
        });
      }

      groupMap.get(key)!.parts.push(part);
    }

    return Array.from(groupMap.values());
  }

  /**
   * Match cross-section groups to available timber stock.
   *
   * Strategy — favour the stock whose *finished* cross-section sits closest
   * to the part's required cross-section so the shop plane/rips as little
   * material off as possible. We enumerate every viable stock option
   * (direct PAR, rough-sawn with planing, and ripping a wider board into
   * multiple strips) and score each by waste ratio. Lower score wins; when
   * scores are close the option requiring fewer machine setups is preferred.
   */
  private matchStockToCrossSections(
    groups: CrossSectionGroup[],
    timberStock: TimberStockDefinition[]
  ): CrossSectionGroup[] {
    for (const group of groups) {
      const { rawThickness, rawWidth } = calculatePlaningDimensions(
        group.thickness,
        group.width,
        this.planingAllowance,
      );
      group.rawThickness = rawThickness;
      group.rawWidth = rawWidth;

      const candidates = this.enumerateStockCandidates(group, timberStock);
      if (candidates.length === 0) continue;

      // Rank: lowest waste wins; tie-break with fewer operations,
      // then with smaller stock width (prefer tighter-fitting board).
      candidates.sort((a, b) => {
        if (Math.abs(a.wasteRatio - b.wasteRatio) > 0.01) {
          return a.wasteRatio - b.wasteRatio;
        }
        if (a.operationCount !== b.operationCount) {
          return a.operationCount - b.operationCount;
        }
        return a.stock.width - b.stock.width;
      });

      const best = candidates[0];
      const requiresRipping = best.mode === 'rip_only' || best.mode === 'rip_and_plane';

      if (requiresRipping) {
        group.rippedFromStock = best.stock;
      } else {
        group.matchedStock = best.stock;
      }

      group.choice = {
        mode: best.mode,
        stripsPerBoard: best.stripsPerBoard,
        wasteRatio: Math.round(best.wasteRatio * 1000) / 1000,
        rationale: describeMode(best, group),
      };
    }

    return groups;
  }

  /**
   * Enumerate every viable way each stock SKU could be processed into the
   * group's finished cross-section, along with a waste-ratio score that
   * makes options comparable on a single axis.
   */
  private enumerateStockCandidates(
    group: CrossSectionGroup,
    timberStock: TimberStockDefinition[],
  ): StockCandidate[] {
    const candidates: StockCandidate[] = [];
    const finishedArea = group.thickness * group.width;

    // How much extra per side is needed when the board will be planed.
    const planeAllowance = 2 * this.planingAllowance;

    for (const stock of timberStock) {
      // Required raw strip size inside the stock, given whether the stock
      // will be planed during processing.
      const needThickness = stock.isDressed ? group.thickness : group.thickness + planeAllowance;
      const needWidth = stock.isDressed ? group.width : group.width + planeAllowance;

      if (stock.thickness < needThickness) continue;
      if (stock.width < needWidth) continue;

      const stockArea = stock.thickness * stock.width;

      // ── Direct match (no rip) ───────────────────────────────────────
      if (stock.isDressed &&
          stock.thickness === group.thickness &&
          stock.width === group.width) {
        candidates.push({
          stock,
          mode: 'par_exact',
          rawThickness: group.thickness,
          rawWidth: group.width,
          stripsPerBoard: 1,
          wasteRatio: 0,
          operationCount: 1,     // crosscut only
        });
        continue; // can't do better than exact
      }

      // ── Plane-only (no rip) ────────────────────────────────────────
      // Useful when we don't want to fan out the stock into multiple strips.
      const singleStripWaste = (stockArea - finishedArea) / stockArea;
      candidates.push({
        stock,
        mode: stock.isDressed ? 'par_plane' : 'rough_plane',
        rawThickness: needThickness,
        rawWidth: needWidth,
        stripsPerBoard: 1,
        wasteRatio: singleStripWaste,
        operationCount: stock.isDressed ? 2 : 2, // plane (if rough) / skip / crosscut
      });

      // ── Rip into multiple strips ──────────────────────────────────
      // Only applicable when stock permits ripping and is wide enough for >= 2 strips.
      if (stock.canBeRipped) {
        // One kerf between strips, so total width consumed = n*stripWidth + (n-1)*kerf
        const maxStrips = Math.floor((stock.width + this.kerf) / (needWidth + this.kerf));
        if (maxStrips >= 2) {
          const usedWidth = maxStrips * needWidth + (maxStrips - 1) * this.kerf;
          // Useful finished area = n × finished strip area (thickness may still
          // need planing on rough stock, but volume is per strip).
          const usefulArea = maxStrips * finishedArea;
          const wasteRatio = 1 - usefulArea / stockArea;
          // Favour narrower stock when two options yield the same strip count.
          candidates.push({
            stock,
            mode: stock.isDressed ? 'rip_only' : 'rip_and_plane',
            rawThickness: needThickness,
            rawWidth: needWidth,
            stripsPerBoard: maxStrips,
            wasteRatio,
            operationCount: stock.isDressed ? 2 : 3, // rip + crosscut (+ plane if rough)
          });
          // Mark unused variable `usedWidth` for readability
          void usedWidth;
        }
      }
    }

    return candidates;
  }

  /**
   * Quick FFD simulation for estimation.
   * Runs a lightweight version of the full FFD to get accurate stick counts
   * without full tracking overhead. Returns aggregate stats only.
   */
  private runQuickFFD(
    parts: TimberPart[],
    stock: TimberStockDefinition,
    offcuts: AvailableOffcut[]
  ): {
    newSticksOpened: number;
    totalStockLength: number;
    stickLengths: number[];
    averageUtilization: number;
    totalWasteLength: number;
    offcutsUsedCount: number;
    offcutSavings: number;
  } {
    // Expand parts by quantity
    const expandedParts: TimberPart[] = [];
    for (const part of parts) {
      for (let i = 0; i < part.quantity; i++) {
        expandedParts.push({ ...part, quantity: 1 });
      }
    }

    // Sort parts by length (descending) - FFD requires this
    const sortedParts = expandedParts.sort((a, b) => b.length - a.length);

    // Available stock lengths (sorted shortest to longest)
    const stockLengths = [...stock.availableLengths].sort((a, b) => a - b);

    // Convert offcuts to open sticks
    const openSticks: { length: number; remaining: number; isOffcut: boolean; offcutSaving: number }[] = [];
    let offcutsUsedCount = 0;
    let offcutSavings = 0;

    // Add offcuts as pre-opened sticks
    for (const offcut of offcuts) {
      openSticks.push({
        length: offcut.length,
        remaining: offcut.length,
        isOffcut: true,
        offcutSaving: offcut.costSaved,
      });
    }

    let newSticksOpened = 0;

    // FFD: For each part, try offcuts first, then existing sticks, then new stock
    for (const part of sortedParts) {
      const requiredLength = part.length + this.kerf;
      let placed = false;

      // Try to fit in existing open sticks (offcuts first, then new stock)
      for (const stick of openSticks) {
        if (stick.remaining >= requiredLength) {
          stick.remaining -= requiredLength;
          placed = true;
          if (stick.isOffcut && stick.offcutSaving > 0) {
            offcutsUsedCount++;
            offcutSavings += stick.offcutSaving;
            stick.offcutSaving = 0; // Only count saving once per offcut
          }
          break;
        }
      }

      if (!placed) {
        const suitableStockLength = stockLengths.find(len => len >= requiredLength);
        if (suitableStockLength) {
          openSticks.push({
            length: suitableStockLength,
            remaining: suitableStockLength - requiredLength,
            isOffcut: false,
            offcutSaving: 0,
          });
          newSticksOpened++;
        }
      }
    }

    // Calculate statistics
    const newSticks = openSticks.filter(s => !s.isOffcut);
    const totalStockLength = newSticks.reduce((sum, s) => sum + s.length, 0);
    const totalWaste = newSticks.reduce((sum, s) => sum + s.remaining, 0);
    const totalUsed = totalStockLength - totalWaste;
    const averageUtilization = totalStockLength > 0
      ? (totalUsed / totalStockLength) * 100
      : 0;

    return {
      newSticksOpened,
      totalStockLength,
      stickLengths: newSticks.map(s => s.length),
      averageUtilization: Math.round(averageUtilization * 10) / 10,
      totalWasteLength: totalWaste,
      offcutsUsedCount,
      offcutSavings,
    };
  }

  /**
   * Run First Fit Decreasing (FFD) algorithm for linear cutting.
   * Enhanced with offcut integration: tries to place parts on available
   * offcuts before opening new stock sticks.
   */
  private runFFDOptimization(
    parts: TimberPart[],
    stock: TimberStockDefinition,
    offcuts: AvailableOffcut[] = []
  ): LinearCuttingResult[] {
    // Expand parts by quantity (each quantity becomes individual part)
    const expandedParts: TimberPart[] = [];
    for (const part of parts) {
      for (let i = 0; i < part.quantity; i++) {
        expandedParts.push({ ...part, quantity: 1 });
      }
    }

    // Sort parts by length (descending) - FFD requires this
    const sortedParts = expandedParts.sort((a, b) => b.length - a.length);

    // Available stock lengths (sorted from shortest to longest for efficiency)
    const stockLengths = [...stock.availableLengths].sort((a, b) => a - b);

    // Open sticks (tracks remaining space on each stick)
    const openSticks: OpenStick[] = [];

    // Add offcuts as pre-opened sticks (try to use these first)
    for (const offcut of offcuts) {
      openSticks.push({
        stockLength: offcut.length,
        remainingLength: offcut.length,
        cuts: [],
        wasteSegments: [],
        offcutId: offcut.offcutId,
      });
    }

    let stockIndex = 0;

    // FFD algorithm: For each part, try to fit in existing open sticks
    for (const part of sortedParts) {
      const requiredLength = part.length + this.kerf; // Include kerf
      let placed = false;

      // Try to fit in existing open sticks (First Fit)
      for (const stick of openSticks) {
        if (stick.remainingLength >= requiredLength) {
          // Place part on this stick
          const startPosition = stick.stockLength - stick.remainingLength;

          stick.cuts.push({
            partId: part.partId,
            partName: part.partName,
            designItemId: part.designItemId,
            designItemName: part.designItemName,
            startPosition,
            cutLength: part.length,
            quantity: 1,
          });

          stick.remainingLength -= requiredLength;
          placed = true;
          break;
        }
      }

      // If not placed, open new stick (use shortest stock length that fits)
      if (!placed) {
        const suitableStockLength = stockLengths.find(len => len >= requiredLength);

        if (!suitableStockLength) {
          console.error(`Part ${part.partId} (${part.length}mm) too long for available stock`);
          continue;
        }

        const startPosition = 0;

        openSticks.push({
          stockLength: suitableStockLength,
          remainingLength: suitableStockLength - requiredLength,
          cuts: [{
            partId: part.partId,
            partName: part.partName,
            designItemId: part.designItemId,
            designItemName: part.designItemName,
            startPosition,
            cutLength: part.length,
            quantity: 1,
          }],
          wasteSegments: [],
        });

        stockIndex++;
      }
    }

    // Convert open sticks to results (skip empty offcut sticks that weren't used)
    const usedSticks = openSticks.filter(
      stick => stick.cuts.length > 0
    );

    const results: LinearCuttingResult[] = usedSticks.map((stick, index) => {
      const usedLength = stick.stockLength - stick.remainingLength;
      const utilizationPercent = (usedLength / stick.stockLength) * 100;

      // Calculate waste segments
      const wasteSegments: LinearWasteSegment[] = [];
      if (stick.remainingLength > 0) {
        const wasteStart = stick.stockLength - stick.remainingLength;
        wasteSegments.push({
          startPosition: wasteStart,
          length: stick.remainingLength,
          reusable: stick.remainingLength >= this.minimumUsableOffcut,
        });
      }

      return {
        id: `timber-${stock.materialId}-${index}`,
        stockIndex: index,
        stockId: stick.offcutId || stock.id,
        materialId: stock.materialId,
        materialName: stock.materialName,
        crossSection: {
          thickness: stock.thickness,
          width: stock.width,
        },
        stockLength: stick.stockLength,
        cuts: stick.cuts,
        utilizationPercent,
        wasteLength: stick.remainingLength,
        wasteSegments,
        ...(stick.offcutId ? { isOffcut: true, offcutId: stick.offcutId } : {}),
      };
    });

    return results;
  }
}

/**
 * Render a one-sentence explanation of the chosen stock processing mode
 * for the nesting-studio tooltip / rationale field.
 */
function describeMode(candidate: StockCandidate, group: CrossSectionGroup): string {
  const { stock, mode, stripsPerBoard, wasteRatio } = candidate;
  const wastePct = Math.round(wasteRatio * 100);
  const finished = `${group.thickness}×${group.width}mm`;
  const stockDesc = `${stock.thickness}×${stock.width}mm ${stock.isDressed ? 'PAR' : 'rough-sawn'}`;

  switch (mode) {
    case 'par_exact':
      return `Exact-size PAR stock — crosscut only.`;
    case 'par_plane':
      return `${stockDesc} planed down to finished ${finished}. ${wastePct}% material lost to planing.`;
    case 'rough_plane':
      return `${stockDesc} planed all sides to finished ${finished}. ${wastePct}% lost to planing.`;
    case 'rip_only':
      return `${stockDesc} ripped into ${stripsPerBoard} strips of ${finished}. ${wastePct}% waste.`;
    case 'rip_and_plane':
      return `${stockDesc} ripped into ${stripsPerBoard} strips then planed to finished ${finished}. ${wastePct}% waste.`;
  }
}

/**
 * Build the ordered operation list for one stick, given the chosen stock
 * processing mode and the cuts the FFD algorithm placed on it.
 */
export function buildStickOperations(
  choice: TimberStockChoiceRationale,
  stockLengthMm: number,
  cutCount: number,
  hasRouting: boolean,
): TimberStickOperation[] {
  const ops: TimberStickOperation[] = [];
  let seq = 1;
  const stockLengthM = stockLengthMm / 1000;

  // 1) Planing (rough-sawn or larger PAR reduced to finished)
  if (choice.mode === 'rough_plane' || choice.mode === 'par_plane' || choice.mode === 'rip_and_plane') {
    ops.push({
      sequence: seq++,
      stepId: 'planing',
      label: 'Plane to finished thickness/width',
      quantity: Math.round(stockLengthM * 100) / 100,
      unit: 'linear_meters',
      note: choice.mode === 'par_plane'
        ? 'Dress oversize PAR board down to finished cross-section'
        : 'Rough-sawn → dressed cross-section',
    });
  }

  // 2) Rip (split wide board into finished-width strips)
  if (choice.mode === 'rip_only' || choice.mode === 'rip_and_plane') {
    ops.push({
      sequence: seq++,
      stepId: 'rip',
      label: `Rip into ${choice.stripsPerBoard} strips`,
      quantity: Math.round(stockLengthM * (choice.stripsPerBoard - 1) * 100) / 100,
      unit: 'linear_meters',
      note: `${choice.stripsPerBoard - 1} rip pass${choice.stripsPerBoard - 1 === 1 ? '' : 'es'} down stock length`,
    });
  }

  // 3) Crosscut — always at least one per placed part to separate it from the stick
  if (cutCount > 0) {
    ops.push({
      sequence: seq++,
      stepId: 'crosscut',
      label: `Crosscut ${cutCount} part${cutCount === 1 ? '' : 's'} to length`,
      quantity: cutCount,
      unit: 'cuts',
    });
  }

  // 4) Routing (only if any part had CNC ops — caller already filtered)
  if (hasRouting) {
    ops.push({
      sequence: seq++,
      stepId: 'routing',
      label: 'Route profile / shape',
      quantity: Math.round(stockLengthM * 100) / 100,
      unit: 'linear_meters',
    });
  }

  return ops;
}

export default TimberOptimizationService;
