/**
 * STAKEHOLDER TYPE
 */
export type StakeholderType =
  | 'individual'
  | 'organization'
  | 'government_entity'
  | 'ngo'
  | 'company'
  | 'foundation'
  | 'multilateral';

/**
 * STAKEHOLDER REF
 * Reference to a stakeholder (person or organization)
 */
export interface StakeholderRef {
  /** Stakeholder ID */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Type of stakeholder */
  type: StakeholderType;
  
  /** Role in context */
  role?: string;
  
  /** Contact email */
  email?: string;
  
  /** Contact phone */
  phone?: string;
}

/**
 * CONTACT REF
 * Reference to a contact person
 */
export interface ContactRef {
  /** Contact ID */
  id: string;
  
  /** Full name */
  name: string;
  
  /** Job title */
  title?: string;
  
  /** Email address */
  email?: string;
  
  /** Phone number */
  phone?: string;
  
  /** Is primary contact */
  isPrimary: boolean;
}

/**
 * STAKEHOLDER RELATIONSHIP
 * Relationship between engagement and stakeholder
 */
export interface StakeholderRelationship {
  /** Stakeholder reference */
  stakeholder: StakeholderRef;
  
  /** Relationship type */
  relationshipType: StakeholderRelationshipType;
  
  /** Relationship start date */
  startDate?: Date;
  
  /** Relationship end date */
  endDate?: Date;
  
  /** Is currently active */
  isActive: boolean;
  
  /** Notes about relationship */
  notes?: string;
}

/**
 * STAKEHOLDER RELATIONSHIP TYPE
 */
export type StakeholderRelationshipType =
  | 'client'
  | 'funder'
  | 'partner'
  | 'contractor'
  | 'beneficiary'
  | 'regulator'
  | 'community'
  | 'advisor'
  | 'investor';

/**
 * Get stakeholder type display name
 */
export function getStakeholderTypeDisplayName(type: StakeholderType): string {
  const names: Record<StakeholderType, string> = {
    individual: 'Individual',
    organization: 'Organization',
    government_entity: 'Government Entity',
    ngo: 'NGO',
    company: 'Company',
    foundation: 'Foundation',
    multilateral: 'Multilateral Organization',
  };
  return names[type];
}

/**
 * Get relationship type display name
 */
export function getRelationshipTypeDisplayName(type: StakeholderRelationshipType): string {
  const names: Record<StakeholderRelationshipType, string> = {
    client: 'Client',
    funder: 'Funder',
    partner: 'Partner',
    contractor: 'Contractor',
    beneficiary: 'Beneficiary',
    regulator: 'Regulator',
    community: 'Community',
    advisor: 'Advisor',
    investor: 'Investor',
  };
  return names[type];
}
