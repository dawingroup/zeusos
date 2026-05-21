// ============================================================================
// CASH FLOW OPTIMIZER CONSTANTS
// ZeusOS v2.0 - Cash Flow Optimization & Expenditure Prioritization Engine
// ============================================================================

import type {
  ExpenditureCategory,
  LiabilityType,
  PriorityTier,
  ScoringWeights,
  PriorityThresholds,
  CashBufferSettings,
  SavingsSettings,
} from '../types/optimizer.types';

// ----------------------------------------------------------------------------
// FIRESTORE COLLECTION NAMES
// All nested under companies/{companyId}/
// ----------------------------------------------------------------------------

export const CASHFLOW_PROJECTIONS_COLLECTION = 'cashflow_projections';
export const EXPENDITURE_QUEUE_COLLECTION = 'expenditure_queue';
export const SPEND_PLANS_COLLECTION = 'spend_plans';
export const SAVINGS_LEDGER_COLLECTION = 'savings_ledger';
export const LIABILITY_REGISTER_COLLECTION = 'liability_register';
export const OPTIMIZER_CONFIG_COLLECTION = 'optimizer_config';
export const OPTIMIZER_RUNS_COLLECTION = 'optimizer_runs';
export const PROJECTED_RECEIPTS_COLLECTION = 'projected_receipts';

// ----------------------------------------------------------------------------
// SCORING WEIGHTS — Default composite score calculation
// ----------------------------------------------------------------------------

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  urgency: 0.25,
  revenueUnlock: 0.25,
  risk: 0.15,
  cashPosition: 0.15,
  relationship: 0.10,
  operational: 0.10,
};

// ----------------------------------------------------------------------------
// PRIORITY TIER THRESHOLDS — Composite score → tier mapping
// ----------------------------------------------------------------------------

export const DEFAULT_PRIORITY_THRESHOLDS: PriorityThresholds = {
  critical: 80,
  high: 65,
  medium: 45,
  low: 25,
};

export const PRIORITY_TIER_LABELS: Record<PriorityTier, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  DEFERRABLE: 'Deferrable',
};

export const PRIORITY_TIER_COLORS: Record<PriorityTier, string> = {
  CRITICAL: '#DC2626', // red-600
  HIGH: '#EA580C',     // orange-600
  MEDIUM: '#CA8A04',   // yellow-600
  LOW: '#2563EB',      // blue-600
  DEFERRABLE: '#6B7280', // gray-500
};

// ----------------------------------------------------------------------------
// CASH BUFFER DEFAULTS
// ----------------------------------------------------------------------------

export const DEFAULT_CASH_BUFFER: CashBufferSettings = {
  minimumCashBuffer: 5_000_000,   // 5M UGX absolute minimum
  minimumBufferDays: 14,
  targetBufferDays: 30,
  crisisThresholdDays: 7,
};

// ----------------------------------------------------------------------------
// SAVINGS DEFAULTS
// ----------------------------------------------------------------------------

export const DEFAULT_SAVINGS_SETTINGS: SavingsSettings = {
  baseRatePercent: 10,
  surplusRatePercent: 25,
  surplusThreshold: 100_000_000, // 100M UGX
  categoryRates: {
    projectMilestonePayment: 12,
    recurringIncome: 8,
    adHocIncome: 15,
  },
  withdrawalRequiresApproval: true,
  autoWithdrawForStatutory: true,
  minimumSavingsBalance: 10_000_000, // 10M UGX floor
  enableRoundUp: true,
  roundUpUnit: 10_000, // Round to nearest 10K UGX
};

// ----------------------------------------------------------------------------
// EXPENDITURE CATEGORIES — Labels and classification
// ----------------------------------------------------------------------------

export const EXPENDITURE_CATEGORY_LABELS: Record<ExpenditureCategory, string> = {
  materials: 'Materials & Supplies',
  subcontractor: 'Subcontractor Payments',
  labor: 'Wages & Labor',
  equipment: 'Equipment',
  transport: 'Transport & Logistics',
  statutory: 'Statutory Obligations',
  rent: 'Rent & Lease',
  utilities: 'Utilities',
  professional_fees: 'Professional Fees',
  overhead: 'Overhead & Admin',
  loan_repayment: 'Loan Repayment',
  savings: 'Savings Allocation',
  other: 'Other',
};

