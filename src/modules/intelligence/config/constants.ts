/**
 * ZeusOS v2.0 - Intelligence Module Constants
 * Core configuration for the Enterprise Operations Platform
 */

// ============================================
// Module Identifiers
// ============================================

export const INTELLIGENCE_MODULE = 'intelligence';
export const SHARED_OPS_MODULE = 'shared-ops';
export const EXECUTIVE_MODULE = 'executive';

export const SUBSIDIARY_IDS = {
  GROUP: 'group',           // Zeus Group - Parent company for shared roles
  FINISHES: 'finishes',
  TECHNOLOGY: 'technology',
  CAPITAL: 'capital',
} as const;

export type SubsidiaryId = typeof SUBSIDIARY_IDS[keyof typeof SUBSIDIARY_IDS];

export const DEPARTMENT_IDS = {
  // Cross-subsidiary
  EXECUTIVE: 'executive',
  FINANCE: 'finance',
  HR: 'hr',
  IT: 'it',
  OPERATIONS: 'operations',
  ADMINISTRATION: 'administration',
  
  // Finishes-specific
  DESIGN: 'design',
  PRODUCTION: 'production',
  PROCUREMENT: 'procurement',
  LOGISTICS: 'logistics',
  INSTALLATION: 'installation',
  
  // Advisory-specific
  DELIVERY: 'delivery',
  BUSINESS_DEVELOPMENT: 'business-development',
  RESEARCH: 'research',
  CLIENT_SERVICES: 'client-services',
  
  // Technology-specific
  ENGINEERING: 'engineering',
  PRODUCT: 'product',
  QA: 'qa',
  
  // Cross-subsidiary additional
  MARKETING: 'marketing',
  STRATEGY: 'strategy',

  // Capital-specific
  INVESTMENTS: 'investments',
  PORTFOLIO: 'portfolio',
  RISK: 'risk',
} as const;

export type DepartmentId = typeof DEPARTMENT_IDS[keyof typeof DEPARTMENT_IDS];

// ============================================
// Task Configuration
// ============================================

export const TASK_SOURCES = {
  MANUAL: 'manual',           // Human created
  EVENT_TRIGGERED: 'event',   // Business event triggered
  GREY_AREA: 'grey-area',     // Grey area detection
  RECURRING: 'recurring',     // Scheduled/periodic
  DELEGATED: 'delegated',     // Passed from another user
  SYSTEM: 'system',           // Platform maintenance
} as const;

export type TaskSource = typeof TASK_SOURCES[keyof typeof TASK_SOURCES];

export const TASK_PRIORITIES = {
  P0_CRITICAL: { value: 0, label: 'Critical', multiplier: 1.0, color: '#D32F2F' },
  P1_HIGH: { value: 1, label: 'High', multiplier: 0.75, color: '#F57C00' },
  P2_MEDIUM: { value: 2, label: 'Medium', multiplier: 0.5, color: '#FBC02D' },
  P3_LOW: { value: 3, label: 'Low', multiplier: 0.25, color: '#388E3C' },
} as const;

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  BLOCKED: 'blocked',
  REVIEW: 'review',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELEGATED: 'delegated',
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

// ============================================
// Event Configuration
// ============================================

export const EVENT_CATEGORIES = {
  CUSTOMER: 'customer',
  PRODUCTION: 'production',
  FINANCIAL: 'financial',
  HR: 'hr',
  STRATEGIC: 'strategic',
  COMPLIANCE: 'compliance',
  SYSTEM: 'system',
} as const;

export type EventCategory = typeof EVENT_CATEGORIES[keyof typeof EVENT_CATEGORIES];

export const EVENT_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type EventPriority = typeof EVENT_PRIORITIES[keyof typeof EVENT_PRIORITIES];

// ============================================
// Grey Area Configuration
// ============================================

