import { Timestamp } from 'firebase/firestore';
import { Money } from './money';
import { GeoLocation } from './geo';
import { StakeholderRef } from './stakeholder';
import { EngagementDomain, EngagementType, Sector } from './engagement-domain';
import { EngagementModules } from './engagement-modules';
import { EngagementStatus, EngagementTimeline } from './engagement-status';
import { TeamAssignment } from './engagement-team';
import { FundingSource, FundingCategory } from './funding';
import { ReportingRequirement, Covenant, ApprovalConfig } from './compliance';

/**
 * ENGAGEMENT
 * The unified root entity for all advisory work
 */
export interface Engagement {
  /** Unique identifier */
  id: string;
  
  // ─────────────────────────────────────────────────────────────────
  // CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────
  
  /** Primary purpose of the engagement */
  domain: EngagementDomain;
  
  /** Detailed type within domain */
  type: EngagementType;
  
  /** Active modules for this engagement */
  modules: EngagementModules;
  
  // ─────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────
  
  /** Display name */
  name: string;
  
  /** Reference code (e.g., "ENG-2026-001", "AMH-UG-24") */
  code: string;
  
  /** Description of scope and objectives */
  description: string;
  
  /** Sector focus */
  sectors: Sector[];
  
  // ─────────────────────────────────────────────────────────────────
  // CLIENT & STAKEHOLDERS
  // ─────────────────────────────────────────────────────────────────
  
  /** Primary client (links to Client entity) */
  clientId: string;
  
  /** Client name (denormalized for display) */
  clientName: string;
  
  /** Beneficial parties (for programs with beneficiaries) */
  beneficiaries?: StakeholderRef[];
  
  /** Implementation partners */
  partners: StakeholderRef[];
  
  /** Dawin team assignment */
  team: TeamAssignment;
  
  // ─────────────────────────────────────────────────────────────────
  // FUNDING (Agnostic)
  // ─────────────────────────────────────────────────────────────────
  
  /** All funding sources - supports blended finance */
  fundingSources: FundingSource[];
  
  /** Total engagement value */
  totalValue: Money;
  
  /** Primary funding category (derived from fundingSources) */
  primaryFundingCategory: FundingCategory;
  
  // ─────────────────────────────────────────────────────────────────
  // GEOGRAPHY
  // ─────────────────────────────────────────────────────────────────
  
  /** Primary country (ISO 3166-1 alpha-2) */
  country: string;
  
  /** Regions/states within country */
  regions: string[];
  
  /** Specific locations */
  locations: GeoLocation[];
  
  // ─────────────────────────────────────────────────────────────────
  // TIMELINE
  // ─────────────────────────────────────────────────────────────────
  
  /** Engagement timeline */
  timeline: EngagementTimeline;
  
  /** Current status */
  status: EngagementStatus;
  
  // ─────────────────────────────────────────────────────────────────
  // LINKED ENTITIES
  // ─────────────────────────────────────────────────────────────────
  
  /** Programs (delivery module) */
  programIds: string[];
  
  /** Deals (investment module) */
  dealIds: string[];
  
  /** Portfolios (advisory module) */
  portfolioIds: string[];
  
  // ─────────────────────────────────────────────────────────────────
  // COMPLIANCE & REPORTING
  // ─────────────────────────────────────────────────────────────────
  
  /** Reporting requirements from all funding sources */
  reportingRequirements: ReportingRequirement[];
  
  /** Active covenants to monitor */
  covenants: Covenant[];
  
  /** Approval workflow configuration */
  approvalConfig: ApprovalConfig;
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  /** User who created this engagement */
  createdBy: string;
  
  /** Creation timestamp */
  createdAt: Timestamp;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
}

/**
 * CREATE ENGAGEMENT DATA
 * Data required to create a new engagement
 */
export interface CreateEngagementData {
  /** Primary purpose */
  domain: EngagementDomain;
  
  /** Detailed type */
  type: EngagementType;
  
  /** Display name */
  name: string;
  
  /** Reference code (auto-generated if not provided) */
  code?: string;
  
  /** Description */
  description: string;
  
  /** Sector focus */
  sectors: Sector[];
  
  /** Primary client ID */
  clientId: string;
  
  /** Primary country */
  country: string;
  
  /** Regions within country */
  regions?: string[];
  
  /** Effective date */
  effectiveDate: Date;
  
  /** Target end date */
  targetEndDate?: Date;
  
  /** Engagement lead user ID */
  leadId: string;
}

/**
 * UPDATE ENGAGEMENT DATA
 * Fields that can be updated on an engagement
 */
export type UpdateEngagementData = Partial<
  Pick<
    Engagement,
    | 'name'
    | 'description'
    | 'sectors'
    | 'regions'
    | 'locations'
    | 'status'
    | 'modules'
    | 'team'
    | 'beneficiaries'
    | 'partners'
    | 'fundingSources'
    | 'totalValue'
    | 'reportingRequirements'
    | 'covenants'
    | 'approvalConfig'
  >
