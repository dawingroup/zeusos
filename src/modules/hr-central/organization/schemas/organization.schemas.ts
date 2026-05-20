// ============================================================================
// ORGANIZATION SCHEMAS - DawinOS HR Central
// Zod validation schemas for organization structure
// ============================================================================

import { z } from 'zod';
import {
  DEPARTMENT_STATUS,
  DEPARTMENT_TYPE,
  POSITION_STATUS,
  POSITION_TYPE,
  JOB_GRADE,
  REPORTING_TYPE,
  COST_CENTER_TYPE,
  WORK_LOCATION,
  TRAVEL_REQUIRED,
} from '../constants/organization.constants';

// ----------------------------------------------------------------------------
// Common Schemas
// ----------------------------------------------------------------------------
const codeSchema = z.string().min(2).max(20).regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, or hyphens');
const nameSchema = z.string().min(2).max(100).trim();
const descriptionSchema = z.string().max(2000).optional();
const tagsSchema = z.array(z.string().max(50)).max(20).optional();
const notesSchema = z.string().max(2000).optional();
const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional();

// ----------------------------------------------------------------------------
// Department Schemas
// ----------------------------------------------------------------------------
export const createDepartmentSchema = z.object({
  code: codeSchema.optional(),
  name: nameSchema,
  shortName: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  type: z.enum([
    DEPARTMENT_TYPE.EXECUTIVE,
    DEPARTMENT_TYPE.CORPORATE,
    DEPARTMENT_TYPE.OPERATIONAL,
    DEPARTMENT_TYPE.SUPPORT,
    DEPARTMENT_TYPE.BRANCH,
    DEPARTMENT_TYPE.PROJECT,
    DEPARTMENT_TYPE.VIRTUAL,
  ], { message: 'Invalid department type' }),
  parentId: z.string().nullable().optional(),
  headId: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  costCenterId: z.string().optional(),
  budgetCode: z.string().max(20).optional(),
  approvedHeadcount: z.number().int().min(0).max(10000).optional().default(0),
  establishedDate: z.date().optional(),
  effectiveFrom: z.date().optional(),
  color: colorSchema,
  icon: z.string().max(50).optional(),
  showInOrgChart: z.boolean().optional().default(true),
  tags: tagsSchema,
  notes: notesSchema,
});

export const updateDepartmentSchema = z.object({
  name: nameSchema.optional(),
  shortName: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum([
    DEPARTMENT_TYPE.EXECUTIVE,
    DEPARTMENT_TYPE.CORPORATE,
    DEPARTMENT_TYPE.OPERATIONAL,
    DEPARTMENT_TYPE.SUPPORT,
    DEPARTMENT_TYPE.BRANCH,
    DEPARTMENT_TYPE.PROJECT,
    DEPARTMENT_TYPE.VIRTUAL,
  ]).optional(),
  parentId: z.string().nullable().optional(),
  headId: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().max(20).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  building: z.string().max(50).optional().nullable(),
  floor: z.string().max(20).optional().nullable(),
  costCenterId: z.string().optional().nullable(),
  budgetCode: z.string().max(20).optional().nullable(),
  annualBudget: z.number().min(0).optional().nullable(),
  approvedHeadcount: z.number().int().min(0).max(10000).optional(),
  effectiveFrom: z.date().optional(),
  effectiveUntil: z.date().optional().nullable(),
  color: colorSchema.nullable(),
  icon: z.string().max(50).optional().nullable(),
  showInOrgChart: z.boolean().optional(),
  expandedByDefault: z.boolean().optional(),
  tags: tagsSchema.nullable(),
  notes: notesSchema.nullable(),
});

