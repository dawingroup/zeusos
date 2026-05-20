/**
 * Holding Income Types
 * 
 * Tracks income received from holdings:
 * - Dividends
 * - Interest payments
 * - Fees and other income
 */

import { Timestamp } from 'firebase/firestore';
import type { Currency, MoneyAmount } from './portfolio';

export type IncomeType =
  | 'dividend'
  | 'preferred_dividend'
  | 'interest'
  | 'pik_interest'
  | 'principal_repayment'
  | 'management_fee'
  | 'directors_fee'
  | 'arrangement_fee'
  | 'commitment_fee'
  | 'exit_fee'
  | 'distribution'
  | 'capital_return'
  | 'royalty'
  | 'other';

export type IncomeStatus =
  | 'expected'
  | 'declared'
  | 'accrued'
  | 'received'
  | 'cancelled';

export interface HoldingIncome {
  id: string;
  holdingId: string;
  portfolioId: string;
  
  type: IncomeType;
  status: IncomeStatus;
  
  grossAmount: MoneyAmount;
  withholdingTax?: MoneyAmount;
  otherDeductions?: MoneyAmount;
  netAmount: MoneyAmount;
  
  originalCurrency?: Currency;
  exchangeRate?: number;
  
  dividendDetails?: {
    exDate: Timestamp;
    recordDate: Timestamp;
    paymentDate: Timestamp;
    dividendPerShare?: number;
    sharesHeld?: number;
    dividendType?: 'regular' | 'special' | 'interim' | 'final';
  };
  
  interestDetails?: {
    periodStart: Timestamp;
    periodEnd: Timestamp;
    principalAmount: MoneyAmount;
    interestRate: number;
    dayCountConvention?: string;
  };
  
  distributionDetails?: {
    distributionType: 'income' | 'capital_return' | 'capital_gain' | 'recallable';
    lpInterest: number;
    totalDistribution?: MoneyAmount;
  };
  
  periodStart?: Timestamp;
  periodEnd?: Timestamp;
  declaredDate?: Timestamp;
  paymentDate: Timestamp;
  receivedDate?: Timestamp;
  
  bankAccount?: string;
  reference?: string;
  
  documentIds?: string[];
  
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  processedBy?: string;
  processedAt?: Timestamp;
}

export interface IncomeSchedule {
  id: string;
  holdingId: string;
  
  incomeType: IncomeType;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'irregular';
  
  regularAmount?: MoneyAmount;
  nextPaymentDate?: Timestamp;
  
  scheduledPayments: {
    date: Timestamp;
    amount: MoneyAmount;
    status: 'scheduled' | 'received' | 'missed';
  }[];
  
  isActive: boolean;
  endDate?: Timestamp;
  
  notes?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface IncomeForecast {
  holdingId: string;
  portfolioId: string;
  
  periodStart: Timestamp;
  periodEnd: Timestamp;
  
  projectedDividends: MoneyAmount;
  projectedInterest: MoneyAmount;
  projectedFees: MoneyAmount;
  projectedOther: MoneyAmount;
  projectedTotal: MoneyAmount;
  
  byPeriod: {
    period: Timestamp;
    dividends: MoneyAmount;
    interest: MoneyAmount;
    fees: MoneyAmount;
    total: MoneyAmount;
  }[];
  
  projectedYield: number;
  
  confidence: 'high' | 'medium' | 'low';
  
  assumptions?: string[];
  
  generatedAt: Timestamp;
  generatedBy: string;
}

export interface IncomeAnalysis {
  holdingId: string;
  
  totalReceived: MoneyAmount;
  averagePerPeriod: MoneyAmount;
  
  byType: {
    type: IncomeType;
    amount: MoneyAmount;
    count: number;
    percentage: number;
  }[];
  
  byYear: {
    year: number;
    amount: MoneyAmount;
    count: number;
  }[];
  
  yieldAnalysis: {
    currentYield: number;
    averageYield: number;
    yieldOnCost: number;
    yieldOnFairValue: number;
  };
  
  trends: {
    growthRate: number;
    volatility: number;
    consistency: 'stable' | 'volatile' | 'growing' | 'declining';
  };
  
  asOfDate: Timestamp;
}
