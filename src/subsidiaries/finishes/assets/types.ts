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
  AssetFilters,
  AssetStatusChange,
  MaintenanceLogEntry,
} from '@/shared/types';

// Re-export feature types from shared
export type {
  Feature,
  FeatureCategory,
  FeatureInstance,
  FeatureFilters,
} from '@/shared/types';

// Module-specific types that extend shared types

import type { Timestamp, Asset } from '@/shared/types';

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
