import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Mono, Sep, SignalLine, Eyebrow,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { VELA_PROJECT } from '../../fixtures/projects';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  useFinishesPortalDrawings,
  idOf,
  type DrawingBucket,
  type DrawingItem,
  type PortalDrawingsData,
} from '../../hooks/useFinishesPortalDrawings';
import type { DesignProject } from '@/modules/design-manager/types';
import '../../styles/portal.css';

interface Sheet {
  code: string;
  title: string;
  set: string;
  rev: string;
  status: 'Signed' | 'Open' | 'Superseded' | 'Draft';
  date: string;
  pins?: number;
}

const MOCK_SHEETS: Sheet[] = [
  { code: 'SD-104', title: 'Cashwrap joinery',     set: 'Shop drawings', rev: 'Rev C', status: 'Open',       date: '8 May',  pins: 3 },
  { code: 'SD-106', title: 'Stone wall panel',     set: 'Shop drawings', rev: 'Rev A', status: 'Open',       date: '12 May', pins: 0 },
  { code: 'SD-099', title: 'Storefront glazing',   set: 'Shop drawings', rev: 'Rev B', status: 'Signed',     date: '6 May',  pins: 0 },
  { code: 'SD-098', title: 'Banquette seating',    set: 'Shop drawings', rev: 'Rev A', status: 'Signed',     date: '30 Apr' },
  { code: 'SD-097', title: 'Reception desk',       set: 'Shop drawings', rev: 'Rev C', status: 'Signed',     date: '24 Apr' },
  { code: 'IFC-12', title: 'Lighting plan',        set: 'IFC plans',     rev: 'C',     status: 'Signed',     date: '20 Apr' },
  { code: 'IFC-08', title: 'MEP first fix',        set: 'IFC plans',     rev: 'B',     status: 'Signed',     date: '14 Apr' },
  { code: 'IFC-05', title: 'Floor finish layout',  set: 'IFC plans',     rev: 'A',     status: 'Signed',     date: '4 Apr' },
  { code: 'AS-003', title: 'Cashwrap (as-built)',  set: 'As-built',      rev: '—',     status: 'Draft',      date: '— ' },
];

export default function FinishesDrawingsIndexPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useFinishesPortalDrawings(params.code);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) return <DrawingsIndexView mode="mock" project={VELA_PROJECT} />;
  if (loading || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return <DrawingsIndexView mode="live" project={dataToShellProject(data.project)} data={data} />;
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalDrawingsData;
}

