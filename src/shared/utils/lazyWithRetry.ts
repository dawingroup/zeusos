import { lazy, type ComponentType } from 'react';

/**
 * Wrapper around React.lazy that handles stale chunk errors after deployment.
 * When a dynamic import fails (e.g. old hashed filename no longer exists),
 * it reloads the page once to pick up the new asset manifest.
 */
const RELOAD_KEY = 'lazy_chunk_reload';

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(() =>
    importFn()
      .then((module) => {
        // Import succeeded — clear any stale reload flag
        sessionStorage.removeItem(RELOAD_KEY);
        return module;
      })
      .catch((error: Error) => {
        const isChunkError =
          error.message.includes('Failed to fetch dynamically imported module') ||
          error.message.includes('Loading chunk') ||
          error.message.includes('Loading CSS chunk') ||
          error.message.includes('Unexpected token') ||
          error.name === 'SyntaxError';

        // Only auto-reload once to avoid infinite loops
        if (isChunkError && !sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          window.location.reload();
          // Return a no-op component (never actually rendered)
          return { default: (() => null) as unknown as T };
        }

        // Already retried once and still failing — clear flag and surface the error
        sessionStorage.removeItem(RELOAD_KEY);
        throw error;
      })
  );
}
