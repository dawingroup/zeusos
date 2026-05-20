/**
 * Holding Transaction Types
 * 
 * Tracks all capital movements for holdings:
 * - Acquisitions and follow-ons
 * - Realizations and partial exits
 * - Write-downs and adjustments
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount } from './portfolio';

export type TransactionType =
  | 'initial_acquisition'
  | 'follow_on'
  | 'partial_realization'
  | 'full_realization'
  | 'dividend_recap'
  | 'refinancing'
  | 'write_down'
  | 'write_up'
  | 'impairment'
  | 'reversal'
  | 'fx_adjustment'
  | 'reclassification'
  | 'conversion'
  | 'transfer'
  | 'other';

export type TransactionStatus =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'cancelled';

export interface HoldingTransaction {
  id: string;
  holdingId: string;
  portfolioId: string;
  
  type: TransactionType;
  status: TransactionStatus;
  
  amount: MoneyAmount;
  shares?: number;
  pricePerShare?: number;
  
  costBasisImpact: MoneyAmount;
  
  proceeds?: MoneyAmount;
  realizedGainLoss?: MoneyAmount;
  
  ownershipBefore?: number;
  ownershipAfter?: number;
  
  counterparty?: {
    name: string;
    type: 'buyer' | 'seller' | 'company' | 'bank' | 'other';
  };
  
  tradeDate: Timestamp;
  settlementDate?: Timestamp;
  effectiveDate: Timestamp;
  
  documentIds?: string[];
  
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  processedBy?: string;
  processedAt?: Timestamp;
}

export interface TransactionCreateInput {
  holdingId: string;
  portfolioId: string;
  type: TransactionType;
  amount: MoneyAmount;
  shares?: number;
  pricePerShare?: number;
  proceeds?: MoneyAmount;
  counterparty?: { name: string; type: string };
  tradeDate: Timestamp;
  settlementDate?: Timestamp;
  effectiveDate: Timestamp;
  documentIds?: string[];
  notes?: string;
  createdBy: string;
}

export interface TransactionSummary {
  holdingId: string;
  
  totalAcquired: MoneyAmount;
  acquisitionCount: number;
  averageCost: number;
  
  totalRealized: MoneyAmount;
  realizationCount: number;
  totalProceeds: MoneyAmount;
  totalRealizedGainLoss: MoneyAmount;
  
  totalWriteDowns: MoneyAmount;
  totalWriteUps: MoneyAmount;
  netAdjustments: MoneyAmount;
  
  netCostBasis: MoneyAmount;
  
  lastTransactionDate: Timestamp;
  lastTransactionType: TransactionType;
}

export interface TransactionApproval {
  id: string;
  transactionId: string;
  holdingId: string;
  
  stage: 'analyst' | 'manager' | 'committee' | 'final';
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  
  approverId: string;
  approverName: string;
  approverRole: string;
  
  decision: 'approve' | 'reject' | 'request_changes';
  comments?: string;
  
  submittedAt: Timestamp;
  decidedAt?: Timestamp;
}
