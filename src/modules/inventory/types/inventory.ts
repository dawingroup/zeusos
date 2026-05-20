/**
 * Unified Inventory Types
 * Single source of truth for materials and inventory items
 */

import { Timestamp } from 'firebase/firestore';
import type { FinishCategory, FinishSubtype, LinkedFinish } from './finishLibrary';

/**
 * Inventory item categories
 */
export type InventoryCategory =
  | 'sheet-goods'
  | 'solid-wood'
  | 'hardware'
  | 'edge-banding'
  | 'finishing'
  | 'adhesives'
  | 'fasteners'
  | 'upholstery'
  | 'other';

/**
 * Units of measure
 */
export type InventoryUnit =
  // Count / Each
  | 'ea'
  | 'pcs'
  | 'pair'
  | 'dozen'
  | 'set'
  // Sheet / Panel
  | 'sheet'
  // Length / Linear
  | 'mm'
  | 'cm'
  | 'm'
  | 'in'
  | 'ft'
  | 'yd'
  | 'lft'
  // Area
  | 'sqmm'
  | 'sqcm'
  | 'sqm'
  | 'sqin'
  | 'sqft'
  | 'sqyd'
  // Volume
  | 'ml'
  | 'cl'
  | 'ltr'
  | 'cbm'
  | 'floz'
  | 'pt'
  | 'qt'
  | 'gal'
  | 'cbft'
  // Weight / Mass
  | 'mg'
  | 'g'
  | 'kg'
  | 'mt'
  | 'oz'
  | 'lb'
  | 'ton'
  // Packaging / Container
  | 'box'
  | 'pack'
  | 'roll'
  | 'bundle'
  | 'carton'
  | 'pallet'
  | 'bag'
  | 'tube'
  | 'can'
  | 'drum'
  | 'barrel'
  | 'spool';

/**
 * Item source tracking
 */
export type InventorySource = 'manual' | 'parts-promotion';

/**
 * Tier for scoped items
 *
 * - `catalogue` — Permanent stock items. Reorderable. Always visible in active inventory.
 * - `project`   — Job-specific items. Linked via linkedProjectIds. Auto-archive when stock
 *                 hits zero and all linked projects are closed.
 */
export type InventoryTier = 'catalogue' | 'project';

/**
 * Grain pattern options
 */
export type GrainPattern = 'none' | 'lengthwise' | 'crosswise' | 'random';

/**
 * Item status
 */
export type InventoryStatus = 'active' | 'discontinued' | 'out-of-stock' | 'archived';

/**
 * Classification: raw material, finished product, or kit (phantom assembly)
 */
export type InventoryClassification = 'material' | 'product' | 'kit';

/**
 * Item type discriminator for the parametric hierarchy.
 *
 * - `standard`           — existing items (sheet goods, fasteners, adhesives). No hierarchy.
 * - `engineering-parent`  — items whose variants change machining/geometry
 *                          (e.g., "Hinge — Inset" vs "Hinge — Full Overlay").
 * - `purchasing-tier`     — children of engineering-parents. Different vendor/cost/brand
 *                          but identical machining (e.g., "Blum Premium" vs "Salice Standard").
 * - `kit`                 — phantom assembly. Stock tracked on components, not the kit itself.
 *                          Expands into component lines during BOM generation.
 */
export type InventoryItemType =
  | 'standard'
  | 'engineering-parent'
  | 'purchasing-tier'
  | 'kit';

/**
 * Shopify sync status for products
 */
export type ShopifySyncStatus = 'not_synced' | 'syncing' | 'synced' | 'error';

/**
 * Price history entry for tracking changes
 */
export interface PriceHistoryEntry {
  costPerUnit: number;
  currency: string;
  recordedAt: Timestamp;
  source: 'manual-update' | 'po-receipt';
}

/**
 * Pricing information
 *
 * `costPerUnit` / `currency` = purchase price in the supplier's transaction currency.
 * `functionalCurrencyCost` / `exchangeRate` = equivalent cost in the company's
 * functional (reporting) currency, currently UGX.
 */
