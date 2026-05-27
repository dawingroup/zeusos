/**
 * Phase 6.UI.B — Active IWOs page. Lists every in-flight IWO
 * grouped by brand, with SLA status (state colour) + burn % derived
 * from `cumulativeCostMinor / budgetMinor`.
 *
 * SLA badge: derived from state + tier turnaround windows in 6.E.
 * For now we surface state directly.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_DELIVERY_SUBSIDIARIES } from '@/core/settings/brand-capabilities';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import { subscribeActiveIwos } from '../services/traffic.service';
import { cn } from '@/shared/lib/utils';

function burnPct(iwo: InternalWorkOrder): number {
  if (!iwo.budgetMinor) return 0;
  return Math.min(100, Math.round((iwo.cumulativeCostMinor / iwo.budgetMinor) * 100));
}

const STATE_COLOR: Record<string, string> = {
  ISSUED: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber-deep)]',
  ACCEPTED: 'bg-[var(--rag-green-soft)] text-[var(--rag-green-deep)]',
  IN_PROGRESS: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  REVISION_REQUESTED: 'bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)]',
  DELIVERED: 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
};

export default function ActiveIwosPage() {
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeActiveIwos(setIwos, (e) =>
      setErr(`Active IWO subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  const grouped = useMemo(() => {
    const out: Record<string, InternalWorkOrder[]> = {};
    for (const b of ALL_DELIVERY_SUBSIDIARIES) out[b] = [];
    for (const i of iwos) {
      if (out[i.subsidiaryOrgId]) out[i.subsidiaryOrgId].push(i);
    }
    return out;
  }, [iwos]);

  if (err) {
    return (
      <div
        role="alert"
        data-testid="active-iwos-error"
        className="p-4 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)]"
      >
        {err}
      </div>
    );
  }

  return (
    <section data-testid="active-iwos-page" className="space-y-6">
      {ALL_DELIVERY_SUBSIDIARIES.map((brandId) => (
        <div key={brandId} data-testid={`brand-section-${brandId}`}>
          <header className="flex items-baseline justify-between mb-2">
            <h2 className="text-[14px] font-semibold text-[var(--fg-primary)]">{brandId}</h2>
            <span className="text-[11.5px] text-[var(--fg-tertiary)]">
              {grouped[brandId].length} active
            </span>
          </header>
          {grouped[brandId].length === 0 ? (
            <p className="text-[12px] text-[var(--fg-tertiary)] italic">No active IWOs.</p>
          ) : (
            <ul className="space-y-1.5">
              {grouped[brandId].map((iwo) => {
                const pct = burnPct(iwo);
                return (
                  <li
                    key={iwo.id}
                    data-testid={`iwo-row-${iwo.id}`}
                    className="flex items-center gap-3 p-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  >
                    <Link
                      to={`/delivery/iwo/${iwo.id}`}
                      className="text-[12.5px] font-medium text-[var(--fg-primary)] hover:underline flex-shrink-0"
                    >
                      {iwo.code || iwo.id}
                    </Link>
                    <span
                      className={cn(
                        'inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                        STATE_COLOR[iwo.state] ?? 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
                      )}
                    >
                      {iwo.state}
                    </span>
                    <div className="ml-auto flex items-center gap-2 text-[11.5px] text-[var(--fg-tertiary)]">
                      <span>{pct}% burned</span>
                      <div className="w-16 h-1.5 rounded-full bg-[var(--bg-sunken)] overflow-hidden">
                        <div
                          className={cn(
                            'h-full',
                            pct >= 90
                              ? 'bg-[var(--rag-red)]'
                              : pct >= 70
                                ? 'bg-[var(--rag-amber)]'
                                : 'bg-[var(--rag-green)]',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
