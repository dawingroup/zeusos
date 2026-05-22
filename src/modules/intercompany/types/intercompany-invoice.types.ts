/**
 * InterCompanyInvoice — subsidiary → parent invoice at the governed
 * transfer price, raised on IWO close.
 *
 * Spec §3.1 / §4.5 / §8.3.
 *
 *   On IWO → CLOSED:
 *     ic = InterCompanyInvoice(
 *            from   = subsidiary,
 *            to     = parent,
 *            amount = iwo.transferPriceMinor,
 *            currency = iwo.currency)
 *     post(ic → subsidiary.GL as revenue, parent.GL as cost)
 *     budgetHold(iwo).state = SETTLED
 *
 * Per spec §11.6 the IC invoice is in the **subsidiary's currency**;
 * the single conversion to the client billing currency happens later at
 * the consolidated ClientInvoice step. FX exposure between IC settlement
 * and client payment sits with the parent.
 *
 * Lives at:
 *   organizations/{orgId}/intercompany_invoices/{icInvoiceId}
 *
 * UNIQUE (iwoId) — at most one IC invoice per IWO close. Partial-cancel
 * (spec §11.5) raises one IC invoice for the work done; the remaining
 * hold is RELEASED separately.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';

export type InterCompanyInvoiceStatus = 'RAISED' | 'POSTED' | 'PAID';

export interface InterCompanyInvoice {
  id: string;
  iwoId: string;
  /** Subsidiary that did the work. */
  fromOrgId: SubsidiaryId;
  /** Always the parent (`'zeus-group'`). */
  toOrgId: SubsidiaryId;
  /** Always equal to the governed transfer price on the IWO at close. */
  amountMinor: number;
  /** Always the subsidiary's base currency (spec §11.6). */
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  /** Jurisdiction-driven tax treatment hint for the GL adapter. */
  taxTreatment?: string;
  status: InterCompanyInvoiceStatus;
  /** Whether the GL adapter has posted this invoice to both entities'
   *  books (subsidiary revenue + parent cost). Phase 3.F runs this. */
  postedToGl: boolean;
  postedAt?: Timestamp | string;
  paidAt?: Timestamp | string;
  idempotencyKey?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
