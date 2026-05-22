/**
 * Inter-Company Invoice — raised automatically when an IWO closes.
 * Settlement between a subsidiary and the parent. Always in the
 * subsidiary's currency; FX exposure stays with the parent until the
 * client invoice is consolidated.
 *
 * See plan §14.8 + Tech Spec §4.5.
 *
 * ─────────────────────────────────────────────────────────────────
 * TYPE DUPLICATION NOTE (follow-up — coordinate before reconciling)
 * ─────────────────────────────────────────────────────────────────
 * There are currently THREE shapes claiming to be `InterCompanyInvoice`:
 *
 * 1. THIS file (Phase 3.F billing module) — rich shape with
 *    `Money`-nested `amount`, `lines[]` array, `TaxTreatment` object,
 *    `glPostingIds[]`, status enum incl. DRAFT/SETTLED/VOID.
 *
 * 2. `src/modules/intercompany/types/intercompany-invoice.types.ts`
 *    (Phase 3.A.5 bounded-context skeleton) — flatter shape with
 *    `amountMinor`/`currency` split, no lines array, simpler status
 *    enum (RAISED/POSTED/PAID), `taxTreatment?: string`.
 *
 * 3. `functions/src/assignment/services/intercompany.admin.js`
 *    (Phase 3.B writer) — the **on-the-wire shape** actually written
 *    to Firestore on IWO close. Mostly compatible with THIS file:
 *    `amount: { amountMinor, currency }`, `lines[]`, `postedToGL:false`,
 *    `status: 'RAISED'`. Differs in `taxTreatment: { kind: 'PENDING',
 *    source: 'phase-3b-deferred' }` and adds `isPartial: boolean` for
 *    §11.5 partial-cancel settlement.
 *
 * Reconciliation should be done in one PR by whoever owns the
 * post-3.D cleanup sweep. The bias should be toward THIS shape (3.F)
 * because the billing UI + GL-adapter trigger already consume it and
 * 3.B's writer is mostly aligned. The 3.A.5 module type can be
 * narrowed to re-export from here (or dropped if no consumer exists).
 *
 * Until then: producers should write the 3.B on-the-wire shape;
 * consumers should be lenient about `taxTreatment` (accept both
 * object and `{kind:'PENDING'}`).
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
