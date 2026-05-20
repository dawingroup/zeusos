import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Card, Pane, Stat, Sep, SignalLine, Chip, Eyebrow, Mono,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { VELA_PROJECT } from '../../fixtures/projects';
import { useFinishesPortalFinancials, type PortalFinancialsData, type PaymentScheduleEntry, type InvoiceRow } from '../../hooks/useFinishesPortalFinancials';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type { DesignProject } from '@/modules/design-manager/types';
import type { SalesOrder } from '@/modules/sales-orders/types';
import '../../styles/portal.css';

/**
 * Finishes Financials. Same mock/live split as the Dashboard: no
 * `:code` URL param → wireframe fixtures (used by `/portal/preview`);
 * with `:code` → load through `useFinishesPortalFinancials`.
 */
export default function FinishesFinancialsPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useFinishesPortalFinancials(params.code);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) {
    return <FinancialsView mode="mock" project={VELA_PROJECT} />;
  }

  if (loading || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return <FinancialsView mode="live" project={dataToShellProject(data.project)} data={data} />;
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalFinancialsData;
}

function FinancialsView({ mode, project, data }: ViewProps) {
  const live = mode === 'live' && data;
  const so = data?.salesOrder;
  const schedule = data?.schedule ?? [];
  const invoices = data?.invoices ?? [];
  const openMs = data?.openMilestone;
  const paidSeries = data?.paidSeries ?? [];

  const currency = so?.currency || 'UGX';
  const fmt = (n: number | undefined | null) => formatBig(n, currency);
  // Mock-mode demo trend so the KPI sparkline shows even before
  // there's real payment data.
  const mockPaidSeries = [0, 568, 568, 994, 994, 994, 1846];

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        crumbs={['Finishes', project.name, 'Financials']}
        title="Financials"
        actions={
          <>
            <Btn sm icon="download">Statement · Apr</Btn>
            <Btn sm>Export CSV</Btn>
          </>
        }
      >
        <PageHead
          eyebrow={live ? `All amounts in ${currency} · USD ref @ 3,700` : 'All amounts in UGX · USD ref @ 3,700'}
          title={live ? `Contract value ${currency} ${fmt(so?.currentAmount)}` : 'Contract value UGX 2.84Bn'}
          sub={live ? subline(so, invoices, schedule) : '51% paid to date · 1 invoice open · 4 variations under contract'}
        >
          <Btn ghost icon="image">Statement view</Btn>
        </PageHead>

        {/* KPI strip */}
        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Contract value" value={live ? fmt(so?.currentAmount) : '2.84Bn'} sub={live ? contractSub(so) : 'UGX · base + 4 variations'} />
          <Stat label="Invoiced" value={live ? fmt(invoicedAmount(so)) : '1.76Bn'} sub={live ? `${pctOfContract(invoicedAmount(so), so)}% · ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}` : '62% · 4 invoices'} />
          <Stat
            label="Paid"
            value={live ? fmt(so?.totalPaid) : '1.45Bn'}
            sub={live ? `${paidPct(so)}% · ${paidCount(invoices)} settled` : '51% · 4 settled'}
            sparkline={live ? paidSeries : mockPaidSeries}
          />
          <Stat
            label="Outstanding"
            value={live ? fmt(openMs?.amount ?? so?.balanceRemaining) : '311,500'}
            sub={live ? (openMs ? `${openMs.invoiceRef ?? openMs.label} · ${dueLabel(openMs)}` : 'Nothing currently due') : 'INV-012 · due 22 May'}
            signal={live ? !!openMs : true}
          />
        </div>

        <Tabs items={[
          { l: 'Payment schedule', on: true },
          { l: 'Invoices', c: invoices.length || (mode === 'mock' ? 8 : undefined) },
          { l: 'Statements' },
          { l: 'Variations', c: 4 },
          { l: `Currency · ${currency}` },
        ]} />

        {/* Schedule + latest invoice */}
        <div className="h-grid cols-3-2" style={{ gap: 16 }}>
          <Pane title="Payment schedule" action="View milestones →" flush>
            {live ? <LiveSchedule rows={schedule} currency={currency} /> : <MockSchedule />}
          </Pane>

          <Pane title="Latest invoice" action="Pay →">
            {live
              ? <LiveLatestInvoice open={openMs} so={so} currency={currency} />
              : <MockLatestInvoice />}
          </Pane>
        </div>

        {/* Invoice register */}
        <Pane title="Invoice register" action={live ? `All ${invoices.length} invoice${invoices.length === 1 ? '' : 's'} →` : 'All 8 invoices →'} flush>
          {live ? <LiveInvoiceRegister rows={invoices} /> : <MockInvoiceRegister />}
        </Pane>
      </PortalShell>
    </div>
  );
}

