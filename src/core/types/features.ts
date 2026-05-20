/**
 * Feature Architecture Types
 * The "Capabilities" - Types for manufacturing features and operations
 * 
 * @module shared/types/features
 */

import type { Timestamp } from './common';

// ============================================
// Feature Category Types
// ============================================

/**
 * Feature categories for organization
 */
export type FeatureCategory = 
  | 'JOINERY'          // Dado, rabbet, mortise & tenon, etc.
  | 'EDGE_TREATMENT'   // Edge banding, profiling, rounding
  | 'DRILLING'         // Shelf pins, hardware mounting, hinge boring
  | 'SHAPING'          // Routing, carving, molding
  | 'ASSEMBLY'         // Clamping, fastening, gluing
  | 'FINISHING'        // Sanding, coating, polishing
  | 'CUTTING'          // Panel sizing, mitering, beveling
  | 'SPECIALTY';       // Custom operations

// ============================================
// Core Feature Type
// ============================================

/**
 * Feature - A manufacturing capability or operation
 * Represents what the shop CAN do, linked to the assets required
 */
export interface Feature {
  id: string;
  
  // Identity
  name: string;               // e.g., "Pocket Hole Joinery"
  description?: string;       // Detailed description of the feature
  category: FeatureCategory;
  
  // Asset requirements
  requiredAssetIds: string[]; // Physical tools needed for this feature
  
  // Computed availability (based on asset health)
  isAvailable: boolean;       // false if ANY required asset is down
  availabilityReason: string; // e.g., "CNC Router is down for maintenance"
  
  // Organization
  tags: string[];             // For filtering/search (e.g., ["cabinet", "drawer"])
  
  // Technical details
  parameters?: Record<string, unknown>;  // Feature-specific config
  
  // Estimated time/cost
  estimatedMinutes?: number;  // Base time estimate for this feature
  complexityFactor?: number;  // 1.0 = standard, 2.0 = double time
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================
// Feature Instance Types
// ============================================

/**
 * Feature instance - A specific use of a feature on a design item
 */
export interface FeatureInstance {
  id: string;
  featureId: string;          // Reference to Feature
  designItemId: string;       // Reference to DesignItem using this feature
  
  // Instance-specific parameters
  parameters: Record<string, unknown>;
  quantity: number;           // How many times this feature is applied
  
  // Time tracking
  estimatedMinutes: number;   // Calculated time for this instance
  actualMinutes?: number;     // Actual time (after production)
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Feature Query Types
// ============================================

/**
 * Filter options for querying features
 */
export interface FeatureFilters {
  category?: FeatureCategory | FeatureCategory[];
  tags?: string[];
  isAvailable?: boolean;
  search?: string;
}

/**
 * Feature with asset details (for display)
 */
export interface FeatureWithAssets extends Feature {
  assets: {
    id: string;
    name: string;           // nickname or brand+model
    status: string;
    isOperational: boolean;
  }[];
}
