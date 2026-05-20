/**
 * Estimate Service
 * Calculate project estimates from optimization results and material palette
 */

import {
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { nanoid } from 'nanoid';
import type {
  ConsolidatedEstimate,
  EstimateLineItem,
  EstimateConfig,
  EstimateLineItemFormData,
} from '../types/estimate';
import { DEFAULT_ESTIMATE_CONFIG } from '../types/estimate';
import type { ConsolidatedCutlist, DesignItem, ProcurementPricing, ManufacturingCost, PartEntry, SheetMaterialBreakdown, TimberMaterialBreakdown, LinearMaterialBreakdown } from '../types';
import type { ConstructionPricing } from '../types/deliverables';
import { normalizeSourcingType, PRICING_METHOD_LABELS } from '../types/deliverables';
import type { EstimationResult, MaterialPaletteEntry } from '@/shared/types';
import { getMaterial } from './materialService';
import { resolveMaterialUnitCost } from '../types/materialCost';
import type { ProjectStrategy } from '../types/strategy';
import { updateDealValueForProject } from '@/modules/crm/services/crmDealService';
import { BUDGET_TIER_MULTIPLIERS } from '../types/strategy';
import { getMaterialUnitCost } from './materialPricingService';
import {
  calculatePanelProcessingCosts,
  calculateTimberProcessingCosts,
  calculateGlassProcessingCosts,
  calculateLinearProcessingCosts,
} from '@/shared/services/optimization/ProcessingCostService';
import type { PanelPartForProcessing, TimberPartForProcessing, GlassPartForProcessing, LinearPartForProcessing } from '@/shared/services/optimization/ProcessingCostService';
import { DEFAULT_WORKSHOP_PROCESSING_RATES } from '@/shared/types/processingSteps';
import type { ProcessingCostBreakdown } from '@/shared/types/processingSteps';
import { getOrganizationSettings } from '@/core/settings/settingsService';
import { resolvePricingAssumptions } from '@/shared/types/pricingAssumptions';
import { MaterialCostCalculator } from '@/shared/services/pricing/MaterialCostCalculator';
import { resolveEffectiveLaborRate } from '@/modules/finance/services/laborRateCalculator';
import { calculatePartFeatureCost, scaleFeatureCostByQuantity } from '../utils/featureCost';
import { isCuttablePart } from '@/shared/services/optimization/cuttableParts';

// Default sheet size for material estimation (mm)
const DEFAULT_SHEET_SIZE = { length: 2440, width: 1220 };

// Round up to the nearest thousand (for competitive, clean estimate rates)
const roundUpToThousand = (n: number): number => Math.ceil(n / 1000) * 1000;

/**
 * Get budget tier multiplier for pricing adjustments
 * Priority: item.strategyContext.budgetTier > strategy.budgetFramework.tier > 'standard' (1.0x)
 *
 * When `hasAlternativeMappings` is true, the project uses real material cost
 * substitutions (via materialAlternativeService) instead of flat multipliers.
 * In that case we return 1.0 so the standard estimate reflects actual costs,
 * and the alternative estimates handle the per-tier pricing separately.
 */
function getBudgetTierMultiplier(
  item: DesignItem,
  projectStrategy: ProjectStrategy | null,
  hasAlternativeMappings?: boolean
): number {
  // When alternatives are mapped, skip flat multipliers — real costs are used instead
  if (hasAlternativeMappings) {
    return 1.0;
  }

  // 1. Check item-level strategy context
  const itemTier = item.strategyContext?.budgetTier;
  if (itemTier && itemTier in BUDGET_TIER_MULTIPLIERS) {
    return BUDGET_TIER_MULTIPLIERS[itemTier];
  }

  // 2. Fall back to project-level strategy
  const projectTier = projectStrategy?.budgetFramework?.tier;
  if (projectTier && projectTier in BUDGET_TIER_MULTIPLIERS) {
    return BUDGET_TIER_MULTIPLIERS[projectTier];
  }

  // 3. Default to standard tier (1.0x - no adjustment)
  return BUDGET_TIER_MULTIPLIERS.standard;
}

/**
 * Fetch project strategy for budget tier pricing
 */
async function fetchProjectStrategy(projectId: string): Promise<ProjectStrategy | null> {
  try {
    const strategySnapshot = await getDocs(collection(db, 'projectStrategy'));
    const strategyDoc = strategySnapshot.docs.find(d => d.id === projectId);

    if (!strategyDoc) {
      return null;
    }

    const data = strategyDoc.data();
    return {
      id: strategyDoc.id,
      projectId,
      ...data,
    } as ProjectStrategy;
  } catch (err) {
    console.warn('[Estimate] Failed to fetch project strategy:', err);
    return null;
  }
}

/**
 * Calculate sheet material breakdown from parts list
 * Groups parts by material and calculates required sheets
 * Uses MaterialPricingService for consistent price lookups
 */
export async function calculateSheetMaterialsFromParts(
  parts: PartEntry[],
  projectId: string,
  materialPalette?: MaterialPaletteEntry[]
): Promise<{ materials: SheetMaterialBreakdown[]; totalCost: number }> {
  // Group parts by material
  const materialGroups = new Map<string, {
    materialId?: string;
    materialName: string;
    thickness: number;
    parts: PartEntry[];
    totalArea: number;
  }>();

  for (const part of parts) {
    // Skip scene-origin component parts (hardware mesh nodes). Matches the
    // guard in harvestMaterials/aggregateCutlist/aggregatePartsFromProject —
    // hardware flows through the hardware schedule, not the sheet-material
    // cost rollup.
    if (!isCuttablePart(part as { partType?: string; source?: string })) {
      continue;
    }

    const key = `${part.materialName}-${part.thickness}`;
    const existing = materialGroups.get(key);
    const partArea = (part.length * part.width * part.quantity) / 1_000_000; // Convert to m²
    
    if (existing) {
      existing.parts.push(part);
      existing.totalArea += partArea;
    } else {
      materialGroups.set(key, {
        materialId: part.materialId,
        materialName: part.materialName,
        thickness: part.thickness,
        parts: [part],
        totalArea: partArea,
      });
    }
  }

  // Calculate costs for each material using pro-rated area-based costing
  // Instead of rounding up to whole sheets per design item (which overcharges
  // when multiple items share the same material across a project), we calculate:
  //   costPerM² = sheetCost / sheetArea
  //   itemCost = partArea × wasteFactor × costPerM²
  // This gives competitive per-item pricing that reflects actual material usage.
  const materials: SheetMaterialBreakdown[] = [];
  let totalCost = 0;

  for (const [, group] of materialGroups) {
    // Look up palette entry to check for custom stock sheet dimensions & cost
    const paletteEntry = materialPalette?.find(e => {
      const entryName = (e.designName || e.normalizedName || '').toLowerCase().trim();
      return entryName === group.materialName.toLowerCase().trim()
        && Math.abs((e.thickness || 0) - group.thickness) < 0.1;
    });

    // Use actual stock sheet dimensions + costPerSheet when available
    const stockSheet = paletteEntry?.stockSheets?.[0];
    const hasStockSheet = stockSheet && stockSheet.length > 0 && stockSheet.width > 0 && stockSheet.costPerSheet > 0;

    const sheetLength = hasStockSheet ? stockSheet.length : DEFAULT_SHEET_SIZE.length;
    const sheetWidth = hasStockSheet ? stockSheet.width : DEFAULT_SHEET_SIZE.width;
    const sheetArea = (sheetLength * sheetWidth) / 1_000_000;

    // Estimate sheets required (for reference/display only)
    const sheetsRequired = Math.ceil((group.totalArea * 1.15) / sheetArea);

    let unitCost: number;
    let priceSource: string;

    if (hasStockSheet) {
      // Use the costPerSheet directly — this is the real per-slab/per-sheet cost
      unitCost = stockSheet.costPerSheet;
      priceSource = 'stockSheet';
    } else {
      // Fall back to centralized MaterialPricingService
      const priceResult = await getMaterialUnitCost(
        group.materialName,
        group.thickness,
        projectId,
        materialPalette
      );
      unitCost = priceResult.cost;
      priceSource = priceResult.source;

      if (priceResult.source === 'fallback') {
        console.warn(
          `[Estimate] Using fallback price for ${group.materialName} ${group.thickness}mm (${unitCost} ${priceResult.currency})`
        );
      }
    }

    // Unit-aware cost derivation. The `costUnit` on the palette entry tells
    // us what `unitCost` is denominated in — dividing a per-m² cost by
    // sheetArea (or multiplying a per-sheet cost by m² directly) silently
    // over/undercharges by a factor of sheetArea (~2–5× depending on stock).
    // Mirrors the branching already present in alternativeEstimateService.ts.
    const costUnit = (paletteEntry?.costUnit || 'sheet').toLowerCase();
    let costPerM2: number;
    if (costUnit === 'sqm' || costUnit === 'sqft' || costUnit === 'm2') {
      // sqft normalized to sqm downstream would need a separate conversion;
      // we treat the palette as already in sqm when the unit says so.
      costPerM2 = unitCost;
    } else {
      // 'sheet' / 'slab' / undefined → divide by sheetArea (pro-rated cost per m²)
      costPerM2 = unitCost / sheetArea;
    }
    const areaWithWaste = group.totalArea * 1.15; // 15% waste factor
    const materialTotal = Math.round(areaWithWaste * costPerM2);
    totalCost += materialTotal;

    if (priceSource === 'stockSheet') {
      const denom = costUnit === 'sqm' ? 'm²' : 'sheet';
      console.log(
        `[Estimate] ${group.materialName}: using stock sheet ${sheetLength}×${sheetWidth}mm @ ${unitCost.toLocaleString()}/${denom} → ${costPerM2.toLocaleString()}/m² × ${areaWithWaste.toFixed(2)}m² = ${materialTotal.toLocaleString()}`
      );
    }

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

/**
 * Calculate material costs from parts with material-type awareness.
 *
 * Separates parts by material type (using palette materialType and partType):
 * - PANEL/GLASS/VENEER/SOLID (sheet): area-based → sheets → cost per sheet
 * - TIMBER: volumetric → m³ × costPerCubicMeter (or linear → m × costPerLinearMeter)
 * - METAL_BAR/ALUMINIUM (bar parts): linear → meters × costPerLinearMeter
 *
 * Returns breakdowns for each category separately so the UI can display
 * the correct units (sheets vs m³ vs linear m).
 */
export async function calculateMaterialCostsFromParts(
  parts: PartEntry[],
  projectId: string,
  materialPalette?: MaterialPaletteEntry[]
): Promise<{
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
}> {
  // Classify parts by material type
  const sheetParts: PartEntry[] = [];
  const timberParts: PartEntry[] = [];
  const linearParts: PartEntry[] = [];
  const slabParts: PartEntry[] = [];
  const fabricParts: PartEntry[] = [];
  const componentParts: PartEntry[] = [];

  for (const part of parts) {
    // Look up material type from palette FIRST — it takes precedence over partType
    const paletteEntry = materialPalette?.find(e => {
      const entryName = (e.designName || e.normalizedName || '').toLowerCase().trim();
      const partName = part.materialName.toLowerCase().trim();
      return entryName === partName && Math.abs((e.thickness || 0) - part.thickness) < 0.1;
    });

    const materialType = paletteEntry?.materialType;
    const pType = part.partType ?? 'sheet';

    // Component parts are always per-piece — no material calculation
    if (pType === 'component' || materialType === 'COMPONENT') {
      componentParts.push(part);
    } else if (pType === 'fabric' || materialType === 'FABRIC') {
      fabricParts.push(part);
    } else if (pType === 'slab' || (materialType === 'STONE' && pType !== 'sheet')) {
      slabParts.push(part);
    } else if (pType === 'timber' || materialType === 'TIMBER') {
      timberParts.push(part);
    } else if (materialType === 'METAL_BAR' || materialType === 'ALUMINIUM') {
      linearParts.push(part);
    } else if (materialType === 'PANEL' || materialType === 'STONE' || materialType === 'GLASS' ||
               materialType === 'SOLID' || materialType === 'VENEER') {
      sheetParts.push(part);
    } else if (pType === 'bar') {
      linearParts.push(part);
    } else {
      sheetParts.push(part);
    }
  }

  // Build calculator with org-level pricing rules
  let resolvedAssumptions;
  try {
    const orgSettings = await getOrganizationSettings('default');
    resolvedAssumptions = resolvePricingAssumptions(orgSettings?.pricingAssumptions);
  } catch {
    resolvedAssumptions = resolvePricingAssumptions(null);
  }
  const calculator = new MaterialCostCalculator(resolvedAssumptions, materialPalette || []);

  // Calculate sheet materials (uses configurable yield from pricing rules)
  let sheetMaterialsCost = 0;
  const sheetMaterials: SheetMaterialBreakdown[] = [];
  if (sheetParts.length > 0) {
    const result = await calculator.calculateSheetCosts(sheetParts, projectId, getMaterialUnitCost);
    sheetMaterials.push(...result.materials);
    sheetMaterialsCost = result.totalCost;
  }

  // Calculate timber materials (FIXED: planing allowance, kerf, yield, buffer, pricing method)
  const timberMaterials: TimberMaterialBreakdown[] = [];
  let timberMaterialsCost = 0;
  if (timberParts.length > 0) {
    const result = calculator.calculateTimberCosts(timberParts);
    timberMaterials.push(...result.materials);
    timberMaterialsCost = result.totalCost;
  }

  // Calculate linear materials (uses configurable yield/buffer from pricing rules)
  const linearMaterials: LinearMaterialBreakdown[] = [];
  let linearMaterialsCost = 0;
  if (linearParts.length > 0) {
    const result = calculator.calculateLinearCosts(linearParts);
    linearMaterials.push(...result.materials);
    linearMaterialsCost = result.totalCost;
  }

  // Calculate edging materials (uses calculator with configurable buffer)
  const edgingResult = calculator.calculateEdgingCosts(parts);
  const edgingMaterials = edgingResult.materials;
  const edgingMaterialsCost = edgingResult.totalCost;

  // Calculate slab materials (stone worktops — uses configurable yield/buffer)
  const slabMaterials: SheetMaterialBreakdown[] = [];
  let slabMaterialsCost = 0;
  if (slabParts.length > 0) {
    const result = calculator.calculateSlabCosts(slabParts);
    slabMaterials.push(...result.materials);
    slabMaterialsCost = result.totalCost;
  }

  // Calculate fabric materials (upholstery — uses configurable yield/buffer)
  const fabricMaterials: LinearMaterialBreakdown[] = [];
  let fabricMaterialsCost = 0;
  if (fabricParts.length > 0) {
    const result = calculator.calculateFabricCosts(fabricParts);
    fabricMaterials.push(...result.materials);
    fabricMaterialsCost = result.totalCost;
  }

  // Calculate component costs (bought-out per-piece)
  const componentCost = calculator.calculateComponentCost(componentParts);

  return {
    sheetMaterials,
    sheetMaterialsCost,
    timberMaterials,
    timberMaterialsCost,
    linearMaterials,
    linearMaterialsCost,
    edgingMaterials,
    edgingMaterialsCost,
    slabMaterials,
    slabMaterialsCost,
    fabricMaterials,
    fabricMaterialsCost,
    componentCost,
    totalCost: sheetMaterialsCost + timberMaterialsCost + linearMaterialsCost + edgingMaterialsCost + slabMaterialsCost + fabricMaterialsCost + componentCost,
  };
}

/**
 * Calculate labor hours based on parts complexity
 */
export function calculateLaborFromParts(
  parts: PartEntry[],
  config: EstimateConfig = DEFAULT_ESTIMATE_CONFIG
): { hours: number; cost: number } {
  let totalMinutes = 0;

  for (const part of parts) {
    // Base time per part
    let minutesPerPart = config.laborMinutesPerPart;

    // Add time for edge banding
    const edges = part.edgeBanding;
    const edgeCount = [edges?.top, edges?.bottom, edges?.left, edges?.right]
      .filter(e => e && typeof e === 'string' && e !== 'none').length;
    minutesPerPart += edgeCount * 2; // 2 minutes per edge

    // Add time for CNC operations
    if (part.hasCNCOperations) {
      minutesPerPart += 5;
    }

    totalMinutes += minutesPerPart * part.quantity;
  }

  const hours = totalMinutes / 60;
  const cost = hours * config.laborRatePerHour;

  return { hours: Math.round(hours * 10) / 10, cost: Math.round(cost) };
}

/**
 * P17 slice 2 — roll up feature-library labor across every part in an item.
 *
 * The FeatureLibrary models reusable operations (joinery, finishing,
 * hardware prep, ...) with an hours-per-operation envelope + skill /
 * intensity multipliers. Individual features get linked onto a part via
 * `PartEntry.featureIds`; this function sums their labor contribution
 * across the whole item so it can be folded into the manufacturing
 * cost alongside `calculateLaborFromParts` (which only covers the
 * generic per-part / per-edge / CNC base time).
 *
 * The computation itself lives in `../utils/featureCost.ts` — this is
 * just the plumbing that (a) walks the parts, (b) scales by each
 * part's quantity, and (c) surfaces unresolved feature ids so the UI
 * can flag stale links (e.g. a feature deleted after a part was
 * tagged). Setup time is counted ONCE per feature per part (the
 * library semantic — setup is per-introduction, not per-unit), so
 * quantity scaling only multiplies the non-setup hours.
 *
 * Pure given the library — no Firestore. Callers load the library
 * with `featureLibraryService.getFeatures()` and pass it in.
 */
export function calculateFeatureLaborFromParts(
  parts: PartEntry[],
  library: Parameters<typeof calculatePartFeatureCost>[1],
  config: EstimateConfig = DEFAULT_ESTIMATE_CONFIG,
  currency: string = 'UGX',
): {
  hours: number;
  cost: number;
  unresolvedFeatureIds: string[];
  perPart: Array<{ partId: string; hours: number; cost: number }>;
} {
  const perPart: Array<{ partId: string; hours: number; cost: number }> = [];
  const unresolvedSet = new Set<string>();
  let totalHours = 0;
  let totalCost = 0;

  for (const part of parts) {
    if (!part.featureIds || part.featureIds.length === 0) continue;

    const breakdown = calculatePartFeatureCost(part.featureIds, library, {
      laborRatePerHour: config.laborRatePerHour,
      currency,
    });
    const scaled = scaleFeatureCostByQuantity(breakdown, part.quantity ?? 1, library);

    for (const id of scaled.unresolvedFeatureIds) unresolvedSet.add(id);
    totalHours += scaled.totalHours;
    totalCost += scaled.totalLaborCost;
    perPart.push({
      partId: (part as PartEntry & { id?: string }).id ?? part.partNumber ?? part.name,
      hours: scaled.totalHours,
      cost: scaled.totalLaborCost,
    });
  }

  return {
    hours: Math.round(totalHours * 10) / 10,
    cost: Math.round(totalCost),
    unresolvedFeatureIds: Array.from(unresolvedSet),
    perPart,
  };
}

/**
 * Calculate processing costs for a design item's parts.
 *
 * Classifies parts by material type (using palette), then runs the
 * appropriate ProcessingCostService calculator for each group.
 * Returns a flat array of ProcessingCostBreakdown steps and the total.
 */
export function calculateItemProcessingCosts(
  parts: PartEntry[],
  materialPalette?: MaterialPaletteEntry[]
): { steps: ProcessingCostBreakdown[]; totalCost: number } {
  const rates = DEFAULT_WORKSHOP_PROCESSING_RATES.rates;
  const planingAllowance = DEFAULT_WORKSHOP_PROCESSING_RATES.planingAllowancePerSide;

  // Classify parts by material type (same logic as calculateMaterialCostsFromParts)
  const panelParts: PanelPartForProcessing[] = [];
  const timberParts: TimberPartForProcessing[] = [];
  const glassParts: GlassPartForProcessing[] = [];
  const linearParts: LinearPartForProcessing[] = [];

  for (const part of parts) {
    const paletteEntry = materialPalette?.find(e => {
      const entryName = (e.designName || e.normalizedName || '').toLowerCase().trim();
      const partName = part.materialName.toLowerCase().trim();
      return entryName === partName && Math.abs((e.thickness || 0) - part.thickness) < 0.1;
    });

    const materialType = paletteEntry?.materialType;

    if (materialType === 'TIMBER' || part.partType === 'timber') {
      timberParts.push({
        partId: part.id,
        partName: part.name,
        length: part.length,
        width: part.width,
        thickness: part.thickness,
        quantity: part.quantity,
        materialName: part.materialName,
        hasCNCOperations: part.hasCNCOperations,
      });
    } else if (materialType === 'GLASS') {
      glassParts.push({
        partId: part.id,
        partName: part.name,
        length: part.length,
        width: part.width,
        quantity: part.quantity,
        materialName: part.materialName,
      });
    } else if (materialType === 'METAL_BAR' || materialType === 'ALUMINIUM') {
      linearParts.push({
        partId: part.id,
        partName: part.name,
        length: part.length,
        quantity: part.quantity,
        materialName: part.materialName,
      });
    } else if (materialType === 'PANEL' || materialType === 'STONE' || materialType === 'SOLID' || materialType === 'VENEER') {
      // Palette says sheet/slab material → panel processing, even if part is flagged as 'bar'
      panelParts.push({
        partId: part.id,
        partName: part.name,
        length: part.length,
        width: part.width,
        quantity: part.quantity,
        materialName: part.materialName,
        edgeBanding: part.edgeBanding ? {
          top: part.edgeBanding.top,
          bottom: part.edgeBanding.bottom,
          left: part.edgeBanding.left,
          right: part.edgeBanding.right,
        } : undefined,
      });
    } else if (part.partType === 'bar') {
      // Bar parts WITHOUT a palette match → linear processing
      linearParts.push({
        partId: part.id,
        partName: part.name,
        length: part.length,
        quantity: part.quantity,
        materialName: part.materialName,
      });
    } else {
      // EDGE, unknown, or no palette match → panel processing (default)
      panelParts.push({
        partId: part.id,
        partName: part.name,
        length: part.length,
        width: part.width,
        quantity: part.quantity,
        materialName: part.materialName,
        edgeBanding: part.edgeBanding ? {
          top: part.edgeBanding.top,
          bottom: part.edgeBanding.bottom,
          left: part.edgeBanding.left,
          right: part.edgeBanding.right,
        } : undefined,
      });
    }
  }

  const allSteps: ProcessingCostBreakdown[] = [];

  // Panel processing: panel saw cuts + edge banding
  if (panelParts.length > 0) {
    allSteps.push(...calculatePanelProcessingCosts(panelParts, rates));
  }

  // Timber processing: planing + crosscut + rip + routing
  if (timberParts.length > 0) {
    allSteps.push(...calculateTimberProcessingCosts(timberParts, null, rates, planingAllowance));
  }

  // Glass processing: scoring
  if (glassParts.length > 0) {
    allSteps.push(...calculateGlassProcessingCosts(glassParts, rates));
  }

  // Linear stock processing: metal saw cuts
  if (linearParts.length > 0) {
    allSteps.push(...calculateLinearProcessingCosts(linearParts, rates));
  }

  // If EDGE-type palette entries have a mapped unit cost, the material cost for edging
  // is already handled by calculateMaterialCostsFromParts (edgingMaterials). Remove the
  // generic edge_banding_material processing step to prevent double-counting.
  const hasPaletteEdgeCost = (materialPalette || []).some(
    e => e.materialType === 'EDGE' && (e.unitCost || 0) > 0
  );
  const finalSteps = hasPaletteEdgeCost
    ? allSteps.filter(s => s.stepId !== 'edge_banding_material')
    : allSteps;

  const totalCost = finalSteps.reduce((sum, s) => sum + s.totalCost, 0);
  return { steps: finalSteps, totalCost };
}

/**
 * Calculate design document cost from matrix-based pricing
 */
function calculateDesignDocumentCost(item: DesignItem): {
  totalLaborCost: number;
  totalLaborHours: number;
  logisticsCost: number;
  externalStudiesCost: number;
  adminFeeAmount: number;
  grandTotal: number;
  hasValidPricing: boolean;
} {
  const architectural = item.architectural as any;

  if (!architectural) {
    return {
      totalLaborCost: 0,
      totalLaborHours: 0,
      logisticsCost: 0,
      externalStudiesCost: 0,
      adminFeeAmount: 0,
      grandTotal: 0,
      hasValidPricing: false,
    };
  }

  // Get pricing matrix and rates
  const pricingMatrix = architectural.pricingMatrix || {};
  const logistics = architectural.logistics || [];
  const externalStudies = architectural.externalStudies || [];
  const adminFeePercent = architectural.adminFeePercent || 10;

  // Hourly rates: use saved rateConfig if available, otherwise defaults (UGX)
  const defaultRates: Record<string, number> = {
    'principal': 550000,
    'senior-engineer': 440000,
    'mid-level-architect': 330000,
    'junior-drafter': 220000,
  };

  // Read saved rate config from the item (persisted from DesignDocumentPricingTab)
  const savedRateConfig = architectural.rateConfig;
  const getRateForRole = (roleId: string): number => {
    if (savedRateConfig?.roles?.length) {
      const found = savedRateConfig.roles.find((r: any) => r.id === roleId);
      if (found?.hourlyRate !== undefined) return found.hourlyRate;
    }
    return defaultRates[roleId] || 0;
  };

  const roles = ['principal', 'senior-engineer', 'mid-level-architect', 'junior-drafter'];
  const stages = ['concept', 'schematic', 'design-development', 'construction-docs'];

  // Calculate labor cost from matrix
  let totalLaborHours = 0;
  let totalLaborCost = 0;

  for (const role of roles) {
    const rate = getRateForRole(role);
    for (const stage of stages) {
      const key = `${role}_${stage}`;
      const hours = pricingMatrix[key] || 0;
      totalLaborHours += hours;
      totalLaborCost += hours * rate;
    }
  }

  // Calculate logistics cost
  const logisticsCost = logistics.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);

  // Calculate external studies with admin fee
  const externalStudiesCost = externalStudies.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
  const adminFeeAmount = externalStudiesCost * (adminFeePercent / 100);
  const externalStudiesTotalWithFee = externalStudiesCost + adminFeeAmount;

  // Grand total
  const grandTotal = totalLaborCost + logisticsCost + externalStudiesTotalWithFee;

  return {
    totalLaborCost,
    totalLaborHours,
    logisticsCost,
    externalStudiesCost,
    adminFeeAmount,
    grandTotal,
    hasValidPricing: grandTotal > 0,
  };
}

/**
 * Fetch all design items for a project
 */
async function fetchAllDesignItems(projectId: string): Promise<Array<DesignItem & { procurement?: ProcurementPricing; manufacturing?: ManufacturingCost }>> {
  const itemsRef = collection(db, 'designProjects', projectId, 'designItems');
  const snapshot = await getDocs(itemsRef);

  const items = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      sourcingType: normalizeSourcingType(data.sourcingType),
    };
  }) as Array<DesignItem & { procurement?: ProcurementPricing; manufacturing?: ManufacturingCost; construction?: ConstructionPricing }>;

  // Sort by sortOrder ascending (items without sortOrder go last)
  items.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity));

  return items;
}

