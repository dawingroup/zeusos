/**
 * Material Cost Calculator
 *
 * Centralized service for calculating material costs across all material types.
 * Uses MaterialPricingRules for consistent yield, buffer, kerf, and conversion factors.
 *
 * Resolution chain for each parameter:
 *   palette entry field → org materialPricingRules → DEFAULT_MATERIAL_PRICING_RULES
 */

import type { MaterialType, MaterialPaletteEntry } from '@/shared/types';
import type { PartEntry } from '@/modules/design-manager/types';
import type {
  SheetMaterialBreakdown,
  TimberMaterialBreakdown,
  LinearMaterialBreakdown,
} from '@/modules/design-manager/types';
import {
  type MaterialPricingRule,
  type PricingAssumptions,
  resolveMaterialPricingRule,
  getEffectiveYield,
  getEffectiveBuffer,
} from '@/shared/types/pricingAssumptions';

// ============================================
// Types
// ============================================

export interface MaterialCostResult {
  sheetMaterials: SheetMaterialBreakdown[];
  sheetMaterialsCost: number;
  timberMaterials: TimberMaterialBreakdown[];
  timberMaterialsCost: number;
  linearMaterials: LinearMaterialBreakdown[];
  linearMaterialsCost: number;
  edgingMaterials: LinearMaterialBreakdown[];
  edgingMaterialsCost: number;
  slabMaterials: SheetMaterialBreakdown[];
  slabMaterialsCost: number;
  fabricMaterials: LinearMaterialBreakdown[];
  fabricMaterialsCost: number;
  componentCost: number;
  totalCost: number;
}

// ============================================
// Calculator
// ============================================

export class MaterialCostCalculator {
  private assumptions: PricingAssumptions | null;
  private palette: MaterialPaletteEntry[];

  constructor(
    assumptions: PricingAssumptions | null,
    palette: MaterialPaletteEntry[]
  ) {
    this.assumptions = assumptions;
    this.palette = palette;
  }

  /** Resolve the pricing rule for a material type */
  getRule(materialType: MaterialType): MaterialPricingRule {
    return resolveMaterialPricingRule(materialType, this.assumptions);
  }

  /** Get effective yield (palette → rule → default) */
  getYield(materialType: MaterialType, paletteEntry?: MaterialPaletteEntry): number {
    return getEffectiveYield(materialType, paletteEntry?.yieldFactor, this.assumptions);
  }

  /** Get effective buffer multiplier */
  getBuffer(materialType: MaterialType): number {
    return getEffectiveBuffer(materialType, this.assumptions);
  }

  /** Find palette entry by name and thickness */
  findPalette(materialName: string, thickness: number): MaterialPaletteEntry | undefined {
    const normalizedName = materialName.toLowerCase().trim();
    return this.palette.find(entry => {
      const entryName = (entry.designName || entry.normalizedName || '').toLowerCase().trim();
      return entryName === normalizedName && Math.abs((entry.thickness || 0) - thickness) < 0.1;
    });
  }

  /**
   * Find TIMBER palette entry.
   * Timber entries are often aggregated by species with thickness=0, so
   * strict thickness matching can miss valid mappings.
   */
  findTimberPalette(materialName: string, thickness: number): MaterialPaletteEntry | undefined {
    // Legacy/explicit thickness match first.
    const strict = this.findPalette(materialName, thickness);
    if (strict) return strict;

    const normalizedName = materialName.toLowerCase().trim();
    return this.palette.find((entry) => {
      if (entry.materialType !== 'TIMBER') return false;
      const entryName = (entry.designName || entry.normalizedName || '').toLowerCase().trim();
      return entryName === normalizedName;
    });
  }

  /** Find palette entry by name only (for fabric, component) */
  findPaletteByName(materialName: string): MaterialPaletteEntry | undefined {
    const normalizedName = materialName.toLowerCase().trim();
    return this.palette.find(entry => {
      const entryName = (entry.designName || entry.normalizedName || '').toLowerCase().trim();
      return entryName === normalizedName;
    });
  }

  // ============================================
  // Timber Cost Calculation (FIXED)
  // ============================================

