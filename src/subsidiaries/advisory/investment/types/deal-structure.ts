/**
 * Investment structure and capital stack types
 * 
 * Defines the various ways capital can be invested in infrastructure deals.
 */

import { MoneyAmount } from './deal';

export type InvestmentType = 
  | 'equity'            // Common/ordinary shares
  | 'preferred_equity'  // Preferred shares
  | 'mezzanine'        // Subordinated debt with equity kicker
  | 'senior_debt'      // Senior secured lending
  | 'subordinated_debt' // Junior debt
  | 'convertible'      // Convertible instruments
  | 'hybrid';          // Multiple instruments

export interface InvestmentStructure {
  primaryType: InvestmentType;
  instruments: InvestmentInstrument[];
  targetOwnership?: number;      // Percentage (for equity)
  targetYield?: number;          // Percentage (for debt)
  targetIRR?: number;            // Percentage
  expectedHoldPeriod?: number;   // Years
  exitStrategy?: ExitStrategy;
}

export interface InvestmentInstrument {
  id: string;
  type: InvestmentType;
  amount: MoneyAmount;
  terms: InstrumentTerms;
  notes?: string;
}

export interface InstrumentTerms {
  // Equity terms
  shareClass?: string;
  votingRights?: boolean;
  boardSeats?: number;
  antiDilution?: boolean;
  liquidationPreference?: number;
  
  // Debt terms
  interestRate?: number;
  interestType?: 'fixed' | 'floating';
  margin?: number;           // Basis points over reference rate
  referenceRate?: string;    // e.g., 'SOFR', 'LIBOR'
  tenor?: number;            // Years
  amortization?: AmortizationType;
  gracePeriod?: number;      // Months
  prepaymentPenalty?: number;
  
  // Convertible terms
  conversionPrice?: number;
  conversionRatio?: number;
  conversionTrigger?: string;
  
  // Security
  securityType?: SecurityType;
  securityDescription?: string;
  
  // Covenants
  financialCovenants?: FinancialCovenant[];
  otherCovenants?: string[];
}

export type AmortizationType = 
  | 'bullet'
  | 'amortizing'
  | 'balloon'
  | 'custom';

export type SecurityType =
  | 'unsecured'
  | 'first_lien'
  | 'second_lien'
  | 'share_pledge'
  | 'asset_pledge'
  | 'corporate_guarantee'
  | 'sovereign_guarantee';

export interface FinancialCovenant {
  type: CovenantType;
  threshold: number;
  frequency: 'monthly' | 'quarterly' | 'annually';
  description?: string;
}

export type CovenantType =
  | 'debt_service_coverage'  // DSCR
  | 'loan_to_value'          // LTV
  | 'debt_to_equity'
  | 'interest_coverage'
  | 'minimum_cash'
  | 'maximum_leverage'
  | 'revenue_coverage'
  | 'custom';

export type ExitStrategy =
  | 'trade_sale'          // Sale to strategic buyer
  | 'secondary_sale'      // Sale to another financial buyer
  | 'ipo'                 // Initial public offering
  | 'management_buyout'   // MBO
  | 'refinancing'         // Debt repayment
  | 'dividend_recap'      // Dividend recapitalization
  | 'liquidation'
  | 'undetermined';

// Capital structure for the entire deal/company
export interface CapitalStructure {
  totalCapitalization: MoneyAmount;
  layers: CapitalLayer[];
  proFormaDate: Date;
}

export interface CapitalLayer {
  type: InvestmentType;
  instrument: string;       // Description
  amount: MoneyAmount;
  percentOfTotal: number;
  provider: string;         // Investor/lender name
  terms: Partial<InstrumentTerms>;
}

// Helper functions
export function getInvestmentTypeDisplayName(type: InvestmentType): string {
  const names: Record<InvestmentType, string> = {
    equity: 'Equity',
    preferred_equity: 'Preferred Equity',
    mezzanine: 'Mezzanine',
    senior_debt: 'Senior Debt',
    subordinated_debt: 'Subordinated Debt',
    convertible: 'Convertible',
    hybrid: 'Hybrid',
  };
  return names[type] || type;
}

export function getExitStrategyDisplayName(strategy: ExitStrategy): string {
  const names: Record<ExitStrategy, string> = {
    trade_sale: 'Trade Sale',
    secondary_sale: 'Secondary Sale',
    ipo: 'IPO',
    management_buyout: 'Management Buyout',
    refinancing: 'Refinancing',
    dividend_recap: 'Dividend Recapitalization',
    liquidation: 'Liquidation',
    undetermined: 'Undetermined',
  };
  return names[strategy] || strategy;
}

export function getAmortizationTypeDisplayName(type: AmortizationType): string {
  const names: Record<AmortizationType, string> = {
    bullet: 'Bullet',
    amortizing: 'Amortizing',
    balloon: 'Balloon',
    custom: 'Custom',
  };
  return names[type] || type;
}

export function getSecurityTypeDisplayName(type: SecurityType): string {
  const names: Record<SecurityType, string> = {
    unsecured: 'Unsecured',
    first_lien: 'First Lien',
    second_lien: 'Second Lien',
    share_pledge: 'Share Pledge',
    asset_pledge: 'Asset Pledge',
    corporate_guarantee: 'Corporate Guarantee',
    sovereign_guarantee: 'Sovereign Guarantee',
  };
  return names[type] || type;
}

export function getCovenantTypeDisplayName(type: CovenantType): string {
  const names: Record<CovenantType, string> = {
    debt_service_coverage: 'Debt Service Coverage Ratio (DSCR)',
    loan_to_value: 'Loan to Value (LTV)',
    debt_to_equity: 'Debt to Equity',
    interest_coverage: 'Interest Coverage',
    minimum_cash: 'Minimum Cash',
    maximum_leverage: 'Maximum Leverage',
    revenue_coverage: 'Revenue Coverage',
    custom: 'Custom',
  };
  return names[type] || type;
}
