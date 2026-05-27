/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): early Phase 6.UI.D.2 scaffolding mirrors BurnAndSlaPage; full Tailwind token refactor scheduled with the U.4 sweep. */
/**
 * IwoHealthPage — `/reports` (parent-org).
 *
 * The cross-brand counterpart to `/delivery/burn` (which is scoped to
 * the user's home subsidiary). This page lists every active IWO across
 * all sibling brands, groups by brand, and within each brand sorts
 * overheating first. Parent-org AM uses it to spot portfolio-wide
 * risk before any one brand head escalates.
 *
 * Data flow:
 *   • Subscribes to `subscribeActiveIwos()` from
 *     `src/modules/traffic/services/traffic.service.ts` — same query
 *     the Traffic "Active IWOs" tab already uses. Reads pass through
 *     `firestore.rules` parent-org check on `internal_work_orders`.
 *   • Each IWO carries `cumulativeCostMinor` + `budgetMinor`; burn
 *     comes from `computeBurnMeter` (Phase 3.E delivery service).
 *
 * Layout:
 *   1. Portfolio summary — total active, overheating count, average
 *      burn % across all brands.
 *   2. Filter chips (All / Overheating / On-track).
 *   3. One section per brand with a header carrying counts + brand
 *      label, then rows sorted BLOCKED → WARN → OK then by burn %
 *      desc. Empty brands collapse.
 *
 * Out of scope for v1 (separate report tabs in future):
 *   • Routing override frequency (RoutingBrandProposed event log)
 *   • Conflict exclusivity risks (already on `/conflict-firewall/
 *     breach-risks` for parent-org)
 *   • IWO velocity / cycle time (needs `acceptedAt` → `closedAt`
 *     timestamps on IWO doc, currently inconsistent)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import type { SubsidiaryId } from '@/core/settings/types';
import { ALL_DELIVERY_SUBSIDIARIES } from '@/core/settings/brand-capabilities';
import { subscribeActiveIwos } from '@/modules/traffic/services/traffic.service';
import { computeBurnMeter, type BurnMeter } from '@/modules/delivery/services/burnMeter';
import { BurnMeterBar } from '@/modules/delivery/components/BurnMeterBar';

type Filter = 'all' | 'overheating' | 'on-track';

interface IwoRow {
  iwo: InternalWorkOrder;
  meter: BurnMeter;
}

interface BrandGroup {
  brandId: SubsidiaryId;
  label: string;
  rows: IwoRow[];
  total: number;
  overheating: number;
  avgBurnPct: number;
}

const STATUS_RANK: Record<BurnMeter['status'], number> = {
  BLOCKED: 0,
  WARN: 1,
  OK: 2,
};

const BRAND_LABELS: Record<string, string> = {
  'zeus-the-agency': 'Zeus The Agency',
  'zeus-digital': 'Zeus Digital',
  'labyrinth': 'Labyrinth',
  'odd-gorilla': 'Odd Gorilla',
  'house-of-zeus': 'House of Zeus',
};

function buildRow(iwo: InternalWorkOrder): IwoRow {
  return {
    iwo,
    meter: computeBurnMeter({
      cumulativeMinor: iwo.cumulativeCostMinor ?? 0,
      budgetMinor: iwo.budgetMinor ?? 0,
    }),
  };
}

function sortRows(a: IwoRow, b: IwoRow): number {
  const rank = STATUS_RANK[a.meter.status] - STATUS_RANK[b.meter.status];
  if (rank !== 0) return rank;
  return b.meter.percentage - a.meter.percentage;
}

function applyFilter(rows: IwoRow[], filter: Filter): IwoRow[] {
  if (filter === 'all') return rows;
  if (filter === 'overheating') return rows.filter(r => r.meter.status !== 'OK');
  return rows.filter(r => r.meter.status === 'OK');
}

function buildBrandGroups(iwos: InternalWorkOrder[]): BrandGroup[] {
  const byBrand = new Map<SubsidiaryId, IwoRow[]>();
  for (const b of ALL_DELIVERY_SUBSIDIARIES) {
    byBrand.set(b as SubsidiaryId, []);
  }
  for (const i of iwos) {
    const list = byBrand.get(i.subsidiaryOrgId as SubsidiaryId);
    if (list) list.push(buildRow(i));
  }
  const groups: BrandGroup[] = [];
  for (const [brandId, rows] of byBrand.entries()) {
    rows.sort(sortRows);
    const overheating = rows.filter(r => r.meter.status !== 'OK').length;
    const sumBurn = rows.reduce((s, r) => s + r.meter.percentage, 0);
    groups.push({
      brandId,
      label: BRAND_LABELS[brandId] ?? brandId,
      rows,
      total: rows.length,
      overheating,
      avgBurnPct: rows.length > 0 ? Math.round(sumBurn / rows.length) : 0,
    });
  }
  // Sort brand groups by overheating count desc, then by total desc.
  groups.sort((a, b) => {
    if (a.overheating !== b.overheating) return b.overheating - a.overheating;
    return b.total - a.total;
  });
  return groups;
}

export default function IwoHealthPage() {
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const u = subscribeActiveIwos(setIwos, (e) =>
      setErr(`IWO health roll-up load failed: ${e.message}`),
    );
    return () => u();
  }, []);

  const groups = useMemo(() => buildBrandGroups(iwos), [iwos]);

  const portfolio = useMemo(() => {
    const total = iwos.length;
    if (total === 0) {
      return { total: 0, overheating: 0, avgBurnPct: 0 };
    }
    let overheating = 0;
    let sumBurn = 0;
    for (const row of iwos.map(buildRow)) {
      if (row.meter.status !== 'OK') overheating++;
      sumBurn += row.meter.percentage;
    }
    return {
      total,
      overheating,
      avgBurnPct: Math.round(sumBurn / total),
    };
  }, [iwos]);

  return (
    <div style={{ padding: 24 }} data-testid="reports-iwo-health-page">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Reports — IWO Health</h1>
        <p style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>
          Active work orders across every sibling brand. Sorted with the most overheating brand first;
          within each brand, BLOCKED → WARN → OK.
        </p>
      </header>

      {err && (
        <div role="alert" data-testid="reports-error" style={{
          padding: 12, marginBottom: 16, borderRadius: 6,
          background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
        }}>
          {err}
        </div>
      )}

      {/* Portfolio summary tiles */}
      <section
        data-testid="reports-portfolio-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{
          padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff',
        }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Active IWOs
          </div>
          <div data-testid="reports-portfolio-total" style={{ marginTop: 4, fontSize: 22, fontWeight: 600 }}>
            {portfolio.total}
          </div>
        </div>
        <div style={{
          padding: 12, borderRadius: 8,
          border: `1px solid ${portfolio.overheating > 0 ? '#fecaca' : '#e2e8f0'}`,
          background: portfolio.overheating > 0 ? '#fef2f2' : '#fff',
        }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Overheating
          </div>
          <div
            data-testid="reports-portfolio-overheating"
            style={{
              marginTop: 4, fontSize: 22, fontWeight: 600,
              color: portfolio.overheating > 0 ? '#7f1d1d' : '#0f172a',
            }}
          >
            {portfolio.overheating}
          </div>
        </div>
        <div style={{
          padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff',
        }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Avg burn
          </div>
          <div data-testid="reports-portfolio-avg-burn" style={{ marginTop: 4, fontSize: 22, fontWeight: 600 }}>
            {portfolio.avgBurnPct}%
          </div>
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Filter active IWOs"
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        {(['all', 'overheating', 'on-track'] as Filter[]).map(key => {
          const active = filter === key;
          const label = key === 'on-track' ? 'On-track' : key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              type="button"
              data-testid={`reports-filter-${key}`}
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
              {label}
            </button>
          );
        })}
      </div>

      {portfolio.total === 0 ? (
        <p
          data-testid="reports-empty"
          style={{ color: '#64748b', fontSize: 13 }}
        >
          No active work orders across any brand.
        </p>
      ) : (
        groups.map((g) => {
          const visible = applyFilter(g.rows, filter);
          // Hide empty brand sections under non-"all" filters to keep the page scannable.
          if (visible.length === 0 && filter !== 'all') return null;
          return (
            <section
              key={g.brandId}
              data-testid={`reports-brand-${g.brandId}`}
              style={{
                marginBottom: 20,
                padding: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
              }}
            >
              <header style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{g.label}</h2>
                  <div style={{ marginTop: 2, color: '#64748b', fontSize: 12 }} data-testid={`reports-brand-${g.brandId}-stats`}>
                    {g.total} active · {g.overheating} overheating · {g.avgBurnPct}% avg burn
                  </div>
                </div>
              </header>
              {visible.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }} data-testid={`reports-brand-${g.brandId}-empty`}>
                  {g.total === 0
                    ? 'No active work orders.'
                    : 'No work orders match this filter.'}
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {visible.map(({ iwo, meter }) => (
                    <li
                      key={iwo.id}
                      data-testid={`reports-row-${iwo.id}`}
                      style={{
                        padding: '10px 0',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(140px, 1fr) 3fr',
                        gap: 16,
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <Link
                          to={`/delivery/iwo/${iwo.id}`}
                          style={{
                            fontFamily: 'monospace',
                            color: '#0f172a',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                          data-testid={`reports-row-${iwo.id}-link`}
                        >
                          {iwo.code}
                        </Link>
                        <div style={{ marginTop: 2, color: '#64748b', fontSize: 12 }}>
                          {iwo.state}
                          {iwo.tier ? ` · ${iwo.tier}` : ''}
                        </div>
                      </div>
                      <BurnMeterBar meter={meter} currency={iwo.currency} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

// Exported for unit testing.
export const __testing = {
  buildRow,
  sortRows,
  applyFilter,
  buildBrandGroups,
};