export const GREY_AREA_TYPES = {
  // Organizational gaps
  OWNERSHIP_GAP: 'ownership-gap',
  OVERLAPPING_RESPONSIBILITY: 'overlapping-responsibility',
  PROCESS_GAP: 'process-gap',
  COMMUNICATION_GAP: 'communication-gap',
  CAPACITY_GAP: 'capacity-gap',
  SKILL_GAP: 'skill-gap',
  // Decision & approval
  APPROVAL_REQUIRED: 'approval-required',
  PENDING_DECISION: 'pending-decision',
  ESCALATION_NEEDED: 'escalation-needed',
  // Policy & compliance
  POLICY_EXCEPTION: 'policy-exception',
  COMPLIANCE_ISSUE: 'compliance-issue',
  CONFLICT_RESOLUTION: 'conflict-resolution',
  // Data & requirements
  DATA_INCONSISTENCY: 'data-inconsistency',
  UNCLEAR_REQUIREMENT: 'unclear-requirement',
  RISK_IDENTIFIED: 'risk-identified',
} as const;

export type GreyAreaType = typeof GREY_AREA_TYPES[keyof typeof GREY_AREA_TYPES];

export const GREY_AREA_SEVERITIES = {
  LOW: { value: 1, label: 'Low', color: '#4CAF50' },
  MEDIUM: { value: 2, label: 'Medium', color: '#FF9800' },
  HIGH: { value: 3, label: 'High', color: '#F44336' },
  CRITICAL: { value: 4, label: 'Critical', color: '#9C27B0' },
} as const;

// ============================================
// HR Configuration
// ============================================

export const EMPLOYMENT_TYPES = {
  FULL_TIME: 'full-time',
  PART_TIME: 'part-time',
  CONTRACT: 'contract',
  INTERN: 'intern',
} as const;

export type EmploymentType = typeof EMPLOYMENT_TYPES[keyof typeof EMPLOYMENT_TYPES];

export const JOB_LEVELS = {
  INTERN: { value: 1, label: 'Intern' },
  JUNIOR: { value: 2, label: 'Junior' },
  MID: { value: 3, label: 'Mid-Level' },
  PROFESSIONAL: { value: 4, label: 'Professional' },
  SENIOR: { value: 5, label: 'Senior' },
  LEAD: { value: 6, label: 'Team Lead' },
  MANAGER: { value: 7, label: 'Manager' },
  DIRECTOR: { value: 8, label: 'Director' },
  EXECUTIVE: { value: 9, label: 'Executive' },
} as const;

export type JobLevel = keyof typeof JOB_LEVELS;

export const LEAVE_TYPES = {
  ANNUAL: { code: 'annual', label: 'Annual Leave', defaultDays: 21 },
  SICK: { code: 'sick', label: 'Sick Leave', defaultDays: 14 },
  MATERNITY: { code: 'maternity', label: 'Maternity Leave', defaultDays: 60 },
  PATERNITY: { code: 'paternity', label: 'Paternity Leave', defaultDays: 4 },
  COMPASSIONATE: { code: 'compassionate', label: 'Compassionate Leave', defaultDays: 3 },
  STUDY: { code: 'study', label: 'Study Leave', defaultDays: 5 },
  UNPAID: { code: 'unpaid', label: 'Unpaid Leave', defaultDays: 0 },
} as const;

// ============================================
// Finance Configuration (Uganda-specific)
// ============================================

export const CURRENCY = {
  PRIMARY: 'UGX',
  SECONDARY: 'USD',
  EXCHANGE_RATE_SOURCE: 'bank-of-uganda',
} as const;

export const PAYE_BANDS_UGX = [
  { min: 0, max: 235000, rate: 0 },
  { min: 235001, max: 335000, rate: 0.10 },
  { min: 335001, max: 410000, rate: 0.20 },
  { min: 410001, max: 10000000, rate: 0.30 },
  { min: 10000001, max: Infinity, rate: 0.40 },
] as const;

export const NSSF_RATES = {
  EMPLOYEE: 0.05,     // 5%
  EMPLOYER: 0.10,     // 10%
} as const;

