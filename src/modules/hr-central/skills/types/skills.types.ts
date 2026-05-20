// ============================================================================
// SKILLS & TRAINING TYPES
// DawinOS v2.0 - HR Module
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  SkillLevel,
  SkillCategory,
  TrainingType,
  TrainingStatus,
  CertificationStatus,
  GapPriority,
} from '../constants/skills.constants';

// ----------------------------------------------------------------------------
// SKILL DEFINITION
// ----------------------------------------------------------------------------

export interface Skill {
  id: string;
  companyId: string;
  name: string;
  description: string;
  category: SkillCategory;
  isCore: boolean;
  relatedSkills?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// EMPLOYEE SKILL RECORD
// ----------------------------------------------------------------------------

export interface EmployeeSkillRecord {
  id: string;
  companyId: string;
  employeeId: string;
  skillId: string;
  skillName: string;
  category: SkillCategory;
  
  // Assessment
  selfAssessedLevel: SkillLevel;
  managerAssessedLevel?: SkillLevel;
  verifiedLevel?: SkillLevel;
  
  // Evidence
  yearsExperience?: number;
  lastUsedDate?: Date;
  certificationIds?: string[];
  projectEvidence?: string[];
  
  // Metadata
  assessedAt: Timestamp;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// SKILL REQUIREMENT FOR POSITION
// ----------------------------------------------------------------------------

export interface SkillRequirementItem {
  skillId: string;
  skillName: string;
  minimumLevel: SkillLevel;
  isRequired: boolean;
  weight: number;
}

export interface SkillRequirement {
  id: string;
  companyId: string;
  positionId: string;
  positionTitle: string;
  departmentId: string;
  
  requiredSkills: SkillRequirementItem[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// SKILL GAP ANALYSIS
// ----------------------------------------------------------------------------

export interface SkillGap {
  skillId: string;
  skillName: string;
  requiredLevel: SkillLevel;
  currentLevel: SkillLevel | null;
  gapSize: number;
  priority: GapPriority;
  recommendedTraining?: string[];
}

export interface SkillGapAnalysis {
  employeeId: string;
  employeeName: string;
  positionId: string;
  positionTitle: string;
  
  analysisDate: Date;
  
  gaps: SkillGap[];
  
  overallReadiness: number;
  criticalGapsCount: number;
  developmentPriorities: string[];
}

// ----------------------------------------------------------------------------
// TRAINING PROGRAM
// ----------------------------------------------------------------------------

export interface TrainingSkillCoverage {
  skillId: string;
  skillName: string;
  levelAchievable: SkillLevel;
}

export interface TrainingProgram {
  id: string;
  companyId: string;
  
  // Details
  title: string;
  description: string;
  type: TrainingType;
  
  // Provider
  provider: string;
  providerContact?: string;
  location?: string;
  isOnline: boolean;
  
  // Schedule
  startDate: Date;
  endDate: Date;
  durationHours: number;
  schedule?: string;
  
  // Capacity
  maxParticipants?: number;
  enrolledCount: number;
  
  // Cost
  costPerPerson: number;
  currency: string;
  budgetCode?: string;
  
  // Skills addressed
  skillsCovered: TrainingSkillCoverage[];
  
  // Requirements
  prerequisites?: string[];
  targetAudience?: string;
  
  // Materials
  materials?: string[];
  certificateProvided: boolean;
  
  // Status
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// TRAINING ENROLLMENT
// ----------------------------------------------------------------------------

export interface TrainingFeedback {
  rating: number;
  comments: string;
  submittedAt: Timestamp;
}

export interface TrainingEnrollment {
  id: string;
  companyId: string;
  
  // References
  programId: string;
  programTitle: string;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  
  // Enrollment
  enrolledAt: Timestamp;
  enrolledBy: string;
  
  // Status
  status: TrainingStatus;
  
  // Approval
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  
  // Completion
  attendancePercent?: number;
  completionDate?: Date;
  score?: number;
  passed?: boolean;
  certificateId?: string;
  
  // Feedback
  feedback?: TrainingFeedback;
  
  // Cost
  costToCompany: number;
  
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// CERTIFICATION
// ----------------------------------------------------------------------------

export interface SkillCertification {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  
  // Certificate details
  name: string;
  issuingBody: string;
  credentialId?: string;
  
  // Dates
  issueDate: Date;
  expiryDate?: Date;
  
  // Status
  status: CertificationStatus;
  
  // Verification
  verificationUrl?: string;
  documentUrl?: string;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  
  // Related
  trainingId?: string;
  skillIds?: string[];
  
  // Renewal
  renewalRequired: boolean;
  renewalCost?: number;
  renewalNotes?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// TRAINING BUDGET
// ----------------------------------------------------------------------------

export interface TrainingBudget {
  id: string;
  companyId: string;
  fiscalYear: string;
  departmentId?: string;
  departmentName?: string;
  
  allocatedBudget: number;
  spentAmount: number;
  committedAmount: number;
  remainingBudget: number;
  
  currency: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// FILTERS
// ----------------------------------------------------------------------------

export interface SkillFilters {
  category?: SkillCategory;
  isCore?: boolean;
  search?: string;
}

export interface TrainingProgramFilters {
  type?: TrainingType;
  status?: TrainingProgram['status'];
  startAfter?: Date;
  startBefore?: Date;
  skillId?: string;
}

export interface EnrollmentFilters {
  employeeId?: string;
  programId?: string;
  departmentId?: string;
  status?: TrainingStatus;
}

export interface CertificationFilters {
  employeeId?: string;
  status?: CertificationStatus;
  issuingBody?: string;
  expiringWithinDays?: number;
}
