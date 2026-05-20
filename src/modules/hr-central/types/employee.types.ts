/**
 * Employee Types - DawinOS v2.0 HR Central
 * Comprehensive employee data structures
 */

import { Timestamp } from 'firebase/firestore';
import { SubsidiaryId, DepartmentId } from '../../intelligence/config/constants';

// ============================================
// Employee Identifiers
// ============================================

/**
 * Unique employee identifier
 * Format: EMP-{subsidiary}-{sequential}
 * Example: EMP-DAWIN-0001, EMP-SOLTEC-0042
 */
export type EmployeeId = string;

/**
 * Employee number for payroll systems
 * Numeric identifier for external integrations
 */
export type EmployeeNumber = string;

// ============================================
// Employment Classifications
// ============================================

/**
 * Employment status categories
 */
export type EmploymentStatus = 
  | 'active'           // Currently employed
  | 'probation'        // In probationary period
  | 'suspended'        // Temporarily suspended
  | 'notice_period'    // Serving notice
  | 'on_leave'         // Extended leave (maternity, study, etc.)
  | 'terminated'       // Employment ended
  | 'resigned'         // Voluntary resignation
  | 'retired';         // Retirement

/**
 * Employment type/contract basis
 */
export type EmploymentType = 
  | 'permanent'        // Full-time permanent
  | 'contract'         // Fixed-term contract
  | 'probation'        // Probationary
  | 'part_time'        // Part-time permanent
  | 'casual'           // Casual/daily worker
  | 'intern'           // Internship
  | 'consultant';      // External consultant

/**
 * Gender options
 */
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

/**
 * Marital status
 */
export type MaritalStatus = 
  | 'single' 
  | 'married' 
  | 'divorced' 
  | 'widowed' 
  | 'separated';

/**
 * Employment termination reasons
 */
export type TerminationReason = 
  | 'resignation'          // Voluntary resignation
  | 'dismissal'            // Disciplinary dismissal
  | 'redundancy'           // Position eliminated
  | 'contract_end'         // Contract expired
  | 'retirement'           // Retirement
  | 'death'                // Deceased
  | 'mutual_agreement'     // Mutual separation
  | 'abandonment'          // Job abandonment
  | 'medical'              // Medical incapacity
  | 'other';               // Other reasons

// ============================================
// Contact & Address Types
// ============================================

/**
 * Phone number with type
 */
export interface PhoneNumber {
  type: 'mobile' | 'work' | 'home' | 'emergency';
  number: string;
  isPrimary: boolean;
  isWhatsApp?: boolean;  // Common in Uganda
  countryCode: string;   // Default: +256 for Uganda
}

/**
 * Physical address
 */
export interface Address {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;       // Uganda uses districts
  region?: string;        // e.g., Central, Western, Northern, Eastern
  country: string;        // Default: Uganda
  postalCode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isResidential: boolean;
  isPermanent: boolean;   // Permanent vs current address
}

/**
 * Emergency contact
 */
export interface EmergencyContact {
  name: string;
  relationship: string;
  phoneNumbers: PhoneNumber[];
  email?: string;
  address?: Address;
  isPrimary: boolean;
}

// ============================================
// Personal Information
// ============================================

/**
 * National identification details
 */
export interface NationalId {
  type: 'national_id' | 'passport' | 'driving_license' | 'refugee_id';
  number: string;
  issueDate?: Timestamp;
  expiryDate?: Timestamp;
  issuingAuthority: string;
  documentUrl?: string;   // Stored document reference
}

/**
 * Bank account details for salary payment
 */
export interface BankAccount {
  bankName: string;
  bankCode?: string;
  branchName: string;
  branchCode?: string;
  accountNumber: string;
  accountName: string;    // Name as it appears on account
  accountType: 'savings' | 'current' | 'salary';
  swiftCode?: string;
  isPrimary: boolean;
  isVerified: boolean;
  verifiedAt?: Timestamp;
}

