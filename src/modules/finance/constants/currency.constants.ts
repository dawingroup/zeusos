// ============================================================================
// CURRENCY CONSTANTS
// DawinOS v2.0 - Financial Management Module
// Multi-currency support for Uganda operations
// ============================================================================

/**
 * Supported Currencies
 * Primary: UGX (Uganda Shilling)
 * Common: USD, EUR, GBP, KES
 */
export const CURRENCIES = {
  UGX: 'UGX',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  KES: 'KES',
  AED: 'AED',
  ZAR: 'ZAR',
} as const;

export type CurrencyCode = typeof CURRENCIES[keyof typeof CURRENCIES];

/**
 * Currency Configuration
 */
export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimalPlaces: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  symbolPosition: 'before' | 'after';
}

export const CURRENCY_CONFIG: Record<CurrencyCode, CurrencyConfig> = {
  [CURRENCIES.UGX]: {
    code: 'UGX',
    name: 'Uganda Shilling',
    symbol: '',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
  },
  [CURRENCIES.USD]: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
  },
  [CURRENCIES.EUR]: {
    code: 'EUR',
    name: 'Euro',
    symbol: '',
    decimalPlaces: 0,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    symbolPosition: 'before',
  },
  [CURRENCIES.GBP]: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
  },
  [CURRENCIES.KES]: {
    code: 'KES',
    name: 'Kenya Shilling',
    symbol: '',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
  },
  [CURRENCIES.AED]: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: '',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
  },
  [CURRENCIES.ZAR]: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: '',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
  },
};

/**
 * Default Currency for Uganda operations
 */
export const DEFAULT_CURRENCY: CurrencyCode = CURRENCIES.UGX;

/**
 * Currency Labels for UI display
 */
export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  [CURRENCIES.UGX]: 'Uganda Shilling',
  [CURRENCIES.USD]: 'US Dollar',
  [CURRENCIES.EUR]: 'Euro',
  [CURRENCIES.GBP]: 'British Pound',
  [CURRENCIES.KES]: 'Kenya Shilling',
  [CURRENCIES.AED]: 'UAE Dirham',
  [CURRENCIES.ZAR]: 'South African Rand',
};

/**
 * Functional Currency (reporting currency)
 */
export const FUNCTIONAL_CURRENCY: CurrencyCode = CURRENCIES.UGX;

/**
 * Exchange Rate Types
 */
export const EXCHANGE_RATE_TYPES = {
  SPOT: 'spot',
  AVERAGE: 'average',
  CLOSING: 'closing',
  BUDGET: 'budget',
} as const;

export type ExchangeRateType = typeof EXCHANGE_RATE_TYPES[keyof typeof EXCHANGE_RATE_TYPES];

/**
 * Exchange Rate Source
 */
export const EXCHANGE_RATE_SOURCES = {
  BANK_OF_UGANDA: 'bank_of_uganda',
  MANUAL: 'manual',
  API: 'api',
} as const;

export type ExchangeRateSource = typeof EXCHANGE_RATE_SOURCES[keyof typeof EXCHANGE_RATE_SOURCES];

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode | string = DEFAULT_CURRENCY,
  _showSymbol: boolean = true
): string {
  const config = CURRENCY_CONFIG[currencyCode as CurrencyCode] ?? CURRENCY_CONFIG[DEFAULT_CURRENCY];

  if (!config) {
    // Fallback for completely unknown currencies
    return String(Math.round(Math.abs(amount)));
  }

  const formattedNumber = Math.abs(amount)
    .toFixed(config.decimalPlaces)
    .replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);

  const sign = amount < 0 ? '-' : '';

  return `${sign}${formattedNumber}`;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string, currencyCode: CurrencyCode = DEFAULT_CURRENCY): number {
  const config = CURRENCY_CONFIG[currencyCode] ?? CURRENCY_CONFIG[DEFAULT_CURRENCY];

  if (!config) return parseFloat(value) || 0;

  // Remove currency symbol and spaces
  let cleaned = value.replace(new RegExp(`[${config.symbol}\\s]`, 'g'), '');
  
  // Handle thousands separator
  cleaned = cleaned.replace(new RegExp(`\\${config.thousandsSeparator}`, 'g'), '');
  
  // Handle decimal separator
  if (config.decimalSeparator !== '.') {
    cleaned = cleaned.replace(config.decimalSeparator, '.');
  }
  
  return parseFloat(cleaned) || 0;
}

/**
 * Default exchange rates to functional currency (UGX).
 * Centralised source of truth — replaces scattered hardcoded rates
 * in PartsTab, capital/constants, useMarketData, etc.
 */
export const EXCHANGE_RATES_TO_UGX: Record<string, number> = {
  UGX: 1,
  USD: 3700,
  EUR: 4000,
  GBP: 4600,
  AED: 1000,
  CNY: 510,
  KES: 29,
  ZAR: 205,
};

/**
 * Convert an amount from any supported currency to the functional currency (UGX).
 * Returns both the converted amount and the rate used.
 */
export function convertToFunctionalCurrency(
  amount: number,
  fromCurrency: string,
): { amountUGX: number; rate: number } {
  const rate = EXCHANGE_RATES_TO_UGX[fromCurrency] ?? 1;
  return { amountUGX: Math.round(amount * rate), rate };
}

/**
 * Convert amount between currencies
 */
export function convertCurrency(
  amount: number,
  _fromCurrency: CurrencyCode,
  _toCurrency: CurrencyCode,
  exchangeRate: number
): number {
  // Rate is assumed to be: 1 fromCurrency = X toCurrency
  return amount * exchangeRate;
}
