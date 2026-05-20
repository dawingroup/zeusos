/**
 * Asset Consumables & Repair Parts Types
 * Types for consumable items (cutting tools, filters, wear parts, etc.)
 * that assets require to operate.
 */

import type { Timestamp, AssetCategory } from '@/shared/types';

// ============================================================================
// CONSUMABLE CLASSIFICATION
// ============================================================================

/** How the item is consumed */
export type ConsumableType =
  | 'cutting-tool'   // Router bits, saw blades, drill bits, cutter inserts
  | 'abrasive'       // Sanding discs, grinding wheels, steel wool
  | 'filter'         // Dust bags, spray booth filters, air filters
  | 'lubricant'      // Oil, grease, coolant, cleaning agents
  | 'wear-part'      // Belts, brushes, bearings, gaskets, seals
  | 'electrical'     // Carbon brushes, fuses, switches
  | 'accessory';     // Collets, chucks, guide bushings, throat plates

export const CONSUMABLE_TYPE_LABELS: Record<ConsumableType, string> = {
  'cutting-tool': 'Cutting Tool',
  'abrasive': 'Abrasive',
  'filter': 'Filter',
  'lubricant': 'Lubricant',
  'wear-part': 'Wear Part',
  'electrical': 'Electrical',
  'accessory': 'Accessory',
};

// ============================================================================
// CONSUMABLE ITEM
// ============================================================================

/** Consumable/repair part linked to asset categories */
export interface AssetConsumable {
  id: string;

  // Identity
  name: string;
  partNumber?: string;
  type: ConsumableType;
  description?: string;

  // Compatibility — which assets use this
  compatibleCategories: AssetCategory[];
  compatibleAssetIds?: string[];
  fitmentNotes?: string;

  // Lifecycle
  expectedLifeHours?: number;
  replacementTrigger?: string;
  isCritical: boolean;

  // Stock
  quantityOnHand: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitOfMeasure: string;

  // Pricing
  unitCost?: number;
  currency?: string;
  preferredSupplier?: string;

  // AI-populated
  aiSuggested?: boolean;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/** Record of a consumable being used during maintenance */
export interface ConsumableUsageRecord {
  consumableId: string;
  consumableName: string;
  quantity: number;
  unitCost?: number;
}

// ============================================================================
// FILTERS
// ============================================================================

export interface ConsumableFilters {
  category?: AssetCategory;
  type?: ConsumableType;
  lowStockOnly?: boolean;
  criticalOnly?: boolean;
  searchQuery?: string;
}