export interface InventoryPricing {
  costPerUnit: number;
  currency: string; // KES, UGX, USD — supplier's purchase currency
  unit: InventoryUnit;

  /** Cost per unit in the functional currency (UGX) */
  functionalCurrencyCost?: number;
  /** Exchange rate used: 1 purchase currency unit = X UGX */
  exchangeRate?: number;

  priceHistory?: PriceHistoryEntry[];

  // === VOLUME-BASED PRICING (solid-wood / timber) ===
  /** Cost normalised to functional currency per cubic metre (e.g. UGX/m³) */
  costPerCubicMetre?: number;
  /** Pricing basis: 'per-unit' (default) or 'per-cbm' for volume-priced items */
  pricingBasis?: 'per-unit' | 'per-cbm';
}

/**
 * Inventory/stock information
 */
export interface InventoryStock {
  inStock: number;
  reorderLevel?: number;

  // === VOLUME TRACKING (solid-wood / timber) ===
  /** Stock in cubic metres (for volume-tracked items) */
  volumeOnHand?: number;
  /** Stock in pieces (for volume-tracked items that are also counted as pieces) */
  piecesOnHand?: number;
}

/**
 * Variant attribute -- what makes a variant different from its parent
 */
export interface VariantAttribute {
  key: string;   // e.g., 'color', 'finish', 'thickness', 'size'
  value: string;  // e.g., 'White', 'Matte', '18mm', '8x4'
}

/**
 * Common variant attribute keys
 */
export const COMMON_VARIANT_ATTRIBUTES = [
  'color',
  'finish',
  'thickness',
  'size',
  'grade',
  'pattern',
  // Universal manufacturing / woodworking attributes
  'material',
  'width',
  'length',
  'depth',
  'weight',
  'brand',
  'model',
  'supplier',
  'species',
  'core',
  'moisture_resistance',
] as const;

/**
 * Supplier-specific pricing for an inventory item
 * Supports multiple suppliers per item with pricing, lead times, and preferences
 */
export interface SupplierInventoryPricing {
  supplierId: string;
  supplierName: string;
  supplierCode?: string;
  unitPrice: number;
  currency: string;
  unit: InventoryUnit;
  minimumOrder?: number;
  leadTimeDays?: number;
  effectiveDate?: Timestamp;
  expiryDate?: Timestamp;
  notes?: string;
  isPreferred: boolean;        // Is this the preferred supplier?
  lastQuotedAt?: Timestamp;
  addedAt: Timestamp;
  addedBy: string;

  // === ENHANCED REQUIREMENTS ===
  qualityTier?: 'economy' | 'standard' | 'premium' | 'luxury';
  certifications?: string[];        // e.g., ['FSC', 'CARB2', 'ISO-9001']
  brand?: string;                   // Brand this supplier provides for this item
  bulkDiscountThreshold?: number;   // Quantity at which bulk discount applies
  bulkDiscountPrice?: number;       // Discounted unit price above threshold
}

/**
 * Form data for adding/editing supplier pricing
 */
export interface SupplierPricingFormData {
  supplierId: string;
  supplierName: string;
  supplierCode?: string;
  unitPrice: number;
  currency: string;
  minimumOrder?: number;
  leadTimeDays?: number;
  notes?: string;
  qualityTier?: 'economy' | 'standard' | 'premium' | 'luxury';
  certifications?: string[];
  brand?: string;
  bulkDiscountThreshold?: number;
  bulkDiscountPrice?: number;
}

/**
 * Computed supplier ranking for an inventory item
 * Combines pricing data with supplier performance metrics
 */
export interface SupplierRankingResult {
  supplierId: string;
  supplierName: string;

  // Pricing
  unitPrice: number;
  currency: string;
  leadTimeDays?: number;
  minimumOrder?: number;

  // Performance (from Supplier entity)
  rating?: number;              // 1-5
  onTimeDeliveryRate?: number;  // 0-100%
  qualityScore?: number;        // 0-100
  totalOrders?: number;

