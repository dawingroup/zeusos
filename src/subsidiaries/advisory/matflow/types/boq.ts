/**
 * BOQ (Bill of Quantities) Document Types
 * Extended types for full BOQ document management
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// Supporting Types
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// BOQ Document
// ─────────────────────────────────────────────────────────────────

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

export interface BOQDocument {
  id: string;
  projectId: string;
  projectName: string;
  engagementId: string;
  programId?: string;
  name: string;
  description?: string;
  version: number;
  status: BOQDocumentStatus;
  source: BOQSource;
  sourceFileUrl?: string;
  sourceFileName?: string;
  parsingStatus: ParsingStatus;
  parsingResults?: ParsingResults;
  summary: BOQSummary;
  sections: BOQSection[];
  approval?: BOQApproval;
  audit: BOQAuditFields;
}

// ─────────────────────────────────────────────────────────────────
// Summary & Approval
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Sections & Categories
// ─────────────────────────────────────────────────────────────────

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

export interface BOQSection {
  id: string;
  boqId: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  parentSectionId?: string;
  level: number;
  subtotal: BOQMoney;
  /** Line items belonging to this section (denormalised for in-memory rollups) */
  items: BOQItem[];
}

/**
 * A single line item within a BOQ section.
 * Cost is split into labor / material / equipment buckets, both as unit
 * rates and absolute amounts (rate × quantity rolled up at write time).
 */
export interface BOQItem {
  id: string;
  boqId: string;
  sectionId: string;
  itemNumber: string;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;

  // Unit rates (per `unit`)
  laborRate?: BOQMoney;
  materialRate?: BOQMoney;
  equipmentRate?: BOQMoney;
  unitRate: BOQMoney;

  // Absolute amounts (rate × quantity)
  laborAmount?: BOQMoney;
  materialAmount?: BOQMoney;
  equipmentAmount?: BOQMoney;
  totalAmount: BOQMoney;

  category: BOQCategory;
  workType?: string;
  tradeCode?: string;
  order: number;

  // Procurement / fulfillment tracking
  procuredQuantity: number;
  deliveredQuantity: number;
  installedQuantity: number;
}

// ─────────────────────────────────────────────────────────────────
// Variations
// ─────────────────────────────────────────────────────────────────

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

export interface BOQVariation {
  id: string;
  originalBoqId: string;
  projectId: string;
  variationNumber: string;
  description: string;
  reason: VariationReason;
  addedItemIds: string[];
  removedItemIds: string[];
  modifiedItems: BOQItemModification[];
  originalAmount: BOQMoney;
  variationAmount: BOQMoney;
  newTotalAmount: BOQMoney;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedBy?: string;
  submittedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  audit: BOQAuditFields;
}

// ─────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────

export interface BOQTemplate {
  id: string;
  name: string;
  description?: string;
  projectType: string;
  sections: Omit<BOQSection, 'boqId'>[];
  defaultCurrency: string;
  defaultRates?: {
    category: BOQCategory;
    laborRate: number;
    materialRate: number;
  }[];
  usageCount: number;
  lastUsedAt?: Timestamp;
  audit: BOQAuditFields;
}

// ─────────────────────────────────────────────────────────────────
// Input Types
// ─────────────────────────────────────────────────────────────────

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
  unitRate: BOQMoney;
  category: BOQCategory;
  workType?: string;
  tradeCode?: string;
  order: number;

  // Optional cost-bucket breakdowns (mirror of BOQItem fields)
  laborRate?: BOQMoney;
  materialRate?: BOQMoney;
  equipmentRate?: BOQMoney;
  laborAmount?: BOQMoney;
  materialAmount?: BOQMoney;
  equipmentAmount?: BOQMoney;
  totalAmount?: BOQMoney;
}
