// ============================================================================
// ORGANIZATION CONSTANTS - DawinOS HR Central
// Uganda-specific organizational structure constants
// ============================================================================

// ----------------------------------------------------------------------------
// Department Status
// ----------------------------------------------------------------------------
export const DEPARTMENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  RESTRUCTURING: 'restructuring',
  MERGED: 'merged',
  DISSOLVED: 'dissolved',
} as const;

export type DepartmentStatus = typeof DEPARTMENT_STATUS[keyof typeof DEPARTMENT_STATUS];

export const DEPARTMENT_STATUS_LABELS: Record<DepartmentStatus, string> = {
  [DEPARTMENT_STATUS.ACTIVE]: 'Active',
  [DEPARTMENT_STATUS.INACTIVE]: 'Inactive',
  [DEPARTMENT_STATUS.RESTRUCTURING]: 'Restructuring',
  [DEPARTMENT_STATUS.MERGED]: 'Merged',
  [DEPARTMENT_STATUS.DISSOLVED]: 'Dissolved',
};

export const DEPARTMENT_STATUS_COLORS: Record<DepartmentStatus, string> = {
  [DEPARTMENT_STATUS.ACTIVE]: 'success',
  [DEPARTMENT_STATUS.INACTIVE]: 'default',
  [DEPARTMENT_STATUS.RESTRUCTURING]: 'warning',
  [DEPARTMENT_STATUS.MERGED]: 'info',
  [DEPARTMENT_STATUS.DISSOLVED]: 'error',
};

// ----------------------------------------------------------------------------
// Department Types
// ----------------------------------------------------------------------------
export const DEPARTMENT_TYPE = {
  EXECUTIVE: 'executive',
  CORPORATE: 'corporate',
  OPERATIONAL: 'operational',
  SUPPORT: 'support',
  BRANCH: 'branch',
  PROJECT: 'project',
  VIRTUAL: 'virtual',
} as const;

export type DepartmentType = typeof DEPARTMENT_TYPE[keyof typeof DEPARTMENT_TYPE];

export const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  [DEPARTMENT_TYPE.EXECUTIVE]: 'Executive',
  [DEPARTMENT_TYPE.CORPORATE]: 'Corporate',
  [DEPARTMENT_TYPE.OPERATIONAL]: 'Operational',
  [DEPARTMENT_TYPE.SUPPORT]: 'Support',
  [DEPARTMENT_TYPE.BRANCH]: 'Branch',
  [DEPARTMENT_TYPE.PROJECT]: 'Project',
  [DEPARTMENT_TYPE.VIRTUAL]: 'Virtual/Cross-functional',
};

// ----------------------------------------------------------------------------
// Position Status
// ----------------------------------------------------------------------------
export const POSITION_STATUS = {
  ACTIVE: 'active',
  VACANT: 'vacant',
  FROZEN: 'frozen',
  DISCONTINUED: 'discontinued',
  PENDING_APPROVAL: 'pending_approval',
} as const;

export type PositionStatus = typeof POSITION_STATUS[keyof typeof POSITION_STATUS];

export const POSITION_STATUS_LABELS: Record<PositionStatus, string> = {
  [POSITION_STATUS.ACTIVE]: 'Active (Filled)',
  [POSITION_STATUS.VACANT]: 'Vacant',
  [POSITION_STATUS.FROZEN]: 'Frozen',
  [POSITION_STATUS.DISCONTINUED]: 'Discontinued',
  [POSITION_STATUS.PENDING_APPROVAL]: 'Pending Approval',
};

export const POSITION_STATUS_COLORS: Record<PositionStatus, string> = {
  [POSITION_STATUS.ACTIVE]: 'success',
  [POSITION_STATUS.VACANT]: 'warning',
  [POSITION_STATUS.FROZEN]: 'info',
  [POSITION_STATUS.DISCONTINUED]: 'error',
  [POSITION_STATUS.PENDING_APPROVAL]: 'default',
};

// ----------------------------------------------------------------------------
// Position Types
// ----------------------------------------------------------------------------
export const POSITION_TYPE = {
  PERMANENT: 'permanent',
  CONTRACT: 'contract',
  TEMPORARY: 'temporary',
  INTERNSHIP: 'internship',
  CONSULTANT: 'consultant',
} as const;