  /**
   * Calculate timber material costs with proper planing allowance, kerf, yield, and buffer.
   *
   * Key fixes over previous implementation:
   * 1. Applies planing allowance for rough-sawn stock (raw = finished + 2×allowance per side)
   * 2. Applies yield factor (default 85%) to account for cutting waste
   * 3. Applies buffer multiplier (default 10%)
   * 4. Resolves pricing method from palette costUnit, not blind m³ assumption
   */
  calculateTimberCosts(
    parts: PartEntry[]
  ): { materials: TimberMaterialBreakdown[]; totalCost: number } {
    const rule = this.getRule('TIMBER');
    const timberConfig = rule.timberConfig!;

    // Group by material + cross-section
    const groups = new Map<string, {
      materialId?: string;
      materialName: string;
      thickness: number;
      width: number;
      parts: PartEntry[];
      paletteEntry?: MaterialPaletteEntry;
    }>();

    for (const part of parts) {
      const key = `${part.materialName}-${part.thickness}-${part.width}`;
      const existing = groups.get(key);
      if (existing) {
        existing.parts.push(part);
      } else {
        const paletteEntry = this.findTimberPalette(part.materialName, part.thickness);
        groups.set(key, {
          materialId: part.materialId,
          materialName: part.materialName,
          thickness: part.thickness,
          width: part.width,
          parts: [part],
          paletteEntry,
        });
      }
    }

    const materials: TimberMaterialBreakdown[] = [];
    let totalCost = 0;

    for (const [, group] of groups) {
      const partsCount = group.parts.reduce((sum, p) => sum + p.quantity, 0);
      const pe = group.paletteEntry;
      const yieldFactor = this.getYield('TIMBER', pe);
      const bufferMultiplier = this.getBuffer('TIMBER');

      const matchedTimberStock = pe?.timberStock?.find((stock) =>
        stock.thickness === group.thickness && stock.width === group.width,
      ) || pe?.timberStock?.[0];

      // Determine if stock is rough-sawn (needs planing).
      // TimberStockDefinition carries isDressed; rough-sawn is its inverse.
      const isRoughSawn = matchedTimberStock
        ? !matchedTimberStock.isDressed
        : (timberConfig.isRoughSawn ?? true);
      const planingAllowance = isRoughSawn ? timberConfig.planingAllowanceMm : 0;
      const kerfMm = timberConfig.kerfMm;

      // Calculate raw dimensions (what we actually consume from stock)
      const rawThickness = group.thickness + (2 * planingAllowance);
      const rawWidth = group.width + (2 * planingAllowance);

      // Total volume using RAW dimensions (what's actually consumed from stock)
      const totalVolumeCubicMeters = group.parts.reduce(
        (sum, p) => {
          const rawLength = p.length + kerfMm; // kerf per cut
          return sum + (rawThickness / 1000) * (rawWidth / 1000) * (rawLength / 1000) * p.quantity;
        },
        0
      );

      // Total linear meters (finished lengths — for linear pricing)
      const totalLinearMeters = group.parts.reduce(
        (sum, p) => sum + (p.length / 1000) * p.quantity,
        0
      );

      // Adjust for yield: we need more stock than the net volume
      const adjustedVolume = totalVolumeCubicMeters / yieldFactor;
      const adjustedLinearMeters = totalLinearMeters / yieldFactor;

      // Resolve pricing method from palette costUnit, then timberStock, then rule priority
      const costUnit = (pe?.costUnit || '').toLowerCase();
      const timberStock = matchedTimberStock;
      const linearStock = pe?.linearStock?.[0];

      let pricingMethod: 'volumetric' | 'linear' | 'per-piece' = 'volumetric';
      let unitCost = 0;
      let materialCost = 0;
      let costUnitLabel = 'per m\u00B3';

      // Priority 1: explicit costUnit on palette entry
      if (costUnit === 'cbm' || costUnit === 'm3' || costUnit === 'm^3' || costUnit === 'm³' || costUnit === 'cubic_meter' || costUnit === 'cubic-meter') {
        pricingMethod = 'volumetric';
        unitCost = timberStock?.costPerCubicMeter || pe?.unitCost || 0;
        materialCost = adjustedVolume * unitCost * bufferMultiplier;
        costUnitLabel = 'per m\u00B3';
      } else if (costUnit === 'm' || costUnit === 'lm' || costUnit === 'linear_meter' || costUnit === 'linear-meter' || costUnit === 'linear') {
        pricingMethod = 'linear';
        unitCost = timberStock?.costPerLinearMeter || linearStock?.costPerLinearMeter || pe?.unitCost || 0;
        materialCost = adjustedLinearMeters * unitCost * bufferMultiplier;
        costUnitLabel = 'per m';
      } else if (costUnit === 'ea' || costUnit === 'piece') {
        pricingMethod = 'per-piece';
        unitCost = pe?.unitCost || 0;
        materialCost = partsCount * unitCost * bufferMultiplier;
        costUnitLabel = 'per piece';
      }
      // Priority 2: timberStock/linearStock pricing fields
      else if (timberStock?.costPerCubicMeter && timberStock.costPerCubicMeter > 0) {
        pricingMethod = 'volumetric';
        unitCost = timberStock.costPerCubicMeter;
        materialCost = adjustedVolume * unitCost * bufferMultiplier;
        costUnitLabel = 'per m\u00B3';
      } else if (timberStock?.costPerLinearMeter && timberStock.costPerLinearMeter > 0) {
        pricingMethod = 'linear';
        unitCost = timberStock.costPerLinearMeter;
        materialCost = adjustedLinearMeters * unitCost * bufferMultiplier;
        costUnitLabel = 'per m';
      } else if (linearStock?.costPerLinearMeter && linearStock.costPerLinearMeter > 0) {
        pricingMethod = 'linear';
        unitCost = linearStock.costPerLinearMeter;
        materialCost = adjustedLinearMeters * unitCost * bufferMultiplier;
        costUnitLabel = 'per m';
      }
      // Priority 3: unitCost as volumetric fallback (existing behavior, now with yield/buffer)
      else if (pe?.unitCost && pe.unitCost > 0) {
        pricingMethod = 'volumetric';
        unitCost = pe.unitCost;
        materialCost = adjustedVolume * unitCost * bufferMultiplier;
        costUnitLabel = 'per m\u00B3';
      }

      totalCost += Math.round(materialCost);

      materials.push({
        materialId: group.materialId || pe?.materialId,
        materialName: group.materialName,
        crossSection: { thickness: group.thickness, width: group.width },
        pricingMethod,
        totalVolumeCubicMeters: Math.round(adjustedVolume * 10000) / 10000,
        totalLinearMeters: Math.round(adjustedLinearMeters * 100) / 100,
        unitCost,
        totalCost: Math.round(materialCost),
        partsCount,
        costUnit: costUnitLabel,
      });
    }

    return { materials, totalCost };
  }

