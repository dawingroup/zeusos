/**
 * Employee Constants - DawinOS v2.0
 * HR Central configuration constants
 */

// ============================================
// Employee Number Generation
// ============================================

export const EMPLOYEE_NUMBER_CONFIG = {
  prefix: 'EMP',
  separator: '-',
  sequenceLength: 4, // 0001, 0002, etc.
} as const;

// ============================================
// Default Leave Entitlements (Uganda)
// ============================================

export const DEFAULT_LEAVE_ENTITLEMENTS = {
  annualLeave: 21,           // 21 working days per year
  sickLeave: 14,             // 14 days per year
  maternityLeave: 60,        // 60 working days
  paternityLeave: 4,         // 4 working days
  compassionateLeave: 4,     // 4 days per occurrence
  studyLeave: 10,            // 10 days per year (if applicable)
  unpaidLeaveMax: 30,        // Max 30 days unpaid per year
  carryOverMax: 10,          // Max 10 days carry over
  carryOverExpiry: 3,        // Expires after 3 months
} as const;

// ============================================
// NSSF Configuration (Uganda)
// ============================================

export const NSSF_CONFIG = {
  employeeContribution: 5,   // 5%
  employerContribution: 10,  // 10%
  maxContributionBase: null, // No ceiling in Uganda
} as const;

// ============================================
// PAYE Tax Bands (Uganda 2024/2025)
// ============================================

export const PAYE_TAX_BANDS = [
  { min: 0, max: 235000, rate: 0 },                  // 0% up to 235,000
  { min: 235001, max: 335000, rate: 10 },            // 10%
  { min: 335001, max: 410000, rate: 20 },            // 20%
  { min: 410001, max: 10000000, rate: 30 },          // 30%
  { min: 10000001, max: Infinity, rate: 40 },        // 40% above 10M
] as const;

// Monthly threshold (annual / 12)
export const PAYE_MONTHLY_THRESHOLD = 235000;

// ============================================
// Local Service Tax (LST) Bands (Uganda)
// ============================================

export const LST_BANDS = [
  { min: 0, max: 100000, annual: 0 },                // Below 100,000/month - exempt
  { min: 100001, max: 200000, annual: 10000 },       // 100,001 - 200,000
  { min: 200001, max: 300000, annual: 20000 },       // 200,001 - 300,000
  { min: 300001, max: 400000, annual: 40000 },       // 300,001 - 400,000
  { min: 400001, max: 500000, annual: 60000 },       // 400,001 - 500,000
  { min: 500001, max: 750000, annual: 80000 },       // 500,001 - 750,000
  { min: 750001, max: 1000000, annual: 100000 },     // 750,001 - 1,000,000
  { min: 1000001, max: Infinity, annual: 100000 },   // Above 1,000,000
] as const;

// ============================================
// Work Schedule Defaults
// ============================================

export const DEFAULT_WORK_SCHEDULE = {
  type: 'full_time' as const,
  workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const,
  startTime: '08:00',
  endTime: '17:00',
  breakDuration: 60, // 1 hour
  weeklyHours: 40,
  isRemoteEligible: false,
};

// ============================================
// Probation Configuration
// ============================================

export const PROBATION_CONFIG = {
  defaultDurationMonths: 3,
  maxDurationMonths: 6,
  reminderDaysBefore: [30, 14, 7], // Days before end to send reminders
} as const;

// ============================================
// Notice Period Configuration (Uganda)
// ============================================

export const NOTICE_PERIOD_CONFIG = {
  byEmploymentType: {
    permanent: 30,        // 30 days (1 month)
    contract: 14,         // 14 days (2 weeks)
    probation: 7,         // 7 days
    part_time: 14,        // 14 days
    casual: 1,            // 1 day
    intern: 7,            // 7 days
    consultant: 30,       // Per contract
  },
  byTenureYears: [
    { minYears: 0, maxYears: 1, days: 14 },     // Less than 1 year
    { minYears: 1, maxYears: 5, days: 30 },     // 1-5 years
    { minYears: 5, maxYears: 10, days: 60 },    // 5-10 years
    { minYears: 10, maxYears: Infinity, days: 90 }, // 10+ years
  ],
} as const;

// ============================================
// Document Configuration
// ============================================

export const EMPLOYEE_DOCUMENT_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  requiredDocuments: [
    'national_id',
    'tax_certificate',
    'signed_contract',
    'passport_photo',
  ],
} as const;

// ============================================
// Banks in Uganda
// ============================================

