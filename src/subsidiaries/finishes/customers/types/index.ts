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
 * Contact person within an organization
 */
export interface ContactPerson {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
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
  projectCount?: number;
}