  // ============================================
  // Sheet/Panel Cost Calculation
  // ============================================

  /**
   * Calculate sheet material costs using area-based pro-rated costing.
   * Uses yield from pricing rules instead of hardcoded 1.15 waste factor.
   */
  async calculateSheetCosts(
    parts: PartEntry[],
    projectId: string,
    getMaterialUnitCostFn: (
      materialName: string,
      thickness: number,
      projectId: string,
      palette?: MaterialPaletteEntry[]
    ) => Promise<{ cost: number; source: string; currency: string }>
  ): Promise<{ materials: SheetMaterialBreakdown[]; totalCost: number }> {
    const rule = this.getRule('PANEL');
    const defaultSheetSize = rule.panelConfig?.defaultSheetSize ?? { length: 2440, width: 1220 };

    // Group parts by material
    const materialGroups = new Map<string, {
      materialId?: string;
      materialName: string;
      thickness: number;
      parts: PartEntry[];
      totalArea: number;
      paletteEntry?: MaterialPaletteEntry;
    }>();

    for (const part of parts) {
      const key = `${part.materialName}-${part.thickness}`;
      const partArea = (part.length * part.width * part.quantity) / 1_000_000;
      const existing = materialGroups.get(key);
      if (existing) {
        existing.parts.push(part);
        existing.totalArea += partArea;
      } else {
        const paletteEntry = this.findPalette(part.materialName, part.thickness);
        materialGroups.set(key, {
          materialId: part.materialId,
          materialName: part.materialName,
          thickness: part.thickness,
          parts: [part],
          totalArea: partArea,
          paletteEntry,
        });
      }
    }

    const materials: SheetMaterialBreakdown[] = [];
    let totalCost = 0;

    for (const [, group] of materialGroups) {
      const pe = group.paletteEntry;
      const yieldFactor = this.getYield('PANEL', pe);
      const wasteMultiplier = 1 / yieldFactor; // e.g., 0.85 yield → 1.176 multiplier

      const stockSheet = pe?.stockSheets?.[0];
      const hasStockSheet = stockSheet && stockSheet.length > 0 && stockSheet.width > 0 && stockSheet.costPerSheet > 0;

      const sheetLength = hasStockSheet ? stockSheet.length : defaultSheetSize.length;
      const sheetWidth = hasStockSheet ? stockSheet.width : defaultSheetSize.width;
      const sheetArea = (sheetLength * sheetWidth) / 1_000_000;

      const sheetsRequired = Math.ceil((group.totalArea * wasteMultiplier) / sheetArea);

      let unitCost: number;

      if (hasStockSheet) {
        unitCost = stockSheet.costPerSheet;
      } else {
        const priceResult = await getMaterialUnitCostFn(
          group.materialName,
          group.thickness,
          projectId,
          this.palette
        );
        unitCost = priceResult.cost;
      }

      const costPerM2 = unitCost / sheetArea;
      const areaWithWaste = group.totalArea * wasteMultiplier;
      const materialTotal = Math.round(areaWithWaste * costPerM2);
      totalCost += materialTotal;

      materials.push({
        materialId: group.materialId,
        materialName: group.materialName,
        thickness: group.thickness,
        sheetsRequired,
        unitCost,
        totalCost: materialTotal,
        partsCount: group.parts.reduce((sum, p) => sum + p.quantity, 0),
        totalArea: group.totalArea,
      });
    }

    return { materials, totalCost };
  }

