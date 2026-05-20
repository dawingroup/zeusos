/**
 * Risk Profile - Client risk assessment and suitability
 */

import { Timestamp } from 'firebase/firestore';

export type RiskTolerance = 
  | 'conservative'
  | 'moderately_conservative'
  | 'moderate'
  | 'moderately_aggressive'
  | 'aggressive';

export type RiskCapacity = 'low' | 'medium' | 'high';

export type ExperienceLevel =
  | 'novice'
  | 'basic'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type ObjectiveType =
  | 'capital_growth'
  | 'income_generation'
  | 'capital_preservation'
  | 'inflation_protection'
  | 'liability_matching'
  | 'diversification'
  | 'impact';

export type WealthBand =
  | 'under_1m'
  | '1m_5m'
  | '5m_25m'
  | '25m_100m'
  | '100m_500m'
  | 'over_500m';

export type IncomeBand =
  | 'under_100k'
  | '100k_500k'
  | '500k_1m'
  | '1m_5m'
  | 'over_5m';

export interface RiskProfile {
  overallRiskRating: number;     // 1-10 scale
  riskTolerance: RiskTolerance;
  riskCapacity: RiskCapacity;
  
  investmentObjective: InvestmentObjective;
  timeHorizon: TimeHorizonProfile;
  financialCapacity: FinancialCapacityProfile;
  experienceProfile: ExperienceProfile;
  
  suitabilityAssessment: SuitabilityAssessment;
  
  assessmentDate: Timestamp;
  assessedBy: string;
  nextReviewDate: Timestamp;
  assessmentMethod: 'questionnaire' | 'interview' | 'documentation' | 'combined';
  
  previousAssessments?: RiskAssessmentHistory[];
}

export interface InvestmentObjective {
  primary: ObjectiveType;
  secondary?: ObjectiveType;
  returnTarget?: number;
  incomeTarget?: number;
  capitalPreservation: boolean;
  inflationProtection: boolean;
}

export interface TimeHorizonProfile {
  investmentHorizon: number;      // Years
  liquidityNeeds: LiquidityNeedsProfile;
  withdrawalExpectations: WithdrawalExpectation[];
}

export interface LiquidityNeedsProfile {
  shortTerm: number;              // 0-1 year, percentage
  mediumTerm: number;             // 1-5 years, percentage
  longTerm: number;               // 5+ years, percentage
  emergencyReserve: number;       // Months of expenses
}

export interface WithdrawalExpectation {
  timing: string;
  amount: number;
  purpose: string;
  flexibility: 'fixed' | 'flexible' | 'uncertain';
}

export interface FinancialCapacityProfile {
  netWorth: WealthBand;
  liquidAssets: WealthBand;
  annualIncome: IncomeBand;
  debtLevel: 'none' | 'low' | 'moderate' | 'high';
  incomeStability: 'stable' | 'variable' | 'uncertain';
  financialDependents: number;
  insuranceCoverage: boolean;
}

export interface ExperienceProfile {
  overallExperience: ExperienceLevel;
  assetClassExperience: AssetClassExperience[];
  financialIndustryExperience: boolean;
  relevantQualifications?: string[];
  yearsInvesting: number;
  privateMarketExposure: boolean;
  infrastructureExposure: boolean;
  emergingMarketExposure: boolean;
  hasExperiencedLosses: boolean;
  largestLoss?: number;
  reactionToLoss?: 'panic_sold' | 'held' | 'bought_more' | 'no_experience';
}

export interface AssetClassExperience {
  assetClass: string;
  experience: ExperienceLevel;
  allocationPercent?: number;
  yearsExperience?: number;
}

export interface SuitabilityAssessment {
  overallSuitability: 'suitable' | 'potentially_suitable' | 'not_suitable';
  productSuitability: ProductSuitability[];
  warnings: SuitabilityWarning[];
  recommendations: string[];
  signedOffBy?: string;
  signedOffAt?: Timestamp;
  clientAcknowledgement?: boolean;
  clientAcknowledgedAt?: Timestamp;
}

export interface ProductSuitability {
  productType: string;
  suitability: 'suitable' | 'potentially_suitable' | 'not_suitable';
  reasons: string[];
  conditions?: string[];
}

export interface SuitabilityWarning {
  type: 'risk_mismatch' | 'liquidity_mismatch' | 'experience_gap' | 'concentration' | 'horizon_mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigatingFactors?: string[];
}

export interface RiskAssessmentHistory {
  assessmentDate: Timestamp;
  overallRiskRating: number;
  riskTolerance: RiskTolerance;
  assessedBy: string;
  changeReason?: string;
}

export interface RiskAssessment {
  clientId: string;
  assessmentId: string;
  responses: QuestionnaireResponse[];
  scores: RiskScores;
  profile: RiskProfile;
  completedAt: Timestamp;
  completedBy: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
}

export interface QuestionnaireResponse {
  questionId: string;
  questionText: string;
  response: string | number | boolean;
  score: number;
  category: 'tolerance' | 'capacity' | 'experience' | 'objective';
}

export interface RiskScores {
  toleranceScore: number;
  capacityScore: number;
  experienceScore: number;
  objectiveScore: number;
  compositeScore: number;
}
