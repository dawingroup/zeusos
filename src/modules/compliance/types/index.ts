/**
 * Compliance Module Types
 * Core types for document management, obligations, and compliance tracking.
 */

import { Timestamp } from 'firebase/firestore';

// ── Enums ──────────────────────────────────────────────────────────────────

export type ComplianceDocumentStatus =
  | 'valid'
  | 'expiring_soon'
  | 'expired'
  | 'missing'
  | 'not_applicable'
  | 'pending_verification';

export type ComplianceDocumentCategory =
  | 'financial'
  | 'legal'
  | 'tax'
  | 'statutory'
  | 'licensing'
  | 'regulatory'
  | 'business'
  | 'insurance'
  | 'employment';

export type RegulatoryBody =
  | 'URA'
  | 'NSSF'
  | 'KCCA'
  | 'URSB'
  | 'NEMA'
  | 'MoFPED'
  | 'BoU'
  | 'UIA'
  | 'LOCAL_COUNCIL'
  | 'OTHER';

export type RenewalFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semi_annually'
  | 'annually'
  | 'biennial'
  | 'one_time'
  | 'ad_hoc';

export type ObligationStatus = 'active' | 'paused' | 'completed' | 'archived';
export type ObligationPriority = 'low' | 'medium' | 'high' | 'critical';

// ── Checklist & History ────────────────────────────────────────────────────

export interface ComplianceChecklistItem {
  id: string;
  title: string;
  description?: string;
  isRequired: boolean;
  completed: boolean;
  completedAt?: Timestamp;
  completedBy?: string;
  order: number;
}

export type ComplianceHistoryAction =
  | 'uploaded'
  | 'verified'
  | 'expired'
  | 'renewed'
  | 'status_changed'
  | 'checklist_updated'
  | 'note_added';

export interface ComplianceHistoryEntry {
  id: string;
  action: ComplianceHistoryAction;
  description: string;
  performedBy: string;
  performedAt: Timestamp;
  metadata?: Record<string, unknown>;
}

// ── Document ───────────────────────────────────────────────────────────────

export interface ComplianceDocument {
  id: string;
  companyId: string;
  name: string;
  documentType: string;
  category: ComplianceDocumentCategory;
  status: ComplianceDocumentStatus;
  description?: string;
  issuedDate?: Timestamp;
  expiryDate?: Timestamp;
  renewalFrequency: RenewalFrequency;
  alertDaysBefore: number;
  fileUrl?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  lastVerifiedAt?: Timestamp;
  lastVerifiedBy?: string;
  obligationId?: string;
  regulatoryBody?: RegulatoryBody;
  referenceNumber?: string;
  notes?: string;
  tags?: string[];
  requirements?: string[];
  checklist?: ComplianceChecklistItem[];
  history?: ComplianceHistoryEntry[];
  complianceProgress?: number;
  uploadedBy: string;
  uploadedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ComplianceDocumentInput = Omit<ComplianceDocument, 'id' | 'createdAt' | 'updatedAt'>;

// ── Obligation ─────────────────────────────────────────────────────────────

export interface ComplianceObligation {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  category: ComplianceDocumentCategory;
  regulatoryBody: RegulatoryBody;
  frequency: RenewalFrequency;
  dayOfMonthDue?: number;
  nextDueDate?: Timestamp;
  lastCompletedDate?: Timestamp;
  status: ObligationStatus;
  priority: ObligationPriority;
  requiredDocumentTypes: string[];
  assignedTo?: string;
  assignedToName?: string;
  autoCreateTasks: boolean;
  taskTemplateName?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ComplianceObligationInput = Omit<ComplianceObligation, 'id' | 'createdAt' | 'updatedAt'>;

// ── Filters ────────────────────────────────────────────────────────────────

export interface DocumentFilters {
  status?: ComplianceDocumentStatus;
  category?: ComplianceDocumentCategory;
  regulatoryBody?: RegulatoryBody;
  search?: string;
}

export interface ObligationFilters {
  status?: ObligationStatus;
  category?: ComplianceDocumentCategory;
  regulatoryBody?: RegulatoryBody;
  priority?: ObligationPriority;
  search?: string;
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface ComplianceDashboardData {
  score: number;
  statusBreakdown: Record<ComplianceDocumentStatus, number>;
  totalDocuments: number;
  upcomingExpirations: ComplianceDocument[];
  overdueObligations: ComplianceObligation[];
  upcomingObligations: ComplianceObligation[];
}

// ── Templates ──────────────────────────────────────────────────────────────

export interface DocumentTemplateChecklistStep {
  title: string;
  description?: string;
  isRequired: boolean;
}

export interface DocumentTemplate {
  name: string;
  documentType: string;
  category: ComplianceDocumentCategory;
  regulatoryBody: RegulatoryBody;
  renewalFrequency: RenewalFrequency;
  alertDaysBefore: number;
  description?: string;
  requirements?: string[];
  checklistSteps?: DocumentTemplateChecklistStep[];
}

export interface ObligationTemplate {
  title: string;
  description: string;
  category: ComplianceDocumentCategory;
  regulatoryBody: RegulatoryBody;
  frequency: RenewalFrequency;
  dayOfMonthDue?: number;
  requiredDocumentTypes: string[];
  priority: ObligationPriority;
}