export const UGANDA_BANKS = [
  { code: 'BOA', name: 'Bank of Africa' },
  { code: 'BOB', name: 'Bank of Baroda' },
  { code: 'BOU', name: 'Bank of Uganda' },
  { code: 'CEN', name: 'Centenary Bank' },
  { code: 'CIT', name: 'Citibank Uganda' },
  { code: 'CRN', name: 'Crane Bank' },
  { code: 'DEF', name: 'DFCU Bank' },
  { code: 'DTB', name: 'Diamond Trust Bank' },
  { code: 'ECO', name: 'Ecobank Uganda' },
  { code: 'EQU', name: 'Equity Bank Uganda' },
  { code: 'GTB', name: 'GT Bank Uganda' },
  { code: 'HFC', name: 'Housing Finance Bank' },
  { code: 'KCB', name: 'KCB Bank Uganda' },
  { code: 'NIC', name: 'NC Bank Uganda' },
  { code: 'ORN', name: 'Orient Bank' },
  { code: 'SBU', name: 'Stanbic Bank Uganda' },
  { code: 'SCB', name: 'Standard Chartered Bank' },
  { code: 'UBA', name: 'United Bank for Africa' },
  { code: 'ABC', name: 'ABC Capital Bank' },
  { code: 'TRO', name: 'Tropical Bank' },
  { code: 'FIN', name: 'Finance Trust Bank' },
  { code: 'POS', name: 'PostBank Uganda' },
] as const;

// ============================================
// Mobile Money Providers (Uganda)
// ============================================

export const MOBILE_MONEY_PROVIDERS = [
  { code: 'mtn', name: 'MTN Mobile Money', prefix: ['077', '078', '039'] },
  { code: 'airtel', name: 'Airtel Money', prefix: ['070', '075', '074'] },
] as const;

// ============================================
// Districts in Uganda (for addresses)
// ============================================

export const UGANDA_REGIONS = {
  Central: [
    'Kampala', 'Wakiso', 'Mukono', 'Buikwe', 'Kayunga', 'Luwero',
    'Nakasongola', 'Nakaseke', 'Mpigi', 'Butambala', 'Gomba', 'Mityana',
    'Mubende', 'Kiboga', 'Kyankwanzi', 'Kalangala', 'Kalungu', 'Lwengo',
    'Lyantonde', 'Masaka', 'Rakai', 'Sembabule', 'Bukomansimbi', 'Buvuma',
  ],
  Eastern: [
    'Jinja', 'Iganga', 'Kamuli', 'Kaliro', 'Buyende', 'Luuka', 'Namutumba',
    'Bugiri', 'Namayingo', 'Busia', 'Tororo', 'Butaleja', 'Kibuku',
    'Budaka', 'Pallisa', 'Mbale', 'Sironko', 'Manafwa', 'Bududa',
    'Bulambuli', 'Kapchorwa', 'Kween', 'Bukwo', 'Soroti', 'Serere',
    'Kumi', 'Ngora', 'Bukedea', 'Katakwi', 'Amuria', 'Kaberamaido',
  ],
  Northern: [
    'Gulu', 'Amuru', 'Nwoya', 'Omoro', 'Lira', 'Alebtong', 'Otuke',
    'Dokolo', 'Kole', 'Apac', 'Kwania', 'Oyam', 'Pader', 'Agago',
    'Kitgum', 'Lamwo', 'Adjumani', 'Moyo', 'Yumbe', 'Koboko', 'Maracha',
    'Arua', 'Nebbi', 'Pakwach', 'Zombo', 'Kaabong', 'Kotido', 'Abim',
    'Napak', 'Moroto', 'Nakapiripirit', 'Amudat',
  ],
  Western: [
    'Mbarara', 'Kiruhura', 'Isingiro', 'Ntungamo', 'Rukungiri', 'Kanungu',
    'Kisoro', 'Kabale', 'Rubanda', 'Rukiga', 'Bushenyi', 'Buhweju',
    'Mitooma', 'Rubirizi', 'Sheema', 'Ibanda', 'Kamwenge', 'Kabarole',
    'Kyenjojo', 'Kyegegwa', 'Kasese', 'Bunyangabu', 'Bundibugyo', 'Ntoroko',
    'Hoima', 'Kibaale', 'Kakumiro', 'Kagadi', 'Masindi', 'Kiryandongo',
    'Buliisa', 'Fort Portal City',
  ],
} as const;

/**
 * Get all Uganda districts as a flat array
 */
export function getAllUgandaDistricts(): string[] {
  return Object.values(UGANDA_REGIONS).flat();
}

/**
 * Get region for a given district
 */
