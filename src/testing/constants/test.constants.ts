// ============================================================================
// TEST CONSTANTS
// DawinOS v2.0 - Testing Strategy
// Shared test constants and configuration
// ============================================================================

// =============================================================================
// TEST TIMEOUTS
// =============================================================================

export const TEST_TIMEOUTS = {
  UNIT: {
    DEFAULT: 5000,
    ASYNC: 10000,
  },
  INTEGRATION: {
    DEFAULT: 15000,
    FIREBASE: 20000,
    SYNC: 30000,
  },
  E2E: {
    DEFAULT: 30000,
    NAVIGATION: 10000,
    FORM_SUBMIT: 15000,
    DATA_LOAD: 20000,
    WORKFLOW: 60000,
  },
  WAIT: {
    SHORT: 100,
    MEDIUM: 500,
    LONG: 1000,
    VERY_LONG: 5000,
  },
} as const;

// =============================================================================
// TEST USER DATA
// =============================================================================

export const TEST_USERS = {
  ADMIN: {
    id: 'test-admin-001',
    email: 'admin@dawinos.test',
    displayName: 'Test Admin',
    role: 'admin',
    subsidiaryId: 'dawin-group',
    permissions: ['*'],
  },
  HR_MANAGER: {
    id: 'test-hr-001',
    email: 'hr@dawinos.test',
    displayName: 'Test HR Manager',
    role: 'hr_manager',
    subsidiaryId: 'dawin-group',
    permissions: ['hr:read', 'hr:write', 'hr:approve'],
  },
  CEO: {
    id: 'test-ceo-001',
    email: 'ceo@dawinos.test',
    displayName: 'Test CEO',
    role: 'ceo',
    subsidiaryId: 'dawin-group',
    permissions: ['strategy:*', 'reports:*', 'approvals:*'],
  },
  FINANCE_MANAGER: {
    id: 'test-finance-001',
    email: 'finance@dawinos.test',
    displayName: 'Test Finance Manager',
    role: 'finance_manager',
    subsidiaryId: 'dawin-group',
    permissions: ['finance:read', 'finance:write', 'budgets:approve'],
  },
  EMPLOYEE: {
    id: 'test-employee-001',
    email: 'employee@dawinos.test',
    displayName: 'Test Employee',
    role: 'employee',
    subsidiaryId: 'dawin-finishes',
    permissions: ['self:read', 'self:write'],
  },
  INVESTMENT_ANALYST: {
    id: 'test-analyst-001',
    email: 'analyst@dawinos.test',
    displayName: 'Test Analyst',
    role: 'investment_analyst',
    subsidiaryId: 'dawin-capital',
    permissions: ['deals:read', 'deals:write', 'portfolio:read'],
  },
} as const;

// =============================================================================
// TEST SUBSIDIARY DATA
// =============================================================================

export const TEST_SUBSIDIARIES = {
  DAWIN_GROUP: {
    id: 'dawin-group',
    name: 'Dawin Group',
    code: 'DG',
    type: 'holding',
    currency: 'UGX',
    timezone: 'Africa/Kampala',
    status: 'active',
  },
  DAWIN_FINISHES: {
    id: 'dawin-finishes',
    name: 'Dawin Finishes',
    code: 'DF',
    type: 'manufacturing',
    currency: 'UGX',
    timezone: 'Africa/Kampala',
    status: 'active',
  },
  DAWIN_ADVISORY: {
    id: 'dawin-advisory',
    name: 'Dawin Advisory',
    code: 'DA',
    type: 'services',
    currency: 'UGX',
    timezone: 'Africa/Kampala',
    status: 'active',
  },
  DAWIN_CAPITAL: {
    id: 'dawin-capital',
    name: 'Dawin Capital',
    code: 'DC',
    type: 'investment',
    currency: 'USD',
    timezone: 'Africa/Kampala',
    status: 'active',
  },
  DAWIN_TECHNOLOGY: {
    id: 'dawin-technology',
    name: 'Dawin Technology',
    code: 'DT',
    type: 'technology',
    currency: 'UGX',
    timezone: 'Africa/Kampala',
    status: 'active',
  },
} as const;

// =============================================================================
// PHASE CONFIGURATION
// =============================================================================

