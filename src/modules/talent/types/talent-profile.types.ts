/**
 * TalentProfile — staff or freelancer record in the Talent Roster.
 *
 * Collection: talent_profiles/{profileId}
 *
 * Note on bankDetails: the field is write-restricted to admin-only in
 * Firestore rules. The type includes it as optional for reads that
 * satisfy that restriction.
 */

import type { Timestamp } from 'firebase/firestore';

export type TalentType = 'STAFF' | 'FREELANCER';

export type TalentStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';

export interface TalentProfile {
  id: string;
  name: string;
  email: string;
  type: TalentType;
  /** Sub-brand affiliation, if applicable. */
  subsidiaryOrgId?: string;
  /** Roles this talent can fulfil — e.g. ['director', 'dop', 'voice_artist']. */
  roles: string[];
  /** Daily rate in minor units (e.g. UGX cents). Optional — staff may not have one. */
  dailyRateMinor?: number;
  currency?: string;
  /** Storage reference to a signed NDA document. */
  ndaStorageRef?: string;
  /** Bank details — write-restricted to admin; treated as sensitive. */
  bankDetails?: string;
  status: TalentStatus;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
