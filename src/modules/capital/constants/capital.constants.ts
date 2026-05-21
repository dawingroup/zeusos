// ============================================================================
// CAPITAL HUB CONSTANTS
// ZeusOS v2.0 — Capital seeking, readiness & application tracking
// ============================================================================

import type {
  CapitalNeedType,
  CapitalNeedUrgency,
  CapitalNeedStatus,
  CapitalProductType,
  ProviderType,
  ApplicationStage,
  FacilityStatus,
  ProductStatus,
  ChecklistItemStatus,
} from '../types/capital.types';

// ────────────────────────────────────────────────────────────────────────────
// FIRESTORE COLLECTIONS
// ────────────────────────────────────────────────────────────────────────────

export const CAPITAL_NEEDS_COLLECTION = 'capital_needs';
export const CAPITAL_PRODUCTS_COLLECTION = 'capital_products';
export const CAPITAL_APPLICATIONS_COLLECTION = 'capital_applications';
export const CAPITAL_FACILITIES_COLLECTION = 'capital_facilities';
export const CAPITAL_READINESS_COLLECTION = 'capital_readiness';

// ────────────────────────────────────────────────────────────────────────────
// MODULE BRANDING
// ────────────────────────────────────────────────────────────────────────────

export const MODULE_COLOR = '#9C27B0';
export const DEFAULT_EXCHANGE_RATE = 3700;

// ────────────────────────────────────────────────────────────────────────────
// CAPITAL NEED TYPES
// ────────────────────────────────────────────────────────────────────────────

export const NEED_TYPES: CapitalNeedType[] = [
  'working_capital',
  'asset_acquisition',
  'growth',
  'seasonal',
  'debt_refinancing',
  'emergency',
];

export const NEED_TYPE_LABELS: Record<CapitalNeedType, string> = {
  working_capital: 'Working Capital',
  asset_acquisition: 'Asset Acquisition',
  growth: 'Growth Capital',
  seasonal: 'Seasonal Financing',
  debt_refinancing: 'Debt Refinancing',
  emergency: 'Emergency',
};

export const NEED_TYPE_COLORS: Record<CapitalNeedType, string> = {
  working_capital: '#2196F3',
  asset_acquisition: '#FF9800',
  growth: '#4CAF50',
  seasonal: '#9C27B0',
  debt_refinancing: '#607D8B',
  emergency: '#F44336',
};

// ────────────────────────────────────────────────────────────────────────────
// URGENCY LEVELS
// ────────────────────────────────────────────────────────────────────────────

export const URGENCY_LEVELS: CapitalNeedUrgency[] = [
  'immediate',
  'short_term',
  'medium_term',
  'long_term',
];

export const URGENCY_LABELS: Record<CapitalNeedUrgency, string> = {
  immediate: 'Immediate (<30 days)',
  short_term: 'Short Term (30–90 days)',
  medium_term: 'Medium Term (3–12 months)',
  long_term: 'Long Term (1+ year)',
};

export const URGENCY_COLORS: Record<CapitalNeedUrgency, string> = {
  immediate: '#F44336',
  short_term: '#FF9800',
  medium_term: '#2196F3',
  long_term: '#4CAF50',
};

// ────────────────────────────────────────────────────────────────────────────
// NEED STATUS
// ────────────────────────────────────────────────────────────────────────────

export const NEED_STATUSES: CapitalNeedStatus[] = [
  'identified',
  'analyzing',
  'seeking',
  'applied',
  'resolved',
  'deferred',
];

export const NEED_STATUS_LABELS: Record<CapitalNeedStatus, string> = {
  identified: 'Identified',
  analyzing: 'Analyzing',
  seeking: 'Seeking Capital',
  applied: 'Applied',
  resolved: 'Resolved',
  deferred: 'Deferred',
};

