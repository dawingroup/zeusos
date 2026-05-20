/**
 * Migration Types
 * Type definitions for v5 to v6 migration
 */

import { Timestamp } from 'firebase/firestore';

export type MigrationStatus =
  | 'pending'
  | 'in_progress'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type EntityType =
  | 'program'
  | 'project'
  | 'ipc'
  | 'requisition'
  | 'deal'
  | 'portfolio'
  | 'holding'
  | 'boq'
  | 'material'
  | 'client'
  | 'engagement';

export interface MigrationConfig {
  sourceCollection: string;
  targetCollection: string;
  entityType: EntityType;
  batchSize: number;
  validateBefore: boolean;
  validateAfter: boolean;
  createBackup: boolean;
  dryRun: boolean;
}

export interface MigrationJob {
  id: string;
  config: MigrationConfig;
  status: MigrationStatus;

  // Progress
  totalDocuments: number;
  processedDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;

  // Timing
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;

  // Errors
  errors: MigrationError[];
  warnings: MigrationWarning[];

  // Metadata
  createdBy: string;
  createdAt: Date;
  rolledBackAt?: Date;
  documentsRolledBack?: number;
}

export interface MigrationError {
  documentId: string;
  field?: string;
  error: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: Date;
}

export interface MigrationWarning {
  documentId: string;
  field?: string;
  warning: string;
  suggestion?: string;
  timestamp: Date;
}

export interface MigrationResult {
  jobId: string;
  status: MigrationStatus;
  summary: {
    total: number;
    migrated: number;
    failed: number;
    skipped: number;
  };
  duration: number;
  errors: MigrationError[];
}

// ============================================================================
// V5 Schema Types (source)
// ============================================================================

export interface V5Program {
  id: string;
  name: string;
  code: string;
  fundingSource: string;
  budget: number;
  startDate: Timestamp | Date | null;
  endDate: Timestamp | Date | null;
  status: string;
  projects?: string[];
  description?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface V5Project {
  id: string;
  programId: string;
  name: string;
  code: string;
  location: string;
  contractor?: string;
  contractorContact?: string;
  budget: number;
  status: string;
  implementationType: 'contractor' | 'direct';
  progressPercent?: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface V5IPC {
  id: string;
  projectId: string;
  certificateNumber: string;
  amount: number;
  cumulativeAmount?: number;
  retentionAmount?: number;
  status: string;
  periodFrom: Timestamp | Date;
  periodTo: Timestamp | Date;
  description?: string;
  createdAt: Timestamp | Date;
  approvedAt?: Timestamp | Date;
  approvedBy?: string;
}

export interface V5Requisition {
  id: string;
  projectId: string;
  requisitionNumber: string;
  amount: number;
  type: 'material' | 'payment' | 'other';
  status: string;
  description?: string;
  items?: V5RequisitionItem[];
  createdAt: Timestamp | Date;
  approvedAt?: Timestamp | Date;
}

export interface V5RequisitionItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface V5Deal {
  id: string;
  name: string;
  stage: string;
  value: number;
  sector: string;
  subsector?: string;
  projectId?: string;
  description?: string;
  clientName?: string;
  dueDate?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface V5Portfolio {
  id: string;
  name: string;
  clientId: string;
  totalValue: number;
  holdings?: string[];
  status: string;
  createdAt: Timestamp | Date;
}

export interface V5BOQ {
  id: string;
  projectId: string;
  name: string;
  totalAmount: number;
  currency: string;
  items?: V5BOQItem[];
  status: string;
  createdAt: Timestamp | Date;
}

export interface V5BOQItem {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}

// ============================================================================
// V6 Schema Types (target)
// ============================================================================

export interface V6Engagement {
  id: string;
  type: 'program' | 'deal' | 'advisory_mandate';
  name: string;
  code: string;
  clientId: string;
  status: string;
  funding: V6FundingConfig;
  timeline: V6Timeline;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  migratedFrom?: MigrationMetadata;
}

export interface V6FundingConfig {
  type: 'grant' | 'government' | 'private' | 'mixed';
  sources: V6FundingSource[];
  totalBudget: number;
  currency: string;
}

export interface V6FundingSource {
  name: string;
  type: string;
  amount: number;
  percentage: number;
}

export interface V6Timeline {
  startDate: Timestamp | Date | null;
  endDate: Timestamp | Date | null;
  milestones: V6Milestone[];
}

export interface V6Milestone {
  id: string;
  name: string;
  dueDate: Timestamp | Date;
  status: string;
  completedAt?: Timestamp | Date;
}

export interface V6Project {
  id: string;
  engagementId: string;
  name: string;
  code: string;
  location: V6Location;
  implementationType: 'contractor' | 'direct';
  contractor?: V6Contractor;
  budget: V6Budget;
  status: string;
  progress?: V6Progress;
  timeline: V6ProjectTimeline;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  migratedFrom?: MigrationMetadata;
}

export interface V6Location {
  name: string;
  region?: string;
  district?: string;
  coordinates?: { lat: number; lng: number };
}

export interface V6Contractor {
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
}

export interface V6Budget {
  allocated: number;
  committed: number;
  spent: number;
  currency: string;
}

export interface V6Progress {
  percent: number;
  lastUpdated: Timestamp | Date;
  notes?: string;
}

export interface V6ProjectTimeline {
  plannedStart?: Timestamp | Date;
  plannedEnd?: Timestamp | Date;
  actualStart?: Timestamp | Date;
  actualEnd?: Timestamp | Date;
}

export interface V6Payment {
  id: string;
  projectId: string;
  engagementId: string;
  type: 'ipc' | 'requisition' | 'advance' | 'retention';
  referenceNumber: string;
  amount: number;
  cumulativeAmount?: number;
  status: string;
  period?: {
    from: Timestamp | Date;
    to: Timestamp | Date;
  };
  description?: string;
  lineItems?: V6PaymentLineItem[];
  approvals?: V6Approval[];
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  migratedFrom?: MigrationMetadata;
}

export interface V6PaymentLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface V6Approval {
  role: string;
  userId?: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp?: Timestamp | Date;
  notes?: string;
}

export interface MigrationMetadata {
  version: string;
  sourceId: string;
  sourceCollection?: string;
  additionalSourceIds?: Record<string, string>;
  migratedAt: Timestamp | Date;
}

// ============================================================================
// Transformation Types
// ============================================================================

export interface TransformationMap {
  sourceField: string;
  targetField: string;
  transform?: (value: any, sourceDoc?: any) => any;
  required: boolean;
  defaultValue?: any;
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'type' | 'range' | 'enum' | 'reference' | 'custom';
  params?: {
    type?: string;
    min?: number;
    max?: number;
    values?: any[];
    collection?: string;
    validator?: (value: any, data: any) => boolean;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  };
  message: string;
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

export interface MigrationProgress {
  jobId: string;
  entityType: EntityType;
  phase: 'backup' | 'validation' | 'transformation' | 'writing' | 'verification';
  current: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  currentDocument?: string;
}

export interface MigrationSummary {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  inProgressJobs: number;
  totalDocumentsMigrated: number;
  totalErrors: number;
  lastMigrationAt?: Date;
}

// ============================================================================
// Backup Types
// ============================================================================

export interface BackupInfo {
  id: string;
  sourceCollection: string;
  backupCollection: string;
  documentCount: number;
  createdAt: Date;
  sizeBytes?: number;
}

export interface RollbackResult {
  success: boolean;
  jobId: string;
  documentsRolledBack: number;
  documentsRestored: number;
  errors: string[];
  duration: number;
}
