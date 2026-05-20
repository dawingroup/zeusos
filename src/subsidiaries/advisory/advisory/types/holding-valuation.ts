/**
 * Holding Valuation History Types
 * 
 * Tracks valuation history for holdings:
 * - Point-in-time valuations
 * - Methodology documentation
 * - Audit trail
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount } from './portfolio';
import type { ValuationMethodology, ValuationInput } from './holding';

export interface ValuationHistory {
  id: string;
  holdingId: string;
  portfolioId: string;
  
  valuationDate: Timestamp;
  
  fairValue: MoneyAmount;
  previousValue: MoneyAmount;
  valueChange: MoneyAmount;
  percentageChange: number;
  
  methodology: ValuationMethodology;
  fairValueLevel: 1 | 2 | 3;
  
  keyInputs?: ValuationInput[];
  
  multiplesUsed?: {
    evEbitda?: number;
    evRevenue?: number;
    priceEarnings?: number;
  };
  
  discountRate?: number;
  
  adjustments?: {
    type: string;
    percentage: number;
    amount: MoneyAmount;
    rationale: string;
  }[];
  
  costBasis: MoneyAmount;
  unrealizedGainLoss: MoneyAmount;
  unrealizedGainLossPercentage: number;
  
  narrative?: string;
  keyAssumptions?: string[];
  keyRisks?: string[];
  
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'final';
  preparedBy: string;
  preparedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  supportingDocumentIds?: string[];
}

export interface ValuationComparable {
  id: string;
  holdingId: string;
  valuationId: string;
  
  comparableType: 'company' | 'transaction';
  name: string;
  description?: string;
  
  metrics: {
    evEbitda?: number;
    evRevenue?: number;
    priceEarnings?: number;
    evCapacity?: number;
    pricePerKw?: number;
    pricePerBed?: number;
  };
  
  adjustmentFactors?: {
    size: number;
    growth: number;
    geography: number;
    quality: number;
    liquidity: number;
  };
  
  weight: number;
  
  source: string;
  asOfDate: Timestamp;
}

export interface ValuationSensitivity {
  id: string;
  holdingId: string;
  valuationId: string;
  
  variable: string;
  baseValue: number;
  
  scenarios: {
    change: number;
    fairValue: MoneyAmount;
    percentageChange: number;
  }[];
  
  elasticity: number;
  sensitivityRanking: number;
}

export interface ValuationApproval {
  id: string;
  valuationId: string;
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

export interface ValuationReport {
  id: string;
  holdingId: string;
  valuationId: string;
  
  reportType: 'internal' | 'external' | 'audit';
  reportDate: Timestamp;
  
  preparedBy: string;
  reviewedBy?: string;
  
  sections: {
    executiveSummary: string;
    assetOverview: string;
    valuationMethodology: string;
    keyAssumptions: string;
    sensitivityAnalysis: string;
    conclusion: string;
  };
  
  documentId?: string;
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
