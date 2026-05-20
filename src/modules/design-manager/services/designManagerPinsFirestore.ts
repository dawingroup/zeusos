/**
 * Cross-device sync for Design Manager "Working on" pins on the org user document.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { MAX_PINNED_PROJECTS } from './designManagerPins';

const FIELD = 'designManagerPinnedProjectIds';

function normalizeIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0))];
  return ids.slice(0, MAX_PINNED_PROJECTS);
}

/**
 * @returns `null` if the field is absent or the doc is missing (keep local cache),
 *          otherwise the stored order (possibly empty).
 */
export async function fetchPinnedProjectIdsFromUserDoc(
  orgId: string,
  uid: string,
): Promise<string[] | null> {
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId, 'users', uid));
    if (!snap.exists()) return null;
    const ids = normalizeIds(snap.data()[FIELD]);
    if (ids === null) return null;
    return ids;
  } catch {
    return null;
  }
}

export async function persistPinnedProjectIdsToUserDoc(
  orgId: string,
  uid: string,
  ids: string[],
): Promise<void> {
  const unique = [...new Set(ids)].slice(0, MAX_PINNED_PROJECTS);
  await setDoc(
    doc(db, 'organizations', orgId, 'users', uid),
    {
      [FIELD]: unique,
      designManagerPinsUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
