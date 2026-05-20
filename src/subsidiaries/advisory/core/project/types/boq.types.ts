/**
 * Bill of Quantities (BOQ) Types
 * =================================================================
 * Types for managing construction BOQs, items, and AI parsing.
 * This file is now part of the core project module.
 */

import { Timestamp } from 'firebase/firestore';

// Local Money type for this module
export interface BOQMoney {
  amount: number;
  currency: string;
}

export interface BOQAuditFields {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  version: number;
}

// ============================================================================
// BOQ DOCUMENT
// ============================================================================

export interface BOQDocument {
  id: string;
  
  // Relationships
  projectId: string;
  projectName: string;
  engagementId: string;
  programId?: string;
  
  // Document info
  name: string;
  description?: string;
  version: number;
  status: BOQDocumentStatus;
  
  // Source
  source: BOQSource;
  sourceFileUrl?: string;
  sourceFileName?: string;
  
  // Parsing
  parsingStatus: ParsingStatus;
  parsingResults?: ParsingResults;
  
  // Summary
  summary: BOQSummary;
  
  // Sections
  sections: BOQSection[];
  
  // Approval
  approval?: BOQApproval;
  
  // Audit
  audit: BOQAuditFields;
}

export type BOQDocumentStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'superseded'
  | 'archived';

export type BOQSource =
  | 'manual'
  | 'excel_import'
  | 'ai_parsed'
  | 'template'
  | 'variation';

export type ParsingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'review_required';

export interface ParsingResults {
  startedAt: Timestamp;
  completedAt?: Timestamp;
  model: string;
  confidence: number;
  itemsExtracted: number;
  warnings: string[];
  errors: string[];
}

export interface BOQSummary {
  totalItems: number;
  totalSections: number;
  totalAmount: BOQMoney;
  laborAmount: BOQMoney;
  materialAmount: BOQMoney;
  equipmentAmount: BOQMoney;
  currency: string;
}

export interface BOQApproval {
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  notes?: string;
}

// ============================================================================
// BOQ SECTION
// ============================================================================

export interface BOQSection {
  id: string;
  boqId: string;
  
  // Section info
  code: string;
  name: string;
  description?: string;
  order: number;
  
  // Parent section (for nested structure)
  parentSectionId?: string;
  level: number;
  
  // Items
  items: BOQItem[];
  
  // Section totals
  subtotal: BOQMoney;
}

// ============================================================================
// BOQ ITEM
// ============================================================================

export interface BOQItem {
  id: string;
  boqId: string;
  sectionId: string;
  
  // Item info
  itemNumber: string;
  description: string;
  specification?: string;
  
  // Quantity
  quantity: number;
  unit: string;
  
  // Rates
  laborRate: BOQMoney;
  materialRate: BOQMoney;
  equipmentRate?: BOQMoney;
  unitRate: BOQMoney;
  
  // Amounts
  laborAmount: BOQMoney;
  materialAmount: BOQMoney;
  equipmentAmount?: BOQMoney;
  totalAmount: BOQMoney;
  
  // Category
  category: BOQCategory;
  workType?: string;
  tradeCode?: string;
  
  // AI parsing metadata
  aiExtracted?: boolean;
  aiConfidence?: number;
  aiSuggestions?: string[];
  
  // Material linking
  linkedMaterialId?: string;
  linkedMaterialName?: string;

  // Tracking
  procuredQuantity: number;
  deliveredQuantity: number;
  installedQuantity: number;
  
  // Order
  order: number;
}

export type BOQCategory =
  | 'preliminaries'
  | 'substructure'
  | 'superstructure'
  | 'finishes'
  | 'services'
  | 'external_works'
  | 'provisional'
  | 'contingency'
  | 'professional_fees'
  | 'other';

// ============================================================================
// BOQ VARIATION
// ============================================================================

export interface BOQVariation {
  id: string;
  originalBoqId: string;
  projectId: string;
  
  // Variation info
  variationNumber: string;
  description: string;
  reason: VariationReason;
  
  // Changes
  addedItems: BOQItem[];
  removedItems: string[]; // Item IDs
  modifiedItems: BOQItemModification[];
  
  // Impact
  originalAmount: BOQMoney;
  variationAmount: BOQMoney;
  newTotalAmount: BOQMoney;
  
  // Approval
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedBy?: string;
  submittedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  
  // Audit
  audit: BOQAuditFields;
}

export type VariationReason =
  | 'design_change'
  | 'site_conditions'
  | 'scope_change'
  | 'error_correction'
  | 'value_engineering'
  | 'client_request'
  | 'regulatory_requirement';

export interface BOQItemModification {
  itemId: string;
  field: 'quantity' | 'rate' | 'description' | 'specification';
  originalValue: string | number;
  newValue: string | number;
  reason?: string;
}

// ============================================================================
// BOQ TEMPLATE
// ============================================================================

export interface BOQTemplate {
  id: string;
  
  // Template info
  name: string;
  description?: string;
  projectType: string; // e.g., 'hospital', 'school', 'housing'
  
  // Sections and items
  sections: Omit<BOQSection, 'boqId'>[];
  
  // Default rates
  defaultCurrency: string;
  defaultRates?: {
    category: BOQCategory;
    laborRate: number;
    materialRate: number;
  }[];
  
  // Usage
  usageCount: number;
  lastUsedAt?: Timestamp;
  
  // Audit
  audit: BOQAuditFields;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateBOQInput {
  projectId: string;
  projectName: string;
  engagementId: string;
  name: string;
  programId?: string;
  description?: string;
  templateId?: string;
}

export interface CreateSectionInput {
  code: string;
  name: string;
  description?: string;
  order: number;
  parentSectionId?: string;
  level: number;
}

export interface CreateItemInput {
  itemNumber: string;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  laborRate: BOQMoney;
  materialRate: BOQMoney;
  equipmentRate?: BOQMoney;
  unitRate: BOQMoney;
  laborAmount: BOQMoney;
  materialAmount: BOQMoney;
  equipmentAmount?: BOQMoney;
  totalAmount: BOQMoney;
  category: BOQCategory;
  workType?: string;
  tradeCode?: string;
  order: number;
}
