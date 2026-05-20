import { Timestamp } from 'firebase/firestore';
import { Money } from './money';
import { Address } from './address';
import { ContactRef } from './contact';
import { Sector } from './engagement-domain';
import { FundingInstrument } from './funding-instrument';
import { ReportingRequirement } from './compliance';

/**
 * FUNDER TYPE
 * Classification of funding entity
 */
export type FunderType =
  // Development Finance
  | 'multilateral_dfi'       // World Bank, AfDB, etc.
  | 'bilateral_dfi'          // USAID, CDC, FMO, etc.
  | 'regional_dfi'           // EADB, TDB, etc.
  
  // Foundations
  | 'private_foundation'     // Gates, Mastercard, etc.
  | 'corporate_foundation'   // Corporate CSR arms
  | 'community_foundation'
  
  // Government
  | 'government_ministry'
  | 'government_agency'
  | 'local_government'
  
  // Commercial
  | 'commercial_bank'
  | 'investment_bank'
  | 'pension_fund'
  | 'insurance_company'
  | 'asset_manager'
  
  // Private Capital
  | 'private_equity'
  | 'venture_capital'
  | 'family_office'
  | 'impact_investor'
  | 'angel_investor'
  
  // Other
  | 'ngo'
  | 'corporate'
  | 'other';

/**
 * FUNDER RELATIONSHIP STATUS
 */
export type FunderRelationshipStatus = 'prospect' | 'active' | 'inactive';

/**
 * TICKET SIZE RANGE
 */
export interface TicketSizeRange {
  min: Money;
  max: Money;
}

/**
 * FUNDER
 * Entity providing funding
 */
export interface Funder {
  id: string;
  
  // ─────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────
  
  /** Funder type */
  type: FunderType;
  
  /** Legal name */
  name: string;
  
  /** Short name / acronym */
  shortName?: string;
  
  /** Headquarters country */
  country: string;
  
  /** Website */
  website?: string;
  
  /** Logo URL */
  logoUrl?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // CONTACT
  // ─────────────────────────────────────────────────────────────────
  
  /** Addresses */
  addresses: Address[];
  
  /** Primary contact */
  primaryContact?: ContactRef;
  
  /** All contacts */
  contacts: ContactRef[];
  
  // ─────────────────────────────────────────────────────────────────
  // FOCUS AREAS
  // ─────────────────────────────────────────────────────────────────
  
  /** Geographic focus */
  geographicFocus: string[];
  
  /** Sector focus */
  sectorFocus: Sector[];
  
  /** Instrument types offered */
  instrumentsOffered: FundingInstrument[];
  
  /** Typical ticket size range */
  ticketSizeRange?: TicketSizeRange;
  
  // ─────────────────────────────────────────────────────────────────
  // REQUIREMENTS
  // ─────────────────────────────────────────────────────────────────
  
  /** Standard reporting requirements */
  standardReportingRequirements?: ReportingRequirement[];
  
  /** Standard covenants */
  standardCovenants?: string[];
  
  /** Due diligence requirements */
  ddRequirements?: string[];
  
  // ─────────────────────────────────────────────────────────────────
  // RELATIONSHIP
  // ─────────────────────────────────────────────────────────────────
  
  /** Dawin relationship status */
  relationshipStatus: FunderRelationshipStatus;
  
  /** Relationship manager */
  relationshipManagerId?: string;
  
  /** Active engagement count with this funder */
  activeEngagementCount: number;
  
  /** Total funding from this funder */
  totalFundingReceived: Money;
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  /** Notes */
  notes?: string;
  
