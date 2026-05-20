/**
 * Customer Hub Types
 * TypeScript interfaces for customer management
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Customer status
 */
export type CustomerStatus = 'active' | 'inactive' | 'prospect';

/**
 * Customer type/tier
 */
export type CustomerType = 'residential' | 'commercial' | 'contractor' | 'designer';

/**
 * Address structure
 */
export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Stakeholder engagement roles
 */
export type ContactRole =
  | 'decision_maker'
  | 'project_manager'
  | 'site_contact'
  | 'architect'
  | 'procurement'
  | 'finance'
  | 'technical'
  | 'end_user'
  | 'consultant'
  | 'contractor'
  | 'legal'
  | 'other';

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  decision_maker: 'Decision Maker',
  project_manager: 'Project Manager',
  site_contact: 'Site Contact',
  architect: 'Architect / Designer',
  procurement: 'Procurement',
  finance: 'Finance / Accounts',
  technical: 'Technical Contact',
  end_user: 'End User',
  consultant: 'Consultant',
  contractor: 'Contractor',
  legal: 'Legal / Compliance',
  other: 'Other',
};

/**
 * Contact person within an organization
 */
export interface ContactPerson {
  id: string;
  name: string;
  title?: string;
  department?: string;
  role?: ContactRole;
  email?: string;
  phone?: string;
  mobile?: string;
  notes?: string;
  isPrimary: boolean;
}

/**
 * External system references
 */
export interface ExternalIds {
  quickbooksId?: string;    // QuickBooks customer ID
  shopifyId?: string;       // Shopify customer ID
  driveFolderId?: string;   // Google Drive folder ID
  driveProjectsFolderId?: string;
  driveDocumentsFolderId?: string;
}

/**
 * Sync status tracking
 */
export interface SyncStatus {
  quickbooks?: 'synced' | 'failed' | 'pending';
  quickbooksError?: string;
  quickbooksLastSync?: Timestamp;
  shopify?: 'synced' | 'failed' | 'pending';
  shopifyError?: string;
  shopifyLastSync?: Timestamp;
  drive?: 'synced' | 'failed' | 'pending';
  driveError?: string;
  driveLastSync?: Timestamp;
}

/**
 * Customer document in Firestore
 */
export interface Customer {
  id: string;

  // Basic info
  code: string;              // Unique customer code (e.g., "SMITH-RES-001")
  name: string;              // Display name
  type: CustomerType;
  status: CustomerStatus;

  // Contact info
  email?: string;
  phone?: string;
  website?: string;

  // Address
  billingAddress?: Address;
  shippingAddress?: Address;

  // Contacts
  contacts: ContactPerson[];

  // External integrations
  externalIds: ExternalIds;

  // Sync status
  syncStatus?: SyncStatus;

  // Drive link
  driveFolderLink?: string;

  // Notes
  notes?: string;
  tags: string[];

  // Merge trail (P8 follow-up — dedupe). Set by `partyMergeService`
  // when this record is retired into another. Readers filter on
  // `mergedInto` to hide consolidated rows from default lists while
  // keeping historical FKs resolvable. Never cleared after being set.
  mergedInto?: string;
  mergedAt?: Timestamp;
  mergedBy?: string;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Customer form data (for create/update)
 */
export type CustomerFormData = Omit<Customer, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'syncStatus'>;

/**
 * Customer list item (lightweight for lists)
 */
export interface CustomerListItem {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  status: CustomerStatus;
  email?: string;
  phone?: string;
  contacts?: ContactPerson[];
  projectCount?: number;
  // Populated when the record has been retired via a merge. Lists hide
  // these by default; only the "archived / merged" view surfaces them.
  mergedInto?: string;
}

/**
 * Value returned by CustomerPicker component
 */
export interface CustomerPickerValue {
  customerId: string;
  customerName: string;
}

// P11 (F8) — normalized customer-contact collection. See `customerContact.ts`
// for the rollout plan. Re-exported here so callers using `@/modules/
// customer-hub` pick it up without a deep import.
export * from './customerContact';
