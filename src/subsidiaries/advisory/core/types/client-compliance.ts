import { Timestamp } from 'firebase/firestore';
import { ClientType } from './client-types';
import { EntityType } from './client-types';

/**
 * KYC STATUS
 */
export type KYCStatus =
  | 'not_started'
  | 'pending'
  | 'in_progress'
  | 'verified'
  | 'expired'
  | 'rejected';

/**
 * AML RISK RATING
 */
export type AMLRiskRating = 'low' | 'medium' | 'high';

/**
 * KYC DOCUMENT TYPE
 */
export type KYCDocumentType =
  // Individual
  | 'passport'
  | 'national_id'
  | 'drivers_license'
  | 'proof_of_address'
  | 'utility_bill'
  | 'bank_statement'
  | 'source_of_wealth'
  | 'tax_return'
  
  // Corporate
  | 'certificate_of_incorporation'
  | 'memorandum_articles'
  | 'board_resolution'
  | 'register_of_directors'
  | 'register_of_shareholders'
  | 'annual_return'
  | 'audited_accounts'
  | 'business_license'
  
  // Other
  | 'power_of_attorney'
  | 'trust_deed'
  | 'other';

/**
 * KYC DOCUMENT
 */
export interface KYCDocument {
  /** Unique identifier */
  id: string;
  
  /** Document type */
  type: KYCDocumentType;
  
  /** Document name */
  name: string;
  
  /** File URL */
  fileUrl: string;
  
  /** Issue date */
  issueDate?: Timestamp;
  
  /** Expiry date */
  expiryDate?: Timestamp;
  
  /** Issuing authority */
  issuingAuthority?: string;
  
  /** Document number */
  documentNumber?: string;
  
  /** Verification status */
  verificationStatus: 'pending' | 'verified' | 'rejected';
  
  /** Verified by (user ID) */
  verifiedBy?: string;
  
  /** Verified at */
  verifiedAt?: Timestamp;
  
  /** Rejection reason */
  rejectionReason?: string;
  
  /** Upload timestamp */
  uploadedAt: Timestamp;
  
  /** Uploaded by (user ID) */
  uploadedBy: string;
}

/**
 * KYC
 * Know Your Customer compliance record
 */
export interface KYC {
  /** Overall KYC status */
  status: KYCStatus;
  
  /** Last verification date */
  verificationDate?: Timestamp;
  
  /** Expiry date (typically 1-3 years) */
  expiryDate?: Timestamp;
  
  /** Documents collected */
  documents: KYCDocument[];
  
  /** Required documents for this client type */
  requiredDocuments: KYCDocumentType[];
  
  /** Missing documents */
  missingDocuments: KYCDocumentType[];
  
  /** Verified by (user ID) */
  verifiedBy?: string;
  
  /** Notes */
  notes?: string;
}

/**
 * PEP DETAILS
 * Politically Exposed Person details
 */
export interface PEPDetails {
  /** Position held */
  position: string;
  
  /** Country */
  country: string;
  
  /** Relationship type */
  relationshipType?: 'self' | 'family' | 'close_associate';
}

/**
 * AML
 * Anti-Money Laundering record
 */
export interface AML {
  /** Risk rating */
  riskRating: AMLRiskRating;
  
  /** Last screening date */
  screeningDate?: Timestamp;
  
  /** Is Politically Exposed Person */
  pep: boolean;
  
  /** PEP details if applicable */
  pepDetails?: PEPDetails;
  
  /** Sanctions check result */
  sanctions: boolean;
  
  /** Sanctions details if hit */
  sanctionsDetails?: string;
  
  /** Adverse media */
  adverseMedia: boolean;
  
  /** Adverse media details */
  adverseMediaDetails?: string;
  
  /** Screening provider */
  screeningProvider?: string;
  
  /** Screening reference */
  screeningReference?: string;
  
  /** Enhanced due diligence required */
  eddRequired: boolean;
  
  /** EDD completed */
  eddCompleted: boolean;
  
  /** EDD notes */
  eddNotes?: string;
  
  /** Next review date */
  nextReviewDate?: Timestamp;
}

/**
 * CLIENT COMPLIANCE
 * Full compliance record for a client
 */
export interface ClientCompliance {
  kyc: KYC;
  aml: AML;
}