export const EXPENDITURE_CATEGORY_ICONS: Record<ExpenditureCategory, string> = {
  materials: 'Package',
  subcontractor: 'HardHat',
  labor: 'Users',
  equipment: 'Wrench',
  transport: 'Truck',
  statutory: 'Scale',
  rent: 'Building2',
  utilities: 'Zap',
  professional_fees: 'Briefcase',
  overhead: 'Settings',
  loan_repayment: 'Landmark',
  savings: 'PiggyBank',
  other: 'MoreHorizontal',
};

/** Categories that are always non-deferrable */
export const NON_DEFERRABLE_CATEGORIES: ExpenditureCategory[] = [
  'statutory',
  'loan_repayment',
];

/** Crisis mode payment priority order (index 0 = highest priority) */
export const CRISIS_PRIORITY_ORDER: ExpenditureCategory[] = [
  'statutory',
  'labor',
  'rent',
  'loan_repayment',
  'subcontractor',
  'materials',
  'utilities',
  'equipment',
  'transport',
  'professional_fees',
  'overhead',
  'other',
  'savings',
];

// ----------------------------------------------------------------------------
// LIABILITY TYPES — Labels and statutory deadlines
// ----------------------------------------------------------------------------

export const LIABILITY_TYPE_LABELS: Record<LiabilityType, string> = {
  tax_paye: 'PAYE',
  tax_vat: 'VAT',
  tax_corporate: 'Corporate Income Tax',
  nssf: 'NSSF',
  rent: 'Rent',
  loan: 'Loan',
  vendor_credit: 'Vendor Credit',
  retention: 'Retention',
  guarantee: 'Performance Guarantee',
  insurance: 'Insurance',
  license: 'Business License',
  utility_contract: 'Utility Contract',
  other: 'Other',
};

/** Uganda statutory liabilities — due day of following month */
export interface StatutoryDeadline {
  type: LiabilityType;
  description: string;
  dueDayOfMonth: number;
  gracePeriodDays: number;
  penaltyRatePercent: number;
  frequency: 'monthly' | 'quarterly' | 'annually';
}

export const UGANDA_STATUTORY_DEADLINES: StatutoryDeadline[] = [
  {
    type: 'tax_paye',
    description: 'PAYE — Monthly payroll tax remittance to URA',
    dueDayOfMonth: 15,
    gracePeriodDays: 0,
    penaltyRatePercent: 2,
    frequency: 'monthly',
  },
  {
    type: 'nssf',
    description: 'NSSF — Social security contributions',
    dueDayOfMonth: 15,
    gracePeriodDays: 0,
    penaltyRatePercent: 5,
    frequency: 'monthly',
  },
  {
    type: 'tax_vat',
    description: 'VAT — Value Added Tax return and payment',
    dueDayOfMonth: 15,
    gracePeriodDays: 0,
    penaltyRatePercent: 2,
    frequency: 'monthly',
  },
  {
    type: 'tax_corporate',
    description: 'Provisional Corporate Income Tax',
    dueDayOfMonth: 15,
    gracePeriodDays: 0,
    penaltyRatePercent: 2,
    frequency: 'quarterly',
  },
];

// ----------------------------------------------------------------------------
// PROJECTION SETTINGS
// ----------------------------------------------------------------------------

/** Number of days for daily-granularity projection */
export const DAILY_PROJECTION_DAYS = 14;

/** Total projection horizon in days */
export const TOTAL_PROJECTION_DAYS = 90;

/** Minimum confidence score to include receipt in projections */
export const MIN_RECEIPT_CONFIDENCE = 20;

// ----------------------------------------------------------------------------
// PARTIAL PAYMENT DEFAULTS
// ----------------------------------------------------------------------------

/** Minimum expenditure amount to consider splitting */
export const DEFAULT_PARTIAL_PAYMENT_THRESHOLD = 5_000_000; // 5M UGX

/** Minimum partial payment amount */
export const DEFAULT_MINIMUM_PARTIAL_PAYMENT = 1_000_000; // 1M UGX

// ----------------------------------------------------------------------------
// OPTIMIZER RUN SCHEDULE
// ----------------------------------------------------------------------------

