/**
 * Offcut Library Types
 *
 * Tracks reusable material remnants from completed production runs.
 * Offcuts are registered after production optimization and can be
 * consumed by future projects to reduce material waste and cost.
 *
 * Firestore collection: 'offcuts'
 */

import type { Timestamp, MaterialType } from './index';

// ============================================
// Offcut Status
// ============================================

/**
 * Lifecycle status of an offcut.
 * available → reserved → used (normal flow)
 * available → scrapped (if damaged or too small)
 * reserved → available (if project cancelled)
 */
export type OffcutStatus = 'available' | 'reserved' | 'used' | 'scrapped';

export type OffcutCondition = 'good' | 'fair' | 'damaged';

// ============================================
// Offcut Document
// ============================================

/**
 * An offcut is a reusable material remnant from a previous production run.
 * Stored in Firestore 'offcuts' collection.
 */
export interface Offcut {
  id: string;

  // ── Material identification ──
  materialType: MaterialType;
  materialId: string;
  materialName: string;

  // ── Dimensions ──
  length: number;                // mm
  width: number;                 // mm (sheet width, or timber cross-section width)
  thickness: number;             // mm

  // Timber-specific: cross-section profile
  crossSection?: {
    thickness: number;
    width: number;
  };
  isDressed?: boolean;           // PAR vs rough-sawn (for timber offcuts)

  // ── Source tracking ──
  sourceProjectId: string;
  sourceProjectName: string;
  sourceSheetId?: string;        // Which nesting sheet / cutting result it came from
  sourceStickIndex?: number;     // For timber: which stick it came from
  sourceDescription?: string;    // Free-text provenance for manual entries
  createdAt: Timestamp;

  // ── Status lifecycle ──
  status: OffcutStatus;
  reservedForProjectId?: string;
  reservedAt?: Timestamp;
  usedInProjectId?: string;
  usedAt?: Timestamp;
  scrappedAt?: Timestamp;
  scrappedReason?: string;

  // ── Location & quality ──
  warehouseLocation?: string;
  condition: OffcutCondition;
  notes?: string;

  // ── Cost attribution ──
  /** Portion of original stock cost attributed to this offcut */
  originalCostAllocation: number;
}

// ============================================
// Offcut Query & Usage
// ============================================

/**
 * Criteria for querying matching offcuts from the library.
 */
export interface OffcutQuery {
  materialType: MaterialType;
  materialName: string;
  minLength: number;             // mm - minimum usable length
  minWidth?: number;             // mm - for panels
  minThickness?: number;         // mm
  crossSection?: {               // For timber: match cross-section
    thickness: number;
    width: number;
  };
}

/**
 * An offcut that was used during optimization.
 * Tracked in estimation/production results.
 */
export interface UsedOffcut {
  offcutId: string;
  materialName: string;
  dimensions: string;            // Human-readable (e.g., "450×300mm" or "38×100mm × 1200mm")
  savedCost: number;             // Cost saved by using this offcut instead of new stock
}

/**
 * An offcut generated from a production run.
 * Tracked in production results before being registered in the library.
 */
export interface GeneratedOffcut {
  materialName: string;
  materialType: MaterialType;
  dimensions: string;            // Human-readable
  length: number;
  width: number;
  thickness: number;
  crossSection?: { thickness: number; width: number };
  reusable: boolean;             // Meets minimum size thresholds
  costAllocation: number;        // Attributed cost from source stock
}
