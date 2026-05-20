import { useParams, useNavigate } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Card, Pane, Stat, Sep, BarLine, Img, SignalLine, Eyebrow, Mono,
} from '../../components/primitives';
import { Tbl, Cell, CellNum } from '../../components/Table';
import { VELA_PROJECT } from '../../fixtures/projects';
import { useFinishesPortalProject, type PortalDashboardData } from '../../hooks/useFinishesPortalProject';
import type { DesignProject, ProjectMilestone, ProjectSitePhoto } from '@/modules/design-manager/types';
import type { SalesOrder } from '@/modules/sales-orders/types';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useEffect } from 'react';
import { tsToDate } from '../../utils/dates';
import '../../styles/portal.css';

/**
 * Finishes Dashboard.
 *
 * Two modes:
 *   1. **Live** (default, when a `:code` URL param resolves to a real
 *      DesignProject) — pulls data through `useFinishesPortalProject`.
 *   2. **Mock** (when rendered without a route param, e.g. inside the
 *      `/portal/preview` design canvas) — falls back to the wireframe
 *      fixtures so the design canvas still renders the demo content.
 */
export default function FinishesDashboardPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useFinishesPortalProject(params.code);

  // Bounce to sign-in if not authed when visiting a real-project URL.
  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  // No code → rendering inside the design canvas. Use mock fixtures so the
  // preview page still works as a visual showcase.
  if (!params.code) {
    return <DashboardView mode="mock" project={VELA_PROJECT} />;
  }

  if (loading || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return <DashboardView mode="live" project={dataToShellProject(data.project)} data={data} />;
}

// ── View ────────────────────────────────────────────────────

interface DashboardViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalDashboardData;
}

