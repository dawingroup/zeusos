/**
 * Alternative Estimate Service
 * Generates tier-based estimates using real material cost substitutions
 * instead of flat budget tier multipliers.
 */

import {
  doc,
  updateDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { nanoid } from 'nanoid';
import type {
  MaterialPalette,
  MaterialPaletteEntry,
  MaterialAlternativeMapping,
  MaterialQualityTier,
} from '@/shared/types';
import { MATERIAL_QUALITY_TIER_LABELS as TIER_LABELS } from '@/shared/types';
import type {
  ConsolidatedEstimate,
  EstimateLineItem,
  EstimateConfig,
  AlternativeEstimate,
  AlternativeEstimateSet,
  MaterialSubstitutionSummary,
} from '../types/estimate';
import { DEFAULT_ESTIMATE_CONFIG } from '../types/estimate';
import type { DesignItem, SheetMaterialBreakdown, TimberMaterialBreakdown, LinearMaterialBreakdown } from '../types';
import { getAvailableTiers } from './materialAlternativeService';

/**
 * Generate alternative estimates for all quality tiers that have
 * material alternatives mapped in the palette.
 *
 * Runs AFTER the standard estimate exists and creates parallel estimates
 * using substituted material costs.
 */
export async function generateAlternativeEstimates(
  projectId: string,
  standardEstimate: ConsolidatedEstimate,
  userId: string,
  config: EstimateConfig = DEFAULT_ESTIMATE_CONFIG
): Promise<AlternativeEstimateSet> {
  // Load project data
  const projectRef = doc(db, 'designProjects', projectId);
  const itemsSnapshot = await getDocs(collection(db, 'designProjects', projectId, 'designItems'));
  const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as DesignItem));

  // Load palette
  const { getDoc } = await import('firebase/firestore');
  const projectSnap = await getDoc(projectRef);
  const projectData = projectSnap.data();
  const palette: MaterialPalette = projectData?.materialPalette || { entries: [], unmappedCount: 0, mappedCount: 0 };

  // Find which tiers have alternatives mapped
  const availableTiers = getAvailableTiers(palette);

  if (availableTiers.length === 0) {
    const emptySet: AlternativeEstimateSet = {
      alternatives: [],
      generatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      generatedBy: userId,
      isStale: false,
    };
    await updateDoc(projectRef, { alternativeEstimates: emptySet });
    return emptySet;
  }

  // Generate estimate for each available tier
  const alternatives: AlternativeEstimate[] = [];

  for (const tier of availableTiers) {
    const altEstimate = generateTierEstimate(
      tier,
      standardEstimate,
      items,
      palette,
      config
    );
    if (altEstimate) {
      alternatives.push(altEstimate);
    }
  }

  const result: AlternativeEstimateSet = {
    alternatives,
    generatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
    generatedBy: userId,
    isStale: false,
  };

  // Save to project
  await updateDoc(projectRef, {
    alternativeEstimates: result,
    'consolidatedEstimate.hasAlternatives': alternatives.length > 0,
  });

  return result;
}

/**
 * Generate an estimate for a single quality tier by substituting
 * material costs from alternative mappings.
 *
 * Only MANUFACTURED items have their material costs substituted.
 * PROCURED, DESIGN_DOCUMENT, and CONSTRUCTION items keep their original costs.
 */
