/**
 * Formula Types
 * 
 * Types for material formulas and calculations.
 */

// ─────────────────────────────────────────────────────────────────
// MATERIAL CATEGORY
// ─────────────────────────────────────────────────────────────────

export type MaterialCategory =
  | 'concrete'
  | 'masonry'
  | 'steel'
  | 'timber'
  | 'roofing'
  | 'finishes'
  | 'plumbing'
  | 'electrical'
  | 'doors_windows'
  | 'earthworks'
  | 'other';

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  concrete: 'Concrete & Cement',
  masonry: 'Masonry & Blockwork',
  steel: 'Steel & Reinforcement',
  timber: 'Timber & Formwork',
  roofing: 'Roofing',
  finishes: 'Finishes',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  doors_windows: 'Doors & Windows',
  earthworks: 'Earthworks',
  other: 'Other',
};

// ─────────────────────────────────────────────────────────────────
// STANDARD FORMULA
// ─────────────────────────────────────────────────────────────────

export interface StandardFormula {
  id: string;
  code: string;
  name: string;
  description?: string;
  
  // Classification
  category: MaterialCategory;
  keywords: string[];
  
  // Input/Output
  inputUnit: string;
  outputUnit: string;
  
  // Components
  components: FormulaComponent[];
  
  // Metadata
  isActive: boolean;
  version: number;
}

export interface FormulaComponent {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// MATERIAL REQUIREMENT
// ─────────────────────────────────────────────────────────────────

export interface MaterialRequirement {
  formulaId: string;
  formulaCode: string;
  boqItemId: string;
  
  materialId: string;
  materialName: string;
  
  baseQuantity: number;
  wastagePercent: number;
  totalQuantity: number;
  unit: string;
  
  estimatedCost?: number;
  currency?: string;
}

// ─────────────────────────────────────────────────────────────────
// FORMULA MATCH
// ─────────────────────────────────────────────────────────────────

export interface FormulaMatch {
  formula: StandardFormula;
  score: number;
  matchedKeywords: string[];
  categoryMatch: boolean;
  unitMatch: boolean;
}

export function calculateMaterialRequirements(
  formula: StandardFormula,
  boqQuantity: number
): MaterialRequirement[] {
  return formula.components.map(component => {
    const baseQuantity = boqQuantity * component.quantity;
    const totalQuantity = baseQuantity * (1 + component.wastagePercent / 100);
    
    return {
      formulaId: formula.id,
      formulaCode: formula.code,
      boqItemId: '',
      materialId: component.materialId,
      materialName: component.materialName,
      baseQuantity,
      wastagePercent: component.wastagePercent,
      totalQuantity,
      unit: component.unit,
    };
  });
}
