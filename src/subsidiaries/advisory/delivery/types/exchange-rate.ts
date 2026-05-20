/**
 * EXCHANGE RATE TYPES
 *
 * Per-transaction exchange rate tracking for multi-currency budget management.
 * Program budgets are in USD; project expenditures are in UGX.
 * Each payment/requisition records its own rate at time of entry.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// PER-TRANSACTION EXCHANGE RATE
// ─────────────────────────────────────────────────────────────────

/**
 * Embedded on each Payment / Requisition at time of entry.
 * Not a standalone Firestore document — this is a sub-object.
 */
export interface TransactionExchangeRate {
  fromCurrency: string;         // e.g. 'USD'
  toCurrency: string;           // e.g. 'UGX'
  rate: number;                 // Forward rate: 1 fromCurrency = rate toCurrency (e.g. 3750)
  inverseRate: number;          // 1 toCurrency = inverseRate fromCurrency
  rateDate: Date;               // Date the rate was captured/applied
  source: ExchangeRateSource;
  notes?: string;               // Optional justification for rate used
}

export type ExchangeRateSource = 'manual' | 'reference' | 'bank_rate';

// ─────────────────────────────────────────────────────────────────
// STORED EXCHANGE RATE ENTRY (Program-Level Reference Table)
// ─────────────────────────────────────────────────────────────────

/**
 * Firestore document in `advisory_programs/{programId}/exchange_rates`.
 * Reference rates that can be selected when entering a transaction.
 */
export interface ExchangeRateEntry {
  id: string;
  programId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: Date;
  expiresDate?: Date;
  source: ExchangeRateSource;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Convert an amount using a transaction exchange rate.
 * 'forward': fromCurrency → toCurrency (e.g. USD → UGX: amount * rate)
 * 'inverse': toCurrency → fromCurrency (e.g. UGX → USD: amount * inverseRate)
 */
export function convertAmount(
  amount: number,
  rate: TransactionExchangeRate,
  direction: 'forward' | 'inverse' = 'forward'
): number {
  if (direction === 'forward') {
    return amount * rate.rate;
  }
  return amount * rate.inverseRate;
}

/**
 * Format an exchange rate for display: "1 USD = 3,750 UGX"
 */
export function formatExchangeRate(rate: TransactionExchangeRate): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate.rate);
  return `1 ${rate.fromCurrency} = ${formatted} ${rate.toCurrency}`;
}

/**
 * Create a TransactionExchangeRate from basic inputs.
 * Automatically computes the inverse rate.
 */
export function createExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  date?: Date,
  source: ExchangeRateSource = 'manual'
): TransactionExchangeRate {
  return {
    fromCurrency,
    toCurrency,
    rate,
    inverseRate: rate > 0 ? 1 / rate : 0,
    rateDate: date || new Date(),
    source,
  };
}

/**
 * Check if an exchange rate entry is currently effective
 */
export function isRateEffective(entry: ExchangeRateEntry, asOf: Date = new Date()): boolean {
  const effective = new Date(entry.effectiveDate);
  if (asOf < effective) return false;
  if (entry.expiresDate) {
    const expires = new Date(entry.expiresDate);
    if (asOf > expires) return false;
  }
  return true;
}