export type PositionType = typeof POSITION_TYPE[keyof typeof POSITION_TYPE];

export const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  [POSITION_TYPE.PERMANENT]: 'Permanent',
  [POSITION_TYPE.CONTRACT]: 'Contract',
  [POSITION_TYPE.TEMPORARY]: 'Temporary',
  [POSITION_TYPE.INTERNSHIP]: 'Internship',
  [POSITION_TYPE.CONSULTANT]: 'Consultant',
};

// ----------------------------------------------------------------------------
// Job Grades - Uganda Salary Bands (UGX per month)
// ----------------------------------------------------------------------------
export const JOB_GRADE = {
  E1: 'E1', // CEO, Managing Director
  E2: 'E2', // C-Suite, Executive Directors
  M1: 'M1', // Senior Managers, Directors
  M2: 'M2', // Managers
  M3: 'M3', // Assistant Managers
  S1: 'S1', // Senior Supervisors
  S2: 'S2', // Supervisors, Team Leaders
  O1: 'O1', // Senior Officers
  O2: 'O2', // Officers
  O3: 'O3', // Junior Officers, Assistants
  A1: 'A1', // Senior Support Staff
  A2: 'A2', // Support Staff, Auxiliaries
} as const;

export type JobGrade = typeof JOB_GRADE[keyof typeof JOB_GRADE];

export type JobLevel = 'executive' | 'management' | 'supervisory' | 'operational' | 'support';

export interface JobGradeDetails {
  grade: JobGrade;
  label: string;
  level: JobLevel;
  levelOrder: number;
  salaryMin: number;
  salaryMax: number;
  salaryMidpoint: number;
  typicalTitles: string[];
  canSupervise: JobGrade[];
}

