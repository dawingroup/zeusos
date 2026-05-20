/**
 * Material Forecast Service
 * Calculates material requirements from selected BOQ items using formulas
 * Includes supplier rate lookup and landed cost calculations
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type { BOQItem, MaterialRequirement, StandardFormula } from '../types';
import { getFormulaById, getFormulaByCode } from './formulaService';

// ============================================================================
// TYPES
// ============================================================================

export interface ForecastedMaterial {
  materialId: string;
  materialName: string;
  unit: string;
  
  // Quantities
  requiredQuantity: number;
  wastageQuantity: number;
  totalQuantity: number;
  
  // Source BOQ items
  sourceItems: Array<{
    boqItemId: string;
    itemCode: string;
    description: string;
    quantity: number;
    formulaCode?: string;
  }>;
  
  // Pricing (from supplier rates)
  supplierRates: SupplierRate[];
  lowestRate?: SupplierRate;
  recommendedSupplier?: SupplierRecommendation;
  
  // Estimated costs
  estimatedUnitCost: number;
  estimatedTotalCost: number;
}

export interface SupplierRate {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  currency: string;
  leadTimeDays?: number;
  minimumOrder?: number;
  deliveryCost?: number;
  landedCost: number; // Unit price + delivery overhead per unit
}

export interface SupplierRecommendation {
  supplierId: string;
  supplierName: string;
  reason: string;
  totalCost: number;
  landedCostPerUnit: number;
}

export interface MaterialForecast {
  projectId: string;
  generatedAt: Date;
  
  // Selected items summary
  selectedItemCount: number;
  totalSelectedValue: number;
  
  // Forecasted materials
  materials: ForecastedMaterial[];
  
  // Totals
  totalMaterialTypes: number;
  totalEstimatedCost: number;
  
  // Warnings
  warnings: string[];
  itemsWithoutFormula: string[];
}

// ============================================================================
// BOQ SELECTION FUNCTIONS
// ============================================================================

const DEFAULT_ORG_ID = 'default';

/**
 * Get the BOQ items collection path for a project
 */
function getBoqCollectionPath(orgId: string, projectId: string): string {
  return `organizations/${orgId}/advisory_projects/${projectId}/boq_items`;
}

/**
 * Toggle selection status for a BOQ item
 */
