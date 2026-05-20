import { Money } from './money';
import { Sector } from './engagement-domain';

/**
 * NET WORTH RANGE
 * For investment advisory clients
 */
export type NetWorthRange =
  | 'under_1m'
  | '1m_5m'
  | '5m_25m'
  | '25m_100m'
  | '100m_500m'
  | 'over_500m';

/**
 * RISK TOLERANCE
 */
export type RiskTolerance =
  | 'conservative'
  | 'moderately_conservative'
  | 'moderate'
  | 'moderately_aggressive'
  | 'aggressive';

/**
 * INVESTMENT NEED
 */
export type InvestmentNeed =
  | 'capital_preservation'
  | 'income_generation'
  | 'balanced_growth'
  | 'capital_appreciation'
  | 'aggressive_growth';

/**
 * ASSET CLASS
 */
export type AssetClass =
  | 'public_equity'
  | 'fixed_income'
  | 'real_estate'
  | 'private_equity'
  | 'infrastructure'
  | 'hedge_funds'
  | 'commodities'
  | 'cash'
  | 'alternatives';

/**
 * RISK PROFILE
 * Investment risk assessment
 */
export interface RiskProfile {
  /** Risk tolerance from questionnaire */
  tolerance: RiskTolerance;
  
  /** Risk capacity (objective assessment) */
  capacity: 'low' | 'medium' | 'high';
  
  /** Investment need/objective */
  need: InvestmentNeed;
  
  /** Time horizon in years */
  timeHorizon: number;
  
  /** Questionnaire score (0-100) */
  questionnaireScore: number;
  
  /** Identified behavioral biases */
  behavioralBiases: string[];
  
  /** Last assessment date */
  lastAssessmentDate: Date;
}

/**
 * ASSET CLASS PREFERENCE
 */
export interface AssetClassPreference {
  class: AssetClass;
  preference: 'preferred' | 'acceptable' | 'excluded';
}

/**
 * GEOGRAPHIC PREFERENCE
 */
export interface GeographicPreference {
  region: string;
  preference: 'preferred' | 'acceptable' | 'excluded';
}

/**
 * SECTOR PREFERENCE
 */
export interface SectorPreference {
  sector: Sector;
  preference: 'preferred' | 'acceptable' | 'excluded';
}

/**
 * ESG PREFERENCES
 */
export interface ESGPreferences {
  /** Importance of ESG */
  importance: 'not_important' | 'somewhat_important' | 'very_important' | 'primary_driver';
  
  /** Excluded sectors/activities */
  exclusions: string[];
  
  /** Impact focus areas */
  impactFocus?: string[];
}

/**
 * INCOME REQUIREMENTS
 */
export interface IncomeRequirements {
  amount: Money;
  frequency: 'monthly' | 'quarterly' | 'annually';
}

/**
 * INVESTMENT PREFERENCES
 */
export interface InvestmentPreferences {
  /** Asset class preferences */
  assetClasses: AssetClassPreference[];
  
  /** Geographic preferences */
  geographies: GeographicPreference[];
  
  /** Sector preferences */
  sectors: SectorPreference[];
  
  /** ESG preferences */
  esg: ESGPreferences;
  
  /** Liquidity needs */
  liquidityNeeds: 'high' | 'medium' | 'low';
  
  /** Income requirements */
  incomeRequirements?: IncomeRequirements;
}

/**
 * INVESTOR PROFILE
 * Extended profile for investment advisory clients
 */
export interface InvestorProfile {
  /** Investor sophistication level */
  sophistication: 'retail' | 'accredited' | 'qualified' | 'institutional';
  
  /** Net worth range */
  netWorthRange: NetWorthRange;
  
  /** Liquid net worth (if disclosed) */
  liquidNetWorth?: Money;
  
  /** Annual income (if disclosed) */
  annualIncome?: Money;
  
  /** Investment experience in years */
  investmentExperience: number;
  
  /** Risk profile */
  riskProfile: RiskProfile;
  
  /** Source of wealth */
  sourceOfWealth: string[];
  
  /** Source of funds (for AML) */
  sourceOfFunds: string;
  