  // Computed scores (0-100 each)
  priceScore: number;
  deliveryScore: number;
  qualityScoreComputed: number;
  overallScore: number;

  // Recommendation
  rank: number;
  isPreferred: boolean;
  recommendation: 'best-value' | 'fastest' | 'highest-quality' | 'preferred' | 'standard';
}

/**
 * Weights for supplier ranking calculation
 */
export interface SupplierRankingWeights {
  price: number;     // default 0.40
  delivery: number;  // default 0.25
  quality: number;   // default 0.25
  reliability: number; // default 0.10
}

export const DEFAULT_RANKING_WEIGHTS: SupplierRankingWeights = {
  price: 0.40,
  delivery: 0.25,
  quality: 0.25,
  reliability: 0.10,
};

// ============================================
// Structured Naming (Rule 2)
// ============================================

/**
 * Structured name components for taxonomy-based naming.
 * Computed display: `[Category Prefix] - [Subcategory] - [Function] - [Key Specs] - [Quality Tier] - [Brand]`
 */
export interface StructuredName {
  function?: string;      // e.g., 'Inset', 'Full Overlay'
  keySpecs?: string;      // e.g., '110° Soft-Close'
  qualityTier?: string;   // e.g., 'Premium', 'Standard', 'Economy'
  brandName?: string;     // e.g., 'Blum', 'Salice', 'Hettich'
}

// ============================================
// Vendor Sources / MPN Decoupling (Rule 3)
// ============================================

/**
 * A vendor source for an inventory item — decouples internal SKU from manufacturer
 * part numbers. One inventory item can be sourced from multiple vendors, each with
 * their own MPN, pricing, and lead times.
 */
export interface VendorSource {
  id: string;                        // Auto-generated UUID
  supplierId: string;                // → suppliers collection
  supplierName: string;
  mpn: string;                       // Manufacturer Part Number
  supplierSku?: string;              // Supplier's own catalogue code (may differ from MPN)
  brandName?: string;                // e.g., 'Blum'
  unitPrice: number;
  currency: string;
  unit: InventoryUnit;
  minimumOrder?: number;
  leadTimeDays?: number;
  isPreferred: boolean;              // One preferred source per item
  qualityTier?: 'economy' | 'standard' | 'premium' | 'luxury';
  certifications?: string[];
  notes?: string;
  url?: string;                      // Supplier product page link
  lastQuotedAt?: Timestamp;
  addedAt: Timestamp;
  addedBy: string;
}

// ============================================
// Kit / Phantom Assembly (Rule 4)
// ============================================

/**
 * A component within a kit (phantom assembly).
 * The kit itself is non-inventoried — stock is tracked on these components.
 */
export interface KitComponent {
  inventoryItemId: string;           // → inventoryItems (must be a stocked item)
  sku: string;                       // Cached for display/BOM
  name: string;                      // Cached
  quantity: number;                  // How many of this component per kit
  unit: InventoryUnit;
  isOptional?: boolean;              // Some kits have optional components
  notes?: string;
}

/**
 * Material dimensions (for sheet goods)
 */
export interface InventoryDimensions {
  length: number; // mm
  width: number; // mm
  thickness: number; // mm
}

/**
 * Upholstery / fabric stock specification.
 *
 * Captured at the inventory level so the nesting optimizer can pull authoritative
 * roll geometry instead of falling back to placeholder defaults. `rollWidth` is
 * fixed by the manufacturer; `defaultBayLength` is the manageable cut section
 * the upholsterer takes off the roll. `allowRotation` is false by default
 * because most upholstery has a nap or pattern direction.
 */
export interface FabricStockSpec {
  /** Across-roll width in mm — fixed by the manufacturer (e.g. 1400). */
  rollWidth: number;
  /** Default along-roll cut section in mm. Defaults to 3000 if omitted. */
  defaultBayLength?: number;
  /** Allow 90° rotation of parts. Default false (preserve nap/pattern). */
  allowRotation?: boolean;
  /** Pattern repeat for matched-pattern fabrics. Future use. */
  patternRepeat?: { length: number; width: number };
}

/**
 * Core Inventory Item interface
 */
