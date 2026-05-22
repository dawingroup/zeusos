/**
 * ChecklistItem — pre-production checklist entry.
 *
 * Subcollection: production_jobs/{jobId}/checklist_items/{itemId}
 */

import type { Timestamp } from 'firebase/firestore';

export interface ChecklistItem {
  id: string;
  jobId: string;
  label: string;
  dueDate?: string;
  completedAt?: Timestamp | string;
  completedBy?: string;
}