export const OPTIMIZER_SCHEDULE_CRON = '0 5 * * *'; // 5:00 AM daily
export const OPTIMIZER_TIMEZONE = 'Africa/Nairobi';

// ----------------------------------------------------------------------------
// RECEIPT CONFIDENCE — Maps quote/estimate status to confidence
// ----------------------------------------------------------------------------

export const QUOTE_STATUS_CONFIDENCE: Record<string, { level: 'possible' | 'probable' | 'confirmed'; score: number }> = {
  estimate_only: { level: 'possible', score: 30 },
  draft: { level: 'possible', score: 25 },
  sent: { level: 'probable', score: 50 },
  viewed: { level: 'probable', score: 60 },
  approved: { level: 'confirmed', score: 90 },
};

// ----------------------------------------------------------------------------
// COMMITMENT GATEWAY — Controls what enters the expenditure queue
// ----------------------------------------------------------------------------

/** Multiplicative factor applied to composite score for 'probable' commitment items */
export const PROBABLE_DAMPENING_FACTOR = 0.7;

/** Extra days added to latestDate for 'probable' items (softens urgency) */
export const PROBABLE_DEADLINE_EXTENSION_DAYS = 14;

/** CRM deal stages that qualify as 'committed' */
export const COMMITTED_DEAL_STAGES: string[] = ['won'];

/** CRM deal stages that qualify as 'probable' */
export const PROBABLE_DEAL_STAGES: string[] = ['quotation', 'negotiation'];

/** CRM deal stages that result in exclusion from the queue */
export const EXCLUDED_DEAL_STAGES: string[] = ['lost', 'on_hold'];

/** CRM deal stages that are speculative (filtered out before ingestion) */
export const SPECULATIVE_DEAL_STAGES: string[] = ['lead', 'qualification', 'site_visit', 'design_proposal'];

// ----------------------------------------------------------------------------
// SALES ORDER → COMMITMENT MAPPING
// ----------------------------------------------------------------------------

/** SO statuses → committed (deposit paid or production started) */
export const SO_COMMITTED_STATUSES: string[] = [
  'deposit_received', 'released_to_production', 'in_progress', 'completed',
];

/** SO statuses → probable (client accepted, awaiting deposit/production) */
export const SO_PROBABLE_STATUSES: string[] = [
  'client_accepted', 'design_review', 'awaiting_design_signoff',
  'design_approved', 'scope_frozen', 'awaiting_deposit',
];

/** SO statuses → exclude (no client acceptance) */
export const SO_EXCLUDED_STATUSES: string[] = [
  'draft', 'sent_to_client', 'negotiation', 'cancelled', 'disputed',
];

/** SO status → receipt confidence for income projections */
export const SO_STATUS_CONFIDENCE: Record<string, { level: 'confirmed' | 'probable' | 'possible'; score: number }> = {
  deposit_received: { level: 'confirmed', score: 90 },
  released_to_production: { level: 'confirmed', score: 95 },
  in_progress: { level: 'confirmed', score: 95 },
  completed: { level: 'confirmed', score: 100 },
  client_accepted: { level: 'probable', score: 65 },
  design_review: { level: 'probable', score: 65 },
  awaiting_design_signoff: { level: 'probable', score: 65 },
  design_approved: { level: 'probable', score: 70 },
  scope_frozen: { level: 'probable', score: 75 },
  awaiting_deposit: { level: 'probable', score: 80 },
  draft: { level: 'possible', score: 25 },
  sent_to_client: { level: 'possible', score: 35 },
  negotiation: { level: 'possible', score: 40 },
};

// ----------------------------------------------------------------------------
// CLIENT PAYMENT PROFILES
// ----------------------------------------------------------------------------

export const CLIENT_PAYMENT_PROFILES_COLLECTION = 'client_payment_profiles';

/** Minimum number of historical payments before profile is considered reliable */
export const MIN_PAYMENT_HISTORY_SIZE = 3;

// ----------------------------------------------------------------------------
// RATE LIMITING — Trigger deduplication
// ----------------------------------------------------------------------------

/** Minimum interval (ms) between balance-triggered rescores for the same company */
export const RESCORE_RATE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

/** Minimum transaction amount (UGX) to trigger a rescore */
export const RESCORE_BALANCE_THRESHOLD = 500_000; // 500K UGX