/**
 * Mobile money account (common in Uganda)
 */
export interface MobileMoneyAccount {
  provider: 'mtn' | 'airtel' | 'other';
  phoneNumber: string;
  accountName: string;
  isPrimary: boolean;
  isVerified: boolean;
}

/**
 * Educational qualification
 */
export interface Education {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  grade?: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  isCompleted: boolean;
  certificateUrl?: string;
}

/**
 * Professional certification
 */
export interface Certification {
  id: string;
  name: string;
  issuingBody: string;
  issueDate: Timestamp;
  expiryDate?: Timestamp;
  certificateNumber?: string;
  certificateUrl?: string;
  isActive: boolean;
}

/**
 * Work experience (previous employment)
 */
export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  department?: string;
  location?: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  isCurrent: boolean;
  responsibilities?: string[];
  referenceContact?: {
    name: string;
    phone: string;
    email?: string;
  };
}

/**
 * Skill or competency
 */
export interface EmployeeSkill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'language' | 'certification' | 'other';
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience?: number;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
}

/**
 * Dependent (for benefits calculation)
 */
export interface Dependent {
  id: string;
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  dateOfBirth: Timestamp;
  gender: Gender;
  isDisabled?: boolean;
  nationalId?: string;
  documentUrl?: string;
}

// ============================================
// Employment Details
// ============================================

/**
 * Job position details
 */
export interface EmployeePosition {
  title: string;
  jobCode?: string;        // Internal job code
  gradeLevel?: string;     // Salary grade
  departmentId: DepartmentId;
  reportingTo?: EmployeeId;
  location: string;
  isManagement: boolean;
  directReports?: number;
}

/**
 * Employment dates tracking
 */
export interface EmploymentDates {
  applicationDate?: Timestamp;
  offerDate?: Timestamp;
  acceptanceDate?: Timestamp;
  joiningDate: Timestamp;
  probationStartDate?: Timestamp;
  probationEndDate?: Timestamp;
  confirmationDate?: Timestamp;
  lastPromotionDate?: Timestamp;
  lastSalaryReviewDate?: Timestamp;
  noticeDate?: Timestamp;
  exitDate?: Timestamp;
  lastWorkingDate?: Timestamp;
}

/**
 * Work schedule
 */
export interface WorkSchedule {
  type: 'full_time' | 'part_time' | 'shift' | 'flexible';
  workDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  startTime: string;       // HH:mm format
  endTime: string;         // HH:mm format
  breakDuration: number;   // Minutes
  weeklyHours: number;
  isRemoteEligible: boolean;
  remoteWorkDays?: number; // Days per week
}

// ============================================
// Statutory Details (Uganda-Specific)
// ============================================

/**
 * NSSF (National Social Security Fund) details
 */
export interface NSSFDetails {
  memberNumber: string;
  registrationDate?: Timestamp;
  employeeContribution: number;  // Percentage (default 5%)
  employerContribution: number;  // Percentage (default 10%)
  isActive: boolean;
  documentUrl?: string;
}

/**
 * Tax identification (TIN)
 */
export interface TaxDetails {
  tinNumber: string;
  registrationDate?: Timestamp;
  taxExempt: boolean;
  exemptionReason?: string;
  exemptionDocumentUrl?: string;
}

/**
 * Local Service Tax (LST) details
 */
export interface LocalServiceTax {
  isApplicable: boolean;
  district: string;
  annualAmount: number;    // UGX
  monthlyDeduction: number;
  exemptionReason?: string;
}

// ============================================
// Leave Entitlements
// ============================================

/**
 * Annual leave entitlements
 */
export interface LeaveEntitlement {
  annualLeave: number;      // Days per year (default 21 in Uganda)
  sickLeave: number;        // Days per year
  maternityLeave?: number;  // Days (60 working days in Uganda)
  paternityLeave?: number;  // Days (4 working days in Uganda)
  compassionateLeave: number;
  studyLeave?: number;
  unpaidLeaveMax: number;
  carryOverMax: number;     // Max days to carry over
  carryOverExpiry?: number; // Months until expiry (e.g., 3)
}

