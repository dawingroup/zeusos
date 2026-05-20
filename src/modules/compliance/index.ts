/**
 * Compliance Module
 * Barrel exports for types, services, hooks, pages.
 */

// Types
export type {
  ComplianceDocument,
  ComplianceDocumentInput,
  ComplianceDocumentStatus,
  ComplianceDocumentCategory,
  ComplianceChecklistItem,
  ComplianceHistoryEntry,
  ComplianceHistoryAction,
  ComplianceObligation,
  ComplianceObligationInput,
  ObligationStatus,
  ObligationPriority,
  RegulatoryBody,
  RenewalFrequency,
  DocumentFilters,
  ObligationFilters,
  ComplianceDashboardData,
  DocumentTemplate,
  DocumentTemplateChecklistStep,
  ObligationTemplate,
} from './types';

// Constants
export {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_COLORS,
  CATEGORY_LABELS,
  REGULATORY_BODY_LABELS,
  FREQUENCY_LABELS,
  OBLIGATION_STATUS_LABELS,
  OBLIGATION_PRIORITY_LABELS,
  HISTORY_ACTION_LABELS,
  DOCUMENT_TEMPLATES,
  OBLIGATION_TEMPLATES,
} from './types/constants';

// Services
export {
  getComplianceDocuments,
  getComplianceDocument,
  createComplianceDocument,
  updateComplianceDocument,
  deleteComplianceDocument,
  uploadDocumentFile,
  scanAndUpdateStatuses,
  ensureTemplatesExist,
  toggleChecklistItem,
  addHistoryEntry,
  changeDocumentStatus,
} from './services/complianceDocumentService';

export {
  getComplianceObligations,
  getComplianceObligation,
  createComplianceObligation,
  updateComplianceObligation,
  deleteComplianceObligation,
  completeObligation,
  scanUpcomingObligations,
} from './services/complianceObligationService';

// Hooks
export { useComplianceDocuments } from './hooks/useComplianceDocuments';
export { useComplianceObligations } from './hooks/useComplianceObligations';
export { useComplianceDashboard } from './hooks/useComplianceDashboard';