/**
 * Fetch all procured items for a project
 */
async function fetchProcuredItems(projectId: string): Promise<Array<DesignItem & { procurement?: ProcurementPricing }>> {
  const itemsRef = collection(db, 'designProjects', projectId, 'designItems');
  const q = query(itemsRef, where('sourcingType', '==', 'PROCURED'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<DesignItem & { procurement?: ProcurementPricing }>;
}

/**
 * Generate estimate line items from all design items (both manufactured and procured)
 * @deprecated Use inline generation in calculateEstimateFromOptimization instead
 */
export function _generateDesignItemLineItems(
  designItems: Array<DesignItem & { procurement?: ProcurementPricing; manufacturing?: ManufacturingCost }>
): EstimateLineItem[] {
  const lineItems: EstimateLineItem[] = [];
  
  for (const item of designItems) {
    // Get the design item's required quantity for multiplication
    const requiredQuantity = item.requiredQuantity || 1;
    
    // Handle PROCURED items
    if (item.sourcingType === 'PROCURED') {
      const procurement = item.procurement;
      
      if (!procurement || !procurement.totalLandedCost || procurement.totalLandedCost === 0) {
        continue;
      }
      
      // Multiply by requiredQuantity for correct totals
      const totalQty = (procurement.quantity || 1) * requiredQuantity;
      const unitPrice = Math.round(procurement.landedCostPerUnit || 0);
      
      const landedCostLine: EstimateLineItem = {
        id: nanoid(10),
        description: `${item.name} (Procured)`,
        category: 'procurement',
        quantity: totalQty,
        unit: 'units',
        unitPrice,
        totalPrice: Math.round(unitPrice * totalQty),
        linkedDesignItemId: item.id,
      };
      
      const notes: string[] = [];
      if (procurement.vendor) {
        notes.push(`Vendor: ${procurement.vendor}`);
      }
      if (procurement.currency && procurement.exchangeRate && procurement.exchangeRate !== 1) {
        notes.push(`FX: 1 ${procurement.currency} = ${procurement.exchangeRate} ${procurement.targetCurrency || 'UGX'}`);
      }
      if (notes.length > 0) {
        landedCostLine.notes = notes.join(' | ');
      }
      
      lineItems.push(landedCostLine);
    }
    // Handle MANUFACTURED items
    else if (item.sourcingType === 'MANUFACTURED' || !item.sourcingType) {
      const manufacturing = item.manufacturing;
      
      if (!manufacturing || !manufacturing.totalCost || manufacturing.totalCost === 0) {
        continue;
      }
      
      const materialCost = manufacturing.materialCost || 0;
      const laborHours = manufacturing.laborHours || 0;
      const laborRate = manufacturing.laborRate || 0;
      const laborCost = manufacturing.laborCost || 0;
      
      // costPerUnit is per-unit; requiredQuantity is how many units are needed
      const unitPrice = Math.round(manufacturing.costPerUnit || manufacturing.totalCost || 0);
      const totalQty = requiredQuantity;
      
      const manufacturedLine: EstimateLineItem = {
        id: nanoid(10),
        description: `${item.name} (Manufactured)`,
        category: 'material', // Using 'material' category for manufactured items
        quantity: totalQty,
        unit: 'units',
        unitPrice,
        totalPrice: Math.round(unitPrice * totalQty),
        linkedDesignItemId: item.id,
      };
      
      const notes: string[] = [];
      notes.push(`Materials: ${materialCost.toLocaleString()}`);
      notes.push(`Labor: ${laborHours}hrs @ ${laborRate}/hr = ${laborCost.toLocaleString()}`);
      if (manufacturing.materialBreakdown) {
        notes.push(manufacturing.materialBreakdown);
      }
      manufacturedLine.notes = notes.join(' | ');
      
      lineItems.push(manufacturedLine);
    }
  }
  
  return lineItems;
}

/**
 * Generate estimate line items from procured items (legacy - kept for compatibility)
 */
function generateProcurementLineItems(
  procuredItems: Array<DesignItem & { procurement?: ProcurementPricing }>
): EstimateLineItem[] {
  const lineItems: EstimateLineItem[] = [];
  
  for (const item of procuredItems) {
    const procurement = item.procurement;
    
    if (!procurement || !procurement.totalLandedCost || procurement.totalLandedCost === 0) {
      continue;
    }
    
    const landedCostLine: EstimateLineItem = {
      id: nanoid(10),
      description: `${item.name} - Landed Cost (${procurement.quantity}x @ ${procurement.targetCurrency || 'UGX'} ${Math.round(procurement.landedCostPerUnit || 0).toLocaleString()}/unit)`,
      category: 'procurement',
      quantity: procurement.quantity,
      unit: 'units',
      unitPrice: Math.round(procurement.landedCostPerUnit || 0),
      totalPrice: Math.round(procurement.totalLandedCost),
      linkedDesignItemId: item.id,
    };
    
    const notes: string[] = [];
    if (procurement.vendor) {
      notes.push(`Vendor: ${procurement.vendor}`);
    }
    if (procurement.currency && procurement.exchangeRate && procurement.exchangeRate !== 1) {
      notes.push(`FX: 1 ${procurement.currency} = ${procurement.exchangeRate} ${procurement.targetCurrency || 'UGX'}`);
    }
    const breakdown: string[] = [];
    if (procurement.totalItemCost > 0) {
      breakdown.push(`Item: ${procurement.currency} ${procurement.totalItemCost.toLocaleString()}`);
    }
    if (procurement.totalLogistics && procurement.totalLogistics > 0) {
      breakdown.push(`Logistics: ${procurement.currency} ${procurement.totalLogistics.toLocaleString()}`);
    }
    if (procurement.totalCustoms && procurement.totalCustoms > 0) {
      breakdown.push(`Customs: ${procurement.currency} ${procurement.totalCustoms.toLocaleString()}`);
    }
    if (breakdown.length > 0) {
      notes.push(`Breakdown: ${breakdown.join(' + ')}`);
    }
    
    if (notes.length > 0) {
      landedCostLine.notes = notes.join(' | ');
    }
    
    lineItems.push(landedCostLine);
  }
  
  return lineItems;
}

/**
 * Calculate estimate from cutlist
 */
export async function calculateEstimate(
  projectId: string,
  _customerId: string | undefined, // Reserved for future customer-specific pricing
  cutlist: ConsolidatedCutlist,
  userId: string,
  config: EstimateConfig = DEFAULT_ESTIMATE_CONFIG
): Promise<ConsolidatedEstimate> {
  const lineItems: EstimateLineItem[] = [];

  // 1. Material costs from cutlist
  for (const group of cutlist.materialGroups) {
    let unitCost = 0;
    let materialId: string | undefined;

    // Try to get material pricing from library
    if (group.materialId) {
      try {
        const material = await getMaterial(group.materialId, 'global', undefined);
        // P12-7: resolver honours the override flag rather than trusting
        // raw pricing.unitCost verbatim.
        const resolved = material ? resolveMaterialUnitCost(material) : null;
        if (resolved) {
          unitCost = resolved.unitCost;
          materialId = material?.id;
        }
      } catch (e) {
        // Material not found, use 0
      }
    }

    // If no pricing, estimate based on area (fallback)
    if (unitCost === 0) {
      // Default price per sheet based on thickness
      const defaultPrices: Record<number, number> = {
        3: 1500,
        6: 2000,
        9: 2500,
        12: 3000,
        15: 3500,
        16: 3800,
        18: 4200,
        22: 5000,
        25: 5500,
      };
      unitCost = defaultPrices[group.thickness] || 4000;
    }

    const totalPrice = group.estimatedSheets * unitCost;

    const item: EstimateLineItem = {
      id: nanoid(10),
      description: `${group.materialName} (${group.thickness}mm)`,
      category: 'material',
      quantity: group.estimatedSheets,
      unit: 'sheets',
      unitPrice: unitCost,
      totalPrice,
    };
    // Only add linkedMaterialId if it exists (Firestore doesn't accept undefined)
    if (materialId) {
      item.linkedMaterialId = materialId;
    }
    lineItems.push(item);
  }

  // 2. Labor costs
  const laborHours = (cutlist.totalParts * config.laborMinutesPerPart) / 60;
  const laborCost = laborHours * config.laborRatePerHour;

  lineItems.push({
    id: nanoid(10),
    description: 'Shop Labor',
    category: 'labor',
    quantity: Math.round(laborHours * 10) / 10,
    unit: 'hours',
    unitPrice: config.laborRatePerHour,
    totalPrice: Math.round(laborCost),
  });

  // 3. Procured items (fetch from project)
  const procuredItems = await fetchProcuredItems(projectId);
  const procurementLineItems = generateProcurementLineItems(procuredItems);
  lineItems.push(...procurementLineItems);

  // Apply overhead + margin markup to each line item's unit price
  // These are internal adjustments - the client sees the adjusted price directly
  const overheadMultiplier = 1 + config.overheadPercent;
  const marginMultiplier = 1 + config.defaultMarginPercent;
  const totalMarkup = overheadMultiplier * marginMultiplier;

  const markedUpLineItems = lineItems.map(item => {
    const markedUpUnit = roundUpToThousand(item.unitPrice * totalMarkup);
    return {
      ...item,
      unitPrice: markedUpUnit,
      totalPrice: markedUpUnit * item.quantity,
    };
  });

  // Subtotal = sum of marked-up line items (OH + margin already included)
  const subtotal = markedUpLineItems.reduce((sum, li) => sum + li.totalPrice, 0);
  const taxAmount = Math.round(subtotal * config.defaultTaxRate);

  // Track base amounts internally for reference
  const baseSubtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);
  const overheadAmount = Math.round(baseSubtotal * config.overheadPercent);
  const marginAmount = Math.round((baseSubtotal + overheadAmount) * config.defaultMarginPercent);

  const estimate: ConsolidatedEstimate = {
    generatedAt: Timestamp.now() as any,
    generatedBy: userId,
    isStale: false,
    lastCutlistUpdate: cutlist.generatedAt as any,
    lineItems: markedUpLineItems, // Unit prices include OH + margin
    subtotal: Math.round(subtotal),
    taxRate: config.defaultTaxRate,
    taxAmount,
    total: Math.round(subtotal + taxAmount),
    currency: config.currency,
    overheadPercent: config.overheadPercent,
    overheadAmount,
    marginPercent: config.defaultMarginPercent,
    marginAmount,
    taxMode: 'exclusive',
    // Ensure errorChecks is always defined (empty array if no errors)
    errorChecks: [],
    hasErrors: false,
  };

  // Save to project document - filter out undefined values
  const projectRef = doc(db, 'designProjects', projectId);
  const estimateForFirestore = Object.fromEntries(
    Object.entries(estimate).filter(([_, v]) => v !== undefined)
  );
  await updateDoc(projectRef, {
    consolidatedEstimate: {
      ...estimateForFirestore,
      generatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Update linked CRM deal value (fire-and-forget, don't block estimate generation)
  updateDealValueForProject(projectId, estimate.total, estimate.currency, 'estimate', userId)
    .catch((err) => console.warn('[EstimateService] Failed to update CRM deal value:', err));

  // Auto-update RAG cost validation for manufacturing items
  try {
    const { autoUpdateRAGForItems } = await import('./ragAutoUpdateService');
    const itemIds = [...new Set(
      cutlist.materialGroups.flatMap(g => g.parts.map(p => p.designItemId))
    )].filter(Boolean);
    if (itemIds.length > 0) {
      await autoUpdateRAGForItems(projectId, 'estimate-calculated', itemIds, userId);
    }
  } catch (err) {
    console.warn('[EstimateService] Auto-RAG update failed:', err);
  }

  return estimate;
}

/**
 * Calculate estimate from optimization results and material palette
 * This is the unified approach that uses per-design-item costing
 * Overhead and margin are applied to each line item's rate (not as separate line items)
 */
export async function calculateEstimateFromOptimization(
  projectId: string,
  estimation: EstimationResult,
  _materialPalette: MaterialPaletteEntry[], // Material costs already in estimation
  userId: string,
  config: EstimateConfig = DEFAULT_ESTIMATE_CONFIG,
  taxMode: 'exclusive' | 'inclusive' = 'exclusive'
): Promise<ConsolidatedEstimate> {
  // NEW ARCHITECTURE: Generate per-design-item line items
  // Each design item becomes a line item with its unit cost × requiredQuantity
  // This ensures: Design Item Costing Tab total × qty = Estimation line item

  // Fetch project strategy for budget tier pricing
  const projectStrategy = await fetchProjectStrategy(projectId);

  // Check if palette has any material alternative mappings
  // When alternatives exist, skip flat budget tier multipliers — real costs are used
  const hasAlternativeMappings = _materialPalette.some(
    entry => entry.alternatives && entry.alternatives.length > 0
  );

  const allDesignItems = await fetchAllDesignItems(projectId);
  const baseLineItems: EstimateLineItem[] = [];
  const errorChecks: { itemId: string; itemName: string; issue: string }[] = [];

  // Track budget allocations for summary
  let totalAllocated = 0;
  let itemsOverBudget = 0;

  // Generate line items for ALL design items (manufactured + procured + design documents)
  for (const item of allDesignItems) {
    const requiredQuantity = item.requiredQuantity || 1;

    // Get budget tier multiplier for this item
    const tierMultiplier = getBudgetTierMultiplier(item, projectStrategy, hasAlternativeMappings);

    // Track allocated budget from strategyContext
    const allocatedBudget = item.budgetTracking?.allocatedBudget || 0;
    if (allocatedBudget > 0) {
      totalAllocated += allocatedBudget;
    }

    if (item.sourcingType === 'PROCURED') {
      // PROCURED items: use procurement pricing
      const procurement = item.procurement;

      if (!procurement || !procurement.totalLandedCost || procurement.totalLandedCost === 0) {
        errorChecks.push({
          itemId: item.id,
          itemName: item.name,
          issue: 'Missing procurement pricing',
        });
        continue;
      }

      // Apply budget tier multiplier to unit cost
      // quantity = procurement.quantity (how many per set) × requiredQuantity (how many sets)
      const procQty = procurement.quantity || 1;
      const totalQty = procQty * requiredQuantity;
      const baseUnitCost = Math.round(procurement.landedCostPerUnit || 0);
      const unitCost = Math.round(baseUnitCost * tierMultiplier);
      const extendedCost = unitCost * totalQty;

      // Check if over allocated budget
      if (allocatedBudget > 0 && extendedCost > allocatedBudget) {
        itemsOverBudget++;
      }

      // Build notes showing the cost breakdown
      const procNotes: string[] = [];
      procNotes.push(`${procQty} × ${baseUnitCost.toLocaleString()}/unit`);
      if (procurement.vendor) procNotes.push(`Vendor: ${procurement.vendor}`);
      if (procurement.currency && procurement.exchangeRate && procurement.exchangeRate !== 1) {
        procNotes.push(`FX: 1 ${procurement.currency} = ${procurement.exchangeRate} ${procurement.targetCurrency || 'UGX'}`);
      }

      baseLineItems.push({
        id: nanoid(10),
        description: item.name,
        category: 'procurement',
        quantity: totalQty,
        unit: 'units',
        unitPrice: unitCost,
        totalPrice: extendedCost,
        linkedDesignItemId: item.id,
        notes: procNotes.join(' | '),
      });
    } else if (item.sourcingType === 'DESIGN_DOCUMENT') {
      // DESIGN_DOCUMENT items: use matrix-based pricing from architectural field
      const designDocCost = calculateDesignDocumentCost(item);

      if (!designDocCost.hasValidPricing) {
        errorChecks.push({
          itemId: item.id,
          itemName: item.name,
          issue: 'Missing design document pricing - go to Pricing tab and enter hours in the matrix',
        });
        continue;
      }

      // Apply budget tier multiplier to unit cost
      const baseUnitCost = Math.round(designDocCost.grandTotal);
      const unitCost = Math.round(baseUnitCost * tierMultiplier);
      const extendedCost = unitCost * requiredQuantity;

      // Check if over allocated budget
      if (allocatedBudget > 0 && extendedCost > allocatedBudget) {
        itemsOverBudget++;
      }

      // Build cost breakdown notes
      const breakdown: string[] = [];
      if (designDocCost.totalLaborHours > 0) {
        breakdown.push(`Labor: ${designDocCost.totalLaborHours.toFixed(1)} hrs = ${designDocCost.totalLaborCost.toLocaleString()}`);
      }
      if (designDocCost.logisticsCost > 0) {
        breakdown.push(`Logistics: ${designDocCost.logisticsCost.toLocaleString()}`);
      }
      if (designDocCost.externalStudiesCost > 0) {
        breakdown.push(`Studies: ${designDocCost.externalStudiesCost.toLocaleString()} + Admin: ${designDocCost.adminFeeAmount.toLocaleString()}`);
      }

      baseLineItems.push({
        id: nanoid(10),
        description: item.name,
        category: 'labor', // Design documents are labor-based
        quantity: requiredQuantity,
        unit: 'project',
        unitPrice: unitCost,
        totalPrice: extendedCost,
        linkedDesignItemId: item.id,
        ...(breakdown.length > 0 && { notes: breakdown.join(' | ') }),
      });
    } else if (item.sourcingType === 'CONSTRUCTION') {
      // CONSTRUCTION items: use construction pricing (unit-based + labor + materials)
      const construction = (item as any).construction as ConstructionPricing | undefined;

      if (!construction || !construction.totalCost || construction.totalCost === 0) {
        errorChecks.push({
          itemId: item.id,
          itemName: item.name,
          issue: 'Missing construction pricing - go to Pricing tab and enter costs',
        });
        continue;
      }

      // Determine line item quantity, unit, and unit price based on pricing method.
      // For measured/day_works, surface the internal quantity so the estimate
      // reads "15 sqm @ rate" instead of "1 lot @ lump total".
      let lineQty = requiredQuantity;
      let lineUnit = 'lot';
      let baseUnitCost = Math.round(construction.totalCost);

      if (construction.pricingMethod === 'measured' && construction.quantity > 0) {
        // BOQ-style: show internal quantity × unit. Derive blended unit rate
        // (totalCost / qty) so labor, materials, VAT are amortised per unit.
        const internalQty = construction.quantity;
        lineQty = internalQty * requiredQuantity;
        lineUnit = construction.unitType || 'units';
        baseUnitCost = Math.round(construction.totalCost / internalQty);
      } else if (construction.pricingMethod === 'day_works' && (construction.laborDays || 0) > 0) {
        // Day works: show days as quantity
        const days = construction.laborDays || 1;
        lineQty = days * requiredQuantity;
        lineUnit = 'days';
        baseUnitCost = Math.round(construction.totalCost / days);
      } else if (construction.pricingMethod === 'contractor_quote' && construction.quoteLineItems?.length) {
        // Contractor quote with line items: show number of line items
        lineQty = requiredQuantity;
        lineUnit = 'lot';
        baseUnitCost = Math.round(construction.totalCost);
      }
      // For lump_sum, cost_plus, composite, legacy: keep as "1 × lot" (or requiredQuantity × lot)

      // Apply budget tier multiplier
      const unitCost = Math.round(baseUnitCost * tierMultiplier);
      const extendedCost = unitCost * lineQty;

      // Check if over allocated budget
      if (allocatedBudget > 0 && extendedCost > allocatedBudget) {
        itemsOverBudget++;
      }

      // Build cost breakdown notes (method-aware)
      const breakdown: string[] = [];

      if (construction.pricingMethod) {
        breakdown.push(`Method: ${PRICING_METHOD_LABELS[construction.pricingMethod]}`);
      }

      switch (construction.pricingMethod) {
        case 'measured':
          if (construction.quantity && construction.unitRate) {
            breakdown.push(`${construction.quantity} ${construction.unitType || 'units'} × ${construction.currency || ''} ${construction.unitRate.toLocaleString()}`);
          }
          if (construction.laborCost) breakdown.push(`Labor: ${construction.laborCost.toLocaleString()}`);
          if (construction.materialsCost) breakdown.push(`Materials: ${construction.materialsCost.toLocaleString()}`);
          break;
        case 'lump_sum':
          breakdown.push(`Lump Sum: ${(construction.lumpSumAmount || 0).toLocaleString()}`);
          break;
        case 'day_works':
          if (construction.laborDays && construction.laborDailyRate) {
            breakdown.push(`${construction.laborDays} days @ ${construction.laborDailyRate.toLocaleString()}/day`);
          }
          if (construction.materialsCost) breakdown.push(`Materials: ${construction.materialsCost.toLocaleString()}`);
          break;
        case 'cost_plus':
          if (construction.laborCost) breakdown.push(`Labor: ${construction.laborCost.toLocaleString()}`);
          if (construction.materialsCost) breakdown.push(`Materials: ${construction.materialsCost.toLocaleString()}`);
          if (construction.managementFeePercent) {
            breakdown.push(`Fee: ${(construction.managementFeePercent * 100).toFixed(0)}%`);
          }
          break;
        case 'contractor_quote':
          if (construction.contractor) breakdown.push(`Contractor: ${construction.contractor}`);
          if (construction.quoteLineItems?.length) {
            breakdown.push(`${construction.quoteLineItems.length} line items`);
          }
          break;
        case 'composite':
          if (construction.subItems?.length) {
            breakdown.push(`${construction.subItems.length} sub-items`);
          }
          break;
        default:
          // Legacy format
          if (construction.quantity && construction.unitRate) {
            breakdown.push(`Units: ${construction.quantity} × ${construction.currency || ''} ${construction.unitRate.toLocaleString()}`);
          }
          if (construction.laborCost) breakdown.push(`Labor: ${construction.laborCost.toLocaleString()}`);
          if (construction.materialsCost) breakdown.push(`Materials: ${construction.materialsCost.toLocaleString()}`);
          if (construction.contractor) breakdown.push(`Contractor: ${construction.contractor}`);
          break;
      }

      baseLineItems.push({
        id: nanoid(10),
        description: item.name,
        category: 'construction',
        quantity: lineQty,
        unit: lineUnit,
        unitPrice: unitCost,
        totalPrice: extendedCost,
        linkedDesignItemId: item.id,
        ...(breakdown.length > 0 && { notes: breakdown.join(' | ') }),
      });
    } else {
      // CUSTOM_FURNITURE_MILLWORK (and legacy MANUFACTURED) items: use manufacturing.costPerUnit from Costing tab
      const manufacturing = item.manufacturing;

      // Check if manufacturing data exists with valid costs
      // Note: 0 is a valid cost (e.g., for items with no material cost), so check explicitly for undefined/null
      const hasCostPerUnit = manufacturing?.costPerUnit !== undefined && manufacturing?.costPerUnit !== null;
      const hasTotalCost = manufacturing?.totalCost !== undefined && manufacturing?.totalCost !== null;

      if (!manufacturing || (!hasCostPerUnit && !hasTotalCost)) {
        errorChecks.push({
          itemId: item.id,
          itemName: item.name,
          issue: 'Missing manufacturing cost - go to Costing Summary tab and click Save Costing',
        });
        continue;
      }

      // costPerUnit is per-unit cost (parts define one unit); totalCost is the same when quantity=1
      const baseUnitCost = Math.round(manufacturing.costPerUnit || manufacturing.totalCost || 0);

      // Apply budget tier multiplier to unit cost
      const unitCost = Math.round(baseUnitCost * tierMultiplier);
      const extendedCost = unitCost * requiredQuantity;

      // Check if over allocated budget
      if (allocatedBudget > 0 && extendedCost > allocatedBudget) {
        itemsOverBudget++;
      }

      // Build cost breakdown notes
      const breakdown: string[] = [];
      breakdown.push(`Cost/unit: ${baseUnitCost.toLocaleString()}`);
      if (requiredQuantity > 1) breakdown.push(`Qty: ${requiredQuantity}`);
      if (manufacturing.sheetMaterialsCost) breakdown.push(`Sheets: ${manufacturing.sheetMaterialsCost.toLocaleString()}`);
      if (manufacturing.timberMaterialsCost) breakdown.push(`Timber: ${manufacturing.timberMaterialsCost.toLocaleString()}`);
      if (manufacturing.linearMaterialsCost) breakdown.push(`Linear: ${manufacturing.linearMaterialsCost.toLocaleString()}`);
      if ((manufacturing as any).edgingMaterialsCost) breakdown.push(`Edging: ${(manufacturing as any).edgingMaterialsCost.toLocaleString()}`);
      if (manufacturing.standardPartsCost) breakdown.push(`Std Parts: ${manufacturing.standardPartsCost.toLocaleString()}`);
      if (manufacturing.specialPartsCost) breakdown.push(`Spc Parts: ${manufacturing.specialPartsCost.toLocaleString()}`);
      if (manufacturing.processingCost) breakdown.push(`Processing: ${manufacturing.processingCost.toLocaleString()}`);
      if (manufacturing.laborCost) breakdown.push(`Labor: ${manufacturing.laborCost.toLocaleString()}`);

      baseLineItems.push({
        id: nanoid(10),
        description: item.name,
        category: 'material', // Manufactured items
        quantity: requiredQuantity,
        unit: 'units',
        unitPrice: unitCost,
        totalPrice: extendedCost,
        linkedDesignItemId: item.id,
        ...(breakdown.length > 0 && { notes: breakdown.join(' | ') }),
      });
    }
  }
  
  // Apply overhead + margin markup to each line item's unit price
  // These are internal adjustments - the client sees the adjusted price directly
  const overheadMultiplier = 1 + config.overheadPercent;
  const marginMultiplier = 1 + config.defaultMarginPercent;
  const totalMarkup = overheadMultiplier * marginMultiplier;

  const lineItems: EstimateLineItem[] = baseLineItems.map(item => {
    const markedUpUnit = roundUpToThousand(item.unitPrice * totalMarkup);
    return {
      ...item,
      unitPrice: markedUpUnit,
      totalPrice: markedUpUnit * item.quantity,
    };
  });

  // Subtotal = sum of marked-up line items (OH + margin already included)
  const subtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);

  // Track base amounts internally for reference
  const baseSubtotal = baseLineItems.reduce((sum, li) => sum + li.totalPrice, 0);
  const overheadAmount = Math.round(baseSubtotal * config.overheadPercent);
  const marginAmount = Math.round((baseSubtotal + overheadAmount) * config.defaultMarginPercent);

  // Calculate tax based on mode
  let taxAmount: number;
  let total: number;

  if (taxMode === 'inclusive') {
    taxAmount = Math.round(subtotal - (subtotal / (1 + config.defaultTaxRate)));
    total = subtotal;
  } else {
    taxAmount = Math.round(subtotal * config.defaultTaxRate);
    total = subtotal + taxAmount;
  }

  // Calculate budget summary if we have allocated budgets
  const budgetSummary = totalAllocated > 0 ? {
    totalAllocated,
    totalActual: Math.round(total),
    variance: Math.round(total) - totalAllocated,
    variancePercent: Math.round(((Math.round(total) - totalAllocated) / totalAllocated) * 100),
    itemsOverBudget,
    ...(projectStrategy?.budgetFramework?.tier && { budgetTier: projectStrategy.budgetFramework.tier }),
  } : undefined;

  const estimate: ConsolidatedEstimate = {
    generatedAt: Timestamp.now() as any,
    generatedBy: userId,
    isStale: false,
    lastCutlistUpdate: estimation?.validAt as any, // Use optimization validAt
    lineItems,
    subtotal: Math.round(subtotal),
    taxRate: config.defaultTaxRate,
    taxAmount,
    total: Math.round(total),
    currency: config.currency,
    overheadPercent: config.overheadPercent,
    overheadAmount,
    marginPercent: config.defaultMarginPercent,
    marginAmount,
    taxMode,
    // Error checking data - use empty array instead of undefined (Firestore doesn't accept undefined)
    errorChecks: errorChecks.length > 0 ? errorChecks : [],
    designItemCount: allDesignItems.length,
    lineItemCount: baseLineItems.length,
    hasErrors: errorChecks.length > 0,
    // Material alternative flag
    hasAlternatives: hasAlternativeMappings,
    qualityTier: 'standard' as const,
    // Budget tracking summary
    ...(budgetSummary && { budgetSummary }),
  };

  // Save to project document - filter out any undefined values
  const projectRef = doc(db, 'designProjects', projectId);
  const estimateForFirestore = Object.fromEntries(
    Object.entries(estimate).filter(([_, v]) => v !== undefined)
  );
  await updateDoc(projectRef, {
    consolidatedEstimate: {
      ...estimateForFirestore,
      generatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Update linked CRM deal value (fire-and-forget, don't block estimate generation)
  updateDealValueForProject(projectId, estimate.total, estimate.currency, 'estimate', userId)
    .catch((err) => console.warn('[EstimateService] Failed to update CRM deal value:', err));

  // Auto-update RAG cost validation for manufacturing items
  try {
    const { autoUpdateRAGForItems } = await import('./ragAutoUpdateService');
    const mfgItemIds = allDesignItems
      .filter(i => !i.sourcingType || i.sourcingType === 'MANUFACTURED' || i.sourcingType === 'CUSTOM_FURNITURE_MILLWORK')
      .map(i => i.id);
    if (mfgItemIds.length > 0) {
      await autoUpdateRAGForItems(projectId, 'estimate-calculated', mfgItemIds, userId);
    }
  } catch (err) {
    console.warn('[EstimateService] Auto-RAG update failed:', err);
  }

  // Auto-regenerate alternative estimates if material alternatives are mapped
  if (hasAlternativeMappings) {
    import('./alternativeEstimateService')
      .then(({ generateAlternativeEstimates }) =>
        generateAlternativeEstimates(projectId, estimate, userId, config)
      )
      .then(() => console.log('[EstimateService] Alternative estimates auto-regenerated'))
      .catch((err) => console.warn('[EstimateService] Alternative estimate regeneration failed:', err));
  }

  return estimate;
}

/**
 * Add manual line item to estimate
 */
export async function addEstimateLineItem(
  projectId: string,
  currentEstimate: ConsolidatedEstimate,
  itemData: EstimateLineItemFormData,
  userId: string
): Promise<ConsolidatedEstimate> {
  const newItem: EstimateLineItem = {
    id: nanoid(10),
    description: itemData.description,
    category: itemData.category,
    quantity: itemData.quantity,
    unit: itemData.unit,
    unitPrice: itemData.unitPrice,
    totalPrice: itemData.quantity * itemData.unitPrice,
    isManual: true,
  };
  // Only add notes if it exists (Firestore doesn't accept undefined)
  if (itemData.notes) {
    newItem.notes = itemData.notes;
  }

  const lineItems = [...currentEstimate.lineItems, newItem];
  return await recalculateAndSave(projectId, currentEstimate, lineItems, userId);
}

/**
 * Update a line item
 */
export async function updateEstimateLineItem(
  projectId: string,
  currentEstimate: ConsolidatedEstimate,
  itemId: string,
  updates: Partial<EstimateLineItemFormData>,
  userId: string
): Promise<ConsolidatedEstimate> {
  const lineItems = currentEstimate.lineItems.map((item) => {
    if (item.id !== itemId) return item;
    
    const updated = {
      ...item,
      ...updates,
      totalPrice: (updates.quantity ?? item.quantity) * (updates.unitPrice ?? item.unitPrice),
    };
    return updated;
  });

  return await recalculateAndSave(projectId, currentEstimate, lineItems, userId);
}

/**
 * Remove a line item
 */
export async function removeEstimateLineItem(
  projectId: string,
  currentEstimate: ConsolidatedEstimate,
  itemId: string,
  userId: string
): Promise<ConsolidatedEstimate> {
  const lineItems = currentEstimate.lineItems.filter((item) => item.id !== itemId);
  return await recalculateAndSave(projectId, currentEstimate, lineItems, userId);
}

/**
 * Recalculate totals and save
 */
async function recalculateAndSave(
  projectId: string,
  currentEstimate: ConsolidatedEstimate,
  lineItems: EstimateLineItem[],
  userId: string
): Promise<ConsolidatedEstimate> {
  // Line items already have OH + margin baked into unitPrice/totalPrice
  // Subtotal = sum of line items (markup already included)
  const subtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);

  // Reverse-calculate base amounts for internal tracking
  const overheadPercent = currentEstimate.overheadPercent || 0;
  const marginPercent = currentEstimate.marginPercent || 0;
  const totalMarkup = (1 + overheadPercent) * (1 + marginPercent);
  const baseSubtotal = totalMarkup > 0 ? Math.round(subtotal / totalMarkup) : subtotal;
  const overheadAmount = Math.round(baseSubtotal * overheadPercent);
  const marginAmount = Math.round((baseSubtotal + overheadAmount) * marginPercent);

  const taxMode = currentEstimate.taxMode || 'exclusive';
  let taxAmount: number;
  let total: number;

  if (taxMode === 'inclusive') {
    taxAmount = Math.round(subtotal - (subtotal / (1 + currentEstimate.taxRate)));
    total = subtotal;
  } else {
    taxAmount = Math.round(subtotal * currentEstimate.taxRate);
    total = subtotal + taxAmount;
  }

  const estimate: ConsolidatedEstimate = {
    ...currentEstimate,
    lineItems,
    subtotal: Math.round(subtotal),
    taxAmount,
    overheadAmount,
    marginAmount,
    total: Math.round(total),
    // Ensure errorChecks is never undefined
    errorChecks: currentEstimate.errorChecks || [],
  };

  // Filter out undefined values before saving to Firestore
  const estimateForFirestore = Object.fromEntries(
    Object.entries(estimate).filter(([_, v]) => v !== undefined)
  );

  const projectRef = doc(db, 'designProjects', projectId);
  await updateDoc(projectRef, {
    consolidatedEstimate: estimateForFirestore,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return estimate;
}

/**
 * Mark estimate as stale
 */
export async function markEstimateStale(
  projectId: string,
  reason: string
): Promise<void> {
  const projectRef = doc(db, 'designProjects', projectId);
  await updateDoc(projectRef, {
    'consolidatedEstimate.isStale': true,
    'consolidatedEstimate.staleReason': reason,
    'alternativeEstimates.isStale': true,
  });
}

/**
 * Export estimate to CSV
 */
export function exportEstimateCSV(estimate: ConsolidatedEstimate): string {
  const headers = ['Category', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Total'];
  const rows = estimate.lineItems.map((item) => [
    item.category,
    item.description,
    item.quantity.toString(),
    item.unit,
    item.unitPrice.toFixed(2),
    item.totalPrice.toFixed(2),
  ]);

  // Add totals
  rows.push(['', '', '', '', 'Subtotal', estimate.subtotal.toFixed(2)]);
  rows.push(['', '', '', '', `Tax (${estimate.taxRate * 100}%)`, estimate.taxAmount.toFixed(2)]);
  if (estimate.marginAmount) {
    rows.push(['', '', '', '', `Margin (${(estimate.marginPercent || 0) * 100}%)`, estimate.marginAmount.toFixed(2)]);
  }
  rows.push(['', '', '', '', 'TOTAL', estimate.total.toFixed(2)]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Download CSV
 */
export function downloadEstimateCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Batch recalculate manufacturing costs for all manufactured items in a project.
 * Iterates through items with stale or missing costs, auto-calculates from parts,
 * and saves updated manufacturing data.
 *
 * @returns Summary of recalculation results
 */
export async function batchRecalculateItemCosts(
  projectId: string,
  userId: string,
  onProgress?: (current: number, total: number, itemName: string) => void
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const itemsSnapshot = await getDocs(collection(db, 'designProjects', projectId, 'designItems'));
  const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // Get material palette for pricing
  const projectDoc = await getDocs(query(collection(db, 'designProjects'), where('__name__', '==', projectId)));
  const projectData = projectDoc.docs[0]?.data();
  const materialPalette = projectData?.materialPalette?.entries || [];

  // Resolve org-level labor rate with live payroll recalculation.
  let orgLaborRate = DEFAULT_ESTIMATE_CONFIG.laborRatePerHour;
  try {
    const orgSettings = await getOrganizationSettings('default');
    orgLaborRate = await resolveEffectiveLaborRate({
      assumptions: orgSettings?.pricingAssumptions,
      fallbackRate: DEFAULT_ESTIMATE_CONFIG.laborRatePerHour,
    });
  } catch {
    // Fall back to hardcoded default if org settings unavailable
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const manufacturingItems = items.filter(item => {
    const st = ((item as any).sourcingType || '').toUpperCase();
    return !st || st === 'MANUFACTURED' || st === 'CUSTOM_FURNITURE_MILLWORK';
  });

  for (let i = 0; i < manufacturingItems.length; i++) {
    const item = manufacturingItems[i] as any;
    const parts: PartEntry[] = item.parts || [];

    onProgress?.(i + 1, manufacturingItems.length, item.name || item.itemCode || 'Unknown');

    if (parts.length === 0) {
      skipped++;
      continue;
    }

    try {
      // Use material-type-aware calculation (timber=m³, linear=m, panels=sheets)
      const matResult = await calculateMaterialCostsFromParts(
        parts, projectId, materialPalette
      );
      const labor = calculateLaborFromParts(parts);

      const standardPartsCost = (item.manufacturing?.standardParts || [])
        .reduce((sum: number, p: any) => sum + (p.quantity * (p.unitCost || 0)), 0);
      const specialPartsCost = (item.manufacturing?.specialParts || [])
        .reduce((sum: number, p: any) => sum + (p.quantity * (p.unitCost || 0)), 0);

      const totalMaterialCost = matResult.totalCost + standardPartsCost + specialPartsCost;
      const laborRate = item.manufacturing?.laborRate || orgLaborRate;
      const laborCost = labor.hours * laborRate;

      // Calculate processing costs (panel saw, edge banding, planing, etc.)
      const processing = calculateItemProcessingCosts(parts, materialPalette);
      const processingCost = processing.totalCost;

      const totalCost = totalMaterialCost + processingCost + laborCost;
      // totalCost is already per-unit (calculated from parts which define ONE unit)
      // Do NOT divide by requiredQuantity — that's a project-level multiplier applied in estimate generation
      const costPerUnit = totalCost;

      const itemRef = doc(db, 'designProjects', projectId, 'designItems', item.id);
      const updateData: Record<string, any> = {
        'manufacturing.sheetMaterials': matResult.sheetMaterials,
        'manufacturing.sheetMaterialsCost': matResult.sheetMaterialsCost,
        'manufacturing.timberMaterials': matResult.timberMaterials,
        'manufacturing.timberMaterialsCost': matResult.timberMaterialsCost,
        'manufacturing.linearMaterials': matResult.linearMaterials,
        'manufacturing.linearMaterialsCost': matResult.linearMaterialsCost,
        'manufacturing.edgingMaterials': matResult.edgingMaterials,
        'manufacturing.edgingMaterialsCost': matResult.edgingMaterialsCost,
        'manufacturing.slabMaterials': matResult.slabMaterials,
        'manufacturing.slabMaterialsCost': matResult.slabMaterialsCost,
        'manufacturing.fabricMaterials': matResult.fabricMaterials,
        'manufacturing.fabricMaterialsCost': matResult.fabricMaterialsCost,
        'manufacturing.componentCost': matResult.componentCost,
        'manufacturing.materialCost': totalMaterialCost,
        'manufacturing.processingSteps': processing.steps.map(s => ({
          stepId: s.stepId,
          label: s.label,
          quantity: s.quantity,
          unit: s.unit,
          ratePerUnit: s.ratePerUnit,
          totalCost: s.totalCost,
        })),
        'manufacturing.processingCost': processingCost,
        'manufacturing.laborHours': labor.hours,
        'manufacturing.laborRate': laborRate,
        'manufacturing.laborCost': laborCost,
        'manufacturing.totalCost': totalCost,
        'manufacturing.costPerUnit': costPerUnit,
        'manufacturing.quantity': 1, // Parts define one unit; requiredQuantity is on the design item
        'manufacturing.autoCalculated': true,
        'manufacturing.lastAutoCalcAt': serverTimestamp(),
        'manufacturing.estimatedAt': serverTimestamp(),
        'manufacturing.estimatedBy': userId,
      };
      await updateDoc(itemRef, updateData);

      updated++;
    } catch (err) {
      const msg = `${item.name || item.id}: ${err instanceof Error ? err.message : 'Unknown error'}`;
      errors.push(msg);
    }
  }

  return { updated, skipped, errors };
}
