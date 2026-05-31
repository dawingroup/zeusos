/**
 * presenceService — lightweight Firestore presence for staff chat.
 *
 * RTDB isn't configured in this project, so presence is a heartbeat doc:
 *   presence/{uid} = { uid, name, state: 'online'|'away', lastActiveAt }
 *
 * The client writes a heartbeat every ~45s while the tab is visible, flips
 * to 'away' when the tab is hidden, and a best-effort 'away' on unload.
 * Readers derive online/away/offline from `lastActiveAt` age (see
 * presenceStateFrom in types/internalChat).
 */

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { PresenceDoc } from '../types/internalChat';

const presenceRef = collection(db, 'presence');

const HEARTBEAT_MS = 45_000;

async function writeHeartbeat(uid: string, name: string, state: 'online' | 'away') {
  try {
    await setDoc(
      doc(db, 'presence', uid),
      { uid, name, state, lastActiveAt: serverTimestamp() },
      { merge: true },
    );
  } catch {
    // presence is best-effort — never throw into the UI
  }
}

/**
 * Start broadcasting the current user's presence. Returns a cleanup fn that
 * stops the heartbeat and marks the user away.
 */
export function startPresenceHeartbeat(uid: string, name: string): () => void {
  if (!uid) return () => {};

  let timer: ReturnType<typeof setInterval> | null = null;

  const beat = () => {
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    void writeHeartbeat(uid, name, visible ? 'online' : 'away');
  };

  // Immediate beat + interval.
  beat();
  timer = setInterval(beat, HEARTBEAT_MS);

  const onVisibility = () => beat();
  const onBeforeUnload = () => {
    // Best-effort away marker; may not always flush, but the age-based
    // reader will mark them offline within the threshold regardless.
    void writeHeartbeat(uid, name, 'away');
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  return () => {
    if (timer) clearInterval(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
    void writeHeartbeat(uid, name, 'away');
  };
}

/**
 * Subscribe to the whole presence collection (staff rosters are small).
 * Returns a map keyed by uid. Callers derive state with presenceStateFrom.
 */
export function subscribeToPresence(
  callback: (byUid: Record<string, PresenceDoc>) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    presenceRef,
    (snap) => {
      const map: Record<string, PresenceDoc> = {};
      snap.docs.forEach((d) => {
        map[d.id] = { uid: d.id, ...(d.data() as Omit<PresenceDoc, 'uid'>) };
      });
      callback(map);
    },
    (err) => {
      console.error('[presence] subscription error', err);
      onError?.(err);
    },
  );
}
