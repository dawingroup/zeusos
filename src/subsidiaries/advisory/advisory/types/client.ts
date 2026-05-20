/**
 * Advisory Client - Institutional or individual investor
 * 
 * Clients represent investors who:
 * - Invest in Dawin-managed infrastructure portfolios
 * - Seek advisory services for infrastructure investments
 * - Co-invest alongside Dawin in specific deals
 */

import { Timestamp } from 'firebase/firestore';
import { ClientType, InstitutionType, ClientTier } from './client-type';
import { InvestmentMandate, SectorAllocation } from './mandate';
import { RiskProfile } from './risk-profile';
import { ComplianceStatus, ClientCompliance } from './compliance';
import { ClientContact } from './contact';

export type ClientStatus =
  | 'prospect'
  | 'onboarding'
  | 'active'
  | 'dormant'
  | 'suspended'
  | 'terminated';

export type ClientSource =
  | 'direct_inquiry'
  | 'referral'
  | 'conference'
  | 'placement_agent'
  | 'existing_relationship'
  | 'marketing'
  | 'other';

export type ExperienceLevel = 
  | 'none'
  | 'limited'
  | 'moderate'
  | 'extensive'
  | 'expert';

export type ESGReportingRequirement = 
  | 'quarterly_report'
  | 'annual_impact_report'
  | 'carbon_footprint'
  | 'tcfd_alignment'
  | 'sfdr_compliance'
  | 'gri_standards';

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface AdvisoryClient {
  id: string;
  engagementId: string;
  
  clientCode: string;
  legalName: string;
  tradingName?: string;
  
  clientType: ClientType;
  institutionType?: InstitutionType;
  tier: ClientTier;
  status: ClientStatus;
  
  registrationNumber?: string;
  taxId?: string;
  jurisdiction: ClientJurisdiction;
  regulatoryStatus?: RegulatoryStatus;
  
  investorProfile: InvestorProfile;
  riskProfile: RiskProfile;
  mandates: InvestmentMandate[];
  
  compliance: ClientCompliance;
  
  contacts: ClientContact[];
  primaryContactId?: string;
  relationshipManager?: RelationshipManager;
  
  communicationPreferences: CommunicationPreferences;
  
  totalCommitments: MoneyAmount;
  totalDeployed: MoneyAmount;
  unrealizedValue: MoneyAmount;
  realizedValue: MoneyAmount;
  
  portfolioIds: string[];
  holdingIds: string[];
  
  source: ClientSource;
  tags: string[];
  notes?: string;
  
  prospectDate?: Timestamp;
  onboardingStartedAt?: Timestamp;
  activatedAt?: Timestamp;
  lastActivityAt?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface ClientJurisdiction {
  country: string;
  region?: string;
  registeredAddress: Address;
  correspondenceAddress?: Address;
  operatingJurisdictions: string[];
}

export interface RegulatoryStatus {
  isRegulated: boolean;
  regulator?: string;
  regulatoryId?: string;
  licenseType?: string;
  licenseExpiry?: Timestamp;
  restrictions?: string[];
}

export interface InvestorProfile {
  aum?: MoneyAmount;
  targetAllocation: SectorAllocation[];
  geographyFocus: string[];
  
  infrastructureExperience: ExperienceLevel;
  privateMarketsExperience: ExperienceLevel;
  emergingMarketsExperience: ExperienceLevel;
  
  investmentHorizon: InvestmentHorizon;
  liquidityNeeds: LiquidityNeeds;
  incomeRequirements?: IncomeRequirements;
  
  esgRequirements?: ESGRequirements;
  
  exclusions?: InvestmentExclusion[];
  concentrationLimits?: ConcentrationLimit[];
}

export interface InvestmentHorizon {
  minimumYears: number;
  targetYears: number;
  maximumYears?: number;
}

export interface LiquidityNeeds {
  level: 'high' | 'medium' | 'low' | 'very_low';
  distributionFrequency?: 'quarterly' | 'semi_annual' | 'annual' | 'at_exit';
  minimumCashReserve?: number;
}

export interface IncomeRequirements {
  requiresRegularIncome: boolean;
  targetYield?: number;
  minimumYield?: number;
  preferredFrequency?: 'quarterly' | 'semi_annual' | 'annual';
}

export interface ESGRequirements {
  mandatoryScreening: boolean;
  screeningCriteria?: ESGScreeningCriteria;
  impactTargets?: ImpactTarget[];
  reportingRequirements?: ESGReportingRequirement[];
  minimumESGRating?: string;
}

export interface ESGScreeningCriteria {
  exclusions: string[];
  positiveScreens: string[];
  controversyPolicy?: string;
}

export interface ImpactTarget {
  metric: string;
  target: number;
  unit: string;
  sdgAlignment?: number[];
}

export interface InvestmentExclusion {
  type: 'sector' | 'geography' | 'instrument' | 'counterparty';
  value: string;
  reason?: string;
}

export interface ConcentrationLimit {
  type: 'single_asset' | 'sector' | 'geography' | 'counterparty';
  maxPercentage: number;
  scope?: string;
}

export interface RelationshipManager {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  assignedAt: Timestamp;
  isPrimary: boolean;
}

export interface CommunicationPreferences {
  preferredChannel: 'email' | 'phone' | 'portal' | 'in_person';
  emailFrequency: 'immediate' | 'daily_digest' | 'weekly_digest';
  reportDelivery: 'email' | 'portal' | 'both';
  marketingOptIn: boolean;
  eventInvitations: boolean;
  language: string;
  timezone: string;
}

export interface ClientSummary {
  id: string;
  clientCode: string;
  legalName: string;
  tradingName?: string;
  clientType: ClientType;
  tier: ClientTier;
  status: ClientStatus;
  jurisdiction: string;
  totalCommitments: MoneyAmount;
  activePortfolios: number;
  complianceStatus: ComplianceStatus;
  relationshipManager?: string;
  lastActivityAt?: Timestamp;
}
