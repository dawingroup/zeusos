/**
 * Deliverables Type System
 * New unified type system for Design Manager deliverables
 */

import type { Timestamp } from '@/shared/types';
import type { DesignStage } from './index';

// ============================================
// Deliverable Sourcing Types
// ============================================

/**
 * Deliverable sourcing/production types
 * Maps to different workflows and detail pages
 */
export type DeliverableSourcingType =
  | 'CUSTOM_FURNITURE_MILLWORK'  // In-house production (replaces MANUFACTURED)
  | 'PROCURED'                    // External sourcing (unchanged)
  | 'DESIGN_DOCUMENT'             // Design documents (replaces ARCHITECTURAL)
  | 'CONSTRUCTION';               // Electricals, tiling, painting, gypsum, fitout

/**
 * Legacy sourcing type values (for backward compatibility)
 */
export type LegacySourcingType = 'MANUFACTURED' | 'PROCURED' | 'ARCHITECTURAL';

/**
 * Legacy to new type mapping
 * Used for normalizing legacy data at read time
 */
export const LEGACY_SOURCING_MAP: Record<string, DeliverableSourcingType> = {
  'MANUFACTURED': 'CUSTOM_FURNITURE_MILLWORK',
  'ARCHITECTURAL': 'DESIGN_DOCUMENT',
  'PROCURED': 'PROCURED',
};

/**
 * Normalize a sourcing type value (handles legacy values)
 */
export function normalizeSourcingType(
  value?: string | null
): DeliverableSourcingType {
  if (!value) return 'CUSTOM_FURNITURE_MILLWORK';

  // Check if it's a legacy value
  if (value in LEGACY_SOURCING_MAP) {
    return LEGACY_SOURCING_MAP[value];
  }

  // Return as-is if it's already a new type
  return value as DeliverableSourcingType;
}

/**
 * Human-readable labels for deliverable types
 */
export const DELIVERABLE_TYPE_LABELS: Record<DeliverableSourcingType, string> = {
  'CUSTOM_FURNITURE_MILLWORK': 'Custom Furniture/Millwork',
  'PROCURED': 'Procured Items',
  'DESIGN_DOCUMENT': 'Design Documents',
  'CONSTRUCTION': 'Construction Items',
};

/**
 * Short labels for deliverable types (for badges/tags)
 */
export const DELIVERABLE_TYPE_SHORT_LABELS: Record<DeliverableSourcingType, string> = {
  'CUSTOM_FURNITURE_MILLWORK': 'Custom',
  'PROCURED': 'Procured',
  'DESIGN_DOCUMENT': 'Document',
  'CONSTRUCTION': 'Construction',
};

/**
 * Icons for deliverable types (Lucide icon names)
 */
export const DELIVERABLE_TYPE_ICONS: Record<DeliverableSourcingType, string> = {
  'CUSTOM_FURNITURE_MILLWORK': 'Package',
  'PROCURED': 'ShoppingCart',
  'DESIGN_DOCUMENT': 'FileText',
  'CONSTRUCTION': 'HardHat',
};

/**
 * Colors for deliverable types (Tailwind classes)
 */
export const DELIVERABLE_TYPE_COLORS: Record<DeliverableSourcingType, { bg: string; text: string; border: string }> = {
  'CUSTOM_FURNITURE_MILLWORK': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'PROCURED': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'DESIGN_DOCUMENT': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  'CONSTRUCTION': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
};

// ============================================
// Construction Types
// ============================================

/**
 * Construction item sub-categories
 */
export type ConstructionCategory =
  | 'electrical'
  | 'plumbing'
  | 'tiling'
  | 'painting'
  | 'gypsum'
  | 'fitout'
  | 'hvac'
  | 'flooring'
  | 'ceiling'
  | 'other';

/**
 * Human-readable labels for construction categories
 */
export const CONSTRUCTION_CATEGORY_LABELS: Record<ConstructionCategory, string> = {
  'electrical': 'Electrical Works',
  'plumbing': 'Plumbing',
  'tiling': 'Tiling',
  'painting': 'Painting',
  'gypsum': 'Gypsum/Drywall',
  'fitout': 'Fitout Works',
  'hvac': 'HVAC',
  'flooring': 'Flooring',
  'ceiling': 'Ceiling',
  'other': 'Other',
};

/**
 * Icons for construction categories (Lucide icon names)
 */
export const CONSTRUCTION_CATEGORY_ICONS: Record<ConstructionCategory, string> = {
  'electrical': 'Zap',
  'plumbing': 'Droplet',
  'tiling': 'Grid3X3',
  'painting': 'Paintbrush',
  'gypsum': 'Square',
  'fitout': 'Hammer',
  'hvac': 'Wind',
  'flooring': 'Layers',
  'ceiling': 'ArrowUp',
  'other': 'MoreHorizontal',
};

