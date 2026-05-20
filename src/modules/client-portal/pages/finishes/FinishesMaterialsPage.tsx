import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Sep, Img, Eyebrow, Mono, Row, type ImgTone,
} from '../../components/primitives';
import { Tabs } from '../../components/Table';
import { VELA_PROJECT } from '../../fixtures/projects';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  useFinishesPortalMaterials,
  type PortalMaterialItem,
  type PortalMaterialCategory,
  type PortalMaterialsData,
} from '../../hooks/useFinishesPortalMaterials';
import type { DesignProject } from '@/modules/design-manager/types';
import '../../styles/portal.css';

const PORTAL_CATEGORIES: PortalMaterialCategory[] = [
  'Stone', 'Timber', 'Fabric', 'Lighting', 'Hardware', 'Finishing', 'Other',
];

interface MockMaterialEntry {
  code: string;
  category: 'Stone' | 'Timber' | 'Fabric' | 'Lighting' | 'Hardware';
  name: string;
  spec: string;
  qty: string;
  zone: string;
  status: 'Sealed' | 'Ordered' | 'On site' | 'Installed' | 'Open';
  tone: ImgTone;
}

const MOCK_MATERIALS: MockMaterialEntry[] = [
  { code: 'M-STN-01', category: 'Stone',     name: 'Calacatta Borghini 20mm', spec: 'Italy · book-matched · 18.4 m²', qty: '18.4 m²',  zone: 'A',   status: 'Open',      tone: 'stone' },
  { code: 'M-STN-02', category: 'Stone',     name: 'Travertine roman 30mm',   spec: 'Tivoli · honed · 6.2 m²',         qty: '6.2 m²',   zone: 'C',   status: 'Sealed',    tone: 'stone' },
  { code: 'M-TIM-01', category: 'Timber',    name: 'Walnut veneer A1',        spec: 'Falcon · 124 m² · oiled',         qty: '124 m²',   zone: 'A,B', status: 'Ordered',   tone: 'interior-warm' },
  { code: 'M-TIM-02', category: 'Timber',    name: 'European oak floor',      spec: 'Brushed · UV-oil · 312 m²',       qty: '312 m²',   zone: 'A,B', status: 'On site',   tone: 'interior' },
  { code: 'M-FAB-01', category: 'Fabric',    name: 'Kvadrat Fiord 0961',      spec: 'Wool · upholstery · 28 m',        qty: '28 m',     zone: 'C',   status: 'Sealed',    tone: 'fabric' },
  { code: 'M-LGT-01', category: 'Lighting',  name: 'Vibia North 5650',        spec: 'Pendant · 12 fittings · bronze',  qty: '12 ea',    zone: 'A',   status: 'Open',      tone: 'light' },
  { code: 'M-LGT-02', category: 'Lighting',  name: 'Track head ALR-3',        spec: '28 fixtures · bronze/black TBD',  qty: '28 ea',    zone: 'A,C', status: 'Open',      tone: 'light' },
  { code: 'M-HW-01',  category: 'Hardware',  name: 'Sugatsune door pulls',    spec: 'Satin bronze · 42 doors',         qty: '84 ea',    zone: 'A,B', status: 'Ordered',   tone: 'render' },
];

export default function FinishesMaterialsPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useFinishesPortalMaterials(params.code);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) return <MaterialsView mode="mock" project={VELA_PROJECT} />;
  if (loading || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return <MaterialsView mode="live" project={dataToShellProject(data.project)} data={data} />;
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalMaterialsData;
}

