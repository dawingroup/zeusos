/**
 * Contract Types & Schemas - DawinOS v2.0
 * 
 * Comprehensive types for employment contracts including:
 * - Contract types (permanent, fixed-term, casual, etc.)
 * - Contract status lifecycle
 * - Amendments and renewals
 * - Template system
 * - Uganda-specific clauses
 */

import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// ============================================================================
// Contract Enums
// ============================================================================

/**
 * Contract Types - Types of employment contracts
 */
export type ContractType =
  | 'permanent'           // Open-ended employment
  | 'fixed_term'          // Fixed duration with end date
  | 'probationary'        // Probation contract (usually 3-6 months)
  | 'casual'              // Day-to-day casual work
  | 'part_time'           // Part-time employment
  | 'internship'          // Internship/attachment
  | 'consultancy'         // Independent contractor
  | 'temporary';          // Temporary assignment

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  permanent: 'Permanent Employment',
  fixed_term: 'Fixed-Term Contract',
  probationary: 'Probationary Contract',
  casual: 'Casual Employment',
  part_time: 'Part-Time Employment',
  internship: 'Internship',
  consultancy: 'Consultancy Agreement',
  temporary: 'Temporary Employment',
};

/**
 * Contract Status - Lifecycle states
 */
export type ContractStatus =
  | 'draft'               // Being prepared
  | 'pending_approval'    // Awaiting HR approval
  | 'pending_signature'   // Awaiting employee signature
  | 'active'              // Currently in effect
  | 'on_hold'             // Temporarily suspended
  | 'expired'             // End date passed
  | 'terminated'          // Ended before expiry
  | 'renewed'             // Replaced by new contract
  | 'superseded';         // Replaced by amendment

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  pending_signature: 'Pending Signature',
  active: 'Active',
  on_hold: 'On Hold',
  expired: 'Expired',
  terminated: 'Terminated',
  renewed: 'Renewed',
  superseded: 'Superseded',
};

/**
 * Amendment Types - Types of contract modifications
 */
export type AmendmentType =
  | 'salary_revision'     // Salary/compensation change
  | 'position_change'     // Job title/role change
  | 'department_change'   // Department transfer
  | 'location_change'     // Work location change
  | 'schedule_change'     // Work hours/schedule change
  | 'terms_modification'  // General terms update
  | 'extension'           // Contract period extension
  | 'probation_extension' // Extended probation
  | 'benefits_change'     // Benefits modification
  | 'other';              // Other amendments

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  salary_revision: 'Salary Revision',
  position_change: 'Position Change',
  department_change: 'Department Transfer',
  location_change: 'Location Change',
  schedule_change: 'Schedule Modification',
  terms_modification: 'Terms Modification',
  extension: 'Contract Extension',
  probation_extension: 'Probation Extension',
  benefits_change: 'Benefits Change',
  other: 'Other Amendment',
};

/**
 * Termination Types - Reasons for contract end
 */
export type TerminationType =
  | 'mutual_agreement'    // Both parties agree
  | 'resignation'         // Employee initiated
  | 'dismissal'           // Employer initiated (with cause)
  | 'redundancy'          // Position eliminated
  | 'end_of_term'         // Fixed-term expiry
  | 'retirement'          // Age/service retirement
  | 'death'               // Employee deceased
  | 'incapacity'          // Unable to perform duties
  | 'abandonment';        // Job abandonment

export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  mutual_agreement: 'Mutual Agreement',
  resignation: 'Resignation',
  dismissal: 'Dismissal',
  redundancy: 'Redundancy',
  end_of_term: 'End of Contract Term',
  retirement: 'Retirement',
  death: 'Death',
  incapacity: 'Incapacity',
  abandonment: 'Job Abandonment',
};

// ============================================================================
// Contract Core Types
// ============================================================================

/**
 * Compensation Details
 */
export interface ContractCompensation {
  baseSalary: number;                    // Monthly base salary (UGX)
  currency: string;                       // Currency code (default: UGX)
  paymentFrequency: 'monthly' | 'bi_weekly' | 'weekly' | 'daily';
  paymentMethod: 'bank_transfer' | 'mobile_money' | 'cash' | 'cheque';
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    branchCode?: string;
  };
  mobileMoneyDetails?: {
    provider: 'mtn' | 'airtel';
    phoneNumber: string;
    registeredName: string;
  };
  allowances?: ContractAllowance[];
  deductions?: ContractDeduction[];
  bonusStructure?: {
    type: 'fixed' | 'percentage' | 'performance_based';
    amount?: number;
    percentage?: number;
    frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time';
    conditions?: string;
  };
}

