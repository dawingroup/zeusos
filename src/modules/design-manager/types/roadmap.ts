/**
 * Product Roadmap Types
 * Data model for product pipeline management
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Pipeline stages
 */
export type PipelineStage = 
  | 'idea'
  | 'research'
  | 'design'
  | 'prototype'
  | 'production'
  | 'launched';

/**
 * Product priority levels
 */
export type ProductPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Product status
 */
export type ProductStatus = 'active' | 'on-hold' | 'cancelled' | 'completed';

/**
 * Stage configuration
 */
export const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; bgColor: string }> = {
  idea: { label: 'Idea', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  research: { label: 'Research', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  design: { label: 'Design', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  prototype: { label: 'Prototype', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  production: { label: 'Production', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  launched: { label: 'Launched', color: 'text-green-700', bgColor: 'bg-green-100' },
};

/**
 * Priority configuration
 */
export const PRIORITY_CONFIG: Record<ProductPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500' },
  medium: { label: 'Medium', color: 'text-blue-500' },
  high: { label: 'High', color: 'text-orange-500' },
  critical: { label: 'Critical', color: 'text-red-500' },
};

/**
 * Product in the pipeline
 */
export interface RoadmapProduct {
  id: string;
  name: string;
  description: string;
  stage: PipelineStage;
  priority: ProductPriority;
  status: ProductStatus;
  
  // Relationships
  projectId?: string;
  designItemIds?: string[];
  featureIds?: string[];
  
  // Timeline
  targetLaunchDate?: Timestamp;
  estimatedHours?: number;
  
  // Metrics
  progressPercent: number;
  blockers?: string[];
  
  // Media
  thumbnailUrl?: string;
  
  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  order: number;
}

/**
 * Form data for creating/editing products
 */
export interface ProductFormData {
  name: string;
  description: string;
  stage: PipelineStage;
  priority: ProductPriority;
  status: ProductStatus;
  projectId?: string;
  targetLaunchDate?: Date;
  estimatedHours?: number;
}

/**
 * Pipeline column for Kanban view
 */
export interface PipelineColumn {
  stage: PipelineStage;
  products: RoadmapProduct[];
}

/**
 * Default product values
 */
export const DEFAULT_PRODUCT: Omit<RoadmapProduct, 'id'> = {
  name: '',
  description: '',
  stage: 'idea',
  priority: 'medium',
  status: 'active',
  progressPercent: 0,
  order: 0,
};
