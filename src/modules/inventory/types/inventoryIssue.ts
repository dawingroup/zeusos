/**
 * Inventory Issue Types
 * "Issue from Stores" — tracks consumable/sparepart issuance that triggers expense recognition.
 */

import { Timestamp } from 'firebase/firestore';

export type IssueStatus = 'draft' | 'issued' | 'reversed';

export type IssueReason =
  | 'production'
  | 'maintenance'
  | 'cleaning'
  | 'office'
  | 'project'
  | 'other';

export const ISSUE_REASON_LABELS: Record<IssueReason, string> = {
  production: 'Production',
  maintenance: 'Maintenance & Repair',
  cleaning: 'Cleaning Supplies',
  office: 'Office / Admin',
  project: 'Project Use',
  other: 'Other',
};

export interface IssueLineItem {
  inventoryItemId: string;
  inventoryItemName: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface InventoryIssue {
  id: string;
  issueNumber: string;
  organizationId: string;
  subsidiaryId: string | null;
  status: IssueStatus;
  reason: IssueReason;
  notes: string;
  issuedTo: string;
  projectId: string | null;
  manufacturingOrderId: string | null;
  lineItems: IssueLineItem[];
  totalValue: number;
  lineCount: number;
  /** QBO journal entry ID once synced. */
  qboJournalEntryId: string | null;
  qboSyncStatus: 'pending' | 'synced' | 'error' | 'skipped';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface IssueFormData {
  reason: IssueReason;
  notes: string;
  issuedTo: string;
  projectId: string | null;
  manufacturingOrderId: string | null;
  lineItems: IssueLineItem[];
}
