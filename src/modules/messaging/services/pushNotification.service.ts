/**
 * Web-push subscription service — Phase 4.4.
 *
 * Registers the browser for Web Push and stores the subscription at
 * push_subscriptions/{uid} for the comms notification fan-out (commsEventConsumer)
 * to deliver to. Ships DARK until VITE_VAPID_PUBLIC_KEY is configured —
 * subscribeToPush() no-ops gracefully when the key is absent.
 *
 * The public/sw.js service worker already handles the 'push' + 'notificationclick'
 * events (renders { title, body, data.url }).
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || '';

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  );
}

export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribe the current device for push + persist it. Returns true on success.
 * No-ops (returns false) when push is unsupported, permission is denied, or the
 * VAPID public key isn't configured (dark-ship).
 */
export async function subscribeToPush(uid: string): Promise<boolean> {
  if (!uid || !isPushSupported() || !VAPID_PUBLIC_KEY) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    const json = sub.toJSON();
    await setDoc(
      doc(db, 'push_subscriptions', uid),
      {
        endpoint: json.endpoint,
        keys: json.keys,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.warn('[push] subscribe failed', err);
    return false;
  }
}
