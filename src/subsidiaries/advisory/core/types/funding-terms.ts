import { Timestamp } from 'firebase/firestore';
import { Money } from './money';

/**
 * INTEREST RATE TYPE
 */
export type InterestRateType = 'fixed' | 'floating' | 'hybrid';

/**
 * INTEREST RATE BASIS
 */
export type InterestRateBasis = 
  | 'sofr'
  | 'euribor'
  | 'libor'        // Legacy
  | 'prime'
  | 'treasury'
  | 'custom';

/**
 * REPAYMENT FREQUENCY
 */
export type RepaymentFrequency = 
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'bullet'       // Single payment at maturity
  | 'custom';

/**
 * AMORTIZATION TYPE
 */
export type AmortizationType = 'straight_line' | 'mortgage_style' | 'bullet' | 'custom';

/**
 * SECURITY TYPE
 */
export type SecurityType = 'unsecured' | 'secured' | 'project_assets' | 'corporate_guarantee' | 'other';

/**
 * ANTI DILUTION TYPE
 */
export type AntiDilutionType = 'full_ratchet' | 'weighted_average' | 'none';

/**
 * GUARANTEE RISK TYPE
 */
export type GuaranteeRiskType =
  | 'credit_risk'
  | 'political_risk'
  | 'currency_risk'
  | 'construction_risk'
  | 'off_take_risk'
  | 'regulatory_risk'
  | 'force_majeure';

/**
 * BASE FUNDING TERMS
 * Common terms across all funding types
 */
export interface BaseFundingTerms {
  /** Effective date of funding */
  effectiveDate: Timestamp;
  
  /** Currency */
  currency: string;
  
  /** Total commitment amount */
  commitmentAmount: Money;
  
  /** Conditions precedent */
  conditionsPrecedent?: string[];
  
  /** Conditions subsequent */
  conditionsSubsequent?: string[];
}

/**
 * MATCHING REQUIREMENTS
 */
export interface MatchingRequirements {
  /** Matching ratio (e.g., 1:1) */
  ratio: number;
  
  /** Deadline for matching */
  deadline?: Timestamp;
  
  /** Source restrictions for matching funds */
  sourceRestrictions?: string[];
}

/**
 * GRANT TERMS
 */
export interface GrantTerms extends BaseFundingTerms {
  type: 'grant';
  
  /** Grant period end date */
  grantEndDate: Timestamp;
  
  /** Is restricted by use */
  isRestricted: boolean;
  
  /** Restriction categories */
  restrictedCategories?: string[];
  
  /** Matching requirements */
  matchingRequirements?: MatchingRequirements;
  
  /** Co-funding requirements */
  coFundingRequired?: boolean;
  
  /** Cost share percentage required */
  costSharePercentage?: number;
  
  /** Indirect cost rate cap */
  indirectCostRateCap?: number;
}

/**
 * DEBT TERMS
 */
export interface DebtTerms extends BaseFundingTerms {
  type: 'debt';
  
  /** Principal amount */
  principalAmount: Money;
  
  /** Maturity date */
  maturityDate: Timestamp;
  
  /** Tenor in months */
  tenorMonths: number;
  
  /** Grace period in months */
  gracePeriodMonths: number;
  
  /** Interest rate type */
  interestRateType: InterestRateType;
  
  /** Fixed rate (if applicable) */
  fixedRate?: number;
  
  /** Floating rate basis (if applicable) */
  floatingRateBasis?: InterestRateBasis;
  
  /** Spread over basis (bps) */
  spreadBps?: number;
  
  /** Interest rate cap */
  interestRateCap?: number;
  
  /** Interest rate floor */
  interestRateFloor?: number;
  
  /** Repayment frequency */
  repaymentFrequency: RepaymentFrequency;
  
  /** Amortization type */
  amortization: AmortizationType;
  
  /** Balloon payment at maturity */
  balloonPayment?: Money;
  
  /** Prepayment allowed */
  prepaymentAllowed: boolean;
  
  /** Prepayment penalty percentage */
  prepaymentPenalty?: number;
  
  /** Security/collateral type */
  securityType?: SecurityType;
  
  /** Security description */
  securityDescription?: string;
  
  /** Debt service coverage ratio requirement */
  dscrRequirement?: number;
  
  /** Loan-to-value ratio requirement */
  ltvRequirement?: number;
}

/**
 * DIVIDEND RIGHTS
 */
export interface DividendRights {
  isPreferred: boolean;
  rate?: number;
  isCumulative: boolean;
  isParticipating: boolean;
}

/**
 * LIQUIDATION PREFERENCE
 */
export interface LiquidationPreference {
  /** Multiple (e.g., 1x, 2x) */
  multiple: number;
  
  /** Is participating after preference */
  isParticipating: boolean;
  
  /** Cap on participation */
  cap?: number;
}

/**
 * OPTION TERMS
 */