function MaterialsView({ mode, project, data }: ViewProps) {
  const live = mode === 'live' && data;
  const [category, setCategory] = useState<'all' | PortalMaterialCategory>('all');

  const counts = live ? data!.counts : {
    total: 62, sealed: 48, ordered: 36, onSite: 22, open: 2,
  };

  const visible = useMemo<PortalMaterialItem[] | null>(() => {
    if (!live) return null;
    return category === 'all' ? data!.items : data!.byCategory[category];
  }, [live, data, category]);

  // Pick the tab list dynamically (only show populated categories).
  const populatedCategories = live
    ? PORTAL_CATEGORIES.filter((c) => data!.byCategory[c].length > 0)
    : ['Stone', 'Timber', 'Fabric', 'Lighting', 'Hardware'] as const;

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        crumbs={['Finishes', project.name, 'Materials & FF&E']}
        title="Materials &amp; FF&amp;E"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">Schedule PDF</Btn>
          </>
        }
      >
        <PageHead
          eyebrow={live
            ? `${counts.total} line item${counts.total === 1 ? '' : 's'} · ${populatedCategories.length} categor${populatedCategories.length === 1 ? 'y' : 'ies'} · ${counts.open} awaiting decision`
            : '62 line items · 8 categories · 2 awaiting decision'}
          title={live ? `Material schedule · ${project.name}` : 'Material schedule · Vela Boutique'}
          sub="Live status pulled from procurement. Open decisions block joinery install."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Sealed" value={String(counts.sealed)} sub="lines · pricing locked" />
          <Stat label="Ordered" value={String(counts.ordered)} sub="lines · POs out" />
          <Stat label="On site" value={String(counts.onSite)} sub="lines · received" />
          <Stat
            label="Open decisions"
            value={String(counts.open)}
            sub={live ? openDecisionsSub(data!) : 'lighting + stone variation'}
            signal={counts.open > 0}
          />
        </div>

        <Tabs
          items={[
            {
              l: 'All categories',
              c: live ? counts.total : 62,
              on: live ? category === 'all' : true,
            },
            ...(live
              ? populatedCategories.map((c) => ({
                  l: c,
                  c: data!.byCategory[c].length,
                  on: category === c,
                  signal: data!.byCategory[c].some((i) => i.status === 'open'),
                }))
              : [
                  { l: 'Stone', c: 6 },
                  { l: 'Timber', c: 14 },
                  { l: 'Fabric', c: 4 },
                  { l: 'Lighting', c: 12, signal: true },
                  { l: 'Hardware', c: 26 },
                ]),
          ]}
          onSelect={(i) => {
            if (!live) return;
            if (i === 0) setCategory('all');
            else setCategory(populatedCategories[i - 1]);
          }}
        />

        <div className="h-grid cols-3" style={{ gap: 16 }}>
          {live
            ? (visible!.length > 0
                ? visible!.map((m) => <LiveMaterialCard key={m.id} m={m} />)
                : <EmptyBucket />)
            : MOCK_MATERIALS.map((m) => <MockMaterialCard key={m.code} m={m} />)}
        </div>

        <Pane title="Procurement summary" action="Open Matflow ↗">
          <div className="h-grid cols-3" style={{ gap: 16 }}>
            <Card>
              <Eyebrow>Lead times · this week</Eyebrow>
              <Row title="Calacatta slab" sub="IT → Jebel Ali" right="14 days" rightSub="Confirmed" />
              <Row title="Vibia pendants" sub="ES → DXB" right="21 days" rightSub="In transit" />
              <Row title="Kvadrat fabric" sub="DK → DXB" right="9 days" rightSub="Received" />
            </Card>
            <Card>
              <Eyebrow>Open POs</Eyebrow>
              <div className="h-bignum" style={{ fontSize: 42, marginTop: 4 }}>11</div>
              <Mono>UGX 412M committed</Mono>
              <Sep />
              <Row title="PO-014 · Stone" sub="Marmi Bruno" right="Due 26 May" />
              <Row title="PO-013 · Lighting" sub="Vibia ES" right="Due 8 Jun" />
            </Card>
            <Card signal={counts.open > 0}>
              <Eyebrow signal={counts.open > 0}>Decisions blocking</Eyebrow>
              {live
                ? data!.items
                    .filter((i) => i.status === 'open')
                    .slice(0, 4)
                    .map((i) => (
                      <Row
                        key={i.id}
                        title={i.name}
                        sub={i.spec}
                        right={i.code}
                      />
                    ))
                : (
                  <>
                    <Row title="Track head finish" sub="Bronze vs black · 28 fixtures" right="Due 20 May" />
                    <Row title="Stone slab spec" sub="Q-019 v2 awaiting signoff" right="Due 16 May" />
                  </>
                )}
              {live && counts.open === 0 ? (
                <Mono>No open decisions right now.</Mono>
              ) : null}
            </Card>
          </div>
        </Pane>
      </PortalShell>
    </div>
  );
}

