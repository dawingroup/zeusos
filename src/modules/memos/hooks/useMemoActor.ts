/**
 * The signed-in person as a MemoActor, plus the two facts the UI gates on.
 * Identity comes from Firebase Auth; the ZeusOS profile supplies the name and
 * the role when it has them. `loading` is AUTH loading only — a missing
 * profile must never hold the memo pages on "Signing in…".
 */
import { useMemo } from 'react';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import type { MemoActor } from '../types/memo';
import { resolveMemoActor } from '../utils/memoActor';

export function useMemoActor(): { actor: MemoActor | null; isAdmin: boolean; loading: boolean } {
  const { user, loading } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  return useMemo(() => {
    const resolved = resolveMemoActor(
      user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null,
      dawinUser ? { displayName: dawinUser.displayName, email: dawinUser.email, globalRole: dawinUser.globalRole } : null,
    );
    return { ...resolved, loading: Boolean(loading) };
  }, [user, dawinUser, loading]);
}
