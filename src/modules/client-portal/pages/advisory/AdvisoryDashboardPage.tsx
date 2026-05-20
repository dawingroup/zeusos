import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Card, Pane, Stat, Sep, BarLine, SignalLine, Row, Eyebrow, Mono,
} from '../../components/primitives';
import { Tbl, Cell, CellNum } from '../../components/Table';
import { Icon } from '../../components/Icon';
import { NAQAA_PROJECT } from '../../fixtures/projects';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  useAdvisoryPortalProgramme,
  type PortalAdvisoryData,
} from '../../hooks/useAdvisoryPortalProgramme';
import type {
  DesignProject,
  ProgrammeStore,
} from '@/modules/design-manager/types';
import '../../styles/portal.css';

/**
 * Advisory dashboard. Mock mode renders the wireframe fixtures
 * (Naqaa Retail Rollout 2026 sample data). Live mode looks up the
 * project by code and reads its `programme` + `programmeStores`
 * fields — the same DesignProject path the Finishes line uses, just
 * with `subsidiaryId === 'advisory'`.
 */
export default function AdvisoryDashboardPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useAdvisoryPortalProgramme(params.code);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) return <AdvisoryDashboardView mode="mock" project={NAQAA_PROJECT} />;
  if (loading || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return <AdvisoryDashboardView mode="live" project={dataToShellProject(data.project)} data={data} />;
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalAdvisoryData;
}

