/**
 * Pure derivation of a design item's revision summary from its
 * `projectFiles` list. Phase 3b (F-D1) — the DesignItem doc itself
 * doesn't carry a `currentRevision` field; the canonical answer is
 * simply "the max version across all latest files for the item."
 *
 * Kept as a pure function (no Firestore I/O) so it can be reused from
 * the UI with its live subscription, and from the future RevisionTimeline
 * wiring, without re-querying.
 */

import type { ManagedFile } from './types';

export interface ItemRevisionSummary {
  /**
   * Max `version` across all included files. `0` when the input is
   * empty (callers render "no files yet" rather than v0).
   */
  currentRevision: number;
  /** How many files contribute to the summary. */
  fileCount: number;
  /**
   * The most-recent `uploadedAt` Timestamp across the set, as millis.
   * `null` when the input is empty or no file has a server timestamp.
   */
  lastRevisedAtMs: number | null;
  /** True when at least one file is marked `status='approved'`. */
  hasApprovedFiles: boolean;
  /** True when at least one file is a handoff-bundle. */
  hasHandoffBundle: boolean;
}

/**
 * Summarise the revision state of a set of `ManagedFile`s. Callers
 * usually pre-filter to `isLatest=true` + `itemId=X`, but the helper
 * is robust to arbitrary input.
 */
export function summariseRevisions(files: ManagedFile[]): ItemRevisionSummary {
  if (!files || files.length === 0) {
    return {
      currentRevision: 0,
      fileCount: 0,
      lastRevisedAtMs: null,
      hasApprovedFiles: false,
      hasHandoffBundle: false,
    };
  }

  let maxVersion = 0;
  let latestMs: number | null = null;
  let hasApproved = false;
  let hasBundle = false;

  for (const f of files) {
    if (typeof f.version === 'number' && f.version > maxVersion) {
      maxVersion = f.version;
    }
    const ms = f.uploadedAt?.toMillis ? f.uploadedAt.toMillis() : null;
    if (ms !== null && (latestMs === null || ms > latestMs)) {
      latestMs = ms;
    }
    if (f.status === 'approved') hasApproved = true;
    if (f.deliverableType === 'handoff-bundle') hasBundle = true;
  }

  return {
    currentRevision: maxVersion,
    fileCount: files.length,
    lastRevisedAtMs: latestMs,
    hasApprovedFiles: hasApproved,
    hasHandoffBundle: hasBundle,
  };
}

/**
 * Human-readable relative time — "Today", "Yesterday", "5d ago",
 * else ISO-ish date. Matches the style used in UnifiedFileManager's
 * row-date column so both views read consistently.
 */
export function formatRelativeDate(ms: number | null | undefined): string {
  if (!ms) return '';
  const diffMs = Date.now() - ms;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(ms).toLocaleDateString();
}