  /** Investment preferences */
  preferences: InvestmentPreferences;
}

/**
 * ORGANIZATION REGISTRATION
 */
export interface OrganizationRegistration {
  /** Registration type (e.g., "501(c)(3)", "Company Limited by Guarantee") */
  type: string;
  
  /** Registration number */
  number: string;
  
  /** Registering authority */
  authority: string;
  
  /** Registration date */
  date: Date;
}

/**
 * PARENT ORGANIZATION
 */
export interface ParentOrganization {
  name: string;
  country: string;
}

/**
 * ORGANIZATION PROFILE
 * Extended profile for institutional/program clients
 */
export interface OrganizationProfile {
  /** Primary sector focus */
  sectors: Sector[];
  
  /** Mission statement */
  missionStatement?: string;
  
  /** Annual budget/revenue */
  annualBudget?: Money;
  
  /** Staff count */
  staffCount?: number;
  
  /** Geographic focus areas */
  geographicFocus: string[];
  
  /** Year established */
  yearEstablished?: number;
  
  /** Registration details */
  registration?: OrganizationRegistration;
  
  /** Parent organization (if subsidiary) */
  parentOrganization?: ParentOrganization;
  
  /** Key accreditations/certifications */
  accreditations?: string[];
}

/**
 * Get net worth range display
 */
export function getNetWorthRangeDisplay(range: NetWorthRange): string {
  const displays: Record<NetWorthRange, string> = {
    under_1m: 'Under $1M',
    '1m_5m': '$1M - $5M',
    '5m_25m': '$5M - $25M',
    '25m_100m': '$25M - $100M',
    '100m_500m': '$100M - $500M',
    over_500m: 'Over $500M',
  };
  return displays[range];
}

/**
 * Get risk tolerance display
 */
export function getRiskToleranceDisplay(tolerance: RiskTolerance): string {
  const displays: Record<RiskTolerance, string> = {
    conservative: 'Conservative',
    moderately_conservative: 'Moderately Conservative',
    moderate: 'Moderate',
    moderately_aggressive: 'Moderately Aggressive',
    aggressive: 'Aggressive',
  };
  return displays[tolerance];
}

/**
 * Get investment need display
 */
export function getInvestmentNeedDisplay(need: InvestmentNeed): string {
  const displays: Record<InvestmentNeed, string> = {
    capital_preservation: 'Capital Preservation',
    income_generation: 'Income Generation',
    balanced_growth: 'Balanced Growth',
    capital_appreciation: 'Capital Appreciation',
    aggressive_growth: 'Aggressive Growth',
  };
  return displays[need];
}

/**
 * Get asset class display name
 */
export function getAssetClassDisplay(assetClass: AssetClass): string {
  const displays: Record<AssetClass, string> = {
    public_equity: 'Public Equity',
    fixed_income: 'Fixed Income',
    real_estate: 'Real Estate',
    private_equity: 'Private Equity',
    infrastructure: 'Infrastructure',
    hedge_funds: 'Hedge Funds',
    commodities: 'Commodities',
    cash: 'Cash & Equivalents',
    alternatives: 'Alternatives',
  };
  return displays[assetClass];
}

/**
 * Get sophistication level display
 */
export function getSophisticationDisplay(level: InvestorProfile['sophistication']): string {
  const displays: Record<InvestorProfile['sophistication'], string> = {
    retail: 'Retail',
    accredited: 'Accredited',
    qualified: 'Qualified',
    institutional: 'Institutional',
  };
  return displays[level];
}

/**
 * Create default risk profile
 */
export function createDefaultRiskProfile(): RiskProfile {
  return {
    tolerance: 'moderate',
    capacity: 'medium',
    need: 'balanced_growth',
    timeHorizon: 10,
    questionnaireScore: 50,
    behavioralBiases: [],
    lastAssessmentDate: new Date(),
  };
}

/**
 * Create default investment preferences
 */
export function createDefaultInvestmentPreferences(): InvestmentPreferences {
  return {
    assetClasses: [],
    geographies: [],
    sectors: [],
    esg: {
      importance: 'somewhat_important',
      exclusions: [],
    },
    liquidityNeeds: 'medium',
  };
}