function AdvisoryDashboardView({ mode, project, data }: ViewProps) {
  const live = mode === 'live' && data;
  const p = live ? data!.programme : null;
  const stores = live ? data!.stores : [];
  const dueLabel = live && data!.openApprovalDueDate
    ? data!.openApprovalDueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '16 May';

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        crumbs={['Advisory', project.name, 'Dashboard']}
        title="Programme dashboard"
        actions={
          <>
            <Btn sm icon="download">Monthly pack</Btn>
            <Btn signal sm iconRight="arrow-r">
              {live ? 'Review 1 approval' : 'Review 1 approval'}
            </Btn>
          </>
        }
      >
        <PageHead
          eyebrow={live ? p!.phaseLabel : 'Phase 2 of 5 · Implementation'}
          title={live ? project.name : 'Naqaa Retail Rollout 2026'}
          sub={live ? subline(p!, stores) : '14 stores across KSA + UAE · UGX 45.9Bn programme · 3 stores live · BOQ pack v3 ready for signoff'}
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat
            label="Programme progress"
            value={live ? `${p!.progress}%` : '28%'}
            sub={live ? p!.phaseLabel.split('·')[1]?.trim() || 'Phase 2' : 'Phase 2 · weeks 9–18'}
          />
          <Stat
            label="Stores live"
            value={live ? `${p!.storesLive} of ${p!.storesTotal}` : '3 of 14'}
            sub={live ? `${p!.storesInFitOut} in fit-out · ${Math.max(0, p!.storesTotal - p!.storesLive - p!.storesInFitOut)} pending` : '2 in fit-out · 9 pending'}
          />
          <Stat
            label="Committed capex"
            value={live ? formatCurrency(p!.committedCapex, p!.currency) : 'UGX 17.8Bn'}
            sub={live ? `${pct(p!.committedCapex, p!.totalValue)}% of ${formatCurrency(p!.totalValue, p!.currency)}` : '39% of UGX 45.9Bn'}
          />
          <Stat
            label="Open approvals"
            value="1"
            sub={live && p!.openApproval ? `${p!.openApproval.label} · due ${dueLabel}` : 'BOQ pack v3 · due 16 May'}
            signal
          />
        </div>

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card signal style={{ padding: 22, justifyContent: 'space-between' }}>
            <div>
              <SignalLine>
                {live && p!.openApproval ? `${p!.openApproval.label} ready for signoff` : 'BOQ pack v3 ready for signoff'}
              </SignalLine>
              <div className="h-d3" style={{ fontSize: 26, marginTop: 10 }}>
                {live && p!.openApproval ? p!.openApproval.sub : 'Naqaa-08 Riyadh · Naqaa-09 Jeddah'}
              </div>
              <div className="h-p is-dim" style={{ marginTop: 8, fontSize: 13 }}>
                Two store packs — combined contract value{' '}
                <strong style={{ color: 'var(--ink)' }}>
                  {live && p!.openApproval
                    ? formatCurrency(p!.openApproval.value, p!.currency)
                    : 'UGX 6.81Bn'}
                </strong>. Pricing locked with vendors for 14 days.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn signal iconRight="arrow-r">Open BOQ pack v3</Btn>
              <Btn>Schedule review call</Btn>
            </div>
          </Card>

          <Pane title="Stores · status snapshot" action={live ? `All ${p!.storesTotal} stores →` : 'All 14 stores →'} flush>
            {live ? <LiveStoresTable stores={stores} /> : <MockStoresTable />}
          </Pane>
        </div>

        <div className="h-grid cols-2" style={{ gap: 16 }}>
          <Pane title="Programme cost · committed vs forecast">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div className="h-eyebrow">Committed capex</div>
                <div className="h-bignum" style={{ fontSize: 42 }}>
                  {live ? formatCurrency(p!.committedCapex, p!.currency) : 'UGX 17.8Bn'}
                </div>
                <div className="h-mono">
                  {live
                    ? `of ${formatCurrency(p!.totalValue, p!.currency)} · ${pct(p!.committedCapex, p!.totalValue)}%`
                    : 'of UGX 45.9Bn · 39%'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="h-eyebrow">Forecast at completion</div>
                <div className="h-bignum-sm" style={{ marginTop: 6 }}>
                  {live && p!.forecastAtCompletion
                    ? formatCurrency(p!.forecastAtCompletion, p!.currency)
                    : 'UGX 45.6Bn'}
                </div>
                <div className="h-mono" style={{ color: 'var(--ink-2)' }}>
                  {live && p!.forecastAtCompletion
                    ? `${pctDelta(p!.forecastAtCompletion, p!.totalValue)} vs baseline`
                    : '−0.7% vs baseline'}
                </div>
              </div>
            </div>
            <Sep />
            {live && p!.phases ? (
              p!.phases.map((ph, i) => (
                <BarLine key={i} label={ph.label} right={`${ph.progress}%`} pct={ph.progress} />
              ))
            ) : (
              <>
                <BarLine label="Phase 1 · Design" right="100%" pct={100} />
                <BarLine label="Phase 2 · Implementation · 5 stores" right="58%" pct={58} />
                <BarLine label="Phase 3 · Rollout · 9 stores" right="12%" pct={12} />
                <BarLine label="Phase 4 · Operations handover" right="0%" pct={0} />
              </>
            )}
          </Pane>

          <Pane title="Matflow · procurement live" action="Open Matflow ↗">
            <div className="h-grid cols-2" style={{ gap: 10 }}>
              <Stat
                label="Open POs"
                value={String(live && p!.procurement ? p!.procurement.openPOs : 22)}
                sub="across 14 stores"
              />
              <Stat
                label="Pending RFQs"
                value={String(live && p!.procurement ? p!.procurement.pendingRFQs : 6)}
                sub="vendor responses due"
              />
              <Stat
                label="Cost variance"
                value={live && p!.procurement ? `${p!.procurement.costVariancePct >= 0 ? '+' : ''}${p!.procurement.costVariancePct}%` : '−0.8%'}
                sub="vs BOQ baseline"
              />
              <Stat
                label="Vetted vendors"
                value={String(live && p!.procurement ? p!.procurement.vettedVendors : 22)}
                sub="12-mo cycle"
              />
            </div>
            <Sep />
            <Row title="PO tracker" sub="22 open · 48 received programme to date" right={<Icon name="arrow-tr" size={14} color="var(--ink-2)" />} />
            <Row title="Cost variance dashboard" sub="vs. BOQ baseline" right={<Icon name="arrow-tr" size={14} color="var(--ink-2)" />} />
            <Row title="Supplier directory" sub="22 active · 8 in onboarding" right={<Icon name="arrow-tr" size={14} color="var(--ink-2)" />} />
          </Pane>
        </div>
      </PortalShell>
    </div>
  );
}

// ── Live sub-views ──────────────────────────────────────────

function LiveStoresTable({ stores }: { stores: ProgrammeStore[] }) {
  if (stores.length === 0) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <Eyebrow>No stores</Eyebrow>
        <Mono style={{ marginTop: 8, display: 'block' }}>This programme has no stores configured yet.</Mono>
      </div>
    );
  }
  return (
    <Tbl
      cols={[
        { l: 'Store', w: '2fr' },
        { l: 'Region', w: '90px' },
        { l: 'Phase', w: '1.2fr' },
        { l: 'BOQ', w: '90px', a: 'right' },
        { l: 'Open date', w: '110px', a: 'right' },
      ]}
      rows={stores.map((s) => ({
        signal: s.signal,
        dim: s.dim,
        cells: [
          <Cell t={`${s.code} · ${s.name}`} s={s.format} />,
          s.region,
          s.phaseStatus === 'Live'
            ? <span className="h-num" style={{ color: 'var(--ink)' }}>Live</span>
            : s.phaseStatus === 'Schematic'
              ? <span className="h-mono">Schematic</span>
              : s.phaseStatus,
          <CellNum>{s.boqStatus}</CellNum>,
          <CellNum>{s.openDateLabel ?? '—'}</CellNum>,
        ],
      }))}
    />
  );
}

