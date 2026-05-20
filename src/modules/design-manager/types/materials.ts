/**
 * Material Library Types
 * Three-tier material system: Global → Customer → Project
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Material categories
 */
export type MaterialCategory =
  | 'sheet-goods'
  | 'solid-wood'
  | 'hardware'
  | 'edge-banding'
  | 'finishing'
  | 'glass'
  | 'metal'
  | 'fabric-upholstery'
  | 'stone-composite'
  | 'other';

/**
 * Subcategories per material category
 */
export const MATERIAL_SUBCATEGORIES: Record<MaterialCategory, string[]> = {
  'sheet-goods': ['Plywood', 'MDF', 'Particle Board', 'Melamine', 'HPL/Laminate', 'Veneer', 'Acrylic Sheet'],
  'solid-wood': ['Hardwood', 'Softwood', 'Engineered Wood', 'Reclaimed Wood'],
  'hardware': ['Hinges', 'Drawer Slides', 'Handles/Knobs', 'Locks', 'Connectors/Brackets', 'Casters', 'Lighting'],
  'edge-banding': ['PVC', 'ABS', 'Veneer', 'Solid Wood', 'Melamine'],
  'finishing': ['Paints', 'Stains', 'Lacquers', 'Oils/Waxes', 'Sealers', 'Adhesives'],
  'glass': ['Clear Float', 'Tinted', 'Frosted', 'Tempered', 'Laminated', 'Low-E'],
  'metal': ['Steel', 'Aluminium', 'Brass', 'Stainless Steel', 'Copper'],
  'fabric-upholstery': ['Fabric', 'Leather', 'Faux Leather', 'Foam', 'Batting/Webbing'],
  'stone-composite': ['Natural Stone', 'Quartz', 'Solid Surface', 'Ceramic/Porcelain'],
  'other': ['General'],
};

/**
 * Functional use classification
 */
export type FunctionalUse = 'structural' | 'decorative' | 'functional' | 'protective' | 'finishing';

export const FUNCTIONAL_USE_OPTIONS: { value: FunctionalUse; label: string }[] = [
  { value: 'structural', label: 'Structural' },
  { value: 'decorative', label: 'Decorative' },
  { value: 'functional', label: 'Functional' },
  { value: 'protective', label: 'Protective' },
  { value: 'finishing', label: 'Finishing' },
];

/**
 * Common application areas
 */
export const APPLICATION_AREAS = [
  'Kitchen', 'Bedroom', 'Bathroom', 'Living Room', 'Office',
  'Dining Room', 'Outdoor', 'Commercial', 'Hospitality',
] as const;

/**
 * Preferred supplier info on a material
 */
export interface MaterialPreferredSupplier {
  name: string;
  contactInfo?: string;
  leadTimeDays?: number;
  moq?: number;
  moqUnit?: string;
}

/**
 * Physical properties of a material
 */
export interface MaterialProperties {
  weight?: number;         // kg per unit
  density?: number;        // kg/m³
  fireRating?: string;     // e.g. 'Class A', 'B1'
  moistureResistance?: string; // e.g. 'Low', 'Medium', 'High', 'Waterproof'
  durabilityRating?: string;   // e.g. 'Light Duty', 'Medium', 'Heavy Duty'
  colorCode?: string;      // hex or reference code
  finish?: string;         // e.g. 'Matt', 'Gloss', 'Satin', 'Textured'
  texture?: string;        // e.g. 'Smooth', 'Rough', 'Embossed'
}

/**
 * Material units of measure
 */
export type MaterialUnit =
  | 'sheet'
  | 'sqft'
  | 'sqm'
  | 'lft'
  | 'pcs'
  | 'gal'
  | 'ea';

/**
 * Material tier (where the material is defined)
 */
export type MaterialTier = 'global' | 'customer' | 'project';

/**
 * Grain pattern options
 */
export type GrainPattern = 'none' | 'lengthwise' | 'crosswise' | 'random';

/**
 * Material dimensions for sheet goods
 */
export interface MaterialDimensions {
  length: number; // mm
  width: number; // mm
  thickness: number; // mm
}

/**
 * Quality tier classification for materials
 */
export type MaterialQualityTier = 'economy' | 'standard' | 'premium' | 'luxury';

/**
 * AI enhancement metadata stored on a material created from a clip
 */
export interface MaterialAIEnhancement {
  enhancedAt: Timestamp;
  model: string;                // e.g. 'gemini-2.5-pro'
  confidence: number;           // 0-1
  competitivePosition: string;  // AI assessment summary
  strategyAlignment: number;    // 0-100 score
  suggestedAlternatives?: string[];
  notes: string;                // Full AI reasoning
}

