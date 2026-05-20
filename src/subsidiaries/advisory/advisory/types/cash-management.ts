/**
 * Cash Management Types
 * 
 * Manages portfolio cash:
 * - Cash positions and forecasting
 * - Bank accounts
 * - Cash flow projections
 */

import { Timestamp } from 'firebase/firestore';
import type { Currency, MoneyAmount } from './portfolio';

export interface CashForecast {
  id: string;
  portfolioId: string;
  
  periodStart: Timestamp;
  periodEnd: Timestamp;
  granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  
  openingBalance: MoneyAmount;
  
  projectedInflows: CashFlowProjection[];
  projectedOutflows: CashFlowProjection[];
  
  periodSummary: CashForecastPeriod[];
  
  closingBalance: MoneyAmount;
  
  minimumCashReached: MoneyAmount;
  minimumCashDate: Timestamp;
  
  fundingGap?: MoneyAmount;
  
  assumptions?: string[];
  createdBy: string;
  createdAt: Timestamp;
}

export interface CashFlowProjection {
  type: 'capital_call' | 'distribution' | 'investment' | 'realization' | 
        'income' | 'fee' | 'expense' | 'interest' | 'tax' | 'other';
  description: string;
  amount: MoneyAmount;
  expectedDate: Timestamp;
  probability: number;
  sourceId?: string;
  status: 'confirmed' | 'expected' | 'possible';
}

export interface CashForecastPeriod {
  periodStart: Timestamp;
  periodEnd: Timestamp;
  openingBalance: MoneyAmount;
  
  inflows: MoneyAmount;
  outflows: MoneyAmount;
  netFlow: MoneyAmount;
  
  capitalCalls: MoneyAmount;
  distributions: MoneyAmount;
  investments: MoneyAmount;
  realizations: MoneyAmount;
  income: MoneyAmount;
  fees: MoneyAmount;
  expenses: MoneyAmount;
  
  closingBalance: MoneyAmount;
}

export interface BankAccount {
  id: string;
  portfolioId: string;
  
  accountName: string;
  accountNumber: string;
  accountType: 'operating' | 'custody' | 'reserve' | 'distribution' | 'escrow';
  currency: Currency;
  
  bankName: string;
  bankCode?: string;
  branchCode?: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  
  bankAddress?: {
    line1: string;
    line2?: string;
    city: string;
    country: string;
  };
  
  status: 'active' | 'dormant' | 'closed';
  isPrimary: boolean;
  
  signatories?: string[];
  authorizationLevel?: 'single' | 'dual' | 'triple';
  
  openedDate?: Timestamp;
  closedDate?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface CashMovement {
  id: string;
  portfolioId: string;
  
  type: 'inflow' | 'outflow' | 'transfer';
  category: 'capital_call' | 'distribution' | 'investment' | 'realization' | 
            'income' | 'fee' | 'expense' | 'interest' | 'tax' | 'transfer' | 'other';
  
  amount: MoneyAmount;
  
  fromAccountId?: string;
  toAccountId?: string;
  
  transactionDate: Timestamp;
  valueDate: Timestamp;
  
  reference: string;
  description?: string;
  
  relatedEntityType?: 'capital_transaction' | 'holding' | 'expense';
  relatedEntityId?: string;
  
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  
  createdBy: string;
  createdAt: Timestamp;
  processedAt?: Timestamp;
}

export interface CashReconciliation {
  id: string;
  portfolioId: string;
  accountId: string;
  
  reconciliationDate: Timestamp;
  
  bookBalance: MoneyAmount;
  bankBalance: MoneyAmount;
  difference: MoneyAmount;
  
  outstandingItems: ReconciliationItem[];
  
  isReconciled: boolean;
  reconciledBy?: string;
  reconciledAt?: Timestamp;
  
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface ReconciliationItem {
  type: 'deposit_in_transit' | 'outstanding_check' | 'bank_fee' | 'interest' | 'error' | 'other';
  description: string;
  amount: MoneyAmount;
  date: Timestamp;
  resolved: boolean;
  resolvedAt?: Timestamp;
}

export interface CashAllocationRule {
  id: string;
  portfolioId: string;
  
  name: string;
  description?: string;
  
  triggerType: 'threshold' | 'schedule' | 'manual';
  
  thresholdConfig?: {
    minCash: MoneyAmount;
    maxCash: MoneyAmount;
    targetCash: MoneyAmount;
  };
  
  scheduleConfig?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  
  allocationTargets: {
    accountId: string;
    percentage: number;
    priority: number;
  }[];
  
  isActive: boolean;
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
