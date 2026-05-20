/**
 * Manufacturing Data Package Types
 *
 * Types for the complete manufacturing data package including
 * BOM, cut list, hardware schedule, and shortage alerts.
 */
import type { Timestamp } from 'firebase/firestore';
import type { ComputedBOMLine, PricingBreakdown, StockStatus } from './constraintEngine.types';

/** Boring specification for hardware installation (single-hole pattern).
 *  Used by HardwareScheduleEntry to describe the drilling pattern
 *  for one hardware item. For the full CNC boring spec of a part,
 *  see `CNCBoringSpec`. */
export interface BoringSpec {
  /** Hole diameter in mm */
  diameter: number;
  /** Hole depth in mm */
  depth: number;
  /** Distance from reference edge in mm */
  offsetFromEdge: number;
  pattern: 'single' | 'line_32mm' | 'custom';
  /** Custom positions in mm from reference edge */
  positions?: number[];
}

// ---------------------------------------------------------------------------
// CNC Boring — canonical shape for all drilling data on a ScenePart / PartEntry
// ---------------------------------------------------------------------------

export type BoringFace = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

/** A single drilled hole on a part face. */
export interface BoringHole {
  /** Which face of the part the hole enters. */
  face: BoringFace;
  /** X offset from face origin (mm). Origin = bottom-left corner of the
   *  face when viewed head-on, X = along the longer edge. */
  x: number;
  /** Y offset from face origin (mm). */
  y: number;
  /** Hole diameter in mm. */
  diameter: number;
  /** Hole depth in mm. */
  depth: number;
  /** True if the hole goes all the way through the part. */
  through?: boolean;
}

/** A hardware item that drilling operations on this part are intended
 *  to receive (e.g. "35 mm Blum hinge cup", "8 mm dowel"). */
export interface HardwareBoringTarget {
  /** Inventory / materials-library id (if resolvable). */
  inventoryItemId?: string;
  /** Human-readable label for the hardware item. */
  label?: string;
  /** How many of this item the holes receive. */
  quantity: number;
}

/** Complete CNC boring specification for a single part.
 *
 *  This is the **canonical persisted shape** for `ScenePart.boringSpec`
 *  and `PartEntry.boringSpec`. Supersedes the three ad-hoc shapes
 *  (`{ targets }`, `{ hardware }`, `{ holes: [{ itemId }] }`) that
 *  accumulated before P1.3 consolidation.
 *
 *  Legacy data is normalised at read-time by `normalizeBoringSpec()`.
 */
export interface CNCBoringSpec {
  /** All holes to be drilled on this part. */
  holes: BoringHole[];
  /** Hardware items the holes are intended to receive. */
  targets?: HardwareBoringTarget[];
}

/** Complete manufacturing data package */
export interface ManufacturingDataPackage {
  pddId: string;
  configuration: Record<string, unknown>;
  finishSelections: Record<string, string>;
  timestamp: Timestamp;
  manufacturingOrderId?: string;
  quoteId?: string;
  designRevisionId?: string;
  bom: ComputedBOMLine[];
  pricingBreakdown: PricingBreakdown;
  cutList?: CutListEntry[];
  edgeBandingSchedule?: EdgeBandingEntry[];
  hardwareSchedule?: HardwareScheduleEntry[];
  stockAvailability: Record<string, StockStatus>;
  shortages: ShortageAlert[];
  glbUrl: string;
  thumbnailUrl: string;
  arReady: boolean;
}

/** Cut list entry for a single panel/part */
export interface CutListEntry {
  partName: string;
  material: string;
  finishLibraryId: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: {
    top: string | null;
    bottom: string | null;
    left: string | null;
    right: string | null;
  };
  notes?: string;
}

/** Edge banding schedule entry */
export interface EdgeBandingEntry {
  edgeType: string;
  inventoryItemId: string;
  totalLength: number;
  unit: 'lm';
  panels: string[];
}

/** Hardware schedule entry */
export interface HardwareScheduleEntry {
  hardwareName: string;
  inventoryItemId: string;
  quantity: number;
  perUnit: string;
  boringRequired: boolean;
  boringSpec?: BoringSpec;
  notes?: string;
}

/** Alert for material shortage */
export interface ShortageAlert {
  inventoryItemId: string;
  itemName: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortfall: number;
  estimatedRestockDays?: number;
  suggestedAction: 'create_po' | 'substitute' | 'wait';
  alternativeItemIds?: string[];
}
