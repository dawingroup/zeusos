/**
 * Staff directory — Phase 4.1.
 *
 * Lists ZeusOS staff (users/{uid} profile docs) as ChatMembers for the
 * channel/DM member picker. Read-only; the `users` collection is staff-readable
 * per firestore.rules.
 */

import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { ChatMember } from '../types/internalChat';

function pickName(d: Record<string, unknown>, uid: string): string {
  return (
    (d.displayName as string) ||
    (d.name as string) ||
    (d.fullName as string) ||
    (d.email as string) ||
    uid
  );
}

/** Subscribe to the full staff roster as ChatMembers (rosters are small). */
export function subscribeStaff(
  cb: (members: ChatMember[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const members = snap.docs
        .map((doc) => {
          const d = doc.data() || {};
          return {
            uid: doc.id,
            name: pickName(d, doc.id),
            photoUrl: (d.photoURL as string) || (d.photoUrl as string) || null,
          } as ChatMember;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      cb(members);
    },
    (err) => {
      console.error('[staff-directory] subscription error', err);
      onError?.(err);
    },
  );
}
