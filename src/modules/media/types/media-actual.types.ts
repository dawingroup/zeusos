/**
 * MediaActual — reconciliation record posted after a campaign run.
 *
 * Stored as a subcollection: media_plans/{planId}/actuals/{actualId}.
 */

import type { Timestamp } from 'firebase/firestore';

export interface MediaActual {
  id: string;
  planId: string;
  /** The buy this actual reconciles. */
  buyId: string;
  actualMinor: number;
  /** Optional performance metrics. */
  impressions?: number;
  reach?: number;
  clicks?: number;
  conversions?: number;
  /** ISO date when this actual was reported. */
  reportedAt: string;
  reportedBy: string;
  notes?: string;
  createdAt: Timestamp | string;
}
