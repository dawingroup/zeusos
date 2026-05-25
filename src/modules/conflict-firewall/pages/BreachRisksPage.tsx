/**
 * Conflict Firewall · Breach Risks — Phase 6.UI.C.
 *
 * Consumes the `ConflictExclusivityRisk` outbox event stream
 * emitted by `excludeConflicted` whenever a routing decision
 * would have selected a brand that's already walled in for the
 * requested account's category. The agent surface (ZA-004,
 * Phase 6.F) consumes the same stream — for now this is the
 * human-facing audit view.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  subscribeConflictRisks,
  type ConflictExclusivityRiskEvent,
} from '../services/conflict-firewall.service';

function formatOccurredAt(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function BreachRisksPage() {
  const [events, setEvents] = useState<ConflictExclusivityRiskEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeConflictRisks(
      setEvents,
      (e) => setErr(`Breach-risks subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  if (err) {
    return (
      <div
        role="alert"
        data-testid="breach-risks-error"
        className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]"
      >
        {err}
      </div>
    );
  }

  return (
    <section data-testid="breach-risks-page" className="space-y-3">
      <p className="text-[12px] text-[var(--fg-tertiary)]">
        Each row records a routing decision that ran tight — at least one brand was
        excluded by the firewall before <code>routeBrand</code> picked a winner.
      </p>

      {events.length === 0 ? (
        <p
          data-testid="breach-risks-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No conflict-exclusivity events recorded yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((ev) => (
            <li
              key={ev.id}
              data-testid={`breach-risk-${ev.id}`}
              className="flex items-start gap-3 p-3 rounded-md border border-[var(--rag-amber)] bg-[var(--rag-amber-soft)]"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 text-[var(--rag-amber-deep)] flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-[12.5px] text-[var(--rag-amber-deep)]">
                <p>
                  <strong>{ev.payload.excludedBrandIds.length}</strong> brand
                  {ev.payload.excludedBrandIds.length === 1 ? '' : 's'} excluded by walls in{' '}
                  <strong>{ev.payload.categoryId}</strong>{' — '}
                  master job{' '}
                  <Link
                    to={`/master-jobs/${ev.payload.masterJobId}`}
                    className="font-mono underline"
                  >
                    {ev.payload.masterJobId}
                  </Link>
                </p>
                <p className="text-[11px] mt-1">
                  Excluded: {ev.payload.excludedBrandIds.join(', ')} ·{' '}
                  walled clients: {ev.payload.walledClientIds.join(', ') || '—'} ·{' '}
                  {formatOccurredAt(ev.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
