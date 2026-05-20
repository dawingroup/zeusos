// ============================================================================
// DOCUMENT SECTION TYPES - Strategy Plan Update Tool
// Types for section-level document persistence, assessment, and audit trails
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// Enums / Unions
// ----------------------------------------------------------------------------

export type SectionType =
  | 'financial'
  | 'market'
  | 'operations'
  | 'growth'
  | 'risk'
  | 'people'
  | 'governance'
  | 'general';

export type RewriteStatus =
  | 'none'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'applied';

export type ChangeType =
  | 'rewrite'
  | 'minor_edit'
  | 'assessment_only'
  | 'manual_edit'
  | 'new_section'
  | 'removed';

export type TriggerType = 'automated' | 'manual' | 'scheduled';

// ----------------------------------------------------------------------------
// Document Section
// Firestore: companies/{cId}/strategy_reviews/{rId}/document_sections/{sId}
// ----------------------------------------------------------------------------

export interface DocumentSection {
  id: string;
  sectionIndex: number;
  headingText: string;
  headingLevel: 1 | 2 | 3;
  parentSectionId: string | null;
  content: string;
  contentHash: string;
  sectionType: SectionType;
  dataSourceMapping: string[];
  alignmentScore: number | null;
  lastAssessedAt: Timestamp | null;
  pendingRewrite: string | null;
  rewriteStatus: RewriteStatus;
  version: number;
  googleDocRange: { startIndex: number; endIndex: number } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// Section Audit Log Entry
// Firestore: companies/{cId}/strategy_reviews/{rId}/section_audit_log/{aId}
// ----------------------------------------------------------------------------

export interface SectionAuditEntry {
  id: string;
  sectionId: string;
  sectionHeading: string;
  timestamp: Timestamp;
  changeType: ChangeType;
  beforeHash: string;
  afterHash: string;
  beforeSummary: string;
  afterSummary: string;
  dataSourcesQueried: string[];
  dataSnapshot: Record<string, unknown>;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
  rationale: string;
  triggeredBy: TriggerType;
  approvedBy: string | null;
}

// ----------------------------------------------------------------------------
// Assessment Results
// ----------------------------------------------------------------------------

export interface SectionAssessment {
  sectionId: string;
  sectionHeading: string;
  score: number;
  gaps: string[];
  outdatedClaims: string[];
  recommendation: 'rewrite' | 'minor_update' | 'no_action' | 'flag_for_ceo';
  dataSnapshot: Record<string, unknown>;
  dataSourcesQueried: string[];
}

export interface AssessmentCycleResult {
  reviewId: string;
  timestamp: Timestamp;
  totalSections: number;
  assessedSections: number;
  sectionsRewritten: number;
  overallAlignmentScore: number;
  assessments: SectionAssessment[];
  auditEntries: SectionAuditEntry[];
}