function DashboardView({ mode, project, data }: DashboardViewProps) {
  const live = mode === 'live' && data;
  const dp = data?.project;
  const so = data?.salesOrder;
  const openApprovals = data?.openApprovals ?? { signOffCount: 0, changeOrderCount: 0, nextDue: null };
  const totalOpen = openApprovals.signOffCount + openApprovals.changeOrderCount;

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        badges={live ? { approvals: totalOpen || undefined } : undefined}
        crumbs={['Finishes', project.name, 'Dashboard']}
        title="Dashboard"
        actions={
          <>
            <Btn icon="download" sm>Weekly report</Btn>
            {totalOpen > 0 ? (
              <Btn signal sm iconRight="arrow-r">Review {totalOpen} approval{totalOpen === 1 ? '' : 's'}</Btn>
            ) : null}
          </>
        }
      >
        <PageHead
          eyebrow={live ? phaseLabel(dp) : 'Week 14 of 22 · On schedule'}
          title={project.name}
          sub={live ? subtitleForProject(dp, so) : 'Fit-out · 412 m² · contract value UGX 2.84Bn · handover 11 Jul 2026'}
        >
          <Btn ghost icon="expand">Export</Btn>
          <Btn icon="paperclip" sm>Pin to top</Btn>
        </PageHead>

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          {totalOpen > 0 ? (
            <Card signal style={{ padding: 22, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SignalLine>
                  {totalOpen} item{totalOpen === 1 ? '' : 's'} need{totalOpen === 1 ? 's' : ''} your signoff
                </SignalLine>
                <div className="h-d3" style={{ fontSize: 26 }}>
                  {live
                    ? signoffSummary(openApprovals)
                    : 'Q-019 v2 · SD-104 Rev C · Lighting finish'}
                </div>
                <div className="h-p is-dim" style={{ fontSize: 13 }}>
                  {live
                    ? nextDueSummary(openApprovals.nextDue)
                    : 'Average response time on this project: 1.4 days. Open approvals are gating joinery install on 22 May.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Btn signal iconRight="arrow-r">Review approvals</Btn>
                <Btn>Snooze to tomorrow</Btn>
              </div>
            </Card>
          ) : (
            <Card style={{ padding: 22, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Eyebrow>All caught up</Eyebrow>
                <div className="h-d3" style={{ fontSize: 26 }}>Nothing waiting for your signoff.</div>
                <div className="h-p is-dim" style={{ fontSize: 13 }}>
                  Your project team will let you know when something needs review.
                </div>
              </div>
            </Card>
          )}

          <div className="h-grid cols-2" style={{ gap: 12 }}>
            <Stat label="Overall progress" value={live ? `${dp?.physicalProgress ?? 0}%` : '62%'} sub={live ? progressSub(dp) : 'Wk 14 of 22 · 0d variance'} trail={live ? undefined : '↗ +6 wk'} />
            <Stat label="Contract value" value={live ? formatBigUGX(so?.currentAmount) : '2.84Bn'} sub={live ? contractSub(so) : 'UGX · ≈ USD 773K'} />
            <Stat
              label="Paid to date"
              value={live ? `${paidPct(so)}%` : '51%'}
              sub={live ? paidSub(so) : 'UGX 1.45Bn of 2.84Bn'}
              sparkline={live ? buildPaidSeries(so) : [0, 568, 568, 994, 1846]}
            />
            <Stat label="Open approvals" value={live ? totalOpen : 3} sub={live ? approvalSub(openApprovals) : '0 overdue · avg 1.4d'} signal={totalOpen > 0} />
          </div>
        </div>

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Pane title="Phase progress" action="Schedule →">
            {live ? <LivePhaseList project={dp} /> : <MockPhaseList />}
            <Sep />
            <div className="h-grid cols-3" style={{ gap: 16 }}>
              <DateBlock label="Baseline" date={live ? tsToDate(dp?.baselineDate) ?? tsToDate(dp?.startDate) : new Date('2026-02-04')} />
              <DateBlock label="Handover" date={live ? tsToDate(dp?.dueDate) : new Date('2026-07-11')} />
              <div>
                <Eyebrow style={{ fontSize: 9.5 }}>Variance</Eyebrow>
                <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 6 }}>
                  {live ? '— ' : '+0 days'}
                </div>
              </div>
            </div>
          </Pane>

          <Pane title="Up next · 4 weeks" action="Full schedule →" flush>
            {live ? <LiveMilestones rows={data!.nextMilestones} /> : <MockMilestones />}
          </Pane>
        </div>

        <div className="h-grid cols-2" style={{ gap: 16 }}>
          <Pane title="Financials" action="View all →">
            <div className="h-grid cols-3" style={{ gap: 10 }}>
              <Stat label="Invoiced" value={live ? formatBigUGX(invoicedAmount(so)) : '1.76M'} sub={live ? undefined : 'UGX · 62%'} />
              <Stat label="Paid" value={live ? formatBigUGX(so?.totalPaid) : '1.45M'} sub={live ? `${paidPct(so)}%` : 'UGX · 51%'} />
              <Stat label="Open" value={live ? formatBigUGX(so?.balanceRemaining) : '312K'} sub={live ? 'Outstanding' : 'Due 22 May'} signal />
            </div>
            <Sep />
            <BarLine label="Payment progress" right={live ? `${paidPct(so)}% of ${formatBigUGX(so?.currentAmount)}` : '51% of UGX 2.84Bn'} pct={paidPct(so) || 51} />
          </Pane>

          <Pane title="Latest from site" action="All photos →" flush>
            <LiveOrMockGallery photos={live ? dp?.sitePhotos : undefined} />
          </Pane>
        </div>
      </PortalShell>
    </div>
  );
}

// ── Live / data adapters ────────────────────────────────────

function dataToShellProject(p: DesignProject): PortalProject {
  return {
    name: p.name,
    tag: p.code,
    sub: p.customerName,
    slug: p.code,
    line: 'finishes',
  };
}

function phaseLabel(p: DesignProject | undefined): string {
  if (!p) return '';
  const pct = p.physicalProgress;
  if (pct == null) return p.status === 'completed' ? 'Completed' : 'In progress';
  if (pct >= 95) return 'Handover · final inspection';
  if (pct >= 60) return 'Construction · on site';
  if (pct >= 30) return 'Procurement · ordering';
  return 'Design · planning';
}

function subtitleForProject(p: DesignProject | undefined, so: SalesOrder | null | undefined): string {
  if (!p) return '';
  const parts: string[] = [];
  parts.push(p.customerName);
  if (so) parts.push(`contract ${formatBigUGX(so.currentAmount)} ${so.currency}`);
  const due = p.dueDate?.toDate?.();
  if (due) parts.push(`handover ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);
  return parts.join(' · ');
}

function signoffSummary(a: { signOffCount: number; changeOrderCount: number }): string {
  const bits: string[] = [];
  if (a.signOffCount > 0) bits.push(`${a.signOffCount} design signoff${a.signOffCount === 1 ? '' : 's'}`);
  if (a.changeOrderCount > 0) bits.push(`${a.changeOrderCount} change order${a.changeOrderCount === 1 ? '' : 's'}`);
  return bits.join(' · ') || 'Awaiting your review';
}

function nextDueSummary(date: Date | null): string {
  if (!date) return 'Your team will be notified when you sign.';
  return `Next due ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`;
}

function progressSub(p: DesignProject | undefined): string {
  if (!p) return '';
  const since = p.startDate?.toDate?.();
  if (!since) return '';
  const weeks = Math.max(1, Math.round((Date.now() - since.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  return `Week ${weeks} · started ${since.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
}

function contractSub(so: SalesOrder | null | undefined): string {
  if (!so) return '';
  return `${so.currency} · ${so.totalChangeOrderValue ? `${so.totalChangeOrderValue >= 0 ? '+' : ''}${formatBigUGX(so.totalChangeOrderValue)} in variations` : 'base contract'}`;
}

/**
 * Cumulative paid total across the SO's payment receipts. Same shape
 * as the Financials hook so the dashboard KPI sparkline matches.
 */
function buildPaidSeries(so: SalesOrder | null | undefined): number[] {
  if (!so?.payments?.length) return [];
  const sorted = so.payments.slice().sort((a, b) => {
    const aMs = a.paymentDate?.toMillis?.() ?? 0;
    const bMs = b.paymentDate?.toMillis?.() ?? 0;
    return aMs - bMs;
  });
  const series: number[] = [0];
  let running = 0;
  for (const p of sorted) {
    running += p.amount || 0;
    series.push(running);
  }
  return series;
}

function paidPct(so: SalesOrder | null | undefined): number {
  if (!so || !so.currentAmount) return 0;
  return Math.round((so.totalPaid / so.currentAmount) * 100);
}

function paidSub(so: SalesOrder | null | undefined): string {
  if (!so) return '';
  return `${formatBigUGX(so.totalPaid)} of ${formatBigUGX(so.currentAmount)}`;
}

function approvalSub(a: { signOffCount: number; changeOrderCount: number; nextDue: Date | null }): string {
  const next = a.nextDue ? a.nextDue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  if (a.signOffCount + a.changeOrderCount === 0) return 'Nothing pending';
  return next ? `Next due ${next}` : 'Awaiting review';
}

function invoicedAmount(so: SalesOrder | null | undefined): number {
  if (!so) return 0;
  // Approximation until invoice records are first-class; use totalPaid + balanceRemaining
  return (so.totalPaid ?? 0) + (so.balanceRemaining ?? 0);
}

function formatBigUGX(amount: number | undefined | null): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}Bn`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toString();
}

// ── Sub-views ───────────────────────────────────────────────

function LivePhaseList({ project }: { project: DesignProject | undefined }) {
  const pc = project?.phaseCompletion ?? {};
  return (
    <>
      <BarLine label="Design" right={pctOrStatus(pc.design)} pct={pc.design ?? 0} />
      <BarLine label="Procurement" right={pctOrStatus(pc.procurement)} pct={pc.procurement ?? 0} />
      <BarLine label="Construction" right={pctOrStatus(pc.construction)} pct={pc.construction ?? 0} />
      <BarLine label="Snagging & handover" right={pctOrStatus(pc.snagging)} pct={pc.snagging ?? 0} />
    </>
  );
}

function pctOrStatus(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 100) return 'Sealed';
  if (n === 0) return 'Pending';
  return `${n}%`;
}

function MockPhaseList() {
  return (
    <>
      <BarLine label="Design" right="Sealed" pct={100} />
      <BarLine label="Procurement" right="94%" pct={94} />
      <BarLine label="Construction" right="58%" pct={58} />
      <BarLine label="Snagging & handover" right="Wk 21 →" pct={0} />
    </>
  );
}

function DateBlock({ label, date }: { label: string; date: Date | undefined }) {
  const value = date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  return (
    <div>
      <Eyebrow style={{ fontSize: 9.5 }}>{label}</Eyebrow>
      <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 6 }}>{value}</div>
    </div>
  );
}

function LiveMilestones({ rows }: { rows: ProjectMilestone[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px 24px' }}>
        <Eyebrow>No milestones scheduled</Eyebrow>
        <div className="h-p is-dim" style={{ marginTop: 8, fontSize: 13 }}>
          Your project team will add milestones as the programme firms up.
        </div>
      </div>
    );
  }
  return (
    <Tbl
      cols={[
        { l: 'Milestone', w: '2fr' },
        { l: 'Owner', w: '1fr' },
        { l: 'Date', w: '1fr', a: 'right' },
        { l: 'Wk', w: '70px', a: 'right' },
      ]}
      rows={rows.map((m) => ({
        cells: [
          <Cell t={m.label} s={m.detail ?? m.category} />,
          m.owner ?? '—',
          <CellNum>{(() => {
            const d = tsToDate(m.date);
            return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
          })()}</CellNum>,
          <CellNum>{m.weekLabel ?? '—'}</CellNum>,
        ],
      }))}
    />
  );
}

function MockMilestones() {
  return (
    <Tbl
      cols={[
        { l: 'Milestone', w: '2fr' },
        { l: 'Owner', w: '1fr' },
        { l: 'Date', w: '1fr', a: 'right' },
        { l: 'Wk', w: '70px', a: 'right' },
      ]}
      rows={[
        { cells: [<Cell t="Joinery install starts" s="4 days on site · zone A,B" />, 'Falcon Joinery', <CellNum>22 May</CellNum>, <CellNum>Wk 15</CellNum>] },
        { cells: [<Cell t="Stone arrival on site" s="Calacatta 18.4 m² · IT" />, 'Marmi Bruno', <CellNum>26 May</CellNum>, <CellNum>Wk 15</CellNum>] },
        { cells: [<Cell t="MEP first fix complete" s="Inspection scheduled" />, 'Contractor', <CellNum>2 Jun</CellNum>, <CellNum>Wk 17</CellNum>] },
        { cells: [<Cell t="Lighting commissioning" s="Vibia on site 4 days" />, 'Vibia ES', <CellNum>8 Jun</CellNum>, <CellNum>Wk 18</CellNum>] },
        { dim: true, cells: [<Cell t="Finishes touch-up" s="Walk-through" />, 'Contractor', <CellNum>11 Jun</CellNum>, <CellNum>Wk 19</CellNum>] },
      ]}
    />
  );
}

function LiveOrMockGallery({ photos }: { photos?: ProjectSitePhoto[] | undefined }) {
  const slots: ProjectSitePhoto[] = photos && photos.length > 0
    ? photos.slice(0, 8)
    : [
      { id: '1', label: 'Zone A', tone: 'site' },
      { id: '2', label: 'Zone B', tone: 'interior-warm' },
      { id: '3', label: 'Zone C', tone: 'fabric' },
      { id: '4', label: 'Storefront', tone: 'light' },
      { id: '5', label: 'Joinery', tone: 'render' },
      { id: '6', label: 'Stone', tone: 'interior' },
      { id: '7', label: 'MEP', tone: 'site' },
      { id: '8', label: 'Plinths', tone: 'render-2' },
    ];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 1,
      background: 'var(--line-2)',
    }}>
      {slots.map((s) => (
        <Img key={s.id} tone={s.tone ?? 'site'} h={110} label={s.label} src={s.url} />
      ))}
    </div>
  );
}

// ── Loading / error states ──────────────────────────────────

function LoadingState({ project }: { project: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Loading…', tag: project, sub: '', line: 'finishes' }}
        title="Dashboard"
        dataMode="live"
      >
        <PageHead title="Loading project…" sub={`Resolving ${project}`} />
      </PortalShell>
    </div>
  );
}

function ErrorState({ project, message }: { project: string; message: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Project', tag: project, sub: '', line: 'finishes' }}
        title="Dashboard"
        dataMode="live"
      >
        <PageHead eyebrow="Couldn't load" title="Something went wrong" sub={message} />
        <Card>
          <Eyebrow signal>Possible causes</Eyebrow>
          <Mono>1. The project code <strong>{project}</strong> doesn't exist.</Mono>
          <Mono>2. You don't have portal access to it yet — your project director can grant access.</Mono>
          <Mono>3. The project was renamed or archived.</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}
