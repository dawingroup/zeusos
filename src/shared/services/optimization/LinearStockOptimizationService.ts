/**
 * Linear Stock Optimization Service
 *
 * Implements 1D cutting stock optimization for linear materials (metal bars, aluminium profiles, tubes).
 * Uses First Fit Decreasing (FFD) algorithm for linear cutting optimization.
 */

import type {
  LinearStockDefinition,
  LinearCuttingResult,
  LinearCutPlacement,
  LinearWasteSegment,
  LinearStockSummary,
} from '../../types/project';

interface LinearPart {
  partId: string;
  partName: string;
  designItemId: string;
  designItemName: string;
  length: number;           // Required length in mm
  quantity: number;
  materialName: string;
  profile: string;          // e.g., "50x50 SHS", "25mm Round Bar"
}

interface ProfileGroup {
  profile: string;
  parts: LinearPart[];
  matchedStock: LinearStockDefinition | null;
}

/**
 * Linear Stock Optimization Service
 */
export class LinearStockOptimizationService {
  private kerf: number;                    // Saw kerf in mm (default 4mm)
  private minimumUsableOffcut: number;     // Minimum reusable length (default 300mm)

  constructor(
    kerf: number = 4,
    minimumUsableOffcut: number = 300
  ) {
    this.kerf = kerf;
    this.minimumUsableOffcut = minimumUsableOffcut;
  }

  /**
   * Run estimation for linear stock materials (fast, area-based)
   */
  public async estimateLinearStock(
    parts: LinearPart[],
    linearStock: LinearStockDefinition[],
    costBuffer: number = 1.15,
    utilizationEstimate: number = 0.7
  ): Promise<LinearStockSummary[]> {
    // Group parts by profile
    const groups = this.groupByProfile(parts);

    // Match each group to available stock
    const matchedGroups = this.matchStockToProfiles(groups, linearStock);

    const summaries: LinearStockSummary[] = [];

    for (const group of matchedGroups) {
      if (!group.matchedStock) {
        console.warn(`No matching stock for profile ${group.profile}`);
        continue;
      }

      const stock = group.matchedStock;
      const totalLinearLength = group.parts.reduce(
        (sum, part) => sum + (part.length + this.kerf) * part.quantity,
        0
      );

      // Use preferred stock length (usually the longest available)
      const preferredStockLength = Math.max(...stock.availableLengths);

      const barsRequired = Math.ceil(totalLinearLength / (preferredStockLength * utilizationEstimate));
      const totalLinearMeters = (barsRequired * preferredStockLength) / 1000;

      // Calculate cost
      let estimatedCost = 0;
      if (stock.costPerLinearMeter) {
        estimatedCost = totalLinearMeters * stock.costPerLinearMeter;
      } else if (stock.costPerPiece && stock.costPerPiece.length > 0) {
        const matchingCost = stock.costPerPiece.find(c => c.length === preferredStockLength);
        estimatedCost = barsRequired * (matchingCost?.cost || 0);
      }

      // Apply cost buffer from pricing assumptions
      estimatedCost *= costBuffer;

      const totalParts = group.parts.reduce((sum, part) => sum + part.quantity, 0);

      summaries.push({
        materialId: stock.materialId,
        materialName: stock.materialName,
        profile: stock.profile,
        stockLength: preferredStockLength,
        barsRequired,
        totalLinearMeters,
        partsOnBars: totalParts,
        averageUtilizationPercent: Math.round(utilizationEstimate * 100),
        totalWasteLength: (barsRequired * preferredStockLength) - totalLinearLength,
        estimatedCost,
      });
    }

    return summaries;
  }

  /**
   * Run production optimization for linear stock materials (full FFD algorithm)
   */
  public async optimizeLinearStock(
    parts: LinearPart[],
    linearStock: LinearStockDefinition[],
    _targetYield: number = 85
  ): Promise<LinearCuttingResult[]> {
    // Group parts by profile
    const groups = this.groupByProfile(parts);

    // Match each group to available stock
    const matchedGroups = this.matchStockToProfiles(groups, linearStock);

    const allResults: LinearCuttingResult[] = [];

    for (const group of matchedGroups) {
      if (!group.matchedStock) {
        console.warn(`No matching stock for profile ${group.profile}`);
        continue;
      }

      const stock = group.matchedStock;

      // Run FFD algorithm for this profile group
      const results = this.runFFDOptimization(group.parts, stock);
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * Group parts by profile (e.g., "50x50 SHS", "25mm Round Bar")
   */
  private groupByProfile(parts: LinearPart[]): ProfileGroup[] {
    const groupMap = new Map<string, ProfileGroup>();

    for (const part of parts) {
      const key = part.profile;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          profile: part.profile,
          parts: [],
          matchedStock: null,
        });
      }

      groupMap.get(key)!.parts.push(part);
    }

