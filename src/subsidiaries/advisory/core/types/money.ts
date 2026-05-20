/**
 * MONEY
 * Currency-aware monetary value
 */
export interface Money {
  /** Numeric amount */
  amount: number;
  
  /** ISO 4217 currency code */
  currency: string;
}

/**
 * Create a Money object
 */
export function money(amount: number, currency: string = 'USD'): Money {
  return { amount, currency };
}

/**
 * Format money for display
 */
export function formatMoney(value: Money, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amount);
}

/**
 * Add two money values (must be same currency)
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency}`);
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

/**
 * Subtract money values (must be same currency)
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract ${b.currency} from ${a.currency}`);
  }
  return { amount: a.amount - b.amount, currency: a.currency };
}

/**
 * Multiply money by a factor
 */
export function multiplyMoney(value: Money, factor: number): Money {
  return { amount: value.amount * factor, currency: value.currency };
}

/**
 * Check if money value is zero
 */
export function isZeroMoney(value: Money): boolean {
  return value.amount === 0;
}

/**
 * Check if money value is positive
 */
export function isPositiveMoney(value: Money): boolean {
  return value.amount > 0;
}

/**
 * Create zero money in a currency
 */
export function zeroMoney(currency: string = 'USD'): Money {
  return { amount: 0, currency };
}

/**
 * Common currencies for advisory platform
 */
export const CURRENCIES = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  UGX: 'UGX',
  KES: 'KES',
  TZS: 'TZS',
  RWF: 'RWF',
  ZAR: 'ZAR',
  ETB: 'ETB',
  SSP: 'SSP',
} as const;

export type CurrencyCode = typeof CURRENCIES[keyof typeof CURRENCIES];

/**
 * Currency display info
 */
export const CURRENCY_INFO: Record<CurrencyCode, { name: string; symbol: string }> = {
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  UGX: { name: 'Ugandan Shilling', symbol: 'USh' },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh' },
  TZS: { name: 'Tanzanian Shilling', symbol: 'TSh' },
  RWF: { name: 'Rwandan Franc', symbol: 'FRw' },
  ZAR: { name: 'South African Rand', symbol: 'R' },
  ETB: { name: 'Ethiopian Birr', symbol: 'Br' },
  SSP: { name: 'South Sudanese Pound', symbol: '£' },
};