/**
 * Material pricing information
 */
export interface MaterialPricing {
  unitCost: number;
  unitPrice?: number;             // Price per unit (used in MaterialDetailDrawer)
  currency: string; // KES, USD, etc.
  unit: MaterialUnit;
  lastUpdated?: Timestamp;
  supplier?: string;
  // Functional currency (UGX) conversion
  functionalCurrencyCost?: number;
  exchangeRate?: number;
  // Landed cost estimate
  landedCostEstimate?: {
    shipping?: number;
    customs?: number;
    duties?: number;
    other?: number;
    total: number;
  };
  // Margin
  marginPercent?: number;
  estimatedSellingPrice?: number;

  // === P12-1 (F11) — override metadata ===
  // See `./materialCost.ts` for rollout plan + resolver. These fields
  // let an operator explicitly pin a unitCost/currency that diverges
  // from the linked InventoryItem.pricing.costPerUnit. `resolveMaterialUnitCost`
  // treats `isOverride: true` as authoritative over the inventory link.
  // Absence of the flag = no override (inventory wins when linked).
  /** When true, this pricing takes precedence over the linked InventoryItem's cost. */
  isOverride?: boolean;
  /** Free-text reason the override was set (shown in audit / tooltips). */
  overrideReason?: string;
  /** Timestamp captured by the writer when the override flag was last toggled on. */
  overrideAt?: Timestamp;
  /** User id that authored the override. */
  overrideBy?: string;
}

/**
 * Core Material interface
 */
export interface Material {
  id: string;
  code: string; // Unique material code
  name: string;
  description?: string;
  category: MaterialCategory;
  subcategory?: string;

  // Dimensions
  dimensions?: MaterialDimensions;

  // Pricing
  pricing?: MaterialPricing;

  // Grain
  grainPattern?: GrainPattern;

  // === USE CASES & APPLICATION ===
  useCases?: string[];
  functionalUse?: FunctionalUse;
  applicationAreas?: string[];

  // === SUPPLIER INFO ===
  preferredSupplier?: MaterialPreferredSupplier;
  alternateSuppliers?: string[];

  // === MATERIAL PROPERTIES ===
  properties?: MaterialProperties;
  images?: string[];
  datasheetUrl?: string;

  // Status
  status: 'active' | 'discontinued' | 'out-of-stock';

  // Tier info
  tier: MaterialTier;

  // For customer/project materials - reference to parent
  parentMaterialId?: string;

  // === INVENTORY LINK ===
  inventoryItemId?: string;      // Link to InventoryItem
  inventoryItemSku?: string;     // Cached for display
  linkedAt?: Timestamp;          // When link was established
  linkedBy?: string;             // User who created link

  // === CLIP PROVENANCE (set when created from a Clipper clip) ===
  clipId?: string;               // Link back to designClips doc
  sourceUrl?: string;            // Original web page URL
  sourceImageUrl?: string;       // Product image from clip
  qualityTier?: MaterialQualityTier;

  // === AI ENHANCEMENT METADATA ===
  aiEnhancement?: MaterialAIEnhancement;

  // Legacy pricing field (used by materialPricingService)
  pricePerSqM?: number;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Form data for creating/editing materials
 */
export interface MaterialFormData {
  code: string;
  name: string;
  description?: string;
  category: MaterialCategory;
  subcategory?: string;
  dimensions?: MaterialDimensions;
  pricing?: Omit<MaterialPricing, 'lastUpdated'>;
  grainPattern?: GrainPattern;
  useCases?: string[];
  functionalUse?: FunctionalUse;
  applicationAreas?: string[];
  preferredSupplier?: MaterialPreferredSupplier;
  alternateSuppliers?: string[];
  properties?: MaterialProperties;
  images?: string[];
  datasheetUrl?: string;
  status: 'active' | 'discontinued' | 'out-of-stock';
}

/**
 * Material list item (lightweight for lists)
 */
export interface MaterialListItem {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  subcategory?: string;
  tier: MaterialTier;
  thickness?: number;
  unitCost?: number;
  currency?: string;
  status: 'active' | 'discontinued' | 'out-of-stock';