/**
 * Allowance in contract
 */
export interface ContractAllowance {
  type: 'housing' | 'transport' | 'medical' | 'lunch' | 'communication' | 'hardship' | 'responsibility' | 'other';
  name: string;
  amount: number;
  frequency: 'monthly' | 'annual' | 'one_time';
  taxable: boolean;
  conditions?: string;
}

/**
 * Deduction in contract
 */
export interface ContractDeduction {
  type: 'nssf' | 'paye' | 'lst' | 'loan' | 'advance' | 'other';
  name: string;
  amount?: number;
  percentage?: number;
  frequency: 'monthly' | 'one_time';
  mandatory: boolean;
}

/**
 * Work Schedule in contract
 */
export interface ContractSchedule {
  type: 'full_time' | 'part_time' | 'shift' | 'flexible' | 'remote';
  hoursPerWeek: number;
  workDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  startTime?: string;                    // HH:MM format
  endTime?: string;                      // HH:MM format
  breakDuration?: number;                // Minutes
  overtimeEligible: boolean;
  overtimeRate?: number;                 // Multiplier (e.g., 1.5, 2.0)
  remoteWorkAllowed: boolean;
  remoteWorkDays?: number;               // Days per week
}

/**
 * Leave Entitlements in contract
 */
export interface ContractLeaveEntitlements {
  annualLeave: number;                   // Days per year
  sickLeave: number;                     // Days per year
  maternityLeave?: number;               // Days (60 per Uganda law)
  paternityLeave?: number;               // Days (4 per Uganda law)
  compassionateLeave?: number;           // Days per occurrence
  studyLeave?: number;                   // Days per year
  unpaidLeaveAllowed: boolean;
  leaveCarryOver: {
    allowed: boolean;
    maxDays?: number;
    expiryMonths?: number;
  };
}

/**
 * Benefits in contract
 */
export interface ContractBenefits {
  medicalCover?: {
    provided: boolean;
    provider?: string;
    coverLevel?: 'individual' | 'individual_spouse' | 'family';
    annualLimit?: number;
    dependentsIncluded?: number;
  };
  lifeCover?: {
    provided: boolean;
    multiplier?: number;                 // Multiple of annual salary
    amount?: number;
  };
  pension?: {
    provided: boolean;
    employerContribution?: number;       // Percentage
    employeeContribution?: number;       // Percentage
    vestingPeriod?: number;              // Months
  };
  otherBenefits?: {
    name: string;
    description: string;
    value?: number;
  }[];
}

/**
 * Notice Period configuration
 */
export interface NoticePeriod {
  employeeNoticeDays: number;            // Days employee must give
  employerNoticeDays: number;            // Days employer must give
  probationNoticeDays: number;           // During probation
  gardenLeaveAllowed: boolean;           // Pay in lieu of notice
}

/**
 * Probation Period configuration
 */
export interface ProbationPeriod {
  duration: number;                      // Months
  startDate: Timestamp;
  endDate: Timestamp;
  reviewDates: Timestamp[];              // Scheduled review dates
  extendable: boolean;
  maxExtensions: number;
  extensionDuration: number;             // Months per extension
  currentExtension: number;              // Current extension count
}

/**
 * Confidentiality and restrictive covenants
 */
export interface RestrictiveCovenants {
  confidentialityClause: boolean;
  nonCompeteClause: boolean;
  nonCompeteDuration?: number;           // Months after termination
  nonCompeteScope?: string;              // Geographic/industry scope
  nonSolicitationClause: boolean;
  nonSolicitationDuration?: number;      // Months after termination
  intellectualPropertyClause: boolean;
  ipAssignmentScope?: string;            // Scope of IP assignment
}

/**
 * Contract Signatory
 */
export interface ContractSignatory {
  role: 'employee' | 'employer' | 'witness' | 'hr_manager' | 'ceo' | 'director';
  name: string;
  title?: string;
  email?: string;
  signedAt?: Timestamp;
  signature?: string;                    // Base64 signature image or reference
  ipAddress?: string;
  signatureMethod: 'electronic' | 'physical' | 'pending';
}

