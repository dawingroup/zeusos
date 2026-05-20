/**
 * BOQ Types for Delivery Core
 * 
 * Unified BOQ types used across all implementation methods.
 * These types establish the Control BOQ baseline for projects.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// MONEY TYPE
// ─────────────────────────────────────────────────────────────────

export interface BOQMoney {
  amount: number;
  currency: string;
}

// ─────────────────────────────────────────────────────────────────
// BOQ STATUS
// ─────────────────────────────────────────────────────────────────

export type BOQDocumentStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'superseded'
  | 'archived';

export type BOQItemStatus = 
  | 'pending'        // Not yet requisitioned/certified
  | 'partial'        // Partially processed
  | 'in_progress'    // Work in progress
  | 'completed';     // Fully processed

export const BOQ_ITEM_STATUS_CONFIG: Record<BOQItemStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'gray' },
  partial: { label: 'Partial', color: 'blue' },
  in_progress: { label: 'In Progress', color: 'yellow' },
  completed: { label: 'Completed', color: 'green' },
};

// ─────────────────────────────────────────────────────────────────
// BOQ CATEGORY
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

export const BOQ_CATEGORY_LABELS: Record<BOQCategory, string> = {
  preliminaries: 'Preliminaries',
  substructure: 'Substructure',
  superstructure: 'Superstructure',
  finishes: 'Finishes',
  services: 'Services',
  external_works: 'External Works',
  provisional: 'Provisional Sums',
  contingency: 'Contingency',
  professional_fees: 'Professional Fees',
  other: 'Other',
};

// ─────────────────────────────────────────────────────────────────
// CONTROL BOQ ITEM
// ─────────────────────────────────────────────────────────────────

export interface ControlBOQItem {
  id: string;
  projectId: string;
  
  // Item identification
  itemCode: string;
  itemNumber: string;
  description: string;
  specification?: string;
  
  // Hierarchy (from BOQ parsing)
  billNumber: string;
  billName?: string;
  elementCode?: string;
  elementName?: string;
  sectionCode?: string;
  sectionName?: string;
  hierarchyPath?: string;
  hierarchyLevel?: number;
  
  // Quantities
  unit: string;
  quantityContract: number;      // Original contract quantity
  quantityRequisitioned: number; // Direct impl: amount in requisitions
  quantityCertified: number;     // Contractor: amount in IPCs
  quantityExecuted: number;      // Amount of work completed
  quantityRemaining: number;     // Contract - Executed
  
  // Rates & Amounts
  rate: number;
  laborRate?: number;
  materialRate?: number;
  equipmentRate?: number;
  amount: number;
  currency: string;
  
  // Category & Stage
  category?: BOQCategory;
  stage?: string;
  
  // Status
  status: BOQItemStatus;
  
  // Tracking (implementation-agnostic)
  linkedPaymentIds: string[];    // Requisitions or IPCs
  lastPaymentDate?: Date;

  /**
   * Cross-module link to a finishes DesignItem (P9/F9).
   *
   * Set when an operator reconciles this ControlBOQ line against the
   * design-manager item that represents the same scope of work. The
   * link is bidirectional — the referenced DesignItem carries this
   * ControlBOQItem's id in its `linkedBoqItemIds[]`.
   *
   * Single-valued: each BOQ line is expected to represent one scope
   * chunk; the reverse direction is one-to-many because a DesignItem
   * may map to multiple BOQ rows.
   *
   * Manual link — no automatic sync with DesignItem pricing. It's an
   * annotation for reconciliation views only. See
   * `boqDesignItemLinkService` for the atomic link/unlink primitives.
   */
  linkedDesignItemId?: string;

  /**
   * Parent design project of the linked DesignItem (P9c).
   *
   * Denormalised from the link site because the DesignItem lives at
   * `designProjects/{projectId}/designItems/{itemId}` — without the
   * projectId we can't resolve that path for unlink or cross-module
   * reads. Written in the same atomic batch as `linkedDesignItemId`
   * by `linkBoqToDesignItem`; cleared by `unlinkBoqFromDesignItem`.
   *
   * Invariant: `linkedDesignProjectId` is set iff `linkedDesignItemId`
   * is set. A row with one and not the other is a data bug — the
   * link service writes both atomically.
   */
  linkedDesignProjectId?: string;
  
  // AI/Parsing metadata
  aiConfidence?: number;
  suggestedFormulaCode?: string;
  governingSpecs?: GoverningSpecs;
  
  // Source info
  source: 'import' | 'manual' | 'ai_parsed';
  importedAt?: Timestamp;
  importedBy?: string;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy?: string;
}

