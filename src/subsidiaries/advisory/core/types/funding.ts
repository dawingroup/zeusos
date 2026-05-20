/**
 * FUNDING.TS
 * Main funding source types for engagements
 * 
 * This file re-exports from modular funding files and defines
 * the FundingSource entity that ties everything together.
 */

import { Timestamp } from 'firebase/firestore';
import { Money } from './money';
import { FundingCategory } from './funding-category';
import { FundingInstrument } from './funding-instrument';
import { FundingTerms } from './funding-terms';
import { FunderRef, FunderType } from './funder';
import { ReportingRequirement, Covenant } from './compliance';

// Re-export from modular files for backwards compatibility
export type { FundingCategory } from './funding-category';
export type { FundingInstrument } from './funding-instrument';
export type { FunderType } from './funder';

/**
 * FUNDING SOURCE STATUS
 */
export type FundingSourceStatus =
  | 'pipeline'           // In negotiation
  | 'committed'          // Agreement signed but not disbursed
  | 'disbursing'         // Active disbursement
  | 'fully_disbursed'    // All funds disbursed
  | 'repaying'           // In repayment (for debt)
  | 'closed'             // Completed/closed
  | 'cancelled';         // Cancelled before completion

/**
 * COMPLIANCE STATUS
 */
export type ComplianceStatus = 'compliant' | 'watch' | 'breach';

/**
 * FUNDING SOURCE
 * A source of funding for an engagement
 */
export interface FundingSource {
  id: string;
  
  // ─────────────────────────────────────────────────────────────────
  // CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────
  
  /** High-level category */
  category: FundingCategory;
  
  /** Specific instrument type */
  instrumentType: FundingInstrument;
  
  /** Funder type */
  funderType: FunderType;
  
  // ─────────────────────────────────────────────────────────────────
  // FUNDER
  // ─────────────────────────────────────────────────────────────────
  
  /** Funder entity ID */
  funderId: string;
  
  /** Funder reference (denormalized) */
  funder: FunderRef;
  
  /** Grant/loan agreement reference number */
  agreementReference?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // AMOUNTS
  // ─────────────────────────────────────────────────────────────────
  
  /** Total committed amount */
  committedAmount: Money;
  
  /** Amount disbursed to date */
  disbursedAmount: Money;
  
  /** Available undisbursed balance */
  availableBalance: Money;
  
  /** Percentage of total engagement funding */
  percentageOfTotal: number;
  
  // ─────────────────────────────────────────────────────────────────
  // TERMS
  // ─────────────────────────────────────────────────────────────────
  
  /** Funding-specific terms (polymorphic) */
  terms: FundingTerms;
  
  // ─────────────────────────────────────────────────────────────────
  // COMPLIANCE
  // ─────────────────────────────────────────────────────────────────
  
  /** Funder-specific reporting requirements */
  reportingRequirements: ReportingRequirement[];
  
  /** Active covenants */
  covenants: Covenant[];
  
  /** Compliance status */
  complianceStatus: ComplianceStatus;
  
  // ─────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────
  
  /** Funding status */
  status: FundingSourceStatus;
  
  /** Signing date */
  signingDate?: Timestamp;
  
  /** First disbursement date */
  firstDisbursementDate?: Timestamp;
  
  /** Final disbursement date */
  finalDisbursementDate?: Timestamp;
  
  /** Closure date */
  closureDate?: Timestamp;
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  /** Notes */
  notes?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * FUNDING SUMMARY
 * Aggregated funding view for an engagement
 */
export interface FundingSummary {
  /** Total committed across all sources */
  totalCommitted: Money;
  
  /** Total disbursed across all sources */
  totalDisbursed: Money;
  
  /** Total available across all sources */
  totalAvailable: Money;
  
  /** Disbursement percentage */
  disbursementPercentage: number;
  
  /** By category breakdown */
  byCategory: {
    category: FundingCategory;
    amount: Money;
    percentage: number;
  }[];
  
  /** By funder breakdown */
  byFunder: {
    funder: FunderRef;
    amount: Money;
    percentage: number;
  }[];
  