>;

/**
 * ENGAGEMENT SUMMARY
 * Lightweight version for lists and cards
 */
export interface EngagementSummary {
  id: string;
  name: string;
  code: string;
  domain: EngagementDomain;
  type: EngagementType;
  status: EngagementStatus;
  clientId: string;
  clientName: string;
  country: string;
  totalValue: Money;
  primaryFundingCategory: FundingCategory;
  sectors: Sector[];
  leadId: string;
  leadName: string;
  effectiveDate: Timestamp;
  programCount: number;
  dealCount: number;
  portfolioCount: number;
}

/**
 * ENGAGEMENT WITH ENTITIES
 * Engagement with all linked entities loaded
 * Uses *Ref types until full module types are implemented
 */
export interface EngagementWithEntities extends Engagement {
  /** Loaded programs (delivery module) */
  programs?: ProgramRef[];
  
  /** Loaded deals (investment module) */
  deals?: DealRef[];
  
  /** Loaded portfolios (advisory module) */
  portfolios?: PortfolioRef[];
  
  /** Loaded client - imports from client.ts */
  client?: ClientRef;
}

/**
 * CLIENT REF (Lightweight reference)
 * Full Client type is in client.ts
 */
export interface ClientRef {
  id: string;
  legalName: string;
  displayName: string;
  type: string;
}

/**
 * ENGAGEMENT FILTER
 * Filter criteria for querying engagements
 */
export interface EngagementFilter {
  /** Filter by domain */
  domain?: EngagementDomain;
  
  /** Filter by type */
  type?: EngagementType;
  
  /** Filter by status */
  status?: EngagementStatus | EngagementStatus[];
  
  /** Filter by client */
  clientId?: string;
  
  /** Filter by country */
  country?: string;
  
  /** Filter by sector */
  sector?: Sector;
  
  /** Filter by team member */
  teamMemberId?: string;
  
  /** Filter by lead */
  leadId?: string;
  
  /** Only active engagements */
  activeOnly?: boolean;
  
  /** Search by name or code */
  search?: string;
}

// ─────────────────────────────────────────────────────────────────
// FORWARD DECLARATIONS
// These will be replaced with imports when modules are implemented
// ─────────────────────────────────────────────────────────────────

/**
 * PROGRAM (Forward declaration)
 * Full type will be defined in delivery module types
 */
export interface ProgramRef {
  id: string;
  name: string;
  code: string;
  engagementId: string;
  status: string;
}

/**
 * DEAL (Forward declaration)
 * Full type will be defined in investment module types
 */
export interface DealRef {
  id: string;
  name: string;
  engagementId: string;
  stage: string;
}

/**
 * PORTFOLIO (Forward declaration)
 * Full type will be defined in advisory module types
 */
export interface PortfolioRef {
  id: string;
  name: string;
  engagementId: string;
  totalValue: Money;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Generate engagement code
 */
export function generateEngagementCode(
  domain: EngagementDomain,
  country: string,
  year: number = new Date().getFullYear()
): string {
  const domainPrefixes: Record<EngagementDomain, string> = {
    infrastructure_delivery: 'DEL',
    infrastructure_investment: 'INV',
    investment_advisory: 'ADV',
    transaction_advisory: 'TXN',
    strategy_consulting: 'STR',
  };
  
  const prefix = domainPrefixes[domain];
  const yearShort = year.toString().slice(-2);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${prefix}-${country}-${yearShort}-${random}`;
}

/**
 * Convert engagement to summary
 */
export function toEngagementSummary(engagement: Engagement): EngagementSummary {
  return {
    id: engagement.id,
    name: engagement.name,
    code: engagement.code,
    domain: engagement.domain,
    type: engagement.type,
    status: engagement.status,
    clientId: engagement.clientId,
    clientName: engagement.clientName,
    country: engagement.country,
    totalValue: engagement.totalValue,
    primaryFundingCategory: engagement.primaryFundingCategory,
    sectors: engagement.sectors,
    leadId: engagement.team.leadId,
    leadName: engagement.team.leadName,
    effectiveDate: engagement.timeline.effectiveDate,
    programCount: engagement.programIds.length,
    dealCount: engagement.dealIds.length,
    portfolioCount: engagement.portfolioIds.length,
  };
}

/**
 * Check if engagement has active modules
 */
export function hasActiveModule(
  engagement: Engagement,
  module: keyof EngagementModules
): boolean {
  return engagement.modules[module];
}

/**
 * Get linked entity count
 */
export function getLinkedEntityCount(engagement: Engagement): number {
  return (
    engagement.programIds.length +
    engagement.dealIds.length +
    engagement.portfolioIds.length
  );
}
