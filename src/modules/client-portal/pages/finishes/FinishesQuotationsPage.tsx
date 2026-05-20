import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import { Btn, Pane, Stat, Chip, Eyebrow, Mono, Card } from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { VELA_PROJECT } from '../../fixtures/projects';
import {
  useFinishesPortalQuotations,
  type QuotationItem,
  type QuotationBucket,
  type PortalQuotationsData,
} from '../../hooks/useFinishesPortalQuotations';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type { DesignProject } from '@/modules/design-manager/types';
import '../../styles/portal.css';

/**
 * Quotations.
 *
 * Mock mode (no `:code`) → wireframe fixtures for /portal/preview.
 * Live mode (with `:code`) → unified list of:
 *   - the base contract (SalesOrder)
 *   - pre-contract quotes (clientQuotes)
 *   - variations (changeOrders)
 * bucketed by status and surfaced through `useFinishesPortalQuotations`.
 */
export default function FinishesQuotationsPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useFinishesPortalQuotations(params.code);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) {
    return <QuotationsView mode="mock" project={VELA_PROJECT} />;
  }

  if (loading || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return <QuotationsView mode="live" project={dataToShellProject(data.project)} data={data} />;
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalQuotationsData;
}

function QuotationsView({ mode, project, data }: ViewProps) {
  const live = mode === 'live' && data;
  const counts = live ? data!.counts : { open: 3, sealed: 11, superseded: 4, draft: 2 };
  const kpis = live ? data!.kpis : null;
  const [bucket, setBucket] = useState<QuotationBucket>(live && counts.open > 0 ? 'open' : 'sealed');

  const bucketItems = useMemo(() => {
    if (!live) return [];
    return data!.items.filter((i) => i.bucket === bucket);
  }, [live, data, bucket]);

  const currency = data?.salesOrder.currency || 'UGX';

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        crumbs={['Finishes', project.name, 'Quotations']}
        title="Quotations"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">Export</Btn>
            <Btn primary sm icon="plus">Request quote</Btn>
          </>
        }
      >
        <PageHead
          eyebrow={live
            ? `${currency} · base contract ${formatBig(data?.salesOrder.originalQuoteAmount)} · ${counts.sealed - 1 > 0 ? `${counts.sealed - 1} variation${counts.sealed - 1 === 1 ? '' : 's'} sealed` : 'no variations yet'}`
            : 'UGX · base contract 2.84Bn · 4 variations sealed'}
          title={live
            ? `${counts.open} open · ${counts.sealed} sealed · ${counts.superseded} superseded`
            : '3 open · 11 sealed · 4 superseded'}
          sub="All pricing locked with vendors for 14 days unless otherwise noted."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat
            label="Sealed value"
            value={live ? formatBig(kpis?.sealedValue) : '2.84Bn'}
            sub={live ? `${currency} · ${counts.sealed} quote${counts.sealed === 1 ? '' : 's'}` : 'UGX · 11 quotes'}
          />
          <Stat
            label="Open value"
            value={live ? formatBig(kpis?.openValue) : '271.5M'}
            sub={live ? `${currency} · ${counts.open} awaiting` : 'UGX · 3 awaiting'}
            signal={live ? (kpis?.openCount ?? 0) > 0 : true}
          />
          <Stat
            label="Avg signoff"
            value="1.4 days"
            sub="Last 30 days"
          />
          <Stat
            label="Variations"
            value={live ? `${(kpis?.variationPct ?? 0) >= 0 ? '+' : ''}${kpis?.variationPct ?? 0}%` : '+12.1%'}
            sub={live ? `${counts.sealed - 1 > 0 ? counts.sealed - 1 : 0} against base` : '4 against base'}
          />
        </div>

        <Tabs
          items={[
            { l: 'Open', c: counts.open, on: bucket === 'open', signal: bucket === 'open' && counts.open > 0 },
            { l: 'Sealed', c: counts.sealed, on: bucket === 'sealed' },
            { l: 'Superseded', c: counts.superseded, on: bucket === 'superseded' },
            { l: 'Drafts', c: counts.draft, on: bucket === 'draft' },
          ]}
          onSelect={(i) => setBucket((['open', 'sealed', 'superseded', 'draft'] as QuotationBucket[])[i])}
        />

        {live ? (
          <Pane
            title={paneTitle(bucket)}
            action={`${bucketItems.length} ${bucketItems.length === 1 ? 'quote' : 'quotes'}`}
            flush
          >
            <LiveTable rows={bucketItems} bucket={bucket} currency={currency} />
          </Pane>
        ) : (
          <>
            <Pane title="Open quotes" action="3 awaiting your signoff" flush>
              <MockOpenTable />
            </Pane>
            <Pane title="Sealed quotes" action="11 quotes · view archive →" flush>
              <MockSealedTable />
            </Pane>
          </>
        )}

        <Pane title="Quote workflow" action="How signoff works →">
          <div className="h-grid cols-4" style={{ gap: 16 }}>
            <Step n={1} title="Issued" sub="Quote ready for review" body="You're notified — email + portal." />
            <Step n={2} title="Review" sub="Open in portal" body="Line items, attachments, variation deltas." />
            <Step n={3} title="Sign" sub="One-click approve" body="Locks pricing for 14 days with vendor." />
            <Step n={4} title="Triggers" sub="POs + payment schedule" body="Sealed quote unlocks procurement." />
          </div>
        </Pane>
      </PortalShell>
    </div>
  );
}