/**
 * Get KYC document type display name
 */
export function getKYCDocumentTypeDisplayName(type: KYCDocumentType): string {
  const names: Record<KYCDocumentType, string> = {
    passport: 'Passport',
    national_id: 'National ID',
    drivers_license: "Driver's License",
    proof_of_address: 'Proof of Address',
    utility_bill: 'Utility Bill',
    bank_statement: 'Bank Statement',
    source_of_wealth: 'Source of Wealth Declaration',
    tax_return: 'Tax Return',
    certificate_of_incorporation: 'Certificate of Incorporation',
    memorandum_articles: 'Memorandum & Articles',
    board_resolution: 'Board Resolution',
    register_of_directors: 'Register of Directors',
    register_of_shareholders: 'Register of Shareholders',
    annual_return: 'Annual Return',
    audited_accounts: 'Audited Accounts',
    business_license: 'Business License',
    power_of_attorney: 'Power of Attorney',
    trust_deed: 'Trust Deed',
    other: 'Other',
  };
  return names[type];
}

/**
 * Check if KYC is complete
 */
export function isKYCComplete(kyc: KYC): boolean {
  return kyc.status === 'verified' && 
         kyc.missingDocuments.length === 0 &&
         (!kyc.expiryDate || kyc.expiryDate.toDate() > new Date());
}

/**
 * Check if client can transact
 */
export function canClientTransact(compliance: ClientCompliance): boolean {
  return isKYCComplete(compliance.kyc) && 
         !compliance.aml.sanctions &&
         (!compliance.aml.eddRequired || compliance.aml.eddCompleted);
}

/**
 * Get KYC status display name
 */
export function getKYCStatusDisplayName(status: KYCStatus): string {
  const names: Record<KYCStatus, string> = {
    not_started: 'Not Started',
    pending: 'Pending',
    in_progress: 'In Progress',
    verified: 'Verified',
    expired: 'Expired',
    rejected: 'Rejected',
  };
  return names[status];
}

/**
 * Get KYC status color
 */
export function getKYCStatusColor(status: KYCStatus): string {
  const colors: Record<KYCStatus, string> = {
    not_started: 'gray',
    pending: 'yellow',
    in_progress: 'blue',
    verified: 'green',
    expired: 'orange',
    rejected: 'red',
  };
  return colors[status];
}

/**
 * Get AML risk display name
 */
export function getAMLRiskDisplayName(rating: AMLRiskRating): string {
  const names: Record<AMLRiskRating, string> = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  };
  return names[rating];
}

/**
 * Get AML risk color
 */
export function getAMLRiskColor(rating: AMLRiskRating): string {
  const colors: Record<AMLRiskRating, string> = {
    low: 'green',
    medium: 'yellow',
    high: 'red',
  };
  return colors[rating];
}

/**
 * Get required KYC documents for client type
 */
export function getRequiredKYCDocuments(
  clientType: ClientType,
  entityType: EntityType
): KYCDocumentType[] {
  const base: KYCDocumentType[] = [];
  
  if (entityType === 'individual' || entityType === 'joint') {
    base.push(
      'passport',
      'proof_of_address',
      'source_of_wealth'
    );
  } else {
    base.push(
      'certificate_of_incorporation',
      'memorandum_articles',
      'register_of_directors',
      'register_of_shareholders',
      'board_resolution'
    );
  }
  
  // Add type-specific requirements
  if (clientType === 'hnwi' || clientType === 'uhnwi') {
    base.push('bank_statement', 'tax_return');
  }
  
  if (entityType === 'trust') {
    base.push('trust_deed');
  }
  
  return base;
}

/**
 * Create default KYC record
 */
export function createDefaultKYC(
  clientType: ClientType,
  entityType: EntityType
): KYC {
  const requiredDocuments = getRequiredKYCDocuments(clientType, entityType);
  return {
    status: 'not_started',
    documents: [],
    requiredDocuments,
    missingDocuments: [...requiredDocuments],
  };
}

/**
 * Create default AML record
 */
export function createDefaultAML(): AML {
  return {
    riskRating: 'low',
    pep: false,
    sanctions: false,
    adverseMedia: false,
    eddRequired: false,
    eddCompleted: false,
  };
}