  /** Tags */
  tags: string[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * FUNDER REF
 * Lightweight funder reference
 */
export interface FunderRef {
  id: string;
  name: string;
  shortName?: string;
  type: FunderType;
  logoUrl?: string;
}

/**
 * CREATE FUNDER DATA
 */
export interface CreateFunderData {
  type: FunderType;
  name: string;
  shortName?: string;
  country: string;
  website?: string;
  geographicFocus?: string[];
  sectorFocus?: Sector[];
}

/**
 * FUNDER SUMMARY
 */
export interface FunderSummary {
  id: string;
  type: FunderType;
  name: string;
  shortName?: string;
  country: string;
  logoUrl?: string;
  relationshipStatus: FunderRelationshipStatus;
  activeEngagementCount: number;
  totalFundingReceived: Money;
}

/**
 * Get funder type display name
 */
export function getFunderTypeDisplayName(type: FunderType): string {
  const names: Record<FunderType, string> = {
    multilateral_dfi: 'Multilateral DFI',
    bilateral_dfi: 'Bilateral DFI',
    regional_dfi: 'Regional DFI',
    private_foundation: 'Private Foundation',
    corporate_foundation: 'Corporate Foundation',
    community_foundation: 'Community Foundation',
    government_ministry: 'Government Ministry',
    government_agency: 'Government Agency',
    local_government: 'Local Government',
    commercial_bank: 'Commercial Bank',
    investment_bank: 'Investment Bank',
    pension_fund: 'Pension Fund',
    insurance_company: 'Insurance Company',
    asset_manager: 'Asset Manager',
    private_equity: 'Private Equity',
    venture_capital: 'Venture Capital',
    family_office: 'Family Office',
    impact_investor: 'Impact Investor',
    angel_investor: 'Angel Investor',
    ngo: 'NGO',
    corporate: 'Corporate',
    other: 'Other',
  };
  return names[type];
}

/**
 * Get funder type description
 */
export function getFunderTypeDescription(type: FunderType): string {
  const descriptions: Record<FunderType, string> = {
    multilateral_dfi: 'World Bank, IFC, AfDB, and similar multilateral institutions',
    bilateral_dfi: 'USAID, CDC, FMO, DEG, and similar bilateral agencies',
    regional_dfi: 'EADB, TDB, and regional development banks',
    private_foundation: 'Gates Foundation, Mastercard Foundation, and similar',
    corporate_foundation: 'Corporate social responsibility funding arms',
    community_foundation: 'Local and community-based foundations',
    government_ministry: 'National government ministries',
    government_agency: 'Government agencies and parastatals',
    local_government: 'County, district, and municipal governments',
    commercial_bank: 'Commercial and retail banks',
    investment_bank: 'Investment and merchant banks',
    pension_fund: 'Pension and retirement funds',
    insurance_company: 'Insurance and reinsurance companies',
    asset_manager: 'Asset management firms',
    private_equity: 'Private equity funds',
    venture_capital: 'Venture capital funds',
    family_office: 'Single and multi-family offices',
    impact_investor: 'Impact-first investors',
    angel_investor: 'Angel and HNW investors',
    ngo: 'Non-governmental organizations',
    corporate: 'Corporate funders and sponsors',
    other: 'Other funder types',
  };
  return descriptions[type];
}

/**
 * Check if funder is development-focused
 */
export function isDevelopmentFunder(type: FunderType): boolean {
  return [
    'multilateral_dfi',
    'bilateral_dfi',
    'regional_dfi',
    'private_foundation',
    'impact_investor',
  ].includes(type);
}

/**
 * Check if funder is commercial
 */
export function isCommercialFunder(type: FunderType): boolean {
  return [
    'commercial_bank',
    'investment_bank',
    'pension_fund',
    'insurance_company',
    'asset_manager',
    'private_equity',
    'venture_capital',
  ].includes(type);
}

/**
 * Convert Funder to FunderRef
 */
export function toFunderRef(funder: Funder): FunderRef {
  return {
    id: funder.id,
    name: funder.name,
    shortName: funder.shortName,
    type: funder.type,
    logoUrl: funder.logoUrl,
  };
}

/**
 * All funder types
 */
export const ALL_FUNDER_TYPES: FunderType[] = [
  'multilateral_dfi',
  'bilateral_dfi',
  'regional_dfi',
  'private_foundation',
  'corporate_foundation',
  'community_foundation',
  'government_ministry',
  'government_agency',
  'local_government',
  'commercial_bank',
  'investment_bank',
  'pension_fund',
  'insurance_company',
  'asset_manager',
  'private_equity',
  'venture_capital',
  'family_office',
  'impact_investor',
  'angel_investor',
  'ngo',
  'corporate',
  'other',
];
