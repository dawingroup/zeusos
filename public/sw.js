/**
 * Service Worker for DawinOS MatFlow PWA
 * Handles offline caching, background sync, and push notifications
 */

// Bumped to v9 on 2026-04-18 to purge stale scene-workspace chunks whose
// cached copies were serving an older `useCabinetParsedModel` + old
// `useMaterialSwap` (pre material-overrides hydration), causing React
// error #310 "Rendered more hooks than during the previous render" on
// cabinet selection. The `activate` handler below deletes any cache whose
// name doesn't match these constants, so bumping forces a clean slate.
//
// Bumped to v80 on 2026-05-19 — two converging reasons:
//   1. Purge stale chunks for returning users after shipping the public
//      /privacy + /privacy/data-deletion routes. Old caches were serving
//      pre-privacy-route shared chunks alongside the new index.html,
//      recreating the same React error #310 failure mode documented in
//      the v9 bump.
//   2. Purge the pre-portal-v2 shell — the stale-while-revalidate path
//      was serving the old `index.html` + JS chunks on the portal-test
//      preview channel even after hard refresh.
//
// Bumped to v81 on 2026-05-20 — production hotfix. The portal-v2 shell
// from v80 crashed FinishesDashboardPage with `TypeError: h.toDate is
// not a function` whenever a project's date field was present but not a
// Firestore Timestamp. v81 ships the fix (utils/dates.ts `tsToDate`)
// alongside this cache bump so returning users dump the broken bundle.
const CACHE_NAME = 'matflow-v81';
const STATIC_CACHE = 'matflow-static-v81';
const DYNAMIC_CACHE = 'matflow-dynamic-v81';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/offline.html',
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  '/api/',
  'firestore.googleapis.com',
];

// ============================================================================
// INSTALL EVENT
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================================================
// ACTIVATE EVENT
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============================================================================
// FETCH EVENT - Caching Strategy
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - Network first, fall back to cache
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed build assets (/assets/*) — cache first (immutable, content-hashed)
  // Other static assets — stale-while-revalidate so updates aren't blocked
  if (isStaticAsset(url)) {
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request));
    } else {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  // Navigation requests - Network first with offline fallback.
  //
  // The fallback chain MUST always resolve to a real Response — if it resolves
  // to `undefined` the browser throws
  //   "TypeError: Failed to convert value to 'Response'"
  // and every subsequent navigation under this SW fails the same way until
  // the user hard-reloads. That's exactly the failure mode we hit with v7.
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request).catch(async () => {
        const offline = await caches.match('/offline.html');
        if (offline) return offline;
        return new Response(
          '<!doctype html><title>Offline</title><h1>Offline</h1>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        );
      }),
    );
    return;
  }

  // Skip cross-origin non-API requests to avoid opaque response caching issues
  if (url.origin !== self.location.origin) {
    return;
  }

  // Default - Stale while revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // ── Stale-chunk detection ────────────────────────────────────────
    // After a deploy, an old index.html in the user's cache references
    // hashed chunks (/assets/SceneWorkspacePage-<hash>.js) that no
    // longer exist. Firebase Hosting returns the CURRENT index.html
    // as the SPA fallback — a 200 with Content-Type: text/html — so
    // the plain `!response.ok` guard silently passes HTML back to the
    // browser, which then throws the MIME error
    //   "Failed to load module script: Expected a JavaScript-or-Wasm
    //    module script but the server responded with a MIME type of
    //    text/html"
    // and the page wedges without ever reloading.
    //
    // Detect both failure modes and signal clients to reload:
    //   (a) response.ok === false (true 404)
    //   (b) HTML body returned to a non-HTML /assets/* request
    if (request.url.includes('/assets/')) {
      const contentType = response.headers.get('content-type') ?? '';
      const looksLikeSpaFallback =
        response.ok
        && contentType.includes('text/html')
        && !/\.html?$/i.test(request.url);
      if (!response.ok || looksLikeSpaFallback) {
        self.clients.matchAll().then(clients => {
          clients.forEach(c => c.postMessage({ type: 'STALE_ASSETS' }));
        });
        // Return a real failure so the browser doesn't try to execute
        // HTML as JS. The reload triggered by the postMessage picks up
        // the new index.html + fresh chunk names on the next pass.
        return new Response('', { status: 503, statusText: 'Stale asset' });
      }
    }

    if (response.ok && isCacheable(response)) {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.put(request, response.clone());
      } catch (e) {
        // Silently ignore cache storage errors (quota, opaque, etc.)
      }
    }
    return response;
  } catch (error) {
    // Network failure on hashed asset — notify clients to reload
    if (request.url.includes('/assets/')) {
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'STALE_ASSETS' }));
      });
    }
    console.warn('[SW] Cache first failed for:', request.url);
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const cache = await caches.open(DYNAMIC_CACHE);
      try {
        await cache.put(request, response.clone());
      } catch (e) {
        // Silently ignore cache storage errors
      }
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    // If the network fails AND we have no cached copy, we must still resolve
    // to a real Response object. Returning undefined here propagates to
    // event.respondWith() which throws
    //   "TypeError: Failed to convert value to 'Response'"
    // and wedges every subsequent fetch the SW handles.
    .catch(() => cached || new Response('', { status: 503, statusText: 'Service Unavailable' }));

  return cached || fetchPromise;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isApiRequest(url) {
  return API_ROUTES.some((route) => url.href.includes(route));
}

function isStaticAsset(url) {
  // Only cache same-origin static assets
  if (url.origin !== self.location.origin) return false;
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2'];
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

/**
 * Check if a response is safe to cache.
 * Opaque responses (cross-origin without CORS) and error responses cannot be cached reliably.
 */
function isCacheable(response) {
  return response && response.status === 200 && response.type !== 'opaque';
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'MatFlow Update',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'matflow-notification',
    data: {},
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============================================================================
// NOTIFICATION CLICK
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let targetUrl = '/';
  
  // Handle different notification types
  switch (data.type) {
    case 'delivery':
      targetUrl = `/advisory/matflow/projects/${data.projectId}/deliveries/${data.deliveryId}`;
      break;
    case 'procurement':
      targetUrl = `/advisory/matflow/projects/${data.projectId}/procurement`;
      break;
    case 'sync':
      targetUrl = `/advisory/matflow/projects/${data.projectId}`;
      break;
    default:
      targetUrl = data.url || '/';
  }
  
  // Handle action buttons
  if (event.action) {
    switch (event.action) {
      case 'view':
        // Default behavior - open the URL
        break;
      case 'dismiss':
        return; // Just close the notification
      case 'approve':
        // Handle approval action
        targetUrl = `${targetUrl}?action=approve`;
        break;
    }
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window if not
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'matflow-sync') {
    event.waitUntil(syncOfflineData());
  }
  
  if (event.tag === 'matflow-delivery-sync') {
    event.waitUntil(syncDeliveries());
  }
});

async function syncOfflineData() {
  console.log('[SW] Syncing offline data...');
  
  // Notify clients to trigger sync
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_REQUIRED',
      payload: { timestamp: Date.now() },
    });
  });
}

async function syncDeliveries() {
  console.log('[SW] Syncing deliveries...');
  
  // Notify clients to sync deliveries
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'DELIVERY_SYNC_REQUIRED',
      payload: { timestamp: Date.now() },
    });
  });
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => 
        Promise.all(names.map((name) => caches.delete(name)))
      )
    );
  }
});

console.log('[SW] Service worker loaded');