/**
 * Current leave balances
 */
export interface LeaveBalance {
  annual: number;
  sick: number;
  maternity?: number;
  paternity?: number;
  compassionate: number;
  study?: number;
  carriedOver: number;
  unpaidTaken: number;
  asOfDate: Timestamp;
}

// ============================================
// System & Audit
// ============================================

/**
 * System access credentials
 */
export interface SystemAccess {
  userId: string;          // Firebase Auth UID
  email: string;
  isActive: boolean;
  lastLogin?: Timestamp;
  passwordLastChanged?: Timestamp;
  mfaEnabled: boolean;
  accessRoles: string[];   // Role profile IDs
  permissions: string[];   // Direct permissions
}

/**
 * Employee document
 */
export interface EmployeeDocument {
  id: string;
  type: 'contract' | 'id' | 'certificate' | 'photo' | 'policy_acknowledgment' | 'performance_review' | 'disciplinary' | 'other';
  name: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Timestamp;
  expiresAt?: Timestamp;
  isConfidential: boolean;
  accessRoles?: string[];
}

/**
 * Audit trail entry
 */
export interface EmployeeAuditEntry {
  id: string;
  action: 'created' | 'updated' | 'status_changed' | 'document_added' | 'document_removed' | 'access_modified';
  field?: string;
  oldValue?: any;
  newValue?: any;
  changedBy: string;
  changedAt: Timestamp;
  reason?: string;
  ipAddress?: string;
}

// ============================================
// Core Employee Entity
// ============================================

/**
 * Complete Employee Record
 */
/**
 * Per-subsidiary allocation for split employees. When present and
 * non-empty, this defines how the employee's gross pay (and statutory
 * costs) are attributed across subsidiaries for cost reporting and
 * subsidiary-scoped payroll batches. Allocation percents must sum to
 * 100. When the array is missing or empty, the employee is treated
 * as 100% on `subsidiaryId` (the primary).
 */
export interface SubsidiaryAllocation {
  subsidiaryId: SubsidiaryId | string;
  allocationPercent: number; // 0–100, the array must sum to 100
}

export interface Employee {
  // Identifiers
  id: EmployeeId;
  employeeNumber: EmployeeNumber;
  /** Primary subsidiary — administrative home, employee number prefix,
   *  default for single-tenant payroll. For split allocations, see
   *  `subsidiaryAllocations`. */
  subsidiaryId: SubsidiaryId;
  /** Optional split across subsidiaries. When set, payroll batches
   *  attribute each subsidiary's share separately. */
  subsidiaryAllocations?: SubsidiaryAllocation[];

  // Personal Information
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName?: string;
  preferredName?: string;
  dateOfBirth: Timestamp;
  gender: Gender;
  maritalStatus: MaritalStatus;
  nationality: string;
  religion?: string;
  photoUrl?: string;
  
  // Contact Information
  email: string;
  personalEmail?: string;
  phoneNumbers: PhoneNumber[];
  addresses: Address[];
  emergencyContacts: EmergencyContact[];
  
  // Identification
  nationalIds: NationalId[];
  
  // Employment Details
  employmentStatus: EmploymentStatus;
  employmentType: EmploymentType;
  position: EmployeePosition;
  employmentDates: EmploymentDates;
  workSchedule: WorkSchedule;
  
  // Statutory (Uganda)
  nssf?: NSSFDetails;
  tax: TaxDetails;
  localServiceTax: LocalServiceTax;
  
  // Financial
  bankAccounts: BankAccount[];
  mobileMoneyAccounts: MobileMoneyAccount[];
  preferredPaymentMethod: 'bank' | 'mobile_money' | 'cash' | 'check';
  