export const mergeDepartmentsSchema = z.object({
  sourceDepartmentIds: z.array(z.string()).min(1, 'At least one source department required').max(10),
  targetDepartmentId: z.string().min(1, 'Target department is required'),
  newName: nameSchema.optional(),
  effectiveDate: z.date(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  transferEmployees: z.boolean().default(true),
  reassignPositions: z.boolean().default(true),
});

export const dissolveDepartmentSchema = z.object({
  departmentId: z.string().min(1, 'Department ID is required'),
  targetDepartmentId: z.string().optional(),
  effectiveDate: z.date(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  handleEmployees: z.enum(['transfer', 'terminate', 'manual'], { message: 'Invalid employee handling option' }).default('transfer'),
});

export const changeDepartmentStatusSchema = z.object({
  departmentId: z.string().min(1, 'Department ID is required'),
  status: z.enum([
    DEPARTMENT_STATUS.ACTIVE,
    DEPARTMENT_STATUS.INACTIVE,
    DEPARTMENT_STATUS.RESTRUCTURING,
    DEPARTMENT_STATUS.MERGED,
    DEPARTMENT_STATUS.DISSOLVED,
  ], { message: 'Invalid department status' }),
  reason: z.string().min(5, 'Reason is required').max(500),
  effectiveDate: z.date().optional(),
});

// ----------------------------------------------------------------------------
// Position Schemas
// ----------------------------------------------------------------------------
export const createPositionSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Z0-9-]+$/).optional(),
  title: nameSchema,
  shortTitle: z.string().max(50).optional(),
  description: descriptionSchema,
  departmentId: z.string().min(1, 'Department is required'),
  type: z.enum([
    POSITION_TYPE.PERMANENT,
    POSITION_TYPE.CONTRACT,
    POSITION_TYPE.TEMPORARY,
    POSITION_TYPE.INTERNSHIP,
    POSITION_TYPE.CONSULTANT,
  ], { message: 'Invalid position type' }),
  jobGrade: z.enum([
    JOB_GRADE.E1, JOB_GRADE.E2,
    JOB_GRADE.M1, JOB_GRADE.M2, JOB_GRADE.M3,
    JOB_GRADE.S1, JOB_GRADE.S2,
    JOB_GRADE.O1, JOB_GRADE.O2, JOB_GRADE.O3,
    JOB_GRADE.A1, JOB_GRADE.A2,
  ], { message: 'Invalid job grade' }),
  jobFamilyId: z.string().optional(),
  reportsToPositionId: z.string().optional(),
  reportingType: z.enum([
    REPORTING_TYPE.DIRECT,
    REPORTING_TYPE.DOTTED,
    REPORTING_TYPE.FUNCTIONAL,
    REPORTING_TYPE.PROJECT,
  ]).optional().default(REPORTING_TYPE.DIRECT),
  headcount: z.number().int().min(1, 'Headcount must be at least 1').max(100).optional().default(1),
  salaryGradeMin: z.number().min(0).optional(),
  salaryGradeMax: z.number().min(0).optional(),
  allowances: z.object({
    housing: z.number().min(0).optional(),
    transport: z.number().min(0).optional(),
    lunch: z.number().min(0).optional(),
    communication: z.number().min(0).optional(),
    medical: z.number().min(0).optional(),
    other: z.number().min(0).optional(),
  }).optional(),
  minEducation: z.string().max(100).optional(),
  minExperience: z.number().int().min(0).max(50).optional(),
  requiredSkills: z.array(z.string().max(100)).max(20).optional(),
  preferredSkills: z.array(z.string().max(100)).max(20).optional(),
  certifications: z.array(z.string().max(100)).max(10).optional(),
  workLocation: z.enum([
    WORK_LOCATION.OFFICE,
    WORK_LOCATION.REMOTE,
    WORK_LOCATION.HYBRID,
    WORK_LOCATION.FIELD,
  ]).optional(),
  travelRequired: z.enum([
    TRAVEL_REQUIRED.NONE,
    TRAVEL_REQUIRED.OCCASIONAL,
    TRAVEL_REQUIRED.FREQUENT,
    TRAVEL_REQUIRED.EXTENSIVE,
  ]).optional(),
  workingHours: z.string().max(50).optional(),
  effectiveFrom: z.date().optional(),
  showInOrgChart: z.boolean().optional().default(true),
  tags: tagsSchema,
  notes: notesSchema,
}).refine(
  (data) => {
    if (data.salaryGradeMin !== undefined && data.salaryGradeMax !== undefined) {
      return data.salaryGradeMin <= data.salaryGradeMax;
    }
    return true;
  },
  { message: 'Minimum salary must be less than or equal to maximum salary', path: ['salaryGradeMin'] }
);

