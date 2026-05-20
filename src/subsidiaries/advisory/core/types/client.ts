import { Timestamp } from 'firebase/firestore';
import { Money } from './money';
import { Address } from './address';
import { ContactRef } from './contact';
import { ClientType, EntityType } from './client-types';
import { InvestorProfile, OrganizationProfile } from './client-profile';
import { KYC, AML, KYCStatus } from './client-compliance';

/**
 * CLIENT RELATIONSHIP STATUS
 */
export type ClientRelationshipStatus =
  | 'prospect'          // Potential client
  | 'onboarding'        // In onboarding process
  | 'active'            // Active client
  | 'inactive'          // No active engagements
  | 'dormant'           // Long-term inactive
  | 'offboarded';       // Relationship ended

/**
 * CLIENT PREFERENCES
 */
export interface ClientPreferences {
  /** Preferred communication method */
  communicationMethod: 'email' | 'phone' | 'whatsapp' | 'in_person' | 'portal';
  
  /** Preferred reporting frequency */
  reportingFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  
  /** Preferred currency for reporting */
  currency: string;
  
  /** Preferred language */
  language: string;
  
  /** Time zone */
  timezone?: string;
  
  /** Portal access enabled */
  portalAccess: boolean;
  
  /** Marketing communications opt-in */
  marketingOptIn: boolean;
}

/**
 * CLIENT REGISTRATION
 */
export interface ClientRegistration {
  /** Registration number */
  number: string;
  
  /** Jurisdiction */
  jurisdiction: string;
  
  /** Registration date */
  date: Timestamp;
  
  /** Registering authority */
  authority: string;
}

/**
 * CLIENT
 * Unified client entity across all advisory domains
 */
export interface Client {
  /** Unique identifier */
  id: string;
  
  // ─────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────
  
  /** Client classification */
  type: ClientType;
  
  /** Legal entity type */
  entityType: EntityType;
  
  /** Legal name */
  legalName: string;
  
  /** Trading/display name */
  displayName: string;
  
  /** Short code for reference */
  code?: string;
  
  /** Tax identification number */
  taxId?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // REGISTRATION (for organizations)
  // ─────────────────────────────────────────────────────────────────
  
  /** Registration details */
  registration?: ClientRegistration;
  
  // ─────────────────────────────────────────────────────────────────
  // CONTACT INFO
  // ─────────────────────────────────────────────────────────────────
  
  /** Primary contact person ID */
  primaryContactId?: string;
  
  /** Primary contact (denormalized) */
  primaryContact?: ContactRef;
  
  /** Main email */
  email?: string;
  
  /** Main phone */
  phone?: string;
  
  /** Website */
  website?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // ADDRESSES
  // ─────────────────────────────────────────────────────────────────
  
  /** Client addresses */
  addresses: Address[];
  
  // ─────────────────────────────────────────────────────────────────
  // PROFILE (Type-specific)
  // ─────────────────────────────────────────────────────────────────
  
  /** For investment advisory clients */
  investorProfile?: InvestorProfile;
  
  /** For institutional/program clients */
  organizationProfile?: OrganizationProfile;
  
  // ─────────────────────────────────────────────────────────────────
  // COMPLIANCE
  // ─────────────────────────────────────────────────────────────────
  
  /** KYC status and documents */
  kyc: KYC;
  
  /** AML screening and risk */
  aml: AML;
  
  // ─────────────────────────────────────────────────────────────────
  // RELATIONSHIP
  // ─────────────────────────────────────────────────────────────────
  
  /** Relationship manager (Dawin user ID) */
  relationshipManagerId?: string;
  
  /** Client since date */
  relationshipSince: Timestamp;
  
  /** Engagement IDs */
  engagementIds: string[];
  
  /** Total value managed/under advisory */
  totalValueManaged?: Money;
  
  /** Relationship status */
  relationshipStatus: ClientRelationshipStatus;
  
  // ─────────────────────────────────────────────────────────────────
  // PREFERENCES
  // ─────────────────────────────────────────────────────────────────
  
  /** Client preferences */
  preferences: ClientPreferences;
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  /** Tags for categorization */
  tags: string[];
  
  /** Internal notes */
  notes?: string;
  
  /** Created by user ID */
  createdBy: string;
  
  /** Creation timestamp */
  createdAt: Timestamp;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
}

/**
 * CREATE CLIENT DATA
 */
export interface CreateClientData {
  type: ClientType;
  entityType: EntityType;
  legalName: string;
  displayName?: string;
  email?: string;
  phone?: string;
  country: string;
  relationshipManagerId?: string;
}

