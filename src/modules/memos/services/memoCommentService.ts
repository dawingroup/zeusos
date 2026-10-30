/**
 * Discussion on the memo file — `memos/{id}/comments`. Post only as yourself
 * (the rules check authorId == auth.uid); readable by whoever can read the memo.
 */
import { collection, onSnapshot, orderBy, query, type FirestoreError, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { addDoc } from '@/shared/services/firebase/firestore-writes';
import type { MemoActor, MemoComment } from '../types/memo';
import { MEMOS_COLLECTION, MEMO_COMMENTS_SUBCOLLECTION } from './memoService';

export function subscribeToMemoComments(memoId: string, callback: (comments: MemoComment[]) => void, onError?: (error: FirestoreError) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, MEMOS_COLLECTION, memoId, MEMO_COMMENTS_SUBCOLLECTION), orderBy('createdAt', 'asc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemoComment)),
    (error) => {
      console.error('[memoCommentService] subscribe failed:', error);
      onError?.(error);
    },
  );
}

export async function addMemoComment(memoId: string, body: string, actor: MemoActor): Promise<string> {
  const text = body.trim();
  if (!text) throw new Error('A comment needs some text');
  const ref = await addDoc(collection(db, MEMOS_COLLECTION, memoId, MEMO_COMMENTS_SUBCOLLECTION), {
    authorId: actor.uid,
    authorName: actor.name,
    body: text,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}