function paneTitle(b: QuotationBucket): string {
  switch (b) {
    case 'open': return 'Open quotes';
    case 'sealed': return 'Sealed quotes';
    case 'superseded': return 'Superseded';
    case 'draft': return 'Drafts';
  }
}

// ── Live table ──────────────────────────────────────────────

function LiveTable({ rows, bucket, currency }: { rows: QuotationItem[]; bucket: QuotationBucket; currency: string }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <Eyebrow>Nothing here</Eyebrow>
        <div className="h-p is-dim" style={{ marginTop: 8, fontSize: 13 }}>
          No quotes in the <strong>{bucket}</strong> bucket for this project.
        </div>
      </div>
    );
  }
  return (
    <Tbl
      cols={[
        { l: 'Quote', w: '2.5fr' },
        { l: 'Phase', w: '1fr' },
        { l: bucket === 'open' ? 'Issued' : 'Sealed', w: '1fr' },
        ...(bucket === 'open' ? [{ l: 'Due', w: '1fr' as const }] : []),
        { l: `Total ${currency}`, w: '140px', a: 'right' },
        { l: 'Status', w: '160px', a: 'right' },
      ]}
      rows={rows.map((r) => {
        const issued = r.issuedAt ? <CellNum>{formatDate(r.issuedAt)}</CellNum> : <CellNum>—</CellNum>;
        const due = r.signpost ? <CellNum>{formatDate(r.signpost)}</CellNum> : <CellNum>—</CellNum>;
        return {
          signal: r.bucket === 'open' && r.signal,
          dim: r.bucket === 'superseded',
          cells: [
            <Cell t={`${r.number} · ${r.title}`} s={r.sub} />,
            r.phase,
            issued,
            ...(bucket === 'open' ? [due] : []),
            <CellNum>{formatNumberPlain(r.total)}</CellNum>,
            r.bucket === 'open'
              ? <Chip signal>{r.statusLabel}</Chip>
              : <Chip>{r.statusLabel}</Chip>,
          ],
        };
      })}
    />
  );
}

// ── Mock tables (wireframe fixtures) ────────────────────────

function MockOpenTable() {
  return (
    <Tbl
      cols={[
        { l: 'Quote', w: '2.5fr' },
        { l: 'Phase', w: '1fr' },
        { l: 'Issued', w: '1fr' },
        { l: 'Due', w: '1fr' },
        { l: 'Total UGX', w: '140px', a: 'right' },
        { l: 'Status', w: '140px', a: 'right' },
      ]}
      rows={[
        { signal: true, cells: [<Cell t="Q-019 v2 · Stone variation" s="Calacatta upgrade to 20mm" />, 'Construction', <CellNum>9 May</CellNum>, <CellNum>16 May</CellNum>, <CellNum>184,250</CellNum>, <Chip signal>Awaiting you</Chip>] },
        { signal: true, cells: [<Cell t="Q-021 · Lighting top-up" s="12 fittings · zone C" />, 'Construction', <CellNum>11 May</CellNum>, <CellNum>22 May</CellNum>, <CellNum>64,800</CellNum>, <Chip signal>Awaiting you</Chip>] },
        { signal: true, cells: [<Cell t="Q-022 · Glazing film" s="Storefront privacy · 24 m²" />, 'Snagging', <CellNum>12 May</CellNum>, <CellNum>24 May</CellNum>, <CellNum>22,400</CellNum>, <Chip signal>Awaiting you</Chip>] },
      ]}
    />
  );
}

