/**
 * Inter-Company Invoice — raised automatically when an IWO closes
 * (Phase 3.B trigger, deferred). Settlement between a subsidiary and the
 * parent. Always in the subsidiary's currency; FX exposure stays with the
 * parent until the client invoice is consolidated.
 *
 * See plan §14.8 + Tech Spec §4.5.
 */

import type { Timestamp } from 'firebase/firestore';
import type { Money } from './money.types';
import type { TaxTreatment } from './tax.types';

export type InterCompanyInvoiceStatus =
  /** Created but not yet posted to either GL (transient — usually skipped). */
  | 'DRAFT'
  /** Visible on both sides; awaiting GL postings. */
  | 'RAISED'
  /** GL postings recorded on both subsidiary and parent ledgers. */
  | 'POSTED'
  /** Cash has flowed against the IC AR/AP. */
  | 'SETTLED'
  /** Cancelled. Never reaches POSTED. */
  | 'VOID';

export interface InterCompanyInvoiceLine {
  /** Stable ID inside the invoice (not a Firestore subcollection ID). */
  id: string;
  description: string;
  /** Internal-only — the transfer-price minor amount allocated to this line.
   *  Never exposed in client-facing surfaces. */
  amountMinor: number;
  /** Optional pointer back to the source IWO time/cost entry for audit. */
  sourceEntryId?: string;
}

export interface InterCompanyInvoice {
  id: string;
  /** Sub-brand issuing the invoice (the seller). */
  fromOrgId: string;
  /** Always 'zeus-group' (the parent / Account-Management side). */
  toOrgId: string;
  /** Linked Internal Work Order (Phase 3.B). Empty string allowed for now
   *  while the IWO module is not yet implemented. */
  iwoId: string;
  /** MasterJob the IWO rolls up to. */
  masterJobId: string;

  /** Transfer-price total — governed centrally, decoupled from client markup. */
  amount: Money;
  /** Per-line breakdown. Sum(lines.amountMinor) === amount.amountMinor. */
  lines: InterCompanyInvoiceLine[];

  taxTreatment: TaxTreatment;
  status: InterCompanyInvoiceStatus;

  /** Once the GL adapter has acknowledged both legs (subsidiary AR + parent
   *  cost), this flips to true and the corresponding GLPosting IDs are
   *  recorded for audit. Until then status stays RAISED. */
  postedToGL: boolean;
  /** GLPosting document IDs (one per leg — subsidiary + parent). */
  glPostingIds?: string[];

  /** Idempotency key from the IWO close event — guarantees one IC invoice
   *  per IWO close regardless of trigger retries. Phase 3.B will populate. */
  idempotencyKey?: string;

  raisedAt: Timestamp | string;
  postedAt?: Timestamp | string;
  settledAt?: Timestamp | string;
  voidedAt?: Timestamp | string;
}
