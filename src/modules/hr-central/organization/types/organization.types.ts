// ============================================================================
// ORGANIZATION TYPES - DawinOS HR Central
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  DepartmentStatus,
  DepartmentType,
  PositionStatus,
  PositionType,
  JobGrade,
  ReportingType,
  OrgChangeType,
  CostCenterType,
  WorkLocation,
  TravelRequired,
} from '../constants/organization.constants';

// ----------------------------------------------------------------------------
// Department
// ----------------------------------------------------------------------------
export interface Department {
  id: string;
  companyId: string;
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  type: DepartmentType;
  status: DepartmentStatus;
  statusChangedAt?: Timestamp;
  statusChangedBy?: string;
  statusReason?: string;
  parentId: string | null;
  path: string[];
  pathNames: string[];
  level: number;
  sortOrder: number;
  headId?: string;
  headName?: string;
  headPositionId?: string;
  deputyHeadId?: string;
  deputyHeadName?: string;
  email?: string;
  phone?: string;
  location?: string;
  building?: string;
  floor?: string;
  costCenterId?: string;
  budgetCode?: string;
  annualBudget?: number;
  approvedHeadcount: number;
  currentHeadcount: number;
  vacantPositions: number;
  frozenPositions: number;
  establishedDate?: Timestamp;
  effectiveFrom: Timestamp;
  effectiveUntil?: Timestamp;
  color?: string;
  icon?: string;
  showInOrgChart: boolean;
  expandedByDefault: boolean;
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  mergedIntoId?: string;
  mergedFromIds?: string[];
  dissolvedReason?: string;
}