// ── Live sub-views ──────────────────────────────────────────

function LiveSchedule({ rows, currency }: { rows: PaymentScheduleEntry[]; currency: string }) {
  return (
    <Tbl
      cols={[
        { l: 'Milestone', w: '2.5fr' },
        { l: 'Trigger', w: '1.5fr' },
        { l: '%', w: '60px', a: 'right' },
        { l: 'Amount', w: '120px', a: 'right' },
        { l: 'Status', w: '160px', a: 'right' },
      ]}
      rows={rows.map((r) => ({
        signal: r.status === 'open',
        dim: r.status === 'upcoming',
        cells: [
          <Cell t={r.label} s={'Phase ' + Math.ceil((r.index + 1) / 2)} />,
          r.trigger ?? '—',
          <CellNum>{r.percentage}%</CellNum>,
          <CellNum>{formatBig(r.amount, currency)}</CellNum>,
          scheduleStatusCell(r),
        ],
      }))}
    />
  );
}

function scheduleStatusCell(r: PaymentScheduleEntry) {
  if (r.status === 'paid') {
    const d = r.paidOn
      ? r.paidOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : '—';
    return <span className="h-mono">Paid · {d}</span>;
  }
  if (r.status === 'open') {
    return (
      <span style={{
        font: '600 11px/1 var(--font-sans)',
        color: 'var(--signal)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>{dueLabel(r)}</span>
    );
  }
  return <span className="h-mono">On completion</span>;
}

function LiveLatestInvoice({
  open, so, currency,
}: { open: PaymentScheduleEntry | null | undefined; so: SalesOrder | undefined; currency: string }) {
  if (!open) {
    return (
      <>
        <Eyebrow>All caught up</Eyebrow>
        <div className="h-d4">No open invoice</div>
        <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
          You're up to date on the payment schedule. The next milestone will appear here when triggered.
        </div>
      </>
    );
  }

  const number = open.invoiceRef ?? `INV-${String(open.index + 1).padStart(3, '0')}`;
  const vatRate = 0.05;
  const vat = Math.round(open.amount * vatRate);
  const total = open.amount + vat;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SignalLine>Open · {dueLabel(open)}</SignalLine>
          <div className="h-d4" style={{ marginTop: 4 }}>{number}</div>
          <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
            {open.label} milestone · payable to {so?.subsidiaryId ?? 'Dawin Operations FZE'}
          </div>
        </div>
      </div>
      <Sep />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="h-p">{open.label} milestone</span>
        <span className="h-num">{formatNumberPlain(open.amount)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="h-p is-dim">VAT 5%</span>
        <span className="h-num" style={{ color: 'var(--ink-2)' }}>{formatNumberPlain(vat)}</span>
      </div>
      <Sep />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ font: '600 14px/1 var(--font-sans)' }}>Total {currency}</span>
        <span className="h-bignum" style={{ fontSize: 30 }}>{formatBig(total, currency)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <Btn sm full icon="download">View PDF</Btn>
        <Btn signal sm full iconRight="check">Mark as paid</Btn>
      </div>
    </>
  );
}

function LiveInvoiceRegister({ rows }: { rows: InvoiceRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px 24px' }}>
        <Eyebrow>No invoices yet</Eyebrow>
        <div className="h-p is-dim" style={{ marginTop: 8, fontSize: 13 }}>
          Invoices issued against this contract will appear here.
        </div>
      </div>
    );
  }
  return (
    <Tbl
      cols={[
        { l: 'Invoice', w: '2fr' },
        { l: 'Issued', w: '1fr' },
        { l: 'Due', w: '1fr' },
        { l: 'Amount', w: '140px', a: 'right' },
        { l: 'Status', w: '140px', a: 'right' },
      ]}
      rows={rows.map((r) => ({
        signal: r.status === 'open',
        cells: [
          <Cell t={`${r.number} · ${r.description}`} s={r.method ? `${r.method}` : 'Milestone'} />,
          <CellNum>{r.issuedAt ? formatDate(r.issuedAt) : '—'}</CellNum>,
          <CellNum>{r.dueAt ? formatDate(r.dueAt) : '—'}</CellNum>,
          <CellNum>{formatNumberPlain(r.amount)}</CellNum>,
          r.status === 'open' ? <Chip signal>Open</Chip> : <Chip>Paid</Chip>,
        ],
      }))}
    />
  );
}

