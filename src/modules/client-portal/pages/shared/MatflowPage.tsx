import { useParams } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Sep, Eyebrow, Mono, BarLine, Row,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { Icon } from '../../components/Icon';
import { VELA_PROJECT, NAQAA_PROJECT } from '../../fixtures/projects';
import { usePortalProjectShell } from '../../hooks/usePortalProjectShell';
import '../../styles/portal.css';

interface MatflowPageProps { project: PortalProject; }

interface PO {
  code: string;
  vendor: string;
  spec: string;
  amount: string;
  due: string;
  status: 'Open' | 'In transit' | 'Received' | 'Closed';
}

const VELA_POS: PO[] = [
  { code: 'PO-014', vendor: 'Marmi Bruno',   spec: 'Calacatta Borghini 20mm', amount: '96,400',  due: '26 May', status: 'In transit' },
  { code: 'PO-013', vendor: 'Vibia ES',      spec: 'Vibia North 5650 · 12 ea', amount: '152,200', due: '8 Jun',  status: 'Open' },
  { code: 'PO-012', vendor: 'Falcon',        spec: 'Joinery package',          amount: '682,400', due: 'On site',status: 'Received' },
  { code: 'PO-011', vendor: 'Kvadrat',       spec: 'Fiord 0961 · 28 m',        amount: '18,400',  due: '—',      status: 'Closed' },
  { code: 'PO-010', vendor: 'Sugatsune',     spec: 'Hardware pack',            amount: '38,200',  due: '—',      status: 'Closed' },
];

const NAQAA_POS: PO[] = [
  { code: 'PO-038', vendor: 'Falcon · KSA',     spec: 'Joinery · Naqaa-08',     amount: '1,420,000', due: '24 Jun', status: 'Open' },
  { code: 'PO-037', vendor: 'Vibia ME',         spec: 'Lighting · Naqaa-08, 09', amount: '824,000',  due: '14 Jun', status: 'Open' },
  { code: 'PO-036', vendor: 'Marmi Bruno',      spec: 'Stone · Naqaa-04, 05',    amount: '610,800',  due: '4 Jun',  status: 'In transit' },
  { code: 'PO-035', vendor: 'Sugatsune ME',     spec: 'Hardware · 5 stores',     amount: '184,500',  due: 'On site',status: 'Received' },
  { code: 'PO-034', vendor: 'Kvadrat',          spec: 'Fabric · 4 stores',       amount: '94,200',   due: '—',      status: 'Closed' },
];