function DrawingsIndexView({ mode, project, data }: ViewProps) {
  const live = mode === 'live' && data;
  const navigate = useNavigate();
  const counts = live ? data!.counts : { awaiting: 2, approved: 27, superseded: 0, draft: 1 };
  const total = counts.awaiting + counts.approved + counts.superseded + counts.draft;
  const [bucket, setBucket] = useState<DrawingBucket | 'all'>(live && counts.awaiting > 0 ? 'awaiting' : 'all');

  const items = live ? data!.items : [];
  const bucketItems = useMemo(() => {
    if (!live) return items;
    return bucket === 'all' ? items : items.filter((i) => i.bucket === bucket);
  }, [live, items, bucket]);

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        crumbs={['Finishes', project.name, 'Plans & drawings']}
        title="Plans &amp; drawings"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">Drawing pack PDF</Btn>
          </>
        }
      >
        <PageHead
          eyebrow={live
            ? `${total} sheet${total === 1 ? '' : 's'} · ${counts.awaiting} ${counts.awaiting === 1 ? 'revision' : 'revisions'} need signoff`
            : '32 sheets · 3 sets · 2 revisions need signoff'}
          title="Drawing library"
          sub="Every sheet your team has issued, with revisions and open pin comments."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Signed" value={String(live ? counts.approved : 27)} sub="latest revs" />
          <Stat
            label="Open"
            value={String(live ? counts.awaiting : 2)}
            sub={live ? awaitingSub(items) : 'Rev C · Rev A'}
            signal={live ? counts.awaiting > 0 : true}
          />
          <Stat label="Pins" value="3" sub="2 unresolved" />
          <Stat
            label="Last issued"
            value={live ? lastIssuedValue(data) : '12 May'}
            sub={live ? lastIssuedSub(data) : 'SD-106 Rev A'}
          />
        </div>

        <Tabs
          items={[
            { l: `All sheets`, c: total, on: bucket === 'all' },
            { l: 'Awaiting', c: counts.awaiting, on: bucket === 'awaiting', signal: bucket === 'awaiting' && counts.awaiting > 0 },
            { l: 'Approved', c: counts.approved, on: bucket === 'approved' },
            { l: 'Superseded', c: counts.superseded, on: bucket === 'superseded' },
            { l: 'Drafts', c: counts.draft, on: bucket === 'draft' },
          ]}
          onSelect={(i) => {
            const order: Array<DrawingBucket | 'all'> = ['all', 'awaiting', 'approved', 'superseded', 'draft'];
            setBucket(order[i]);
          }}
        />

        {live ? (
          <div className="h-grid cols-2-3" style={{ gap: 16 }}>
            {counts.awaiting > 0 ? (
              <Card signal>
                <SignalLine>
                  {counts.awaiting} sheet{counts.awaiting === 1 ? '' : 's'} awaiting signoff
                </SignalLine>
                <div className="h-d4" style={{ marginTop: 6 }}>{awaitingHeadline(items)}</div>
                <div className="h-p is-dim" style={{ fontSize: 13 }}>
                  Open in the drawing viewer to review and sign.
                </div>
                <Sep />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {items.filter((i) => i.bucket === 'awaiting').slice(0, 3).map((i) => (
                    <Btn
                      key={i.id}
                      signal
                      sm
                      iconRight="arrow-r"
                      onClick={() => navigate(`/portal/p/${data!.project.code}/drawings/${idOf(i)}`)}
                    >Open {i.number}</Btn>
                  ))}
                </div>
              </Card>
            ) : (
              <Card>
                <Eyebrow>All clear</Eyebrow>
                <div className="h-d4">No drawings awaiting your signoff.</div>
                <div className="h-p is-dim" style={{ fontSize: 13 }}>
                  The team will let you know when a new revision is ready for review.
                </div>
              </Card>
            )}

            <Pane title="Recent activity" flush>
              <Tbl
                cols={[
                  { l: 'Event', w: '2.5fr' },
                  { l: 'Who', w: '1fr' },
                  { l: 'When', w: '90px', a: 'right' },
                ]}
                rows={recentActivity(items).slice(0, 4)}
              />
            </Pane>
          </div>
        ) : (
          <div className="h-grid cols-2-3" style={{ gap: 16 }}>
            <Card signal>
              <SignalLine>2 sheets awaiting signoff</SignalLine>
              <div className="h-d4" style={{ marginTop: 6 }}>
                SD-104 Rev C · SD-106 Rev A
              </div>
              <div className="h-p is-dim" style={{ fontSize: 13 }}>
                Open in the drawing viewer to mark up, pin comments, and sign.
              </div>
              <Sep />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn signal sm iconRight="arrow-r">Open SD-104</Btn>
                <Btn sm>Open SD-106</Btn>
              </div>
            </Card>

            <Pane title="Recent activity" flush>
              <Tbl
                cols={[
                  { l: 'Event', w: '2.5fr' },
                  { l: 'Who', w: '1fr' },
                  { l: 'When', w: '90px', a: 'right' },
                ]}
                rows={[
                  { cells: [<Cell t="SD-106 Rev A issued" s="Stone wall panel · 2 sheets" />, 'D. Wahab', <CellNum>12 May</CellNum>] },
                  { cells: [<Cell t="SD-104 Rev C issued" s="Cashwrap joinery · 4 sheets" />, 'D. Wahab', <CellNum>8 May</CellNum>] },
                  { cells: [<Cell t="SD-099 Rev B signed" s="Storefront glazing" />, 'You', <CellNum>6 May</CellNum>] },
                  { dim: true, cells: [<Cell t="IFC-12 Rev C signed" s="Lighting plan" />, 'You', <CellNum>20 Apr</CellNum>] },
                ]}
              />
            </Pane>
          </div>
        )}

        <Pane
          title="Sheet register"
          action={live ? `${bucketItems.length} sheet${bucketItems.length === 1 ? '' : 's'}` : '32 sheets'}
          flush
        >
          {live
            ? <LiveSheetRegister rows={bucketItems} onOpen={(i) => navigate(`/portal/p/${data!.project.code}/drawings/${idOf(i)}`)} />
            : <MockSheetRegister />}
        </Pane>
      </PortalShell>
    </div>
  );
}

// ── Live sub-views ──────────────────────────────────────────