export const TRANSACTION_CATEGORIES = {
  // Income
  SALES_REVENUE: 'sales-revenue',
  SERVICE_REVENUE: 'service-revenue',
  INVESTMENT_INCOME: 'investment-income',
  GRANT_INCOME: 'grant-income',
  OTHER_INCOME: 'other-income',
  
  // Expenses
  PAYROLL: 'payroll',
  RENT: 'rent',
  UTILITIES: 'utilities',
  MATERIALS: 'materials',
  TRANSPORT: 'transport',
  PROFESSIONAL_FEES: 'professional-fees',
  MARKETING: 'marketing',
  EQUIPMENT: 'equipment',
  TAX_PAYMENT: 'tax-payment',
  LOAN_REPAYMENT: 'loan-repayment',
  OTHER_EXPENSE: 'other-expense',
  
  // Transfers
  INTER_SUBSIDIARY: 'inter-subsidiary',
  BANK_TRANSFER: 'bank-transfer',
} as const;

export type TransactionCategory = typeof TRANSACTION_CATEGORIES[keyof typeof TRANSACTION_CATEGORIES];

// ============================================
// Capital & Investment Configuration
// ============================================

export const RAISE_TYPES = {
  EQUITY: 'equity',
  DEBT: 'debt',
  CONVERTIBLE: 'convertible',
  GRANT: 'grant',
  REVENUE_BASED: 'revenue-based',
} as const;

export type RaiseType = typeof RAISE_TYPES[keyof typeof RAISE_TYPES];

export const INVESTOR_TYPES = {
  VC: 'vc',
  PE: 'pe',
  ANGEL: 'angel',
  FAMILY_OFFICE: 'family-office',
  CORPORATE: 'corporate',
  DFI: 'dfi',
  BANK: 'bank',
  CROWD: 'crowd',
  OTHER: 'other',
} as const;

export type InvestorType = typeof INVESTOR_TYPES[keyof typeof INVESTOR_TYPES];

export const RAISE_STATUSES = {
  PLANNING: 'planning',
  PREPARATION: 'preparation',
  MARKETING: 'marketing',
  DUE_DILIGENCE: 'due-diligence',
  NEGOTIATION: 'negotiation',
  CLOSING: 'closing',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export type RaiseStatus = typeof RAISE_STATUSES[keyof typeof RAISE_STATUSES];

// ============================================
// Strategy Configuration
// ============================================

export const OKR_LEVELS = {
  COMPANY: 'company',
  SUBSIDIARY: 'subsidiary',
  DEPARTMENT: 'department',
  TEAM: 'team',
  INDIVIDUAL: 'individual',
} as const;

export type OkrLevel = typeof OKR_LEVELS[keyof typeof OKR_LEVELS];

export const KPI_CATEGORIES = {
  FINANCIAL: 'financial',
  OPERATIONAL: 'operational',
  CUSTOMER: 'customer',
  PEOPLE: 'people',
  GROWTH: 'growth',
} as const;

export type KpiCategory = typeof KPI_CATEGORIES[keyof typeof KPI_CATEGORIES];

export const OPPORTUNITY_TYPES = {
  MARKET: 'market',
  PARTNERSHIP: 'partnership',
  ACQUISITION: 'acquisition',
  TECHNOLOGY: 'technology',
  TALENT: 'talent',
  INVESTMENT: 'investment',
} as const;

export type OpportunityType = typeof OPPORTUNITY_TYPES[keyof typeof OPPORTUNITY_TYPES];

export const NEEDS_TYPES = {
  CAPABILITY: 'capability',
  PROCESS: 'process',
  TECHNOLOGY: 'technology',
  PEOPLE: 'people',
  CAPITAL: 'capital',
  INFRASTRUCTURE: 'infrastructure',
} as const;

export type NeedsType = typeof NEEDS_TYPES[keyof typeof NEEDS_TYPES];

// ============================================
// Market Intelligence Configuration
// ============================================

export const COMPETITOR_THREAT_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type CompetitorThreatLevel = typeof COMPETITOR_THREAT_LEVELS[keyof typeof COMPETITOR_THREAT_LEVELS];

export const PESTLE_FACTORS = {
  POLITICAL: 'political',
  ECONOMIC: 'economic',
  SOCIAL: 'social',
  TECHNOLOGICAL: 'technological',
  LEGAL: 'legal',
  ENVIRONMENTAL: 'environmental',
} as const;

export type PestleFactor = typeof PESTLE_FACTORS[keyof typeof PESTLE_FACTORS];

// ============================================
// Workflow & Approval Configuration
// ============================================

export const APPROVAL_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ESCALATED: 'escalated',
} as const;

