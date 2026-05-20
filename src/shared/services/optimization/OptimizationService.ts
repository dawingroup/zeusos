/**
 * Optimization Service
 * Shared cutting optimization service with PRODUCTION and ESTIMATION modes
 */

import type { EstimationMode } from '@/shared/types';

// ============================================
// Types
// ============================================

export interface Panel {
  id?: string;
  label: string;
  cabinet?: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  quantity: number;
  grain: number; // 0 = no grain, 1 = grain direction matters
}

export interface StockSheet {
  material: string;
  length: number;
  width: number;
  thickness: number;
  cost?: number;
}

export interface OptimizationOptions {
  mode: EstimationMode;
  bladeKerf?: number;
  stockSheets?: Record<string, StockSheet>;
}

export interface SheetLayout {
  id: string;
  sheetNumber: number;
  material: string;
  thickness: number;
  stockSheet: StockSheet;
  width: number;
  height: number;
  placements: PanelPlacement[];
  usedArea: number;
  wastedArea: number;
  utilization: number;
  wasteRegions?: { x: number; y: number; width: number; height: number }[];
}

export interface PanelPlacement {
  panel: Panel;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
}

export interface OptimizationResult {
  sheets: SheetLayout[];
  totalSheets: number;
  totalPanels: number;
  totalUsedArea: number;
  totalWastedArea: number;
  averageUtilization: number;
  sheetsByMaterial: Record<string, number>;
  estimatedMaterialCost?: number;
}

// ============================================
// Internal Types
// ============================================

/** Sort strategies for multi-pass optimization */
type SortStrategy = 'area-desc' | 'height-desc' | 'width-desc' | 'perimeter-desc' | 'aspect-ratio-desc';

/** Free rectangle on a sheet */
interface FreeRect { x: number; y: number; width: number; height: number; }

// ============================================
// Default Stock Sheets (Standard Sizes)
// ============================================

const DEFAULT_STOCK_SHEETS: Record<string, StockSheet> = {
  'MDF': { material: 'MDF', length: 2440, width: 1220, thickness: 18, cost: 85000 },
  'Plywood': { material: 'Plywood', length: 2440, width: 1220, thickness: 18, cost: 180000 },
  'Chipboard': { material: 'Chipboard', length: 2440, width: 1220, thickness: 18, cost: 65000 },
  'Melamine': { material: 'Melamine', length: 2440, width: 1220, thickness: 18, cost: 95000 },
  'default': { material: 'Default', length: 2440, width: 1220, thickness: 18, cost: 85000 },
};

// ============================================
// Optimization Service Class
// ============================================

export class OptimizationService {
  private stockSheets: Record<string, StockSheet>;
  private bladeKerf: number;

  constructor(options?: { stockSheets?: Record<string, StockSheet>; bladeKerf?: number }) {
    this.stockSheets = options?.stockSheets || DEFAULT_STOCK_SHEETS;
    this.bladeKerf = options?.bladeKerf || 4;
  }

  /**
   * Main optimization method
   * @param panels - Panels to optimize
   * @param options - Optimization options including mode
   */
  optimize(panels: Panel[], options: OptimizationOptions): OptimizationResult {
    if (!panels || panels.length === 0) {
      return this.emptyResult();
    }

    const stockSheets = options.stockSheets || this.stockSheets;
    const kerf = options.bladeKerf ?? this.bladeKerf;

    if (options.mode === 'ESTIMATION') {
      // Fast estimation mode - simplified calculation
      return this.estimationOptimize(panels, stockSheets);
    } else {
      // Full production mode - complete guillotine packing
      return this.productionOptimize(panels, stockSheets, kerf);
    }
  }

  /**
   * ESTIMATION mode - Quick packing simulation
   * Uses a simplified bin-packing pass to get accurate sheet counts
   * instead of the old blanket 70% utilization assumption.
   * This gives much better cost estimates (typically 80-90% utilization).
   */
  private estimationOptimize(
    panels: Panel[],
    stockSheets: Record<string, StockSheet>
  ): OptimizationResult {
    const grouped = this.groupByMaterialAndThickness(panels);
    let totalSheets = 0;
    let totalPanels = 0;
    let totalUsedArea = 0;
    let totalSheetArea = 0;
    let estimatedCost = 0;
    const sheetsByMaterial: Record<string, number> = {};
    const allSheets: SheetLayout[] = [];

    for (const [key, panelGroup] of Object.entries(grouped)) {
      const [material, thicknessStr] = key.split('|');
      const stock = this.findMatchingStock(stockSheets, material);

      if (!stock) continue;

      const stockArea = stock.length * stock.width;

      // Calculate total panel area for this group
      let groupArea = 0;
      for (const panel of panelGroup) {
        groupArea += panel.length * panel.width;
        totalPanels++;
      }

      // Quick packing simulation: run simplified FFD bin-packing
      // to get more accurate sheet counts than blanket 70%
      const { sheetCount, sheets } = this.quickPackEstimate(
        panelGroup,
        stock,
        material,
        parseFloat(thicknessStr) || 0,
        allSheets.length,
      );
      allSheets.push(...sheets);

      totalSheets += sheetCount;
      totalUsedArea += groupArea;
      totalSheetArea += sheetCount * stockArea;

      if (!sheetsByMaterial[material]) {
        sheetsByMaterial[material] = 0;
      }
      sheetsByMaterial[material] += sheetCount;

      // Calculate cost
      if (stock.cost) {
        estimatedCost += sheetCount * stock.cost;
      }
    }

    const totalWastedArea = totalSheetArea - totalUsedArea;

    return {
      // Estimation now produces visualizable per-sheet placements (parity
      // with production). Caller decides whether to surface them on
      // EstimationResult.nestingSheets or discard them.
      sheets: allSheets,
      totalSheets,
      totalPanels,
      totalUsedArea,
      totalWastedArea,
      averageUtilization: totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0,
      sheetsByMaterial,
      estimatedMaterialCost: estimatedCost,
    };
  }

