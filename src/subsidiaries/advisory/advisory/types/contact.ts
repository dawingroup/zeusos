/**
 * Client Contact Types
 */

import { Timestamp } from 'firebase/firestore';

export type ContactRole =
  | 'primary'
  | 'investment_decision_maker'
  | 'operations'
  | 'legal'
  | 'compliance'
  | 'finance'
  | 'reporting'
  | 'authorized_signatory'
  | 'beneficial_owner'
  | 'other';

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface ClientContact {
  id: string;
  
  // Personal Information
  title?: string;                // Mr, Ms, Dr, etc.
  firstName: string;
  lastName: string;
  preferredName?: string;
  
  // Role
  role: ContactRole;
  jobTitle?: string;
  department?: string;
  
  // Contact Details
  email: string;
  phone?: string;
  mobile?: string;
  
  // Address
  address?: ContactAddress;
  
  // Permissions
  isPrimary: boolean;
  isAuthorizedSignatory: boolean;
  signatoryLimit?: MoneyAmount;
  canReceiveReports: boolean;
  canAccessPortal: boolean;
  portalUserId?: string;
  
  // KYC for Individuals
  dateOfBirth?: Timestamp;
  nationality?: string;
  idDocument?: string;
  idDocumentExpiry?: Timestamp;
  pepStatus?: boolean;
  
  // Communication Preferences
  communicationPreferences?: ContactCommunicationPrefs;
  
  // Status
  isActive: boolean;
  
  // Metadata
  notes?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ContactAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface ContactCommunicationPrefs {
  preferredChannel: 'email' | 'phone' | 'mobile';
  language: string;
  timezone: string;
  doNotContact?: boolean;
  marketingOptIn?: boolean;
}