export type ApprovalStatus = typeof APPROVAL_STATUSES[keyof typeof APPROVAL_STATUSES];

export const WORKFLOW_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in-review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
} as const;

export type WorkflowStatus = typeof WORKFLOW_STATUSES[keyof typeof WORKFLOW_STATUSES];

// ============================================
// Notification Configuration
// ============================================

export const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  IN_APP: 'in-app',
} as const;

export type NotificationChannel = typeof NOTIFICATION_CHANNELS[keyof typeof NOTIFICATION_CHANNELS];

export const NOTIFICATION_PRIORITIES = {
  LOW: { value: 1, label: 'Low' },
  MEDIUM: { value: 2, label: 'Medium' },
  HIGH: { value: 3, label: 'High' },
  URGENT: { value: 4, label: 'Urgent' },
} as const;

// ============================================
// Firestore Collection Names
// ============================================

export const COLLECTIONS = {
  // Platform
  PLATFORM_CONFIG: 'platform/config',
  INTEGRATIONS: 'platform/integrations',
  
  // Executive
  STRATEGY_DOCUMENTS: 'executive/strategy/documents',
  OKRS: 'executive/strategy/okrs',
  KPIS: 'executive/strategy/kpis',
  COMPETITORS: 'executive/market_intelligence/competitors',
  MARKETS: 'executive/market_intelligence/markets',
  ENVIRONMENT: 'executive/market_intelligence/environment',
  CAPITAL_RAISES: 'executive/capital/raises',
  INVESTORS: 'executive/capital/investors',
  ALLOCATIONS: 'executive/capital/allocations',
  OPPORTUNITIES: 'executive/opportunities/strategic',
  NEEDS: 'executive/opportunities/needs',
  
  // Shared Ops
  SMART_TASKS: 'shared_ops/smart_tasks',
  BUSINESS_EVENTS: 'shared_ops/business_events',
  FINANCE_BATCHES: 'shared_ops/finance_batches',
  KNOWLEDGE_BASE: 'shared_ops/knowledge_base',
  GREY_AREAS: 'shared_ops/grey_areas',
  
  // HR
  EMPLOYEES: 'hr/employees',
  CONTRACTS: 'hr/contracts',
  PAYROLL_BATCHES: 'hr/payroll_batches',
  LEAVE_REQUESTS: 'hr/leave_requests',
  PERFORMANCE: 'hr/performance',
  DEPARTMENTS: 'hr/departments',
  ROLE_PROFILES: 'hr/role_profiles',
  ROLE_ASSIGNMENTS: 'hr/role_assignments',
  
  // User
  USER_NOTIFICATIONS: 'user_notifications',
  USER_SETTINGS: 'user_settings',
  
  // Subsidiaries (existing)
  FINISHES: 'subsidiaries/finishes',
  TECHNOLOGY: 'subsidiaries/technology',
  CAPITAL: 'subsidiaries/capital',
} as const;

// ============================================
// Default Values
// ============================================

export const DEFAULTS = {
  TASK_DUE_DAYS: 7,
  MAX_CONCURRENT_TASKS: 10,
  TARGET_UTILIZATION: 80,
  PAYROLL_DAY: 28,
  LEAVE_APPROVAL_DAYS: 3,
  GREY_AREA_REVIEW_DAYS: 14,
  OKR_REVIEW_FREQUENCY_DAYS: 30,
  KPI_UPDATE_FREQUENCY_HOURS: 24,
  AI_CONFIDENCE_THRESHOLD: 0.75,
} as const;

// ============================================
// Feature Flags
// ============================================

export const FEATURE_FLAGS = {
  AI_TASK_PRIORITIZATION: true,
  AI_MORNING_BRIEFING: true,
  AI_TRANSACTION_CATEGORIZATION: true,
  AI_MARKET_ANALYSIS: true,
  OFFLINE_MODE: true,
  MOBILE_MONEY_PAYMENTS: true,
  QUICKBOOKS_SYNC: true,
  SMS_NOTIFICATIONS: true,
} as const;
