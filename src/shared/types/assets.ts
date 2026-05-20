/**
 * Asset Architecture Types
 * The "Physical Truth" - Types for physical tools and machines
 * 
 * @module shared/types/assets
 */

import type { Timestamp } from './common';

// ============================================
// Asset Status & Category Enums
// ============================================

/**
 * Current operational status of an asset
 */
export type AssetStatus = 
  | 'ACTIVE'        // Fully operational and available
  | 'MAINTENANCE'   // Undergoing scheduled maintenance
  | 'BROKEN'        // Non-functional, awaiting repair
  | 'CHECKED_OUT'   // Currently in use by a user
  | 'RETIRED';      // No longer in service

/**
 * Asset classification by type
 */
export type AssetCategory = 
  | 'STATIONARY_MACHINE'  // Table saw, panel saw, jointer, etc.
  | 'POWER_TOOL'          // Routers, drills, sanders, etc.
  | 'HAND_TOOL'           // Chisels, planes, measuring tools
  | 'JIG'                 // Custom jigs and fixtures
  | 'CNC'                 // CNC routers, nesting machines
  | 'DUST_COLLECTION'     // Dust extractors, cyclones
  | 'SPRAY_EQUIPMENT'     // Spray guns, compressors, booths
  | 'SEWING_MACHINE';     // Industrial sewing machines

// ============================================
// Maintenance Types
// ============================================

/**
 * Maintenance log entry
 */
export interface MaintenanceLogEntry {
  id: string;
  type: 'SCHEDULED' | 'REPAIR' | 'INSPECTION' | 'CALIBRATION';
  description: string;
  tasksCompleted: string[];
  hoursAtService: number;
  cost?: number;
  performedBy: string;
  performedAt: Timestamp;
  notes?: string;
}

/**
 * Asset maintenance configuration and history
 */
export interface AssetMaintenance {
  intervalHours: number;      // Recommended service interval in operating hours
  tasks: string[];            // AI-suggested maintenance tasks
  nextServiceDue: Date;       // When next service is scheduled
  lastServicedAt?: Date;      // When last serviced
  history: MaintenanceLogEntry[];  // Maintenance log entries
}

/**
 * Asset location and checkout tracking
 */
export interface AssetLocation {
  zone: string;              // Physical location (e.g., "Machine Shop", "Assembly Area")
  checkedOutBy?: string;     // User ID if currently checked out
}

// ============================================
// Financial & Depreciation Types
// ============================================

/**
 * Depreciation method for fixed assets
 */
export type DepreciationMethod =
  | 'STRAIGHT_LINE'          // (Cost - Salvage) / Useful Life per year
  | 'DECLINING_BALANCE'      // Double declining balance on remaining book value
  | 'SUM_OF_YEARS_DIGITS'    // Accelerated, based on remaining years fraction
  | 'UNITS_OF_PRODUCTION';   // Based on operating hours

/**
 * Financial information for an asset: acquisition data + depreciation profile.
 */
export interface AssetFinancials {
  // Acquisition
  purchasePrice: number;          // Original cost
  purchaseDate: string;           // ISO date string (YYYY-MM-DD)
  currency: string;               // Currency code, defaults to 'UGX'
  supplier?: string;              // Vendor/supplier name
  invoiceReference?: string;      // Invoice or PO number

  // Depreciation profile
  depreciationMethod: DepreciationMethod;
  usefulLifeYears: number;        // Expected useful life in years
  salvageValue: number;           // Residual value at end of useful life

  // Units-of-production specific
  totalExpectedHours?: number;    // Total expected production hours over lifetime
}

// ============================================
// Core Asset Type
// ============================================

/**
 * Asset - Physical tool or machine in the workshop
 * Represents the "Physical Truth" of what exists in the shop
 */
export interface Asset {
  id: string;
  
  // Identity
  brand: string;              // Manufacturer (e.g., "Festool", "Makita")
  model: string;              // Model number/name
  serialNumber?: string;      // Manufacturer serial number
  nickname?: string;          // Shop nickname (e.g., "Big Blue" for CNC)
  
  // Classification
  category: AssetCategory;
  
  // Technical specifications (AI-populated)
  specs: Record<string, string>;  // e.g., { "RPM": "24000", "Power": "2200W" }
  
  // External resources
  manualUrl?: string;         // Link to PDF manual or online docs
  productPageUrl?: string;    // Manufacturer product page
  
  // Maintenance tracking
  maintenance: AssetMaintenance;
  
  // Current status
  status: AssetStatus;

  // Location tracking
  location: AssetLocation;

  // Financial tracking (optional for backward compatibility)
  financials?: AssetFinancials;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================
// Asset Query Types
// ============================================

/**
 * Filter options for querying assets
 */
export interface AssetFilters {
  category?: AssetCategory | AssetCategory[];
  status?: AssetStatus | AssetStatus[];
  zone?: string;
  search?: string;
  needsMaintenance?: boolean;
}

/**
 * Asset status change event
 */
export interface AssetStatusChange {
  id: string;
  assetId: string;
  fromStatus: AssetStatus;
  toStatus: AssetStatus;
  reason?: string;
  changedBy: string;
  changedAt: Timestamp;
}
