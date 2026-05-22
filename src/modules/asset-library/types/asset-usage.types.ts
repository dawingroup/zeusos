/**
 * AssetUsage — a back-reference to where an AssetItem has been placed.
 *
 * Collection: asset_library_items/{itemId}/usages/{usageId}
 *
 * Subjects are denormalised by `subjectType`/`subjectId` so we don't
 * have to add per-subject indexes. Phase 5 will replace this with
 * Firestore queries against subject-level fields once usage volume
 * grows, but for now the subcollection keeps reads cheap.
 */

import type { Timestamp } from 'firebase/firestore';

export type AssetUsageSubjectType =
  | 'CAMPAIGN'
  | 'MASTER_JOB'
  | 'PRODUCTION_JOB'
  | 'MEDIA_BUY';

export interface AssetUsage {
  id: string;
  subjectType: AssetUsageSubjectType;
  subjectId: string;
  addedBy: string;
  addedAt: Timestamp | string;
  /** Optional context — "used as hero shot", "footer logo", etc. */
  notes?: string;
}
