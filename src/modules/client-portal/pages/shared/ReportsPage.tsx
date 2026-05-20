import { useParams } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Pane, Card, Chip, Sep, Mono, Img, BarLine, Row,
} from '../../components/primitives';
import { Tabs } from '../../components/Table';
import { Icon } from '../../components/Icon';
import { DemoBanner } from '../../components/DemoBanner';
import { VELA_PROJECT, NAQAA_PROJECT } from '../../fixtures/projects';
import { usePortalProjectShell } from '../../hooks/usePortalProjectShell';
import '../../styles/portal.css';

interface ReportsPageProps { project: PortalProject; }

interface Report {
  code: string;
  title: string;
  period: string;
  date: string;
  pages: number;
  kind: 'Weekly' | 'Monthly' | 'Phase' | 'Ad-hoc';
  latest?: boolean;
}

const REPORTS: Record<'finishes' | 'advisory', Report[]> = {
  finishes: [
    { code: 'WR-14', title: 'Weekly report · Wk 14', period: '6–12 May 2026',  date: '13 May', pages: 8, kind: 'Weekly',  latest: true },
    { code: 'WR-13', title: 'Weekly report · Wk 13', period: '29 Apr–5 May',   date: '6 May',  pages: 8, kind: 'Weekly' },
    { code: 'WR-12', title: 'Weekly report · Wk 12', period: '22–28 Apr',      date: '29 Apr', pages: 8, kind: 'Weekly' },
    { code: 'MR-04', title: 'Monthly summary · April', period: 'April 2026',    date: '2 May',  pages: 22, kind: 'Monthly' },
    { code: 'PH-02', title: 'Phase 2 closeout · Procurement', period: 'Wk 3–13', date: '8 May',  pages: 18, kind: 'Phase' },
    { code: 'WR-11', title: 'Weekly report · Wk 11', period: '15–21 Apr',      date: '22 Apr', pages: 8, kind: 'Weekly' },
  ],
  advisory: [
    { code: 'MR-05', title: 'Monthly programme pack · May', period: 'May 2026', date: '13 May', pages: 36, kind: 'Monthly', latest: true },
    { code: 'WR-19', title: 'Weekly digest · Wk 19',         period: '6–12 May', date: '13 May', pages: 6, kind: 'Weekly' },
    { code: 'WR-18', title: 'Weekly digest · Wk 18',         period: '29 Apr–5 May', date: '6 May',  pages: 6, kind: 'Weekly' },
    { code: 'PH-02', title: 'Phase 2 mid-cycle review',      period: 'Phase 2', date: '4 May',  pages: 28, kind: 'Phase' },
    { code: 'MR-04', title: 'Monthly programme pack · April', period: 'April 2026', date: '2 May',  pages: 32, kind: 'Monthly' },
    { code: 'AD-01', title: 'Vendor consolidation memo',      period: 'Q2 review', date: '24 Apr', pages: 14, kind: 'Ad-hoc' },
  ],
};

