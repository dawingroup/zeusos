/**
 * MediaPlan — top-level header for a media buying plan tied to a MasterJob.
 *
 * A MediaPlan holds the budget envelope and links to its buy rows
 * (media_buys subcollection) and reconciliation actuals (actuals subcollection).
 */

import type { Timestamp } from 'firebase/firestore';

export type MediaPlanStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export type CurrencyCode = 'UGX' | 'USD' | 'KES';

export interface MediaPlan {
  id: string;
  /** Link back to the top-level Campaign engagement. */
  masterJobId: string;
  /** Optional specific campaign within the master job. */
  campaignId?: string;
  /** Which sub-brand owns this plan. */
  subsidiaryOrgId: string;
  status: MediaPlanStatus;
  currency: CurrencyCode;
  /** Total approved budget in minor units (e.g. UGX cents). */
  totalBudgetMinor: number;
  /** Plan title for display — e.g. "Q3 2026 OOH + Digital". */
  title: string;
  /** Optional notes from the media planner. */
  notes?: string;
  flightStartDate?: string;
  flightEndDate?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