export interface InventoryItem {
  id: string;
  sku: string; // Unique identifier
  name: string;
  displayName?: string; // Override for UI display
  description?: string;

  // === CLASSIFICATION & CATEGORIZATION ===
  classification?: InventoryClassification;
  category: InventoryCategory;
  subcategory?: string; // MDF, Plywood, Melamine, etc.
  brand?: string; // Manufacturer or brand name
  tags: string[]; // Searchable tags
  aliases?: string[]; // Alternative names for matching

  // === ITEM TYPE (parametric hierarchy) ===
  itemType?: InventoryItemType;        // default: 'standard' for existing items

  // === STRUCTURED NAME (taxonomy-based naming) ===
  structuredName?: StructuredName;

  // === FAMILY / SKU HIERARCHY ===
  isFamily?: boolean;                      // true = parent record, not transactable
  isOrderable?: boolean;                   // false for families, true for SKUs (default true)
  isBomSelectable?: boolean;               // for materials: can this be used in BOM? (default true)
  familyId?: string | null;                // child SKU → parent family ID (null = flat item)
  skuIds?: string[];                       // family → list of child SKU IDs
  variantAttributeDefinitions?: string[];  // family: which attribute keys variants must specify

  // === UoM CONVERSION (materials) ===
  purchaseUom?: InventoryUnit;             // how you buy it (sheet, roll, piece)
  stockUom?: InventoryUnit;                // how you store/count it (M², LM, kg)
  consumptionUom?: InventoryUnit;          // how BOM draws it down
  uomConversion?: number;                  // 1 purchaseUom = X stockUom

  // === VARIANT SUPPORT (legacy flat variants) ===
  parentItemId?: string;            // If this is a variant, references the parent item
  variantAttributes?: VariantAttribute[]; // What makes this variant different
  variantIds?: string[];            // If this is a parent, list of variant item IDs
  isVariantParent?: boolean;        // Flag: true if this item has variants

  // === ENGINEERING HIERARCHY (parametric) ===
  engineeringParentId?: string;        // For purchasing-tier items → points to engineering-parent
  engineeringFunction?: string;        // The engineering variable value: 'inset', 'full-overlay', etc.
  purchasingTierIds?: string[];        // For engineering-parents → list of purchasing-tier children

  // === VENDOR SOURCES / MPN DECOUPLING ===
  vendorSources?: VendorSource[];      // One internal SKU → many vendor MPNs

  // === KIT / PHANTOM ASSEMBLY ===
  kitComponents?: KitComponent[];      // For kit items — list of component items
  kitSourceId?: string;                // For BOM entries — which kit this item came from

  // === PARAMETRIC TAGS ===
  parametricTags?: Record<string, string>;  // e.g., { doorType: 'inset', hingeDegrees: '110' }

  // === SUPPLIER & SHOPIFY ===
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  shopifySyncStatus?: ShopifySyncStatus;
  shopifyLastSyncAt?: Timestamp;