export const NEED_STATUS_COLORS: Record<CapitalNeedStatus, string> = {
  identified: '#90CAF9',
  analyzing: '#FFB74D',
  seeking: '#64B5F6',
  applied: '#BA68C8',
  resolved: '#81C784',
  deferred: '#BDBDBD',
};

// ────────────────────────────────────────────────────────────────────────────
// CAPITAL PRODUCT TYPES
// ────────────────────────────────────────────────────────────────────────────

export const PRODUCT_TYPES: CapitalProductType[] = [
  'term_loan',
  'overdraft',
  'line_of_credit',
  'asset_finance',
  'trade_finance',
  'invoice_discounting',
  'factoring',
  'lpo_financing',
  'lease',
  'hire_purchase',
  'equity',
  'convertible_note',
  'grant',
  'dfi_loan',
  'supplier_credit',
  'microfinance',
];

export const PRODUCT_TYPE_LABELS: Record<CapitalProductType, string> = {
  term_loan: 'Term Loan',
  overdraft: 'Overdraft',
  line_of_credit: 'Line of Credit',
  asset_finance: 'Asset Finance',
  trade_finance: 'Trade Finance',
  invoice_discounting: 'Invoice Discounting',
  factoring: 'Factoring',
  lpo_financing: 'LPO Financing',
  lease: 'Lease',
  hire_purchase: 'Hire Purchase',
  equity: 'Equity Investment',
  convertible_note: 'Convertible Note',
  grant: 'Grant',
  dfi_loan: 'DFI Loan',
  supplier_credit: 'Supplier Credit',
  microfinance: 'Microfinance',
};

export const PRODUCT_TYPE_COLORS: Record<CapitalProductType, string> = {
  term_loan: '#1565C0',
  overdraft: '#E65100',
  line_of_credit: '#1B5E20',
  asset_finance: '#4A148C',
  trade_finance: '#BF360C',
  invoice_discounting: '#00695C',
  factoring: '#006064',
  lpo_financing: '#827717',
  lease: '#4E342E',
  hire_purchase: '#37474F',
  equity: '#880E4F',
  convertible_note: '#311B92',
  grant: '#1B5E20',
  dfi_loan: '#0D47A1',
  supplier_credit: '#E65100',
  microfinance: '#F57F17',
};

// ────────────────────────────────────────────────────────────────────────────
// PROVIDER TYPES
// ────────────────────────────────────────────────────────────────────────────

export const PROVIDER_TYPES: ProviderType[] = [
  'bank',
  'dfi',
  'government',
  'investor',
  'supplier',
  'microfinance',
  'fintech',
];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  bank: 'Commercial Bank',
  dfi: 'Development Finance Institution',
  government: 'Government Agency',
  investor: 'Private Investor',
  supplier: 'Supplier/Vendor',
  microfinance: 'Microfinance Institution',
  fintech: 'Fintech Lender',
};

// ────────────────────────────────────────────────────────────────────────────
// APPLICATION STAGES
// ────────────────────────────────────────────────────────────────────────────

export const APPLICATION_STAGES: ApplicationStage[] = [
  'identifying',
  'preparing',
  'submitted',
  'under_review',
  'additional_info',
  'approved',
  'disbursing',
  'completed',
  'declined',
  'withdrawn',
];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  identifying: 'Identifying',
  preparing: 'Preparing',
  submitted: 'Submitted',
  under_review: 'Under Review',
  additional_info: 'Additional Info Needed',
  approved: 'Approved',
  disbursing: 'Disbursing',
  completed: 'Completed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

export const APPLICATION_STAGE_COLORS: Record<ApplicationStage, string> = {
  identifying: '#90CAF9',
  preparing: '#FFB74D',
  submitted: '#64B5F6',
  under_review: '#BA68C8',
  additional_info: '#FFD54F',
  approved: '#81C784',
  disbursing: '#4DB6AC',
  completed: '#4CAF50',
  declined: '#EF5350',
  withdrawn: '#BDBDBD',
};