// ── Mock sub-views ──────────────────────────────────────────

function MockStoresTable() {
  return (
    <Tbl
      cols={[
        { l: 'Store', w: '2fr' },
        { l: 'Region', w: '90px' },
        { l: 'Phase', w: '1.2fr' },
        { l: 'BOQ', w: '90px', a: 'right' },
        { l: 'Open date', w: '110px', a: 'right' },
      ]}
      rows={[
        { cells: [<Cell t="Naqaa-01 · Dubai Mall" s="Flagship · 312 m²" />, 'UAE', <span className="h-num" style={{ color: 'var(--ink)' }}>Live</span>, <CellNum>v4 sealed</CellNum>, <CellNum>14 Feb</CellNum>] },
        { cells: [<Cell t="Naqaa-02 · Mall of Emirates" s="Standard · 224 m²" />, 'UAE', <span className="h-num" style={{ color: 'var(--ink)' }}>Live</span>, <CellNum>v3 sealed</CellNum>, <CellNum>28 Mar</CellNum>] },
        { cells: [<Cell t="Naqaa-03 · Riyadh Park" s="Standard · 240 m²" />, 'KSA', <span className="h-num" style={{ color: 'var(--ink)' }}>Live</span>, <CellNum>v3 sealed</CellNum>, <CellNum>22 Apr</CellNum>] },
        { cells: [<Cell t="Naqaa-04 · The Avenues" s="Standard · 198 m²" />, 'KSA', 'Fit-out · Wk 6', <CellNum>v3 sealed</CellNum>, <CellNum>4 Jun</CellNum>] },
        { cells: [<Cell t="Naqaa-05 · Yas Mall" s="Standard · 264 m²" />, 'UAE', 'Fit-out · Wk 2', <CellNum>v3 sealed</CellNum>, <CellNum>22 Jun</CellNum>] },
        { signal: true, cells: [<Cell t="Naqaa-08 · Riyadh Front" s="Flagship · 380 m²" />, 'KSA', 'BOQ approval', <CellNum>v3 review</CellNum>, <CellNum>14 Aug</CellNum>] },
        { signal: true, cells: [<Cell t="Naqaa-09 · Red Sea Mall" s="Standard · 218 m²" />, 'KSA', 'BOQ approval', <CellNum>v3 review</CellNum>, <CellNum>28 Aug</CellNum>] },
        { dim: true, cells: [<Cell t="Naqaa-10 to 14 · pending design" s="5 stores" />, 'Mixed', <span className="h-mono">Schematic</span>, <CellNum>—</CellNum>, <CellNum>Q4 26</CellNum>] },
      ]}
    />
  );
}

// ── Helpers ─────────────────────────────────────────────────

function dataToShellProject(p: DesignProject): PortalProject {
  return {
    name: p.name,
    tag: p.code,
    sub: p.customerName,
    slug: p.code,
    line: 'advisory',
  };
}

function subline(p: import('@/modules/design-manager/types').ProjectProgramme, stores: ProgrammeStore[]): string {
  const bits: string[] = [];
  bits.push(`${p.storesTotal} stores`);
  if (stores.length > 0) {
    const regions = Array.from(new Set(stores.map((s) => s.region).filter((r) => r && r !== 'Mixed')));
    if (regions.length > 0) bits.push(`across ${regions.join(' + ')}`);
  }
  bits.push(`${formatCurrency(p.totalValue, p.currency)} programme`);
  bits.push(`${p.storesLive} stores live`);
  if (p.openApproval) bits.push(`${p.openApproval.label} ready for signoff`);
  return bits.join(' · ');
}

function formatCurrency(amount: number, currency: string): string {
  if (amount >= 1_000_000_000) return `${currency} ${(amount / 1_000_000_000).toFixed(2)}Bn`;
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(0)}K`;
  return `${currency} ${amount.toFixed(0)}`;
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function pctDelta(actual: number, baseline: number): string {
  if (!baseline) return '—';
  const delta = ((actual - baseline) / baseline) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

// ── Loading / error states ──────────────────────────────────

function LoadingState({ project }: { project: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Loading…', tag: project, sub: '', line: 'advisory' }}
        title="Programme dashboard"
        dataMode="live"
      >
        <Card>
          <Eyebrow>Loading programme…</Eyebrow>
          <Mono>Resolving {project}</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}

function ErrorState({ project, message }: { project: string; message: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Project', tag: project, sub: '', line: 'advisory' }}
        title="Programme dashboard"
        dataMode="live"
      >
        <Card>
          <Eyebrow signal>Couldn't load — {message}</Eyebrow>
          <Mono>1. The programme code <strong>{project}</strong> doesn't exist.</Mono>
          <Mono>2. You don't have portal access to it yet — your project director can grant access.</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}