  /**
   * Quick pack estimate: simplified bin-packing to count sheets needed.
   * Uses guillotineSplitSmart (same as production mode) with rectangle merging.
   *
   * Returns BOTH the sheet count AND per-sheet placements so estimation can
   * surface visualizable layouts (parity with production mode). Recording
   * placements adds negligible CPU since the algorithm already does the
   * placement work — we just remember where things went.
   */
  private quickPackEstimate(
    panels: Panel[],
    stock: StockSheet,
    material: string,
    thickness: number,
    startingSheetIndex: number,
  ): { sheetCount: number; sheets: SheetLayout[] } {
    if (panels.length === 0) return { sheetCount: 0, sheets: [] };

    const kerf = this.bladeKerf;

    // Sort panels by area (largest first)
    const sorted = [...panels].sort(
      (a, b) => (b.length * b.width) - (a.length * a.width)
    );

    let sheetsUsed = 0;
    let remaining = [...sorted];
    const sheets: SheetLayout[] = [];

    // Safety limit
    while (remaining.length > 0 && sheetsUsed < 200) {
      sheetsUsed++;

      // Track free rectangles on this sheet
      let freeRects: FreeRect[] = [{ x: 0, y: 0, width: stock.length, height: stock.width }];
      const notPlaced: Panel[] = [];
      const placements: PanelPlacement[] = [];
      let placedCount = 0;

      for (const panel of remaining) {
        let placed = false;

        for (let i = 0; i < freeRects.length; i++) {
          const rect = freeRects[i];

          // Try without rotation
          if (panel.width <= rect.width && panel.length <= rect.height) {
            placements.push({
              panel,
              x: rect.x,
              y: rect.y,
              width: panel.width,
              height: panel.length,
              rotated: false,
              label: panel.label ?? panel.id ?? '',
            });
            freeRects.splice(i, 1);
            const newRects = this.guillotineSplitSmart(rect, panel.width, panel.length, kerf);
            freeRects.push(...newRects);
            freeRects = this.mergeAdjacentRects(freeRects, kerf);
            freeRects.sort((a, b) => {
              const ca = a.x + a.y, cb = b.x + b.y;
              if (ca !== cb) return ca - cb;
              return (b.width * b.height) - (a.width * a.height);
            });
            placed = true;
            placedCount++;
            break;
          }

          // Try with rotation (if grain allows)
          if (panel.grain !== 1 && panel.length <= rect.width && panel.width <= rect.height) {
            placements.push({
              panel,
              x: rect.x,
              y: rect.y,
              width: panel.length,
              height: panel.width,
              rotated: true,
              label: panel.label ?? panel.id ?? '',
            });
            freeRects.splice(i, 1);
            const newRects = this.guillotineSplitSmart(rect, panel.length, panel.width, kerf);
            freeRects.push(...newRects);
            freeRects = this.mergeAdjacentRects(freeRects, kerf);
            freeRects.sort((a, b) => {
              const ca = a.x + a.y, cb = b.x + b.y;
              if (ca !== cb) return ca - cb;
              return (b.width * b.height) - (a.width * a.height);
            });
            placed = true;
            placedCount++;
            break;
          }
        }

        if (!placed) {
          notPlaced.push(panel);
        }
      }

      remaining = notPlaced;

      // If nothing was placed on this sheet, panels are too large
      if (placedCount === 0) {
        break;
      }

      // Build a SheetLayout record for this sheet so estimation can render layouts.
      const sheetIdx = startingSheetIndex + sheets.length;
      const usedArea = placements.reduce((sum, p) => sum + (p.width * p.height), 0);
      const stockArea = stock.length * stock.width;
      sheets.push({
        id: `est-sheet-${sheetIdx}`,
        sheetNumber: sheetIdx + 1,
        material,
        thickness,
        stockSheet: stock,
        width: stock.length,
        height: stock.width,
        placements,
        usedArea,
        wastedArea: Math.max(0, stockArea - usedArea),
        utilization: stockArea > 0 ? (usedArea / stockArea) * 100 : 0,
        // Surface remaining free rectangles as waste regions so the UI can
        // optionally render them. Filtering very-small slivers keeps the
        // visual readable.
        wasteRegions: freeRects
          .filter(r => r.width >= 50 && r.height >= 50)
          .map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
      });
    }

    return { sheetCount: sheetsUsed, sheets };
  }