// ── Mock sub-views (wireframe fixtures, used by /portal/preview) ────

function MockSchedule() {
  return (
    <Tbl
      cols={[
        { l: 'Milestone', w: '2.5fr' },
        { l: 'Trigger', w: '1.5fr' },
        { l: '%', w: '60px', a: 'right' },
        { l: 'Amount', w: '120px', a: 'right' },
        { l: 'Status', w: '140px', a: 'right' },
      ]}
      rows={[
        { cells: [<Cell t="Mobilisation" s="Phase 1 · M01" />, 'Contract signed', <CellNum>20%</CellNum>, <CellNum>568,000</CellNum>, <span className="h-mono">Paid · 14 Feb</span>] },
        { cells: [<Cell t="Design closeout" s="Phase 1 · M02" />, 'IFC sealed', <CellNum>15%</CellNum>, <CellNum>426,000</CellNum>, <span className="h-mono">Paid · 20 Mar</span>] },
        { cells: [<Cell t="Procurement 50%" s="Phase 2 · M03" />, 'POs raised', <CellNum>30%</CellNum>, <CellNum>852,000</CellNum>, <span className="h-mono">Paid · 28 Apr</span>] },
        { signal: true, cells: [
          <Cell t="Construction 50%" s="Phase 3 · INV-012" />,
          'Joinery on site',
          <CellNum>20%</CellNum>,
          <CellNum>568,000</CellNum>,
          <span style={{
            font: '600 11px/1 var(--font-sans)',
            color: 'var(--signal)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>Due 22 May</span>,
        ] },
        { dim: true, cells: [<Cell t="Handover" s="Phase 4 · M05" />, 'Practical completion', <CellNum>15%</CellNum>, <CellNum>426,000</CellNum>, <span className="h-mono">On completion</span>] },
      ]}
    />
  );
}

function MockLatestInvoice() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SignalLine>Open · due 22 May</SignalLine>
          <div className="h-d4" style={{ marginTop: 4 }}>INV-012</div>
          <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
            Construction 50% milestone · payable to Dawin Operations FZE
          </div>
        </div>
      </div>
      <Sep />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="h-p">Construction 50% milestone</span>
        <span className="h-num">568,000</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="h-p is-dim">VAT 5%</span>
        <span className="h-num" style={{ color: 'var(--ink-2)' }}>28,400</span>
      </div>
      <Sep />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ font: '600 14px/1 var(--font-sans)' }}>Total UGX</span>
        <span className="h-bignum" style={{ fontSize: 30 }}>596.4M</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <Btn sm full icon="download">View PDF</Btn>
        <Btn signal sm full iconRight="check">Mark as paid</Btn>
      </div>
    </>
  );
}

