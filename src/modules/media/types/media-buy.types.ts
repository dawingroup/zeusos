/**
 * MediaBuy — one row per channel/vehicle within a MediaPlan.
 *
 * Stored as a subcollection: media_plans/{planId}/media_buys/{buyId}.
 */

import type { Timestamp } from 'firebase/firestore';

export type MediaVehicleType =
  | 'TV'
  | 'RADIO'
  | 'PRINT'
  | 'OOH'
  | 'DIGITAL'
  | 'SOCIAL'
  | 'SEARCH'
  | 'PROGRAMMATIC';

export interface MediaBuy {
  id: string;
  /** Parent plan ID — duplicated for query convenience. */
  planId: string;
  vehicleName: string;
  vehicleType: MediaVehicleType;
  /** ISO date strings for the buy flight. */
  startDate: string;
  endDate: string;
  /** Planned cost in minor units. */
  plannedMinor: number;
  /** Committed/booked cost (after IO or contract signed). */
  bookedMinor: number;
  /** Actual spend reconciled after campaign (updated via actuals subcoll). */
  actualMinor: number;
  /** Supplier this buy was placed with. */
  supplierId?: string;
  /** Linked Purchase Order, if raised. */
  poId?: string;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