// ----------------------------------------------------------------------------
// Position
// ----------------------------------------------------------------------------
export interface Position {
  id: string;
  companyId: string;
  departmentId: string;
  departmentName?: string;
  code: string;
  title: string;
  shortTitle?: string;
  description?: string;
  type: PositionType;
  status: PositionStatus;
  statusChangedAt?: Timestamp;
  statusChangedBy?: string;
  statusReason?: string;
  jobGrade: JobGrade;
  jobFamilyId?: string;
  jobFamilyName?: string;
  jobFamilyLevel?: number;
  reportsToPositionId?: string;
  reportsToPositionTitle?: string;
  reportsToEmployeeId?: string;
  reportsToEmployeeName?: string;
  reportingType: ReportingType;
  headcount: number;
  filledCount: number;
  salaryGradeMin: number;
  salaryGradeMax: number;
  salaryMidpoint: number;
  allowances?: PositionAllowances;
  minEducation?: string;
  minExperience?: number;
  requiredSkills?: string[];
  preferredSkills?: string[];
  certifications?: string[];
  workLocation?: WorkLocation;
  travelRequired?: TravelRequired;
  workingHours?: string;
  incumbents: PositionIncumbent[];
  establishedDate?: Timestamp;
  effectiveFrom: Timestamp;
  effectiveUntil?: Timestamp;
  frozenUntil?: Timestamp;
  showInOrgChart: boolean;
  sortOrder: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface PositionAllowances {
  housing?: number;
  transport?: number;
  lunch?: number;
  communication?: number;
  medical?: number;
  other?: number;
}

export interface PositionIncumbent {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  assignedDate: Timestamp;
  assignedBy: string;
  isPrimary: boolean;
  fte: number;
  endDate?: Timestamp;
  endReason?: string;
}

// ----------------------------------------------------------------------------
// Reporting Line
// ----------------------------------------------------------------------------
export interface ReportingLine {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  employeePositionId?: string;
  employeePositionTitle?: string;
  managerId: string;
  managerName: string;
  managerNumber: string;
  managerPositionId?: string;
  managerPositionTitle?: string;
  reportingType: ReportingType;
  isPrimary: boolean;
  effectiveFrom: Timestamp;
  effectiveUntil?: Timestamp;
  reason?: string;
  projectId?: string;
  projectName?: string;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ----------------------------------------------------------------------------
// Cost Center
// ----------------------------------------------------------------------------
export interface CostCenter {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  type: CostCenterType;
  parentId?: string;
  path: string[];
  level: number;
  managerId?: string;
  managerName?: string;
  departmentIds: string[];
  budgetAmount?: number;
  currency: string;
  fiscalYear: number;
  isActive: boolean;
  effectiveFrom: Timestamp;
  effectiveUntil?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ----------------------------------------------------------------------------
// Job Family
// ----------------------------------------------------------------------------
export interface JobFamily {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  levels: JobFamilyLevel[];
  applicableGrades: JobGrade[];
  coreCompetencies: string[];
  isActive: boolean;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface JobFamilyLevel {
  level: number;
  name: string;
  grade: JobGrade;
  typicalYearsExperience: number;
  competencies: string[];
  nextLevelId?: string;
}

// ----------------------------------------------------------------------------
// Organization Change (Audit Trail)
// ----------------------------------------------------------------------------
export interface OrganizationChange {
  id: string;
  companyId: string;
  changeType: OrgChangeType;
  entityType: 'department' | 'position' | 'reporting_line' | 'employee';
  entityId: string;
  entityName?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityName?: string;
  effectiveDate: Timestamp;
  approvalRequired: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
}

// ----------------------------------------------------------------------------
// Org Chart Types
// ----------------------------------------------------------------------------
export interface OrgChartNode {
  id: string;
  type: 'department' | 'position' | 'employee';
  name: string;
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  color?: string;
  departmentId?: string;
  positionId?: string;
  employeeId?: string;
  parentId: string | null;
  children: OrgChartNode[];
  level: number;
  directReports?: number;
  totalReports?: number;
  vacancies?: number;
  isExpanded: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

export type OrgChartViewMode = 'department' | 'position' | 'employee';
export type OrgChartLayout = 'vertical' | 'horizontal' | 'radial';

export interface OrgChartConfig {
  viewMode: OrgChartViewMode;
  maxDepth?: number;
  showVacant: boolean;
  showHeadcount: boolean;
  colorByDepartment: boolean;
  layout: OrgChartLayout;
  rootDepartmentId?: string;
  rootPositionId?: string;
  rootEmployeeId?: string;
}

// ----------------------------------------------------------------------------
// Team Summary
// ----------------------------------------------------------------------------
export interface TeamSummary {
  managerId: string;
  managerName: string;
  managerPosition?: string;
  managerGrade?: JobGrade;
  directReports: DirectReport[];
  totalDirectReports: number;
  totalIndirectReports: number;
  departmentBreakdown: DepartmentBreakdown[];
  gradeBreakdown: GradeBreakdown[];
  spanOfControl: number;
  isHealthySpan: boolean;
  spanGuideline: { min: number; max: number; ideal: number };
}

export interface DirectReport {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  positionId?: string;
  positionTitle?: string;
  departmentId?: string;
  departmentName?: string;
  jobGrade?: JobGrade;
  reportingType: ReportingType;
  startDate: Timestamp;
  photoUrl?: string;
  directReportsCount: number;
}

export interface DepartmentBreakdown {
  departmentId: string;
  departmentName: string;
  count: number;
}

export interface GradeBreakdown {
  grade: JobGrade;
  count: number;
}

// ----------------------------------------------------------------------------
// Headcount Summary
// ----------------------------------------------------------------------------
export interface HeadcountSummary {
  approved: number;
  filled: number;
  vacant: number;
  frozen: number;
  fillRate: number;
  vacancyRate: number;
}

// ----------------------------------------------------------------------------
// Input Types
// ----------------------------------------------------------------------------
export interface CreateDepartmentInput {
  code?: string;
  name: string;
  shortName?: string;
  description?: string;
  type: DepartmentType;
  parentId?: string | null;
  headId?: string;
  email?: string;
  phone?: string;
  location?: string;
  costCenterId?: string;
  budgetCode?: string;
  approvedHeadcount?: number;
  establishedDate?: Date;
  effectiveFrom?: Date;
  color?: string;
  icon?: string;
  showInOrgChart?: boolean;
  tags?: string[];
  notes?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  shortName?: string;
  description?: string;
  type?: DepartmentType;
  parentId?: string | null;
  headId?: string;
  email?: string;
  phone?: string;
  location?: string;
  building?: string;
  floor?: string;
  costCenterId?: string;
  budgetCode?: string;
  annualBudget?: number;
  approvedHeadcount?: number;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  color?: string;
  icon?: string;
  showInOrgChart?: boolean;
  expandedByDefault?: boolean;
  tags?: string[];
  notes?: string;
}

export interface MergeDepartmentsInput {
  sourceDepartmentIds: string[];
  targetDepartmentId: string;
  newName?: string;
  effectiveDate: Date;
  reason: string;
  transferEmployees?: boolean;
  reassignPositions?: boolean;
}

export interface DissolveDepartmentInput {
  departmentId: string;
  targetDepartmentId?: string;
  effectiveDate: Date;
  reason: string;
  handleEmployees?: 'transfer' | 'terminate' | 'manual';
}

export interface CreatePositionInput {
  code?: string;
  title: string;
  shortTitle?: string;
  description?: string;
  departmentId: string;
  type: PositionType;
  jobGrade: JobGrade;
  jobFamilyId?: string;
  reportsToPositionId?: string;
  reportingType?: ReportingType;
  headcount?: number;
  salaryGradeMin?: number;
  salaryGradeMax?: number;
  allowances?: PositionAllowances;
  minEducation?: string;
  minExperience?: number;
  requiredSkills?: string[];
  preferredSkills?: string[];
  certifications?: string[];
  workLocation?: WorkLocation;
  travelRequired?: TravelRequired;
  workingHours?: string;
  effectiveFrom?: Date;
  showInOrgChart?: boolean;
  tags?: string[];
  notes?: string;
}

export interface UpdatePositionInput {
  title?: string;
  shortTitle?: string;
  description?: string;
  departmentId?: string;
  type?: PositionType;
  jobGrade?: JobGrade;
  jobFamilyId?: string;
  reportsToPositionId?: string;
  reportingType?: ReportingType;
  headcount?: number;
  salaryGradeMin?: number;
  salaryGradeMax?: number;
  allowances?: PositionAllowances;
  minEducation?: string;
  minExperience?: number;
  requiredSkills?: string[];
  preferredSkills?: string[];
  certifications?: string[];
  workLocation?: WorkLocation;
  travelRequired?: TravelRequired;
  workingHours?: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  frozenUntil?: Date;
  showInOrgChart?: boolean;
  sortOrder?: number;
  tags?: string[];
  notes?: string;
}

export interface FreezePositionInput {
  positionId: string;
  frozenUntil?: Date;
  reason: string;
}

export interface AssignEmployeeInput {
  positionId: string;
  employeeId: string;
  isPrimary?: boolean;
  fte?: number;
  assignedDate?: Date;
}

export interface RemoveEmployeeInput {
  positionId: string;
  employeeId: string;
  endDate?: Date;
  reason?: string;
}

export interface TransferEmployeeInput {
  employeeId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  toPositionId?: string;
  effectiveDate: Date;
  reason: string;
  retainReporting?: boolean;
}

export interface ChangeReportingInput {
  employeeId: string;
  newManagerId: string;
  reportingType: ReportingType;
  effectiveDate: Date;
  reason?: string;
  endPreviousReporting?: boolean;
  projectId?: string;
}

export interface CreateReportingLineInput {
  employeeId: string;
  managerId: string;
  reportingType: ReportingType;
  isPrimary?: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  projectId?: string;
  reason?: string;
  notes?: string;
}

export interface CreateCostCenterInput {
  code: string;
  name: string;
  description?: string;
  type: CostCenterType;
  parentId?: string;
  managerId?: string;
  departmentIds?: string[];
  budgetAmount?: number;
  currency?: string;
  fiscalYear: number;
  effectiveFrom?: Date;
}

export interface CreateJobFamilyInput {
  code: string;
  name: string;
  description?: string;
  levels: JobFamilyLevel[];
  applicableGrades: JobGrade[];
  coreCompetencies: string[];
}

// ----------------------------------------------------------------------------
// Filter Types
// ----------------------------------------------------------------------------
export interface DepartmentFilters {
  companyId: string;
  status?: DepartmentStatus | DepartmentStatus[];
  type?: DepartmentType | DepartmentType[];
  parentId?: string | null;
  headId?: string;
  costCenterId?: string;
  showInOrgChart?: boolean;
  search?: string;
  includeInactive?: boolean;
}

export interface PositionFilters {
  companyId: string;
  departmentId?: string;
  status?: PositionStatus | PositionStatus[];
  type?: PositionType | PositionType[];
  jobGrade?: JobGrade | JobGrade[];
  reportsToPositionId?: string;
  hasVacancies?: boolean;
  showInOrgChart?: boolean;
  search?: string;
  includeDiscontinued?: boolean;
}

export interface ReportingLineFilters {
  companyId: string;
  employeeId?: string;
  managerId?: string;
  reportingType?: ReportingType | ReportingType[];
  isPrimary?: boolean;
  isActive?: boolean;
  projectId?: string;
}

export interface OrgChangeFilters {
  companyId: string;
  changeType?: OrgChangeType | OrgChangeType[];
  entityType?: OrganizationChange['entityType'];
  entityId?: string;
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  approvalStatus?: OrganizationChange['approvalStatus'];
}

// ----------------------------------------------------------------------------
// Headcount Update Input
// ----------------------------------------------------------------------------
export interface HeadcountUpdateInput {
  approved?: number;
  current?: number;
  vacant?: number;
  frozen?: number;
}

// ----------------------------------------------------------------------------
// Employee Reference (minimal employee info used in org services)
// ----------------------------------------------------------------------------
export interface EmployeeReference {
  id: string;
  employeeNumber: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  positionId?: string;
  positionTitle?: string;
  departmentId?: string;
  departmentName?: string;
  jobGrade?: JobGrade;
  managerId?: string;
  managerName?: string;
  photoUrl?: string;
  status?: string;
}