  /**
   * P12-4 (F11) — surfaced on the list item so the MaterialList row
   * can call `resolveMaterialUnitCost` and `detectMaterialCostDrift`
   * without re-fetching the full `Material` doc. Both fields mirror
   * the equivalent on the source `Material` record.
   */
  isOverride?: boolean;
  inventoryItemId?: string;
}

/**
 * Merged material (resolved from all tiers)
 */
export interface ResolvedMaterial extends Material {
  resolvedFrom: MaterialTier; // Which tier this was resolved from
  overrides?: {
    pricing?: MaterialPricing; // Project-level price override
  };
}

/**
 * Supplier pricing summary for materials with linked inventory
 */
export interface SupplierPricingSummary {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  currency: string;
  leadTimeDays?: number;
  isPreferred: boolean;
}

/**
 * Inventory status for linked materials
 */
export type LinkedInventoryStatus = 'active' | 'discontinued' | 'out-of-stock' | 'archived';

/**
 * Extended material with resolved inventory data
 * Used when displaying materials with their linked inventory info
 */
export interface MaterialWithInventory extends Material {
  inventory?: {
    id: string;
    sku: string;
    name: string;
    inStock: number;
    reorderLevel?: number;
    costPerUnit: number;
    currency: string;
    status: LinkedInventoryStatus;
    preferredSupplierId?: string;
    preferredSupplierName?: string;
  };
  suppliers?: SupplierPricingSummary[];
}

/**
 * Material category metadata
 */
export const MATERIAL_CATEGORIES: Record<MaterialCategory, { label: string; icon: string }> = {
  'sheet-goods': { label: 'Sheet Goods', icon: '📦' },
  'solid-wood': { label: 'Solid Wood', icon: '🪵' },
  'hardware': { label: 'Hardware', icon: '🔩' },
  'edge-banding': { label: 'Edge Banding', icon: '📏' },
  'finishing': { label: 'Finishing', icon: '🎨' },
  'glass': { label: 'Glass', icon: '🪟' },
  'metal': { label: 'Metal', icon: '⚙️' },
  'fabric-upholstery': { label: 'Fabric & Upholstery', icon: '🧵' },
  'stone-composite': { label: 'Stone & Composite', icon: '🪨' },
  'other': { label: 'Other', icon: '📋' },
};

/**
 * Material unit labels
 */
export const MATERIAL_UNITS: Record<MaterialUnit, string> = {
  sheet: 'Sheet',
  sqft: 'sq ft',
  sqm: 'sq m',
  lft: 'linear ft',
  pcs: 'pieces',
  gal: 'gallon',
  ea: 'each',
};

/**
 * Common sheet sizes (mm)
 */
export const COMMON_SHEET_SIZES: MaterialDimensions[] = [
  { length: 2440, width: 1220, thickness: 18 }, // 8x4 ft
  { length: 2440, width: 1220, thickness: 16 },
  { length: 2440, width: 1220, thickness: 12 },
  { length: 2440, width: 1220, thickness: 9 },
  { length: 2440, width: 1220, thickness: 6 },
  { length: 2440, width: 1220, thickness: 3 },
  { length: 3050, width: 1220, thickness: 18 }, // 10x4 ft
  { length: 3050, width: 1220, thickness: 16 },
  { length: 2500, width: 1250, thickness: 18 }, // European standard
];

/**
 * Common thicknesses (mm)
 */
export const COMMON_THICKNESSES = [3, 6, 9, 12, 15, 16, 18, 22, 25];

// ============================================
// Stock Size Presets for Different Material Types
// ============================================

/**
 * Common panel sheet sizes with labels for UI selection
 */
export const PANEL_SIZE_PRESETS = [
  { length: 2440, width: 1220, label: '2440 × 1220mm (8×4 ft)' },
  { length: 3050, width: 1220, label: '3050 × 1220mm (10×4 ft)' },
  { length: 2500, width: 1250, label: '2500 × 1250mm (European)' },
  { length: 2800, width: 2070, label: '2800 × 2070mm (Egger)' },
  { length: 2750, width: 1830, label: '2750 × 1830mm (PG Bison)' },
  { length: 2790, width: 2050, label: '2790 × 2050mm (Kronospan)' },
];

/**
 * Common stone slab sizes
 */
export const STONE_SLAB_PRESETS = [
  { length: 3000, width: 1500, label: '3000 × 1500mm (Standard Slab)' },
  { length: 2800, width: 1400, label: '2800 × 1400mm' },
  { length: 2440, width: 1220, label: '2440 × 1220mm (8×4 ft)' },
  { length: 3200, width: 1600, label: '3200 × 1600mm (Jumbo Slab)' },
  { length: 3050, width: 1220, label: '3050 × 1220mm (10×4 ft)' },
];

/**
 * Common glass sheet sizes
 */
export const GLASS_SIZE_PRESETS = [
  { length: 2440, width: 1220, label: '2440 × 1220mm (8×4 ft)' },
  { length: 2440, width: 1830, label: '2440 × 1830mm (8×6 ft)' },
  { length: 3000, width: 1500, label: '3000 × 1500mm' },
  { length: 3210, width: 2250, label: '3210 × 2250mm (Jumbo)' },
  { length: 3200, width: 2400, label: '3200 × 2400mm (Laminated)' },
  { length: 2134, width: 1524, label: '2134 × 1524mm (7×5 ft)' },
];

/**
 * Glass type options
 */
export const GLASS_TYPES = [
  { value: 'clear', label: 'Clear Float' },
  { value: 'tinted', label: 'Tinted' },
  { value: 'frosted', label: 'Frosted/Sandblasted' },
  { value: 'laminated', label: 'Laminated Safety' },
  { value: 'tempered', label: 'Tempered/Toughened' },
  { value: 'low-e', label: 'Low-E Coated' },
] as const;

export type GlassType = typeof GLASS_TYPES[number]['value'];

// Timber cross-section / length presets removed — stock should come from
// inventory ("Sync from inventory" in Stock Configuration) or from manual
// entry. Hardcoded defaults were producing fictional sizes the workshop
// didn't actually have on hand.

/**
 * Linear profile types (metal bars, aluminium extrusions)
 */
export const LINEAR_PROFILE_TYPES = [
  { value: 'round', label: 'Round Bar' },
  { value: 'square', label: 'Square Hollow Section (SHS)' },
  { value: 'rectangle', label: 'Rectangular Hollow Section (RHS)' },
  { value: 'angle', label: 'Angle (L-Section)' },
  { value: 'channel', label: 'Channel (C-Section)' },
  { value: 'flat', label: 'Flat Bar' },
  { value: 'tube', label: 'Round Tube' },
] as const;

export type LinearProfileType = typeof LINEAR_PROFILE_TYPES[number]['value'];

/**
 * Common linear stock profiles with dimensions
 */
export const LINEAR_PROFILE_PRESETS = [
  { type: 'square' as const, dimension1: 20, label: '20×20 SHS' },
  { type: 'square' as const, dimension1: 25, label: '25×25 SHS' },
  { type: 'square' as const, dimension1: 40, label: '40×40 SHS' },
  { type: 'square' as const, dimension1: 50, label: '50×50 SHS' },
  { type: 'rectangle' as const, dimension1: 50, dimension2: 25, label: '50×25 RHS' },
  { type: 'rectangle' as const, dimension1: 75, dimension2: 50, label: '75×50 RHS' },
  { type: 'rectangle' as const, dimension1: 100, dimension2: 50, label: '100×50 RHS' },
  { type: 'angle' as const, dimension1: 25, dimension2: 25, label: '25×25 Angle' },
  { type: 'angle' as const, dimension1: 40, dimension2: 40, label: '40×40 Angle' },
  { type: 'angle' as const, dimension1: 50, dimension2: 50, label: '50×50 Angle' },
  { type: 'round' as const, dimension1: 10, label: '10mm Round Bar' },
  { type: 'round' as const, dimension1: 12, label: '12mm Round Bar' },
  { type: 'round' as const, dimension1: 16, label: '16mm Round Bar' },
  { type: 'round' as const, dimension1: 20, label: '20mm Round Bar' },
  { type: 'round' as const, dimension1: 25, label: '25mm Round Bar' },
  { type: 'flat' as const, dimension1: 25, dimension2: 3, label: '25×3 Flat Bar' },
  { type: 'flat' as const, dimension1: 40, dimension2: 5, label: '40×5 Flat Bar' },
  { type: 'flat' as const, dimension1: 50, dimension2: 5, label: '50×5 Flat Bar' },
  { type: 'tube' as const, dimension1: 25, wallThickness: 2, label: '25mm Tube (2mm wall)' },
  { type: 'tube' as const, dimension1: 32, wallThickness: 2.5, label: '32mm Tube (2.5mm wall)' },
];

/**
 * Common linear stock lengths (mm)
 */
export const LINEAR_LENGTH_PRESETS = [
  { length: 3000, label: '3.0m' },
  { length: 6000, label: '6.0m' },
  { length: 6500, label: '6.5m' },
];

/**
 * Linear stock material options
 */
export const LINEAR_MATERIAL_TYPES = [
  { value: 'steel', label: 'Mild Steel' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'stainless', label: 'Stainless Steel' },
  { value: 'brass', label: 'Brass' },
  { value: 'copper', label: 'Copper' },
  { value: 'other', label: 'Other' },
] as const;

export type LinearMaterialType = typeof LINEAR_MATERIAL_TYPES[number]['value'];
