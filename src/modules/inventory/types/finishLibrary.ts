/**
 * Finish Library Types
 * Defines the shared catalog of finishes (colors, textures, surfaces)
 * that can be linked to products in the inventory module.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Finish Categories & Subtypes
// ============================================

export type FinishCategory =
  | 'board'
  | 'paint'
  | 'tile'
  | 'laminate'
  | 'veneer'
  | 'fabric'
  | 'metal'
  | 'stone'
  | 'glass'
  | 'custom';

export type BoardSubtype =
  | 'melamine'
  | 'mdf'
  | 'hdf'
  | 'plywood'
  | 'chipboard'
  | 'blockboard'
  | 'osb'
  | 'hardwood'
  | 'softwood'
  | 'compact_laminate';

export type PaintSubtype =
  | 'emulsion'
  | 'gloss'
  | 'satin'
  | 'matte'
  | 'eggshell'
  | 'primer'
  | 'undercoat'
  | 'lacquer'
  | 'stain'
  | 'varnish'
  | 'epoxy'
  | 'textured'
  | 'metallic';

export type TileSubtype =
  | 'ceramic'
  | 'porcelain'
  | 'vitrified'
  | 'mosaic'
  | 'natural_stone'
  | 'glass_tile'
  | 'cement'
  | 'terrazzo'
  | 'quarry';

export type FinishSubtype = BoardSubtype | PaintSubtype | TileSubtype | string;

export type FinishPatternType =
  | 'solid'
  | 'woodgrain'
  | 'marble'
  | 'textile'
  | 'geometric'
  | 'speckled'
  | 'custom';

export type FinishAvailability =
  | 'in_stock'
  | 'made_to_order'
  | 'discontinued'
  | 'seasonal';

// ============================================
// Dawin Finishes (brand-finish) extension
// ============================================
// The dawinfinishes.com Shopify storefront uses an 8-family taxonomy for the
// hand-mixed brand finishes. This is narrower than `FinishCategory` (which
// covers all finish types used in furniture construction). A FinishDocument
// only publishes to the storefront when `dawinFinishes` is populated.

export type DawinFinishesFamily =
  | 'Lime wash'
  | 'Tadelakt'
  | 'Plaster'
  | 'Wood oil'
  | 'Wax'
  | 'Mineral paint'
  | 'Concrete'
  | 'Earth';

export type DawinFinishesWashability =
  | 'wet-cleanable'
  | 'damp-cleanable'
  | 'dry only';

export type DawinFinishesShopifySyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'unpublished';

/**
 * Brand-storefront fields. Mirror of the Shopify `finish` metaobject spec at
 * docs/integrations/metaobjects/finish.json. Only present on the ~64 hand-mixed
 * Dawin Finishes brand entries — the bulk of the finish library (board,
 * laminate, melamine, etc.) leaves this undefined and never publishes.
 */
export interface DawinFinishesShopifyBlock {
  family: DawinFinishesFamily;
  handle: string;                                    // kebab-case, stable
  wallPreviewImageUrl?: string;                      // 16:10 — required by Shopify spec
  sheen: string;                                     // e.g. "Matte · 3°"
  sheenValue?: number;                               // 0–100 gloss-units
  handCount: number;                                 // e.g. 4
  cureHours: number;
  cureTempCMin?: number;
  cureTempCMax?: number;
  coverageM2PerKg?: number;
  washability?: DawinFinishesWashability;
  outdoorUse?: boolean;
  sampleSku?: string;
  samplePriceUgx?: number;
  sampleLeadDays?: number;
  description: string;                               // rich-text JSON (Shopify Slate format)
  shouldPublishToShopify: boolean;                   // editor gate
  published?: boolean;                               // editor-controlled visibility
  sortIndex?: number;

  // Shopify sync state — written by the publisher, never edited by hand
  shopifyMetaobjectGid?: string;
  shopifyLastPublishedAt?: Timestamp;
  shopifySyncStatus?: DawinFinishesShopifySyncStatus;
  shopifySyncError?: string;
  shopifyTextureImageGid?: string;                   // cached Shopify file GID
  shopifyWallPreviewImageGid?: string;
}

export const DAWIN_FINISHES_FAMILIES: { value: DawinFinishesFamily; label: string }[] = [
  { value: 'Lime wash', label: 'Lime wash' },
  { value: 'Tadelakt', label: 'Tadelakt' },
  { value: 'Plaster', label: 'Plaster' },
  { value: 'Wood oil', label: 'Wood oil' },
  { value: 'Wax', label: 'Wax' },
  { value: 'Mineral paint', label: 'Mineral paint' },
  { value: 'Concrete', label: 'Concrete' },
  { value: 'Earth', label: 'Earth' },
];

export const DAWIN_FINISHES_WASHABILITY: { value: DawinFinishesWashability; label: string }[] = [
  { value: 'wet-cleanable', label: 'Wet-cleanable' },
  { value: 'damp-cleanable', label: 'Damp-cleanable' },
  { value: 'dry only', label: 'Dry only' },
];

// ============================================
// Finish Document
// ============================================

/**
 * A reusable finish definition in the finish library.
 * Each document represents a color/texture/surface that can be
 * linked to many products.
 *
 * Collection: `finishLibrary`
 */
export interface FinishDocument {
  id: string;

  // Multi-tenant scoping
  organizationId: string;
  subsidiaryId?: string;

  // Identity
  name: string;                          // "Antique White", "Ocean Blue Gloss"
  code: string;                          // "MEL-AW-001"
  category: FinishCategory;
  subtype: FinishSubtype;