  // ============================================
  // Linear Stock Cost Calculation
  // ============================================

  calculateLinearCosts(
    parts: PartEntry[]
  ): { materials: LinearMaterialBreakdown[]; totalCost: number } {
    const rule = this.getRule('METAL_BAR');
    const bufferMultiplier = rule.defaultBufferMultiplier;

    const groups = new Map<string, {
      materialId?: string;
      materialName: string;
      profile: string;
      parts: PartEntry[];
      paletteEntry?: MaterialPaletteEntry;
    }>();

    for (const part of parts) {
      const profile = part.barProfile || `${part.thickness}x${part.width}`;
      const key = `${part.materialName}-${profile}`;
      const existing = groups.get(key);
      if (existing) {
        existing.parts.push(part);
      } else {
        const paletteEntry = this.findPaletteByName(part.materialName);
        groups.set(key, {
          materialId: part.materialId,
          materialName: part.materialName,
          profile,
          parts: [part],
          paletteEntry,
        });
      }
    }

    const materials: LinearMaterialBreakdown[] = [];
    let totalCost = 0;

    for (const [, group] of groups) {
      const pe = group.paletteEntry;
      const yieldFactor = this.getYield('METAL_BAR', pe);
      const partsCount = group.parts.reduce((sum, p) => sum + p.quantity, 0);
      const totalLinearMeters = group.parts.reduce(
        (sum, p) => sum + (p.length / 1000) * p.quantity,
        0
      );
      const adjustedMeters = totalLinearMeters / yieldFactor;

      const linearStock = pe?.linearStock?.[0];
      let unitCost = 0;
      let materialCost = 0;

      if (linearStock?.costPerLinearMeter && linearStock.costPerLinearMeter > 0) {
        unitCost = linearStock.costPerLinearMeter;
        materialCost = adjustedMeters * unitCost * bufferMultiplier;
      } else if (pe?.unitCost && pe.unitCost > 0) {
        unitCost = pe.unitCost;
        materialCost = partsCount * unitCost * bufferMultiplier;
      }

      totalCost += Math.round(materialCost);

      materials.push({
        materialId: group.materialId || pe?.materialId,
        materialName: group.materialName,
        profile: group.profile,
        totalLinearMeters: Math.round(adjustedMeters * 100) / 100,
        unitCost,
        totalCost: Math.round(materialCost),
        partsCount,
      });
    }

    return { materials, totalCost };
  }

