/**
 * Money primitives — minor units only.
 *
 * Per Tech Spec §4.5: all amounts are stored as integer minor units
 * (UGX has 0 decimals so 1 UGX = 1 minor; USD has 2 decimals so $1.00 =
 * 100 minor). Float math on monetary amounts is banned at the type level.
 */

import type { CurrencyCode } from '@/modules/finance/constants/currency.constants';

export type { CurrencyCode };

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}