export async function toggleItemSelection(
  itemId: string,
  userId: string,
  selected: boolean,
  projectId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const collectionPath = getBoqCollectionPath(orgId, projectId);
  const docRef = doc(db, collectionPath, itemId);
  await updateDoc(docRef, {
    isSelectedForImplementation: selected,
    selectedAt: selected ? serverTimestamp() : null,
    selectedBy: selected ? userId : null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Bulk toggle selection for multiple items
 */
export async function bulkToggleSelection(
  itemIds: string[],
  userId: string,
  selected: boolean,
  projectId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const updates = itemIds.map(id => toggleItemSelection(id, userId, selected, projectId, orgId));
  await Promise.all(updates);
}

/**
 * Get all selected items for a project
 */
export async function getSelectedItems(projectId: string, orgId: string = DEFAULT_ORG_ID): Promise<BOQItem[]> {
  const collectionPath = getBoqCollectionPath(orgId, projectId);
  const q = query(
    collection(db, collectionPath),
    where('isSelectedForImplementation', '==', true)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as BOQItem[];
}

// ============================================================================
// MATERIAL CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate material requirements for a single BOQ item
 */
async function calculateItemMaterials(
  item: BOQItem,
  applyWastage: boolean = true
): Promise<{ requirements: MaterialRequirement[]; formula?: StandardFormula }> {
  // Get formula
  const formula = item.formulaId 
    ? await getFormulaById(item.formulaId)
    : item.formulaCode 
      ? await getFormulaByCode(item.formulaCode)
      : null;
  
  if (!formula) {
    return { requirements: [], formula: undefined };
  }
  
  const requirements: MaterialRequirement[] = [];
  
  for (const component of formula.components) {
    let quantity = (item.quantityContract ?? item.quantity) * component.quantity;
    
    // Apply wastage
    if (applyWastage) {
      quantity *= (1 + component.wastagePercent / 100);
    }
    
    // Round to 2 decimals
    quantity = Math.ceil(quantity * 100) / 100;
    
    requirements.push({
      id: `${item.id}-${component.materialId}`,
      projectId: item.projectId,
      materialId: component.materialId,
      materialName: component.materialName,
      quantity,
      requiredQuantity: quantity,
      orderedQuantity: 0,
      deliveredQuantity: 0,
      usedQuantity: 0,
      unit: component.unit,
      unitPrice: 0, // Will be filled from supplier rates
      totalCost: 0,
      status: 'pending',
    });
  }
  
  return { requirements, formula };
}

// ============================================================================
// SUPPLIER RATE LOOKUP
// ============================================================================

const SUPPLIER_RATES_COLLECTION = 'advisoryPlatform/matflow/supplierRates';

interface StoredSupplierRate {
  id: string;
  materialId: string;
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  currency: string;
  leadTimeDays?: number;
  minimumOrder?: number;
  deliveryFeeFlat?: number;
  deliveryFeePerUnit?: number;
  isActive: boolean;
}

/**
 * Get supplier rates for a material
 */
async function getSupplierRatesForMaterial(materialId: string): Promise<SupplierRate[]> {
  try {
    const q = query(
      collection(db, SUPPLIER_RATES_COLLECTION),
      where('materialId', '==', materialId),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data() as StoredSupplierRate;
      const deliveryCostPerUnit = data.deliveryFeePerUnit || 0;
      
      return {
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        unitPrice: data.unitPrice,
        currency: data.currency,
        leadTimeDays: data.leadTimeDays,
        minimumOrder: data.minimumOrder,
        deliveryCost: deliveryCostPerUnit,
        landedCost: data.unitPrice + deliveryCostPerUnit,
      };
    }).sort((a, b) => a.landedCost - b.landedCost);
  } catch {
    // No rates found
    return [];
  }
}

/**
 * Get best supplier recommendation for a material quantity
 */
function getSupplierRecommendation(
  rates: SupplierRate[],
  quantity: number
): SupplierRecommendation | undefined {
  if (rates.length === 0) return undefined;
  
  // Find suppliers that can fulfill the order
  const eligibleRates = rates.filter(r => 
    !r.minimumOrder || quantity >= r.minimumOrder
  );
  
  if (eligibleRates.length === 0) {
    // No supplier meets minimum order, recommend the one with lowest landed cost anyway
    const best = rates[0];
    return {
      supplierId: best.supplierId,
      supplierName: best.supplierName,
      reason: `Lowest landed cost (min order: ${best.minimumOrder} may apply)`,
      totalCost: best.landedCost * quantity,
      landedCostPerUnit: best.landedCost,
    };
  }
  
  // Sort eligible by landed cost
  const sorted = [...eligibleRates].sort((a, b) => a.landedCost - b.landedCost);
  const best = sorted[0];
  
  return {
    supplierId: best.supplierId,
    supplierName: best.supplierName,
    reason: 'Lowest landed cost',
    totalCost: best.landedCost * quantity,
    landedCostPerUnit: best.landedCost,
  };
}

// ============================================================================
// MAIN FORECAST FUNCTION
// ============================================================================

/**
 * Generate material forecast for a project based on selected BOQ items
 */
export async function generateMaterialForecast(
  projectId: string
): Promise<MaterialForecast> {
  const warnings: string[] = [];
  const itemsWithoutFormula: string[] = [];
  
  // Get selected items
  const selectedItems = await getSelectedItems(projectId);
  
  if (selectedItems.length === 0) {
    return {
      projectId,
      generatedAt: new Date(),
      selectedItemCount: 0,
      totalSelectedValue: 0,
      materials: [],
      totalMaterialTypes: 0,
      totalEstimatedCost: 0,
      warnings: ['No items selected for implementation'],
      itemsWithoutFormula: [],
    };
  }
  
  // Calculate material requirements for each item
  const materialMap = new Map<string, ForecastedMaterial>();
  
  for (const item of selectedItems) {
    const { requirements, formula } = await calculateItemMaterials(item);
    
    if (!formula) {
      itemsWithoutFormula.push(item.itemCode ?? item.itemNumber);
      continue;
    }
    
    for (const req of requirements) {
      const existing = materialMap.get(req.materialId);
      const reqQty = req.quantity ?? 0;

      if (existing) {
        // Aggregate quantities
        existing.requiredQuantity += reqQty / (1 + 0.1); // Remove wastage for base
        existing.wastageQuantity += reqQty * 0.1 / 1.1; // Approximate wastage
        existing.totalQuantity += reqQty;
        existing.sourceItems.push({
          boqItemId: item.id,
          itemCode: item.itemCode ?? item.itemNumber,
          description: item.description,
          quantity: reqQty,
          formulaCode: formula.code,
        });
      } else {
        // New material
        const baseQty = reqQty / 1.1;
        const wastageQty = reqQty - baseQty;

        materialMap.set(req.materialId, {
          materialId: req.materialId,
          materialName: req.materialName,
          unit: req.unit,
          requiredQuantity: baseQty,
          wastageQuantity: wastageQty,
          totalQuantity: reqQty,
          sourceItems: [{
            boqItemId: item.id,
            itemCode: item.itemCode ?? item.itemNumber,
            description: item.description,
            quantity: reqQty,
            formulaCode: formula.code,
          }],
          supplierRates: [],
          estimatedUnitCost: 0,
          estimatedTotalCost: 0,
        });
      }
    }
  }
  
  // Get supplier rates and recommendations for each material
  const materials = Array.from(materialMap.values());
  
  for (const material of materials) {
    const rates = await getSupplierRatesForMaterial(material.materialId);
    material.supplierRates = rates;
    
    if (rates.length > 0) {
      material.lowestRate = rates[0];
      material.recommendedSupplier = getSupplierRecommendation(rates, material.totalQuantity);
      material.estimatedUnitCost = material.lowestRate.landedCost;
      material.estimatedTotalCost = material.lowestRate.landedCost * material.totalQuantity;
    } else {
      warnings.push(`No supplier rates found for ${material.materialName}`);
    }
  }
  
  // Calculate totals
  const totalSelectedValue = selectedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalEstimatedCost = materials.reduce((sum, m) => sum + m.estimatedTotalCost, 0);
  
  if (itemsWithoutFormula.length > 0) {
    warnings.push(`${itemsWithoutFormula.length} item(s) have no formula assigned`);
  }
  
  return {
    projectId,
    generatedAt: new Date(),
    selectedItemCount: selectedItems.length,
    totalSelectedValue,
    materials: materials.sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost),
    totalMaterialTypes: materials.length,
    totalEstimatedCost,
    warnings,
    itemsWithoutFormula,
  };
}

/**
 * Get forecast summary for display
 */
export function getForecastSummary(forecast: MaterialForecast): {
  itemCount: number;
  materialCount: number;
  estimatedCost: number;
  suppliersNeeded: number;
  warnings: number;
} {
  const uniqueSuppliers = new Set<string>();
  
  for (const material of forecast.materials) {
    if (material.recommendedSupplier) {
      uniqueSuppliers.add(material.recommendedSupplier.supplierId);
    }
  }
  
  return {
    itemCount: forecast.selectedItemCount,
    materialCount: forecast.totalMaterialTypes,
    estimatedCost: forecast.totalEstimatedCost,
    suppliersNeeded: uniqueSuppliers.size,
    warnings: forecast.warnings.length,
  };
}
