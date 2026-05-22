/**
 * TimeEntry — actuals posted by a subsidiary against an IWO.
 *
 * Spec §3.1 / §4.4.
 *
 * Lives at:
 *   organizations/{orgId}/internal_work_orders/{iwoId}/time_entries/{teId}
 *
 * Cost is computed `minutes * rateCardLine.costMinor / unitMinutes` at
 * post time (Phase 3.B). The hard 100% budget block (spec §11.2) gates
 * inserts against `iwo.cumulativeCostMinor + entry.costMinor`.
 *
 * costMinor on a TimeEntry is INTERNAL — same field-level guard as
 * RateCardLine.costMinor and QuoteLine.costMinor; subsidiary-org users
 * cannot read it from a sibling subsidiary's IWO.
 */

import type { Timestamp } from 'firebase/firestore';

export interface TimeEntry {
  id: string;
  iwoId: string;
  /** Who logged the time. */
  userId: string;
  /** Free-text note shown to AM in the burn dashboard. */
  note?: string;
  minutes: number;
  /** Computed at post time from the rate card line pinned to the IWO. */
  costMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  /** Calendar date the work happened (not the entry timestamp). */
  entryDate: Timestamp | string;
  /** Idempotency key from the originating mutation. */
  idempotencyKey?: string;
  createdAt: Timestamp | string;
}
