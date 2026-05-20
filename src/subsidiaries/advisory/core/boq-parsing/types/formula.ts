/**
 * Formula Types
 * Standard construction formulas for material calculations
 */

import type { MaterialCategory } from './parsed-boq';

/**
 * Component of a standard formula
 */
export interface FormulaComponent {
  materialId: string;
  materialName: string;
  /** Quantity per unit of output */
  quantity: number;
  unit: string;
  wastagePercent: number;
}

/**
 * Standard construction formula
 * Used to calculate material requirements from BOQ quantities
 */
export interface StandardFormula {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: MaterialCategory | string;
  subcategory?: string;

  /** Keywords for matching to BOQ descriptions */
  keywords: string[];

  /** Unit of output (e.g., "m³" for concrete) */
  outputUnit: string;

  /** Material components required */
  components: FormulaComponent[];

  /** Formula expressions (optional) */
  laborFormula?: string;
  materialFormula?: string;
  equipmentFormula?: string;

  /** Default rates */
  defaultLaborRate?: number;
  defaultMaterialRate?: number;
  defaultEquipmentRate?: number;

  /** Usage tracking */
  usageCount: number;
  isActive: boolean;

  /** Audit fields */
  createdAt: any; // Timestamp from Firestore
  updatedAt: any;
}