function MockInvoiceRegister() {
  return (
    <Tbl
      cols={[
        { l: 'Invoice', w: '2fr' },
        { l: 'Issued', w: '1fr' },
        { l: 'Due', w: '1fr' },
        { l: 'Amount UGX', w: '140px', a: 'right' },
        { l: 'Status', w: '140px', a: 'right' },
      ]}
      rows={[
        { signal: true, cells: [<Cell t="INV-012 · Construction 50%" s="Milestone · Phase 3" />, <CellNum>10 May</CellNum>, <CellNum>22 May</CellNum>, <CellNum>568,000</CellNum>, <Chip signal>Open</Chip>] },
        { cells: [<Cell t="INV-011 · Procurement 50%" s="Milestone · Phase 2" />, <CellNum>14 Apr</CellNum>, <CellNum>28 Apr</CellNum>, <CellNum>852,000</CellNum>, <Chip>Paid</Chip>] },
        { cells: [<Cell t="INV-010 · Design closeout" s="Milestone · Phase 1" />, <CellNum>8 Mar</CellNum>, <CellNum>20 Mar</CellNum>, <CellNum>426,000</CellNum>, <Chip>Paid</Chip>] },
        { cells: [<Cell t="INV-009 · Variation · MEP" s="Q-017 · sealed" />, <CellNum>24 Apr</CellNum>, <CellNum>8 May</CellNum>, <CellNum>184,500</CellNum>, <Chip>Paid</Chip>] },
        { dim: true, cells: [<Cell t="INV-008 · Reimbursables · Q1" s="Travel · permits" />, <CellNum>4 Apr</CellNum>, <CellNum>18 Apr</CellNum>, <CellNum>18,200</CellNum>, <Chip>Paid</Chip>] },
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
    line: 'finishes',
  };
}

function subline(so: SalesOrder | undefined, invoices: InvoiceRow[], schedule: PaymentScheduleEntry[]): string {
  if (!so) return '';
  const paid = paidCount(invoices);
  const total = invoices.length;
  const variations = schedule.length;
  return `${paidPct(so)}% paid to date · ${total - paid} invoice${total - paid === 1 ? '' : 's'} open · ${variations} milestone${variations === 1 ? '' : 's'} in schedule`;
}

function contractSub(so: SalesOrder | undefined): string {
  if (!so) return '';
  const variations = so.totalChangeOrderValue ?? 0;
  if (variations === 0) return `${so.currency} · base contract`;
  return `${so.currency} · base + variations (${variations >= 0 ? '+' : ''}${formatBig(variations, so.currency)})`;
}

function invoicedAmount(so: SalesOrder | undefined): number {
  if (!so) return 0;
  return (so.totalPaid ?? 0) + (so.balanceRemaining ?? 0);
}

function paidPct(so: SalesOrder | undefined): number {
  if (!so || !so.currentAmount) return 0;
  return Math.round((so.totalPaid / so.currentAmount) * 100);
}

function pctOfContract(amount: number, so: SalesOrder | undefined): number {
  if (!so || !so.currentAmount) return 0;
  return Math.round((amount / so.currentAmount) * 100);
}

function paidCount(invoices: InvoiceRow[]): number {
  return invoices.filter((i) => i.status === 'paid').length;
}

function dueLabel(r: PaymentScheduleEntry): string {
  if (r.dueDate) return `Due ${formatDate(r.dueDate)}`;
  return 'Due now';
}

function formatBig(amount: number | undefined | null, _currency: string): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}Bn`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toString();
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
        title="Financials"
        dataMode="live"
      >
        <PageHead title="Loading financials…" sub={`Resolving ${project}`} />
      </PortalShell>
    </div>
  );
}

function ErrorState({ project, message }: { project: string; message: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Project', tag: project, sub: '', line: 'finishes' }}
        title="Financials"
        dataMode="live"
      >
        <PageHead eyebrow="Couldn't load" title="Something went wrong" sub={message} />
        <Card>
          <Eyebrow signal>Possible causes</Eyebrow>
          <Mono>1. The project code <strong>{project}</strong> doesn't exist.</Mono>
          <Mono>2. You don't have portal access to it yet — your project director can grant access.</Mono>
          <Mono>3. No sales order has been raised for this project yet.</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}
