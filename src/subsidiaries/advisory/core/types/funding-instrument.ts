import { FundingCategory } from './funding-category';

/**
 * FUNDING INSTRUMENT
 * Specific instrument type within a category
 */
export type FundingInstrument =
  // Grant Instruments
  | 'unrestricted_grant'
  | 'restricted_grant'
  | 'project_grant'
  | 'capacity_building_grant'
  | 'matching_grant'
  | 'challenge_grant'
  | 'technical_assistance_grant'
  
  // Concessional Instruments
  | 'concessional_loan'
  | 'soft_loan'
  | 'ida_credit'           // IDA-style credit
  | 'results_based_loan'
  | 'convertible_grant'    // Grant converting to loan
  
  // Government Instruments
  | 'budget_allocation'
  | 'development_budget'
  | 'constituency_fund'
  | 'special_purpose_fund'
  
  // Commercial Debt Instruments
  | 'term_loan'
  | 'project_finance_loan'
  | 'syndicated_loan'
  | 'green_bond'
  | 'infrastructure_bond'
  | 'corporate_bond'
  | 'bridge_loan'
  | 'working_capital'
  | 'revolving_facility'
  | 'mezzanine_debt'
  | 'subordinated_debt'
  
  // Equity Instruments
  | 'common_equity'
  | 'preferred_equity'
  | 'convertible_preferred'
  | 'private_equity'
  | 'venture_capital'
  | 'development_equity'    // DFI equity
  | 'patient_capital'
  
  // Guarantee Instruments
  | 'partial_credit_guarantee'
  | 'partial_risk_guarantee'
  | 'first_loss_guarantee'
  | 'portfolio_guarantee'
  | 'political_risk_insurance'
  
  // Islamic Finance
  | 'sukuk'
  | 'murabaha'
  | 'ijara'
  | 'istisna'
  
  // Other
  | 'in_kind'
  | 'other';

/**
 * INSTRUMENT INFO
 * Metadata about a funding instrument
 */
export interface InstrumentInfo {
  instrument: FundingInstrument;
  category: FundingCategory;
  displayName: string;
  description: string;
  isDebt: boolean;
  isEquity: boolean;
  hasInterest: boolean;
  hasMaturity: boolean;
}

/**
 * Instrument definitions map
 */
