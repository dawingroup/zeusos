/**
 * Smart Asset Registry Types
 * Re-exports types from shared and adds module-specific types
 */

// Re-export all asset types from shared
export type {
  AssetStatus,
  AssetCategory,
  Asset,
  AssetMaintenance,
  AssetLocation,
  AssetFinancials,
  AssetFilters,
  AssetStatusChange,
  MaintenanceLogEntry,
  DepreciationMethod,
} from '@/shared/types';

// Re-export feature types from shared
export type {
  Feature,
  FeatureCategory,
  FeatureInstance,
  FeatureFilters,
} from '@/shared/types';

// Re-export consumable types
export type {
  ConsumableType,
  AssetConsumable,
  ConsumableUsageRecord,
  ConsumableFilters,
} from './types/consumable';
export { CONSUMABLE_TYPE_LABELS } from './types/consumable';

// Module-specific types that extend shared types

import type { Timestamp, Asset } from '@/shared/types';
import type { ConsumableUsageRecord } from './types/consumable';

/**
 * Type of maintenance performed
 */
export type MaintenanceType = 
  | 'SCHEDULED'    // Regular scheduled maintenance
  | 'REPAIR'       // Fixing a breakdown
  | 'INSPECTION'   // Routine inspection
  | 'CALIBRATION'; // Calibration/adjustment

/**
 * Maintenance log (full record for service)
 */
export interface MaintenanceLog {
  id: string;
  assetId: string;
  
  type: MaintenanceType;
  description: string;
  tasksCompleted: string[];
  hoursAtService: number;
  
  partsUsed?: string[];
  consumablesUsed?: ConsumableUsageRecord[];
  cost?: number;
  
  performedBy: string;
  performedAt: Timestamp;
  
  notes?: string;
  attachments?: string[];
}

/**
 * Asset with computed availability info
 */
export interface AssetAvailability {
  assetId: string;
  asset: Asset;
  isOperational: boolean;
  maintenanceDue: boolean;
  hoursUntilService: number;
}

/**
 * Checkout record for tracking asset usage
 */
export interface AssetCheckout {
  id: string;
  assetId: string;

  checkedOutBy: string;
  checkedOutAt: Timestamp;

  checkedInAt?: Timestamp;
  checkedInBy?: string;

  notes?: string;
}

// ============================================
// Depreciation Computed Types (never stored)
// ============================================

/**
 * Single period in a depreciation schedule
 */
export interface DepreciationPeriod {
  year: number;
  periodLabel: string;
  openingBookValue: number;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
}

/**
 * Complete depreciation summary for an asset.
 * Computed client-side, never stored in Firestore.
 */
export interface DepreciationSummary {
  purchasePrice: number;
  currentBookValue: number;
  totalDepreciation: number;
  accumulatedDepreciation: number;
  annualDepreciation: number;
  percentDepreciated: number;       // 0-100
  remainingLifeYears: number;
  isFullyDepreciated: boolean;
  schedule: DepreciationPeriod[];
}
