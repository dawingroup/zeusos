/**
 * Consolidated Estimate Types
 * Project-level cost estimation from cutlist and materials
 */

import { Timestamp } from 'firebase/firestore';
import type { BudgetTier } from './strategy';
import type { MaterialQualityTier } from '@/shared/types';

/**
 * Line item categories
 */
export type EstimateLineItemCategory =
  | 'material'
  | 'labor'
  | 'hardware'
  | 'finishing'
  | 'outsourcing'
  | 'overhead'
  | 'procurement'
  | 'procurement-logistics'
  | 'procurement-customs'
  | 'construction'
  | 'other';

/**
 * Estimate line item
 */
export interface EstimateLineItem {
  id: string;
  description: string;
  category: EstimateLineItemCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  
  // Optional linking
  linkedMaterialId?: string;
  linkedDesignItemId?: string;
  
  // Notes
  notes?: string;
  
  // Editable flag
  isManual?: boolean;

  // Finish & Variant (from FinishAttributePicker)
  selectedFinish?: {
    finishId: string;
    finishName: string;
    finishCode: string;
    hexColor?: string;
  };
  selectedAttributes?: Record<string, string | number | boolean>;
  resolvedUnitCost?: number;
  variantId?: string;
  variantKey?: string;
  stockAvailable?: number | null;
}

/**
 * Tax mode for estimates
 */
export type TaxMode = 'exclusive' | 'inclusive';

/**
 * Consolidated Estimate for a project
 */
export interface ConsolidatedEstimate {
  generatedAt: Timestamp;
  generatedBy: string;
  
  // Stale tracking
  isStale: boolean;
  staleReason?: string;
  lastCutlistUpdate?: Timestamp;
  
  // Line items
  lineItems: EstimateLineItem[];
  
  // Totals
  subtotal: number;        // Sum of line items (overhead + margin already included in unit prices)
  taxRate: number;         // e.g., 0.16 for 16%
  taxAmount: number;
  total: number;
  
  // Currency
  currency: string; // KES, USD, etc.
  
  // Overhead (applied to all items)
  overheadPercent?: number;
  overheadAmount?: number;
  
  // Margin (applied to all items)
  marginPercent?: number;
  marginAmount?: number;
  
  // Tax mode
  taxMode?: TaxMode; // 'inclusive' or 'exclusive' (default)
  
  // External sync
  quickbooksInvoiceId?: string;
  quickbooksInvoiceNumber?: string;
  syncedAt?: Timestamp;
  
  // Error checking (for verifying design item costs match estimation)
  errorChecks?: Array<{
    itemId: string;
    itemName: string;
    issue: string;
  }>;
  designItemCount?: number;
  lineItemCount?: number;
  hasErrors?: boolean;

  // Material-tier alternatives
  hasAlternatives?: boolean;
  qualityTier?: MaterialQualityTier;

  // Budget tracking (strategy integration)
  budgetSummary?: {
    totalAllocated?: number;        // Sum of allocated budgets from strategyContext
    totalActual: number;            // Total estimate (same as total field)
    variance: number;               // totalActual - totalAllocated
    variancePercent: number;        // (variance / totalAllocated) × 100
    itemsOverBudget: number;        // Count of items exceeding allocated budget
    budgetTier?: BudgetTier;        // Project budget tier if available
  };
}

/**
 * Estimate configuration
 */
export interface EstimateConfig {
  laborRatePerHour: number;
  laborMinutesPerPart: number;
  defaultTaxRate: number;
  defaultMarginPercent: number;
  currency: string;
  overheadPercent: number;
}

/**
 * Default estimate configuration
 */
export const DEFAULT_ESTIMATE_CONFIG: EstimateConfig = {
  laborRatePerHour: 15000, // UGX per hour
  laborMinutesPerPart: 15, // 15 min per part average
  defaultTaxRate: 0.18, // 18% VAT
  defaultMarginPercent: 0.45, // 45% margin
  currency: 'UGX',
  overheadPercent: 0.10, // 10% overhead
};

/**
 * Estimate line item category labels
 */
export const ESTIMATE_CATEGORY_LABELS: Record<EstimateLineItemCategory, string> = {
  material: 'Materials',
  labor: 'Labor',
  hardware: 'Hardware',
  finishing: 'Finishing',
  outsourcing: 'Outsourcing',
  overhead: 'Overhead',
  procurement: 'Procured Items',
  'procurement-logistics': 'Logistics & Shipping',
  'procurement-customs': 'Customs & Duties',
  construction: 'Construction',
  other: 'Other',
};

/**
 * Form data for manual line items
 */
export interface EstimateLineItemFormData {
  description: string;
  category: EstimateLineItemCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes?: string;
}

// ============================================
// Alternative Estimate Types
// ============================================

/**
 * Summary of a single material substitution in an alternative estimate
 */
export interface MaterialSubstitutionSummary {
  paletteEntryId: string;
  originalMaterialName: string;
  alternativeMaterialName: string;
  originalUnitCost: number;
  alternativeUnitCost: number;
  costDelta: number;
  affectedDesignItemIds: string[];
}

/**
 * An alternative estimate generated using material substitutions
 * for a specific quality tier
 */
export interface AlternativeEstimate {
  id: string;
  qualityTier: MaterialQualityTier;
  tierLabel: string;
  lineItems: EstimateLineItem[];
  substitutions: MaterialSubstitutionSummary[];
  subtotal: number;
  taxAmount: number;
  total: number;
  deltaFromStandard: number;
  deltaPercent: number;
  generatedAt: Timestamp;
}

/**
 * Container for all alternative estimates on a project
 */
export interface AlternativeEstimateSet {
  alternatives: AlternativeEstimate[];
  generatedAt: Timestamp;
  generatedBy: string;
  isStale: boolean;
  staleReason?: string;
}