export const ACTIVE_APPLICATION_STAGES: ApplicationStage[] = [
  'identifying',
  'preparing',
  'submitted',
  'under_review',
  'additional_info',
  'approved',
  'disbursing',
];

// ────────────────────────────────────────────────────────────────────────────
// FACILITY STATUS
// ────────────────────────────────────────────────────────────────────────────

export const FACILITY_STATUSES: FacilityStatus[] = [
  'active',
  'fully_repaid',
  'defaulted',
  'restructured',
  'expired',
];

export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  active: 'Active',
  fully_repaid: 'Fully Repaid',
  defaulted: 'Defaulted',
  restructured: 'Restructured',
  expired: 'Expired',
};

export const FACILITY_STATUS_COLORS: Record<FacilityStatus, string> = {
  active: '#4CAF50',
  fully_repaid: '#2196F3',
  defaulted: '#F44336',
  restructured: '#FF9800',
  expired: '#9E9E9E',
};

// ────────────────────────────────────────────────────────────────────────────
// PRODUCT STATUS
// ────────────────────────────────────────────────────────────────────────────

export const PRODUCT_STATUSES: ProductStatus[] = ['active', 'inactive', 'expired'];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  expired: 'Expired',
};

// ────────────────────────────────────────────────────────────────────────────
// CHECKLIST ITEM STATUS
// ────────────────────────────────────────────────────────────────────────────

export const CHECKLIST_ITEM_STATUSES: ChecklistItemStatus[] = [
  'complete',
  'partial',
  'missing',
  'expired',
  'not_applicable',
];

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
  expired: 'Expired',
  not_applicable: 'N/A',
};

export const CHECKLIST_STATUS_COLORS: Record<ChecklistItemStatus, string> = {
  complete: '#4CAF50',
  partial: '#FF9800',
  missing: '#F44336',
  expired: '#9E9E9E',
  not_applicable: '#BDBDBD',
};

// ────────────────────────────────────────────────────────────────────────────
// DOCUMENT CHECKLIST TEMPLATES
// ────────────────────────────────────────────────────────────────────────────