    return Array.from(groupMap.values());
  }

  /**
   * Match profile groups to available linear stock.
   * Tries exact profile match first, then dimension-based fuzzy fallback.
   */
  private matchStockToProfiles(
    groups: ProfileGroup[],
    linearStock: LinearStockDefinition[]
  ): ProfileGroup[] {
    for (const group of groups) {
      // Try exact profile match first
      const exactMatch = linearStock.find(stock => stock.profile === group.profile);

      if (exactMatch) {
        group.matchedStock = exactMatch;
        continue;
      }

      // Fuzzy fallback: parse dimensions from profile string and match by cross-section
      const parsed = parseProfileDimensions(group.profile);
      if (parsed) {
        // Find stock with matching or larger cross-section dimensions
        const dimensionMatch = linearStock.find(stock => {
          const sd = stock.profileDimensions;
          const d1 = sd.dimension1;
          const d2 = sd.dimension2 || sd.dimension1;
          return d1 >= parsed.d1 && d2 >= parsed.d2;
        });
        if (dimensionMatch) {
          group.matchedStock = dimensionMatch;
        }
      }
    }

    return groups;
  }

  /**
   * Run First Fit Decreasing (FFD) algorithm for linear cutting
   */
  private runFFDOptimization(
    parts: LinearPart[],
    stock: LinearStockDefinition
  ): LinearCuttingResult[] {
    // Expand parts by quantity
    const expandedParts: LinearPart[] = [];
    for (const part of parts) {
      for (let i = 0; i < part.quantity; i++) {
        expandedParts.push({ ...part, quantity: 1 });
      }
    }

    // Sort parts by length (descending) - FFD requires this
    const sortedParts = expandedParts.sort((a, b) => b.length - a.length);

    // Available stock lengths (sorted from shortest to longest for efficiency)
    const stockLengths = [...stock.availableLengths].sort((a, b) => a - b);

    // Open bars (tracks remaining space on each bar)
    const openBars: {
      stockLength: number;
      remainingLength: number;
      cuts: LinearCutPlacement[];
      wasteSegments: LinearWasteSegment[];
    }[] = [];

    let stockIndex = 0;

    // FFD algorithm: For each part, try to fit in existing open bars
    for (const part of sortedParts) {
      const requiredLength = part.length + this.kerf;
      let placed = false;

      // Try to fit in existing open bars (First Fit)
      for (const bar of openBars) {
        if (bar.remainingLength >= requiredLength) {
          // Place part on this bar
          const startPosition = bar.stockLength - bar.remainingLength;

          bar.cuts.push({
            partId: part.partId,
            partName: part.partName,
            designItemId: part.designItemId,
            designItemName: part.designItemName,
            startPosition,
            cutLength: part.length,
            quantity: 1,
          });

          bar.remainingLength -= requiredLength;
          placed = true;
          break;
        }
      }

      // If not placed, open new bar
      if (!placed) {
        const suitableStockLength = stockLengths.find(len => len >= requiredLength);

        if (!suitableStockLength) {
          console.error(`Part ${part.partId} (${part.length}mm) too long for available stock`);
          continue;
        }

        const startPosition = 0;

        openBars.push({
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

    // Convert open bars to results
    const results: LinearCuttingResult[] = openBars.map((bar, index) => {
      const usedLength = bar.stockLength - bar.remainingLength;
      const utilizationPercent = (usedLength / bar.stockLength) * 100;

      // Calculate waste segments
      const wasteSegments: LinearWasteSegment[] = [];
      if (bar.remainingLength > 0) {
        const wasteStart = bar.stockLength - bar.remainingLength;
        wasteSegments.push({
          startPosition: wasteStart,
          length: bar.remainingLength,
          reusable: bar.remainingLength >= this.minimumUsableOffcut,
        });
      }

      return {
        id: `linear-${stock.materialId}-${index}`,
        stockIndex: index,
        stockId: stock.id,
        materialId: stock.materialId,
        materialName: stock.materialName,
        crossSection: {
          thickness: stock.profileDimensions.dimension1,
          width: stock.profileDimensions.dimension2 || stock.profileDimensions.dimension1,
        },
        stockLength: bar.stockLength,
        cuts: bar.cuts,
        utilizationPercent,
        wasteLength: bar.remainingLength,
        wasteSegments,
      };
    });

    return results;
  }
}

/**
 * Parse cross-section dimensions from a profile string.
 * Handles formats: "50x25", "50x25 SHS", "25mm Round", "50x25x3", etc.
 * Returns the two largest dimensions (for cross-section matching).
 */
function parseProfileDimensions(profile: string): { d1: number; d2: number } | null {
  // Try "NxN" pattern (e.g. "50x25", "50x25 SHS", "50x25x3")
  const dimMatch = profile.match(/(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/);
  if (dimMatch) {
    const a = parseFloat(dimMatch[1]);
    const b = parseFloat(dimMatch[2]);
    return { d1: Math.max(a, b), d2: Math.min(a, b) };
  }

  // Try single dimension (e.g. "25mm Round" → treat as d1=d2=25)
  const singleMatch = profile.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (singleMatch) {
    const d = parseFloat(singleMatch[1]);
    return { d1: d, d2: d };
  }

  return null;
}

export default LinearStockOptimizationService;