export default function ReportsPage({ project: fixtureProject }: ReportsPageProps) {
  const params = useParams<{ code?: string }>();
  const { project: shellProject } = usePortalProjectShell();
  const project = params.code ? shellProject : fixtureProject;
  const reports = project.line === 'advisory' ? REPORTS.advisory : REPORTS.finishes;
  const latest = reports.find((r) => r.latest);

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        crumbs={[project.line === 'advisory' ? 'Advisory' : 'Finishes', 'Reports']}
        title="Reports"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn primary sm icon="plus">Subscribe to alerts</Btn>
          </>
        }
      >
        {params.code ? (
          <DemoBanner
            source="the Reports PDF service (planned: server-rendered weekly/monthly packs)"
            hint={<>Until then, ask your project director for the latest pack.</>}
          />
        ) : null}

        <PageHead
          eyebrow={project.line === 'advisory' ? 'Programme reporting · cadence: weekly + monthly' : 'Project reporting · cadence: weekly'}
          title="Report archive"
          sub="Every report ever issued for this project. Search by phase, type, or date."
        />

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          {latest && (
            <Card>
              <Mono style={{ color: 'var(--ink-3)' }}>LATEST · {latest.code}</Mono>
              <div style={{ font: '600 28px/1.1 var(--font-display)', marginTop: 6, letterSpacing: '-0.025em' }}>
                {latest.title}
              </div>
              <Mono>{latest.period} · {latest.pages} pages</Mono>
              <Sep />
              <div className="h-p is-dim" style={{ fontSize: 13 }}>
                {project.line === 'advisory'
                  ? 'Programme-level digest covering all 14 stores, capex commitments, and stage gates. 3 RAG-flagged risks.'
                  : 'Captures the joinery handoff, Q-019 stone variation, and the lighting decision still pending.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn primary icon="download">Download PDF</Btn>
                <Btn icon="paperclip">Open online</Btn>
              </div>
            </Card>
          )}

          <Pane title="Headlines · latest issue" flush>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {project.line === 'advisory' ? (
                <>
                  <BarLine label="Programme progress" right="28%" pct={28} />
                  <BarLine label="Capex committed" right="39%" pct={39} />
                  <BarLine label="Cost variance vs baseline" right="−0.7%" pct={50} />
                  <Sep />
                  <Row title="Stores live" sub="3 of 14 · 2 in fit-out" right="21%" />
                  <Row title="Open BOQ packs" sub="Naqaa-08, 09 · awaiting client" right="UGX 6.81Bn" attn />
                  <Row title="Vendor onboarding" sub="22 active · 8 in onboarding" right="22" />
                </>
              ) : (
                <>
                  <BarLine label="Overall progress" right="62%" pct={62} />
                  <BarLine label="Procurement" right="94%" pct={94} />
                  <BarLine label="Construction" right="58%" pct={58} />
                  <Sep />
                  <Row title="Approvals open" sub="3 awaiting client · 0 overdue" right="1.4d avg" attn />
                  <Row title="Snags this week" sub="2 new · 1 closed" right="3 open" />
                  <Row title="Schedule variance" sub="vs. 4 Feb baseline" right="0 days" />
                </>
              )}
            </div>
          </Pane>
        </div>

        <Tabs items={[
          { l: 'All', c: reports.length, on: true },
          { l: 'Weekly', c: reports.filter((r) => r.kind === 'Weekly').length },
          { l: 'Monthly', c: reports.filter((r) => r.kind === 'Monthly').length },
          { l: 'Phase', c: reports.filter((r) => r.kind === 'Phase').length },
          { l: 'Ad-hoc', c: reports.filter((r) => r.kind === 'Ad-hoc').length },
        ]} />

        <div className="h-grid cols-3" style={{ gap: 16 }}>
          {reports.map((r) => (
            <Card key={r.code} flush>
              <Img tone={r.kind === 'Monthly' ? 'render' : r.kind === 'Phase' ? 'interior' : 'interior-warm'} h={120} hero>
                <div style={{ position: 'absolute', top: 12, left: 12 }}>
                  <Chip outline style={{
                    background: 'rgba(250,250,247,0.85)',
                    font: '500 10px/1 var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>{r.kind}</Chip>
                </div>
                <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, color: '#fff' }}>
                  <Mono style={{ color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>{r.code}</Mono>
                  <div style={{ font: '600 16px/1.2 var(--font-display)', marginTop: 4, letterSpacing: '-0.015em' }}>
                    {r.title}
                  </div>
                </div>
              </Img>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Mono>{r.period}</Mono>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Mono style={{ color: 'var(--ink-3)' }}>{r.date} · {r.pages} pages</Mono>
                  <Icon name="download" size={14} color="var(--ink-2)" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PortalShell>
    </div>
  );
}

export function FinishesReportsPage() { return <ReportsPage project={VELA_PROJECT} />; }
export function AdvisoryReportsPage() { return <ReportsPage project={NAQAA_PROJECT} />; }
