/**
 * Client Compliance Types - KYC/AML tracking
 */

import { Timestamp } from 'firebase/firestore';
import { KYCDocumentType } from './client-type';

export type ComplianceStatus = 
  | 'compliant' 
  | 'pending' 
  | 'review_required' 
  | 'non_compliant';

export interface ClientCompliance {
  status: ComplianceStatus;
  kyc: KYCStatus;
  aml: AMLStatus;
  taxCompliance: TaxComplianceStatus;
  accreditationStatus?: AccreditationStatus;
  lastReviewDate?: Timestamp;
  nextReviewDate?: Timestamp;
  complianceOfficer?: string;
  issues?: ComplianceIssue[];
}

export interface KYCStatus {
  status: 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'expired' | 'rejected';
  level: 'standard' | 'enhanced' | 'simplified';
  completedAt?: Timestamp;
  expiresAt?: Timestamp;
  documents: KYCDocument[];
  verificationMethod?: string;
}

export interface KYCDocument {
  type: KYCDocumentType;
  status: 'pending' | 'received' | 'verified' | 'rejected';
  documentId?: string;
  verifiedAt?: Timestamp;
  verifiedBy?: string;
  notes?: string;
}

export interface AMLStatus {
  status: 'not_started' | 'in_progress' | 'cleared' | 'flagged' | 'blocked';
  riskRating: 'low' | 'medium' | 'high';
  lastScreeningDate?: Timestamp;
  nextScreeningDate?: Timestamp;
  pepStatus?: PEPStatus;
  sanctionsCheck?: SanctionsCheck;
  adverseMedia?: AdverseMediaCheck;
}

export interface PEPStatus {
  isPEP: boolean;
  pepType?: 'direct' | 'family' | 'associate';
  details?: string;
  enhancedDueDiligence?: boolean;
}

export interface SanctionsCheck {
  status: 'clear' | 'match' | 'potential_match';
  lastChecked: Timestamp;
  lists: string[];
  notes?: string;
}

export interface AdverseMediaCheck {
  status: 'clear' | 'findings' | 'monitoring';
  lastChecked: Timestamp;
  findings?: string[];
}

export interface TaxComplianceStatus {
  taxResidency: string[];
  fatcaStatus?: 'compliant' | 'non_compliant' | 'exempt' | 'pending';
  crsStatus?: 'compliant' | 'non_compliant' | 'exempt' | 'pending';
  w8BenOnFile?: boolean;
  w9OnFile?: boolean;
  taxCertificateExpiry?: Timestamp;
}

export interface AccreditationStatus {
  isAccredited: boolean;
  accreditationType?: 'institutional' | 'professional' | 'elective_professional' | 'qualified_purchaser';
  accreditationDate?: Timestamp;
  accreditationExpiry?: Timestamp;
  verificationDocument?: string;
}

export interface ComplianceIssue {
  id: string;
  type: 'kyc' | 'aml' | 'tax' | 'regulatory' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  raisedAt: Timestamp;
  raisedBy: string;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  resolution?: string;
  resolvedAt?: Timestamp;
}

export interface KYCRecord {
  clientId: string;
  documents: KYCDocument[];
  verificationHistory: VerificationEvent[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VerificationEvent {
  type: 'document_submitted' | 'document_verified' | 'document_rejected' | 'review_completed';
  documentType?: KYCDocumentType;
  performedBy: string;
  performedAt: Timestamp;
  notes?: string;
}

export interface AMLCheck {
  clientId: string;
  checkType: 'initial' | 'periodic' | 'triggered';
  performedAt: Timestamp;
  performedBy: string;
  result: AMLStatus;
  details: AMLCheckDetails;
}

export interface AMLCheckDetails {
  screeningProvider?: string;
  matchesFound: number;
  matchesCleared: number;
  escalated: boolean;
  notes?: string;
}
