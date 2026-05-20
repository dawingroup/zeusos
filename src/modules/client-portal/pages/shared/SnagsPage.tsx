import { useParams } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Img, Eyebrow, Mono, Sep,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { DemoBanner } from '../../components/DemoBanner';
import { VELA_PROJECT, NAQAA_PROJECT } from '../../fixtures/projects';
import { usePortalProjectShell } from '../../hooks/usePortalProjectShell';
import '../../styles/portal.css';

interface SnagPageProps {
  project: PortalProject;
}

interface Snag {
  id: string;
  title: string;
  zone: string;
  raisedBy: string;
  raisedOn: string;
  severity: 'High' | 'Med' | 'Low';
  status: 'Open' | 'In progress' | 'Verify' | 'Closed';
  tone: 'site' | 'interior-warm' | 'fabric' | 'render';
}

const VELA_SNAGS: Snag[] = [
  { id: 'SNG-014', title: 'Veneer joint visible · cashwrap front', zone: 'A', raisedBy: 'You',         raisedOn: '11 May', severity: 'High', status: 'Open',        tone: 'interior-warm' },
  { id: 'SNG-013', title: 'Floor level deviation 4mm',             zone: 'B', raisedBy: 'D. Wahab',    raisedOn: '10 May', severity: 'Med',  status: 'In progress', tone: 'site' },
  { id: 'SNG-012', title: 'Paint touch-up · banquette wall',       zone: 'C', raisedBy: 'M. Othmani',  raisedOn: '9 May',  severity: 'Low',  status: 'In progress', tone: 'fabric' },
  { id: 'SNG-011', title: 'Stone polish inconsistent · slab 2',    zone: 'A', raisedBy: 'You',         raisedOn: '8 May',  severity: 'Med',  status: 'Verify',      tone: 'render' },
  { id: 'SNG-010', title: 'Lighting dimmer flicker · track 4',     zone: 'A', raisedBy: 'D. Wahab',    raisedOn: '6 May',  severity: 'High', status: 'Closed',      tone: 'site' },
];

const NAQAA_SNAGS: Snag[] = [
  { id: 'SNG-022', title: 'Storefront sign misaligned · Naqaa-04',  zone: 'AVN', raisedBy: 'CD KSA',      raisedOn: '12 May', severity: 'High', status: 'Open',        tone: 'site' },
  { id: 'SNG-021', title: 'POS counter scratched on delivery',      zone: 'AVN', raisedBy: 'CD KSA',      raisedOn: '11 May', severity: 'Med',  status: 'In progress', tone: 'render' },
  { id: 'SNG-020', title: 'Lighting timer drift · Naqaa-05',        zone: 'YAS', raisedBy: 'CD UAE',      raisedOn: '10 May', severity: 'Low',  status: 'Open',        tone: 'fabric' },
  { id: 'SNG-019', title: 'Tile chip · entry threshold',            zone: 'AVN', raisedBy: 'D. Wahab',    raisedOn: '8 May',  severity: 'Low',  status: 'Verify',      tone: 'interior-warm' },
  { id: 'SNG-018', title: 'A/C noise above ambient · Naqaa-03',     zone: 'RIY', raisedBy: 'CD KSA',      raisedOn: '6 May',  severity: 'Med',  status: 'Closed',      tone: 'site' },
];