// ============================================
// Construction Pricing Methods
// ============================================

/**
 * Available construction pricing methods
 */
export type ConstructionPricingMethod =
  | 'measured'          // BOQ-style: quantity × unitRate
  | 'lump_sum'          // Single fixed price
  | 'day_works'         // Time & materials: (days × dailyRate) + materials
  | 'cost_plus'         // Cost + fee: (labor + materials) × (1 + feePercent)
  | 'contractor_quote'  // External quote: sum of line items or lump sum
  | 'composite';        // Sum of sub-items with mixed methods

export const PRICING_METHOD_LABELS: Record<ConstructionPricingMethod, string> = {
  measured: 'Measured (BOQ)',
  lump_sum: 'Lump Sum',
  day_works: 'Day Works',
  cost_plus: 'Cost Plus',
  contractor_quote: 'Contractor Quote',
  composite: 'Composite',
};

export const PRICING_METHOD_DESCRIPTIONS: Record<ConstructionPricingMethod, string> = {
  measured: 'Bill of Quantities style: quantity multiplied by an all-inclusive unit rate',
  lump_sum: 'A single fixed price for the entire scope of work',
  day_works: 'Time and materials: labor days at a daily rate plus materials cost',
  cost_plus: 'Actual costs (labor + materials) plus a management fee percentage',
  contractor_quote: 'Pricing based on an external contractor quote document',
  composite: 'Sum of sub-items, each with its own pricing method',
};

/**
 * A line item in a contractor quote
 */
export interface QuoteLineItem {
  id: string;
  description: string;
  amount: number;
  notes?: string;
}

/**
 * A sub-item in a composite construction pricing breakdown
 */
export interface ConstructionSubItem {
  id: string;
  name: string;
  pricingMethod: Exclude<ConstructionPricingMethod, 'composite'>;
  unitType?: ConstructionUnitType;
  quantity?: number;
  unitRate?: number;
  laborCost?: number;
  laborDays?: number;
  laborDailyRate?: number;
  materialsCost?: number;
  managementFeePercent?: number;
  managementFeeAmount?: number;
  lumpSumAmount?: number;
  quoteLineItems?: QuoteLineItem[];
  subtotal: number;
  totalCost: number;
}

/**
 * Unit types for construction pricing
 */
export type ConstructionUnitType = 'sqm' | 'sqft' | 'lm' | 'unit' | 'lot';

/**
 * Labels for construction unit types
 */
export const CONSTRUCTION_UNIT_LABELS: Record<ConstructionUnitType, string> = {
  'sqm': 'Square Meters (m²)',
  'sqft': 'Square Feet (ft²)',
  'lm': 'Linear Meters (lm)',
  'unit': 'Units',
  'lot': 'Lump Sum',
};

/**
 * Short labels for construction unit types
 */
export const CONSTRUCTION_UNIT_SHORT_LABELS: Record<ConstructionUnitType, string> = {
  'sqm': 'm²',
  'sqft': 'ft²',
  'lm': 'lm',
  'unit': 'units',
  'lot': 'lot',
};

/**
 * Construction pricing for fitout/construction items
 */
export interface ConstructionPricing {
  // Category
  category: ConstructionCategory;

  // Contractor info
  contractor?: string;
  contractorContact?: string;
  contractorId?: string;       // Links to Supplier.id in platform/suppliers/records

  // Area/quantity based
  unitType: ConstructionUnitType;
  quantity: number;
  unitRate: number;

  // Labor
  laborCost: number;
  laborDays?: number;
  laborNotes?: string;

  // Materials
  materialsCost: number;
  materialsBreakdown?: string;

  // Subtotals
  subtotal: number;           // (quantity × unitRate) + laborCost + materialsCost

  // VAT
  vatRate?: number;           // e.g., 0.18 for 18%
  vatAmount?: number;

  // Total
  totalCost: number;          // subtotal + vatAmount
  currency: string;

  // Tracking
  quotedAt?: Timestamp;
  quotedBy?: string;
  quoteReference?: string;
  validUntil?: Timestamp;

  // Pricing method (undefined = legacy formula)
  pricingMethod?: ConstructionPricingMethod;

  // Day Works fields
  laborDailyRate?: number;

  // Cost Plus fields
  managementFeePercent?: number;   // e.g., 0.15 for 15%
  managementFeeAmount?: number;    // Calculated: (labor + materials) × feePercent

  // Lump Sum fields
  lumpSumAmount?: number;

  // Contractor Quote fields
  quoteLineItems?: QuoteLineItem[];
  quoteDocument?: string;          // Storage path or URL
  quoteValidUntil?: Timestamp;

  // Composite fields
  subItems?: ConstructionSubItem[];

  // Notes
  scopeOfWork?: string;
  exclusions?: string;
  notes?: string;
}