  /**
   * Storefront publishing — both product-as-product and product-as-material
   * (Shopify metaobject `material`) tracked under this single namespace.
   * Written by functions/src/integrations/shopify/* publishers.
   * See docs/integrations/dawinos-storefront-schema.md §4.1 + §4.6.
   */
  shopify?: {
    // ====== PRODUCT path (dawin.* metafields on existing Shopify product) ======
    /** Gate for the product-as-product path (dawin.* metafield enrichment). */
    shouldPublishAsProduct?: boolean;

    /** Workshop status — one of in-stock / made-to-order / draft. */
    workshopStatus?: 'in-stock' | 'made-to-order' | 'draft';
    /** If true and workshopStatus unset, defaults to made-to-order. */
    isMTO?: boolean;
    leadTimeDaysMin?: number;
    leadTimeDaysMax?: number;

    // Workshop provenance
    handCount?: number;
    benchNumber?: string;
    signedBy?: string;
    batchId?: string;
    /** Linked DawinOS formula id — surfaces as dawin.recipe_id metafield. */
    recipeId?: string;

    // Dimensions + weight
    dimensionsWmm?: number;
    dimensionsHmm?: number;
    dimensionsDmm?: number;
    weightKg?: number;

    // Customer confidence
    careInstructions?: string;
    warrantyMonths?: number;
    countryOfOrigin?: string;
    workshop?: string;
    designerId?: string;

    /** Override for the finish ref. Falls back to item.linkedFinishId. */
    finishId?: string;
    /** Override for the materials list. Falls back to item.materialIds. */
    materialIds?: string[];
    /** ProjectCaseStudy ids whose published metaobjects link to this product. */
    projectsUsedInIds?: string[];

    /** Per-image Shopify file GIDs, by slot. */
    imageGids?: Record<string, string>;

    // Write-back state from applyProductMetafields
    metafieldsLastAt?: Timestamp;
    metafieldsLastError?: string | null;
    /** Last reconciler run for the dawin.* metafields. */
    lastReconciledAt?: Timestamp;

    // ====== MATERIAL metaobject path (dawinfinishes.com /materials/...) ======
    /** Gate — if true and materialCategory is in the spec enum, inventory item publishes as a `material` metaobject. */
    shouldPublishAsMaterial?: boolean;
    /** kebab-case handle; falls back to slugify(item.name). */
    materialHandle?: string;
    /** Shopify `material` metaobject category enum. */
    materialCategory?: 'plaster' | 'timber' | 'metal' | 'fibre' | 'clay' | 'stone' | 'glass';
    /** Plain-text description — published as Shopify rich-text. */
    materialDescription?: string;
    originCountry?: string;
    originRegion?: string;
    /** Override; falls back to item.preferredSupplier. */
    supplier?: string;
    isLocal?: boolean;
    isSustainable?: boolean;
    /** Firebase Storage URL for the certification image (e.g. FSC for timber). */
    certificationImageUrl?: string;

    /** GID of the published `material` metaobject. */
    materialMetaobjectGid?: string;
    materialSyncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'unpublished';
    materialSyncError?: string;
    materialLastPublishedAt?: Timestamp;
    materialCertImageGid?: string;
    /** Cached Shopify file GID for the cert image (publisher writes). */
    shopifyCertImageGid?: string;
  };

  // === QUICKBOOKS SYNC ===
  qboItemId?: string;
  qboSyncStatus?: 'synced' | 'error' | 'pending';
  qboSyncedAt?: Timestamp;

  // === PROJECT LINKS (for products) ===
  linkedProjectIds?: string[];

  // === MULTI-SUPPLIER SUPPORT ===
  supplierPricing?: SupplierInventoryPricing[];

  // === MATERIAL LINKS (reverse lookup) ===
  linkedMaterialIds?: string[];

  // === SOURCE TRACKING ===
  source: InventorySource;
  promotedFromPartId?: string; // If promoted from parts database

  // === TIER ===
  tier: InventoryTier;
  scopeId?: string; // projectId (for project-tier items)

  // === RESTOCKABLE ===
  /** Whether the item can be reordered from suppliers. Default true.
   *  When false AND stock hits zero, auto-archive. */
  restockable?: boolean;

  // === DESIGN PROPERTIES ===
  dimensions?: InventoryDimensions;
  grainPattern?: GrainPattern;
  /** Roll specification for upholstery/fabric items. Drives nesting. */
  fabricSpec?: FabricStockSpec;

  // === PRICING ===
  pricing: InventoryPricing;

  // === INVENTORY STATUS ===
  inventory: InventoryStock;

  // === STATUS ===
  status: InventoryStatus;

  // === FINISH LIBRARY & ATTRIBUTES ===
  finishCategory?: FinishCategory;
  finishSubtype?: FinishSubtype;
  linkedFinishes?: LinkedFinish[];
  linkedFinishIds?: string[];            // flat array for Firestore array-contains queries
  requiredAttributes?: string[];         // references keys from AttributeDefinition
  attributeConstraints?: Record<string, (string | number | boolean)[]>;

  // === METADATA ===
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  /** Last time this item was included in an AI health audit */
  lastAuditedAt?: Timestamp;
}