  /**
   * PRODUCTION mode - Full guillotine bin-packing with multi-pass optimization.
   * Tries multiple sort strategies and packing methods, then consolidates sheets.
   */
  private productionOptimize(
    panels: Panel[],
    stockSheets: Record<string, StockSheet>,
    kerf: number
  ): OptimizationResult {
    const grouped = this.groupByMaterialAndThickness(panels);
    const results: SheetLayout[] = [];

    for (const [key, panelGroup] of Object.entries(grouped)) {
      const [material, thickness] = key.split('|');
      const stock = this.findMatchingStock(stockSheets, material);

      if (!stock) {
        console.warn(`No stock sheet found for material: ${material}`);
        continue;
      }

      // Multi-pass: try each sort strategy with guillotine packing
      const variants = this.generateSortedVariants(panelGroup);
      let bestSheets: SheetLayout[] | null = null;

      for (const { sorted, strategy } of variants) {
        const sheets = this.packAllSheets(sorted, stock, kerf, material, parseFloat(thickness), results.length, 'guillotine');
        const consolidated = this.consolidateSheets(sheets, stock, kerf);

        if (!bestSheets || consolidated.length < bestSheets.length) {
          bestSheets = consolidated;
        } else if (consolidated.length === bestSheets.length) {
          const avgUtil = consolidated.reduce((s, sh) => s + sh.utilization, 0) / consolidated.length;
          const bestUtil = bestSheets.reduce((s, sh) => s + sh.utilization, 0) / bestSheets.length;
          if (avgUtil > bestUtil) {
            bestSheets = consolidated;
          }
        }

        // Also try shelf packing for height-desc and width-desc (natural shelf strategies)
        if (strategy === 'height-desc' || strategy === 'width-desc') {
          const shelfSheets = this.packAllSheets(sorted, stock, kerf, material, parseFloat(thickness), results.length, 'shelf');
          const shelfConsolidated = this.consolidateSheets(shelfSheets, stock, kerf);

          if (!bestSheets || shelfConsolidated.length < bestSheets.length) {
            bestSheets = shelfConsolidated;
          } else if (shelfConsolidated.length === bestSheets.length) {
            const avgUtil = shelfConsolidated.reduce((s, sh) => s + sh.utilization, 0) / shelfConsolidated.length;
            const bestUtil = bestSheets.reduce((s, sh) => s + sh.utilization, 0) / bestSheets.length;
            if (avgUtil > bestUtil) {
              bestSheets = shelfConsolidated;
            }
          }
        }
      }

      if (bestSheets) {
        results.push(...bestSheets);
      }
    }

    return this.calculateStatistics(results, stockSheets);
  }

  /**
   * Generate multiple sorted copies of the panel list for multi-pass optimization.
   */
  private generateSortedVariants(panels: Panel[]): { sorted: Panel[]; strategy: SortStrategy }[] {
    const strategies: { strategy: SortStrategy; compareFn: (a: Panel, b: Panel) => number }[] = [
      {
        strategy: 'area-desc',
        compareFn: (a, b) => {
          const areaDiff = (b.length * b.width) - (a.length * a.width);
          if (Math.abs(areaDiff) > 10000) return areaDiff;
          const aspectA = Math.max(a.length, a.width) / Math.min(a.length, a.width);
          const aspectB = Math.max(b.length, b.width) / Math.min(b.length, b.width);
          return aspectB - aspectA;
        },
      },
      {
        strategy: 'height-desc',
        compareFn: (a, b) => {
          const hA = Math.max(a.length, a.width);
          const hB = Math.max(b.length, b.width);
          if (hB !== hA) return hB - hA;
          return (b.length * b.width) - (a.length * a.width);
        },
      },
      {
        strategy: 'width-desc',
        compareFn: (a, b) => {
          const wA = Math.min(a.length, a.width);
          const wB = Math.min(b.length, b.width);
          if (wB !== wA) return wB - wA;
          return (b.length * b.width) - (a.length * a.width);
        },
      },
      {
        strategy: 'perimeter-desc',
        compareFn: (a, b) => {
          const pA = 2 * (a.length + a.width);
          const pB = 2 * (b.length + b.width);
          if (pB !== pA) return pB - pA;
          return (b.length * b.width) - (a.length * a.width);
        },
      },
      {
        strategy: 'aspect-ratio-desc',
        compareFn: (a, b) => {
          const arA = Math.max(a.length, a.width) / Math.min(a.length, a.width);
          const arB = Math.max(b.length, b.width) / Math.min(b.length, b.width);
          if (Math.abs(arB - arA) > 0.5) return arB - arA;
          return (b.length * b.width) - (a.length * a.width);
        },
      },
    ];

    return strategies.map(({ strategy, compareFn }) => ({
      sorted: [...panels].sort(compareFn),
      strategy,
    }));
  }

