import { useEffect, useState } from 'react';

export type RailMode = 'push' | 'overlay';

/** At or above this viewport width the rail takes a column; below, it overlays. */
export const RAIL_PUSH_QUERY = '(min-width: 1440px)';

/** Push vs overlay follows the viewport, and reacts when it changes. */
export function useRailMode(): RailMode {
  const [push, setPush] = useState(() => window.matchMedia(RAIL_PUSH_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(RAIL_PUSH_QUERY);
    const onChange = (e: MediaQueryListEvent) => setPush(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return push ? 'push' : 'overlay';
}
