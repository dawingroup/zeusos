/**
 * BreachRisksPage — ADR-2026-05-25 §2.Q4.
 *
 * Read-only feed of `ConflictExclusivityRisk` events from the outbox.
 * Each row tells the story: "routing for master_job X was tightened
 * because client A blocks competitor B and brand C is serving B."
 *
 * Phase 6.F Conflict Sentinel (ZA-004) will consume the same stream
 * and write `agent_findings` against these events — for now, this is
 * the human-readable surface.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  subscribeConflictRisks,
  type ConflictExclusivityRiskEvent,
} from '../services/conflict-firewall.service';

function formatWhen(value: string | undefined): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

export default function BreachRisksPage() {
  const [events, setEvents] = useState<ConflictExclusivityRiskEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeConflictRisks(setEvents, (e) =>
      setErr(`Breach-risk stream failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6 space-y-4" data-testid="breach-risks-page">
      <header>
        <h1 className="text-[20px] font-semibold text-[var(--fg-primary)] mb-1">
          Conflict-firewall breach risks
        </h1>
        <p className="text-[12.5px] text-[var(--fg-tertiary)]">
          Every routing decision that was tightened by a competitor wall.
          Sorted newest first.
        </p>
      </header>

      {err && (
        <div
          role="alert"
          data-testid="breach-risks-error"
          className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]"
        >
          {err}
        </div>
      )}

      {events.length === 0 ? (
        <p
          data-testid="breach-risks-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No exclusivity-risk events yet. They fire whenever routing has
          to exclude a brand because of a competitor wall.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              data-testid={`breach-risk-${event.id}`}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 space-y-1.5"
            >
              <header className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--rag-amber)]" aria-hidden="true" />
                  <Link
                    to={`/master-jobs/${event.payload.masterJobId}`}
                    className="text-[13.5px] font-semibold text-[var(--fg-primary)] hover:underline"
                  >
                    {event.payload.masterJobId}
                  </Link>
                </div>
                <span className="text-[11px] text-[var(--fg-tertiary)]">
                  {formatWhen(event.occurredAt)}
                </span>
              </header>
              <p className="text-[12.5px]">
                Routing for{' '}
                <Link
                  to={`/clients/${event.payload.requestedClientId}`}
                  className="font-mono text-[var(--accent)] hover:underline"
                >
                  {event.payload.requestedClientId}
                </Link>{' '}
                excluded{' '}
                <strong>{event.payload.walledBrandIds.length}</strong>{' '}
                brand{event.payload.walledBrandIds.length === 1 ? '' : 's'}.
              </p>
              <ul className="space-y-0.5 text-[11.5px] text-[var(--fg-secondary)]">
                {event.payload.walledBrandIds.map((brand) => {
                  const blockedBy = event.payload.walledCompetitorByBrand?.[brand] ?? [];
                  return (
                    <li key={brand} data-testid={`breach-risk-${event.id}-brand-${brand}`}>
                      <code className="font-mono text-[var(--fg-primary)]">{brand}</code>
                      {blockedBy.length > 0 && (
                        <>
                          {' '}— serves{' '}
                          {blockedBy.map((c, idx) => (
                            <span key={c}>
                              <code className="font-mono">{c}</code>
                              {idx < blockedBy.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
