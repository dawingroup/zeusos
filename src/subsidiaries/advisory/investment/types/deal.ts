/**
 * Deal - Infrastructure investment opportunity
 * 
 * Deals represent investment opportunities in infrastructure assets,
 * tracked from initial screening through post-investment management to exit.
 * 
 * Key features:
 * - Stage-based pipeline with configurable gates
 * - Multiple investment structures supported
 * - Cross-module linking to Delivery projects
 * - Comprehensive geography and regulatory tracking
 */

import { Timestamp } from 'firebase/firestore';
import { DealStage, StageHistory } from './deal-stage';
import { InvestmentStructure, CapitalStructure } from './deal-structure';
import { DealGeography, RegulatoryInfo } from './deal-geography';
import { DealTeam } from './deal-team';

// Sector type (aligned with core types)
export type Sector = 
  | 'healthcare'
  | 'education'
  | 'energy'
  | 'water'
  | 'transport'
  | 'agriculture'
  | 'housing'
  | 'telecommunications'
  | 'financial_services'
  | 'manufacturing'
  | 'tourism'
  | 'other';

// Deal types based on asset lifecycle
export type DealType = 
  | 'greenfield'        // New construction from ground up
  | 'brownfield'        // Existing asset requiring renovation/upgrade
  | 'expansion'         // Adding capacity to existing asset
  | 'acquisition'       // Buying existing operational asset
  | 'refinancing'       // Restructuring existing debt
  | 'stake_sale'        // Selling partial or full ownership
  | 'platform_build';   // Building operating platform

export type DealStatus =
  | 'active'            // Currently being worked
  | 'on_hold'           // Paused but not dead
  | 'closed_won'        // Successfully closed
  | 'closed_lost'       // Did not proceed
  | 'withdrawn';        // Deal pulled by counterparty

export interface MoneyAmount {
  amount: number;
  currency: string;           // ISO 4217 code
}

export interface ValuationRange {
  low: MoneyAmount;
  mid: MoneyAmount;
  high: MoneyAmount;
  basis: ValuationBasis;
  asOfDate: Date;
}

export type ValuationBasis = 
  | 'dcf'                     // Discounted cash flow
  | 'comparable_transactions'
  | 'comparable_companies'
  | 'replacement_cost'
  | 'book_value'
  | 'negotiated';

export interface Counterparty {
  name: string;
  type: CounterpartyType;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export type CounterpartyType =
  | 'government'
  | 'private_company'
  | 'family_business'
  | 'pe_fund'
  | 'dfi'
  | 'pension_fund'
  | 'individual'
  | 'other';

export interface Advisor {
  name: string;
  role: AdvisorRole;
  firm?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

export type AdvisorRole =
  | 'legal'
  | 'financial'
  | 'technical'
  | 'tax'
  | 'environmental'
  | 'insurance'
  | 'other';

export type DealPriority = 'high' | 'medium' | 'low';
export type ConfidentialityLevel = 'public' | 'confidential' | 'highly_confidential';

export interface DueDiligenceStatusSummary {
  status: 'not_started' | 'in_progress' | 'completed' | 'flagged';
  completionPercentage: number;
  redFlagsCount: number;
  lastUpdated: Timestamp;
}

export interface Deal {
  id: string;
  engagementId: string;
  
  // Identification
  dealCode: string;           // Format: DL-{sector}-{year}-{sequence}
  name: string;
  description?: string;
  
  // Classification
  dealType: DealType;
  sector: Sector;
  subsector?: string;         // e.g., 'primary_healthcare', 'tertiary_hospital'
  status: DealStatus;
  
  // Pipeline tracking
  currentStage: DealStage;
  stageHistory: StageHistory[];
  stageEnteredAt: Timestamp;
  expectedCloseDate?: Date;
  
  // Investment details
  investmentStructure: InvestmentStructure;
  capitalStructure?: CapitalStructure;
  targetAmount: MoneyAmount;
  valuationRange?: ValuationRange;
  
  // Geography
  geography: DealGeography;
  regulatoryInfo?: RegulatoryInfo;
  
  // Team
  dealTeam: DealTeam;
  
  // Due diligence reference
  dueDiligenceId?: string;
  dueDiligenceStatus: DueDiligenceStatusSummary;
  
  // Financial model reference
  financialModelId?: string;
  financialModelVersion?: number;
  
  // Cross-module linking
  linkedProjectId?: string;   // Link to Delivery project
  matflowLinked: boolean;     // MatFlow enabled for construction phase
  matflowBoqId?: string;
  
  // Counterparties
  seller?: Counterparty;
  sponsor?: Counterparty;
  advisors?: Advisor[];
  
  // Key dates
  indicativeBidDate?: Date;
  bindingBidDate?: Date;
  exclusivityDate?: Date;
  targetSigningDate?: Date;
  targetClosingDate?: Date;
  
  // Tags and notes
  tags?: string[];
  internalNotes?: string;
  
  // Metadata
  priority: DealPriority;
  confidentiality: ConfidentialityLevel;