  /**
   * Pack a list of panels across multiple sheets.
   * Extracted loop used by both multi-pass and consolidation.
   */
  private packAllSheets(
    sortedPanels: Panel[],
    stock: StockSheet,
    kerf: number,
    material: string,
    thickness: number,
    startingSheetIndex: number,
    packingMethod: 'guillotine' | 'shelf' = 'guillotine'
  ): SheetLayout[] {
    const sheets: SheetLayout[] = [];
    let remainingPanels = [...sortedPanels];
    let sheetIndex = 0;

    while (remainingPanels.length > 0 && sheetIndex < 100) {
      const packResult = packingMethod === 'shelf'
        ? this.packSingleSheetShelf(remainingPanels, stock, kerf)
        : this.packSingleSheet(remainingPanels, stock, kerf);

      if (packResult.placements.length === 0) {
        console.warn('Some panels are too large for the stock sheet');
        break;
      }

      const sheetWidth = stock.length;
      const sheetHeight = stock.width;
      const totalArea = sheetWidth * sheetHeight;

      sheets.push({
        id: `sheet-${startingSheetIndex + sheets.length + 1}`,
        sheetNumber: startingSheetIndex + sheets.length + 1,
        material,
        thickness,
        stockSheet: stock,
        width: sheetWidth,
        height: sheetHeight,
        placements: packResult.placements,
        usedArea: packResult.usedArea,
        wastedArea: totalArea - packResult.usedArea,
        utilization: (packResult.usedArea / totalArea) * 100,
        wasteRegions: packResult.freeRects,
      });

      remainingPanels = packResult.remaining;
      sheetIndex++;
    }

    return sheets;
  }

  /**
   * Post-packing consolidation: eliminate low-utilization sheets by
   * redistributing their panels to sheets with remaining capacity.
   * Re-packs entire target sheets to guarantee guillotine cut validity.
   */
  private consolidateSheets(
    sheets: SheetLayout[],
    stock: StockSheet,
    kerf: number
  ): SheetLayout[] {
    if (sheets.length <= 1) return sheets;

    const result = [...sheets];
    let improved = true;
    let round = 0;
    const MAX_ROUNDS = 10;

    while (improved && result.length > 1 && round < MAX_ROUNDS) {
      improved = false;
      round++;

      // Sort by utilization descending so worst sheet is last
      result.sort((a, b) => b.utilization - a.utilization);

      const worstSheet = result[result.length - 1];
      const panelsToRedistribute = worstSheet.placements.map(p => p.panel);

      // Skip if already well-utilized
      if (worstSheet.utilization > 85) break;

      const unplaced: Panel[] = [];

      for (const panel of panelsToRedistribute) {
        let placed = false;

        for (let si = 0; si < result.length - 1; si++) {
          const targetSheet = result[si];

          // Quick area check
          if (targetSheet.wastedArea < panel.length * panel.width) continue;

          // Re-pack the target sheet with existing panels + candidate
          const existingPanels = targetSheet.placements.map(p => p.panel);
          const testPanels = [...existingPanels, panel];
          const testResult = this.packSingleSheet(testPanels, stock, kerf);

          if (testResult.placements.length === testPanels.length) {
            const totalArea = stock.length * stock.width;
            result[si] = {
              ...targetSheet,
              placements: testResult.placements,
              usedArea: testResult.usedArea,
              wastedArea: totalArea - testResult.usedArea,
              utilization: (testResult.usedArea / totalArea) * 100,
              wasteRegions: testResult.freeRects,
            };
            placed = true;
            break;
          }
        }

        if (!placed) {
          unplaced.push(panel);
        }
      }

      if (unplaced.length === 0) {
        // All panels redistributed — remove the worst sheet
        result.pop();
        improved = true;
      } else if (unplaced.length < panelsToRedistribute.length) {
        // Partial success: re-pack remainder on the last sheet
        const repackResult = this.packSingleSheet(unplaced, stock, kerf);
        const totalArea = stock.length * stock.width;
        result[result.length - 1] = {
          ...worstSheet,
          placements: repackResult.placements,
          usedArea: repackResult.usedArea,
          wastedArea: totalArea - repackResult.usedArea,
          utilization: (repackResult.usedArea / totalArea) * 100,
          wasteRegions: repackResult.freeRects,
        };
        break;
      } else {
        break;
      }
    }

    // Re-number sheets sequentially
    result.forEach((sheet, idx) => {
      sheet.id = `sheet-${idx + 1}`;
      sheet.sheetNumber = idx + 1;
    });

    return result;
  }

