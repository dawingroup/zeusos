/**
 * Statutory tax rates by jurisdiction — ONE table.
 *
 * Rates are in basis points so they can be stored on a document without
 * floating-point drift (1600 = 16%). `taxMath.ts` turns them into fractions;
 * `billing/services/tax-treatment.service.ts` reads the VAT table to decide
 * domestic vs reverse-charge treatment.
 *
 * REVIEW BEFORE GO-LIVE: these are the working assumptions the billing spec
 * was written against (UG 18% / KE 16% VAT; UG 6% / KE 5% WHT on resident
 * professional and management fees). Finance should confirm them per entity.
 */

export type TaxJurisdiction = 'UG' | 'KE' | 'TZ' | 'RW' | 'US' | 'OTHER';

/** Standard-rate VAT by jurisdiction. 0 = no VAT regime we account for. */
export const VAT_RATE_BPS: Readonly<Record<TaxJurisdiction, number>> = Object.freeze({
  UG: 1800,
  KE: 1600,
  TZ: 1800,
  RW: 1800,
  US: 0,
  OTHER: 0,
});

/** Withholding tax on qualifying supplier payments (resident, services). */
export const WHT_RATE_BPS: Readonly<Partial<Record<TaxJurisdiction, number>>> = Object.freeze({
  UG: 600,
  KE: 500,
  TZ: 500,
  RW: 1500,
});

/** The jurisdiction a document with no `jurisdiction` / `base_country` is read in. */
export const DEFAULT_TAX_JURISDICTION: TaxJurisdiction = 'UG';

export function bpsToRate(bps: number): number {
  return Number((bps / 10000).toPrecision(15));
}