/**
 * Contract Document
 */
export interface ContractDocument {
  id: string;
  type: 'contract' | 'amendment' | 'appendix' | 'signed_copy' | 'supporting';
  name: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Timestamp;
  version: number;
}

// ============================================================================
// Main Contract Entity
// ============================================================================

/**
 * Employment Contract
 */
export interface Contract {
  // Identifiers
  id: string;
  contractNumber: string;                // Format: CTR-{SUBSIDIARY}-{YEAR}-{SEQ}
  subsidiaryId: string;
  
  // Employee reference
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  
  // Contract type and status
  contractType: ContractType;
  status: ContractStatus;
  
  // Dates
  effectiveDate: Timestamp;              // When contract takes effect
  startDate: Timestamp;                  // Employment start date
  endDate?: Timestamp;                   // For fixed-term contracts
  signedDate?: Timestamp;                // When fully signed
  terminationDate?: Timestamp;           // If terminated early
  
  // Position details
  position: {
    title: string;
    jobCode?: string;
    gradeLevel?: string;
    department: string;
    departmentId: string;
    reportingTo: string;
    reportingToId: string;
    location: string;
    isManagement: boolean;
  };
  
  // Terms
  compensation: ContractCompensation;
  schedule: ContractSchedule;
  leaveEntitlements: ContractLeaveEntitlements;
  benefits?: ContractBenefits;
  noticePeriod: NoticePeriod;
  probation?: ProbationPeriod;
  restrictiveCovenants?: RestrictiveCovenants;
  
  // Special clauses
  specialClauses?: {
    title: string;
    content: string;
    isStandard: boolean;
  }[];
  
  // Signatories
  signatories: ContractSignatory[];
  
  // Documents
  documents: ContractDocument[];
  
  // Template reference
  templateId?: string;
  templateVersion?: number;
  
  // Relationships
  previousContractId?: string;           // For renewals
  amendmentIds?: string[];               // Related amendments
  
  // Termination details
  termination?: {
    type: TerminationType;
    reason: string;
    initiatedBy: 'employee' | 'employer';
    noticePeriodServed: boolean;
    finalSettlementAmount?: number;
    exitInterviewCompleted: boolean;
    handoverCompleted: boolean;
  };
  
  // Metadata
  version: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  // Audit
  auditTrail?: ContractAuditEntry[];
}

/**
 * Contract Audit Entry
 */
export interface ContractAuditEntry {
  id: string;
  action: 'created' | 'updated' | 'status_changed' | 'signed' | 'approved' | 'terminated' | 'renewed';
  description: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  performedBy: string;
  performedByName: string;
  performedAt: Timestamp;
  ipAddress?: string;
}

// ============================================================================
// Contract Amendment
// ============================================================================

/**
 * Contract Amendment
 */
export interface ContractAmendment {
  id: string;
  amendmentNumber: string;               // Format: AMD-{CONTRACT_NUMBER}-{SEQ}
  contractId: string;
  contractNumber: string;
  employeeId: string;
  employeeName: string;
  
  // Amendment details
  amendmentType: AmendmentType;
  title: string;
  description: string;
  effectiveDate: Timestamp;
  
  // Changes
  changes: {
    field: string;
    fieldLabel: string;
    previousValue: any;
    newValue: any;
  }[];
  
  // Status
  status: 'draft' | 'pending_approval' | 'pending_signature' | 'active' | 'rejected' | 'cancelled';
  
  // Signatories
  signatories: ContractSignatory[];
  
  // Documents
  documents: ContractDocument[];
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
}

// ============================================================================
// Contract Template
// ============================================================================

/**
 * Contract Template Variable
 */
export interface TemplateVariable {
  key: string;                           // e.g., {{employee_name}}
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'list';
  source: 'employee' | 'contract' | 'company' | 'custom';
  sourcePath?: string;                   // Path to data source field
  defaultValue?: any;
  required: boolean;
  format?: string;                       // Date/number format
}

/**
 * Contract Template Section
 */
export interface TemplateSection {
  id: string;
  title: string;
  order: number;
  content: string;                       // HTML/Markdown with variables
  isOptional: boolean;
  includeByDefault: boolean;
  conditions?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  }[];
}