  // ============================================
  // Slab (Stone) Cost Calculation
  // ============================================

  calculateSlabCosts(
    parts: PartEntry[]
  ): { materials: SheetMaterialBreakdown[]; totalCost: number } {
    const rule = this.getRule('STONE');
    const defaultSlabSize = rule.slabConfig?.defaultSlabSize ?? { length: 3000, width: 1500 };

    const groups = new Map<string, {
      materialId?: string;
      materialName: string;
      thickness: number;
      parts: PartEntry[];
      totalArea: number;
      paletteEntry?: MaterialPaletteEntry;
    }>();

    for (const part of parts) {
      const key = `${part.materialName}-${part.thickness}`;
      const partArea = (part.length * part.width * part.quantity) / 1_000_000;
      const existing = groups.get(key);
      if (existing) {
        existing.parts.push(part);
        existing.totalArea += partArea;
      } else {
        const paletteEntry = this.findPalette(part.materialName, part.thickness);
        groups.set(key, {
          materialId: part.materialId,
          materialName: part.materialName,
          thickness: part.thickness,
          parts: [part],
          totalArea: partArea,
          paletteEntry,
        });
      }
    }

    const materials: SheetMaterialBreakdown[] = [];
    let totalCost = 0;

    for (const [, group] of groups) {
      const pe = group.paletteEntry;
      const yieldFactor = this.getYield('STONE', pe);
      const bufferMultiplier = this.getBuffer('STONE');

      const slabLength = (pe as any)?.slabSize?.length ?? defaultSlabSize.length;
      const slabWidth = (pe as any)?.slabSize?.width ?? defaultSlabSize.width;
      const slabArea = (slabLength * slabWidth) / 1_000_000;

      const adjustedArea = group.totalArea / yieldFactor;
      const slabsRequired = Math.ceil(adjustedArea / slabArea);

      const unitCost = pe?.unitCost || 0;
      const materialTotal = Math.round(adjustedArea * (unitCost / slabArea) * bufferMultiplier);
      totalCost += materialTotal;

      materials.push({
        materialId: group.materialId || pe?.materialId,
        materialName: group.materialName,
        thickness: group.thickness,
        sheetsRequired: slabsRequired,
        unitCost,
        totalCost: materialTotal,
        partsCount: group.parts.reduce((sum, p) => sum + p.quantity, 0),
        totalArea: group.totalArea,
      });
    }

    return { materials, totalCost };
  }

  // ============================================
  // Fabric Cost Calculation
  // ============================================

  calculateFabricCosts(
    parts: PartEntry[]
  ): { materials: LinearMaterialBreakdown[]; totalCost: number } {
    const rule = this.getRule('FABRIC');
    const defaultRollWidthMm = rule.fabricConfig?.defaultRollWidthMm ?? 1400;

    const groups = new Map<string, {
      materialId?: string;
      materialName: string;
      parts: PartEntry[];
      totalArea: number;
      paletteEntry?: MaterialPaletteEntry;
    }>();

    for (const part of parts) {
      const key = part.materialName;
      const partArea = (part.length * part.width * part.quantity) / 1_000_000;
      const existing = groups.get(key);
      if (existing) {
        existing.parts.push(part);
        existing.totalArea += partArea;
      } else {
        const paletteEntry = this.findPaletteByName(part.materialName);
        groups.set(key, {
          materialId: part.materialId,
          materialName: part.materialName,
          parts: [part],
          totalArea: partArea,
          paletteEntry,
        });
      }
    }

    const materials: LinearMaterialBreakdown[] = [];
    let totalCost = 0;

    for (const [, group] of groups) {
      const pe = group.paletteEntry;
      const yieldFactor = this.getYield('FABRIC', pe);
      const bufferMultiplier = this.getBuffer('FABRIC');

      const firstPart = group.parts[0];
      const rollWidthMm = pe?.fabricStock?.[0]?.rollWidth ?? (firstPart as any)?.rollWidth ?? defaultRollWidthMm;
      const rollWidthM = rollWidthMm / 1000;

      // Convert area to linear meters of roll: area / rollWidth, adjusted for yield
      const linearMeters = (group.totalArea / rollWidthM) / yieldFactor;

      const unitCost = pe?.fabricStock?.[0]?.costPerLinearMeter ?? pe?.unitCost ?? 0;
      const materialTotal = Math.round(linearMeters * unitCost * bufferMultiplier);
      totalCost += materialTotal;

      materials.push({
        materialId: group.materialId || pe?.materialId,
        materialName: group.materialName,
        profile: `${rollWidthMm}mm roll`,
        totalLinearMeters: Math.round(linearMeters * 100) / 100,
        unitCost,
        totalCost: materialTotal,
        partsCount: group.parts.reduce((sum, p) => sum + p.quantity, 0),
      });
    }

    return { materials, totalCost };
  }

