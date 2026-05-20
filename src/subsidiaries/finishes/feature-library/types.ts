/**
 * Feature Library Types
 * Re-exports from shared and adds module-specific types
 */

// Re-export feature types from shared
export type {
  Feature,
  FeatureCategory,
  FeatureInstance,
  FeatureFilters,
  FeatureWithAssets,
} from '@/shared/types';

// Module-specific types

import type { Timestamp } from '@/shared/types';

// ============================================
// Manufacturing Feature Types
// ============================================

/**
 * Feature category for manufacturing operations
 */
export type ManufacturingCategory = 
  | 'joinery' 
  | 'finishing' 
  | 'hardware' 
  | 'edge-treatment' 
  | 'assembly';

/**
 * Skill level required for a feature
 */
export type SkillLevel = 'basic' | 'intermediate' | 'advanced' | 'specialist';

/**
 * Process step in manufacturing feature
 */
export interface ProcessStep {
  order: number;
  name: string;
  description: string;
  equipmentId?: string;
  duration: number; // minutes
}

/**
 * Equipment required for a feature
 */
export interface Equipment {
  id: string;
  name: string;
  type: string;
  isRequired: boolean;
  alternativeIds?: string[];
}

/**
 * Material constraints for a feature
 */
export interface MaterialConstraint {
  materialType: string;
  minThickness?: number;
  maxThickness?: number;
  grainRequired?: boolean;
  notes?: string;
}

/**
 * Quality checkpoint during manufacturing
 */
export interface QualityCheckpoint {
  order: number;
  name: string;
  description: string;
  criteria: string[];
  isCritical: boolean;
}

/**
 * Pricing factor for feature costing
 */
export interface PricingFactor {
  name: string;
  type: 'time' | 'material' | 'complexity' | 'equipment';
  multiplier: number;
  notes?: string;
}

/**
 * Manufacturing Feature - full feature definition
 */
export interface ManufacturingFeature {
  id: string;
  name: string;
  category: ManufacturingCategory;
  description: string;
  processSteps: ProcessStep[];
  requiredEquipment: Equipment[];
  materialConstraints: MaterialConstraint[];
  qualityCheckpoints: QualityCheckpoint[];
  pricingFactors: PricingFactor[];
  estimatedTime: { 
    min: number; 
    max: number; 
    unit: 'minutes' | 'hours';
  };
  skillLevel: SkillLevel;
  images: string[];
  relatedFeatures: string[];
  status: 'active' | 'draft' | 'deprecated';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

/**
 * Filters for querying manufacturing features
 */
export interface ManufacturingFeatureFilters {
  category?: ManufacturingCategory;
  skillLevel?: SkillLevel;
  materialType?: string;
  maxTime?: number;
  status?: 'active' | 'draft' | 'deprecated';
  search?: string;
}

/**
 * Feature creation input (from scanner or manual)
 */
export interface FeatureInput {
  name: string;
  description?: string;
  category: import('@/shared/types').FeatureCategory;
  tags: string[];
  requiredAssetIds: string[];
  estimatedMinutes?: number;
  parameters?: Record<string, unknown>;
}

/**
 * Vision analysis result from AI
 */
export interface FeatureAnalysisResult {
  name: string;
  description: string;
  category: import('@/shared/types').FeatureCategory;
  tags: string[];
  suggestedAssets: string[];
  estimatedMinutes: number;
  complexity: 'simple' | 'moderate' | 'complex';
  notes: string;
  confidence: number;
  analyzedAt: string;
  analyzedBy: string;
}

/**
 * Feature with linked asset details
 */
export interface FeatureWithAssetDetails {
  id: string;
  name: string;
  description?: string;
  category: import('@/shared/types').FeatureCategory;
  tags: string[];
  requiredAssetIds: string[];
  isAvailable: boolean;
  availabilityReason: string;
  estimatedMinutes?: number;
  
  // Linked asset details
  linkedAssets: {
    id: string;
    displayName: string;
    status: import('@/shared/types').AssetStatus;
    isOperational: boolean;
  }[];
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
