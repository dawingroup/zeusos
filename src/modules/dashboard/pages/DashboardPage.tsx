/**
 * DashboardPage — the Zeus Group landing surface (route `/`).
 *
 * Replaces the prior `/ → /strategy` redirect (which dropped users onto the
 * DawinOS Executive/OKR layout). Renders the refreshed "Commercial Gravity"
 * dashboard from the design package:
 *
 *   • PARENT (zeus-group): group-wide KPI strip + 5-brand portfolio roll-up
 *     + recent IWO activity + conflict-firewall watch + weekly-pulse stub.
 *   • SUBSIDIARY: the brand's "today's work" — awaiting-acceptance + in-flight
 *     KPIs + inbox table scoped to the user's home brand.
 *
 * Data: wired to real Firestore. Parent reads the cross-brand active-IWO
 * collection-group via `subscribeActiveIwos` (parent-org-gated) + open master
 * jobs + conflict risks. Subsidiary reads its own brand via the delivery
 * inbox/active subscriptions (home-brand-scoped, rules-safe). Burn comes from
 * the pure `computeBurnMeter`. The weekly pulse has no aggregator yet and
 * renders a labelled placeholder rather than fabricated numbers.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Shield, Inbox, Plus } from 'lucide-react';
import { useCurrentDawinUser } from '@/core/settings';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import type { SubsidiaryId } from '@/core/settings/types';
import { isConflictIsolated } from '@/core/settings/brand-capabilities';
import type { InternalWorkOrder, IWOState } from '@/modules/assignment/types/iwo.types';
import { computeBurnMeter } from '@/modules/delivery/services/burnMeter';
import { subscribeIWOInbox, subscribeIWOActive } from '@/modules/delivery/services/firestore';
import { subscribeActiveIwos, subscribeOpenMasterJobs } from '@/modules/traffic/services/traffic.service';
import {
  subscribeConflictRisks,
  type ConflictExclusivityRiskEvent,
} from '@/modules/conflict-firewall/services/conflict-firewall.service';
import { KPI, BurnMeter, SectionH, Pill, type RagTone } from '@/shared/components/refresh';
import { formatMinor } from '@/modules/account-management/utils/money';

// Brand metadata — mirrors the Phase 1 [data-brand] palette.
const BRAND_META: Record<string, { name: string; short: string; accent: string }> = {
  'zeus-group':      { name: 'Zeus Group',      short: 'ZG', accent: '#0a1f4a' },
  'zeus-the-agency': { name: 'Zeus The Agency', short: 'ZA', accent: '#f5d900' },
  'zeus-digital':    { name: 'Zeus Digital',    short: 'ZD', accent: '#00c5e5' },
  labyrinth:         { name: 'Labyrinth',       short: 'LB', accent: '#2f9d5c' },
  'odd-gorilla':     { name: 'Odd Gorilla',     short: 'OG', accent: '#e65b66' },
  'house-of-zeus':   { name: 'House of Zeus',   short: 'HZ', accent: '#6fa823' },
};
const DELIVERY_BRANDS = ['zeus-the-agency', 'zeus-digital', 'labyrinth', 'odd-gorilla', 'house-of-zeus'];

function brandMeta(id: string) {
  return BRAND_META[id] ?? { name: id, short: id.slice(0, 2).toUpperCase(), accent: '#0a1f4a' };
}

type Sla = 'breach' | 'warn' | 'ok' | 'na';
function slaRisk(iwo: InternalWorkOrder, nowMs: number): Sla {
  if (!iwo.slaDueAt) return 'na';
  const due = new Date(iwo.slaDueAt).getTime();
  if (Number.isNaN(due)) return 'na';
  if (due < nowMs) return 'breach';
  if (due - nowMs < 24 * 60 * 60 * 1000) return 'warn';
  return 'ok';
}
function stateTone(state: IWOState): RagTone {
  if (state === 'DELIVERED' || state === 'ACCEPTED_INTERNALLY' || state === 'CLOSED') return 'green';
  if (state === 'REJECTED' || state === 'CANCELLED' || state === 'REVISION_REQUESTED') return 'red';
  return 'blue';
}

export default function DashboardPage() {
  const { dawinUser } = useCurrentDawinUser();
  const { currentSubsidiary } = useSubsidiary();

  const brandId = (currentSubsidiary?.id ?? 'zeus-group') as SubsidiaryId;
  const isParent = useMemo(() => {
    const onGroup = brandId === 'zeus-group';
    const privileged =
      (dawinUser?.globalRole === 'admin' || dawinUser?.globalRole === 'owner') &&
      Array.isArray(dawinUser?.subsidiaryAccess) &&
      dawinUser.subsidiaryAccess.some((s) => s.subsidiaryId === 'zeus-group' && s.hasAccess);
    return onGroup && !!privileged;
  }, [dawinUser, brandId]);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  if (isParent) return <ParentDashboard today={today} />;
  return <SubsidiaryDashboard today={today} brandId={brandId} />;
}

// ---------------------------------------------------------------------------
// PARENT — Commercial Gravity
// ---------------------------------------------------------------------------
function ParentDashboard({ today }: { today: string }) {
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [openMjCount, setOpenMjCount] = useState<number | null>(null);
  const [risks, setRisks] = useState<ConflictExclusivityRiskEvent[]>([]);
  const nowMs = useMemo(() => Date.now(), [iwos]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    unsubs.push(subscribeActiveIwos(setIwos, () => setIwos([])));
    unsubs.push(subscribeOpenMasterJobs((jobs) => setOpenMjCount(jobs.length), () => setOpenMjCount(null)));
    unsubs.push(subscribeConflictRisks(setRisks, () => setRisks([])));
    return () => unsubs.forEach((u) => u());
  }, []);

  const breaches = iwos.filter((i) => slaRisk(i, nowMs) === 'breach').length;

  const portfolio = useMemo(
    () =>
      DELIVERY_BRANDS.map((id) => {
        const rows = iwos.filter((r) => r.subsidiaryOrgId === id);
        const budget = rows.reduce((s, r) => s + (r.budgetMinor || 0), 0);
        const cost = rows.reduce((s, r) => s + (r.cumulativeCostMinor || 0), 0);
        const burn = budget > 0 ? cost / budget : 0;
        const sla = rows.filter((r) => {
          const x = slaRisk(r, nowMs);
          return x === 'breach' || x === 'warn';
        }).length;
        const ccy = rows[0]?.currency ?? 'UGX';
        return { id, activeIWOs: rows.length, burn, billable: budget ? formatMinor(budget, ccy) : '—', sla };
      }),
    [iwos, nowMs],
  );

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Zeus Group · {today}</div>
          <h1 className="display">
            Commercial gravity, <span className="zeus-underline">at a glance</span>
          </h1>
          <p style={{ marginTop: 12, color: 'var(--fg-secondary)', fontSize: 14, maxWidth: 520 }}>
            Active engagements across the five brands. Pulled live from{' '}
            <span className="mono" style={{ fontSize: 12 }}>master_jobs</span> +{' '}
            <span className="mono" style={{ fontSize: 12 }}>internal_work_orders</span>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <Link to="/reports" className="btn btn-secondary"><ArrowUpRight size={13} /> Reports</Link>
          <Link to="/traffic" className="btn btn-primary"><ArrowUpRight size={13} /> Open Traffic</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <KPI label="Open Master Jobs" value={openMjCount ?? '—'} accent="#0a1f4a" />
        <KPI label="In-flight IWOs" value={iwos.length} accent="#e63946" />
        <KPI label="Brands engaged" value={portfolio.filter((p) => p.activeIWOs > 0).length} accent="#2f9d5c" />
        <KPI label="SLA breaches" value={breaches} deltaDir={breaches > 0 ? 'down' : 'flat'} accent="#e18425" />
      </div>

      <SectionH
        eyebrow="Sub-brand roll-up"
        title="Brand portfolio"
        action={<Link to="/traffic" className="btn btn-ghost"><ArrowUpRight size={13} /> Open Traffic</Link>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        {portfolio.map((p) => {
          const b = brandMeta(p.id);
          return (
            <div key={p.id} className="card card-pad is-hoverable" style={{ position: 'relative', overflow: 'hidden', borderTop: `3px solid ${b.accent}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: 5, background: b.accent, color: ['zeus-the-agency', 'zeus-digital'].includes(p.id) ? '#0a1f4a' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10 }}>{b.short}</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                {isConflictIsolated(p.id as SubsidiaryId) && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 100, background: 'var(--rag-amber-soft)', color: 'var(--rag-amber)', marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Isolated</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span className="tabular" style={{ fontSize: 22, fontWeight: 600 }}>{p.activeIWOs}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>active IWOs</span>
              </div>
              <div className="tabular" style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginBottom: 12 }}>
                {p.billable} billable · {p.sla} SLA risk
              </div>
              <BurnMeter value={p.burn} label="Brand burn" />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 32 }}>
        <div className="card">
          <div className="card-head">
            <h3>Recent IWO activity</h3>
            <span className="sub">Live · in-flight</span>
          </div>
          <div style={{ overflow: 'hidden', borderTop: '1px solid var(--border-subtle)' }}>
            <table className="tbl">
              <thead>
                <tr><th>Code</th><th>Brand</th><th style={{ textAlign: 'right' }}>Burn</th><th>State</th></tr>
              </thead>
              <tbody>
                {iwos.slice(0, 7).map((i) => {
                  const b = brandMeta(i.subsidiaryOrgId);
                  const burn = computeBurnMeter(i);
                  return (
                    <tr key={i.id}>
                      <td className="mono" style={{ fontSize: 12 }}>
                        <Link to={`/delivery/iwo/${i.id}`} className="hover:underline">{i.code}</Link>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: b.accent }} />{b.short}
                        </span>
                      </td>
                      <td className="tabular" style={{ textAlign: 'right', color: burn.pct >= 100 ? 'var(--rag-red)' : burn.pct >= 80 ? 'var(--rag-amber)' : undefined }}>
                        {Math.round(burn.pct)}%
                      </td>
                      <td><Pill tone={stateTone(i.state)}>{i.state.replace(/_/g, ' ')}</Pill></td>
                    </tr>
                  );
                })}
                {iwos.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--fg-tertiary)' }}>No in-flight IWOs.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>Conflict firewall</h3>
              <span className="sub">Named-competitor watch</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {risks.slice(0, 4).map((r) => (
                <Link key={r.id} to="/conflict-firewall/breach-risks" style={{ padding: 12, borderRadius: 8, background: 'var(--rag-amber-soft)', display: 'flex', gap: 10 }}>
                  <Shield size={16} style={{ color: 'var(--rag-amber)', flex: 'none' }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.payload.requestedClientId}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--rag-amber)', marginTop: 2 }}>
                      excluded {r.payload.walledBrandIds.length} brand{r.payload.walledBrandIds.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </Link>
              ))}
              {risks.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', padding: '4px 0' }}>No exclusivity-risk events. Routing walls are holding.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>This week's pulse</h3>
              <span className="sub">Coming soon</span>
            </div>
            <div className="card-body">
              <div style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', lineHeight: 1.5 }}>
                Weekly briefs / ECD approvals / inter-co roll-up will surface here once the
                pulse aggregator (domain-event digest) lands.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBSIDIARY — Today's work (home-brand scoped, rules-safe)
// ---------------------------------------------------------------------------
function SubsidiaryDashboard({ today, brandId }: { today: string; brandId: SubsidiaryId }) {
  const b = brandMeta(brandId);
  const [issued, setIssued] = useState<InternalWorkOrder[]>([]);
  const [active, setActive] = useState<InternalWorkOrder[]>([]);
  const nowMs = useMemo(() => Date.now(), [issued, active]);

  useEffect(() => {
    if (brandId === 'zeus-group') return;
    const unsubs: Array<() => void> = [];
    unsubs.push(subscribeIWOInbox(brandId, setIssued, () => setIssued([])));
    unsubs.push(subscribeIWOActive(brandId, setActive, () => setActive([])));
    return () => unsubs.forEach((u) => u());
  }, [brandId]);

  const budget = active.reduce((s, r) => s + (r.budgetMinor || 0), 0);
  const cost = active.reduce((s, r) => s + (r.cumulativeCostMinor || 0), 0);
  const burn = budget > 0 ? cost / budget : 0;
  const slaAtRisk = active.filter((i) => {
    const x = slaRisk(i, nowMs);
    return x === 'breach' || x === 'warn';
  }).length;
  const isolated = isConflictIsolated(brandId);

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{b.name} · {today}</div>
          <h1 className="display">
            {brandId === 'odd-gorilla' ? 'Hold the line.' : <>Today's <span className="zeus-underline">work</span></>}
          </h1>
          <p style={{ marginTop: 12, color: 'var(--fg-secondary)', fontSize: 14, maxWidth: 520 }}>
            {isolated
              ? 'Conflict-isolated — your clients are not visible to other brands.'
              : 'Work routed to your brand. Accept what’s waiting, then track what’s in flight.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <Link to="/delivery/inbox" className="btn btn-secondary"><Inbox size={13} /> Inbox</Link>
          <Link to="/time" className="btn btn-primary"><Plus size={13} /> Post time</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <KPI label="Awaiting acceptance" value={issued.length} accent={b.accent} />
        <KPI label="In-flight IWOs" value={active.length} accent={b.accent} />
        <KPI label="Brand burn" value={`${Math.round(burn * 100)}%`} deltaDir={burn > 0.8 ? 'down' : 'up'} accent="#2f9d5c" />
        <KPI label="SLA at risk" value={slaAtRisk} deltaDir={slaAtRisk > 0 ? 'down' : 'up'} accent="#e18425" />
      </div>

      <SectionH eyebrow="Inbox" title="Awaiting your acceptance" titleSize={17} />
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>IWO</th><th>Title</th><th style={{ textAlign: 'right' }}>Budget</th><th /></tr>
          </thead>
          <tbody>
            {issued.map((i) => (
              <tr key={i.id} className="brand-edge">
                <td className="mono" style={{ fontSize: 12 }}>{i.code}</td>
                <td>{i.title || '—'}</td>
                <td className="tabular" style={{ textAlign: 'right' }}>{formatMinor(i.budgetMinor, i.currency)}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link to={`/delivery/iwo/${i.id}`} className="btn btn-ghost" style={{ padding: '4px 10px' }}>Open</Link>
                </td>
              </tr>
            ))}
            {issued.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-tertiary)' }}>Nothing waiting on you. Nice.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
