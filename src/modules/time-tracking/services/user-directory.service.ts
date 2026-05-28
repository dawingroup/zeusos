/**
 * User-directory resolution — Phase 5.D depth.
 *
 * Time entries store `userId` (the Firebase Auth UID). The team view
 * groups by that uid, but a raw uid is meaningless to a manager. This
 * resolver maps a set of uids → display names via the root-level
 * `users/{uid}` profile docs (the same collection `GlobalContext`'s
 * `fetchUserProfile` reads first). Authenticated reads are allowed by
 * `firestore.rules` (`match /users/{userId} { allow read: if
 * isAuthenticated() }`), so any signed-in manager can resolve their
 * team's names.
 *
 * Strategy: one `getDoc` per distinct uid, run in parallel. A weekly
 * team view has a handful of distinct people, so this is cheap and
 * avoids the 30-value `in`-query limit + a nested-field index that a
 * batched query against `employees.systemAccess.userId` would need.
 *
 * Resilience: a missing profile (e.g. the dev-bypass user, or an uid
 * with no `users` doc) resolves to the raw uid, so the UI degrades to
 * showing the id rather than blank. Field precedence handles the
 * variety of profile shapes seen across the legacy data:
 *   displayName → name → fullName → email → uid.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

export type UserNameMap = Record<string, string>;

function pickName(data: Record<string, unknown> | undefined, uid: string): string {
  if (!data) return uid;
  // First non-blank candidate wins. A blank/whitespace field is skipped
  // (not short-circuited on), so e.g. a blank displayName falls through
  // to `name` rather than to the uid.
  const candidates = [data.displayName, data.name, data.fullName, data.email];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return uid;
}

/**
 * Resolve a set of uids → display names. Always returns an entry for
 * every input uid (falling back to the uid itself when no profile or
 * name is found). De-duplicates input.
 */
export async function resolveUserNames(uids: readonly string[]): Promise<UserNameMap> {
  const distinct = Array.from(new Set(uids.filter(Boolean)));
  const out: UserNameMap = {};
  await Promise.all(
    distinct.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        out[uid] = pickName(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined, uid);
      } catch {
        // Permission or network blip — degrade to the uid.
        out[uid] = uid;
      }
    }),
  );
  return out;
}

// Exported for unit testing of the field-precedence logic.
export const __testing = { pickName };