const INSTRUMENT_DEFINITIONS: Record<FundingInstrument, Omit<InstrumentInfo, 'instrument'>> = {
  // Grants
  unrestricted_grant: {
    category: 'grant',
    displayName: 'Unrestricted Grant',
    description: 'Flexible grant funding with minimal restrictions',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  restricted_grant: {
    category: 'grant',
    displayName: 'Restricted Grant',
    description: 'Grant with specific use restrictions',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  project_grant: {
    category: 'grant',
    displayName: 'Project Grant',
    description: 'Grant for specific project implementation',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  capacity_building_grant: {
    category: 'grant',
    displayName: 'Capacity Building Grant',
    description: 'Grant for organizational development',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  matching_grant: {
    category: 'grant',
    displayName: 'Matching Grant',
    description: 'Grant matching other funding sources',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  challenge_grant: {
    category: 'grant',
    displayName: 'Challenge Grant',
    description: 'Competitive grant based on outcomes',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  technical_assistance_grant: {
    category: 'grant',
    displayName: 'Technical Assistance Grant',
    description: 'Grant for technical support and advisory',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  
  // Concessional
  concessional_loan: {
    category: 'concessional',
    displayName: 'Concessional Loan',
    description: 'Below-market rate loan from development funder',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  soft_loan: {
    category: 'concessional',
    displayName: 'Soft Loan',
    description: 'Low-interest loan with flexible terms',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  ida_credit: {
    category: 'concessional',
    displayName: 'IDA Credit',
    description: 'Zero/low interest credit from multilaterals',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  results_based_loan: {
    category: 'concessional',
    displayName: 'Results-Based Loan',
    description: 'Loan with disbursement linked to results',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  convertible_grant: {
    category: 'concessional',
    displayName: 'Convertible Grant',
    description: 'Grant that converts to loan on success',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  
  // Government
  budget_allocation: {
    category: 'government',
    displayName: 'Budget Allocation',
    description: 'Government ministry budget line',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  development_budget: {
    category: 'government',
    displayName: 'Development Budget',
    description: 'Government capital/development expenditure',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  constituency_fund: {
    category: 'government',
    displayName: 'Constituency Fund',
    description: 'Local government development allocation',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  special_purpose_fund: {
    category: 'government',
    displayName: 'Special Purpose Fund',
    description: 'Government earmarked fund',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  
  // Commercial Debt
  term_loan: {
    category: 'commercial_debt',
    displayName: 'Term Loan',
    description: 'Fixed-term commercial loan',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  project_finance_loan: {
    category: 'commercial_debt',
    displayName: 'Project Finance Loan',
    description: 'Non-recourse project-backed loan',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  syndicated_loan: {
    category: 'commercial_debt',
    displayName: 'Syndicated Loan',
    description: 'Multi-lender facility',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  green_bond: {
    category: 'commercial_debt',
    displayName: 'Green Bond',
    description: 'Bond for environmental projects',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  infrastructure_bond: {
    category: 'commercial_debt',
    displayName: 'Infrastructure Bond',
    description: 'Long-tenor infrastructure financing',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  corporate_bond: {
    category: 'commercial_debt',
    displayName: 'Corporate Bond',
    description: 'Corporate debt security',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  bridge_loan: {
    category: 'commercial_debt',
    displayName: 'Bridge Loan',
    description: 'Short-term bridge financing',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  working_capital: {
    category: 'commercial_debt',
    displayName: 'Working Capital',
    description: 'Operating capital facility',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  revolving_facility: {
    category: 'commercial_debt',
    displayName: 'Revolving Facility',
    description: 'Revolving credit line',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  mezzanine_debt: {
    category: 'commercial_debt',
    displayName: 'Mezzanine Debt',
    description: 'Subordinated debt with equity features',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  subordinated_debt: {
    category: 'commercial_debt',
    displayName: 'Subordinated Debt',
    description: 'Junior debt ranking',
    isDebt: true,
    isEquity: false,
    hasInterest: true,
    hasMaturity: true,
  },
  
  // Equity
  common_equity: {
    category: 'equity',
    displayName: 'Common Equity',
    description: 'Ordinary share capital',
    isDebt: false,
    isEquity: true,
    hasInterest: false,
    hasMaturity: false,
  },
  preferred_equity: {
    category: 'equity',
    displayName: 'Preferred Equity',
    description: 'Preference shares',
    isDebt: false,
    isEquity: true,
    hasInterest: false,
    hasMaturity: false,
  },
  convertible_preferred: {
    category: 'equity',
    displayName: 'Convertible Preferred',
    description: 'Convertible preference shares',
    isDebt: false,
    isEquity: true,
    hasInterest: false,
    hasMaturity: false,
  },
  private_equity: {
    category: 'equity',
    displayName: 'Private Equity',
    description: 'PE fund investment',
    isDebt: false,
    isEquity: true,
    hasInterest: false,
    hasMaturity: false,
  },
  venture_capital: {
    category: 'equity',
    displayName: 'Venture Capital',
    description: 'VC investment',
    isDebt: false,
    isEquity: true,
    hasInterest: false,
    hasMaturity: false,
  },
  development_equity: {
    category: 'equity',
    displayName: 'Development Equity',
    description: 'DFI equity investment',
    isDebt: false,
    isEquity: true,
    hasInterest: false,
    hasMaturity: false,
  },
  patient_capital: {
    category: 'equity',
    displayName: 'Patient Capital',
    description: 'Long-horizon impact equity',
    isDebt: false,
    isEquity: true,
    hasInterest: false,
    hasMaturity: false,
  },
  
  // Guarantees
  partial_credit_guarantee: {
    category: 'guarantee',
    displayName: 'Partial Credit Guarantee',
    description: 'Credit enhancement covering portion of debt',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  partial_risk_guarantee: {
    category: 'guarantee',
    displayName: 'Partial Risk Guarantee',
    description: 'Coverage for specific risks',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  first_loss_guarantee: {
    category: 'guarantee',
    displayName: 'First Loss Guarantee',
    description: 'First loss coverage',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  portfolio_guarantee: {
    category: 'guarantee',
    displayName: 'Portfolio Guarantee',
    description: 'Coverage for loan portfolio',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  political_risk_insurance: {
    category: 'guarantee',
    displayName: 'Political Risk Insurance',
    description: 'Coverage for political risks',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  
  // Islamic Finance
  sukuk: {
    category: 'commercial_debt',
    displayName: 'Sukuk',
    description: 'Islamic bond',
    isDebt: true,
    isEquity: false,
    hasInterest: false, // Profit-sharing, not interest
    hasMaturity: true,
  },
  murabaha: {
    category: 'commercial_debt',
    displayName: 'Murabaha',
    description: 'Cost-plus financing',
    isDebt: true,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  ijara: {
    category: 'commercial_debt',
    displayName: 'Ijara',
    description: 'Islamic lease financing',
    isDebt: true,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  istisna: {
    category: 'commercial_debt',
    displayName: 'Istisna',
    description: 'Islamic project finance',
    isDebt: true,
    isEquity: false,
    hasInterest: false,
    hasMaturity: true,
  },
  
  // Other
  in_kind: {
    category: 'grant',
    displayName: 'In-Kind',
    description: 'Non-monetary contribution',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
  other: {
    category: 'internal',
    displayName: 'Other',
    description: 'Other funding type',
    isDebt: false,
    isEquity: false,
    hasInterest: false,
    hasMaturity: false,
  },
};

/**
 * Get instrument info
 */
export function getInstrumentInfo(instrument: FundingInstrument): InstrumentInfo {
  return { instrument, ...INSTRUMENT_DEFINITIONS[instrument] };
}

/**
 * Get instrument display name
 */
export function getInstrumentDisplayName(instrument: FundingInstrument): string {
  return INSTRUMENT_DEFINITIONS[instrument].displayName;
}

/**
 * Get instruments for a category
 */
export function getInstrumentsForCategory(category: FundingCategory): FundingInstrument[] {
  return (Object.keys(INSTRUMENT_DEFINITIONS) as FundingInstrument[]).filter(
    inst => INSTRUMENT_DEFINITIONS[inst].category === category
  );
}

/**
 * Get all debt instruments
 */
export function getDebtInstruments(): FundingInstrument[] {
  return (Object.keys(INSTRUMENT_DEFINITIONS) as FundingInstrument[]).filter(
    inst => INSTRUMENT_DEFINITIONS[inst].isDebt
  );
}

/**
 * Get all equity instruments
 */
export function getEquityInstruments(): FundingInstrument[] {
  return (Object.keys(INSTRUMENT_DEFINITIONS) as FundingInstrument[]).filter(
    inst => INSTRUMENT_DEFINITIONS[inst].isEquity
  );
}

/**
 * Get all grant instruments
 */
export function getGrantInstruments(): FundingInstrument[] {
  return getInstrumentsForCategory('grant');
}

/**
 * All funding instruments
 */
export const ALL_FUNDING_INSTRUMENTS: FundingInstrument[] = Object.keys(
  INSTRUMENT_DEFINITIONS
) as FundingInstrument[];
