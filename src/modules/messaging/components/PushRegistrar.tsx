/**
 * PushRegistrar — Phase 4.4.
 *
 * Registers the signed-in user for Web Push so the comms notification spine
 * (commsEventConsumer) can deliver new-message alerts even when the tab is
 * backgrounded. Renders nothing.
 *
 * Non-intrusive permission policy:
 *   - granted → (re)save the subscription so a rotated endpoint stays current.
 *   - denied  → do nothing.
 *   - default → ask at most once per device (localStorage guard).
 *
 * Dark-ships: subscribeToPush no-ops until VITE_VAPID_PUBLIC_KEY is set.
 */

import { useEffect } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPush,
} from '../services/pushNotification.service';

const PROMPT_FLAG = 'zeus_push_prompted_v1';

export function PushRegistrar() {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || !isPushSupported()) return;

    const perm = getPermissionStatus();
    if (perm === 'denied' || perm === 'unsupported') return;

    if (perm === 'granted') {
      void subscribeToPush(uid);
      return;
    }

    // perm === 'default' — request at most once per device.
    if (localStorage.getItem(PROMPT_FLAG)) return;
    localStorage.setItem(PROMPT_FLAG, '1');
    void subscribeToPush(uid);
  }, [uid]);

  return null;
}

export default PushRegistrar;
