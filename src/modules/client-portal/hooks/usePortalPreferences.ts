/**
 * usePortalPreferences — persisted UI prefs for the client portal.
 *
 * Storage:
 *   `dawinos.portal.prefs` in localStorage. Single JSON object with
 *   versioned schema so we can extend (sparkline on/off, accent
 *   override, etc.) without ad-hoc keys.
 *
 * Apply path:
 *   The hook syncs the preference to every `.portal-root` in the DOM
 *   by setting `data-density` (CSS picks it up via attribute
 *   selectors in `portal.css`). Re-applies on mount + on every
 *   subsequent update.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type PortalDensity = 'dense' | 'balanced' | 'airy';

export interface PortalPreferences {
  density: PortalDensity;
}

const STORAGE_KEY = 'dawinos.portal.prefs';
const DEFAULTS: PortalPreferences = { density: 'balanced' };

function read(): PortalPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<PortalPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function write(prefs: PortalPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* localStorage might be blocked in private mode — silently skip. */
  }
  // Broadcast so other tabs / hooks update.
  window.dispatchEvent(new CustomEvent('dawinos-portal-prefs'));
}

function subscribe(cb: () => void): () => void {
  // Two listeners: cross-tab storage events + same-tab custom event
  // fired by `write()` so all consumers re-render together.
  window.addEventListener('storage', cb);
  window.addEventListener('dawinos-portal-prefs', cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener('dawinos-portal-prefs', cb);
  };
}

function getServerSnapshot(): PortalPreferences {
  return DEFAULTS;
}

export function usePortalPreferences() {
  const prefs = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const setDensity = useCallback((density: PortalDensity) => {
    write({ ...read(), density });
  }, []);

  // Apply `data-density` to every portal root currently in the DOM.
  // Re-runs on every render so newly-mounted portals pick up the
  // preference even if they're created after the user first toggled.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const roots = document.querySelectorAll('.portal-root');
    roots.forEach((el) => {
      (el as HTMLElement).setAttribute('data-density', prefs.density);
    });
  }, [prefs.density]);

  return { prefs, setDensity };
}
