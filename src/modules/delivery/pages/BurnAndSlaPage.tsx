/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): early Phase 6.UI.D.2 scaffolding mirrors IWOInboxPage; full Tailwind token refactor scheduled with the U.4 sweep. */
/**
 * BurnAndSlaPage — `/delivery/burn`.
 *
 * Cross-IWO roll-up of the burn meter + SLA countdown that lives on the
 * individual `IWOWorkspacePage`. Closes the Phase 6.UI.D.2 placeholder
 * route (was ComingSoonPage). Designed for the brand delivery lead
 * scanning their portfolio at the start of the day to spot anything
 * overheating before account management has to chase.
 *
 * Data flow:
 *   • Subscribes to `subscribeIWOActive(homeSub)` — ACCEPTED /
 *     IN_PROGRESS / DELIVERED IWOs in the user's home brand.
 *   • Each IWO doc already carries `cumulativeCostMinor` + `budgetMinor`
 *     (the Cloud Functions write them transactionally on every
 *     postTimeEntry / postCostEntry), so the page can compute the burn
 *     meter from the doc alone — no per-row entries fetch.
 *   • SLA countdown reads `slaDueAt` (set at IWO issue from tier ×
 *     engine_config.slaHoursByTier). IWOs without a tier leave it
 *     unset; the column shows "—".
 *
 * Layout:
 *   1. Filter chips (All / Overheating / On-track) + a count badge.
 *   2. One row per IWO, sorted by burn status (BLOCKED → WARN →
 *      OK), each with the existing `BurnMeterBar` visualization.
 *
 * Read access is the same as IWOInboxPage: gated by
 * `SubsidiaryDeliveryGuard` at the router level. Parent-org admins
 * pass through; subsidiary users see only their home brand's IWOs.
 *
 * Tests: `__tests__/BurnAndSlaPage.test.tsx` covers the sort + filter
 * logic against synthetic IWO arrays (the Firestore subscription is
 * mocked out per the existing pattern in IWOInboxPage's siblings).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentDawinUser } from '@/core/settings';
import type { InternalWorkOrder } from '@/modules/assignment';
import type { SubsidiaryId } from '@/core/settings/types';
import { subscribeIWOActive } from '../services/firestore';
import { resolveHomeSubsidiaryId } from '../components/deliveryAccess';
import { isConflictIsolated } from '@/core/navigation/manifest';
import { computeBurnMeter, type BurnMeter } from '../services/burnMeter';
import { BurnMeterBar } from '../components/BurnMeterBar';
import { PageHero } from '@/shared/components/refresh';

type Filter = 'all' | 'overheating' | 'on-track';

interface BurnRow {
  iwo: InternalWorkOrder;
  meter: BurnMeter;
  /** Hours remaining until SLA, or null if no SLA on the IWO. */
  slaHoursLeft: number | null;
}

const STATUS_RANK: Record<BurnMeter['status'], number> = {
  BLOCKED: 0,
  WARN: 1,
  OK: 2,
};

function toDateMaybe(ts: InternalWorkOrder['slaDueAt']): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  const maybe = ts as unknown as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate();
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000);
  return null;
}

function formatSla(hoursLeft: number | null): string {
  if (hoursLeft === null) return '—';
  if (hoursLeft < 0) return `${Math.ceil(-hoursLeft)}h overdue`;
  if (hoursLeft < 1) return '< 1h left';
  if (hoursLeft < 24) return `${Math.floor(hoursLeft)}h left`;
  return `${Math.floor(hoursLeft / 24)}d left`;
}

function buildRow(iwo: InternalWorkOrder, now: number): BurnRow {
  const meter = computeBurnMeter({
    cumulativeMinor: iwo.cumulativeCostMinor ?? 0,
    budgetMinor: iwo.budgetMinor ?? 0,
  });
  const due = toDateMaybe(iwo.slaDueAt);
  const slaHoursLeft = due ? (due.getTime() - now) / 1000 / 60 / 60 : null;
  return { iwo, meter, slaHoursLeft };
}

function sortRows(a: BurnRow, b: BurnRow): number {
  const rank = STATUS_RANK[a.meter.status] - STATUS_RANK[b.meter.status];
  if (rank !== 0) return rank;
  // Same bucket — higher burn first.
  if (a.meter.percentage !== b.meter.percentage) {
    return b.meter.percentage - a.meter.percentage;
  }
  // Same burn — tighter SLA first (negative = overdue ranks earliest).
  const aSla = a.slaHoursLeft ?? Number.POSITIVE_INFINITY;
  const bSla = b.slaHoursLeft ?? Number.POSITIVE_INFINITY;
  return aSla - bSla;
}

