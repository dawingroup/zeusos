/**
 * Constraint Engine Types
 *
 * Types for the design constraint validation system, BOM computation,
 * pricing breakdown, and stock availability checking.
 */

/** Request to validate a PDD configuration */
export interface ConstraintValidationRequest {
  pddId: string;
  configuration: Record<string, unknown>;
  finishSelections: Record<string, string>;
}

/** Full validation result */
export interface ConstraintValidationResult {
  valid: boolean;
  violations: ConstraintViolation[];
  warnings: ConstraintViolation[];
  infos: ConstraintViolation[];
  computedBOM: ComputedBOMLine[];
  estimatedPrice: PricingBreakdown;
  stockAvailability: Record<string, StockStatus>;
}

/** A single constraint violation */
export interface ConstraintViolation {
  constraintId: string;
  action: 'reject' | 'warn' | 'info';
  reason: string;
  affectedParameters: string[];
}

/** An evaluated BOM line with resolved inventory and pricing */
export interface ComputedBOMLine {
  bomTemplateLineKey: string;
  materialCategory: string;
  description: string;
  quantity: number;
  unit: string;
  inventoryItemId: string;
  inventoryItemName: string;
  unitCost: number;
  currency: 'UGX' | 'USD';
  totalCost: number;
  wastageApplied: number;
}

/** Full pricing breakdown */
export interface PricingBreakdown {
  materialsCost: number;
  edgeBandingCost: number;
  hardwareCost: number;
  laborCost: number;
  overheadCost: number;
  marginAmount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: 'UGX' | 'USD';
  lineItems: PricingLineItem[];
}

/** Individual pricing line item */
export interface PricingLineItem {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** Stock availability status for a single inventory item */
export interface StockStatus {
  inventoryItemId: string;
  inventoryItemName: string;
  requiredQuantity: number;
  availableQuantity: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'sufficient';
  estimatedRestockDays?: number;
}

// ── DKB Validation Types ─────────────────────────────────

/** Result of validating BOM against Design Knowledge Base */
export interface DKBValidationResult {
  valid: boolean;
  violations: DKBViolation[];
}

/** A single DKB validation violation */
export interface DKBViolation {
  type: 'dimension' | 'material_compatibility' | 'naming' | 'hardware';
  severity: 'error' | 'warning' | 'info';
  bomLineKey: string;
  message: string;
  dkbEntryId?: string;
  suggestion?: string;
}
