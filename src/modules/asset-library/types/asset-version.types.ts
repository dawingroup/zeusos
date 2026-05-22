/**
 * AssetVersion — a single uploaded revision of an AssetItem.
 *
 * Collection: asset_library_items/{itemId}/versions/{versionId}
 *
 * Versions are append-only; rolling back doesn't delete the row, it
 * just updates the parent item's `currentVersionId` pointer. That way
 * "in use" references in old campaigns remain valid.
 */

import type { Timestamp } from 'firebase/firestore';

export interface AssetVersion {
  id: string;
  /** Human-friendly label, e.g. "v3", "Q3 2026 refresh", "approved cut". */
  versionLabel: string;
  /** Cloud Storage path for this specific revision. */
  storageRef: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: Timestamp | string;
  /** Optional change notes describing what's different in this version. */
  changeNotes?: string;
}
