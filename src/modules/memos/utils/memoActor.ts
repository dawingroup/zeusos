/**
 * Who is acting on a memo — resolved from the Firebase AUTH user, never from
 * the directory profile's own id. The rules compare `createdBy` and a
 * comment's `authorId` against `request.auth.uid`, and the callable signs
 * with `auth.uid`, so the auth uid is the only identity a memo can carry.
 * The profile supplies a nicer name and the role when it has them; it is
 * never required. Pure so the resolution is testable without React.
 */
import type { MemoActor } from '../types/memo';

export interface AuthIdentity { uid: string; displayName?: string | null; email?: string | null }
export interface ProfileIdentity { displayName?: string | null; email?: string | null; globalRole?: string | null }

const PRIVILEGED = new Set(['admin', 'owner']);

export function resolveMemoActor(auth: AuthIdentity | null | undefined, profile?: ProfileIdentity | null): { actor: MemoActor | null; isAdmin: boolean } {
  if (!auth?.uid) return { actor: null, isAdmin: false };
  const name = profile?.displayName?.trim() || auth.displayName?.trim() || auth.email?.trim() || profile?.email?.trim() || 'Unknown user';
  const email = auth.email || profile?.email || undefined;
  const actor: MemoActor = { uid: auth.uid, name };
  if (email) actor.email = email;
  return { actor, isAdmin: PRIVILEGED.has(profile?.globalRole ?? '') };
}