export default function MatflowPage({ project: fixtureProject }: MatflowPageProps) {
  const params = useParams<{ code?: string }>();
  const { project: shellProject, raw } = usePortalProjectShell();
  // Outside the route (preview canvas) we use the fixture; inside the
  // route we use the resolved live project.
  const project = params.code ? shellProject : fixtureProject;
  const procurement = raw?.programme?.procurement;

  const pos = project.line === 'advisory' ? NAQAA_POS : VELA_POS;
  const open = pos.filter((p) => p.status === 'Open').length;
  const inTransit = pos.filter((p) => p.status === 'In transit').length;
  const received = pos.filter((p) => p.status === 'Received').length;

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        crumbs={[project.line === 'advisory' ? 'Advisory' : 'Finishes', project.name, 'Matflow']}
        title="Matflow · procurement"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">Export CSV</Btn>
            <Btn sm iconRight="arrow-tr">Open Matflow ↗</Btn>
          </>
        }
      >
        <PageHead
          eyebrow="Live procurement view · 14-day rolling vendor lock"
          title={project.line === 'advisory' ? '22 open POs · 14 stores' : '11 open POs · 412 m² fit-out'}
          sub="Vendor performance, lead times, and cost variance — direct from the Matflow procurement system."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat
            label="Open POs"
            value={procurement?.openPOs ?? (open + inTransit)}
            sub={procurement
              ? `Across ${project.name.toLowerCase().includes('rollout') ? 'all stores' : 'this project'}`
              : `${inTransit} in transit`}
          />
          <Stat
            label="Pending RFQs"
            value={procurement?.pendingRFQs ?? (project.line === 'advisory' ? 6 : 2)}
            sub="Vendor responses due"
          />
          <Stat
            label="Cost variance"
            value={procurement
              ? `${procurement.costVariancePct >= 0 ? '+' : ''}${procurement.costVariancePct}%`
              : (project.line === 'advisory' ? '−0.8%' : '+0.3%')}
            sub="vs BOQ baseline"
            signal={(procurement?.costVariancePct ?? 0) > 1.5}
          />
          <Stat
            label="Vetted vendors"
            value={procurement?.vettedVendors ?? 22}
            sub="12-mo cycle"
          />
        </div>

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card>
            <Eyebrow>Live vendor performance</Eyebrow>
            <BarLine label="On-time delivery" right="92%" pct={92} />
            <BarLine label="Quality acceptance" right="98%" pct={98} />
            <BarLine label="Spec compliance" right="96%" pct={96} />
            <BarLine label="Cost lock honored" right="100%" pct={100} />
            <Sep />
            <Mono>22 active vendors · 8 onboarding · 4 paused</Mono>
          </Card>

          <Pane title="Recent procurement activity" flush>
            <Tbl
              cols={[
                { l: 'Event', w: '2.5fr' },
                { l: 'Vendor', w: '1fr' },
                { l: 'When', w: '90px', a: 'right' },
              ]}
              rows={[
                { cells: [<Cell t={pos[0].code + ' issued'} s={pos[0].spec} />, pos[0].vendor, <CellNum>12 May</CellNum>] },
                { cells: [<Cell t={pos[1].code + ' issued'} s={pos[1].spec} />, pos[1].vendor, <CellNum>11 May</CellNum>] },
                { cells: [<Cell t={pos[2].code + ' received'} s={pos[2].spec} />, pos[2].vendor, <CellNum>9 May</CellNum>] },
                { dim: true, cells: [<Cell t={pos[3].code + ' closed'} s={pos[3].spec} />, pos[3].vendor, <CellNum>4 May</CellNum>] },
              ]}
            />
          </Pane>
        </div>

        <Tabs items={[
          { l: 'All POs', c: pos.length, on: true },
          { l: 'Open', c: open },
          { l: 'In transit', c: inTransit },
          { l: 'Received', c: received },
          { l: 'Closed', c: pos.filter((p) => p.status === 'Closed').length },
        ]} />

        <Pane title="Purchase orders" action={`${pos.length} POs · this project`} flush>
          <Tbl
            cols={[
              { l: 'PO', w: '1fr' },
              { l: 'Vendor', w: '1.5fr' },
              { l: 'Spec', w: '2.5fr' },
              { l: 'Amount UGX', w: '140px', a: 'right' },
              { l: 'Due', w: '110px', a: 'right' },
              { l: 'Status', w: '120px', a: 'right' },
            ]}
            rows={pos.map((p) => ({
              dim: p.status === 'Closed',
              cells: [
                <Mono style={{ color: 'var(--ink)' }}>{p.code}</Mono>,
                <Cell t={p.vendor} />,
                p.spec,
                <CellNum>{p.amount}</CellNum>,
                <CellNum>{p.due}</CellNum>,
                <Chip>{p.status}</Chip>,
              ],
            }))}
          />
        </Pane>

        <div className="h-grid cols-3" style={{ gap: 16 }}>
          <Card>
            <Eyebrow>RFQs in market</Eyebrow>
            <div className="h-bignum" style={{ fontSize: 42, marginTop: 4 }}>{project.line === 'advisory' ? '6' : '2'}</div>
            <Mono>Responses due this week</Mono>
            <Sep />
            <Row title="Storefront glazing film" sub="3 vendors · due 18 May" right="UGX 22M est." />
            <Row title="Lighting top-up · zone C" sub="2 vendors · due 20 May" right="UGX 65M est." />
          </Card>

          <Card>
            <Eyebrow>Supplier directory</Eyebrow>
            <Row title="Marmi Bruno" sub="Stone · Italy" right={<Icon name="arrow-tr" size={14} />} />
            <Row title="Vibia ES" sub="Lighting · Spain" right={<Icon name="arrow-tr" size={14} />} />
            <Row title="Falcon Joinery" sub="Joinery · UAE" right={<Icon name="arrow-tr" size={14} />} />
            <Row title="Kvadrat" sub="Fabric · Denmark" right={<Icon name="arrow-tr" size={14} />} />
          </Card>

          <Card>
            <Eyebrow>Vetted vendor cycle</Eyebrow>
            <div className="h-p is-dim" style={{ fontSize: 13 }}>
              Each vendor is reviewed every 12 months for capacity, compliance, and pricing.
              Status visible here is the latest cycle result.
            </div>
            <Sep />
            <BarLine label="Compliance current" right="22 of 22" pct={100} />
            <BarLine label="Cycle complete" right="14 of 22" pct={64} />
          </Card>
        </div>
      </PortalShell>
    </div>
  );
}

export function FinishesMatflowPage() { return <MatflowPage project={VELA_PROJECT} />; }
export function AdvisoryMatflowPage() { return <MatflowPage project={NAQAA_PROJECT} />; }
