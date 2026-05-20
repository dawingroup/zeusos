/**
 * Warehouse & Multi-Location Stock Types
 * Stock levels, movements, and cost history tracking
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// Warehouses
// ============================================

/**
 * Types of storage locations
 */
export type WarehouseType = 'warehouse' | 'shop-floor' | 'project-site' | 'transit';

/**
 * Human-readable labels for warehouse types
 */
export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  warehouse: 'Warehouse',
  'shop-floor': 'Shop Floor',
  'project-site': 'Project Site',
  transit: 'In Transit',
};

/**
 * Warehouse / storage location entity
 */
export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  address?: string;
  isActive: boolean;
  subsidiaryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  /** Can receive purchased goods (PO/OPO ship-to) */
  isBuyEnabled?: boolean;
  /** Can consume ingredients (OPO track-ingredients-in, MO production) */
  isMakeEnabled?: boolean;
  /** Represents a contractor's external facility */
  isContractorLocation?: boolean;
  /** If contractor location, link to the supplier */
  linkedSupplierId?: string;
}

// ============================================
// Stock Levels
// ============================================

/**
 * Per-item per-location stock quantities
 * Composite key: inventoryItemId + warehouseId
 */
export interface StockLevel {
  id: string;
  inventoryItemId: string;
  warehouseId: string;

  /** Denormalized for display */
  sku: string;
  itemName: string;

  /** Total physical quantity at this location */
  quantityOnHand: number;

  /** Quantity reserved for manufacturing orders */
  quantityReserved: number;

  /** quantityOnHand - quantityReserved */
  quantityAvailable: number;

  /** Minimum stock level before reorder alert */
  reorderLevel?: number;

  lastReceivedAt?: Timestamp;
  lastConsumedAt?: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Stock Movements (Audit Trail)
// ============================================

/**
 * Types of stock movements
 */
export type StockMovementType =
  | 'receipt'                // Goods received from PO
  | 'consumption'            // Used in manufacturing
  | 'reservation'            // Reserved for MO
  | 'release'                // Released from MO reservation
  | 'transfer'               // Moved between locations
  | 'adjustment'             // Manual stock correction
  | 'item-transfer'          // Transferred between inventory items (e.g., before deletion)
  | 'opo-ingredient-commit'  // Ingredients reserved for OPO consumption
  | 'opo-ingredient-consume' // Ingredients consumed when OPO received
  | 'opo-ingredient-release' // Ingredients released on OPO delete/revert
  | 'opo-goods-receipt';     // Finished goods received from contractor

/**
 * What triggered the stock movement
 */
export type StockMovementReferenceType = 'po' | 'mo' | 'transfer' | 'manual' | 'item-transfer' | 'opo';

/**
 * Individual stock movement record (subcollection of stockLevels)
 */
export interface StockMovement {
  id: string;
  type: StockMovementType;

  /** Positive for stock in, negative for stock out */
  quantity: number;

  referenceType: StockMovementReferenceType;
  referenceId: string;
  notes?: string;
  performedBy: string;
  performedAt: Timestamp;
}

// ============================================
// Cost History
// ============================================

/**
 * Source of a cost change
 */
export type CostChangeSource = 'po_receipt' | 'manual_adjustment' | 'receipt_correction';

/**
 * Tracks unit cost changes over time for an inventory item
 */
export interface CostHistoryEntry {
  id: string;
  inventoryItemId: string;
  previousCost: number;
  newCost: number;
  currency: string;
  source: CostChangeSource;
  referenceId?: string;
  poNumber?: string;
  notes?: string;
  recordedAt: Timestamp;
  recordedBy: string;
}

// ============================================
// Stock Transfer
// ============================================

/**
 * Request to transfer stock between locations
 */
export interface StockTransferRequest {
  inventoryItemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}
