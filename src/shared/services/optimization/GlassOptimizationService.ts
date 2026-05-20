/**
 * Glass Optimization Service
 *
 * Implements 2D sheet nesting for glass materials with special handling:
 * - Safety margins from sheet edges
 * - Minimum cut size enforcement
 * - Restricted rotation (glass is fragile)
 * - Polishing requirements tracking
 */

import type {
  GlassStockDefinition,
  NestingSheet,
  PartPlacement,
  WasteRegion,
  SheetSummary,
} from '../../types/project';

import { OptimizationService, type Panel, type StockSheet } from './OptimizationService';

interface GlassPart {
  partId: string;
  partName: string;
  designItemId: string;
  designItemName: string;
  length: number;           // mm
  width: number;            // mm
  thickness: number;        // mm
  quantity: number;
  materialName: string;
  grain: number;            // Glass typically has grain = 1 (no rotation due to fragility)
}

/**
 * Glass Optimization Service
 */
export class GlassOptimizationService {
  private kerf: number;                    // Cutting kerf in mm (default 4mm for glass scoring)

  constructor(kerf: number = 4) {
    this.kerf = kerf;
  }

  /**
   * Run estimation for glass materials (fast, area-based)
   * @param defaultSafetyMargin - Fallback safety margin if stock doesn't define one (default: 25mm)
   * @param utilizationEstimate - Conservative utilization for glass (default: 0.65)
   * @param costBuffer - Estimation cost buffer multiplier (default: 1.15)
   */
  public async estimateGlass(
    parts: GlassPart[],
    glassStock: GlassStockDefinition[],
    defaultSafetyMargin: number = 25,
    utilizationEstimate: number = 0.65,
    costBuffer: number = 1.15
  ): Promise<SheetSummary[]> {
    // Group parts by material/thickness
    const groups = this.groupByMaterialThickness(parts);

    const summaries: SheetSummary[] = [];

    for (const [materialKey, groupParts] of Object.entries(groups)) {
      // Find matching glass stock
      const [materialName, thickness] = materialKey.split('|');
      const stock = glassStock.find(
        s => s.materialName === materialName && s.thickness === Number(thickness)
      );

      if (!stock) {
        console.warn(`No matching glass stock for ${materialName} ${thickness}mm`);
        continue;
      }

      // Calculate total area needed (with safety margins)
      const safetyMargin = stock.safetyMargin || defaultSafetyMargin;
      const totalArea = groupParts.reduce((sum, part) => {
        // Add safety margins to each part
        const safeLength = part.length + (safetyMargin * 2);
        const safeWidth = part.width + (safetyMargin * 2);
        return sum + (safeLength * safeWidth * part.quantity);
      }, 0);

      // Stock sheet area (also reduce usable area by safety margins)
      const usableLength = stock.length - (safetyMargin * 2);
      const usableWidth = stock.width - (safetyMargin * 2);
      const stockArea = usableLength * usableWidth;

      // Estimate with conservative utilization (lower than panels due to fragility)
      const sheetsRequired = Math.ceil(totalArea / (stockArea * utilizationEstimate));

      const totalParts = groupParts.reduce((sum, part) => sum + part.quantity, 0);
      const wasteArea = (sheetsRequired * stockArea) - totalArea;
      const utilizationPercent = Math.round(utilizationEstimate * 100);

      summaries.push({
        materialId: stock.materialId,
        materialName: stock.materialName,
        thickness: stock.thickness,
        sheetSize: { length: stock.length, width: stock.width },
        sheetsRequired,
        partsOnSheet: totalParts / sheetsRequired,
        utilizationPercent,
        wasteArea,
        estimatedCost: sheetsRequired * stock.costPerSheet * costBuffer,
      });
    }

    return summaries;
  }