  // Professional Background
  education: Education[];
  certifications: Certification[];
  workExperience: WorkExperience[];
  skills: EmployeeSkill[];
  
  // Family
  dependents: Dependent[];
  
  // Leave
  leaveEntitlements: LeaveEntitlement;
  leaveBalance: LeaveBalance;
  
  // System Access
  systemAccess?: SystemAccess;
  
  // Documents
  documents: EmployeeDocument[];
  
  // Termination (if applicable)
  terminationReason?: TerminationReason;
  terminationNotes?: string;
  exitInterviewCompleted?: boolean;
  clearanceCompleted?: boolean;
  
  // Metadata
  tags?: string[];
  notes?: string;
  customFields?: Record<string, any>;
  
  // System fields
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  
  // Search optimization
  searchTerms: string[];
}

// ============================================
// Employee Summary (List View)
// ============================================

/**
 * Lightweight employee summary for lists
 */
export interface EmployeeSummary {
  id: EmployeeId;
  employeeNumber: EmployeeNumber;
  subsidiaryId: SubsidiaryId;
  /** Cost-split snapshot when the employee works across multiple
   *  subsidiaries. Lets payroll/PDF surfaces render the allocation
   *  footnote without re-fetching the full employee. */
  subsidiaryAllocations?: SubsidiaryAllocation[];

  // Display info
  fullName: string;
  photoUrl?: string;
  email: string;
  phone?: string;
  
  // Position
  title: string;
  departmentId: DepartmentId;
  departmentName?: string;
  reportingTo?: EmployeeId;
  reportingToName?: string;
  
  // Status
  employmentStatus: EmploymentStatus;
  employmentType: EmploymentType;
  
  // Dates
  joiningDate: Timestamp;
  yearsOfService: number;
  
  // Quick stats
  directReports: number;
  activeTaskCount: number;
  
  // System
  hasSystemAccess: boolean;
  lastLogin?: Timestamp;
  
  // Custom fields (including salary data)
  customFields?: Record<string, any>;
}

// ============================================
// Employee Creation/Update DTOs
// ============================================

/**
 * Employee creation input
 */
export interface CreateEmployeeInput {
  subsidiaryId: SubsidiaryId;
  
  // Personal (required)
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;  // ISO date
  gender: Gender;
  nationality: string;
  
  // Contact (required)
  email: string;
  phoneNumbers: Omit<PhoneNumber, 'isPrimary'>[];
  
  // Employment (required)
  employmentType: EmploymentType;
  position: {
    title: string;
    departmentId: DepartmentId;
    reportingTo?: EmployeeId;
    location: string;
    isManagement: boolean;
  };
  joiningDate: string;  // ISO date
  
  // Optional fields
  personalEmail?: string;
  maritalStatus?: MaritalStatus;
  religion?: string;
  photoUrl?: string;
  addresses?: Omit<Address, 'isPermanent' | 'isResidential'>[];
  emergencyContacts?: EmergencyContact[];
  nationalIds?: Omit<NationalId, 'documentUrl'>[];
  bankAccounts?: Omit<BankAccount, 'isVerified' | 'verifiedAt'>[];
  mobileMoneyAccounts?: Omit<MobileMoneyAccount, 'isVerified'>[];
  preferredPaymentMethod?: 'bank' | 'mobile_money' | 'cash' | 'check';
  
  // Statutory (Uganda)
  nssfNumber?: string;
  tinNumber?: string;
  
  // System access
  createSystemAccess?: boolean;
  accessRoles?: string[];
  
  // Notes
  notes?: string;
  customFields?: Record<string, any>;
}

/**
 * Employee update input (partial)
 */
export interface UpdateEmployeeInput {
  // Personal
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  religion?: string;
  photoUrl?: string;
  
  // Contact
  email?: string;
  personalEmail?: string;
  phoneNumbers?: PhoneNumber[];
  addresses?: Address[];
  emergencyContacts?: EmergencyContact[];
  
