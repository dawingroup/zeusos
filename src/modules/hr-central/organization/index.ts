// ============================================================================
// ORGANIZATION MODULE - DawinOS HR Central
// Main export file for organization structure management
// ============================================================================

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
export {
  // Department Status
  DEPARTMENT_STATUS,
  DEPARTMENT_STATUS_LABELS,
  DEPARTMENT_STATUS_COLORS,
  // Department Types
  DEPARTMENT_TYPE,
  DEPARTMENT_TYPE_LABELS,
  // Position Status
  POSITION_STATUS,
  POSITION_STATUS_LABELS,
  POSITION_STATUS_COLORS,
  // Position Types
  POSITION_TYPE,
  POSITION_TYPE_LABELS,
  // Job Grades
  JOB_GRADE,
  JOB_GRADE_DETAILS,
  JOB_GRADES_SORTED,
  // Reporting Types
  REPORTING_TYPE,
  REPORTING_TYPE_LABELS,
  // Organization Change Types
  ORG_CHANGE_TYPE,
  // Cost Center Types
  COST_CENTER_TYPE,
  COST_CENTER_TYPE_LABELS,
  // Span of Control
  SPAN_OF_CONTROL_GUIDELINES,
  MAX_HIERARCHY_DEPTH,
  // Collections
  ORG_COLLECTIONS,
  // Standard Data
  STANDARD_DEPARTMENTS,
  UGANDA_BRANCHES,
  // Work Location
  WORK_LOCATION,
  WORK_LOCATION_LABELS,
  // Travel Required
  TRAVEL_REQUIRED,
  TRAVEL_REQUIRED_LABELS,
  // Education Levels
  EDUCATION_LEVEL,
  EDUCATION_LEVEL_LABELS,
} from './constants/organization.constants';

export type {
  DepartmentStatus,
  DepartmentType,
  PositionStatus,
  PositionType,
  JobGrade,
  JobLevel,
  JobGradeDetails,
  ReportingType,
  OrgChangeType,
  CostCenterType,
  UgandaBranchCode,
  WorkLocation,
  TravelRequired,
  EducationLevel,
} from './constants/organization.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export type {
  // Department
  Department,
  // Position
  Position,
  PositionAllowances,
  PositionIncumbent,
  // Reporting Line
  ReportingLine,
  // Cost Center
  CostCenter,
  // Job Family
  JobFamily,
  JobFamilyLevel,
  // Organization Change
  OrganizationChange,
  // Org Chart
  OrgChartNode,
  OrgChartConfig,
  OrgChartViewMode,
  OrgChartLayout,
  // Team Summary
  TeamSummary,
  DirectReport,
  DepartmentBreakdown,
  GradeBreakdown,
  // Headcount
  HeadcountSummary,
  // Input Types
  CreateDepartmentInput,
  UpdateDepartmentInput,
  MergeDepartmentsInput,
  DissolveDepartmentInput,
  CreatePositionInput,
  UpdatePositionInput,
  FreezePositionInput,
  AssignEmployeeInput,
  RemoveEmployeeInput,
  TransferEmployeeInput,
  ChangeReportingInput,
  CreateReportingLineInput,
  CreateCostCenterInput,
  CreateJobFamilyInput,
  // Filter Types
  DepartmentFilters,
  PositionFilters,
  ReportingLineFilters,
  OrgChangeFilters,
  // Other Types
  HeadcountUpdateInput,
  EmployeeReference,
} from './types/organization.types';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------
export {
  // Department Schemas
  createDepartmentSchema,
  updateDepartmentSchema,
  mergeDepartmentsSchema,
  dissolveDepartmentSchema,
  changeDepartmentStatusSchema,
  // Position Schemas
  createPositionSchema,
  updatePositionSchema,
  freezePositionSchema,
  changePositionStatusSchema,
  // Employee Assignment Schemas
  assignEmployeeSchema,
  removeEmployeeSchema,
  transferEmployeeSchema,
  // Reporting Line Schemas
  changeReportingSchema,
  createReportingLineSchema,
  endReportingLineSchema,
  // Cost Center Schemas
  createCostCenterSchema,
  updateCostCenterSchema,
  // Job Family Schemas
  createJobFamilySchema,
  jobFamilyLevelSchema,
  // Filter Schemas
  departmentFiltersSchema,
  positionFiltersSchema,
  // Validation Functions
  validateCreateDepartment,
  validateUpdateDepartment,
  validateCreatePosition,
  validateUpdatePosition,
  validateAssignEmployee,
  validateTransferEmployee,
  validateChangeReporting,
  validateCreateCostCenter,
  validateCreateJobFamily,
} from './schemas/organization.schemas';