  // Visual
  hexColor?: string;
  secondaryColor?: string;               // for woodgrain/marble patterns
  patternType?: FinishPatternType;
  thumbnailUrl?: string;                 // swatch image in Firebase Cloud Storage

  // Pricing impact
  costModifier?: number;
  costModifierType?: 'percentage' | 'absolute';
  costModifierUnit?: string;             // Required when costModifierType is 'absolute'

  // Status
  availability: FinishAvailability;
  tags: string[];
  isActive: boolean;

  notes?: string;

  /**
   * Link to the procurable inventory item that supplies this finish (P13/F15).
   *
   * A finish is an abstract design surface ("Antique White Melamine"); the
   * inventory item is the concrete SKU that gets ordered, stocked, and
   * consumed ("MEL-AW-001, 18mm board, 2440x1220"). The two exist in
   * separate collections and until P13 had no FK — the data-model audit
   * flagged that BOMs could reference finishes with no procurable backing.
   *
   * When set, the material-validation layer can:
   *   1. Check aggregate stock via `getAggregatedStock(inventoryItemId)`.
   *   2. Block print-package generation when any mapped finish has zero
   *      available stock.
   *
   * Optional on the type while legacy rows backfill — readers must treat
   * its absence as a "missing inventory link" exception.
   */
  inventoryItemId?: string;

  // PBR Texture Assets (Phase B: material-aware viewer)
  textureAssets?: {
    diffuseUrl?: string;     // Base colour/pattern texture
    normalUrl?: string;      // Normal map for surface detail
    roughnessUrl?: string;   // Roughness map (matte vs gloss)
    tileRepeat?: [number, number]; // UV tiling repeat
  };

  /**
   * Brand-storefront publishing block. Populated only for the ~64 hand-mixed
   * Dawin Finishes brand entries. When set + `shouldPublishToShopify`, the
   * Firestore trigger publishes this finish as a Shopify `finish` metaobject
   * at https://dawinfinishes.com/finishes/{handle}. See
   * docs/integrations/dawinos-storefront-schema.md §4.2.
   */
  dawinFinishes?: DawinFinishesShopifyBlock;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Linked finish entry on an inventory product.
 * Denormalizes key finish fields for display without extra reads.
 */
export interface LinkedFinish {
  finishId: string;
  finishName: string;
  finishCode: string;
  costOverride?: number;
  isDefault?: boolean;
}

// ============================================
// Constants
// ============================================

export const FINISH_CATEGORIES: { value: FinishCategory; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'paint', label: 'Paint' },
  { value: 'tile', label: 'Tile' },
  { value: 'laminate', label: 'Laminate' },
  { value: 'veneer', label: 'Veneer' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'metal', label: 'Metal' },
  { value: 'stone', label: 'Stone' },
  { value: 'glass', label: 'Glass' },
  { value: 'custom', label: 'Custom' },
];

export const BOARD_SUBTYPES: { value: BoardSubtype; label: string }[] = [
  { value: 'melamine', label: 'Melamine' },
  { value: 'mdf', label: 'MDF' },
  { value: 'hdf', label: 'HDF' },
  { value: 'plywood', label: 'Plywood' },
  { value: 'chipboard', label: 'Chipboard' },
  { value: 'blockboard', label: 'Blockboard' },
  { value: 'osb', label: 'OSB' },
  { value: 'hardwood', label: 'Hardwood' },
  { value: 'softwood', label: 'Softwood' },
  { value: 'compact_laminate', label: 'Compact Laminate' },
];

export const PAINT_SUBTYPES: { value: PaintSubtype; label: string }[] = [
  { value: 'emulsion', label: 'Emulsion' },
  { value: 'gloss', label: 'Gloss' },
  { value: 'satin', label: 'Satin' },
  { value: 'matte', label: 'Matte' },
  { value: 'eggshell', label: 'Eggshell' },
  { value: 'primer', label: 'Primer' },
  { value: 'undercoat', label: 'Undercoat' },
  { value: 'lacquer', label: 'Lacquer' },
  { value: 'stain', label: 'Stain' },
  { value: 'varnish', label: 'Varnish' },
  { value: 'epoxy', label: 'Epoxy' },
  { value: 'textured', label: 'Textured' },
  { value: 'metallic', label: 'Metallic' },
];

export const TILE_SUBTYPES: { value: TileSubtype; label: string }[] = [
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'porcelain', label: 'Porcelain' },
  { value: 'vitrified', label: 'Vitrified' },
  { value: 'mosaic', label: 'Mosaic' },
  { value: 'natural_stone', label: 'Natural Stone' },
  { value: 'glass_tile', label: 'Glass Tile' },
  { value: 'cement', label: 'Cement' },
  { value: 'terrazzo', label: 'Terrazzo' },
  { value: 'quarry', label: 'Quarry' },
];

/**
 * Get subtype options for a given category.
 */
export function getSubtypesForCategory(category: FinishCategory): { value: string; label: string }[] {
  switch (category) {
    case 'board': return BOARD_SUBTYPES;
    case 'paint': return PAINT_SUBTYPES;
    case 'tile': return TILE_SUBTYPES;
    default: return [];
  }
}

export const FINISH_AVAILABILITY_OPTIONS: { value: FinishAvailability; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'made_to_order', label: 'Made to Order' },
  { value: 'discontinued', label: 'Discontinued' },
  { value: 'seasonal', label: 'Seasonal' },
];

export const FINISH_PATTERN_OPTIONS: { value: FinishPatternType; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'woodgrain', label: 'Woodgrain' },
  { value: 'marble', label: 'Marble' },
  { value: 'textile', label: 'Textile' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'speckled', label: 'Speckled' },
  { value: 'custom', label: 'Custom' },
];
