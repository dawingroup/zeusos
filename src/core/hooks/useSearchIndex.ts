/**
 * useSearchIndex — React hook over the SearchIndexManager singleton.
 *
 * Returns `{ search, ready, counts }`:
 *   - search(query): SearchHit[]   — synchronous in-memory ranked search
 *   - ready: boolean               — true once initial snapshots have resolved
 *   - counts: Record<type, number> — per-type record counts (UI diagnostics)
 *
 * Subscribes to the singleton's readiness updates so consumers re-render
 * when new records stream in or when subsidiary changes wipe the index.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { searchIndex, type SearchHit, type IndexReadiness } from '@/core/services/search/searchIndex';
import type { SearchOptions } from '@/core/services/search/types';
import { useGlobalState } from '@/integration/store';

const EMPTY_READY: IndexReadiness = {
  ready: false,
  counts: {},
  loaded: new Set<string>(),
  expected: 0,
};

export function useSearchIndex() {
  const { state } = useGlobalState();
  const recentItems = state.preferences.recentItems;

  // useSyncExternalStore would be ideal but the manager exposes a callback
  // pattern. We adapt by capturing a snapshot in a ref-equivalent via subscribe.
  const subscribe = useCallback((cb: () => void) => {
    // searchIndex.onReady fires on attach/detach/per-snapshot; we ignore the
    // payload and just trigger React re-render.
    return searchIndex.onReady(() => cb());
  }, []);
  const getSnapshot = useCallback(() => searchIndex.readiness(), []);
  const readiness = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_READY);

  const search = useCallback(
    (query: string, opts?: SearchOptions): SearchHit[] => {
      return searchIndex.search(query, opts ?? {}, recentItems);
    },
    [recentItems],
  );

  return useMemo(
    () => ({
      search,
      ready: readiness.ready,
      counts: readiness.counts,
      expected: readiness.expected,
    }),
    [search, readiness],
  );
}
