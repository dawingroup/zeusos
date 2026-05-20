/**
 * Service Worker Registration
 * Register and manage the PWA service worker
 */

type ServiceWorkerConfig = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
};

const SW_RELOAD_TS_KEY = 'sw-reloaded-at';
const SW_RELOAD_COOLDOWN_MS = 15000;

function shouldAutoReloadNow(): boolean {
  const raw = sessionStorage.getItem(SW_RELOAD_TS_KEY);
  const prev = raw ? Number(raw) : 0;
  const now = Date.now();
  if (!Number.isFinite(prev) || now - prev > SW_RELOAD_COOLDOWN_MS) {
    sessionStorage.setItem(SW_RELOAD_TS_KEY, String(now));
    return true;
  }
  return false;
}

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

/**
 * Register the service worker
 */
export function register(config?: ServiceWorkerConfig): void {
  if ('serviceWorker' in navigator) {
    const publicUrl = new URL(import.meta.env.BASE_URL || '/', window.location.href);

    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = '/sw.js';

      if (isLocalhost) {
        // Running on localhost - check if service worker exists
        checkValidServiceWorker(swUrl, config);

        navigator.serviceWorker.ready.then(() => {
          if (import.meta.env.DEV) {
            console.debug('[SW] App served cache-first by a service worker (localhost).');
          }
        });
      } else {
        // Not localhost - register service worker
        registerValidSW(swUrl, config);
      }
    });

    // Auto-reload when SW detects stale hashed assets after a deploy
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'STALE_ASSETS') {
        if (shouldAutoReloadNow()) {
          window.location.reload();
        }
      }
    });

    // Listen for online/offline events
    if (config?.onOffline) {
      window.addEventListener('offline', config.onOffline);
    }
    if (config?.onOnline) {
      window.addEventListener('online', config.onOnline);
    }
  }
}

/**
 * Register a valid service worker
 */
function registerValidSW(swUrl: string, config?: ServiceWorkerConfig): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      if (import.meta.env.DEV) {
        console.debug('[SW] Service worker registered');
      }

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content available — auto-apply. Previous behaviour
              // was to log and hope the user hard-refreshed; in practice
              // the old bundle stuck around for days on cache-first
              // `/assets/*` paths and the new buttons (AI reconcile,
              // Wipe & sync, etc.) never showed up. Now we immediately
              // tell the waiting SW to take over + reload the page.
              if (import.meta.env.DEV) {
                console.debug('[SW] New content available — auto-reloading…');
              }
              config?.onUpdate?.(registration);
              if (shouldAutoReloadNow()) {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
                // controllerchange fires once the new SW takes over;
                // reload then so the fresh bundle streams on next load.
                navigator.serviceWorker.addEventListener(
                  'controllerchange',
                  () => window.location.reload(),
                  { once: true },
                );
              }
            } else {
              // Content cached for offline use
              if (import.meta.env.DEV) {
                console.debug('[SW] Content cached for offline use.');
              }
              config?.onSuccess?.(registration);
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('[SW] Error during service worker registration:', error);
    });
}

/**
 * Check if a service worker exists and is valid
 */
function checkValidServiceWorker(swUrl: string, config?: ServiceWorkerConfig): void {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found - reload page
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found - register it
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      if (import.meta.env.DEV) {
        console.debug('[SW] No internet connection — offline mode.');
      }
      config?.onOffline?.();
    });
}

/**
 * Unregister the service worker
 */
export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        if (import.meta.env.DEV) {
          console.debug('[SW] Service worker unregistered');
        }
      })
      .catch((error) => {
        console.error('[SW] Error unregistering service worker:', error);
      });
  }
}

/**
 * Request a service worker update
 */
export async function checkForUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    if (import.meta.env.DEV) {
      console.debug('[SW] Checked for updates');
    }
  }
}

/**
 * Skip waiting and activate new service worker immediately
 */
export function skipWaiting(): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Send message to service worker
 */
export function sendMessage(message: unknown): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

/**
 * Listen for messages from service worker
 */
export function onMessage(callback: (event: MessageEvent) => void): () => void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', callback);
    return () => navigator.serviceWorker.removeEventListener('message', callback);
  }
  return () => {};
}

/**
 * Request background sync
 */
export async function requestBackgroundSync(tag: string): Promise<boolean> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
      if (import.meta.env.DEV) {
        console.debug('[SW] Background sync registered:', tag);
      }
      return true;
    } catch (error) {
      console.error('[SW] Background sync failed:', error);
      return false;
    }
  }
  return false;
}

export const serviceWorkerRegistration = {
  register,
  unregister,
  checkForUpdate,
  skipWaiting,
  sendMessage,
  onMessage,
  requestBackgroundSync,
};

export default serviceWorkerRegistration;
