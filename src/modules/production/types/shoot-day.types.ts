/**
 * ShootDay — call sheet entry for a production shoot day.
 *
 * Subcollection: production_jobs/{jobId}/shoot_days/{dayId}
 */

import type { Timestamp } from 'firebase/firestore';

export interface ShootDay {
  id: string;
  jobId: string;
  date: string;
  /** Crew call time — ISO time string, e.g. "06:30". */
  callTime: string;
  /** Expected wrap time. */
  wrapTime?: string;
  location: string;
  crewIds: string[];
  talentIds: string[];
  equipmentList: string[];
  notes?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
