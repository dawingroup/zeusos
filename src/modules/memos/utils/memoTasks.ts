/**
 * Task keys shared with the callable (functions/src/memos/lib/memoTasks.js).
 * A memo step's task has the DETERMINISTIC id `memoTaskId(key)` in
 * `generated_tasks`, which is how the callable completes the right task when
 * the memo moves on. __tests__/memoLockstep.test.ts pins the spelling.
 *
 *   memo_clear:{memoId}:{uid}     someone under Through must clear it
 *   memo_approval:{memoId}:{uid}  someone it is addressed To must decide it
 *   memo_returned:{memoId}:{v}    the author: version v was sent back
 *   memo_ack:{memoId}:{uid}       an issued memo reached them
 */

export function memoClearanceDedupeKey(memoId: string, uid: string): string {
  return `memo_clear:${memoId}:${uid}`;
}
export function memoApprovalDedupeKey(memoId: string, uid: string): string {
  return `memo_approval:${memoId}:${uid}`;
}
export function memoReturnedDedupeKey(memoId: string, version: number): string {
  return `memo_returned:${memoId}:${version}`;
}
export function memoAckDedupeKey(memoId: string, uid: string): string {
  return `memo_ack:${memoId}:${uid}`;
}
/** Deterministic, URL-safe task id for a memo step. */
export function memoTaskId(dedupeKey: string): string {
  return `memo__${dedupeKey.replace(/:/g, '__')}`;
}
