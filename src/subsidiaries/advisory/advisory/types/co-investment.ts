/**
 * Co-Investment Types
 * 
 * Manages co-investment workflows where multiple portfolios
 * or external investors participate in the same deal.
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount } from './portfolio';

// ============================================================================
// CO-INVESTOR
// ============================================================================

export type CoInvestorType =
  | 'dfi'
  | 'pension_fund'
  | 'insurance'
  | 'family_office'
  | 'sovereign_wealth'
  | 'endowment'
  | 'corporate'
  | 'other_fund'
  | 'individual';

export type RelationshipStatus =
  | 'prospect'
  | 'active'
  | 'dormant'
  | 'former';

export interface CoInvestor {
  id: string;
  
  name: string;
  type: CoInvestorType;
  
  contactPerson?: string;
  email?: string;
  phone?: string;
  
  relationshipStatus: RelationshipStatus;
  relationshipManagerId?: string;
  
  investmentProfile: {
    minTicket?: MoneyAmount;
    maxTicket?: MoneyAmount;
    preferredSectors?: string[];
    preferredGeographies?: string[];
    preferredStages?: string[];
  };
  
  trackRecord: {
    totalDeals: number;
    totalInvested: MoneyAmount;
    averageTicket: MoneyAmount;
    lastInvestmentDate?: Timestamp;
  };
  
  isActive: boolean;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// CO-INVESTMENT OPPORTUNITY
// ============================================================================

export type CoInvestmentOpportunityStatus =
  | 'preparing'
  | 'marketing'
  | 'soft_circle'
  | 'final_circle'
  | 'closed'
  | 'cancelled';

export type InvitationStatus =
  | 'pending'
  | 'interested'
  | 'passed'
  | 'committed';

export type CommitmentStatus =
  | 'soft'
  | 'hard'
  | 'funded'
  | 'cancelled';

export interface CoInvestmentInvitation {
  coInvestorId: string;
  coInvestorName: string;
  
  invitedAt: Timestamp;
  invitedBy: string;
  
  status: InvitationStatus;
  respondedAt?: Timestamp;
  responseNotes?: string;
  
  indicatedAmount?: MoneyAmount;
  dueDiligenceRequested?: boolean;
}

export interface CoInvestmentCommitment {
  id: string;
  coInvestorId: string;
  coInvestorName: string;
  
  committedAmount: MoneyAmount;
  committedAt: Timestamp;
  
  vehicleType: 'direct' | 'spv' | 'fund';
  managementFee?: number;
  carriedInterest?: number;
  
  status: CommitmentStatus;
  fundedAmount?: MoneyAmount;
  fundedAt?: Timestamp;
  
  commitmentLetterUrl?: string;
  subscriptionDocUrl?: string;
}

export interface CoInvestmentOpportunity {
  id: string;
  
  dealId: string;
  dealName: string;
  
  totalDealSize: MoneyAmount;
  availableForCoInvestment: MoneyAmount;
  minimumTicket: MoneyAmount;
  maximumTicket?: MoneyAmount;
  
  openDate: Timestamp;
  closeDate?: Timestamp;
  expectedCloseDate: Timestamp;
  
  status: CoInvestmentOpportunityStatus;
  
  teaser?: string;
  infoMemoUrl?: string;
  dataRoomUrl?: string;
  
  invitations: CoInvestmentInvitation[];
  commitments: CoInvestmentCommitment[];
  
  totalCommitted: MoneyAmount;
  commitmentProgress: number;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// CO-INVESTMENT VEHICLE
// ============================================================================

export type VehicleType =
  | 'spv'
  | 'fund'
  | 'partnership'
  | 'direct';

export type VehicleStatus =
  | 'forming'
  | 'open'
  | 'closed'
  | 'investing'
  | 'harvesting'
  | 'liquidated';

export type ShareClass =
  | 'A'
  | 'B'
  | 'C'
  | 'LP'
  | 'GP';

export interface VehicleParticipant {
  type: 'internal_portfolio' | 'co_investor';
  
  portfolioId?: string;
  portfolioName?: string;
  clientId?: string;
  
  coInvestorId?: string;
  coInvestorName?: string;
  
  committedAmount: MoneyAmount;
  paidInAmount: MoneyAmount;
  ownershipPercentage: number;
  
  shareClass?: ShareClass;
  votingRights?: boolean;
}

export interface CoInvestmentVehicle {
  id: string;
  
  name: string;
  type: VehicleType;
  
  jurisdiction: string;
  legalForm: string;
  taxStatus?: string;
  
  dealId: string;
  opportunityId?: string;
  
  targetSize: MoneyAmount;
  hardCap?: MoneyAmount;
  currentSize: MoneyAmount;
  
  participants: VehicleParticipant[];
  
  managementFee: number;
  carriedInterest: number;
  hurdleRate?: number;
  catchUp?: number;
  
  status: VehicleStatus;
  formationDate?: Timestamp;
  finalCloseDate?: Timestamp;
  terminationDate?: Timestamp;
  
  administrator?: string;
  auditor?: string;
  legalCounsel?: string;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// SYNDICATION WORKFLOW
// ============================================================================

export type SyndicationStage =
  | 'preparation'
  | 'teaser_distribution'
  | 'nda_collection'
  | 'info_memo_distribution'
  | 'management_meetings'
  | 'due_diligence'
  | 'term_negotiation'
  | 'commitment_collection'
  | 'documentation'
  | 'closing';

export type SyndicationStatus =
  | 'active'
  | 'completed'
  | 'cancelled';

export interface SyndicationWorkflow {
  id: string;
  
  dealId: string;
  dealName: string;
  opportunityId: string;
  
  currentStage: SyndicationStage;
  stages: {
    stage: SyndicationStage;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    notes?: string;
  }[];
  
  targetSyndicationAmount: MoneyAmount;
  currentCommitments: MoneyAmount;
  
  startDate: Timestamp;
  targetCloseDate: Timestamp;
  actualCloseDate?: Timestamp;
  
  status: SyndicationStatus;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateCoInvestorInput {
  name: string;
  type: CoInvestorType;
  contactPerson?: string;
  email?: string;
  phone?: string;
  investmentProfile?: CoInvestor['investmentProfile'];
}

export interface CreateCoInvestmentOpportunityInput {
  dealId: string;
  dealName: string;
  totalDealSize: MoneyAmount;
  availableForCoInvestment: MoneyAmount;
  minimumTicket: MoneyAmount;
  maximumTicket?: MoneyAmount;
  expectedCloseDate: Timestamp;
  teaser?: string;
}
