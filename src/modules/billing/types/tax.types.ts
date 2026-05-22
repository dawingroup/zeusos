/**
 * Tax treatment shape — produced by services/tax-treatment.service.ts
 * and stamped onto every InterCompanyInvoice + ClientInvoice at creation
 * time so the rate that was in force is preserved for audit.
 */

export type TaxTreatmentType =
  /** Standard domestic VAT — issuer charges and remits. */
  | 'STANDARD_VAT'
  /** Cross-border B2B services — issuer charges 0%, recipient self-accounts
   *  via reverse-charge. UG→KE and KE→UG fall here. */
  | 'REVERSE_CHARGE'
  /** Explicitly zero-rated (e.g. exports of goods). */
  | 'ZERO_RATED'
  /** Out of scope entirely (e.g. intercompany cost-share at-cost in some
   *  jurisdictions). */
  | 'EXEMPT';

export interface TaxTreatment {
  type: TaxTreatmentType;
  /** Rate in basis points. 1800 = 18.00%, 1600 = 16.00%, 0 = zero-rated. */
  rateBps: number;
  /** ISO-2 country of the issuing entity, kept for audit. */
  fromJurisdiction: string;
  /** ISO-2 country of the receiving entity. */
  toJurisdiction: string;
  /** Human-readable rationale shown on the invoice ("VAT 18% (UG domestic)"). */
  note: string;
}