  // ============================================
  // Edge Banding Cost Calculation
  // ============================================

  calculateEdgingCosts(
    allParts: PartEntry[]
  ): { materials: LinearMaterialBreakdown[]; totalCost: number } {
    const edgePaletteEntries = this.palette.filter(e => e.materialType === 'EDGE');
    if (edgePaletteEntries.length === 0) {
      return { materials: [], totalCost: 0 };
    }

    const bufferMultiplier = this.getBuffer('EDGE');

    const edgeGroupMap = new Map<string, { meters: number; paletteEntry: MaterialPaletteEntry }>();

    for (const part of allParts) {
      const eb = part.edgeBanding;
      if (!eb || (!eb.top && !eb.bottom && !eb.left && !eb.right)) continue;

      const lengthM = (part.length || 0) / 1000;
      const widthM = (part.width || 0) / 1000;
      const qty = part.quantity || 1;
      let partEdgeMeters = 0;
      if (eb.top) partEdgeMeters += lengthM;
      if (eb.bottom) partEdgeMeters += lengthM;
      if (eb.left) partEdgeMeters += widthM;
      if (eb.right) partEdgeMeters += widthM;
      partEdgeMeters *= qty;
      if (partEdgeMeters <= 0) continue;

      const partEdgeMaterial = (eb as any).material as string | undefined;
      let matched = edgePaletteEntries[0];
      if (partEdgeMaterial) {
        const byName = edgePaletteEntries.find(e =>
          (e.designName || e.normalizedName || '').toLowerCase().includes(partEdgeMaterial.toLowerCase())
        );
        if (byName) matched = byName;
      }

      const groupKey = matched.designName || matched.normalizedName || 'Edge Banding';
      const existing = edgeGroupMap.get(groupKey);
      if (existing) {
        existing.meters += partEdgeMeters;
      } else {
        edgeGroupMap.set(groupKey, { meters: partEdgeMeters, paletteEntry: matched });
      }
    }

    const materials: LinearMaterialBreakdown[] = [];
    let totalCost = 0;

    for (const [materialName, group] of edgeGroupMap) {
      const unitCost = group.paletteEntry.unitCost || 0;
      const costValue = Math.round(group.meters * unitCost * bufferMultiplier);
      materials.push({
        materialId: group.paletteEntry.inventoryId,
        materialName,
        profile: 'edge banding',
        totalLinearMeters: Math.round(group.meters * 100) / 100,
        unitCost,
        totalCost: costValue,
        partsCount: 0, // set by caller if needed
      });
      totalCost += costValue;
    }

    return { materials, totalCost };
  }

  // ============================================
  // Component (Bought-out) Cost Calculation
  // ============================================

  calculateComponentCost(parts: PartEntry[]): number {
    let cost = 0;
    for (const part of parts) {
      const pe = this.findPaletteByName(part.materialName);
      const uc = (part as any).componentUnitCost || pe?.unitCost || 0;
      cost += uc * part.quantity;
    }
    return Math.round(cost);
  }
}
