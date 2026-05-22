/**
 * BudgetHold — the allocation lifecycle that runs in parallel to the IWO
 * state machine. Holding at ISSUED (not ACCEPTED) is what closes the
 * double-allocation race (spec §11.1 / §7.1).
 *
 * Spec §4.5.
 *
 *   HELD     ← on IWO `issue` (same serializable txn as headroom check)
 *   LOCKED   ← on IWO `accept`
 *   SETTLED  ← on IWO `close` (raises InterCompanyInvoice)
 *   RELEASED ← on IWO `reject` / `cancel` (allocated_minor decrements)
 *
 * Partial settlement (spec §11.5): on `cancel` after partial mobilization
 * the incurred cost is settled via a partial inter-company invoice and
 * the remaining hold is RELEASED.
 *
 * Lives at `organizations/{orgId}/budget_holds/{holdId}`.
 */

import type { Timestamp } from 'firebase/firestore';
import type { BudgetHoldState } from '../constants/iwo-states';

export interface BudgetHold {
  id: string;
  masterJobId: string;
  iwoId: string;
  amountMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  state: BudgetHoldState;
  /** Partial settlement (spec §11.5) — when an IWO is cancelled after
   *  partial work, this records the amount IC-invoiced before the rest
   *  was RELEASED. Sum (settledMinor + releasedMinor) ≤ amountMinor. */
  settledMinor?: number;
  releasedMinor?: number;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