export const TEST_PHASES = {
  PHASE_1: {
    id: 'phase-1',
    name: 'Intelligence Layer',
    modules: ['business-events', 'role-profiles', 'task-generation', 'grey-area-detection', 'smart-tasks'],
    criticalPaths: ['event-to-task-generation', 'role-based-task-assignment', 'grey-area-escalation'],
  },
  PHASE_2: {
    id: 'phase-2',
    name: 'HR Central',
    modules: ['employee-management', 'contract-management', 'payroll-system', 'leave-management', 'organization-structure'],
    criticalPaths: ['employee-onboarding', 'payroll-processing', 'leave-approval-workflow', 'contract-renewal'],
  },
  PHASE_3: {
    id: 'phase-3',
    name: 'CEO Strategy Command',
    modules: ['strategy-documents', 'okr-hierarchy', 'kpi-framework', 'performance-aggregation', 'executive-dashboard'],
    criticalPaths: ['strategy-to-okr-cascade', 'kpi-tracking-workflow', 'executive-review'],
  },
  PHASE_4: {
    id: 'phase-4',
    name: 'Financial Management',
    modules: ['chart-of-accounts', 'budget-management', 'expense-tracking', 'financial-reporting'],
    criticalPaths: ['budget-approval-workflow', 'expense-reimbursement', 'month-end-close'],
  },
  PHASE_5: {
    id: 'phase-5',
    name: 'Staff Performance',
    modules: ['goal-setting', 'performance-reviews', 'competency-management', 'succession-planning'],
    criticalPaths: ['goal-cascade', 'review-cycle', 'talent-pipeline'],
  },
  PHASE_6: {
    id: 'phase-6',
    name: 'Capital Hub',
    modules: ['deal-pipeline', 'portfolio-management', 'investor-crm', 'capital-allocation'],
    criticalPaths: ['deal-lifecycle', 'investment-approval', 'fund-deployment'],
  },
  PHASE_7: {
    id: 'phase-7',
    name: 'Market Intelligence',
    modules: ['competitor-analysis', 'market-research', 'environment-scanning', 'intelligence-dashboard'],
    criticalPaths: ['competitor-tracking', 'market-trend-analysis', 'strategic-insights'],
  },
  PHASE_8: {
    id: 'phase-8',
    name: 'Integration & Testing',
    modules: ['cross-module-integration', 'unified-dashboard', 'testing-framework'],
    criticalPaths: ['cross-module-reference', 'global-search', 'unified-notifications'],
  },
} as const;

// =============================================================================
// UGANDA-SPECIFIC TEST DATA
// =============================================================================

export const UGANDA_TEST_DATA = {
  CURRENCY: {
    CODE: 'UGX',
    SYMBOL: 'USh',
    DECIMALS: 0,
    EXCHANGE_RATE_USD: 3750,
  },
  PAYE_BRACKETS: [
    { min: 0, max: 235000, rate: 0 },
    { min: 235001, max: 335000, rate: 0.1 },
    { min: 335001, max: 410000, rate: 0.2 },
    { min: 410001, max: 10000000, rate: 0.3 },
    { min: 10000001, max: Infinity, rate: 0.4 },
  ],
  NSSF: {
    EMPLOYEE_RATE: 0.05,
    EMPLOYER_RATE: 0.1,
  },
  LST_BRACKETS: [
    { min: 0, max: 100000, amount: 0 },
    { min: 100001, max: 200000, amount: 5000 },
    { min: 200001, max: 300000, amount: 10000 },
    { min: 300001, max: 400000, amount: 20000 },
    { min: 400001, max: 500000, amount: 30000 },
    { min: 500001, max: 750000, amount: 45000 },
    { min: 750001, max: 1000000, amount: 60000 },
    { min: 1000001, max: 1500000, amount: 75000 },
    { min: 1500001, max: 2000000, amount: 90000 },
    { min: 2000001, max: Infinity, amount: 100000 },
  ],
  HOLIDAYS: [
    { date: '2025-01-01', name: "New Year's Day" },
    { date: '2025-01-26', name: 'Liberation Day' },
    { date: '2025-02-16', name: "Archbishop Janani Luwum's Day" },
    { date: '2025-03-08', name: "International Women's Day" },
    { date: '2025-04-18', name: 'Good Friday' },
    { date: '2025-04-21', name: 'Easter Monday' },
    { date: '2025-05-01', name: 'Labour Day' },
    { date: '2025-06-03', name: 'Martyrs Day' },
    { date: '2025-06-09', name: 'National Heroes Day' },
    { date: '2025-10-09', name: 'Independence Day' },
    { date: '2025-12-25', name: 'Christmas Day' },
    { date: '2025-12-26', name: 'Boxing Day' },
  ],
  LOCATIONS: {
    KAMPALA: { name: 'Kampala', region: 'Central', country: 'UG' },
    ENTEBBE: { name: 'Entebbe', region: 'Central', country: 'UG' },
    JINJA: { name: 'Jinja', region: 'Eastern', country: 'UG' },
    MBARARA: { name: 'Mbarara', region: 'Western', country: 'UG' },
    GULU: { name: 'Gulu', region: 'Northern', country: 'UG' },
    KABALE: { name: 'Kabale', region: 'Western', country: 'UG' },
    RUSHOROZA: { name: 'Rushoroza', region: 'Western', country: 'UG' },
  },
} as const;

// =============================================================================
// TEST DATA GENERATION LIMITS
// =============================================================================

export const TEST_LIMITS = {
  EMPLOYEES_PER_SUBSIDIARY: 50,
  PROJECTS_PER_SUBSIDIARY: 20,
  DEALS_PER_QUARTER: 15,
  OKRS_PER_PERIOD: 10,
  KPIS_PER_DEPARTMENT: 8,
  BUDGET_ITEMS_PER_DEPARTMENT: 25,
  COMPETITORS_PER_MARKET: 10,
  DOCUMENTS_PER_MODULE: 30,
} as const;

// =============================================================================
// PERFORMANCE THRESHOLDS
// =============================================================================

export const PERFORMANCE_THRESHOLDS = {
  RESPONSE_TIME: {
    EXCELLENT: 100,
    GOOD: 300,
    ACCEPTABLE: 1000,
    POOR: 3000,
  },
  RENDER_TIME: {
    INITIAL: 500,
    UPDATE: 100,
    LARGE_LIST: 1000,
  },
  QUERY: {
    MAX_RESULTS: 100,
    BATCH_SIZE: 500,
    TIMEOUT: 30000,
  },
  MEMORY: {
    WARNING: 100,
    CRITICAL: 200,
  },
} as const;