export const JOB_GRADE_DETAILS: Record<JobGrade, JobGradeDetails> = {
  [JOB_GRADE.E1]: {
    grade: JOB_GRADE.E1,
    label: 'Executive 1',
    level: 'executive',
    levelOrder: 1,
    salaryMin: 25000000,
    salaryMax: 80000000,
    salaryMidpoint: 52500000,
    typicalTitles: ['Chief Executive Officer', 'Managing Director'],
    canSupervise: ['E2', 'M1', 'M2', 'M3', 'S1', 'S2', 'O1', 'O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.E2]: {
    grade: JOB_GRADE.E2,
    label: 'Executive 2',
    level: 'executive',
    levelOrder: 2,
    salaryMin: 15000000,
    salaryMax: 35000000,
    salaryMidpoint: 25000000,
    typicalTitles: ['CFO', 'COO', 'Executive Director'],
    canSupervise: ['M1', 'M2', 'M3', 'S1', 'S2', 'O1', 'O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.M1]: {
    grade: JOB_GRADE.M1,
    label: 'Management 1',
    level: 'management',
    levelOrder: 3,
    salaryMin: 8000000,
    salaryMax: 18000000,
    salaryMidpoint: 13000000,
    typicalTitles: ['Senior Manager', 'Director', 'Head of Department'],
    canSupervise: ['M2', 'M3', 'S1', 'S2', 'O1', 'O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.M2]: {
    grade: JOB_GRADE.M2,
    label: 'Management 2',
    level: 'management',
    levelOrder: 4,
    salaryMin: 5000000,
    salaryMax: 10000000,
    salaryMidpoint: 7500000,
    typicalTitles: ['Manager', 'Branch Manager', 'Project Manager'],
    canSupervise: ['M3', 'S1', 'S2', 'O1', 'O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.M3]: {
    grade: JOB_GRADE.M3,
    label: 'Management 3',
    level: 'management',
    levelOrder: 5,
    salaryMin: 3500000,
    salaryMax: 6500000,
    salaryMidpoint: 5000000,
    typicalTitles: ['Assistant Manager', 'Deputy Manager'],
    canSupervise: ['S1', 'S2', 'O1', 'O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.S1]: {
    grade: JOB_GRADE.S1,
    label: 'Supervisory 1',
    level: 'supervisory',
    levelOrder: 6,
    salaryMin: 2500000,
    salaryMax: 4500000,
    salaryMidpoint: 3500000,
    typicalTitles: ['Senior Supervisor', 'Principal Officer', 'Team Lead'],
    canSupervise: ['S2', 'O1', 'O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.S2]: {
    grade: JOB_GRADE.S2,
    label: 'Supervisory 2',
    level: 'supervisory',
    levelOrder: 7,
    salaryMin: 1800000,
    salaryMax: 3200000,
    salaryMidpoint: 2500000,
    typicalTitles: ['Supervisor', 'Coordinator'],
    canSupervise: ['O1', 'O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.O1]: {
    grade: JOB_GRADE.O1,
    label: 'Operational 1',
    level: 'operational',
    levelOrder: 8,
    salaryMin: 1200000,
    salaryMax: 2200000,
    salaryMidpoint: 1700000,
    typicalTitles: ['Senior Officer', 'Specialist', 'Analyst'],
    canSupervise: ['O2', 'O3', 'A1', 'A2'],
  },
  [JOB_GRADE.O2]: {
    grade: JOB_GRADE.O2,
    label: 'Operational 2',
    level: 'operational',
    levelOrder: 9,
    salaryMin: 800000,
    salaryMax: 1500000,
    salaryMidpoint: 1150000,
    typicalTitles: ['Officer', 'Executive', 'Associate'],
    canSupervise: ['O3', 'A1', 'A2'],
  },
  [JOB_GRADE.O3]: {
    grade: JOB_GRADE.O3,
    label: 'Operational 3',
    level: 'operational',
    levelOrder: 10,
    salaryMin: 500000,
    salaryMax: 1000000,
    salaryMidpoint: 750000,
    typicalTitles: ['Junior Officer', 'Assistant', 'Trainee'],
    canSupervise: ['A1', 'A2'],
  },
  [JOB_GRADE.A1]: {
    grade: JOB_GRADE.A1,
    label: 'Support 1',
    level: 'support',
    levelOrder: 11,
    salaryMin: 350000,
    salaryMax: 650000,
    salaryMidpoint: 500000,
    typicalTitles: ['Senior Clerk', 'Administrative Assistant'],
    canSupervise: ['A2'],
  },
  [JOB_GRADE.A2]: {
    grade: JOB_GRADE.A2,
    label: 'Support 2',
    level: 'support',
    levelOrder: 12,
    salaryMin: 200000,
    salaryMax: 500000,
    salaryMidpoint: 350000,
    typicalTitles: ['Clerk', 'Driver', 'Office Assistant'],
    canSupervise: [],
  },
};

export const JOB_GRADES_SORTED: JobGrade[] = Object.values(JOB_GRADE_DETAILS)
  .sort((a, b) => a.levelOrder - b.levelOrder)
  .map(d => d.grade);

// ----------------------------------------------------------------------------
// Reporting Line Types
// ----------------------------------------------------------------------------
export const REPORTING_TYPE = {
  DIRECT: 'direct',
  DOTTED: 'dotted',
  FUNCTIONAL: 'functional',
  PROJECT: 'project',
} as const;

export type ReportingType = typeof REPORTING_TYPE[keyof typeof REPORTING_TYPE];

export const REPORTING_TYPE_LABELS: Record<ReportingType, string> = {
  [REPORTING_TYPE.DIRECT]: 'Direct (Solid Line)',
  [REPORTING_TYPE.DOTTED]: 'Dotted Line',
  [REPORTING_TYPE.FUNCTIONAL]: 'Functional',
  [REPORTING_TYPE.PROJECT]: 'Project-based',
};

// ----------------------------------------------------------------------------
// Organization Change Types
// ----------------------------------------------------------------------------
export const ORG_CHANGE_TYPE = {
  DEPARTMENT_CREATED: 'department_created',
  DEPARTMENT_UPDATED: 'department_updated',
  DEPARTMENT_MERGED: 'department_merged',
  DEPARTMENT_DISSOLVED: 'department_dissolved',
  POSITION_CREATED: 'position_created',
  POSITION_UPDATED: 'position_updated',
  POSITION_FROZEN: 'position_frozen',
  POSITION_DISCONTINUED: 'position_discontinued',
  POSITION_ASSIGNED: 'position_assigned',
  POSITION_VACATED: 'position_vacated',
  REPORTING_CHANGED: 'reporting_changed',
  MANAGER_CHANGED: 'manager_changed',
  EMPLOYEE_TRANSFERRED: 'employee_transferred',
  HEADCOUNT_UPDATED: 'headcount_updated',
} as const;

export type OrgChangeType = typeof ORG_CHANGE_TYPE[keyof typeof ORG_CHANGE_TYPE];

// ----------------------------------------------------------------------------
// Cost Center Types
// ----------------------------------------------------------------------------
export const COST_CENTER_TYPE = {
  PROFIT_CENTER: 'profit_center',
  COST_CENTER: 'cost_center',
  INVESTMENT_CENTER: 'investment_center',
  REVENUE_CENTER: 'revenue_center',
} as const;

export type CostCenterType = typeof COST_CENTER_TYPE[keyof typeof COST_CENTER_TYPE];

export const COST_CENTER_TYPE_LABELS: Record<CostCenterType, string> = {
  [COST_CENTER_TYPE.PROFIT_CENTER]: 'Profit Center',
  [COST_CENTER_TYPE.COST_CENTER]: 'Cost Center',
  [COST_CENTER_TYPE.INVESTMENT_CENTER]: 'Investment Center',
  [COST_CENTER_TYPE.REVENUE_CENTER]: 'Revenue Center',
};

// ----------------------------------------------------------------------------
// Span of Control Guidelines
// ----------------------------------------------------------------------------
export const SPAN_OF_CONTROL_GUIDELINES: Record<JobLevel, { min: number; max: number; ideal: number }> = {
  executive: { min: 3, max: 8, ideal: 5 },
  management: { min: 4, max: 10, ideal: 7 },
  supervisory: { min: 5, max: 15, ideal: 10 },
  operational: { min: 6, max: 20, ideal: 12 },
  support: { min: 0, max: 5, ideal: 0 },
};

export const MAX_HIERARCHY_DEPTH = 8;

// ----------------------------------------------------------------------------
// Firestore Collections
// ----------------------------------------------------------------------------
export const ORG_COLLECTIONS = {
  DEPARTMENTS: 'departments',
  POSITIONS: 'positions',
  REPORTING_LINES: 'reportingLines',
  COST_CENTERS: 'costCenters',
  JOB_FAMILIES: 'jobFamilies',
  ORG_CHANGES: 'organizationChanges',
} as const;

// ----------------------------------------------------------------------------
// Standard Departments for Uganda Organizations
// ----------------------------------------------------------------------------
export const STANDARD_DEPARTMENTS = [
  { code: 'EXEC', name: 'Executive Office', type: DEPARTMENT_TYPE.EXECUTIVE },
  { code: 'FIN', name: 'Finance & Accounts', type: DEPARTMENT_TYPE.CORPORATE },
  { code: 'HR', name: 'Human Resources', type: DEPARTMENT_TYPE.CORPORATE },
  { code: 'LEG', name: 'Legal & Compliance', type: DEPARTMENT_TYPE.CORPORATE },
  { code: 'OPS', name: 'Operations', type: DEPARTMENT_TYPE.OPERATIONAL },
  { code: 'SALES', name: 'Sales & Marketing', type: DEPARTMENT_TYPE.OPERATIONAL },
  { code: 'IT', name: 'Information Technology', type: DEPARTMENT_TYPE.SUPPORT },
  { code: 'ADMIN', name: 'Administration', type: DEPARTMENT_TYPE.SUPPORT },
  { code: 'PROC', name: 'Procurement', type: DEPARTMENT_TYPE.SUPPORT },
  { code: 'QA', name: 'Quality Assurance', type: DEPARTMENT_TYPE.OPERATIONAL },
] as const;

// ----------------------------------------------------------------------------
// Branch Locations (Common Uganda Regions)
// ----------------------------------------------------------------------------
export const UGANDA_BRANCHES = [
  { code: 'KLA', name: 'Kampala', region: 'Central' },
  { code: 'ENT', name: 'Entebbe', region: 'Central' },
  { code: 'JIN', name: 'Jinja', region: 'Eastern' },
  { code: 'MBA', name: 'Mbale', region: 'Eastern' },
  { code: 'MBR', name: 'Mbarara', region: 'Western' },
  { code: 'FTP', name: 'Fort Portal', region: 'Western' },
  { code: 'GUL', name: 'Gulu', region: 'Northern' },
  { code: 'LIR', name: 'Lira', region: 'Northern' },
  { code: 'ARU', name: 'Arua', region: 'West Nile' },
  { code: 'SRT', name: 'Soroti', region: 'Eastern' },
  { code: 'MAS', name: 'Masaka', region: 'Central' },
  { code: 'HOI', name: 'Hoima', region: 'Western' },
] as const;

export type UgandaBranchCode = typeof UGANDA_BRANCHES[number]['code'];

// ----------------------------------------------------------------------------
// Work Location Types
// ----------------------------------------------------------------------------
export const WORK_LOCATION = {
  OFFICE: 'office',
  REMOTE: 'remote',
  HYBRID: 'hybrid',
  FIELD: 'field',
} as const;

export type WorkLocation = typeof WORK_LOCATION[keyof typeof WORK_LOCATION];

export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  [WORK_LOCATION.OFFICE]: 'Office',
  [WORK_LOCATION.REMOTE]: 'Remote',
  [WORK_LOCATION.HYBRID]: 'Hybrid',
  [WORK_LOCATION.FIELD]: 'Field',
};

// ----------------------------------------------------------------------------
// Travel Requirements
// ----------------------------------------------------------------------------
export const TRAVEL_REQUIRED = {
  NONE: 'none',
  OCCASIONAL: 'occasional',
  FREQUENT: 'frequent',
  EXTENSIVE: 'extensive',
} as const;

export type TravelRequired = typeof TRAVEL_REQUIRED[keyof typeof TRAVEL_REQUIRED];

export const TRAVEL_REQUIRED_LABELS: Record<TravelRequired, string> = {
  [TRAVEL_REQUIRED.NONE]: 'No Travel',
  [TRAVEL_REQUIRED.OCCASIONAL]: 'Occasional (< 25%)',
  [TRAVEL_REQUIRED.FREQUENT]: 'Frequent (25-50%)',
  [TRAVEL_REQUIRED.EXTENSIVE]: 'Extensive (> 50%)',
};

// ----------------------------------------------------------------------------
// Education Levels
// ----------------------------------------------------------------------------
export const EDUCATION_LEVEL = {
  NONE: 'none',
  PRIMARY: 'primary',
  O_LEVEL: 'o_level',
  A_LEVEL: 'a_level',
  CERTIFICATE: 'certificate',
  DIPLOMA: 'diploma',
  BACHELORS: 'bachelors',
  POSTGRADUATE_DIPLOMA: 'postgraduate_diploma',
  MASTERS: 'masters',
  DOCTORATE: 'doctorate',
  PROFESSIONAL: 'professional',
} as const;

export type EducationLevel = typeof EDUCATION_LEVEL[keyof typeof EDUCATION_LEVEL];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  [EDUCATION_LEVEL.NONE]: 'No Formal Education',
  [EDUCATION_LEVEL.PRIMARY]: 'Primary Education (PLE)',
  [EDUCATION_LEVEL.O_LEVEL]: 'O-Level (UCE)',
  [EDUCATION_LEVEL.A_LEVEL]: 'A-Level (UACE)',
  [EDUCATION_LEVEL.CERTIFICATE]: 'Certificate',
  [EDUCATION_LEVEL.DIPLOMA]: 'Diploma',
  [EDUCATION_LEVEL.BACHELORS]: "Bachelor's Degree",
  [EDUCATION_LEVEL.POSTGRADUATE_DIPLOMA]: 'Postgraduate Diploma',
  [EDUCATION_LEVEL.MASTERS]: "Master's Degree",
  [EDUCATION_LEVEL.DOCTORATE]: 'Doctorate (PhD)',
  [EDUCATION_LEVEL.PROFESSIONAL]: 'Professional Qualification',
};
