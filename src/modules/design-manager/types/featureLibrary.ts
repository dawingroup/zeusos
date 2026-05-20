/**
 * Feature Library Types
 * Data model for Dawin's manufacturing capabilities catalog
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Feature categories matching manufacturing capabilities
 */
export type FeatureCategory = 
  | 'joinery'
  | 'finishing'
  | 'hardware'
  | 'upholstery'
  | 'metalwork'
  | 'carving'
  | 'veneer'
  | 'laminate'
  | 'glass'
  | 'stone';

/**
 * Category prefixes for feature codes
 */
export const CATEGORY_PREFIXES: Record<FeatureCategory, string> = {
  joinery: 'JNR',
  finishing: 'FIN',
  hardware: 'HDW',
  upholstery: 'UPH',
  metalwork: 'MTL',
  carving: 'CRV',
  veneer: 'VNR',
  laminate: 'LAM',
  glass: 'GLS',
  stone: 'STN',
};

/**
 * AWI Quality grades
 */
export type QualityGrade = 'economy' | 'custom' | 'premium';

/**
 * Feature status
 */
export type FeatureStatus = 'active' | 'in-development' | 'deprecated';

/**
 * Skill level required for feature
 */
export type SkillLevel = 'apprentice' | 'journeyman' | 'master';

/**
 * Labor intensity levels
 */
export type LaborIntensity = 'low' | 'medium' | 'high' | 'very-high';

/**
 * Process step in feature manufacturing
 */
export interface ProcessStep {
  order: number;
  name: string;
  description: string;
  duration: number; // minutes
  equipment?: string[];
  notes?: string;
}

/**
 * Cost factors for estimating
 */
export interface CostFactors {
  laborIntensity: LaborIntensity;
  wastePercent: number;
  toolingRequired: boolean;
  skillLevel: SkillLevel;
  setupTime: number; // minutes
}

/**
 * Time estimates for feature
 */
export interface TimeEstimate {
  minimum: number; // hours
  typical: number; // hours
  maximum: number; // hours
  unit: 'hours' | 'days';
}

/**
 * Feature image
 */
export interface FeatureImage {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  uploadedAt?: Timestamp;
}

/**
 * Main Feature Library item
 */
export interface FeatureLibraryItem {
  id: string;
  code: string; // e.g., "JNR-001"
  name: string;
  description: string;
  
  // Taxonomy
  category: FeatureCategory;
  subcategory?: string;
  tags: string[];
  
  // Process documentation
  processSteps: ProcessStep[];
  estimatedTime: TimeEstimate;
  
  // Cost and requirements
  costFactors: CostFactors;
  requiredEquipment: string[];
  requiredMaterials?: string[];
  
  // Quality
  qualityGrade: QualityGrade;
  inspectionPoints?: string[];
  
  // Media
  images: FeatureImage[];
  videoUrls?: string[];
  drawingUrls?: string[];
  
  // Status and tracking
  status: FeatureStatus;
  usageCount: number;
  
  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

/**
 * Form data for creating/editing features
 */
export interface FeatureFormData {
  name: string;
  description: string;
  category: FeatureCategory;
  subcategory?: string;
  tags: string[];
  processSteps: ProcessStep[];
  estimatedTime: TimeEstimate;
  costFactors: CostFactors;
  requiredEquipment: string[];
  requiredMaterials?: string[];
  qualityGrade: QualityGrade;
  inspectionPoints?: string[];
  status: FeatureStatus;
}

/**
 * Search/filter options
 */
export interface FeatureSearchOptions {
  query?: string;
  category?: FeatureCategory;
  qualityGrade?: QualityGrade;
  status?: FeatureStatus;
  sortBy?: 'name' | 'category' | 'usageCount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Asset Registry item (equipment/machines)
 */
export interface AssetRegistryItem {
  id: string;
  name: string;
  assetCode: string;
  type: 'machine' | 'tool' | 'jig' | 'fixture';
  capabilities: string[];
  limitations: string[];
  status: 'operational' | 'maintenance' | 'retired';
  location: string;
  enabledFeatures: string[]; // Feature IDs this asset enables
  maintenanceSchedule?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Default values for new features
 */
export const DEFAULT_FEATURE: Omit<FeatureLibraryItem, 'id' | 'code'> = {
  name: '',
  description: '',
  category: 'joinery',
  subcategory: '',
  tags: [],
  processSteps: [],
  estimatedTime: { minimum: 1, typical: 2, maximum: 4, unit: 'hours' },
  costFactors: {
    laborIntensity: 'medium',
    wastePercent: 10,
    toolingRequired: false,
    skillLevel: 'journeyman',
    setupTime: 15,
  },
  requiredEquipment: [],
  requiredMaterials: [],
  qualityGrade: 'custom',
  inspectionPoints: [],
  images: [],
  videoUrls: [],
  drawingUrls: [],
  status: 'active',
  usageCount: 0,
};

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  joinery: 'Joinery',
  finishing: 'Finishing',
  hardware: 'Hardware',
  upholstery: 'Upholstery',
  metalwork: 'Metalwork',
  carving: 'Carving',
  veneer: 'Veneer',
  laminate: 'Laminate',
  glass: 'Glass',
  stone: 'Stone',
};

/**
 * Quality grade labels
 */
export const QUALITY_GRADE_LABELS: Record<QualityGrade, string> = {
  economy: 'Economy',
  custom: 'Custom',
  premium: 'Premium',
};

/**
 * Status labels
 */
export const STATUS_LABELS: Record<FeatureStatus, string> = {
  active: 'Active',
  'in-development': 'In Development',
  deprecated: 'Deprecated',
};