/**
 * Contract Template
 */
export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  contractType: ContractType;
  subsidiaryId?: string;                 // null = available to all
  
  // Content
  sections: TemplateSection[];
  variables: TemplateVariable[];
  
  // Styling
  headerHtml?: string;
  footerHtml?: string;
  styling?: {
    fontFamily: string;
    fontSize: number;
    pageMargins: [number, number, number, number];
    headerLogo?: string;
  };
  
  // Status
  status: 'draft' | 'active' | 'deprecated';
  version: number;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

// ============================================================================
// Summary and List Types
// ============================================================================

/**
 * Contract Summary for lists
 */
export interface ContractSummary {
  id: string;
  contractNumber: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  contractType: ContractType;
  status: ContractStatus;
  positionTitle: string;
  department: string;
  baseSalary: number;
  effectiveDate: Timestamp;
  endDate?: Timestamp;
  daysToExpiry?: number;
  hasActiveAmendments: boolean;
  lastUpdated: Timestamp;
}

/**
 * Amendment Summary for lists
 */
export interface AmendmentSummary {
  id: string;
  amendmentNumber: string;
  contractNumber: string;
  employeeName: string;
  amendmentType: AmendmentType;
  title: string;
  effectiveDate: Timestamp;
  status: ContractAmendment['status'];
  createdAt: Timestamp;
}

// ============================================================================
// DTOs
// ============================================================================

/**
 * Create Contract Input
 */
export interface CreateContractInput {
  subsidiaryId: string;
  employeeId: string;
  contractType: ContractType;
  effectiveDate: Date;
  startDate: Date;
  endDate?: Date;
  position: {
    title: string;
    jobCode?: string;
    gradeLevel?: string;
    department: string;
    departmentId: string;
    reportingTo: string;
    reportingToId: string;
    location: string;
    isManagement: boolean;
  };
  compensation: {
    baseSalary: number;
    currency?: string;
    paymentFrequency?: ContractCompensation['paymentFrequency'];
    paymentMethod: ContractCompensation['paymentMethod'];
    allowances?: ContractAllowance[];
  };
  schedule: {
    type: ContractSchedule['type'];
    hoursPerWeek: number;
    workDays: ContractSchedule['workDays'];
    overtimeEligible?: boolean;
    remoteWorkAllowed?: boolean;
  };
  leaveEntitlements?: Partial<ContractLeaveEntitlements>;
  probation?: {
    duration: number;
    extendable?: boolean;
  };
  noticePeriod?: Partial<NoticePeriod>;
  templateId?: string;
  specialClauses?: { title: string; content: string }[];
}

/**
 * Update Contract Input
 */
export interface UpdateContractInput {
  contractType?: ContractType;
  effectiveDate?: Date;
  endDate?: Date;
  position?: Partial<Contract['position']>;
  compensation?: Partial<ContractCompensation>;
  schedule?: Partial<ContractSchedule>;
  leaveEntitlements?: Partial<ContractLeaveEntitlements>;
  benefits?: Partial<ContractBenefits>;
  noticePeriod?: Partial<NoticePeriod>;
  restrictiveCovenants?: Partial<RestrictiveCovenants>;
  specialClauses?: { title: string; content: string; isStandard?: boolean }[];
}

/**
 * Create Amendment Input
 */
export interface CreateAmendmentInput {
  contractId: string;
  amendmentType: AmendmentType;
  title: string;
  description: string;
  effectiveDate: Date;
  changes: {
    field: string;
    fieldLabel: string;
    previousValue: any;
    newValue: any;
  }[];
}

/**
 * Renew Contract Input
 */
export interface RenewContractInput {
  contractId: string;
  newEffectiveDate: Date;
  newEndDate?: Date;
  changes?: {
    compensation?: Partial<ContractCompensation>;
    position?: Partial<Contract['position']>;
    schedule?: Partial<ContractSchedule>;
  };
  keepAllowances?: boolean;
  keepBenefits?: boolean;
}

/**
 * Terminate Contract Input
 */