  /**
   * Shelf-based packing for panel saws.
   * Packs panels into horizontal strips (shelves) — each shelf height
   * is determined by the tallest panel in it. All cuts are naturally
   * guillotine-valid: horizontal cuts between shelves (full width),
   * vertical cuts within each shelf (full shelf height).
   */
  private packSingleSheetShelf(
    panels: Panel[],
    stockSheet: StockSheet,
    kerf: number
  ): { placements: PanelPlacement[]; remaining: Panel[]; usedArea: number; freeRects: FreeRect[] } {
    const sheetWidth = stockSheet.length;
    const sheetHeight = stockSheet.width;
    const placements: PanelPlacement[] = [];
    const remaining: Panel[] = [];
    let usedArea = 0;

    interface ShelfState {
      y: number;
      height: number;
      usedWidth: number;
      placements: PanelPlacement[];
    }

    const shelves: ShelfState[] = [];
    let nextShelfY = 0;

    for (const panel of panels) {
      let placed = false;

      // Determine possible orientations
      const orientations: { w: number; h: number; rotated: boolean }[] = [
        { w: panel.width, h: panel.length, rotated: false },
      ];
      if (panel.grain !== 1) {
        orientations.push({ w: panel.length, h: panel.width, rotated: true });
      }

      // Try existing shelves (best-height-fit: minimize wasted shelf height)
      let bestShelfIdx = -1;
      let bestOrientation = orientations[0];
      let bestHeightWaste = Infinity;

      for (let si = 0; si < shelves.length; si++) {
        const shelf = shelves[si];
        for (const orient of orientations) {
          if (orient.h <= shelf.height && shelf.usedWidth + orient.w + kerf <= sheetWidth) {
            const heightWaste = shelf.height - orient.h;
            if (heightWaste < bestHeightWaste) {
              bestHeightWaste = heightWaste;
              bestShelfIdx = si;
              bestOrientation = orient;
            }
          }
        }
      }

      if (bestShelfIdx >= 0) {
        const shelf = shelves[bestShelfIdx];
        const xPos = shelf.usedWidth === 0 ? 0 : shelf.usedWidth + kerf;

        const placement: PanelPlacement = {
          panel,
          x: xPos,
          y: shelf.y,
          width: bestOrientation.w,
          height: bestOrientation.h,
          rotated: bestOrientation.rotated,
          label: panel.label || `Panel ${placements.length + 1}`,
        };
        placements.push(placement);
        shelf.placements.push(placement);
        shelf.usedWidth = xPos + bestOrientation.w;
        usedArea += bestOrientation.w * bestOrientation.h;
        placed = true;
      }

      if (!placed) {
        // Try opening a new shelf
        for (const orient of orientations) {
          const newShelfTop = nextShelfY + orient.h;

          if (newShelfTop <= sheetHeight && orient.w <= sheetWidth) {
            const shelf: ShelfState = {
              y: nextShelfY,
              height: orient.h,
              usedWidth: orient.w,
              placements: [],
            };

            const placement: PanelPlacement = {
              panel,
              x: 0,
              y: nextShelfY,
              width: orient.w,
              height: orient.h,
              rotated: orient.rotated,
              label: panel.label || `Panel ${placements.length + 1}`,
            };
            placements.push(placement);
            shelf.placements.push(placement);
            shelves.push(shelf);
            nextShelfY = newShelfTop + kerf;
            usedArea += orient.w * orient.h;
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        remaining.push(panel);
      }
    }

    // Calculate free rects (waste regions) from the shelf structure
    const freeRects: FreeRect[] = [];
    for (const shelf of shelves) {
      const rightWasteWidth = sheetWidth - shelf.usedWidth - kerf;
      if (rightWasteWidth > 50) {
        freeRects.push({
          x: shelf.usedWidth + kerf,
          y: shelf.y,
          width: rightWasteWidth,
          height: shelf.height,
        });
      }
    }
    // Top waste above all shelves
    const topWasteHeight = sheetHeight - nextShelfY;
    if (topWasteHeight > 50) {
      freeRects.push({ x: 0, y: nextShelfY, width: sheetWidth, height: topWasteHeight });
    }

    return { placements, remaining, usedArea, freeRects };
  }

  /**
   * Pack panels onto a single sheet using improved guillotine algorithm
   * with smart split selection and rectangle merging
   */
  private packSingleSheet(
    panels: Panel[],
    stockSheet: StockSheet,
    kerf: number
  ): { placements: PanelPlacement[]; remaining: Panel[]; usedArea: number; freeRects: FreeRect[] } {
    const placements: PanelPlacement[] = [];
    const remaining: Panel[] = [];
    let usedArea = 0;

    const sheetWidth = stockSheet.length;
    const sheetHeight = stockSheet.width;

    let freeRects: FreeRect[] = [{ x: 0, y: 0, width: sheetWidth, height: sheetHeight }];

    // Track used positions to prevent duplicates
    const usedPositions = new Set<string>();

    for (const panel of panels) {
      const position = this.findBestPosition(panel, freeRects, usedPositions, sheetWidth, sheetHeight, placements);

      if (position) {
        const { rect, rotated, index } = position;
        const placedWidth = rotated ? panel.length : panel.width;
        const placedHeight = rotated ? panel.width : panel.length;

        // Create position key and mark as used
        const posKey = `${rect.x},${rect.y}`;
        usedPositions.add(posKey);

        placements.push({
          panel,
          x: rect.x,
          y: rect.y,
          width: placedWidth,
          height: placedHeight,
          rotated,
          label: panel.label || `Panel ${placements.length + 1}`,
        });

        usedArea += placedWidth * placedHeight;

        // Remove used rectangle and add new ones using smart split
        freeRects.splice(index, 1);
        const newRects = this.guillotineSplitSmart(rect, placedWidth, placedHeight, kerf);
        freeRects.push(...newRects);

        // Merge adjacent rectangles to recover usable space
        freeRects = this.mergeAdjacentRects(freeRects, kerf);

        // Sort by a combination of factors to prefer better positions
        freeRects.sort((a, b) => {
          // Prefer corner positions (lower x + y sum)
          const cornerScoreA = a.x + a.y;
          const cornerScoreB = b.x + b.y;
          if (cornerScoreA !== cornerScoreB) {
            return cornerScoreA - cornerScoreB;
          }
          // Then by area (larger first — defer tight rects for later panels that may fit exactly)
          return (b.width * b.height) - (a.width * a.height);
        });
      } else {
        remaining.push(panel);
      }
    }

    // Return remaining free rectangles as waste regions for panel saw cutting
    return { placements, remaining, usedArea, freeRects };
  }

  /**
   * Find best position for a panel using improved scoring
   * Considers: fit quality, contact perimeter, corner preference
   */
  private findBestPosition(
    panel: Panel,
    freeRects: { x: number; y: number; width: number; height: number }[],
    usedPositions?: Set<string>,
    sheetWidth?: number,
    sheetHeight?: number,
    existingPlacements?: PanelPlacement[]
  ): { rect: typeof freeRects[0]; rotated: boolean; index: number } | null {
    let bestScore = -Infinity;
    let bestRect: typeof freeRects[0] | null = null;
    let bestRotated = false;
    let bestIndex = -1;

    const sWidth = sheetWidth || 2440;
    const sHeight = sheetHeight || 1220;

    for (let i = 0; i < freeRects.length; i++) {
      const rect = freeRects[i];

      // Skip positions already used (defensive check)
      const posKey = `${rect.x},${rect.y}`;
      if (usedPositions?.has(posKey)) {
        continue;
      }

      // Try without rotation
      if (panel.width <= rect.width && panel.length <= rect.height) {
        const score = this.calculatePlacementScore(
          rect, panel.width, panel.length, sWidth, sHeight, existingPlacements
        );
        if (score > bestScore) {
          bestScore = score;
          bestRect = rect;
          bestRotated = false;
          bestIndex = i;
        }
      }

      // Try with rotation (if grain allows)
      if (panel.grain !== 1 && panel.length <= rect.width && panel.width <= rect.height) {
        const score = this.calculatePlacementScore(
          rect, panel.length, panel.width, sWidth, sHeight, existingPlacements
        );
        if (score > bestScore) {
          bestScore = score;
          bestRect = rect;
          bestRotated = true;
          bestIndex = i;
        }
      }
    }

    return bestRect ? { rect: bestRect, rotated: bestRotated, index: bestIndex } : null;
  }

  /**
   * Calculate placement score - higher is better
   * Factors: tight fit, contact perimeter, corner/edge preference
   */
  private calculatePlacementScore(
    rect: { x: number; y: number; width: number; height: number },
    panelWidth: number,
    panelHeight: number,
    sheetWidth: number,
    sheetHeight: number,
    existingPlacements?: PanelPlacement[]
  ): number {
    let score = 0;

    // 1. Tight fit score - minimize wasted space in this rectangle (weight: 100)
    const leftoverWidth = rect.width - panelWidth;
    const leftoverHeight = rect.height - panelHeight;
    const fitScore = 100 - (leftoverWidth + leftoverHeight) / 10;
    score += fitScore;

    // 2. Contact perimeter score - reward touching edges and other panels (weight: 50)
    let contactLength = 0;

    // Contact with sheet edges
    if (rect.x === 0) contactLength += panelHeight; // Left edge
    if (rect.y === 0) contactLength += panelWidth;  // Bottom edge
    if (rect.x + panelWidth >= sheetWidth - 1) contactLength += panelHeight;  // Right edge
    if (rect.y + panelHeight >= sheetHeight - 1) contactLength += panelWidth; // Top edge

    // Contact with existing placements
    if (existingPlacements) {
      for (const p of existingPlacements) {
        // Check if this panel would touch the existing placement
        const panelRight = rect.x + panelWidth;
        const panelTop = rect.y + panelHeight;
        const existingRight = p.x + p.width;
        const existingTop = p.y + p.height;

        // Horizontal contact (panels side by side)
        if (Math.abs(panelRight - p.x) < 10 || Math.abs(rect.x - existingRight) < 10) {
          const overlapStart = Math.max(rect.y, p.y);
          const overlapEnd = Math.min(panelTop, existingTop);
          if (overlapEnd > overlapStart) {
            contactLength += overlapEnd - overlapStart;
          }
        }

        // Vertical contact (panels above/below)
        if (Math.abs(panelTop - p.y) < 10 || Math.abs(rect.y - existingTop) < 10) {
          const overlapStart = Math.max(rect.x, p.x);
          const overlapEnd = Math.min(panelRight, existingRight);
          if (overlapEnd > overlapStart) {
            contactLength += overlapEnd - overlapStart;
          }
        }
      }
    }

    score += contactLength / 20; // Normalize contact contribution

    // 3. Corner preference - prefer positions near origin (weight: 30)
    const distanceFromOrigin = Math.sqrt(rect.x * rect.x + rect.y * rect.y);
    const maxDistance = Math.sqrt(sheetWidth * sheetWidth + sheetHeight * sheetHeight);
    const cornerScore = 30 * (1 - distanceFromOrigin / maxDistance);
    score += cornerScore;

    // 4. Aspect ratio of remaining space - prefer leaving usable rectangles (weight: 20)
    if (leftoverWidth > 50 && leftoverHeight > 50) {
      // If both remainders are usable, that's good
      const remainingAspect = Math.max(leftoverWidth, leftoverHeight) /
                              Math.min(leftoverWidth, leftoverHeight);
      // Prefer aspect ratios closer to 1 (more usable)
      score += 20 / remainingAspect;
    } else if (leftoverWidth > 50 || leftoverHeight > 50) {
      // One usable strip is okay
      score += 10;
    }
    // If both are < 50, no bonus (tight fit is already rewarded)

    return score;
  }

  /**
   * Smart guillotine split - chooses best split direction
   * to maximize usable remaining space
   */
  private guillotineSplitSmart(
    rect: { x: number; y: number; width: number; height: number },
    panelWidth: number,
    panelHeight: number,
    kerf: number
  ): { x: number; y: number; width: number; height: number }[] {
    const newRects: { x: number; y: number; width: number; height: number }[] = [];
    const minUsable = 50; // Minimum usable dimension

    const rightWidth = rect.width - panelWidth - kerf;
    const topHeight = rect.height - panelHeight - kerf;

    // If one remainder is too small, use the other split direction
    if (rightWidth <= minUsable && topHeight <= minUsable) {
      // Both remainders too small - no new rectangles
      return newRects;
    }

    if (rightWidth <= minUsable) {
      // Only top remainder is usable - horizontal split
      if (topHeight > minUsable) {
        newRects.push({
          x: rect.x,
          y: rect.y + panelHeight + kerf,
          width: rect.width,
          height: topHeight,
        });
      }
      return newRects;
    }

    if (topHeight <= minUsable) {
      // Only right remainder is usable - vertical split
      if (rightWidth > minUsable) {
        newRects.push({
          x: rect.x + panelWidth + kerf,
          y: rect.y,
          width: rightWidth,
          height: rect.height,
        });
      }
      return newRects;
    }

    // Both remainders are usable - choose the split that creates better rectangles
    // Option 1: Horizontal split (top strip spans full width)
    const horizontalScore = this.scoreSplitQuality(
      { width: rightWidth, height: panelHeight },      // Right rectangle
      { width: rect.width, height: topHeight }         // Top rectangle
    );

    // Option 2: Vertical split (right strip spans full height)
    const verticalScore = this.scoreSplitQuality(
      { width: rightWidth, height: rect.height },      // Right rectangle
      { width: panelWidth, height: topHeight }         // Top rectangle
    );

    if (horizontalScore >= verticalScore) {
      // Horizontal split: top spans full width, right is panel height only
      newRects.push({
        x: rect.x + panelWidth + kerf,
        y: rect.y,
        width: rightWidth,
        height: panelHeight,
      });
      newRects.push({
        x: rect.x,
        y: rect.y + panelHeight + kerf,
        width: rect.width,
        height: topHeight,
      });
    } else {
      // Vertical split: right spans full height, top is panel width only
      newRects.push({
        x: rect.x + panelWidth + kerf,
        y: rect.y,
        width: rightWidth,
        height: rect.height,
      });
      newRects.push({
        x: rect.x,
        y: rect.y + panelHeight + kerf,
        width: panelWidth,
        height: topHeight,
      });
    }

    return newRects;
  }

  /**
   * Score the quality of a split based on resulting rectangle usability
   * Higher score = better split
   */
  private scoreSplitQuality(
    rect1: { width: number; height: number },
    rect2: { width: number; height: number }
  ): number {
    let score = 0;

    // Prefer rectangles with better aspect ratios (closer to 1:1 or standard sheet ratios)
    const scoreRect = (r: { width: number; height: number }) => {
      const area = r.width * r.height;
      const aspect = Math.max(r.width, r.height) / Math.min(r.width, r.height);

      // Penalize extreme aspect ratios (thin strips are less usable)
      let aspectScore = 100;
      if (aspect > 4) aspectScore = 50;
      if (aspect > 6) aspectScore = 25;
      if (aspect > 10) aspectScore = 10;

      // Bonus for larger areas
      const areaScore = Math.sqrt(area) / 10;

      // Bonus for dimensions that could fit standard parts (multiples of 100mm)
      const dimScore = (r.width >= 200 ? 10 : 0) + (r.height >= 200 ? 10 : 0);

      return aspectScore + areaScore + dimScore;
    };

    score += scoreRect(rect1);
    score += scoreRect(rect2);

    return score;
  }

  /**
   * Merge adjacent free rectangles to recover usable space
   * This helps reduce fragmentation from the guillotine cuts
   */
  private mergeAdjacentRects(
    rects: { x: number; y: number; width: number; height: number }[],
    kerf: number
  ): { x: number; y: number; width: number; height: number }[] {
    if (rects.length < 2) return rects;

    let merged = true;
    let result = [...rects];

    // Keep trying to merge until no more merges are possible
    while (merged) {
      merged = false;

      for (let i = 0; i < result.length && !merged; i++) {
        for (let j = i + 1; j < result.length && !merged; j++) {
          const a = result[i];
          const b = result[j];

          // Check if rectangles can be merged horizontally (same y and height)
          if (Math.abs(a.y - b.y) < 1 && Math.abs(a.height - b.height) < 1) {
            // Check if they're adjacent (touching or separated by kerf)
            if (Math.abs((a.x + a.width + kerf) - b.x) < 2) {
              // Merge: a is left, b is right
              result[i] = {
                x: a.x,
                y: a.y,
                width: a.width + kerf + b.width,
                height: a.height,
              };
              result.splice(j, 1);
              merged = true;
            } else if (Math.abs((b.x + b.width + kerf) - a.x) < 2) {
              // Merge: b is left, a is right
              result[i] = {
                x: b.x,
                y: b.y,
                width: b.width + kerf + a.width,
                height: a.height,
              };
              result.splice(j, 1);
              merged = true;
            }
          }

          // Check if rectangles can be merged vertically (same x and width)
          if (!merged && Math.abs(a.x - b.x) < 1 && Math.abs(a.width - b.width) < 1) {
            // Check if they're adjacent (touching or separated by kerf)
            if (Math.abs((a.y + a.height + kerf) - b.y) < 2) {
              // Merge: a is bottom, b is top
              result[i] = {
                x: a.x,
                y: a.y,
                width: a.width,
                height: a.height + kerf + b.height,
              };
              result.splice(j, 1);
              merged = true;
            } else if (Math.abs((b.y + b.height + kerf) - a.y) < 2) {
              // Merge: b is bottom, a is top
              result[i] = {
                x: b.x,
                y: b.y,
                width: a.width,
                height: b.height + kerf + a.height,
              };
              result.splice(j, 1);
              merged = true;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Group panels by material and thickness
   */
  private groupByMaterialAndThickness(panels: Panel[]): Record<string, Panel[]> {
    const groups: Record<string, Panel[]> = {};

    for (const panel of panels) {
      const key = `${panel.material || 'Unknown'}|${panel.thickness || 18}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      // Expand by quantity - create unique ID for each copy
      const qty = panel.quantity || 1;
      for (let i = 0; i < qty; i++) {
        const uniqueId = qty > 1 ? `${panel.id}-${i + 1}` : panel.id;
        const uniqueLabel = qty > 1 ? `${panel.label} (${i + 1}/${qty})` : panel.label;
        groups[key].push({ 
          ...panel, 
          id: uniqueId,
          label: uniqueLabel,
          quantity: 1 
        });
      }
    }

    return groups;
  }

  /**
   * Find matching stock sheet for material
   */
  private findMatchingStock(
    stockSheets: Record<string, StockSheet>,
    material: string
  ): StockSheet | null {
    if (stockSheets[material]) {
      return stockSheets[material];
    }

    const materialLower = material.toLowerCase();
    for (const [key, value] of Object.entries(stockSheets)) {
      if (materialLower.includes(key.toLowerCase()) || key.toLowerCase().includes(materialLower)) {
        return value;
      }
    }

    return stockSheets.default || null;
  }

  /**
   * Calculate statistics from sheet layouts
   */
  private calculateStatistics(
    sheets: SheetLayout[],
    stockSheets: Record<string, StockSheet>
  ): OptimizationResult {
    if (sheets.length === 0) {
      return this.emptyResult();
    }

    let totalUsedArea = 0;
    let totalWastedArea = 0;
    let totalPanels = 0;
    let estimatedCost = 0;
    const sheetsByMaterial: Record<string, number> = {};

    for (const sheet of sheets) {
      totalUsedArea += sheet.usedArea;
      totalWastedArea += sheet.wastedArea;
      totalPanels += sheet.placements.length;

      if (!sheetsByMaterial[sheet.material]) {
        sheetsByMaterial[sheet.material] = 0;
      }
      sheetsByMaterial[sheet.material]++;

      // Calculate cost
      const stock = this.findMatchingStock(stockSheets, sheet.material);
      if (stock?.cost) {
        estimatedCost += stock.cost;
      }
    }

    const totalArea = totalUsedArea + totalWastedArea;

    return {
      sheets,
      totalSheets: sheets.length,
      totalPanels,
      totalUsedArea,
      totalWastedArea,
      averageUtilization: totalArea > 0 ? (totalUsedArea / totalArea) * 100 : 0,
      sheetsByMaterial,
      estimatedMaterialCost: estimatedCost,
    };
  }

  /**
   * Empty result helper
   */
  private emptyResult(): OptimizationResult {
    return {
      sheets: [],
      totalSheets: 0,
      totalPanels: 0,
      totalUsedArea: 0,
      totalWastedArea: 0,
      averageUtilization: 0,
      sheetsByMaterial: {},
      estimatedMaterialCost: 0,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const optimizationService = new OptimizationService();