function applyFilter(rows: BurnRow[], filter: Filter): BurnRow[] {
  if (filter === 'all') return rows;
  if (filter === 'overheating') {
    return rows.filter(r => r.meter.status !== 'OK');
  }
  return rows.filter(r => r.meter.status === 'OK');
}

export default function BurnAndSlaPage() {
  const { dawinUser } = useCurrentDawinUser();
  const homeSub = useMemo<SubsidiaryId | null>(
    () => (dawinUser ? (resolveHomeSubsidiaryId(dawinUser) as SubsidiaryId | null) : null),
    [dawinUser],
  );

  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  // `now` is captured per-snapshot so the SLA countdown stays consistent
  // within a render. The subscription firing also re-renders.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!homeSub) return;
    const u = subscribeIWOActive(
      homeSub,
      (next) => {
        setIwos(next);
        setNow(Date.now());
      },
      (e) => setErr(`Burn roll-up load failed: ${e.message}`),
    );
    return () => u();
  }, [homeSub]);

  const rows = useMemo(
    () => iwos.map(iwo => buildRow(iwo, now)).sort(sortRows),
    [iwos, now],
  );

  const filtered = useMemo(() => applyFilter(rows, filter), [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    overheating: rows.filter(r => r.meter.status !== 'OK').length,
    onTrack: rows.filter(r => r.meter.status === 'OK').length,
  }), [rows]);

  if (!homeSub) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Burn &amp; SLA</h1>
        <p style={{ color: '#475569' }}>
          You don&apos;t appear to have access to any operating subsidiary. Speak to your administrator.
        </p>
      </div>
    );
  }

  const showIsolationBanner = isConflictIsolated(homeSub);

  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="burn-sla-page">
      <PageHero
        eyebrow={`${homeSub} · Delivery`}
        title="Burn & SLA"
        body="Active IWOs in your brand. Sorted with overheating first; click any row for the workspace."
      />

      {showIsolationBanner && (
        <div
          role="note"
          data-testid="burn-sla-isolation-banner"
          style={{
            padding: '10px 14px',
            marginBottom: 16,
            borderRadius: 6,
            background: 'var(--rag-amber-soft, #fef3c7)',
            color: 'var(--rag-amber-deep, #78350f)',
            border: '1px solid var(--rag-amber, #f59e0b)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Conflict-isolated workspace — your clients are not visible to other brands.
        </div>
      )}

      {err && (
        <div role="alert" data-testid="burn-sla-error" style={{
          padding: 12, marginBottom: 16, borderRadius: 6,
          background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
        }}>
          {err}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Filter active IWOs"
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        {(['all', 'overheating', 'on-track'] as Filter[]).map(key => {
          const count = key === 'all'
            ? counts.all
            : key === 'overheating'
              ? counts.overheating
              : counts.onTrack;
          const active = filter === key;
          const label = key === 'on-track' ? 'On-track' : key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              type="button"
              data-testid={`burn-sla-filter-${key}`}
              onClick={() => setFilter(key)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: active ? '1px solid #0f172a' : '1px solid #e2e8f0',
                background: active ? '#0f172a' : '#fff',
                color: active ? '#fff' : '#0f172a',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {label} <span data-testid={`burn-sla-count-${key}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }} data-testid="burn-sla-empty">
          {rows.length === 0
            ? 'No active work orders.'
            : 'No work orders match this filter.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="burn-sla-list">
          {filtered.map(({ iwo, meter, slaHoursLeft }) => (
            <li
              key={iwo.id}
              data-testid={`burn-sla-row-${iwo.id}`}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid #f1f5f9',
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1fr) 2fr minmax(120px, auto)',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div>
                <Link
                  to={`/delivery/iwo/${iwo.id}`}
                  style={{ fontFamily: 'monospace', color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}
                  data-testid={`burn-sla-row-${iwo.id}-link`}
                >
                  {iwo.code}
                </Link>
                <div style={{ marginTop: 2, color: '#64748b', fontSize: 12 }}>
                  {iwo.state}
                  {iwo.tier ? ` · ${iwo.tier}` : ''}
                </div>
              </div>
              <BurnMeterBar meter={meter} currency={iwo.currency} />
              <div
                style={{
                  fontSize: 12,
                  color: slaHoursLeft !== null && slaHoursLeft < 0 ? '#7f1d1d' : '#475569',
                  textAlign: 'right',
                  fontWeight: slaHoursLeft !== null && slaHoursLeft < 24 ? 600 : 400,
                }}
                data-testid={`burn-sla-row-${iwo.id}-sla`}
              >
                {formatSla(slaHoursLeft)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Exported helpers for unit testing. Internal use only.
export const __testing = {
  buildRow,
  sortRows,
  applyFilter,
  formatSla,
};
