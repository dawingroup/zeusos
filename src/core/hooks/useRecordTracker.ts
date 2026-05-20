/**
 * useRecordTracker — log a "you opened this record" event so that the
 * global search palette can boost recently-viewed records and surface
 * them in its empty state.
 *
 * Call this from each entity detail page after the data has loaded:
 *
 *   const { order } = useSalesOrderDetail(orderId);
 *   useRecordTracker({
 *     type: 'sales_order',
 *     id: order?.id,
 *     title: order?.orderNumber ?? '',
 *     subtitle: order?.customerName,
 *     module: 'sales_orders',
 *   });
 *
 * No-op when `id` or `title` is empty — safe to call before the record
 * has loaded. Dedupes per (type, id) per mount via a ref so it doesn't
 * re-fire on every re-render.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalState } from '@/integration/store';
import type { ModuleId } from '@/integration/constants/modules.constants';

export interface RecordTrackerInput {
  type: string;
  id: string | null | undefined;
  title: string | null | undefined;
  subtitle?: string | null;
  /** Path to navigate to. Defaults to current location. */
  path?: string;
  module?: ModuleId | string;
  icon?: string;
}

export function useRecordTracker(input: RecordTrackerInput): void {
  const { addRecentItem } = useGlobalState();
  const location = useLocation();
  const lastLoggedRef = useRef<string | null>(null);

  const id = input.id ?? '';
  const title = (input.title ?? '').trim();

  useEffect(() => {
    if (!id || !title) return;
    const key = `${input.type}:${id}`;
    if (lastLoggedRef.current === key) return;
    lastLoggedRef.current = key;

    addRecentItem({
      type: input.type,
      id,
      title,
      module: (input.module ?? 'intelligence') as ModuleId,
      path: input.path ?? location.pathname,
    });
    // We intentionally exclude `subtitle`/`icon` from the deps and from the
    // logged payload because the GlobalContext.RecentItem schema doesn't
    // include them. Subtitle is reconstructed from the live record at
    // render time when the palette resolves the hit through the index.
  }, [addRecentItem, id, title, input.type, input.module, input.path, location.pathname]);
}
