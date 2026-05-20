/**
 * MatFlow Customer Types
 * Extensions to the shared customer model for construction projects
 */

import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore';

// ============================================================================
// CUSTOMER ENGAGEMENT TYPES
// ============================================================================

export interface SubsidiaryEngagement {
  subsidiaryId: string;
  subsidiaryName: string;
  engagementType: 'advisory' | 'finishes' | 'both';
  firstProjectDate?: FirestoreTimestamp;
  lastProjectDate?: FirestoreTimestamp;
  totalProjects: number;
  totalValue: number;
  currency: 'UGX' | 'USD';
  status: 'active' | 'inactive' | 'prospect';
}

export interface ContactPerson {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isPrimary: boolean;
  department?: string;
}

export interface CustomerAddress {
  street?: string;
  district: string;
  city: string;
  country: string;
  postalCode?: string;
}

// ============================================================================
// SHARED CUSTOMER INTERFACE
// ============================================================================

export type CustomerType = 
  | 'individual' 
  | 'company' 
  | 'government' 
  | 'ngo' 
  | 'educational';

export type CustomerStatus = 
  | 'active' 
  | 'inactive' 
  | 'blacklisted' 
  | 'prospect';

export interface SharedCustomer {
  id: string;
  
  // Basic info
  code: string;
  name: string;
  tradingName?: string;
  type: CustomerType;
  status: CustomerStatus;
  
  // Contact
  email?: string;
  phone?: string;
  website?: string;
  contacts: ContactPerson[];
  
  // Address
  billingAddress?: CustomerAddress;
  physicalAddress?: CustomerAddress;
  
  // Tax/Legal
  tin?: string;  // Tax Identification Number (Uganda)
  registrationNumber?: string;
  
  // Subsidiary engagements
  subsidiaryEngagements: SubsidiaryEngagement[];
  
  // External integrations
  externalIds?: {
    notionPageId?: string;
    quickbooksId?: string;
  };
  
  // Metadata
  createdAt: FirestoreTimestamp;
  createdBy: string;
  updatedAt: FirestoreTimestamp;
  updatedBy: string;
  
  // Tags and notes
  tags?: string[];
  notes?: string;
}

// ============================================================================
// MATFLOW CUSTOMER VIEW
// ============================================================================

export interface MatFlowCustomerSummary {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  status: CustomerStatus;
  primaryContact?: ContactPerson;
  phone?: string;
  email?: string;
  district?: string;
  
  // Advisory-specific stats
  advisoryStats?: {
    totalProjects: number;
    activeProjects: number;
    totalValue: number;
    lastProjectDate?: FirestoreTimestamp;
  };
}