  // Stage-gate evidence (populated as deal moves through pipeline stages)
  documents?: Array<{ id: string; type: string; name: string; [k: string]: unknown }>;
  approvals?: Array<{ id: string; type: string; status: 'pending' | 'approved' | 'rejected'; [k: string]: unknown }>;
  checklistItems?: Array<{ id: string; criterionId: string; completed: boolean; [k: string]: unknown }>;
  metrics?: Record<string, number | string | undefined>;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// Form data for creating/updating deals
export interface DealFormData {
  name: string;
  description?: string;
  dealType: DealType;
  sector: Sector;
  subsector?: string;
  targetAmount: MoneyAmount;
  investmentStructure: Partial<InvestmentStructure>;
  geography: Partial<DealGeography>;
  expectedCloseDate?: Date;
}

// Deal summary for list views
export interface DealSummary {
  id: string;
  dealCode: string;
  name: string;
  dealType: DealType;
  sector: Sector;
  status: DealStatus;
  currentStage: DealStage;
  targetAmount: MoneyAmount;
  geography: {
    country: string;
    region?: string;
  };
  dueDiligenceStatus: DueDiligenceStatusSummary;
  priority: DealPriority;
  expectedCloseDate?: Date;
  daysInStage: number;
}

// Deal activity for timeline
export interface DealActivity {
  id: string;
  dealId: string;
  type: DealActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  createdBy: string;
}

export type DealActivityType =
  | 'created'
  | 'stage_changed'
  | 'status_changed'
  | 'team_updated'
  | 'document_added'
  | 'meeting_logged'
  | 'note_added'
  | 'valuation_updated'
  | 'dd_milestone'
  | 'model_updated'
  | 'project_linked';

// Helper functions
export function getDealTypeDisplayName(type: DealType): string {
  const names: Record<DealType, string> = {
    greenfield: 'Greenfield',
    brownfield: 'Brownfield',
    expansion: 'Expansion',
    acquisition: 'Acquisition',
    refinancing: 'Refinancing',
    stake_sale: 'Stake Sale',
    platform_build: 'Platform Build',
  };
  return names[type] || type;
}

export function getDealStatusDisplayName(status: DealStatus): string {
  const names: Record<DealStatus, string> = {
    active: 'Active',
    on_hold: 'On Hold',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
    withdrawn: 'Withdrawn',
  };
  return names[status] || status;
}

export function getDealPriorityDisplayName(priority: DealPriority): string {
  const names: Record<DealPriority, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return names[priority] || priority;
}

export function getSectorDisplayName(sector: Sector): string {
  const names: Record<Sector, string> = {
    healthcare: 'Healthcare',
    education: 'Education',
    energy: 'Energy',
    water: 'Water & Sanitation',
    transport: 'Transport',
    agriculture: 'Agriculture',
    housing: 'Housing',
    telecommunications: 'Telecommunications',
    financial_services: 'Financial Services',
    manufacturing: 'Manufacturing',
    tourism: 'Tourism',
    other: 'Other',
  };
  return names[sector] || sector;
}

export function getCounterpartyTypeDisplayName(type: CounterpartyType): string {
  const names: Record<CounterpartyType, string> = {
    government: 'Government',
    private_company: 'Private Company',
    family_business: 'Family Business',
    pe_fund: 'PE Fund',
    dfi: 'DFI',
    pension_fund: 'Pension Fund',
    individual: 'Individual',
    other: 'Other',
  };
  return names[type] || type;
}

export function getAdvisorRoleDisplayName(role: AdvisorRole): string {
  const names: Record<AdvisorRole, string> = {
    legal: 'Legal',
    financial: 'Financial',
    technical: 'Technical',
    tax: 'Tax',
    environmental: 'Environmental',
    insurance: 'Insurance',
    other: 'Other',
  };
  return names[role] || role;
}

export function getValuationBasisDisplayName(basis: ValuationBasis): string {
  const names: Record<ValuationBasis, string> = {
    dcf: 'DCF',
    comparable_transactions: 'Comparable Transactions',
    comparable_companies: 'Comparable Companies',
    replacement_cost: 'Replacement Cost',
    book_value: 'Book Value',
    negotiated: 'Negotiated',
  };
  return names[basis] || basis;
}

export function formatMoneyAmount(amount: MoneyAmount, compact = true): string {
  if (compact) {
    if (amount.amount >= 1000000000) {
      return `${amount.currency} ${(amount.amount / 1000000000).toFixed(1)}B`;
    }
    if (amount.amount >= 1000000) {
      return `${amount.currency} ${(amount.amount / 1000000).toFixed(1)}M`;
    }
    if (amount.amount >= 1000) {
      return `${amount.currency} ${(amount.amount / 1000).toFixed(1)}K`;
    }
  }
  return `${amount.currency} ${amount.amount.toLocaleString()}`;
}

// Create a default money amount
export function createMoneyAmount(amount: number, currency = 'USD'): MoneyAmount {
  return { amount, currency };
}
