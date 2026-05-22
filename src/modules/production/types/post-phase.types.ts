/**
 * PostPhase — a discrete phase in post-production.
 *
 * Subcollection: production_jobs/{jobId}/post_phases/{phaseId}
 */

import type { Timestamp } from 'firebase/firestore';

export type PostPhaseKind =
  | 'EDIT'
  | 'COLOUR_GRADE'
  | 'SOUND_MIX'
  | 'CLIENT_PREVIEW'
  | 'FINAL_MASTER';

export type PostPhaseStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export interface PostPhase {
  id: string;
  jobId: string;
  phase: PostPhaseKind;
  status: PostPhaseStatus;
  assigneeId?: string;
  dueDate?: string;
  notes?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