/**
 * Form data for creating/editing inventory items
 */
export interface InventoryItemFormData {
  sku: string;
  name: string;
  displayName?: string;
  description?: string;
  brand?: string;
  classification?: InventoryClassification;
  category: InventoryCategory;
  subcategory?: string;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  tags?: string[];
  aliases?: string[];
  dimensions?: InventoryDimensions;
  grainPattern?: GrainPattern;
  fabricSpec?: FabricStockSpec;
  pricing: {
    costPerUnit: number;
    currency: string;
    unit: InventoryUnit;
    functionalCurrencyCost?: number;
    exchangeRate?: number;
  };
  status: InventoryStatus;
  tier?: InventoryTier;
  restockable?: boolean;
  linkedProjectIds?: string[];
  // Family / SKU hierarchy
  isFamily?: boolean;
  isOrderable?: boolean;
  isBomSelectable?: boolean;
  familyId?: string | null;
  variantAttributeDefinitions?: string[];
  // UoM conversion (materials)
  purchaseUom?: InventoryUnit;
  stockUom?: InventoryUnit;
  consumptionUom?: InventoryUnit;
  uomConversion?: number;
  // Variant support (legacy)
  parentItemId?: string;
  variantAttributes?: VariantAttribute[];
  // Multi-supplier pricing
  supplierPricing?: SupplierPricingFormData[];

  // === PARAMETRIC EXTENSIONS ===
  itemType?: InventoryItemType;
  structuredName?: StructuredName;
  engineeringParentId?: string;
  engineeringFunction?: string;
  vendorSources?: VendorSource[];
  kitComponents?: KitComponent[];
  parametricTags?: Record<string, string>;

  // === FINISH LIBRARY & ATTRIBUTES ===
  finishCategory?: FinishCategory;
  finishSubtype?: FinishSubtype;
  linkedFinishes?: LinkedFinish[];
  linkedFinishIds?: string[];
  requiredAttributes?: string[];
  attributeConstraints?: Record<string, (string | number | boolean)[]>;
}

/**
 * List item (lightweight for lists)
 */
export interface InventoryListItem {
  id: string;
  sku: string;
  name: string;
  displayName?: string;
  /** Searchable tags (mirror of InventoryItem.tags, projected onto list rows) */
  tags?: string[];
  category: InventoryCategory;
  subcategory?: string;
  brand?: string;
  tier: InventoryTier;
  restockable?: boolean;
  source: InventorySource;
  thickness?: number;
  costPerUnit?: number;
  costUnit?: string;          // Unit the cost is measured in (e.g., 'sheet', 'm', 'sqm', 'cbm', 'ea')
  currency?: string;
  inStock?: number;
  status: InventoryStatus;
  // Family / SKU hierarchy
  isFamily?: boolean;
  isOrderable?: boolean;
  isBomSelectable?: boolean;
  familyId?: string | null;
  skuCount?: number;
  variantAttributeDefinitions?: string[];
  // Variant support (legacy)
  parentItemId?: string;
  isVariantParent?: boolean;
  variantCount?: number;
  // Variant attributes (for child row display)
  variantAttributes?: VariantAttribute[];
  finishCategory?: FinishCategory;
  // Parametric extensions
  itemType?: InventoryItemType;
  classification?: InventoryClassification;
  // Vendor source count (lightweight — full sources on InventoryItem only)
  vendorSourceCount?: number;
}

/**
 * Resolved price with source tracking
 */
export interface ResolvedPrice {
  costPerUnit: number;
  currency: string;
  unit: InventoryUnit;
  source: 'project' | 'customer' | 'catalogue';
  itemId: string;
  itemName: string;
  lastSynced?: Timestamp;
}

/**
 * Category metadata
 */
