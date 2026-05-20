/**
 * NAV and Valuation Types
 * 
 * Manages portfolio valuation:
 * - NAV calculation with multiple methodologies
 * - Valuation audit trail
 * - Fair value hierarchy
 * - Valuation adjustments
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount, NAVComponents, ValuationMethodology } from './portfolio';

export interface NAVHistory {
  id: string;
  portfolioId: string;
  valuationDate: Timestamp;
  
  grossAssetValue: MoneyAmount;
  netAssetValue: MoneyAmount;
  navPerUnit?: number;
  
  components: NAVComponents;
  
  status: 'draft' | 'preliminary' | 'final' | 'audited';
  
  changeFromPrevious?: {
    absolute: MoneyAmount;
    percentage: number;
    days: number;
  };
  
  createdBy: string;
  createdAt: Timestamp;
  finalizedAt?: Timestamp;
  finalizedBy?: string;
}

export interface ValuationRecord {
  id: string;
  portfolioId: string;
  holdingId?: string;
  
  valuationDate: Timestamp;
  methodology: ValuationMethodology;
  fairValueLevel: 1 | 2 | 3;
  
  previousValue: MoneyAmount;
  currentValue: MoneyAmount;
  valueChange: MoneyAmount;
  percentageChange: number;
  
  inputs: ValuationInput[];
  adjustments?: ValuationAdjustment[];
  
  narrative?: string;
  keyAssumptions?: string[];
  
  preparedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  
  supportingDocumentIds?: string[];
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ValuationInput {
  name: string;
  value: string | number;
  source: string;
  asOfDate?: Timestamp;
}

export interface ValuationAdjustment {
  type: 'liquidity' | 'control' | 'minority' | 'marketability' | 'currency' | 'other';
  description: string;
  amount: MoneyAmount;
  percentage?: number;
  rationale: string;
}

export interface NAVCalculationResult {
  portfolioId: string;
  calculationDate: Timestamp;
  
  grossAssetValue: MoneyAmount;
  totalLiabilities: MoneyAmount;
  netAssetValue: MoneyAmount;
  
  components: NAVComponents;
  
  holdingValuations: HoldingValuationSummary[];
  
  adjustments: ValuationAdjustment[];
  
  warnings?: string[];
  errors?: string[];
  
  isValid: boolean;
}

export interface HoldingValuationSummary {
  holdingId: string;
  holdingName: string;
  methodology: ValuationMethodology;
  fairValueLevel: 1 | 2 | 3;
  previousValue: MoneyAmount;
  currentValue: MoneyAmount;
  changePercentage: number;
}

export interface NAVReconciliation {
  portfolioId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  
  openingNAV: MoneyAmount;
  closingNAV: MoneyAmount;
  
  movements: NAVMovement[];
  
  totalInflows: MoneyAmount;
  totalOutflows: MoneyAmount;
  totalGains: MoneyAmount;
  totalLosses: MoneyAmount;
  
  reconciliationDifference: MoneyAmount;
  isReconciled: boolean;
}

export interface NAVMovement {
  type: 'capital_call' | 'distribution' | 'valuation_change' | 'income' | 'expense' | 'fx_movement' | 'other';
  description: string;
  amount: MoneyAmount;
  date: Timestamp;
  sourceId?: string;
}
