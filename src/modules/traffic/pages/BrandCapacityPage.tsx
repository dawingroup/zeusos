/**
 * Phase 6.UI.B — Brand Capacity page.
 *
 * Per-brand snapshot of the same `openIwoCount` signal `routeBrand`
 * uses for its capacity check. The bar visualises how close each
 * brand is to the soft ceiling (`engine_config.brandCapacityThreshold`
 * — defaults to 20).
 *
 * Threshold is fetched once on mount; if `engine_config/global`
 * doesn't exist yet (pre-6.E), the default applies.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import { ALL_DELIVERY_SUBSIDIARIES } from '@/core/settings/brand-capabilities';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import { subscribeActiveIwos } from '../services/traffic.service';
import { cn } from '@/shared/lib/utils';

const DEFAULT_THRESHOLD = 20;

export default function BrandCapacityPage() {
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);

  useEffect(() => {
    const unsubscribe = subscribeActiveIwos(setIwos);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'engine_config', 'global'));
        const data = snap.exists() ? snap.data() : null;
        if (data && typeof data.brandCapacityThreshold === 'number') {
          setThreshold(data.brandCapacityThreshold);
        }
      } catch {
        // engine_config not readable yet — stick with default.
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of ALL_DELIVERY_SUBSIDIARIES) out[b] = 0;
    for (const i of iwos) {
      if (out[i.subsidiaryOrgId] !== undefined) out[i.subsidiaryOrgId] += 1;
    }
    return out;
  }, [iwos]);

  return (
    <section data-testid="brand-capacity-page" className="space-y-3">
      <p className="text-[12px] text-[var(--fg-tertiary)] mb-3">
        Soft ceiling: <strong>{threshold}</strong> active IWOs per brand. Brands at the
        ceiling are not excluded by <code>routeBrand</code>, but they are ranked lower.
      </p>
      <ul className="space-y-2">
        {ALL_DELIVERY_SUBSIDIARIES.map((brandId) => {
          const open = counts[brandId];
          const pct = Math.min(100, Math.round((open / threshold) * 100));
          const overflow = open >= threshold;
          return (
            <li
              key={brandId}
              data-testid={`capacity-row-${brandId}`}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
            >
              <header className="flex items-baseline justify-between mb-1.5">
                <p className="text-[13px] font-medium text-[var(--fg-primary)]">{brandId}</p>
                <p className="text-[12px] text-[var(--fg-tertiary)]">
                  <span
                    data-testid={`capacity-count-${brandId}`}
                    className={overflow ? 'text-[var(--rag-red)] font-medium' : undefined}
                  >
                    {open}
                  </span>{' '}
                  / {threshold}
                </p>
              </header>
              <div className="w-full h-2 rounded-full bg-[var(--bg-sunken)] overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    overflow
                      ? 'bg-[var(--rag-red)]'
                      : pct >= 80
                        ? 'bg-[var(--rag-amber)]'
                        : 'bg-[var(--rag-green)]',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