// ─────────────────────────────────────────────────────────────────
// GOVERNING SPECS (from Level 3 hierarchy)
// ─────────────────────────────────────────────────────────────────

export interface GoverningSpecs {
  materialGrade?: string;
  brand?: string;
  standardRef?: string;
  finish?: string;
  color?: string;
  size?: string;
  materialType?: string;
  installationMethod?: string;
  generalSpecs?: string;
  sourceItemCode?: string;
}

// ─────────────────────────────────────────────────────────────────
// CONTROL BOQ DOCUMENT
// ─────────────────────────────────────────────────────────────────

export interface ControlBOQ {
  id: string;
  projectId: string;
  
  // Document info
  name: string;
  description?: string;
  version: number;
  status: BOQDocumentStatus;
  
  // Source
  sourceFileName?: string;
  sourceFileUrl?: string;
  parsingJobId?: string;
  
  // Summary
  totalItems: number;
  totalContractValue: number;
  currency: string;
  
  // By category summary
  byCategory: Record<BOQCategory, {
    count: number;
    contractValue: number;
  }>;
  
  // Approval
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export function getAvailableQuantity(item: ControlBOQItem): number {
  const processed = Math.max(item.quantityRequisitioned, item.quantityCertified);
  return Math.max(0, item.quantityContract - processed);
}

export function getProcessedQuantity(item: ControlBOQItem): number {
  return Math.max(item.quantityRequisitioned, item.quantityCertified);
}

export function getProgressPercentage(item: ControlBOQItem): number {
  if (item.quantityContract <= 0) return 0;
  return (item.quantityExecuted / item.quantityContract) * 100;
}

export function determineItemStatus(item: ControlBOQItem): BOQItemStatus {
  if (item.quantityExecuted >= item.quantityContract) return 'completed';
  if (item.quantityExecuted > 0) return 'in_progress';
  const processed = getProcessedQuantity(item);
  if (processed > 0) return 'partial';
  return 'pending';
}

export function groupByBill(items: ControlBOQItem[]): Record<string, ControlBOQItem[]> {
  return items.reduce((groups, item) => {
    const key = item.billName || item.billNumber || 'Uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, ControlBOQItem[]>);
}

export function groupBySection(items: ControlBOQItem[]): Record<string, ControlBOQItem[]> {
  return items.reduce((groups, item) => {
    const key = item.sectionName || item.sectionCode || 'Uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, ControlBOQItem[]>);
}

export function groupByCategory(items: ControlBOQItem[]): Record<BOQCategory, ControlBOQItem[]> {
  const groups: Record<BOQCategory, ControlBOQItem[]> = {
    preliminaries: [],
    substructure: [],
    superstructure: [],
    finishes: [],
    services: [],
    external_works: [],
    provisional: [],
    contingency: [],
    professional_fees: [],
    other: [],
  };
  
  for (const item of items) {
    const category = item.category || 'other';
    groups[category].push(item);
  }
  
  return groups;
}

export function calculateBOQSummary(items: ControlBOQItem[]): {
  totalItems: number;
  totalContractValue: number;
  processedValue: number;
  executedValue: number;
  remainingValue: number;
  byStatus: Record<BOQItemStatus, number>;
} {
  const summary = {
    totalItems: items.length,
    totalContractValue: 0,
    processedValue: 0,
    executedValue: 0,
    remainingValue: 0,
    byStatus: { pending: 0, partial: 0, in_progress: 0, completed: 0 },
  };
  
  for (const item of items) {
    summary.totalContractValue += item.amount;
    summary.processedValue += getProcessedQuantity(item) * item.rate;
    summary.executedValue += item.quantityExecuted * item.rate;
    summary.remainingValue += getAvailableQuantity(item) * item.rate;
    summary.byStatus[item.status]++;
  }
  
  return summary;
}