export const updatePositionSchema = z.object({
  title: nameSchema.optional(),
  shortTitle: z.string().max(50).optional().nullable(),
  description: descriptionSchema.nullable(),
  departmentId: z.string().optional(),
  type: z.enum([
    POSITION_TYPE.PERMANENT,
    POSITION_TYPE.CONTRACT,
    POSITION_TYPE.TEMPORARY,
    POSITION_TYPE.INTERNSHIP,
    POSITION_TYPE.CONSULTANT,
  ]).optional(),
  jobGrade: z.enum([
    JOB_GRADE.E1, JOB_GRADE.E2,
    JOB_GRADE.M1, JOB_GRADE.M2, JOB_GRADE.M3,
    JOB_GRADE.S1, JOB_GRADE.S2,
    JOB_GRADE.O1, JOB_GRADE.O2, JOB_GRADE.O3,
    JOB_GRADE.A1, JOB_GRADE.A2,
  ]).optional(),
  jobFamilyId: z.string().optional().nullable(),
  reportsToPositionId: z.string().optional().nullable(),
  reportingType: z.enum([
    REPORTING_TYPE.DIRECT,
    REPORTING_TYPE.DOTTED,
    REPORTING_TYPE.FUNCTIONAL,
    REPORTING_TYPE.PROJECT,
  ]).optional(),
  headcount: z.number().int().min(1).max(100).optional(),
  salaryGradeMin: z.number().min(0).optional(),
  salaryGradeMax: z.number().min(0).optional(),
  allowances: z.object({
    housing: z.number().min(0).optional(),
    transport: z.number().min(0).optional(),
    lunch: z.number().min(0).optional(),
    communication: z.number().min(0).optional(),
    medical: z.number().min(0).optional(),
    other: z.number().min(0).optional(),
  }).optional().nullable(),
  minEducation: z.string().max(100).optional().nullable(),
  minExperience: z.number().int().min(0).max(50).optional().nullable(),
  requiredSkills: z.array(z.string().max(100)).max(20).optional().nullable(),
  preferredSkills: z.array(z.string().max(100)).max(20).optional().nullable(),
  certifications: z.array(z.string().max(100)).max(10).optional().nullable(),
  workLocation: z.enum([
    WORK_LOCATION.OFFICE,
    WORK_LOCATION.REMOTE,
    WORK_LOCATION.HYBRID,
    WORK_LOCATION.FIELD,
  ]).optional().nullable(),
  travelRequired: z.enum([
    TRAVEL_REQUIRED.NONE,
    TRAVEL_REQUIRED.OCCASIONAL,
    TRAVEL_REQUIRED.FREQUENT,
    TRAVEL_REQUIRED.EXTENSIVE,
  ]).optional().nullable(),
  workingHours: z.string().max(50).optional().nullable(),
  effectiveFrom: z.date().optional(),
  effectiveUntil: z.date().optional().nullable(),
  frozenUntil: z.date().optional().nullable(),
  showInOrgChart: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  tags: tagsSchema.nullable(),
  notes: notesSchema.nullable(),
});