export interface TerminateContractInput {
  contractId: string;
  terminationType: TerminationType;
  reason: string;
  initiatedBy: 'employee' | 'employer';
  terminationDate: Date;
  lastWorkingDay?: Date;
  noticePeriodServed: boolean;
  finalSettlementAmount?: number;
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Contract Filters
 */
export interface ContractFilters {
  subsidiaryId?: string;
  employeeId?: string;
  departmentId?: string;
  contractType?: ContractType[];
  status?: ContractStatus[];
  effectiveDateFrom?: Date;
  effectiveDateTo?: Date;
  expiringWithinDays?: number;
  hasEndDate?: boolean;
  salaryMin?: number;
  salaryMax?: number;
}

/**
 * Contract Sort
 */
export interface ContractSort {
  field: 'contractNumber' | 'employeeName' | 'effectiveDate' | 'endDate' | 'baseSalary' | 'status' | 'updatedAt';
  direction: 'asc' | 'desc';
}

/**
 * Contract List Result
 */
export interface ContractListResult {
  contracts: ContractSummary[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Contract Statistics
 */
export interface ContractStats {
  total: number;
  byType: Record<ContractType, number>;
  byStatus: Record<ContractStatus, number>;
  expiringThisMonth: number;
  expiringNextMonth: number;
  pendingSignature: number;
  recentlyRenewed: number;
  averageSalary: number;
  totalPayroll: number;
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const createContractSchema = z.object({
  subsidiaryId: z.string().min(1, 'Subsidiary is required'),
  employeeId: z.string().min(1, 'Employee is required'),
  contractType: z.enum(['permanent', 'fixed_term', 'probationary', 'casual', 'part_time', 'internship', 'consultancy', 'temporary']),
  effectiveDate: z.date(),
  startDate: z.date(),
  endDate: z.date().optional(),
  position: z.object({
    title: z.string().min(1, 'Position title is required'),
    jobCode: z.string().optional(),
    gradeLevel: z.string().optional(),
    department: z.string().min(1, 'Department is required'),
    departmentId: z.string().min(1),
    reportingTo: z.string().min(1, 'Reporting manager is required'),
    reportingToId: z.string().min(1),
    location: z.string().min(1, 'Location is required'),
    isManagement: z.boolean(),
  }),
  compensation: z.object({
    baseSalary: z.number().min(0, 'Salary must be positive'),
    currency: z.string().default('UGX'),
    paymentFrequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'daily']).default('monthly'),
    paymentMethod: z.enum(['bank_transfer', 'mobile_money', 'cash', 'cheque']),
    allowances: z.array(z.object({
      type: z.string(),
      name: z.string(),
      amount: z.number(),
      frequency: z.enum(['monthly', 'annual', 'one_time']),
      taxable: z.boolean(),
    })).optional(),
  }),
  schedule: z.object({
    type: z.enum(['full_time', 'part_time', 'shift', 'flexible', 'remote']),
    hoursPerWeek: z.number().min(1).max(168),
    workDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])),
    overtimeEligible: z.boolean().default(false),
    remoteWorkAllowed: z.boolean().default(false),
  }),
  leaveEntitlements: z.object({
    annualLeave: z.number().default(21),
    sickLeave: z.number().default(14),
  }).optional(),
  probation: z.object({
    duration: z.number().min(1).max(12),
    extendable: z.boolean().default(true),
  }).optional(),
  templateId: z.string().optional(),
}).refine(
  (data) => {
    // Fixed-term contracts must have end date
    if (data.contractType === 'fixed_term' && !data.endDate) {
      return false;
    }
    return true;
  },
  { message: 'Fixed-term contracts require an end date', path: ['endDate'] }
).refine(
  (data) => {
    // End date must be after start date
    if (data.endDate && data.startDate >= data.endDate) {
      return false;
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['endDate'] }
);

export const createAmendmentSchema = z.object({
  contractId: z.string().min(1, 'Contract is required'),
  amendmentType: z.enum(['salary_revision', 'position_change', 'department_change', 'location_change', 'schedule_change', 'terms_modification', 'extension', 'probation_extension', 'benefits_change', 'other']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  effectiveDate: z.date(),
  changes: z.array(z.object({
    field: z.string(),
    fieldLabel: z.string(),
    previousValue: z.any(),
    newValue: z.any(),
  })).min(1, 'At least one change is required'),
});

export const terminateContractSchema = z.object({
  contractId: z.string().min(1),
  terminationType: z.enum(['mutual_agreement', 'resignation', 'dismissal', 'redundancy', 'end_of_term', 'retirement', 'death', 'incapacity', 'abandonment']),
  reason: z.string().min(1, 'Reason is required'),
  initiatedBy: z.enum(['employee', 'employer']),
  terminationDate: z.date(),
  lastWorkingDay: z.date().optional(),
  noticePeriodServed: z.boolean(),
  finalSettlementAmount: z.number().optional(),
});

// ============================================================================
// Constants
// ============================================================================

/**
 * Contract number format configuration
 */
export const CONTRACT_NUMBER_CONFIG = {
  prefix: 'CTR',
  separator: '-',
  yearFormat: 'YYYY',
  sequenceLength: 4,
};

/**
 * Amendment number format configuration
 */
export const AMENDMENT_NUMBER_CONFIG = {
  prefix: 'AMD',
  separator: '-',
  sequenceLength: 2,
};

/**
 * Default notice periods by contract type (days)
 */
export const DEFAULT_NOTICE_PERIODS: Record<ContractType, NoticePeriod> = {
  permanent: {
    employeeNoticeDays: 30,
    employerNoticeDays: 30,
    probationNoticeDays: 7,
    gardenLeaveAllowed: true,
  },
  fixed_term: {
    employeeNoticeDays: 30,
    employerNoticeDays: 30,
    probationNoticeDays: 7,
    gardenLeaveAllowed: true,
  },
  probationary: {
    employeeNoticeDays: 7,
    employerNoticeDays: 7,
    probationNoticeDays: 7,
    gardenLeaveAllowed: false,
  },
  casual: {
    employeeNoticeDays: 1,
    employerNoticeDays: 1,
    probationNoticeDays: 1,
    gardenLeaveAllowed: false,
  },
  part_time: {
    employeeNoticeDays: 14,
    employerNoticeDays: 14,
    probationNoticeDays: 7,
    gardenLeaveAllowed: false,
  },
  internship: {
    employeeNoticeDays: 7,
    employerNoticeDays: 7,
    probationNoticeDays: 0,
    gardenLeaveAllowed: false,
  },
  consultancy: {
    employeeNoticeDays: 30,
    employerNoticeDays: 30,
    probationNoticeDays: 0,
    gardenLeaveAllowed: true,
  },
  temporary: {
    employeeNoticeDays: 7,
    employerNoticeDays: 7,
    probationNoticeDays: 3,
    gardenLeaveAllowed: false,
  },
};

/**
 * Default leave entitlements per Uganda Employment Act 2006
 */
export const DEFAULT_LEAVE_ENTITLEMENTS: ContractLeaveEntitlements = {
  annualLeave: 21,                       // 21 working days
  sickLeave: 14,                         // 14 days per year
  maternityLeave: 60,                    // 60 working days
  paternityLeave: 4,                     // 4 working days
  compassionateLeave: 4,                 // 4 days per occurrence
  studyLeave: 0,                         // Company discretion
  unpaidLeaveAllowed: true,
  leaveCarryOver: {
    allowed: true,
    maxDays: 10,
    expiryMonths: 3,
  },
};

/**
 * Default probation configuration
 */
export const DEFAULT_PROBATION_CONFIG = {
  durationMonths: 3,
  maxExtensions: 2,
  extensionDurationMonths: 3,
  maxTotalMonths: 6,
};

/**
 * Contract expiry warning thresholds (days)
 */
export const EXPIRY_WARNING_THRESHOLDS = [90, 60, 30, 14, 7];

/**
 * Valid contract status transitions
 */
export const VALID_CONTRACT_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['pending_approval', 'terminated'],
  pending_approval: ['draft', 'pending_signature', 'terminated'],
  pending_signature: ['pending_approval', 'active', 'terminated'],
  active: ['on_hold', 'expired', 'terminated', 'renewed', 'superseded'],
  on_hold: ['active', 'terminated'],
  expired: ['renewed'],
  terminated: [],
  renewed: [],
  superseded: [],
};

/**
 * Contract management configuration
 */
export const CONTRACT_CONFIG = {
  maxDocumentSize: 10 * 1024 * 1024,     // 10MB
  allowedDocumentTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
  signatureRequired: ['employee', 'hr_manager'],
  autoRenewalNotificationDays: [90, 60, 30],
  paginationLimit: 20,
  searchMinLength: 2,
  cacheTimeMinutes: 10,
};