/**
 * Create default construction pricing
 */
export function createDefaultConstructionPricing(
  category: ConstructionCategory = 'other',
  currency: string = 'UGX',
  pricingMethod?: ConstructionPricingMethod
): ConstructionPricing {
  return {
    category,
    ...(pricingMethod ? { pricingMethod } : {}),
    unitType: 'sqm',
    quantity: 0,
    unitRate: 0,
    laborCost: 0,
    materialsCost: 0,
    subtotal: 0,
    totalCost: 0,
    currency,
  };
}

/**
 * Calculate construction pricing totals (method-aware)
 */
export function calculateConstructionPricing(pricing: ConstructionPricing): ConstructionPricing {
  let subtotal: number;
  let updated = { ...pricing };

  switch (pricing.pricingMethod) {
    case 'measured':
      subtotal = (pricing.quantity || 0) * (pricing.unitRate || 0);
      break;

    case 'lump_sum':
      subtotal = pricing.lumpSumAmount || 0;
      break;

    case 'day_works':
      subtotal = ((pricing.laborDays || 0) * (pricing.laborDailyRate || 0)) + (pricing.materialsCost || 0);
      break;

    case 'cost_plus': {
      const baseCost = (pricing.laborCost || 0) + (pricing.materialsCost || 0);
      const feeAmount = baseCost * (pricing.managementFeePercent || 0);
      subtotal = baseCost + feeAmount;
      updated.managementFeeAmount = feeAmount;
      break;
    }

    case 'contractor_quote': {
      if (pricing.quoteLineItems && pricing.quoteLineItems.length > 0) {
        subtotal = pricing.quoteLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      } else {
        subtotal = pricing.lumpSumAmount || 0;
      }
      break;
    }

    case 'composite': {
      if (pricing.subItems && pricing.subItems.length > 0) {
        subtotal = pricing.subItems.reduce((sum, sub) => sum + (sub.totalCost || 0), 0);
      } else {
        subtotal = 0;
      }
      break;
    }

    default:
      // Legacy fallback: undefined pricingMethod uses the original formula
      subtotal = ((pricing.quantity || 0) * (pricing.unitRate || 0)) + (pricing.laborCost || 0) + (pricing.materialsCost || 0);
      break;
  }

  const vatAmount = updated.vatRate ? subtotal * updated.vatRate : 0;
  const totalCost = subtotal + vatAmount;

  return {
    ...updated,
    subtotal,
    vatAmount,
    totalCost,
  };
}

/**
 * Calculate a composite sub-item's totals
 */
export function calculateSubItem(subItem: ConstructionSubItem): ConstructionSubItem {
  let subtotal: number;
  let updated = { ...subItem };

  switch (subItem.pricingMethod) {
    case 'measured':
      subtotal = (subItem.quantity || 0) * (subItem.unitRate || 0);
      break;
    case 'lump_sum':
      subtotal = subItem.lumpSumAmount || 0;
      break;
    case 'day_works':
      subtotal = ((subItem.laborDays || 0) * (subItem.laborDailyRate || 0)) + (subItem.materialsCost || 0);
      break;
    case 'cost_plus': {
      const base = (subItem.laborCost || 0) + (subItem.materialsCost || 0);
      const fee = base * (subItem.managementFeePercent || 0);
      subtotal = base + fee;
      updated.managementFeeAmount = fee;
      break;
    }
    case 'contractor_quote': {
      if (subItem.quoteLineItems && subItem.quoteLineItems.length > 0) {
        subtotal = subItem.quoteLineItems.reduce((sum, li) => sum + (li.amount || 0), 0);
      } else {
        subtotal = subItem.lumpSumAmount || 0;
      }
      break;
    }
    default:
      subtotal = 0;
  }

  return { ...updated, subtotal, totalCost: subtotal };
}

// ============================================
// Construction Stages
// ============================================

/**
 * Construction workflow stages
 */
export const CONSTRUCTION_STAGES: DesignStage[] = [
  'const-scope',
  'const-spec',
  'const-quote',
  'const-approve',
  'const-in-progress',
  'const-inspection',
  'const-complete',
];

/**
 * Construction stage labels
 */
export const CONSTRUCTION_STAGE_LABELS: Record<string, string> = {
  'const-scope': 'Scope Definition',
  'const-spec': 'Specification',
  'const-quote': 'Quotation',
  'const-approve': 'Approval',
  'const-in-progress': 'Work In Progress',
  'const-inspection': 'Inspection/QC',
  'const-complete': 'Completed',
};