function generateTierEstimate(
  qualityTier: MaterialQualityTier,
  standardEstimate: ConsolidatedEstimate,
  items: DesignItem[],
  palette: MaterialPalette,
  config: EstimateConfig
): AlternativeEstimate | null {
  const substitutions: MaterialSubstitutionSummary[] = [];
  const lineItems: EstimateLineItem[] = [];

  // Build a lookup: normalizedMaterialName+thickness -> palette entry
  // Index by both normalizedName and designName (lowercased) for robust matching
  const paletteLookup = new Map<string, MaterialPaletteEntry>();
  for (const entry of palette.entries) {
    if (entry.normalizedName) {
      paletteLookup.set(`${entry.normalizedName}|${entry.thickness}`, entry);
    }
    if (entry.designName) {
      const designKey = `${entry.designName.toLowerCase().replace(/\s+/g, ' ').trim()}|${entry.thickness}`;
      if (!paletteLookup.has(designKey)) {
        paletteLookup.set(designKey, entry);
      }
    }
  }

  // Process each standard estimate line item
  for (const standardLine of standardEstimate.lineItems) {
    // Only substitute material line items linked to manufactured design items
    if (standardLine.category === 'material' && standardLine.linkedDesignItemId) {
      const item = items.find(i => i.id === standardLine.linkedDesignItemId);
      const manufacturing = (item as any)?.manufacturing;

      const hasAnyMaterials = (manufacturing?.sheetMaterials?.length > 0)
        || (manufacturing?.timberMaterials?.length > 0)
        || (manufacturing?.linearMaterials?.length > 0);

      if (hasAnyMaterials) {
        // Recalculate this line item with alternative material costs
        let newTotalCost = 0;
        let hasSubstitution = false;

        // Helper to track a substitution
        const trackSubstitution = (paletteEntry: MaterialPaletteEntry, altMapping: any, itemId: string) => {
          const existingSub = substitutions.find(s => s.paletteEntryId === paletteEntry.id);
          if (existingSub) {
            if (!existingSub.affectedDesignItemIds.includes(itemId)) {
              existingSub.affectedDesignItemIds.push(itemId);
            }
          } else {
            substitutions.push({
              paletteEntryId: paletteEntry.id,
              originalMaterialName: paletteEntry.designName,
              alternativeMaterialName: altMapping.inventoryName,
              originalUnitCost: paletteEntry.unitCost || 0,
              alternativeUnitCost: altMapping.unitCost,
              costDelta: altMapping.unitCost - (paletteEntry.unitCost || 0),
              affectedDesignItemIds: [itemId],
            });
          }
        };

        /**
         * UNIT-AWARE ALTERNATIVE COST CALCULATION
         *
         * The costUnit field on the alternative mapping tells us what the unitCost represents:
         *   - 'sheet'     → cost per full sheet/slab (divide by sheet area for cost/m²)
         *   - 'm'         → cost per linear meter
         *   - 'sqm'       → cost per square meter
         *   - 'cbm'       → cost per cubic meter
         *   - 'ea' / 'pcs' → cost per piece
         *   - undefined    → legacy data, fall back to ratio-based substitution
         *
         * The standard estimate's cost is always used as the baseline.
         * When costUnit is available, we recalculate from first principles.
         * When missing (legacy), we use ratio-based: (altUnitCost / stdUnitCost) × stdTotalCost
         */

        // Helper: resolve alternative cost for a material breakdown
        const resolveAltMaterialCost = (
          altMapping: MaterialAlternativeMapping,
          paletteEntry: MaterialPaletteEntry,
          opts: {
            totalArea?: number;           // m² (from sheet/panel materials)
            totalLinearMeters?: number;    // m (from linear materials)
            totalVolumeCubicMeters?: number; // m³ (from timber materials)
            partsCount?: number;
            pricingMethod?: string;        // 'volumetric' | 'linear' | 'per-piece'
            originalTotalCost: number;     // The standard estimate's total for this material
          }
        ): number => {
          const unit = altMapping.costUnit || paletteEntry.costUnit;
          const altCost = altMapping.unitCost;

          // --- Unit-aware calculation (new data with costUnit) ---
          if (unit === 'sheet' || unit === 'slab') {
            // Cost per sheet/slab → derive cost/m² using stock sheet dimensions
            const stockSheet = paletteEntry.stockSheets?.[0];
            const hasStock = stockSheet && stockSheet.length > 0 && stockSheet.width > 0;
            const sheetArea = hasStock
              ? (stockSheet.length * stockSheet.width) / 1_000_000
              : (2440 * 1220) / 1_000_000;
            const altCostPerM2 = altCost / sheetArea;
            const area = (opts.totalArea || 0) * 1.15; // 15% waste
            return Math.round(area * altCostPerM2);
          }

          if (unit === 'm' || unit === 'lft' || unit === 'lm') {
            // Cost per linear meter
            if (opts.totalLinearMeters) {
              // Linear/timber material — straightforward
              return Math.round(opts.totalLinearMeters * altCost);
            }
            // Sheet/slab material priced per running meter (e.g. granite slabs):
            // cost/m² = price_per_meter / slab_width_in_meters
            if (opts.totalArea) {
              const stockSheet = paletteEntry.stockSheets?.[0];
              const slabWidthM = stockSheet && stockSheet.width > 0
                ? stockSheet.width / 1000
                : 0.62; // default slab width
              const altCostPerM2 = altCost / slabWidthM;
              const area = opts.totalArea * 1.15; // 15% waste
              return Math.round(area * altCostPerM2);
            }
            return 0;
          }

          if (unit === 'sqm' || unit === 'sqft') {
            // Cost per square meter
            const area = (opts.totalArea || 0) * 1.15;
            return Math.round(area * altCost);
          }

          if (unit === 'cbm' || unit === 'cbft') {
            // Cost per cubic meter
            const vol = opts.totalVolumeCubicMeters || 0;
            return Math.round(vol * altCost);
          }

          if (unit === 'ea' || unit === 'pcs' || unit === 'piece') {
            // Cost per piece
            return Math.round((opts.partsCount || 1) * altCost);
          }

          // --- Legacy fallback (no costUnit) → ratio-based substitution ---
          // Both unitCosts come from inventory costPerUnit (same unit), so the ratio
          // of alt / standard directly scales the original total cost.
          const stdUnitCost = paletteEntry.unitCost || paletteEntry.stockSheets?.[0]?.costPerSheet || 1;
          const ratio = altCost / stdUnitCost;
          return Math.round(opts.originalTotalCost * ratio);
        };

        // Sheet materials
        for (const mat of (manufacturing.sheetMaterials || []) as SheetMaterialBreakdown[]) {
          const normalizedName = mat.materialName?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
          const key = `${normalizedName}|${mat.thickness}`;
          const paletteEntry = paletteLookup.get(key);

          if (paletteEntry?.alternatives) {
            const altMapping = paletteEntry.alternatives.find(a => a.qualityTier === qualityTier);
            if (altMapping) {
              newTotalCost += resolveAltMaterialCost(altMapping, paletteEntry, {
                totalArea: mat.totalArea,
                partsCount: mat.partsCount,
                originalTotalCost: mat.totalCost,
              });
              hasSubstitution = true;
              trackSubstitution(paletteEntry, altMapping, item!.id);
            } else {
              newTotalCost += mat.totalCost;
            }
          } else {
            newTotalCost += mat.totalCost;
          }
        }

        // Timber materials
        for (const mat of (manufacturing.timberMaterials || []) as TimberMaterialBreakdown[]) {
          const normalizedName = mat.materialName?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
          const key = `${normalizedName}|${mat.crossSection?.thickness || 0}`;
          const paletteEntry = paletteLookup.get(key);

          if (paletteEntry?.alternatives) {
            const altMapping = paletteEntry.alternatives.find(a => a.qualityTier === qualityTier);
            if (altMapping) {
              newTotalCost += resolveAltMaterialCost(altMapping, paletteEntry, {
                totalVolumeCubicMeters: mat.totalVolumeCubicMeters,
                totalLinearMeters: mat.totalLinearMeters,
                partsCount: mat.partsCount,
                pricingMethod: mat.pricingMethod,
                originalTotalCost: mat.totalCost,
              });
              hasSubstitution = true;
              trackSubstitution(paletteEntry, altMapping, item!.id);
            } else {
              newTotalCost += mat.totalCost;
            }
          } else {
            newTotalCost += mat.totalCost;
          }
        }

        // Linear materials
        for (const mat of (manufacturing.linearMaterials || []) as LinearMaterialBreakdown[]) {
          const normalizedName = mat.materialName?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
          const profileThickness = mat.profile ? parseInt(mat.profile.split('x')[0]) || 0 : 0;
          const key = `${normalizedName}|${profileThickness}`;
          const paletteEntry = paletteLookup.get(key) ||
            paletteLookup.get(`${normalizedName}|0`) ||
            Array.from(paletteLookup.values()).find(e =>
              (e.normalizedName || e.designName?.toLowerCase().replace(/\s+/g, ' ').trim()) === normalizedName
            );

          if (paletteEntry?.alternatives) {
            const altMapping = paletteEntry.alternatives.find(a => a.qualityTier === qualityTier);
            if (altMapping) {
              newTotalCost += resolveAltMaterialCost(altMapping, paletteEntry, {
                totalLinearMeters: mat.totalLinearMeters,
                partsCount: mat.partsCount,
                originalTotalCost: mat.totalCost,
              });
              hasSubstitution = true;
              trackSubstitution(paletteEntry, altMapping, item!.id);
            } else {
              newTotalCost += mat.totalCost;
            }
          } else {
            newTotalCost += mat.totalCost;
          }
        }

        if (hasSubstitution) {
          // Recalculate the line item with new material costs
          // Keep labor and hardware costs the same
          const laborCost = manufacturing.laborCost || 0;
          const standardPartsCost = manufacturing.standardPartsCost || 0;
          const specialPartsCost = manufacturing.specialPartsCost || 0;
          const newItemTotal = newTotalCost + laborCost + standardPartsCost + specialPartsCost;
          // newItemTotal is already per-unit (calculated from parts for one unit)
          const newCostPerUnit = newItemTotal;

          // Apply same overhead + margin as standard
          const overheadMultiplier = 1 + (config.overheadPercent || 0);
          const marginMultiplier = 1 + (config.defaultMarginPercent || 0);
          const totalMarkup = overheadMultiplier * marginMultiplier;

          const requiredQuantity = (item as any)?.requiredQuantity || 1;
          const markedUpUnitPrice = Math.ceil((newCostPerUnit * totalMarkup) / 1000) * 1000;

          lineItems.push({
            ...standardLine,
            unitPrice: markedUpUnitPrice,
            totalPrice: markedUpUnitPrice * requiredQuantity,
          });
          continue;
        }
      }
    }

    // Non-material items or items without substitutions: keep as-is
    lineItems.push({ ...standardLine });
  }

  // If no substitutions were made, skip this tier
  if (substitutions.length === 0) {
    return null;
  }

  // Calculate totals
  const subtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);
  const taxAmount = config.defaultTaxRate
    ? Math.round(subtotal * config.defaultTaxRate)
    : 0;
  const total = subtotal + taxAmount;

  const deltaFromStandard = total - standardEstimate.total;
  const deltaPercent = standardEstimate.total > 0
    ? Math.round((deltaFromStandard / standardEstimate.total) * 1000) / 10
    : 0;

  return {
    id: nanoid(10),
    qualityTier,
    tierLabel: TIER_LABELS[qualityTier] || qualityTier,
    lineItems,
    substitutions,
    subtotal,
    taxAmount,
    total,
    deltaFromStandard,
    deltaPercent,
    generatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
  };
}