/**
 * UPDATE CLIENT DATA
 */
export type UpdateClientData = Partial<
  Pick<
    Client,
    | 'displayName'
    | 'email'
    | 'phone'
    | 'website'
    | 'addresses'
    | 'preferences'
    | 'tags'
    | 'notes'
    | 'investorProfile'
    | 'organizationProfile'
    | 'relationshipManagerId'
    | 'relationshipStatus'
    | 'registration'
    | 'taxId'
  >
>;

/**
 * CLIENT SUMMARY
 * Lightweight client representation for lists
 */
export interface ClientSummary {
  id: string;
  type: ClientType;
  entityType: EntityType;
  displayName: string;
  legalName: string;
  country: string;
  relationshipStatus: ClientRelationshipStatus;
  kycStatus: KYCStatus;
  engagementCount: number;
  relationshipManagerId?: string;
}

/**
 * CLIENT FILTER
 * Filter criteria for querying clients
 */
export interface ClientFilter {
  /** Filter by client type */
  type?: ClientType | ClientType[];
  
  /** Filter by entity type */
  entityType?: EntityType;
  
  /** Filter by relationship status */
  relationshipStatus?: ClientRelationshipStatus | ClientRelationshipStatus[];
  
  /** Filter by KYC status */
  kycStatus?: KYCStatus | KYCStatus[];
  
  /** Filter by country */
  country?: string;
  
  /** Filter by relationship manager */
  relationshipManagerId?: string;
  
  /** Filter by tag */
  tag?: string;
  
  /** Search by name */
  search?: string;
  
  /** Only active clients */
  activeOnly?: boolean;
}

/**
 * Get client's primary address
 */
export function getPrimaryAddress(client: Client): Address | undefined {
  return client.addresses.find(a => a.isPrimary) || client.addresses[0];
}

/**
 * Get client's country from primary address
 */
export function getClientCountry(client: Client): string | undefined {
  const address = getPrimaryAddress(client);
  return address?.country;
}

/**
 * Check if client is ready for business
 */
export function isClientReady(client: Client): boolean {
  return (
    client.relationshipStatus === 'active' &&
    client.kyc.status === 'verified' &&
    !client.aml.sanctions
  );
}

/**
 * Check if client has compliance issues
 */
export function hasComplianceIssues(client: Client): boolean {
  return (
    client.kyc.status === 'expired' ||
    client.kyc.status === 'rejected' ||
    client.aml.sanctions ||
    (client.aml.eddRequired && !client.aml.eddCompleted)
  );
}

/**
 * Get relationship status display name
 */
export function getRelationshipStatusDisplayName(status: ClientRelationshipStatus): string {
  const names: Record<ClientRelationshipStatus, string> = {
    prospect: 'Prospect',
    onboarding: 'Onboarding',
    active: 'Active',
    inactive: 'Inactive',
    dormant: 'Dormant',
    offboarded: 'Offboarded',
  };
  return names[status];
}

/**
 * Get relationship status color
 */
export function getRelationshipStatusColor(status: ClientRelationshipStatus): string {
  const colors: Record<ClientRelationshipStatus, string> = {
    prospect: 'gray',
    onboarding: 'blue',
    active: 'green',
    inactive: 'yellow',
    dormant: 'orange',
    offboarded: 'red',
  };
  return colors[status];
}

/**
 * Convert client to summary
 */
export function toClientSummary(client: Client): ClientSummary {
  return {
    id: client.id,
    type: client.type,
    entityType: client.entityType,
    displayName: client.displayName,
    legalName: client.legalName,
    country: getClientCountry(client) || '',
    relationshipStatus: client.relationshipStatus,
    kycStatus: client.kyc.status,
    engagementCount: client.engagementIds.length,
    relationshipManagerId: client.relationshipManagerId,
  };
}

/**
 * Create default client preferences
 */
export function createDefaultPreferences(): ClientPreferences {
  return {
    communicationMethod: 'email',
    reportingFrequency: 'quarterly',
    currency: 'USD',
    language: 'en',
    portalAccess: false,
    marketingOptIn: false,
  };
}

/**
 * Generate client code
 */
export function generateClientCode(
  type: ClientType,
  country: string,
  sequence: number
): string {
  const typePrefix = type.substring(0, 3).toUpperCase();
  const countryCode = country.toUpperCase();
  const seq = sequence.toString().padStart(4, '0');
  return `${typePrefix}-${countryCode}-${seq}`;
}