export const INVENTORY_CATEGORIES: Record<InventoryCategory, { label: string; icon: string }> = {
  'sheet-goods': { label: 'Sheet Goods', icon: '📦' },
  'solid-wood': { label: 'Solid Wood', icon: '🪵' },
  'hardware': { label: 'Hardware', icon: '🔩' },
  'edge-banding': { label: 'Edge Banding', icon: '📏' },
  'finishing': { label: 'Finishing', icon: '🎨' },
  'adhesives': { label: 'Adhesives', icon: '🧴' },
  'fasteners': { label: 'Fasteners', icon: '🔧' },
  'upholstery': { label: 'Upholstery', icon: '🧵' },
  'other': { label: 'Other', icon: '📋' },
};

/**
 * Unit labels
 */
export const INVENTORY_UNITS: Record<InventoryUnit, string> = {
  // Count / Each
  ea: 'each',
  pcs: 'pieces',
  pair: 'pair',
  dozen: 'dozen',
  set: 'set',
  // Sheet / Panel
  sheet: 'sheet',
  // Length / Linear
  mm: 'mm',
  cm: 'cm',
  m: 'metre',
  in: 'inch',
  ft: 'foot',
  yd: 'yard',
  lft: 'linear ft',
  // Area
  sqmm: 'sq mm',
  sqcm: 'sq cm',
  sqm: 'sq m',
  sqin: 'sq in',
  sqft: 'sq ft',
  sqyd: 'sq yd',
  // Volume
  ml: 'ml',
  cl: 'cl',
  ltr: 'litre',
  cbm: 'cu m',
  floz: 'fl oz',
  pt: 'pint',
  qt: 'quart',
  gal: 'gallon',
  cbft: 'cu ft',
  // Weight / Mass
  mg: 'mg',
  g: 'gram',
  kg: 'kg',
  mt: 'metric ton',
  oz: 'oz',
  lb: 'lb',
  ton: 'ton',
  // Packaging / Container
  box: 'box',
  pack: 'pack',
  roll: 'roll',
  bundle: 'bundle',
  carton: 'carton',
  pallet: 'pallet',
  bag: 'bag',
  tube: 'tube',
  can: 'can',
  drum: 'drum',
  barrel: 'barrel',
  spool: 'spool',
};

/**
 * Result of a delete safety check — describes what would happen if an item is deleted
 */
export interface DeleteSafetyCheck {
  itemId: string;
  itemName: string;
  hasStock: boolean;
  stockQty: number;
  warehouseStockLevels: Array<{ warehouseId: string; warehouseName: string; qty: number }>;
  isVariantParent: boolean;
  variantCount: number;
  isFamilyParent: boolean;
  skuCount: number;
  warnings: string[];
}

/**
 * Common sheet sizes (mm)
 */
export const COMMON_SHEET_SIZES: InventoryDimensions[] = [
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

/**
 * Source labels
 */
export const INVENTORY_SOURCE_LABELS: Record<InventorySource, { label: string; color: string }> = {
  'manual': { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
  'parts-promotion': { label: 'From Parts', color: 'bg-purple-100 text-purple-700' },
};

// ============================================
// Family / SKU Hierarchy Types
// ============================================

/**
 * Form data for creating/editing an inventory family (parent record)
 */
export interface FamilyFormData {
  name: string;
  classification: InventoryClassification;
  category: InventoryCategory;
  subcategory?: string;
  description?: string;
  defaultUom?: InventoryUnit;
  variantAttributeDefinitions: string[];
  supplierId?: string;
  supplierName?: string;
  imageUrls?: string[];
  tags?: string[];
}

/**
 * Form data for creating a SKU under a family
 */
export interface SkuFormData extends InventoryItemFormData {
  variantAttributes: VariantAttribute[];
}

/**
 * Computed stock rollup for a family
 */
export interface FamilyStockRollup {
  familyId: string;
  familyName: string;
  variantCount: number;
  totalStockQty: number;
  priceFrom: number;
  priceTo: number;
  costFrom: number;
  costTo: number;
  /** Weighted average cost: sum(cost * qty) / sum(qty). 0 when no stock. */
  weightedAvgCost: number;
  /** Simple average cost: sum(cost) / count. Fallback when no stock data. */
  simpleAvgCost: number;
  /** Primary currency across children (first non-empty) */
  currency: string;
}