export interface OptionTerms {
  startDate: Timestamp;
  price?: Money;
  priceFormula?: string;
}

/**
 * EQUITY TERMS
 */
export interface EquityTerms extends BaseFundingTerms {
  type: 'equity';
  
  /** Number of shares */
  numberOfShares?: number;
  
  /** Share class */
  shareClass?: string;
  
  /** Price per share */
  pricePerShare?: Money;
  
  /** Ownership percentage */
  ownershipPercentage: number;
  
  /** Voting rights percentage */
  votingRightsPercentage?: number;
  
  /** Board representation */
  boardSeats?: number;
  
  /** Dividend rights */
  dividendRights?: DividendRights;
  
  /** Liquidation preference */
  liquidationPreference?: LiquidationPreference;
  
  /** Anti-dilution protection */
  antiDilution?: AntiDilutionType;
  
  /** Exit timeline expectation */
  expectedHoldingPeriodYears?: number;
  
  /** Target IRR */
  targetIRR?: number;
  
  /** Target multiple */
  targetMultiple?: number;
  
  /** Tag-along rights */
  tagAlongRights: boolean;
  
  /** Drag-along rights */
  dragAlongRights: boolean;
  
  /** Right of first refusal */
  rofrRights: boolean;
  
  /** Put option */
  putOption?: OptionTerms;
  
  /** Call option */
  callOption?: OptionTerms;
}

/**
 * GUARANTEE TERMS
 */
export interface GuaranteeTerms extends BaseFundingTerms {
  type: 'guarantee';
  
  /** Guaranteed amount */
  guaranteedAmount: Money;
  
  /** Coverage percentage */
  coveragePercentage: number;
  
  /** Guarantee expiry date */
  expiryDate: Timestamp;
  
  /** Guarantee fee (bps per annum) */
  guaranteeFeeBps: number;
  
  /** Upfront fee */
  upfrontFee?: Money;
  
  /** Risk types covered */
  risksCovered: GuaranteeRiskType[];
  
  /** Claim conditions */
  claimConditions?: string[];
  
  /** Waiting period for claim (days) */
  claimWaitingPeriodDays?: number;
  
  /** Maximum claim amount */
  maxClaimAmount?: Money;
  
  /** Subrogation rights */
  subrogationRights: boolean;
}

/**
 * FUNDING TERMS (Union type)
 */
export type FundingTerms = GrantTerms | DebtTerms | EquityTerms | GuaranteeTerms;

/**
 * FUNDING TERMS TYPE
 */
export type FundingTermsType = 'grant' | 'debt' | 'equity' | 'guarantee';

/**
 * Type guard for grant terms
 */
export function isGrantTerms(terms: FundingTerms): terms is GrantTerms {
  return terms.type === 'grant';
}

/**
 * Type guard for debt terms
 */
export function isDebtTerms(terms: FundingTerms): terms is DebtTerms {
  return terms.type === 'debt';
}

/**
 * Type guard for equity terms
 */
export function isEquityTerms(terms: FundingTerms): terms is EquityTerms {
  return terms.type === 'equity';
}

/**
 * Type guard for guarantee terms
 */
export function isGuaranteeTerms(terms: FundingTerms): terms is GuaranteeTerms {
  return terms.type === 'guarantee';
}

/**
 * Calculate all-in cost for debt
 */
export function calculateAllInCost(terms: DebtTerms): number {
  if (terms.interestRateType === 'fixed') {
    return terms.fixedRate || 0;
  }
  // For floating, return spread (actual rate depends on reference rate)
  return (terms.spreadBps || 0) / 100;
}

/**
 * Get repayment frequency display
 */
export function getRepaymentFrequencyDisplay(frequency: RepaymentFrequency): string {
  const displays: Record<RepaymentFrequency, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semi_annual: 'Semi-Annual',
    annual: 'Annual',
    bullet: 'Bullet (at Maturity)',
    custom: 'Custom Schedule',
  };
  return displays[frequency];
}

/**
 * Get interest rate basis display
 */
export function getInterestRateBasisDisplay(basis: InterestRateBasis): string {
  const displays: Record<InterestRateBasis, string> = {
    sofr: 'SOFR',
    euribor: 'EURIBOR',
    libor: 'LIBOR (Legacy)',
    prime: 'Prime Rate',
    treasury: 'Treasury',
    custom: 'Custom',
  };
  return displays[basis];
}

/**
 * Get guarantee risk type display
 */
export function getGuaranteeRiskTypeDisplay(riskType: GuaranteeRiskType): string {
  const displays: Record<GuaranteeRiskType, string> = {
    credit_risk: 'Credit Risk',
    political_risk: 'Political Risk',
    currency_risk: 'Currency Risk',
    construction_risk: 'Construction Risk',
    off_take_risk: 'Off-Take Risk',
    regulatory_risk: 'Regulatory Risk',
    force_majeure: 'Force Majeure',
  };
  return displays[riskType];
}