export const freezePositionSchema = z.object({
  positionId: z.string().min(1, 'Position ID is required'),
  frozenUntil: z.date().optional(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

export const changePositionStatusSchema = z.object({
  positionId: z.string().min(1, 'Position ID is required'),
  status: z.enum([
    POSITION_STATUS.ACTIVE,
    POSITION_STATUS.VACANT,
    POSITION_STATUS.FROZEN,
    POSITION_STATUS.DISCONTINUED,
    POSITION_STATUS.PENDING_APPROVAL,
  ], { message: 'Invalid position status' }),
  reason: z.string().min(5, 'Reason is required').max(500),
  effectiveDate: z.date().optional(),
});

// ----------------------------------------------------------------------------
// Employee Assignment Schemas
// ----------------------------------------------------------------------------
export const assignEmployeeSchema = z.object({
  positionId: z.string().min(1, 'Position ID is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  isPrimary: z.boolean().optional().default(true),
  fte: z.number().min(0.1, 'FTE must be at least 0.1').max(1, 'FTE cannot exceed 1').optional().default(1),
  assignedDate: z.date().optional(),
});

export const removeEmployeeSchema = z.object({
  positionId: z.string().min(1, 'Position ID is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  endDate: z.date().optional(),
  reason: z.string().max(500).optional(),
});

export const transferEmployeeSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  fromDepartmentId: z.string().min(1, 'Source department is required'),
  toDepartmentId: z.string().min(1, 'Target department is required'),
  toPositionId: z.string().optional(),
  effectiveDate: z.date(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  retainReporting: z.boolean().optional().default(false),
}).refine(
  (data) => data.fromDepartmentId !== data.toDepartmentId,
  { message: 'Source and target departments must be different', path: ['toDepartmentId'] }
);

// ----------------------------------------------------------------------------
// Reporting Line Schemas
// ----------------------------------------------------------------------------
export const changeReportingSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  newManagerId: z.string().min(1, 'New manager ID is required'),
  reportingType: z.enum([
    REPORTING_TYPE.DIRECT,
    REPORTING_TYPE.DOTTED,
    REPORTING_TYPE.FUNCTIONAL,
    REPORTING_TYPE.PROJECT,
  ], { message: 'Invalid reporting type' }),
  effectiveDate: z.date(),
  reason: z.string().max(500).optional(),
  endPreviousReporting: z.boolean().optional().default(true),
  projectId: z.string().optional(),
}).refine(
  (data) => data.employeeId !== data.newManagerId,
  { message: 'Employee cannot report to themselves', path: ['newManagerId'] }
);

export const createReportingLineSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  managerId: z.string().min(1, 'Manager ID is required'),
  reportingType: z.enum([
    REPORTING_TYPE.DIRECT,
    REPORTING_TYPE.DOTTED,
    REPORTING_TYPE.FUNCTIONAL,
    REPORTING_TYPE.PROJECT,
  ], { message: 'Invalid reporting type' }),
  isPrimary: z.boolean().optional().default(false),
  effectiveFrom: z.date().optional(),
  effectiveUntil: z.date().optional(),
  projectId: z.string().optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => data.employeeId !== data.managerId,
  { message: 'Employee cannot report to themselves', path: ['managerId'] }
);

export const endReportingLineSchema = z.object({
  reportingLineId: z.string().min(1, 'Reporting line ID is required'),
  effectiveUntil: z.date().optional(),
  reason: z.string().max(500).optional(),
});

// ----------------------------------------------------------------------------
// Cost Center Schemas
// ----------------------------------------------------------------------------
export const createCostCenterSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  description: z.string().max(500).optional(),
  type: z.enum([
    COST_CENTER_TYPE.PROFIT_CENTER,
    COST_CENTER_TYPE.COST_CENTER,
    COST_CENTER_TYPE.INVESTMENT_CENTER,
    COST_CENTER_TYPE.REVENUE_CENTER,
  ], { message: 'Invalid cost center type' }),
  parentId: z.string().optional(),
  managerId: z.string().optional(),
  departmentIds: z.array(z.string()).optional(),
  budgetAmount: z.number().min(0).optional(),
  currency: z.string().length(3, 'Currency must be 3 characters').default('UGX'),
  fiscalYear: z.number().int().min(2020).max(2100),
  effectiveFrom: z.date().optional(),
});

export const updateCostCenterSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum([
    COST_CENTER_TYPE.PROFIT_CENTER,
    COST_CENTER_TYPE.COST_CENTER,
    COST_CENTER_TYPE.INVESTMENT_CENTER,
    COST_CENTER_TYPE.REVENUE_CENTER,
  ]).optional(),
  parentId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  departmentIds: z.array(z.string()).optional(),
  budgetAmount: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.date().optional(),
  effectiveUntil: z.date().optional().nullable(),
});

