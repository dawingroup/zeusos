/**
 * Firebase Analytics (GA4) — Phase 5.F.
 *
 * Initializes Firebase Analytics on app boot when:
 *   1. A measurement ID is configured (`VITE_FIREBASE_MEASUREMENT_ID`).
 *   2. The environment opts in (`VITE_ANALYTICS_ENABLED=true`).
 *   3. The browser supports it (some embedded browsers / privacy modes don't).
 *
 * No-ops everywhere else — including the local dev server unless the
 * developer explicitly sets the env vars in `.env.local`. This keeps the
 * `analyticsId` value out of dev consoles by default.
 *
 * Public API:
 *   • `initAnalytics()`              — call once at app boot.
 *   • `logEvent(name, params)`       — wrapper that no-ops if analytics
 *                                       didn't initialize.
 *   • `setAnalyticsUserId(uid)`      — link an authenticated user to
 *                                       subsequent events.
 *   • `setAnalyticsUserProperty(...)` — tag a session with role / org /
 *                                       subsidiary so dashboards can slice.
 *
 * Why not just use the Firebase Console toggle?
 * The Firebase SDK still has to be loaded + initialized client-side for
 * GA4 to receive events. Toggling the project property in Console without
 * this wiring would only enable backend analytics (storage usage, etc.) —
 * not page views or custom events.
 *
 * See [docs/CUSTOM_DOMAIN_SETUP.md](../../../../docs/CUSTOM_DOMAIN_SETUP.md)
 * for the Phase 5.F deployment checklist (Measurement ID is paired with
 * the custom-domain rollout).
 */

import {
  getAnalytics,
  isSupported,
  logEvent as firebaseLogEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from 'firebase/analytics';
import { app } from './config';

let analyticsInstance: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;

const ANALYTICS_ENABLED =
  import.meta.env.VITE_ANALYTICS_ENABLED === 'true' ||
  import.meta.env.VITE_ANALYTICS_ENABLED === true;

const MEASUREMENT_ID = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as
  | string
  | undefined;

/**
 * Initialize Firebase Analytics. Idempotent — safe to call multiple times.
 *
 * Returns the Analytics instance or `null` if analytics is disabled / the
 * browser doesn't support it. Caller code should not depend on the return
 * value being non-null; use `logEvent` etc. which already guard.
 */
export async function initAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  if (initPromise) return initPromise;

  // Hard requirements: env opt-in + measurement ID configured.
  if (!ANALYTICS_ENABLED) return null;
  if (!MEASUREMENT_ID || MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    // Placeholder from `.env.example` — treat as not configured.
    if (import.meta.env.DEV) {
      console.info(
        '[analytics] disabled — VITE_FIREBASE_MEASUREMENT_ID not set',
      );
    }
    return null;
  }

  initPromise = (async () => {
    try {
      const supported = await isSupported();
      if (!supported) {
        if (import.meta.env.DEV) {
          console.info('[analytics] browser does not support analytics');
        }
        return null;
      }
      analyticsInstance = getAnalytics(app);
      if (import.meta.env.DEV) {
        console.info(`[analytics] initialized (${MEASUREMENT_ID})`);
      }
      return analyticsInstance;
    } catch (err) {
      console.warn('[analytics] init failed:', err);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Log a custom event. Safe to call before/after init — events fired
 * pre-init are dropped, not queued. (Most page-view tracking should be
 * deferred until after `initAnalytics()` resolves.)
 */
export function logAnalyticsEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, name, params as Record<string, never>);
  } catch (err) {
    console.warn(`[analytics] logEvent(${name}) failed:`, err);
  }
}

/**
 * Associate the current session with an authenticated user. Call this
 * from the auth observer once a user signs in.
 *
 * Pass `null` to clear (on sign-out).
 */
export function setAnalyticsUserId(uid: string | null): void {
  if (!analyticsInstance) return;
  try {
    setUserId(analyticsInstance, uid ?? '');
  } catch (err) {
    console.warn('[analytics] setUserId failed:', err);
  }
}

/**
 * Tag the session with user properties (org kind, subsidiary, etc.) so
 * the GA4 dashboards can slice by tenant context.
 *
 * Keep property names ≤24 chars and values ≤36 chars — GA4 enforces
 * this server-side.
 */
export function setAnalyticsUserProperty(
  properties: Record<string, string | null>,
): void {
  if (!analyticsInstance) return;
  try {
    setUserProperties(analyticsInstance, properties);
  } catch (err) {
    console.warn('[analytics] setUserProperties failed:', err);
  }
}