export const DOCUMENT_CHECKLIST_TEMPLATE = [
  // Financial documents
  { id: 'audited_financials', label: 'Audited Financial Statements', category: 'financial', mandatory: true },
  { id: 'management_accounts', label: 'Management Accounts (last 3 months)', category: 'financial', mandatory: true },
  { id: 'cashflow_projections', label: 'Cash Flow Projections (12 months)', category: 'financial', mandatory: true },
  { id: 'bank_statements', label: 'Bank Statements (last 6 months)', category: 'financial', mandatory: true },
  { id: 'tax_returns', label: 'Tax Returns (last 2 years)', category: 'financial', mandatory: true },

  // Legal documents
  { id: 'certificate_of_incorporation', label: 'Certificate of Incorporation', category: 'legal', mandatory: true },
  { id: 'memorandum_articles', label: 'Memorandum & Articles of Association', category: 'legal', mandatory: true },
  { id: 'board_resolution', label: 'Board Resolution to Borrow', category: 'legal', mandatory: true },
  { id: 'directors_ids', label: 'Directors\' ID Documents', category: 'legal', mandatory: true },
  { id: 'company_profile', label: 'Company Profile', category: 'legal', mandatory: false },

  // Compliance documents
  { id: 'tax_clearance', label: 'Tax Clearance Certificate', category: 'compliance', mandatory: true },
  { id: 'nssf_compliance', label: 'NSSF Compliance Certificate', category: 'compliance', mandatory: true },
  { id: 'trading_license', label: 'Trading License', category: 'compliance', mandatory: true },
  { id: 'ura_registration', label: 'URA TIN Certificate', category: 'compliance', mandatory: true },

  // Business documents
  { id: 'business_plan', label: 'Business Plan', category: 'business', mandatory: false },
  { id: 'order_book', label: 'Contracts / Order Book', category: 'business', mandatory: false },
  { id: 'insurance_certificates', label: 'Insurance Certificates', category: 'business', mandatory: false },
  { id: 'collateral_docs', label: 'Collateral Documentation', category: 'business', mandatory: false },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// COMPLIANCE CHECKLIST TEMPLATES
// ────────────────────────────────────────────────────────────────────────────

export const COMPLIANCE_CHECKLIST_TEMPLATE = [
  { id: 'paye', label: 'PAYE Tax Compliance', category: 'tax' },
  { id: 'vat', label: 'VAT Compliance', category: 'tax' },
  { id: 'corporate_tax', label: 'Corporate Income Tax', category: 'tax' },
  { id: 'withholding_tax', label: 'Withholding Tax', category: 'tax' },
  { id: 'nssf', label: 'NSSF Contributions', category: 'statutory' },
  { id: 'trading_license', label: 'Valid Trading License', category: 'license' },
  { id: 'business_registration', label: 'URSB Registration Current', category: 'license' },
  { id: 'sector_license', label: 'Sector-Specific License', category: 'license' },
  { id: 'environmental_compliance', label: 'Environmental Compliance (if applicable)', category: 'regulatory' },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// UGANDA-SPECIFIC DFIs & DEVELOPMENT PARTNERS
// ────────────────────────────────────────────────────────────────────────────

export const UGANDA_DFIS = [
  { id: 'udb', name: 'Uganda Development Bank (UDB)', type: 'dfi' as const },
  { id: 'udc', name: 'Uganda Development Corporation (UDC)', type: 'dfi' as const },
  { id: 'msc', name: 'Microfinance Support Centre', type: 'microfinance' as const },
  { id: 'enterprise_uganda', name: 'Enterprise Uganda', type: 'government' as const },
  { id: 'ifc', name: 'International Finance Corporation (IFC)', type: 'dfi' as const },
  { id: 'afdb', name: 'African Development Bank (AfDB)', type: 'dfi' as const },
  { id: 'fmo', name: 'FMO (Netherlands)', type: 'dfi' as const },
  { id: 'bii', name: 'British International Investment (BII)', type: 'dfi' as const },
  { id: 'proparco', name: 'Proparco (France)', type: 'dfi' as const },
  { id: 'dfc', name: 'U.S. International DFC', type: 'dfi' as const },
  { id: 'eadb', name: 'East African Development Bank', type: 'dfi' as const },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// CURRENCIES
// ────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = ['UGX', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// ────────────────────────────────────────────────────────────────────────────
// INTEREST TYPES
// ────────────────────────────────────────────────────────────────────────────

export const INTEREST_TYPES = ['fixed', 'variable', 'reducing_balance'] as const;

export const INTEREST_TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixed Rate',
  variable: 'Variable Rate',
  reducing_balance: 'Reducing Balance',
};

// ────────────────────────────────────────────────────────────────────────────
// REPAYMENT FREQUENCIES
// ────────────────────────────────────────────────────────────────────────────

export const REPAYMENT_FREQUENCIES = [
  'monthly',
  'quarterly',
  'semi_annually',
  'annually',
  'bullet',
] as const;

export const REPAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annually: 'Semi-Annually',
  annually: 'Annually',
  bullet: 'Bullet (Lump Sum at Maturity)',
};

// ────────────────────────────────────────────────────────────────────────────
// READINESS SCORE THRESHOLDS
// ────────────────────────────────────────────────────────────────────────────

export const READINESS_THRESHOLDS = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 0,
} as const;

export const READINESS_LEVEL_LABELS: Record<string, string> = {
  excellent: 'Excellent — Ready to apply',
  good: 'Good — Minor gaps to address',
  fair: 'Fair — Significant preparation needed',
  poor: 'Poor — Major readiness gaps',
};

export const READINESS_LEVEL_COLORS: Record<string, string> = {
  excellent: '#4CAF50',
  good: '#8BC34A',
  fair: '#FF9800',
  poor: '#F44336',
};