export type {
  CreateDepartmentSchemaType,
  UpdateDepartmentSchemaType,
  MergeDepartmentsSchemaType,
  DissolveDepartmentSchemaType,
  CreatePositionSchemaType,
  UpdatePositionSchemaType,
  FreezePositionSchemaType,
  AssignEmployeeSchemaType,
  RemoveEmployeeSchemaType,
  TransferEmployeeSchemaType,
  ChangeReportingSchemaType,
  CreateReportingLineSchemaType,
  CreateCostCenterSchemaType,
  CreateJobFamilySchemaType,
} from './schemas/organization.schemas';

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------
export {
  // Code Generation
  generateDepartmentCode,
  generatePositionCode,
  generateCostCenterCode,
  // Job Grade Utilities
  getJobGradeDetails,
  compareJobGrades,
  isGradeSenior,
  isGradeEqual,
  canSupervise,
  getSalaryMidpoint,
  getSalaryRange,
  getGradesByLevel,
  getNextGrade,
  getPreviousGrade,
  getGradeLevel,
  getGradeLevelOrder,
  formatSalaryRange,
  formatSalary,
  // Hierarchy Utilities
  buildDepartmentPath,
  buildDepartmentPathNames,
  validateHierarchyDepth,
  getHierarchyLevel,
  hasCircularDependency,
  getDescendantDepartments,
  getAncestorDepartments,
  buildDepartmentTree,
  flattenDepartmentTree,
  // Org Chart Utilities
  buildOrgChartFromDepartments,
  buildOrgChartFromPositions,
  buildOrgChartFromEmployees,
  findNodeById,
  searchOrgChartNodes,
  // Reporting Utilities
  calculateSpanOfControl,
  isSpanOfControlHealthy,
  getSpanOfControlGuideline,
  getReportingChain,
  getAllReports,
  getDirectReportsCount,
  // Headcount Utilities
  calculateHeadcountSummary,
  aggregateHeadcount,
  calculateVacancyRate,
  // Formatting Utilities
  formatDepartmentPath,
  getInitials,
  formatPositionWithGrade,
  formatHeadcount,
  formatFillRate,
  // Validation Utilities
  canDeleteDepartment,
  canDeletePosition,
  canMergeDepartments,
  validateManagerAssignment,
  validatePositionHeadcount,
  // Sorting Utilities
  sortDepartmentsByHierarchy,
  sortPositionsByGrade,
  // Statistics Utilities
  calculateGradeDistribution,
  calculateDepartmentTypeDistribution,
} from './utils/organization.utils';

export type { DepartmentWithChildren } from './utils/organization.utils';

// ----------------------------------------------------------------------------
// Services
// ----------------------------------------------------------------------------
export { departmentService } from './services/department.service';
export { positionService } from './services/position.service';
export { reportingLineService } from './services/reporting-line.service';

// ----------------------------------------------------------------------------
// React Hooks
// ----------------------------------------------------------------------------
export {
  useDepartments,
  useDepartment,
  usePositions,
  usePosition,
  useOrgChart,
  useTeamSummary,
  useReportingChain,
  useDirectReports,
  useVacantPositions,
  useMyTeam,
} from './hooks/useOrganization';