function LiveSheetRegister({ rows, onOpen }: { rows: DrawingItem[]; onOpen: (i: DrawingItem) => void }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <Eyebrow>Nothing in this bucket</Eyebrow>
        <Mono style={{ marginTop: 8, display: 'block' }}>Sheets will appear here when they're issued.</Mono>
      </div>
    );
  }
  return (
    <Tbl
      cols={[
        { l: 'Sheet', w: '2.5fr' },
        { l: 'Revision', w: '90px' },
        { l: 'Documents', w: '110px' },
        { l: 'Issued', w: '90px', a: 'right' },
        { l: 'Status', w: '160px', a: 'right' },
      ]}
      rows={rows.map((r) => ({
        signal: r.bucket === 'awaiting',
        dim: r.bucket === 'draft' || r.bucket === 'superseded',
        cells: [
          <Cell t={`${r.number} · ${r.title}`} s={r.description?.slice(0, 90)} />,
          <Mono>v{r.designVersion}</Mono>,
          <Mono>{r.documentCount} {r.documentCount === 1 ? 'doc' : 'docs'}</Mono>,
          <CellNum>{r.issuedAt ? formatDate(r.issuedAt) : '—'}</CellNum>,
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <Chip signal={r.bucket === 'awaiting'}>{statusLabel(r.bucket)}</Chip>
            <button
              onClick={() => onOpen(r)}
              style={{
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                font: '500 12px/1 var(--font-sans)',
                color: 'var(--ink)',
              }}
            >Open ↗</button>
          </div>,
        ],
      }))}
    />
  );
}

// ── Mock sub-views ──────────────────────────────────────────

function MockSheetRegister() {
  return (
    <Tbl
      cols={[
        { l: 'Sheet', w: '2.5fr' },
        { l: 'Set', w: '1fr' },
        { l: 'Revision', w: '90px' },
        { l: 'Pins', w: '70px', a: 'right' },
        { l: 'Issued', w: '90px', a: 'right' },
        { l: 'Status', w: '120px', a: 'right' },
      ]}
      rows={MOCK_SHEETS.map((s) => ({
        signal: s.status === 'Open',
        dim: s.status === 'Draft',
        cells: [
          <Cell t={`${s.code} · ${s.title}`} s={s.set} />,
          s.set,
          <Mono>{s.rev}</Mono>,
          <CellNum>{s.pins ?? '—'}</CellNum>,
          <CellNum>{s.date}</CellNum>,
          <Chip signal={s.status === 'Open'}>{s.status}</Chip>,
        ],
      }))}
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

function awaitingSub(items: DrawingItem[]): string {
  const awaiting = items.filter((i) => i.bucket === 'awaiting');
  if (awaiting.length === 0) return 'Nothing pending';
  return awaiting.slice(0, 2).map((i) => `${i.number} v${i.designVersion}`).join(' · ');
}

function awaitingHeadline(items: DrawingItem[]): string {
  const awaiting = items.filter((i) => i.bucket === 'awaiting');
  return awaiting.map((i) => `${i.number} v${i.designVersion}`).join(' · ');
}

function lastIssuedValue(data: PortalDrawingsData | undefined): string {
  if (!data?.lastIssued?.issuedAt) return '—';
  return formatDate(data.lastIssued.issuedAt);
}

function lastIssuedSub(data: PortalDrawingsData | undefined): string {
  if (!data?.lastIssued) return '—';
  return `${data.lastIssued.number} v${data.lastIssued.designVersion}`;
}

function recentActivity(items: DrawingItem[]) {
  return [...items]
    .filter((i) => i.issuedAt)
    .sort((a, b) => (b.issuedAt!.getTime() - a.issuedAt!.getTime()))
    .map((i) => ({
      cells: [
        <Cell
          t={`${i.number} v${i.designVersion} ${i.bucket === 'approved' ? 'signed' : 'issued'}`}
          s={`${i.title} · ${i.documentCount} ${i.documentCount === 1 ? 'sheet' : 'sheets'}`}
        />,
        i.bucket === 'approved' ? 'You' : 'Project team',
        <CellNum>{formatDate(i.issuedAt!)}</CellNum>,
      ],
      dim: i.bucket === 'superseded' || i.bucket === 'draft',
    }));
}

function statusLabel(b: DrawingBucket): string {
  switch (b) {
    case 'awaiting': return 'Awaiting you';
    case 'approved': return 'Signed';
    case 'superseded': return 'Superseded';
    case 'draft': return 'Draft';
  }
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
        title="Plans & drawings"
        dataMode="live"
      >
        <Card>
          <Eyebrow>Loading drawings…</Eyebrow>
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
        project={{ slug: project, name: 'Project', tag: project, sub: '', line: 'finishes' }}
        title="Plans & drawings"
        dataMode="live"
      >
        <Card>
          <Eyebrow signal>Couldn't load — {message}</Eyebrow>
          <Mono>1. The project code <strong>{project}</strong> doesn't exist.</Mono>
          <Mono>2. You don't have portal access to it yet — your project director can grant access.</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}