// ----------------------------------------------------------------------------
// Job Family Schemas
// ----------------------------------------------------------------------------
export const jobFamilyLevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  name: z.string().min(2).max(50),
  grade: z.enum([
    JOB_GRADE.E1, JOB_GRADE.E2,
    JOB_GRADE.M1, JOB_GRADE.M2, JOB_GRADE.M3,
    JOB_GRADE.S1, JOB_GRADE.S2,
    JOB_GRADE.O1, JOB_GRADE.O2, JOB_GRADE.O3,
    JOB_GRADE.A1, JOB_GRADE.A2,
  ]),
  typicalYearsExperience: z.number().int().min(0).max(50),
  competencies: z.array(z.string().max(100)).max(20),
});

export const createJobFamilySchema = z.object({
  code: codeSchema,
  name: nameSchema,
  description: z.string().max(500).optional(),
  levels: z.array(jobFamilyLevelSchema).min(1, 'At least one level is required').max(10),
  applicableGrades: z.array(z.enum([
    JOB_GRADE.E1, JOB_GRADE.E2,
    JOB_GRADE.M1, JOB_GRADE.M2, JOB_GRADE.M3,
    JOB_GRADE.S1, JOB_GRADE.S2,
    JOB_GRADE.O1, JOB_GRADE.O2, JOB_GRADE.O3,
    JOB_GRADE.A1, JOB_GRADE.A2,
  ])).min(1, 'At least one applicable grade is required'),
  coreCompetencies: z.array(z.string().max(100)).max(20),
});

// ----------------------------------------------------------------------------
// Filter Schemas
// ----------------------------------------------------------------------------
export const departmentFiltersSchema = z.object({
  companyId: z.string().min(1),
  status: z.union([
    z.enum([
      DEPARTMENT_STATUS.ACTIVE,
      DEPARTMENT_STATUS.INACTIVE,
      DEPARTMENT_STATUS.RESTRUCTURING,
      DEPARTMENT_STATUS.MERGED,
      DEPARTMENT_STATUS.DISSOLVED,
    ]),
    z.array(z.enum([
      DEPARTMENT_STATUS.ACTIVE,
      DEPARTMENT_STATUS.INACTIVE,
      DEPARTMENT_STATUS.RESTRUCTURING,
      DEPARTMENT_STATUS.MERGED,
      DEPARTMENT_STATUS.DISSOLVED,
    ])),
  ]).optional(),
  type: z.union([
    z.enum([
      DEPARTMENT_TYPE.EXECUTIVE,
      DEPARTMENT_TYPE.CORPORATE,
      DEPARTMENT_TYPE.OPERATIONAL,
      DEPARTMENT_TYPE.SUPPORT,
      DEPARTMENT_TYPE.BRANCH,
      DEPARTMENT_TYPE.PROJECT,
      DEPARTMENT_TYPE.VIRTUAL,
    ]),
    z.array(z.enum([
      DEPARTMENT_TYPE.EXECUTIVE,
      DEPARTMENT_TYPE.CORPORATE,
      DEPARTMENT_TYPE.OPERATIONAL,
      DEPARTMENT_TYPE.SUPPORT,
      DEPARTMENT_TYPE.BRANCH,
      DEPARTMENT_TYPE.PROJECT,
      DEPARTMENT_TYPE.VIRTUAL,
    ])),
  ]).optional(),
  parentId: z.string().nullable().optional(),
  headId: z.string().optional(),
  costCenterId: z.string().optional(),
  showInOrgChart: z.boolean().optional(),
  search: z.string().optional(),
  includeInactive: z.boolean().optional(),
});

