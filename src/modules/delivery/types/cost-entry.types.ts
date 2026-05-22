/**
 * CostEntry — non-labour actuals (vendor invoices, media spend, expenses)
 * posted against an IWO. Same burn check as TimeEntry; pass-through items
 * (e.g. media spend) are flagged so reporting can separate margin work
 * from reimbursable spend.
 *
 * Spec §3.1 / §4.4.
 *
 * Lives at:
 *   organizations/{orgId}/internal_work_orders/{iwoId}/cost_entries/{ceId}
 */

import type { Timestamp } from 'firebase/firestore';

export type CostEntryKind = 'VENDOR' | 'MEDIA_SPEND' | 'EXPENSE' | 'FREELANCER';

export interface CostEntry {
  id: string;
  iwoId: string;
  kind: CostEntryKind;
  /** Free-text — vendor name, invoice ref, media vehicle. */
  description: string;
  amountMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  /** True if the cost passes straight through to the client (e.g.
   *  Facebook ad spend on the client's behalf). Pass-through items do
   *  not affect IWO margin and are reported separately on the client
   *  invoice line. */
  isPassThrough: boolean;
  /** Reference to a procurement PO / supplier invoice if applicable. */
  procurementRef?: string;
  /** Calendar date the cost was incurred (invoice date). */
  entryDate: Timestamp | string;
  postedByUserId: string;
  idempotencyKey?: string;
  createdAt: Timestamp | string;
}
