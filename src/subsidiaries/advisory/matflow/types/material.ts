/**
 * Material Types
 * 
 * Types for construction materials and material library.
 */

import { Timestamp } from 'firebase/firestore';
import type { BOQMoney as Money, BOQAuditFields as AuditFields } from './boq';

// ============================================================================
// MATERIAL
// ============================================================================

export interface Material {
  id: string;
  
  // Basic info
  code: string;
  name: string;
  description?: string;
  category: MaterialCategoryExtended;
  subcategory?: string;
  
  // Specifications
  specifications: MaterialSpecification[];
  
  // Unit
  baseUnit: string;
  alternativeUnits?: UnitConversion[];
  
  // Pricing
  standardRate: Money;
  lastPurchaseRate?: Money;
  averageRate?: Money;
  rateHistory: MaterialRateHistory[];
  
  // Stock
  currentStock?: number;
  reorderLevel?: number;
  leadTimeDays?: number;
  
  // Suppliers
  preferredSuppliers: string[];
  
  // Images
  imageUrls?: string[];
  
  // Status
  isActive: boolean;
  
  // Audit
  audit: AuditFields;
}

export type MaterialCategoryExtended =
  | 'cement_concrete'
  | 'steel_reinforcement'
  | 'masonry'
  | 'timber'
  | 'roofing'
  | 'plumbing'
  | 'electrical'
  | 'finishes'
  | 'doors_windows'
  | 'hardware'
  | 'aggregates'
  | 'chemicals'
  | 'equipment'
  | 'other';

export interface MaterialSpecification {
  name: string;
  value: string;
  unit?: string;
}

export interface UnitConversion {
  unit: string;
  conversionFactor: number; // To convert TO base unit
}

export interface MaterialRateHistory {
  rate: Money;
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  source: 'standard' | 'purchase' | 'quotation' | 'estimate' | 'market';
  supplierId?: string;
  notes?: string;
}

// ============================================================================
// MATERIAL CATALOG
// ============================================================================

export interface MaterialCatalog {
  id: string;
  
  // Catalog info
  name: string;
  description?: string;
  scope: 'global' | 'program' | 'project';
  scopeId?: string; // Program or project ID if scoped
  
  // Materials in catalog
  materialIds: string[];
  materialCount: number;
  
  // Pricing basis
  pricingBasis: 'standard' | 'region' | 'supplier' | 'custom';
  pricingRegion?: string;
  effectiveDate: Timestamp;
  
  // Status
  status: 'draft' | 'active' | 'archived';
  
  // Audit
  audit: AuditFields;
}

// ============================================================================
// PROJECT MATERIAL
// ============================================================================

export interface ProjectMaterial {
  id: string;
  
  // Relationships
  projectId: string;
  materialId: string;
  boqItemIds: string[];
  
  // Material info (denormalized)
  materialCode: string;
  materialName: string;
  category: MaterialCategoryExtended;
  unit: string;
  
  // Quantities
  boqQuantity: number;      // From BOQ
  requisitionedQuantity: number;
  orderedQuantity: number;
  deliveredQuantity: number;
  usedQuantity: number;
  wasteQuantity: number;
  
  // Budget
  budgetRate: Money;
  budgetAmount: Money;
  
  // Actual
  actualRate?: Money;
  actualAmount?: Money;
  
  // Variance
  quantityVariance: number;
  costVariance?: Money;
  
  // Status
  status: ProjectMaterialStatus;
  
  // Audit
  audit: AuditFields;
}

export type ProjectMaterialStatus =
  | 'planned'
  | 'requisitioned'
  | 'partially_ordered'
  | 'fully_ordered'
  | 'partially_delivered'
  | 'fully_delivered'
  | 'in_use'
  | 'completed';

// ============================================================================
// MATERIAL TRANSFER
// ============================================================================

export interface MaterialTransfer {
  id: string;
  
  // From/To
  fromProjectId?: string;
  fromWarehouseId?: string;
  toProjectId?: string;
  toWarehouseId?: string;
  
  // Transfer info
  transferNumber: string;
  transferDate: Timestamp;
  
  // Items
  items: MaterialTransferItem[];
  
  // Status
  status: 'draft' | 'approved' | 'in_transit' | 'received' | 'cancelled';
  
  // Approval
  requestedBy: string;
  requestedAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  receivedBy?: string;
  receivedAt?: Timestamp;
  
  // Notes
  notes?: string;
  
  // Audit
  audit: AuditFields;
}

export interface MaterialTransferItem {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  receivedQuantity?: number;
  notes?: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateMaterialInput {
  code: string;
  name: string;
  description?: string;
  category: MaterialCategoryExtended;
  subcategory?: string;
  specifications?: MaterialSpecification[];
  baseUnit: string;
  standardRate: Money;
  preferredSuppliers?: string[];
}

export interface CreateProjectMaterialInput {
  projectId: string;
  materialId: string;
  boqItemIds: string[];
  boqQuantity: number;
  budgetRate: Money;
}