export const positionFiltersSchema = z.object({
  companyId: z.string().min(1),
  departmentId: z.string().optional(),
  status: z.union([
    z.enum([
      POSITION_STATUS.ACTIVE,
      POSITION_STATUS.VACANT,
      POSITION_STATUS.FROZEN,
      POSITION_STATUS.DISCONTINUED,
      POSITION_STATUS.PENDING_APPROVAL,
    ]),
    z.array(z.enum([
      POSITION_STATUS.ACTIVE,
      POSITION_STATUS.VACANT,
      POSITION_STATUS.FROZEN,
      POSITION_STATUS.DISCONTINUED,
      POSITION_STATUS.PENDING_APPROVAL,
    ])),
  ]).optional(),
  jobGrade: z.union([
    z.enum([
      JOB_GRADE.E1, JOB_GRADE.E2,
      JOB_GRADE.M1, JOB_GRADE.M2, JOB_GRADE.M3,
      JOB_GRADE.S1, JOB_GRADE.S2,
      JOB_GRADE.O1, JOB_GRADE.O2, JOB_GRADE.O3,
      JOB_GRADE.A1, JOB_GRADE.A2,
    ]),
    z.array(z.enum([
      JOB_GRADE.E1, JOB_GRADE.E2,
      JOB_GRADE.M1, JOB_GRADE.M2, JOB_GRADE.M3,
      JOB_GRADE.S1, JOB_GRADE.S2,
      JOB_GRADE.O1, JOB_GRADE.O2, JOB_GRADE.O3,
      JOB_GRADE.A1, JOB_GRADE.A2,
    ])),
  ]).optional(),
  reportsToPositionId: z.string().optional(),
  hasVacancies: z.boolean().optional(),
  showInOrgChart: z.boolean().optional(),
  search: z.string().optional(),
  includeDiscontinued: z.boolean().optional(),
});

// ----------------------------------------------------------------------------
// Validation Helper Functions
// ----------------------------------------------------------------------------
export function validateCreateDepartment(data: unknown) {
  return createDepartmentSchema.safeParse(data);
}

export function validateUpdateDepartment(data: unknown) {
  return updateDepartmentSchema.safeParse(data);
}

export function validateCreatePosition(data: unknown) {
  return createPositionSchema.safeParse(data);
}

export function validateUpdatePosition(data: unknown) {
  return updatePositionSchema.safeParse(data);
}

export function validateAssignEmployee(data: unknown) {
  return assignEmployeeSchema.safeParse(data);
}

export function validateTransferEmployee(data: unknown) {
  return transferEmployeeSchema.safeParse(data);
}

export function validateChangeReporting(data: unknown) {
  return changeReportingSchema.safeParse(data);
}

export function validateCreateCostCenter(data: unknown) {
  return createCostCenterSchema.safeParse(data);
}

export function validateCreateJobFamily(data: unknown) {
  return createJobFamilySchema.safeParse(data);
}

// ----------------------------------------------------------------------------
// Type Exports from Schemas
// ----------------------------------------------------------------------------
export type CreateDepartmentSchemaType = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentSchemaType = z.infer<typeof updateDepartmentSchema>;
export type MergeDepartmentsSchemaType = z.infer<typeof mergeDepartmentsSchema>;
export type DissolveDepartmentSchemaType = z.infer<typeof dissolveDepartmentSchema>;
export type CreatePositionSchemaType = z.infer<typeof createPositionSchema>;
export type UpdatePositionSchemaType = z.infer<typeof updatePositionSchema>;
export type FreezePositionSchemaType = z.infer<typeof freezePositionSchema>;
export type AssignEmployeeSchemaType = z.infer<typeof assignEmployeeSchema>;
export type RemoveEmployeeSchemaType = z.infer<typeof removeEmployeeSchema>;
export type TransferEmployeeSchemaType = z.infer<typeof transferEmployeeSchema>;
export type ChangeReportingSchemaType = z.infer<typeof changeReportingSchema>;
export type CreateReportingLineSchemaType = z.infer<typeof createReportingLineSchema>;
export type CreateCostCenterSchemaType = z.infer<typeof createCostCenterSchema>;
export type CreateJobFamilySchemaType = z.infer<typeof createJobFamilySchema>;