export default function SnagsPage({ project: fixtureProject }: SnagPageProps) {
  const params = useParams<{ code?: string }>();
  const { project: shellProject } = usePortalProjectShell();
  const project = params.code ? shellProject : fixtureProject;
  const snags = project.line === 'advisory' ? NAQAA_SNAGS : VELA_SNAGS;
  const open = snags.filter((s) => s.status === 'Open').length;
  const inProgress = snags.filter((s) => s.status === 'In progress').length;
  const verify = snags.filter((s) => s.status === 'Verify').length;
  const closed = snags.filter((s) => s.status === 'Closed').length;
  const high = snags.filter((s) => s.severity === 'High' && s.status !== 'Closed').length;

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        crumbs={[project.line === 'advisory' ? 'Advisory' : 'Finishes', 'Snags']}
        title="Snags"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn primary sm icon="plus">Raise snag</Btn>
          </>
        }
      >
        {params.code ? (
          <DemoBanner
            source="a project Snags subcollection (planned: designProjects/<id>/snags)"
            hint={<>The list and photos shown are illustrative.</>}
          />
        ) : null}

        <PageHead
          eyebrow={project.line === 'advisory' ? 'Programme-wide · 14 stores' : 'Punch list · Wk 14'}
          title={`${open + inProgress + verify} open snags`}
          sub={project.line === 'advisory'
            ? 'Raised by Country Directors across the rollout. High severity items are flagged for client review.'
            : 'Items raised during walk-throughs. Closed automatically after Verify + photo.'}
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Open" value={open} sub="awaiting action" signal={high > 0} />
          <Stat label="In progress" value={inProgress} sub="on contractor" />
          <Stat label="Verify" value={verify} sub="awaiting photo" />
          <Stat label="Closed" value={closed} sub="this project" />
        </div>

        <Tabs items={[
          { l: 'All', c: snags.length, on: true },
          { l: 'Open', c: open, signal: open > 0 },
          { l: 'In progress', c: inProgress },
          { l: 'Verify', c: verify },
          { l: 'Closed', c: closed },
        ]} />

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card signal={high > 0}>
            <Eyebrow signal={high > 0}>High severity · {high} open</Eyebrow>
            <div className="h-d4" style={{ marginTop: 6 }}>
              {project.line === 'advisory'
                ? 'Storefront alignment is blocking soft-opening at Naqaa-04.'
                : 'Cashwrap veneer joint visibility is gating final inspection.'}
            </div>
            <Sep />
            <div className="h-p is-dim">
              {project.line === 'advisory'
                ? 'CD KSA on site; vendor dispatched for re-fix Tuesday.'
                : 'Falcon Joinery scheduled to re-fix Saturday with grain match correction.'}
            </div>
            <Btn signal={high > 0} iconRight="arrow-r">View highest-severity items</Btn>
          </Card>

          <Pane title="Activity · this week" flush>
            <Tbl
              cols={[
                { l: 'Event', w: '2.5fr' },
                { l: 'Who', w: '1fr' },
                { l: 'When', w: '90px', a: 'right' },
              ]}
              rows={snags.slice(0, 4).map((s) => ({
                signal: s.severity === 'High' && s.status !== 'Closed',
                cells: [
                  <Cell t={`${s.id} raised`} s={s.title} />,
                  s.raisedBy,
                  <CellNum>{s.raisedOn}</CellNum>,
                ],
              }))}
            />
          </Pane>
        </div>

        <Pane title="Snag register" action={`${snags.length} items`} flush>
          <Tbl
            cols={[
              { l: 'Snag', w: '2.5fr' },
              { l: 'Zone', w: '70px' },
              { l: 'Raised by', w: '1fr' },
              { l: 'Severity', w: '90px' },
              { l: 'Date', w: '90px', a: 'right' },
              { l: 'Status', w: '120px', a: 'right' },
            ]}
            rows={snags.map((s) => ({
              signal: s.severity === 'High' && s.status !== 'Closed',
              dim: s.status === 'Closed',
              cells: [
                <Cell t={`${s.id} · ${s.title}`} />,
                <Mono>{s.zone}</Mono>,
                s.raisedBy,
                <Chip signal={s.severity === 'High'}>{s.severity}</Chip>,
                <CellNum>{s.raisedOn}</CellNum>,
                <Chip signal={s.status === 'Open'}>{s.status}</Chip>,
              ],
            }))}
          />
        </Pane>

        <Pane title="Photos · latest snag evidence" action="All photos →" flush>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 1,
            background: 'var(--line-2)',
          }}>
            {snags.slice(0, 5).map((s) => (
              <Img key={s.id} tone={s.tone} h={140} label={`${s.id} · zone ${s.zone}`} />
            ))}
          </div>
        </Pane>
      </PortalShell>
    </div>
  );
}

export function FinishesSnagsPage() {
  return <SnagsPage project={VELA_PROJECT} />;
}
export function AdvisorySnagsPage() {
  return <SnagsPage project={NAQAA_PROJECT} />;
}