function MockSealedTable() {
  return (
    <Tbl
      cols={[
        { l: 'Quote', w: '2.5fr' },
        { l: 'Phase', w: '1fr' },
        { l: 'Sealed', w: '1fr' },
        { l: 'Total UGX', w: '140px', a: 'right' },
        { l: 'Status', w: '140px', a: 'right' },
      ]}
      rows={[
        { cells: [<Cell t="Q-018 · Joinery package" s="Falcon · sealed Rev D" />, 'Construction', <CellNum>2 May</CellNum>, <CellNum>682,400</CellNum>, <Chip>Sealed</Chip>] },
        { cells: [<Cell t="Q-017 · MEP package" s="Mechanical + electrical" />, 'Construction', <CellNum>28 Apr</CellNum>, <CellNum>412,000</CellNum>, <Chip>Sealed</Chip>] },
        { cells: [<Cell t="Q-016 · Stone package v1" s="Calacatta · superseded by Q-019" />, 'Procurement', <CellNum>2 May</CellNum>, <CellNum>141,500</CellNum>, <Chip>Superseded</Chip>] },
        { cells: [<Cell t="Q-015 · Lighting fixtures" s="Vibia track + spots" />, 'Procurement', <CellNum>14 Apr</CellNum>, <CellNum>284,500</CellNum>, <Chip>Sealed</Chip>] },
        { cells: [<Cell t="Q-014 · Veneer package" s="Walnut · 124 m²" />, 'Procurement', <CellNum>11 Apr</CellNum>, <CellNum>96,800</CellNum>, <Chip>Sealed</Chip>] },
        { dim: true, cells: [<Cell t="Q-013 · Demolition" s="Site setup · zones A,B" />, 'Mobilisation', <CellNum>20 Mar</CellNum>, <CellNum>52,400</CellNum>, <Chip>Sealed</Chip>] },
        { dim: true, cells: [<Cell t="Q-012 · Hardware pack" s="Handles · hinges · slides" />, 'Procurement', <CellNum>18 Mar</CellNum>, <CellNum>38,200</CellNum>, <Chip>Sealed</Chip>] },
        { dim: true, cells: [<Cell t="Q-011 · Site protection" s="Floor + wall protection" />, 'Mobilisation', <CellNum>10 Mar</CellNum>, <CellNum>22,800</CellNum>, <Chip>Sealed</Chip>] },
      ]}
    />
  );
}

function Step({ n, title, sub, body }: { n: number; title: string; sub: string; body: string }) {
  return (
    <div style={{
      padding: 18,
      border: '1px solid var(--line)',
      borderRadius: 12,
      background: 'var(--paper)',
    }}>
      <Mono style={{ color: 'var(--ink-3)' }}>STEP {n}</Mono>
      <div style={{ font: '600 16px/1.2 var(--font-display)', marginTop: 8, letterSpacing: '-0.02em' }}>
        {title}
      </div>
      <Eyebrow style={{ marginTop: 4, fontSize: 10 }}>{sub}</Eyebrow>
      <div className="h-p is-dim" style={{ fontSize: 12.5, marginTop: 8 }}>{body}</div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function dataToShellProject(p: DesignProject): PortalProject {
  return {
    name: p.name,
    tag: p.code,
    sub: p.customerName,
    slug: p.code,
    line: 'finishes',
  };
}

function formatBig(amount: number | undefined | null): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}Bn`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
}

function formatNumberPlain(n: number): string {
  return n.toLocaleString('en-US');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Loading / error states ──────────────────────────────────

function LoadingState({ project }: { project: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Loading…', tag: project, sub: '', line: 'finishes' }}
        title="Quotations"
        dataMode="live"
      >
        <Card>
          <Eyebrow>Loading quotations…</Eyebrow>
          <div className="h-p is-dim" style={{ fontSize: 13 }}>Resolving {project}</div>
        </Card>
      </PortalShell>
    </div>
  );
}

function ErrorState({ project, message }: { project: string; message: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Project', tag: project, sub: '', line: 'finishes' }}
        title="Quotations"
        dataMode="live"
      >
        <Card>
          <Eyebrow signal>Couldn't load — {message}</Eyebrow>
          <Mono>1. The project code <strong>{project}</strong> doesn't exist.</Mono>
          <Mono>2. You don't have portal access to it yet — your project director can grant access.</Mono>
          <Mono>3. No sales order has been raised for this project yet.</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}
