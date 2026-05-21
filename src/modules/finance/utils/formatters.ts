// ============================================================================
// FORMATTERS
// ZeusOS v2.0 - Financial Management Module
// Utility functions for formatting currency, dates, and numbers
// ============================================================================

import type { CurrencyCode } from '../constants/currency.constants';

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  _currency: CurrencyCode = 'UGX',
  options?: Intl.NumberFormatOptions
): string {
  const formatter = new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options,
  });

  return formatter.format(amount);
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(
  value: number,
  decimals: number = 0,
  locale: string = 'en-UG'
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a percentage
 */
export function formatPercent(
  value: number,
  decimals: number = 1,
  locale: string = 'en-UG'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format a date
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
}

/**
 * Format a fiscal year
 */
export function formatFiscalYear(fiscalYear: number): string {
  return `FY${fiscalYear} (Jul ${fiscalYear - 1} - Jun ${fiscalYear})`;
}

/**
 * Format a fiscal month
 */
export function formatFiscalMonth(fiscalMonth: number, fiscalYear: number): string {
  const monthNames = [
    'July', 'August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May', 'June'
  ];
  const monthName = monthNames[fiscalMonth - 1] || '';
  const calendarYear = fiscalMonth <= 6 ? fiscalYear - 1 : fiscalYear;
  return `${monthName} ${calendarYear}`;
}

/**
 * Format variance with color indicator
 */
export function formatVariance(variance: number, currency: CurrencyCode = 'UGX'): {
  text: string;
  color: 'success' | 'error' | 'warning';
} {
  const absVariance = Math.abs(variance);
  const formatted = formatCurrency(absVariance, currency);
  
  if (variance > 0) {
    return { text: `${formatted} under`, color: 'success' };
  } else if (variance < 0) {
    return { text: `${formatted} over`, color: 'error' };
  }
  return { text: 'On budget', color: 'success' };
}

/**
 * Format account code with hierarchy
 */
export function formatAccountCode(code: string): string {
  // Format as XX-XXX-XXXX if applicable
  if (code.length === 9 && !code.includes('-')) {
    return `${code.slice(0, 2)}-${code.slice(2, 5)}-${code.slice(5)}`;
  }
  return code;
}

/**
 * Abbreviate large numbers
 */
export function abbreviateNumber(value: number, _decimals: number = 1): string {
  return new Intl.NumberFormat('en-UG', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