/**
 * Construction readiness checklist.
 *
 * Per-stage gate items a user ticks off to advance a construction deliverable.
 * Ticked proportion drives `overallReadiness` for the item, which the stage
 * gate validates against `minimumReadiness` in `stage-gate.ts`:
 *   const-spec=15, const-quote=30, const-approve=50, const-in-progress=60,
 *   const-inspection=85, const-complete=100.
 *
 * Counts per stage (3 each, 21 total) are chosen so that completing the
 * items up through stage N also satisfies the readiness threshold for the
 * following stage.
 */
export interface ConstructionStageCheckItem {
  key: string;
  label: string;
}

export const CONSTRUCTION_STAGE_CHECKLIST: Record<string, ConstructionStageCheckItem[]> = {
  'const-scope': [
    { key: 'scope-defined', label: 'Scope of work defined' },
    { key: 'location-confirmed', label: 'Site / location confirmed' },
    { key: 'reference-drawings', label: 'Reference drawings or photos attached' },
  ],
  'const-spec': [
    { key: 'materials-specified', label: 'Materials & finishes specified' },
    { key: 'method-agreed', label: 'Method statement / scope of works agreed' },
    { key: 'dimensions-final', label: 'Final dimensions / quantities documented' },
  ],
  'const-quote': [
    { key: 'contractor-identified', label: 'Contractor / subcontractor identified' },
    { key: 'quote-received', label: 'Quote received and logged' },
    { key: 'quote-reviewed', label: 'Quote reviewed against specification' },
  ],
  'const-approve': [
    { key: 'pricing-finalised', label: 'Pricing finalised (total cost > 0)' },
    { key: 'client-approved', label: 'Client approval obtained' },
    { key: 'contract-signed', label: 'Contract / work order signed' },
  ],
  'const-in-progress': [
    { key: 'site-handed-over', label: 'Site handed over to contractor' },
    { key: 'kickoff-done', label: 'Kickoff / pre-start meeting completed' },
    { key: 'materials-on-site', label: 'Materials delivered to site' },
  ],
  'const-inspection': [
    { key: 'quality-checked', label: 'Quality inspection completed' },
    { key: 'snag-list', label: 'Snag list recorded' },
    { key: 'snag-cleared', label: 'All snags cleared' },
  ],
  'const-complete': [
    { key: 'final-signoff', label: 'Final client sign-off obtained' },
    { key: 'handover-docs', label: 'Handover documents delivered' },
    { key: 'final-payment', label: 'Final payment processed' },
  ],
};

/** Total number of construction-readiness checks across all stages. */
export const CONSTRUCTION_CHECKLIST_TOTAL = Object.values(CONSTRUCTION_STAGE_CHECKLIST)
  .reduce((n, items) => n + items.length, 0);

/** Compute overallReadiness (0-100) from a flat checks map. */
export function computeConstructionReadiness(
  checks: Record<string, boolean> | undefined,
): number {
  if (!checks) return 0;
  const ticked = Object.values(checks).filter(Boolean).length;
  if (CONSTRUCTION_CHECKLIST_TOTAL === 0) return 0;
  return Math.round((ticked / CONSTRUCTION_CHECKLIST_TOTAL) * 100);
}

/**
 * Construction stage short labels
 */
export const CONSTRUCTION_STAGE_SHORT_LABELS: Record<string, string> = {
  'const-scope': 'Scope',
  'const-spec': 'Spec',
  'const-quote': 'Quote',
  'const-approve': 'Approve',
  'const-in-progress': 'In Progress',
  'const-inspection': 'Inspection',
  'const-complete': 'Complete',
};

/**
 * Construction stage icons
 */
export const CONSTRUCTION_STAGE_ICONS: Record<string, string> = {
  'const-scope': 'ClipboardList',
  'const-spec': 'FileText',
  'const-quote': 'DollarSign',
  'const-approve': 'CheckCircle',
  'const-in-progress': 'Hammer',
  'const-inspection': 'Search',
  'const-complete': 'Flag',
};

// ============================================
// Type Guards
// ============================================

/**
 * Check if a sourcing type is for construction items
 */
export function isConstructionType(type?: string | null): boolean {
  return normalizeSourcingType(type) === 'CONSTRUCTION';
}

/**
 * Check if a sourcing type is for design documents
 */
export function isDesignDocumentType(type?: string | null): boolean {
  return normalizeSourcingType(type) === 'DESIGN_DOCUMENT';
}

/**
 * Check if a sourcing type is for procured items
 */
export function isProcuredType(type?: string | null): boolean {
  return normalizeSourcingType(type) === 'PROCURED';
}

/**
 * Check if a sourcing type is for custom furniture/millwork
 */
export function isCustomFurnitureType(type?: string | null): boolean {
  return normalizeSourcingType(type) === 'CUSTOM_FURNITURE_MILLWORK';
}

/**
 * Check if a stage is a construction stage
 */
export function isConstructionStage(stage?: string | null): boolean {
  if (!stage) return false;
  return stage.startsWith('const-');
}