  /**
   * Run production optimization for glass materials (full nesting with safety)
   */
  public async optimizeGlass(
    parts: GlassPart[],
    glassStock: GlassStockDefinition[],
    _targetYield: number = 75  // Lower target for glass due to fragility
  ): Promise<NestingSheet[]> {
    // Group parts by material/thickness
    const groups = this.groupByMaterialThickness(parts);

    const allResults: NestingSheet[] = [];

    for (const [materialKey, groupParts] of Object.entries(groups)) {
      const [materialName, thickness] = materialKey.split('|');
      const stock = glassStock.find(
        s => s.materialName === materialName && s.thickness === Number(thickness)
      );

      if (!stock) {
        console.warn(`No matching glass stock for ${materialName} ${thickness}mm`);
        continue;
      }

      // Apply safety margins to parts
      const safetyMargin = stock.safetyMargin || 25;
      const adjustedParts = groupParts.map(part => ({
        ...part,
        length: part.length + (safetyMargin * 2),
        width: part.width + (safetyMargin * 2),
      }));

      // Convert to Panel format for existing optimizer
      const panels: Panel[] = adjustedParts.flatMap(part =>
        Array.from({ length: part.quantity }, (_, i) => ({
          id: `${part.partId}-${i}`,
          label: part.partName,
          cabinet: part.designItemName,
          material: part.materialName,
          thickness: part.thickness,
          length: part.length,
          width: part.width,
          quantity: 1,
          grain: 1,  // Glass should never rotate (fragile)
        }))
      );

      // Define reduced stock sheet (account for safety margins)
      const stockSheet: StockSheet = {
        material: stock.materialName,
        length: stock.length - (safetyMargin * 2),
        width: stock.width - (safetyMargin * 2),
        thickness: stock.thickness,
        cost: stock.costPerSheet,
      };

      // Use existing optimization service
      const optimizer = new OptimizationService();
      const result = optimizer.optimize(panels, {
        mode: 'PRODUCTION',
        bladeKerf: this.kerf,
        stockSheets: {
          [stock.materialName]: stockSheet,
        },
      });

      // Convert results to NestingSheet format
      const nestingSheets = result.sheets.map((sheet, index) => {
        const placements: PartPlacement[] = sheet.placements.map(placement => ({
          partId: placement.panel.id || '',
          partName: placement.label,
          designItemId: placement.panel.cabinet || '',
          designItemName: placement.panel.cabinet || '',
          x: placement.x,
          y: placement.y,
          length: placement.width,
          width: placement.height,
          rotated: placement.rotated,
          grainAligned: !placement.rotated,
        }));

        const wasteRegions: WasteRegion[] = (sheet.wasteRegions || []).map(region => ({
          x: region.x,
          y: region.y,
          length: region.width,
          width: region.height,
          area: region.width * region.height,
          reusable: region.width * region.height > 100000, // > 100cm²
        }));

        return {
          id: `glass-${stock.materialId}-${index}`,
          sheetIndex: index,
          stockSheetId: stock.id,
          materialId: stock.materialId,
          materialName: stock.materialName,
          sheetSize: { length: stock.length, width: stock.width },
          placements,
          utilizationPercent: sheet.utilization,
          wasteArea: sheet.wastedArea,
          wasteRegions,
        };
      });

      allResults.push(...nestingSheets);
    }

    return allResults;
  }

  /**
   * Group parts by material and thickness
   */
  private groupByMaterialThickness(parts: GlassPart[]): Record<string, GlassPart[]> {
    const groups: Record<string, GlassPart[]> = {};

    for (const part of parts) {
      const key = `${part.materialName}|${part.thickness}`;

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(part);
    }

    return groups;
  }

  /**
   * Validate glass part against minimum cut sizes
   */
  public validateGlassPart(
    part: GlassPart,
    stock: GlassStockDefinition
  ): { valid: boolean; message?: string } {
    const minSize = stock.minimumCutSize || { length: 100, width: 100 };

    if (part.length < minSize.length || part.width < minSize.width) {
      return {
        valid: false,
        message: `Part ${part.partName} (${part.length}×${part.width}mm) is smaller than minimum cut size (${minSize.length}×${minSize.width}mm)`,
      };
    }

    const safetyMargin = stock.safetyMargin || 25;
    const usableLength = stock.length - (safetyMargin * 2);
    const usableWidth = stock.width - (safetyMargin * 2);

    if (part.length > usableLength || part.width > usableWidth) {
      return {
        valid: false,
        message: `Part ${part.partName} (${part.length}×${part.width}mm) exceeds usable sheet size (${usableLength}×${usableWidth}mm with ${safetyMargin}mm margins)`,
      };
    }

    return { valid: true };
  }
}

export default GlassOptimizationService;
