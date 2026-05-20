/**
 * Material Calculator
 * Calculates material requirements from BOQ items using formulas
 */

import type {
  BOQItem,
  MaterialRequirement,
} from '../types';
import type { Material } from '../types/material';
import { getFormulaById, getFormulaByCode } from './formulaService';
import { materialService } from './material-service';

export interface CalculationResult {
  success: boolean;
  requirements: MaterialRequirement[];
  errors?: string[];
  warnings?: string[];
}

export interface CalculationOptions {
  applyWastage?: boolean;
  wastageOverride?: number;
  roundUp?: boolean;
  /** Which rate to use from the materials library (default: 'standard') */
  rateSource?: 'standard' | 'lastPurchase' | 'average';
}

/**
 * Calculate material requirements for a single BOQ item
 */
export async function calculateMaterials(
  boqItem: BOQItem,
  options: CalculationOptions = {}
): Promise<CalculationResult> {
  const { applyWastage = true, wastageOverride, roundUp = true } = options;
  
  // Get formula
  const formula = (typeof boqItem.formulaId === 'string' && boqItem.formulaId)
    ? await getFormulaById(boqItem.formulaId)
    : boqItem.formulaCode 
      ? await getFormulaByCode(boqItem.formulaCode)
      : null;
  
  if (!formula) {
    return {
      success: false,
      requirements: [],
      errors: ['No formula assigned to this BOQ item'],
    };
  }
  
  const requirements: MaterialRequirement[] = [];
  const warnings: string[] = [];
  const { rateSource = 'standard' } = options;

  // Batch-fetch all materials upfront to avoid N+1 queries
  const materialIds = formula.components.map(c => c.materialId).filter(Boolean);
  let materialMap = new Map<string, Material>();
  try {
    if (materialIds.length > 0) {
      const materials = await materialService.getMaterialsByIds(materialIds);
      materialMap = new Map(materials.map(m => [m.id, m]));
    }
  } catch (err) {
    warnings.push('Could not fetch material prices — costs set to 0');
  }

  for (const component of formula.components) {
    // Calculate base quantity
    let quantity = (boqItem.quantityContract ?? 0) * component.quantity;

    // Apply wastage
    if (applyWastage) {
      const wastagePercent = wastageOverride ?? component.wastagePercent;
      quantity *= (1 + wastagePercent / 100);
    }

    // Round up if requested
    if (roundUp) {
      quantity = Math.ceil(quantity * 100) / 100; // Round to 2 decimals
    }

    // Apply MOQ rounding — round purchase quantity up to the nearest pack
    const requiredQuantity = quantity;
    const purchaseQuantity = component.moq
      ? Math.ceil(requiredQuantity / component.moq) * component.moq
      : requiredQuantity;

    // Fetch unit rate from materials library
    const material = materialMap.get(component.materialId);
    let unitRate = 0;
    if (material) {
      unitRate = (
        rateSource === 'lastPurchase' ? material.lastPurchaseRate?.amount :
        rateSource === 'average' ? material.averageRate?.amount :
        material.standardRate?.amount
      ) ?? 0;
    } else if (component.materialId) {
      warnings.push(`Material '${component.materialName}' not found in library — price set to 0`);
    }
    const totalCost = purchaseQuantity * unitRate;

    requirements.push({
      materialId: component.materialId,
      materialName: component.materialName,
      quantity: requiredQuantity,
      requiredQuantity,
      purchaseQuantity,
      moq: component.moq,
      packUnit: component.packUnit,
      unit: component.unit,
      unitPrice: unitRate,
      totalCost,
      wastageIncluded: applyWastage,
    } as unknown as MaterialRequirement);
  }

  return {
    success: true,
    requirements,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Calculate materials for multiple BOQ items
 */
export async function calculateBatchMaterials(
  boqItems: BOQItem[],
  options: CalculationOptions = {}
): Promise<Map<string, CalculationResult>> {
  const results = new Map<string, CalculationResult>();
  
  for (const item of boqItems) {
    const result = await calculateMaterials(item, options);
    results.set(item.id, result);
  }
  
  return results;
}

/**
 * Aggregate material requirements across multiple BOQ items
 */
export function aggregateMaterials(
  calculationResults: Map<string, CalculationResult>
): MaterialRequirement[] {
  const aggregated = new Map<string, MaterialRequirement>();
  
  for (const result of calculationResults.values()) {
    if (!result.success) continue;
    
    for (const req of result.requirements) {
      const existing = aggregated.get(req.materialId);
      
      if (existing) {
        existing.quantity = (existing.quantity ?? 0) + (req.quantity ?? 0);
        existing.requiredQuantity = (existing.requiredQuantity ?? 0) + (req.requiredQuantity ?? 0);
        existing.purchaseQuantity = (existing.purchaseQuantity ?? 0) + (req.purchaseQuantity ?? req.quantity ?? 0);
        existing.totalCost = (existing.totalCost ?? 0) + (req.totalCost ?? 0);
      } else {
        aggregated.set(req.materialId, { ...req });
      }
    }
  }
  
  return Array.from(aggregated.values()).sort((a, b) => 
    a.materialName.localeCompare(b.materialName)
  );
}