  /** Source count */
  sourceCount: number;
}

/**
 * CREATE FUNDING SOURCE DATA
 */
export interface CreateFundingSourceData {
  category: FundingCategory;
  instrumentType: FundingInstrument;
  funderId: string;
  committedAmount: Money;
  agreementReference?: string;
  terms: FundingTerms;
}

/**
 * FUNDING SOURCE REF
 * Lightweight reference
 */
export interface FundingSourceRef {
  id: string;
  category: FundingCategory;
  funderName: string;
  committedAmount: Money;
  status: FundingSourceStatus;
}

/**
 * Get funding status display name
 */
export function getFundingStatusDisplayName(status: FundingSourceStatus): string {
  const names: Record<FundingSourceStatus, string> = {
    pipeline: 'Pipeline',
    committed: 'Committed',
    disbursing: 'Disbursing',
    fully_disbursed: 'Fully Disbursed',
    repaying: 'Repaying',
    closed: 'Closed',
    cancelled: 'Cancelled',
  };
  return names[status];
}

/**
 * Get funding status color
 */
export function getFundingStatusColor(status: FundingSourceStatus): string {
  const colors: Record<FundingSourceStatus, string> = {
    pipeline: 'gray',
    committed: 'blue',
    disbursing: 'green',
    fully_disbursed: 'teal',
    repaying: 'purple',
    closed: 'gray',
    cancelled: 'red',
  };
  return colors[status];
}

/**
 * Check if funding source is active
 */
export function isFundingActive(source: FundingSource): boolean {
  return ['disbursing', 'fully_disbursed', 'repaying'].includes(source.status);
}

/**
 * Check if funding source is in pipeline
 */
export function isFundingInPipeline(source: FundingSource): boolean {
  return source.status === 'pipeline';
}

/**
 * Check if funding source is closed
 */
export function isFundingClosed(source: FundingSource): boolean {
  return ['closed', 'cancelled'].includes(source.status);
}

/**
 * Calculate funding summary from sources
 */
export function calculateFundingSummary(
  sources: FundingSource[],
  baseCurrency: string = 'USD'
): FundingSummary {
  const totalCommitted = sources.reduce(
    (sum, s) => sum + s.committedAmount.amount,
    0
  );
  const totalDisbursed = sources.reduce(
    (sum, s) => sum + s.disbursedAmount.amount,
    0
  );
  
  const byCategory = new Map<FundingCategory, number>();
  const byFunder = new Map<string, { funder: FunderRef; amount: number }>();
  
  sources.forEach(source => {
    // By category
    const current = byCategory.get(source.category) || 0;
    byCategory.set(source.category, current + source.committedAmount.amount);
    
    // By funder
    const funderCurrent = byFunder.get(source.funderId);
    if (funderCurrent) {
      funderCurrent.amount += source.committedAmount.amount;
    } else {
      byFunder.set(source.funderId, {
        funder: source.funder,
        amount: source.committedAmount.amount,
      });
    }
  });
  
  return {
    totalCommitted: { amount: totalCommitted, currency: baseCurrency },
    totalDisbursed: { amount: totalDisbursed, currency: baseCurrency },
    totalAvailable: { amount: totalCommitted - totalDisbursed, currency: baseCurrency },
    disbursementPercentage: totalCommitted > 0 ? (totalDisbursed / totalCommitted) * 100 : 0,
    byCategory: Array.from(byCategory.entries()).map(([category, amount]) => ({
      category,
      amount: { amount, currency: baseCurrency },
      percentage: totalCommitted > 0 ? (amount / totalCommitted) * 100 : 0,
    })),
    byFunder: Array.from(byFunder.values()).map(({ funder, amount }) => ({
      funder,
      amount: { amount, currency: baseCurrency },
      percentage: totalCommitted > 0 ? (amount / totalCommitted) * 100 : 0,
    })),
    sourceCount: sources.length,
  };
}

/**
 * Calculate total committed from funding sources
 */
export function calculateTotalCommitted(sources: FundingSource[]): Money {
  if (sources.length === 0) {
    return { amount: 0, currency: 'USD' };
  }
  
  const currency = sources[0].committedAmount.currency;
  const total = sources.reduce((sum, s) => sum + s.committedAmount.amount, 0);
  
  return { amount: total, currency };
}

/**
 * Calculate total disbursed from funding sources
 */
export function calculateTotalDisbursed(sources: FundingSource[]): Money {
  if (sources.length === 0) {
    return { amount: 0, currency: 'USD' };
  }
  
  const currency = sources[0].disbursedAmount.currency;
  const total = sources.reduce((sum, s) => sum + s.disbursedAmount.amount, 0);
  
  return { amount: total, currency };
}

/**
 * Derive primary funding category from sources
 */
export function derivePrimaryFundingCategory(sources: FundingSource[]): FundingCategory {
  if (sources.length === 0) return 'grant';
  if (sources.length === 1) return sources[0].category;
  
  // Find the category with highest committed amount
  const categoryTotals = sources.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + s.committedAmount.amount;
    return acc;
  }, {} as Record<FundingCategory, number>);
  
  let maxCategory: FundingCategory = 'grant';
  let maxAmount = 0;
  
  for (const [category, amount] of Object.entries(categoryTotals)) {
    if (amount > maxAmount) {
      maxAmount = amount;
      maxCategory = category as FundingCategory;
    }
  }
  
  return maxCategory;
}

/**
 * Convert FundingSource to FundingSourceRef
 */
export function toFundingSourceRef(source: FundingSource): FundingSourceRef {
  return {
    id: source.id,
    category: source.category,
    funderName: source.funder.name,
    committedAmount: source.committedAmount,
    status: source.status,
  };
}
