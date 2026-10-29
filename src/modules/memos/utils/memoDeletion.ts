/**
 * Who may delete a memo. Only a DRAFT is ever deletable — anything submitted
 * is withdrawn, never deleted, so the file keeps its trail.
 *
 *   admin   any draft, including one returned after a rejection
 *   author  their own draft that was NEVER submitted — no number, version 0
 *
 * Mirrors the `allow delete` gate on `memos/{memoId}` in firestore.rules.
 */
import type { Memo } from '../types/memo';

export function isUnsubmittedDraft(memo: Pick<Memo, 'status' | 'memoNumber' | 'version'>): boolean {
  return memo.status === 'draft' && !memo.memoNumber && (memo.version ?? 0) === 0;
}

export interface MemoDeletionVerdict { allowed: boolean; reason?: string }

export function memoDraftDeletion(
  memo: Pick<Memo, 'status' | 'createdBy' | 'memoNumber' | 'version'>,
  actorUid: string | null | undefined,
  isAdmin: boolean,
): MemoDeletionVerdict {
  if (memo.status !== 'draft') return { allowed: false, reason: 'Only a draft can be deleted. Withdraw a submitted or issued memo instead.' };
  if (isAdmin) return { allowed: true };
  if (!actorUid || memo.createdBy !== actorUid) return { allowed: false, reason: 'Only the author or an admin can delete a draft.' };
  if (memo.memoNumber || (memo.version ?? 0) > 0) {
    return { allowed: false, reason: 'This draft has been submitted before and carries a number. Withdraw it, or ask an admin to delete it.' };
  }
  return { allowed: true };
}
