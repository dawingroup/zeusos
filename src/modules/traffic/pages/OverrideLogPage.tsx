/**
 * Phase 6.UI.B — Override Log page.
 *
 * Lists every `RoutingBrandProposed` event in the domain_events
 * stream. Override detection (proposed vs actual brand) crosses
 * against issued IWOs — that join lands in 6.E with the unified
 * inbox. For now we show the raw proposal stream so Traffic can
 * audit decisions chronologically.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  subscribeRoutingProposals,
  type RoutingBrandProposedEvent,
} from '../services/traffic.service';

function formatOccurredAt(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function OverrideLogPage() {
  const [events, setEvents] = useState<RoutingBrandProposedEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeRoutingProposals(
      setEvents,
      (e) => setErr(`Override log subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  if (err) {
    return (
      <div
        role="alert"
        data-testid="override-log-error"
        className="p-4 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)]"
      >
        {err}
      </div>
    );
  }

  return (
    <section data-testid="override-log-page">
      <p className="text-[12px] text-[var(--fg-tertiary)] mb-3">
        Routing proposals emitted by the engine. Override detection (proposed vs
        actual brand) joins against issued IWOs — surfaced fully in 6.E.
      </p>
      {events.length === 0 ? (
        <p
          data-testid="override-log-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No routing proposals recorded yet.
        </p>
      ) : (
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--fg-tertiary)] border-b border-[var(--border-default)]">
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Master Job</th>
              <th className="py-2 pr-3 font-medium">Capability</th>
              <th className="py-2 pr-3 font-medium">Proposed</th>
              <th className="py-2 pr-3 font-medium">Geography</th>
              <th className="py-2 pr-3 font-medium">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const rejectedCount = ev.payload.candidates.filter(
                (c) => c.rejectionReason !== null,
              ).length;
              return (
                <tr
                  key={ev.id}
                  data-testid={`override-log-row-${ev.id}`}
                  className="border-b border-[var(--border-default)] hover:bg-[var(--bg-sunken)]"
                >
                  <td className="py-2 pr-3 text-[var(--fg-tertiary)] whitespace-nowrap">
                    {formatOccurredAt(ev.occurredAt)}
                  </td>
                  <td className="py-2 pr-3">
                    <Link
                      to={`/master-jobs/${ev.aggregateId}`}
                      className="text-[var(--accent)] hover:underline font-mono"
                    >
                      {ev.aggregateId}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{ev.payload.requiredCapability}</td>
                  <td className="py-2 pr-3 font-medium">
                    {ev.payload.proposedBrandId ?? (
                      <span className="text-[var(--rag-red)]">none eligible</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-[var(--fg-tertiary)]">
                    {ev.payload.geographyPreferenceApplied ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-[var(--fg-tertiary)]">{rejectedCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