export function getRegionForDistrict(district: string): string | null {
  for (const [region, districts] of Object.entries(UGANDA_REGIONS)) {
    if ((districts as readonly string[]).includes(district)) {
      return region;
    }
  }
  return null;
}

// ============================================
// Employment Status Transitions
// ============================================

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  probation: ['active', 'terminated', 'resigned'],
  active: ['suspended', 'notice_period', 'on_leave', 'terminated', 'resigned', 'retired'],
  suspended: ['active', 'terminated', 'resigned'],
  notice_period: ['terminated', 'resigned'],
  on_leave: ['active', 'terminated', 'resigned'],
  terminated: [], // Terminal state
  resigned: [],   // Terminal state
  retired: [],    // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!validTransitions) return false;
  return validTransitions.includes(newStatus);
}

// ============================================
// Module Configuration
// ============================================

export const HR_CENTRAL_CONFIG = {
  // Employee limits per subsidiary (for licensing)
  maxEmployeesPerSubsidiary: 500,
  
  // Pagination
  defaultPageSize: 25,
  maxPageSize: 100,
  
  // Search
  minSearchLength: 2,
  maxSearchResults: 50,
  
  // Audit retention
  auditRetentionDays: 365 * 7, // 7 years
  
  // Cache TTL
  employeeListCacheTTL: 5 * 60 * 1000,     // 5 minutes
  employeeDetailCacheTTL: 2 * 60 * 1000,   // 2 minutes
  statsCacheTTL: 15 * 60 * 1000,           // 15 minutes
  
  // Timezone
  defaultTimezone: 'Africa/Kampala',
  
  // Currency
  defaultCurrency: 'UGX',
} as const;

// ============================================
// Employment Status Labels
// ============================================

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  probation: 'Probation',
  suspended: 'Suspended',
  notice_period: 'Notice Period',
  on_leave: 'On Leave',
  terminated: 'Terminated',
  resigned: 'Resigned',
  retired: 'Retired',
};

// ============================================
// Employment Type Labels
// ============================================

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: 'Permanent',
  contract: 'Contract',
  probation: 'Probation',
  part_time: 'Part Time',
  casual: 'Casual',
  intern: 'Intern',
  consultant: 'Consultant',
};

// ============================================
// Gender Labels
// ============================================

export const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

// ============================================
// Marital Status Labels
// ============================================

export const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married: 'Married',
  divorced: 'Divorced',
  widowed: 'Widowed',
  separated: 'Separated',
};

// ============================================
// Termination Reason Labels
// ============================================

export const TERMINATION_REASON_LABELS: Record<string, string> = {
  resignation: 'Resignation',
  dismissal: 'Dismissal',
  redundancy: 'Redundancy',
  contract_end: 'Contract End',
  retirement: 'Retirement',
  death: 'Death',
  mutual_agreement: 'Mutual Agreement',
  abandonment: 'Job Abandonment',
  medical: 'Medical Incapacity',
  other: 'Other',
};

// ============================================
// Tax Calculation Helpers
// ============================================

/**
 * Calculate PAYE tax for a given monthly income
 */
export function calculatePAYE(monthlyIncome: number): number {
  if (monthlyIncome <= PAYE_TAX_BANDS[0].max) {
    return 0;
  }
  
  let tax = 0;
  let remaining = monthlyIncome;
  
  for (const band of PAYE_TAX_BANDS) {
    if (remaining <= 0) break;
    
    const taxableInBand = Math.min(remaining, band.max - band.min + 1);
    if (taxableInBand > 0 && remaining > band.min) {
      const actualTaxable = Math.min(taxableInBand, remaining - band.min);
      tax += actualTaxable * (band.rate / 100);
      remaining -= actualTaxable;
    }
  }
  
  return Math.round(tax);
}

/**
 * Calculate LST for a given monthly income
 */
export function calculateLST(monthlyIncome: number): { annual: number; monthly: number } {
  for (const band of LST_BANDS) {
    if (monthlyIncome >= band.min && monthlyIncome <= band.max) {
      return {
        annual: band.annual,
        monthly: Math.round(band.annual / 12),
      };
    }
  }
  return { annual: 0, monthly: 0 };
}

/**
 * Calculate NSSF contributions
 */
export function calculateNSSF(grossSalary: number): {
  employee: number;
  employer: number;
  total: number;
} {
  const employee = Math.round(grossSalary * (NSSF_CONFIG.employeeContribution / 100));
  const employer = Math.round(grossSalary * (NSSF_CONFIG.employerContribution / 100));
  return {
    employee,
    employer,
    total: employee + employer,
  };
}
