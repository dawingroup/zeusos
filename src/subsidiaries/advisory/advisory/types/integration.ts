/**
 * Cross-Module Integration Types
 * 
 * Defines the linking structures between Advisory portfolios,
 * Investment deals, and Delivery projects.
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount } from './portfolio';
import type { HoldingType } from './holding';

// ============================================================================
// CROSS-MODULE LINK TYPES
// ============================================================================

export type LinkableEntityType =
  | 'portfolio'
  | 'holding'
  | 'deal'
  | 'project'
  | 'engagement'
  | 'program';

export type CrossModuleLinkType =
  | 'deal_to_holding'
  | 'holding_to_project'
  | 'portfolio_to_deal'
  | 'project_to_deal'
  | 'engagement_to_portfolio'
  | 'program_to_project';

export interface CrossModuleLink {
  id: string;
  
  sourceType: LinkableEntityType;
  sourceId: string;
  sourceModule: 'advisory' | 'investment' | 'delivery';
  
  targetType: LinkableEntityType;
  targetId: string;
  targetModule: 'advisory' | 'investment' | 'delivery';
  
  linkType: CrossModuleLinkType;
  relationship: 'parent' | 'child' | 'sibling' | 'reference';
  strength: 'strong' | 'weak';
  
  context?: {
    conversionId?: string;
    allocationId?: string;
    deploymentId?: string;
  };
  
  createdAt: Timestamp;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// DEAL-TO-HOLDING CONVERSION
// ============================================================================

export type DealConversionStatus =
  | 'pending_approval'
  | 'partially_approved'
  | 'fully_approved'
  | 'converting'
  | 'completed'
  | 'cancelled';

export interface DealConversionTarget {
  portfolioId: string;
  portfolioName: string;
  
  allocationPercentage: number;
  allocationAmount: MoneyAmount;
  
  holdingConfig: {
    type: HoldingType;
    vintageYear: number;
    targetIRR?: number;
    holdPeriodYears?: number;
  };
  
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
}

export interface DealConversionApproval {
  icApproved: boolean;
  icApprovedBy?: string;
  icApprovedAt?: Timestamp;
  icNotes?: string;
  
  portfolioApprovals: {
    portfolioId: string;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: Timestamp;
    notes?: string;
  }[];
  
  finalApproved: boolean;
  finalApprovedBy?: string;
  finalApprovedAt?: Timestamp;
}

export interface DealConversion {
  id: string;
  
  dealId: string;
  dealName: string;
  dealStage: string;
  
  targetPortfolios: DealConversionTarget[];
  
  status: DealConversionStatus;
  approval: DealConversionApproval;
  
  conversionDate?: Timestamp;
  effectiveDate?: Timestamp;
  
  createdHoldings: string[];
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// CAPITAL DEPLOYMENT
// ============================================================================

export type CapitalDeploymentType =
  | 'initial_investment'
  | 'milestone_payment'
  | 'cost_overrun'
  | 'scope_expansion'
  | 'working_capital'
  | 'contingency';

export type CapitalDeploymentStatus =
  | 'planned'
  | 'committed'
  | 'disbursed'
  | 'cancelled';

export interface CapitalDeployment {
  id: string;
  
  holdingId: string;
  holdingName: string;
  portfolioId: string;
  
  projectId: string;
  projectName: string;
  engagementId: string;
  
  deploymentType: CapitalDeploymentType;
  amount: MoneyAmount;
  deploymentDate: Timestamp;
  
  status: CapitalDeploymentStatus;
  disbursementRef?: string;
  
  milestoneId?: string;
  milestoneName?: string;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// PORTFOLIO-DEAL ALLOCATION
// ============================================================================

export type AllocationStatus =
  | 'indicative'
  | 'committed'
  | 'invested'
  | 'exited';

export interface PortfolioDealAllocation {
  id: string;
  
  portfolioId: string;
  portfolioName: string;
  clientId: string;
  
  dealId: string;
  dealName: string;
  
  allocationAmount: MoneyAmount;
  allocationPercentage: number;
  portfolioWeight: number;
  
  status: AllocationStatus;
  
  indicationDate?: Timestamp;
  commitmentDate?: Timestamp;
  investmentDate?: Timestamp;
  exitDate?: Timestamp;
  
  realizedValue?: MoneyAmount;
  realizedMultiple?: number;
  realizedIRR?: number;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// PROJECT-HOLDING LINK
// ============================================================================

export type ProjectHoldingLinkType =
  | 'direct_equity'
  | 'debt_financing'
  | 'preferred_equity'
  | 'mezzanine'
  | 'development_rights'
  | 'concession';

export type ProjectHoldingLinkStatus =
  | 'active'
  | 'completed'
  | 'terminated';

export interface ProjectHoldingLink {
  id: string;
  
  projectId: string;
  projectName: string;
  projectType: string;
  engagementId: string;
  programId?: string;
  
  holdingId: string;
  holdingName: string;
  portfolioId: string;
  clientId: string;
  
  linkType: ProjectHoldingLinkType;
  ownershipPercentage?: number;
  
  attributedValue: MoneyAmount;
  valueMethod: 'cost' | 'nav' | 'appraisal' | 'market';
  lastValuationDate: Timestamp;
  
  status: ProjectHoldingLinkStatus;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// CONVERSION INPUT TYPES
// ============================================================================

export interface InitiateDealConversionInput {
  dealId: string;
  dealName: string;
  dealStage: string;
  targets: Omit<DealConversionTarget, 'approved' | 'approvedBy' | 'approvedAt'>[];
}

export interface CreateCapitalDeploymentInput {
  holdingId: string;
  holdingName: string;
  portfolioId: string;
  projectId: string;
  projectName: string;
  engagementId: string;
  deploymentType: CapitalDeploymentType;
  amount: MoneyAmount;
  deploymentDate: Timestamp;
  milestoneId?: string;
  milestoneName?: string;
}
