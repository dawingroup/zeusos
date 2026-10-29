import { useMemo } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { actorRef, type ActorRef } from '@/shared/types/actor';

/** The signed-in staff user as an ActorRef, or null when signed out. */
export function useActorRef(): ActorRef | null {
  const { user } = useAuth();
  return useMemo(() => (user ? actorRef(user) : null), [user]);
}