  // Identification
  nationalIds?: NationalId[];
  
  // Position (use separate action for transfers/promotions)
  workSchedule?: WorkSchedule;
  
  // Financial
  bankAccounts?: BankAccount[];
  mobileMoneyAccounts?: MobileMoneyAccount[];
  preferredPaymentMethod?: 'bank' | 'mobile_money' | 'cash' | 'check';
  
  // Professional
  education?: Education[];
  certifications?: Certification[];
  workExperience?: WorkExperience[];
  skills?: EmployeeSkill[];
  
  // Family
  dependents?: Dependent[];
  
  // Metadata
  tags?: string[];
  notes?: string;
  customFields?: Record<string, any>;
  
  // Reason for update (audit)
  updateReason?: string;
}

/**
 * Employee status change input
 */
export interface ChangeEmployeeStatusInput {
  employeeId: EmployeeId;
  newStatus: EmploymentStatus;
  effectiveDate: string;  // ISO date
  reason: string;
  
  // For termination
  terminationReason?: TerminationReason;
  lastWorkingDate?: string;
  exitInterviewDate?: string;
  
  // For suspension
  suspensionEndDate?: string;
  
  // For notice period
  noticePeriodDays?: number;
  
  notes?: string;
}

/**
 * Employee transfer/promotion input
 */
export interface TransferEmployeeInput {
  employeeId: EmployeeId;
  transferType: 'promotion' | 'lateral_move' | 'demotion' | 'relocation';
  effectiveDate: string;  // ISO date
  
  // New position details
  newTitle?: string;
  newDepartmentId?: DepartmentId;
  newSubsidiaryId?: SubsidiaryId;
  newReportingTo?: EmployeeId;
  newLocation?: string;
  newGradeLevel?: string;
  
  // Associated changes
  salaryChange?: {
    newBaseSalary: number;
    changeReason: string;
  };
  
  reason: string;
  notes?: string;
}

// ============================================
// Query & Filter Types
// ============================================

/**
 * Employee list filters
 */
export interface EmployeeFilters {
  subsidiaryIds?: SubsidiaryId[];
  departmentIds?: DepartmentId[];
  employmentStatuses?: EmploymentStatus[];
  employmentTypes?: EmploymentType[];
  reportingTo?: EmployeeId;
  hasSystemAccess?: boolean;
  isManagement?: boolean;
  joinedAfter?: string;   // ISO date
  joinedBefore?: string;  // ISO date
  searchQuery?: string;   // Name, email, employee number
  tags?: string[];
}

/**
 * Employee sort options
 */
export interface EmployeeSort {
  field: 'fullName' | 'employeeNumber' | 'joiningDate' | 'department' | 'title' | 'status';
  direction: 'asc' | 'desc';
}

/**
 * Employee list result
 */
export interface EmployeeListResult {
  employees: EmployeeSummary[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  hasMore: boolean;
  filters: EmployeeFilters;
  sort: EmployeeSort;
}

// ============================================
// Analytics Types
// ============================================

/**
 * Employee statistics
 */
export interface EmployeeStats {
  totalEmployees: number;
  byStatus: Record<EmploymentStatus, number>;
  byType: Record<EmploymentType, number>;
  byDepartment: Record<DepartmentId, number>;
  bySubsidiary: Record<SubsidiaryId, number>;
  avgTenureYears: number;
  turnoverRate: number;  // Last 12 months
  newHiresCount: number; // Last 30 days
  exitCount: number;     // Last 30 days
  genderDistribution: Record<Gender, number>;
  ageDistribution: {
    under25: number;
    age25to34: number;
    age35to44: number;
    age45to54: number;
    age55plus: number;
  };
}

/**
 * Department headcount
 */
export interface DepartmentHeadcount {
  departmentId: DepartmentId;
  departmentName: string;
  totalCount: number;
  activeCount: number;
  vacancies: number;
  budgetedCount: number;
}
