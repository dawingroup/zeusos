/**
 * Estimation Bridge Service
 *
 * Thin adapter between Design Studio's PDD BOM and Design Manager's
 * estimation engine. This service does NOT contain any pricing logic —
 * all pricing comes from Design Manager's materialPricingService and
 * estimateService.
 *
 * Flow: PDD BOM → getMaterialUnitCost() for each line → PricingBreakdown
 */
import { getMaterialUnitCost } from '@/modules/design-manager/services/materialPricingService';
import type { ComputedBOMLine, PricingBreakdown, PricingLineItem } from '../types/constraintEngine.types';
import type { ProductDefinitionDocument } from '../types/productDefinition.types';
import { TAX_RATES } from '../constants/estimation.constants';

/**
 * Compute pricing for BOM lines using Design Manager's material pricing service.
 *
 * Uses getMaterialUnitCost() which implements 3-tier fallback:
 *   1. Material Palette (project-specific)
 *   2. Inventory costPrice
 *   3. Material Service / hardcoded defaults
 */
export async function computePricingFromBOM(
  pdd: ProductDefinitionDocument,
  bom: ComputedBOMLine[],
  projectId?: string,
): Promise<PricingBreakdown> {
  const currency = pdd.pricingConfig?.currencyOverride ?? 'UGX';
  const overheadPercent = pdd.pricingConfig?.overheadPercent ?? 15;
  const marginPercent = pdd.pricingConfig?.marginPercent ?? 25;

  let materialsCost = 0;
  let edgeBandingCost = 0;
  let hardwareCost = 0;
  let laborCost = 0;
  const lineItems: PricingLineItem[] = [];

  for (const line of bom) {
    const cat = line.materialCategory.toLowerCase();

    // Get real pricing from Design Manager's 3-tier fallback
    let unitCost = line.unitCost;
    if (unitCost === 0) {
      try {
        const priceResult = await getMaterialUnitCost(
          line.inventoryItemName || line.materialCategory,
          18, // default thickness — refined when DKB provides specs
          projectId ?? 'global',
        );
        unitCost = priceResult.cost;
      } catch {
        // getMaterialUnitCost handles its own fallbacks; if it fails, keep 0
      }
    }

    const totalCost = line.quantity * unitCost;

    if (cat.includes('edge_banding') || cat.includes('edgebanding')) {
      edgeBandingCost += totalCost;
    } else if (isHardwareCategory(cat)) {
      hardwareCost += totalCost;
    } else {
      materialsCost += totalCost;
    }

    lineItems.push({
      description: line.description,
      category: line.materialCategory,
      quantity: line.quantity,
      unitPrice: unitCost,
      amount: totalCost,
    });
  }

  // Direct costs (labor is 0 here — Design Manager's estimateService
  // calculates labor from processing costs when called via the full workflow)
  const directCosts = materialsCost + edgeBandingCost + hardwareCost + laborCost;
  const overheadCost = directCosts * (overheadPercent / 100);
  const subtotalBeforeMargin = directCosts + overheadCost;
  const marginAmount = subtotalBeforeMargin * (marginPercent / 100);
  const subtotal = subtotalBeforeMargin + marginAmount;

  const vatApplicable = pdd.pricingConfig?.taxConfig?.vatApplicable ?? true;
  const vatAmount = vatApplicable ? subtotal * TAX_RATES.vat : 0;
  const total = subtotal + vatAmount;

  return {
    materialsCost,
    edgeBandingCost,
    hardwareCost,
    laborCost,
    overheadCost,
    marginAmount,
    subtotal,
    vatAmount,
    total,
    currency,
    lineItems,
  };
}

function isHardwareCategory(cat: string): boolean {
  return cat.includes('hardware') || cat.includes('hinge') || cat.includes('handle') ||
    cat.includes('slide') || cat.includes('connector') || cat.includes('leg');
}
