/**
 * Product Types
 * Core product data model for the launch pipeline
 */

import { Timestamp } from 'firebase/firestore';
import { PipelineStage, DeliverableType } from './stage.types';
import { NamingSession, AIGeneratedContent } from './ai.types';
import { AuditResult } from './audit.types';
import { ShopifySyncState } from './shopify.types';

export interface LaunchProduct {
  id: string;
  
  // Basic info
  name: string;
  handle: string;              // URL-friendly slug
  description: string;
  category: ProductCategory;
  
  // Pipeline state
  currentStage: PipelineStage;
  stageHistory: StageTransition[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Deliverables (by stage)
  deliverables: ProductDeliverable[];
  
  // Specifications
  specifications: ProductSpecifications;
  
  // AI-Generated Content
  namingSession?: NamingSession;
  aiContent?: AIGeneratedContent;
  
  // SEO & Discoverability
  seoMetadata?: SEOMetadata;
  aiDiscovery?: AIDiscoveryData;
  schemaOrg?: object;          // JSON-LD schema
  
  // Shopify integration
  shopifySync?: ShopifySyncState;
  
  // Audit tracking
  lastAudit?: AuditResult;
  auditHistory: AuditResult[];
  
  // Metadata
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  notes: string;
  assignedTo?: string;
  targetLaunchDate?: Timestamp;
}

export type ProductCategory = 
  | 'casework'
  | 'furniture'
  | 'millwork'
  | 'doors'
  | 'fixtures'
  | 'specialty';

export interface ProductDeliverable {
  id: string;
  type: DeliverableType;
  stage: PipelineStage;
  name: string;
  url: string;                 // Storage URL or external link
  mimeType?: string;
  size?: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
  metadata?: Record<string, any>;
}

export interface StageTransition {
  from: PipelineStage;
  to: PipelineStage;
  transitionedAt: Timestamp;
  transitionedBy: string;
  notes?: string;
  gateOverride?: boolean;
}

export interface ProductSpecifications {
  dimensions?: { length: number; width: number; height: number; unit: 'mm' | 'cm' | 'in' };
  weight?: { value: number; unit: 'kg' | 'lb' };
  materials: string[];
  finishes: string[];
  colors: string[];
  features: string[];
}

export interface SEOMetadata {
  metaTitle: string;           // Max 60 chars
  metaDescription: string;     // Max 155 chars
  keywords: string[];
  canonicalUrl?: string;
}

export interface AIDiscoveryData {
  whatItIs: string;
  bestFor: string;
  comparedTo: string;
  uniqueFeatures: string[];
  useCases: string[];
  faqs: { question: string; answer: string }[];
  semanticTags: {
    materialType: string[];
    styleCategory: string[];
    roomType: string[];
    colorFamily: string[];
  };
}
