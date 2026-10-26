/**
 * Memo status machine — mirror of functions/src/memos/lib/memoModel.js.
 *
 *   draft      → submitted | issued (nothing to clear, nobody to decide) | withdrawn
 *   submitted  → approved | rejected | modified | withdrawn   (rejected also = sent back)
 *   rejected   → draft (version++ on the next submit)
 *   approved   → issued
 *   modified   → issued
 *   issued     → superseded | withdrawn (admin)
 *   superseded, withdrawn: terminal
 *
 * Content freezes the moment a memo leaves draft. A `modified` decision
 * issues the ORIGINAL text plus a decision block carrying the conditions
 * verbatim; the author never edits the approved wording.
 */

import type { MemoStatus } from '../types/memo';

export const MEMO_STATUS_TRANSITIONS: Record<MemoStatus, readonly MemoStatus[]> = {
  draft: ['submitted', 'issued', 'withdrawn'],
  submitted: ['approved', 'rejected', 'modified', 'withdrawn'],
  rejected: ['draft'],
  approved: ['issued'],
  modified: ['issued'],
  issued: ['superseded', 'withdrawn'],
  superseded: [],
  withdrawn: [],
};

export function canTransition(from: MemoStatus, to: MemoStatus): boolean {
  return MEMO_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isEditableStatus(status: MemoStatus): boolean {
  return status === 'draft';
}

export function isTerminalStatus(status: MemoStatus): boolean {
  return status === 'superseded' || status === 'withdrawn';
}

export function isDecided(status: MemoStatus): boolean {
  return status === 'approved' || status === 'rejected' || status === 'modified';
}