// ── Live sub-views ──────────────────────────────────────────

function LiveMaterialCard({ m }: { m: PortalMaterialItem }) {
  const signal = m.status === 'open';
  return (
    <Card flush style={{ overflow: 'hidden' }}>
      <Img tone={m.tone} h={140}>
        <div style={{
          position: 'absolute', top: 12, left: 12,
          display: 'flex', gap: 6,
        }}>
          <Chip outline style={{
            background: 'rgba(250,250,247,0.85)',
            font: '500 10px/1 var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>{m.portalCategory}</Chip>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          {signal
            ? <Chip signal>● {statusLabel(m.status)}</Chip>
            : <Chip style={{ background: 'rgba(20,18,14,0.45)', color: '#fff' }}>{statusLabel(m.status)}</Chip>}
        </div>
      </Img>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Mono style={{ color: 'var(--ink-3)' }}>{m.code}</Mono>
        <div style={{ font: '600 15px/1.25 var(--font-sans)', letterSpacing: '-0.01em' }}>{m.name}</div>
        <div className="h-p is-dim" style={{ fontSize: 12 }}>{m.spec}</div>
        <Sep />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Mono>{m.qty}</Mono>
          <Mono>Zone {m.zone}</Mono>
        </div>
      </div>
    </Card>
  );
}

function EmptyBucket() {
  return (
    <Card>
      <Eyebrow>Nothing here yet</Eyebrow>
      <Mono>
        No materials in this category for this project. Switch to "All categories" to see everything.
      </Mono>
    </Card>
  );
}

function statusLabel(s: PortalMaterialItem['status']): string {
  switch (s) {
    case 'open': return 'Open';
    case 'sealed': return 'Sealed';
    case 'ordered': return 'Ordered';
    case 'on_site': return 'On site';
    case 'installed': return 'Installed';
  }
}

function openDecisionsSub(d: PortalMaterialsData): string {
  const opens = d.items.filter((i) => i.status === 'open');
  if (opens.length === 0) return 'None';
  return opens.slice(0, 2).map((i) => i.name.split(' ').slice(0, 2).join(' ')).join(' + ');
}

// ── Mock sub-views (wireframe fixtures) ─────────────────────

function MockMaterialCard({ m }: { m: MockMaterialEntry }) {
  const signal = m.status === 'Open';
  return (
    <Card flush style={{ overflow: 'hidden' }}>
      <Img tone={m.tone} h={140}>
        <div style={{
          position: 'absolute', top: 12, left: 12,
          display: 'flex', gap: 6,
        }}>
          <Chip outline style={{
            background: 'rgba(250,250,247,0.85)',
            font: '500 10px/1 var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>{m.category}</Chip>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          {signal
            ? <Chip signal>● {m.status}</Chip>
            : <Chip style={{ background: 'rgba(20,18,14,0.45)', color: '#fff' }}>{m.status}</Chip>}
        </div>
      </Img>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Mono style={{ color: 'var(--ink-3)' }}>{m.code}</Mono>
        <div style={{ font: '600 15px/1.25 var(--font-sans)', letterSpacing: '-0.01em' }}>{m.name}</div>
        <div className="h-p is-dim" style={{ fontSize: 12 }}>{m.spec}</div>
        <Sep />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Mono>{m.qty}</Mono>
          <Mono>Zone {m.zone}</Mono>
        </div>
      </div>
    </Card>
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

// ── Loading / error states ──────────────────────────────────

function LoadingState({ project }: { project: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Loading…', tag: project, sub: '', line: 'finishes' }}
        title="Materials & FF&E"
        dataMode="live"
      >
        <Card>
          <Eyebrow>Loading materials…</Eyebrow>
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
        title="Materials & FF&E"
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
