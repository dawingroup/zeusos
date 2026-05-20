/**
 * FUNDS RECEIVED ACKNOWLEDGEMENT TYPES
 *
 * Types for generating Funds Received Acknowledgement Forms
 * with facility branding, dual logos, and signature blocks.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// FACILITY BRANDING
// ─────────────────────────────────────────────────────────────────

/**
 * Facility/Client branding configuration
 * Can be embedded in Project or stored in facility_configurations collection
 */
export interface FacilityBranding {
  // Identity
  facilityName: string; // e.g., "ST. THERESE OF LISIEUX RWIBAALE HEALTH CENTRE IV"
  facilityCode?: string; // Short code like "RHC"

  // Contact Information
  address: string; // e.g., "P.O. Box 1045, Kyenjojo, Uganda"
  telephone?: string; // e.g., "(+256)782765188 (+256) 772737281"
  email?: string; // e.g., "rwibaalehealthcenter@gmail.com"
  tagline?: string; // e.g., "Holistic Care for Mothers and their families"

  // Logos (Firebase Storage URLs)
  clientLogoUrl?: string; // Facility/client logo (left side)
  clientLogoStoragePath?: string; // Storage path for deletion
  donorLogoUrl?: string; // Donor logo (right side)
  donorLogoStoragePath?: string; // Storage path for deletion

  // Logo dimensions for PDF rendering (in mm)
  clientLogoWidth?: number; // Default 25mm
  donorLogoWidth?: number; // Default 25mm
}

/**
 * Standalone facility configuration (stored in facility_configurations collection)
 * Used when multiple projects share the same facility branding
 */
export interface FacilityConfiguration extends FacilityBranding {
  id: string;

  // Relationships
  programId?: string; // Optional program association
  projectIds?: string[]; // Projects using this configuration

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────
// RECEIPT NUMBER SEQUENCE
// ─────────────────────────────────────────────────────────────────

/**
 * Receipt number sequence counter
 * Stored in receipt_sequences collection
 * Pattern: #Receipt-{YYYY}-{NNN}
 */
export interface ReceiptSequence {
  id: string; // projectCode or facilityCode
  year: number;
  lastNumber: number;
  prefix: string; // e.g., "Receipt" or project-specific
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// FUNDS ACKNOWLEDGEMENT FORM DATA
// ─────────────────────────────────────────────────────────────────

/**
 * Form data for creating a Funds Acknowledgement
 */
export interface FundsAcknowledgementFormData {
  // Transaction Details
  receiptNumber?: string; // Auto-generated if not provided
  dateOfFundsTransfer: Date;
  projectName: string;
  projectDescription?: string; // For acknowledgement statement
  amountReceived: number;
  currency: string; // Default UGX
  paymentMethod: string; // e.g., "Bank Transfer to Centenary Account"
  periodCovered?: string; // e.g., "January 2025"

  // Requestor/Signatory
  requestorName: string;
  requestorTitle?: string;
  requestorEmail?: string;
  signatureDate?: Date;
  signatureDataUrl?: string; // Base64 PNG from SignaturePad

  // Optional
  notes?: string;
}

/**
 * Saved Funds Acknowledgement Document
 */
export interface FundsAcknowledgementDocument {
  id: string;

  // Form data
  receiptNumber: string;
  dateOfFundsTransfer: Date | Timestamp;
  projectName: string;
  projectDescription?: string;
  amountReceived: number;
  amountInWords: string;
  currency: string;
  paymentMethod: string;
  periodCovered?: string;

  // Requestor
  requestorName: string;
  requestorTitle?: string;
  requestorEmail?: string;
  signatureDate: Date | Timestamp;
  signatureDataUrl?: string; // Stored signature image

  // Branding (snapshot at time of generation)
  facilityBranding: FacilityBranding;

  // Document metadata
  documentUrl?: string; // Firebase Storage URL
  documentStoragePath?: string; // For deletion
  fileName: string; // e.g., "RHC-FundsAck-Jan2025.pdf"

  // Relationships
  projectId: string;
  projectCode: string;
  programId?: string;
  linkedRequisitionId?: string; // If linked to a requisition
  templateVariant?: 'standard' | 'donor_header'; // Saved template style for consistent regeneration

  // Audit
  generatedAt: Timestamp;
  generatedBy: string;
  generatedByName?: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// PDF GENERATION OPTIONS
// ─────────────────────────────────────────────────────────────────

export interface FundsAcknowledgementPDFOptions {
  formData: FundsAcknowledgementFormData;
  branding: FacilityBranding;
  projectCode: string;
  templateVariant?: 'standard' | 'donor_header';
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Generate receipt number in format: #Receipt-{YYYY}-{NNN}
 */
export function generateReceiptNumber(
  year: number,
  sequence: number,
  prefix: string = 'Receipt'
): string {
  return `#${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
}

/**
 * Generate acknowledgement file name
 * Pattern: {project_code}-FundsAck-{description}.pdf
 */
export function generateAcknowledgementFileName(
  projectCode: string,
  periodCovered?: string
): string {
  const description = periodCovered
    ? periodCovered.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    : new Date().toISOString().split('T')[0];
  return `${projectCode}-FundsAck-${description}.pdf`;
}

/**
 * Default branding for projects without configuration
 */
export function getDefaultBranding(): FacilityBranding {
  return {
    facilityName: 'AMH Uganda',
    address: 'Kampala, Uganda',
  };
}

/**
 * Create empty form data with defaults
 */
export function createEmptyFundsAcknowledgementForm(): FundsAcknowledgementFormData {
  return {
    dateOfFundsTransfer: new Date(),
    projectName: '',
    amountReceived: 0,
    currency: 'UGX',
    paymentMethod: '',
    requestorName: '',
    signatureDate: new Date(),
  };
}

/**
 * Validate form data before submission
 */
export function validateFundsAcknowledgementForm(
  formData: FundsAcknowledgementFormData
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!formData.projectName?.trim()) {
    errors.push('Project name is required');
  }
  if (!formData.amountReceived || formData.amountReceived <= 0) {
    errors.push('Amount received must be greater than 0');
  }
  if (!formData.paymentMethod?.trim()) {
    errors.push('Payment method is required');
  }
  if (!formData.requestorName?.trim()) {
    errors.push('Requestor name is required');
  }
  if (!formData.dateOfFundsTransfer) {
    errors.push('Date of funds transfer is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
