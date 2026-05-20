/**
 * Product Variant Types
 * Represents a unique, trackable stock unit identified by
 * product + finish + attributes combination.
 *
 * Collection: `productVariants`
 * Subcollections: `stockTransactions`, `reservations`
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Transaction Types
// ============================================

export type TransactionType =
  | 'goods_receipt'          // stock in from supplier
  | 'purchase_return'        // returned to supplier
  | 'issue_to_project'       // consumed on a project/estimate
  | 'return_from_project'    // returned from project to stock
  | 'adjustment_in'          // manual stock increase
  | 'adjustment_out'         // manual stock decrease / damage / loss
  | 'transfer_in'            // from another warehouse/location
  | 'transfer_out'           // to another warehouse/location
  | 'opening_balance';       // initial stock setup

export type VariantCreationSource =
  | 'purchase_order'
  | 'goods_receipt'
  | 'manual'
  | 'estimate_conversion';

export type ReservationStatus = 'active' | 'fulfilled' | 'released' | 'expired';

export type ReservationReleaseReason = 'manual' | 'fulfilled' | 'expired' | 'estimate_cancelled';

// ============================================
// Product Variant
// ============================================

/**
 * A unique, trackable stock unit. Created lazily when a
 * product+finish+attributes combination is first purchased,
 * received, or manually created.
 */
export interface ProductVariant {
  id: string;

  // Multi-tenant scoping
  organizationId: string;
  subsidiaryId?: string;

  // Deterministic key from generateVariantKey()
  variantKey: string;

  // Parent references
  productId: string;
  productName: string;                   // denormalized
  finishId: string;
  finishName: string;                    // denormalized
  finishCode: string;                    // denormalized
  hexColor?: string;                     // denormalized for quick display

  // Resolved attributes snapshot
  attributes: Record<string, string | number | boolean>;

  // Generated identifiers
  sku: string;                           // auto-generated: {productCode}-{finishCode}-{attrAbbrev}
  displayName: string;                   // auto-generated: "Melamine Board - Antique White - 18mm 1220x2440"

  // Stock tracking
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;             // onHand - reserved
  reorderLevel?: number;
  unitOfMeasure: string;                 // inherited from parent product

  // Cost
  lastPurchaseCost?: number;
  averageCost?: number;                  // weighted average across receipts
  currency: string;                      // "UGX", "USD"

  // Status
  isActive: boolean;
  firstCreatedFrom: VariantCreationSource;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

// ============================================
// Stock Transaction (subcollection)
// ============================================

/**
 * Immutable ledger entry for a stock movement on a variant.
 * Stored as: `productVariants/{variantId}/stockTransactions/{transactionId}`
 *
 * Never update or delete — only create corrective entries.
 */
export interface StockTransaction {
  id: string;
  variantId: string;
  variantKey: string;
  productId: string;

  type: TransactionType;
  quantity: number;                      // positive for in, negative for out
  unitCost?: number;
  totalCost?: number;                    // quantity × unitCost

  // Reference to source document
  referenceType?: 'purchase_order' | 'goods_receipt' | 'project' | 'estimate' | 'manual';
  referenceId?: string;
  referenceName?: string;                // "PO-2024-0047" or "Rwibaale Hospital"

  // Location tracking (forward-compatible for multi-warehouse)
  locationId: string;                    // default: "main"
  locationName?: string;                 // "Main Workshop", "Rwibaale Site"

  // Running balance (snapshot at time of transaction)
  balanceAfter: number;

  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================
// Stock Reservation (subcollection)
// ============================================

/**
 * Tracked reservation with expiry to prevent stale locks.
 * Stored as: `productVariants/{variantId}/reservations/{reservationId}`
 */
export interface StockReservation {
  id: string;
  variantId: string;
  quantity: number;
  referenceType: 'estimate' | 'project' | 'order';
  referenceId: string;
  referenceName: string;
  status: ReservationStatus;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  releasedAt?: Timestamp;
  releaseReason?: ReservationReleaseReason;
}

// ============================================
// Resolution Types (used by services/hooks)
// ============================================

/**
 * Input to the variant resolution process.
 */
export interface VariantResolution {
  productId: string;
  finishId: string;
  attributes: Record<string, string | number | boolean>;
  creationSource?: VariantCreationSource;
}

/**
 * Result of a variant resolution (find or create).
 */
export interface VariantResolutionResult {
  variant: ProductVariant;
  isNew: boolean;
}

// ============================================
// Constants
// ============================================

/** Default reservation expiry in days */
export const DEFAULT_RESERVATION_EXPIRY_DAYS = 30;
