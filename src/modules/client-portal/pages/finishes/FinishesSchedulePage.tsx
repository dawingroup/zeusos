import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import { Btn, Pane, Stat, Row, Card, Eyebrow, Mono } from '../../components/primitives';
import { Tabs } from '../../components/Table';
import { Gantt } from '../../components/Gantt';
import { VELA_PROJECT } from '../../fixtures/projects';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  useFinishesPortalSchedule,
  type PortalScheduleData,
  type PortalGanttRow,
} from '../../hooks/useFinishesPortalSchedule';
import type { DesignProject, ProjectMilestone, ProjectRisk } from '@/modules/design-manager/types';
import { tsToDate } from '../../utils/dates';
import '../../styles/portal.css';

/**
 * Schedule (Gantt) page. Mock mode → wireframe fixtures for
 * /portal/preview. Live mode → derived from project.milestones[],
 * phaseCompletion[], baselineDate, dueDate via useFinishesPortalSchedule.
 */
export default function FinishesSchedulePage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useFinishesPortalSchedule(params.code);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) return <ScheduleView mode="mock" project={VELA_PROJECT} />;
  if (loading || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return <ScheduleView mode="live" project={dataToShellProject(data.project)} data={data} />;
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalScheduleData;
}

function ScheduleView({ mode, project, data }: ViewProps) {
  const live = mode === 'live' && data;

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        crumbs={['Finishes', project.name, 'Schedule']}
        title="Programme"
        actions={
          <>
            <Btn sm>Baseline view</Btn>
            <Btn sm icon="download">Export PDF</Btn>
          </>
        }
      >
        <PageHead
          eyebrow={live
            ? `${data!.weeksTotal} weeks · current Wk ${data!.weekToday} · ${formatRange(data!.baselineDate, data!.dueDate)}`
            : '22 weeks · current Wk 14 · 4 Feb – 11 Jul 2026'}
          title={live ? statusTitle(data!) : 'On schedule'}
          sub={live ? statusSub(data!) : '0 days variance against baseline. Stone install is the current critical path — gated by Q-019 signoff.'}
        />

        <div className="h-grid cols-3" style={{ gap: 14 }}>
          <Stat
            label="Status"
            value={live ? statusValue(data!.varianceDays) : 'On schedule'}
            sub={live ? varianceSub(data!.varianceDays) : '0 days variance'}
            signal={live ? data!.varianceDays < -3 : false}
          />
          <Stat
            label="Baseline"
            value={live ? `${data!.weeksTotal} weeks` : '22 weeks'}
            sub={live ? formatRange(data!.baselineDate, data!.dueDate) : '4 Feb – 11 Jul 2026'}
          />
          <Stat
            label="Critical path"
            value={live ? data!.criticalPath : 'Stone install'}
            sub={live ? criticalPathSub(data!) : 'Wk 15 · gated by Q-019'}
            signal={live ? data!.criticalPath !== 'None' : true}
          />
        </div>

        <Tabs items={[
          { l: live ? `Weekly · ${data!.weeksTotal} wk` : 'Weekly · 22 wk', on: true },
          { l: 'Daily · 4 wk' },
          { l: 'Monthly' },
          { l: 'Baseline vs actual' },
        ]} />

        <Pane title="Programme" action={live ? `Week ${data!.weekToday} · today` : 'Week 14 · today'} flush>
          {live
            ? <LiveGantt rows={data!.ganttRows} cols={data!.ganttCols} todayPct={data!.todayPct} />
            : <MockGantt />}
        </Pane>

        <div className="h-grid cols-2" style={{ gap: 16 }}>
          <Pane title={live ? `Milestones · next ${data!.upcomingMilestones.length || ''} weeks` : 'Milestones · next 8 weeks'}>
            {live
              ? <LiveMilestones rows={data!.upcomingMilestones} />
              : <MockMilestones />}
          </Pane>
          <Pane title={live ? `Risks · ${data!.risks.length} open` : 'Risks · 3 open'}>
            {live
              ? <LiveRisks rows={data!.risks} />
              : <MockRisks />}
          </Pane>
        </div>
      </PortalShell>
    </div>
  );
}

// ── Live sub-views ──────────────────────────────────────────

function LiveGantt({ rows, cols, todayPct }: { rows: PortalGanttRow[]; cols: string[]; todayPct: number }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <Eyebrow>No phase data yet</Eyebrow>
        <div className="h-p is-dim" style={{ marginTop: 8, fontSize: 13 }}>
          Phase completion will populate once the team starts tracking progress.
        </div>
      </div>
    );
  }
  return (
    <Gantt
      cols={cols}
      todayPct={todayPct}
      rows={rows.map((r) => ({
        t: r.label,
        s: r.sub,
        start: r.start,
        end: r.end,
        pct: r.pct,
        signal: r.signal,
        label: r.barLabel,
      }))}
    />
  );
}

function LiveMilestones({ rows }: { rows: ProjectMilestone[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '12px 0' }}>
        <Mono>Nothing scheduled in the next 8 weeks.</Mono>
      </div>
    );
  }
  return (
    <>
      {rows.map((m) => (
        <Row
          key={m.id}
          title={m.label}
          sub={milestoneSub(m)}
          right={m.weekLabel ?? '—'}
        />
      ))}
    </>
  );
}

function LiveRisks({ rows }: { rows: ProjectRisk[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '12px 0' }}>
        <Mono>No open risks tracked.</Mono>
      </div>
    );
  }
  return (
    <>
      {rows.map((r) => (
        <Row
          key={r.id}
          title={r.title}
          sub={r.mitigation}
          right={severityLabel(r.severity)}
          attn={r.severity === 'high'}
          dim={r.severity === 'low'}
        />
      ))}
    </>
  );
}

// ── Mock sub-views (wireframe fixtures) ─────────────────────

function MockGantt() {
  return (
    <Gantt
      cols={['W1', 'W3', 'W5', 'W7', 'W9', 'W11', 'W13', 'W15', 'W17', 'W19', 'W21', 'W22']}
      todayPct={64}
      rows={[
        { t: 'Design',              s: 'W1–W5 · sealed',   start: 0,  end: 22, pct: 100, label: 'Sealed' },
        { t: 'Procurement',         s: 'W3–W14 · 94%',     start: 9,  end: 64, pct: 94,  label: '94%' },
        { t: 'Site setup & demo',   s: 'W6–W7 · done',     start: 22, end: 32, pct: 100, label: 'Done' },
        { t: 'MEP first fix',       s: 'W8–W12 · done',    start: 32, end: 55, pct: 100, label: 'Done' },
        { t: 'Joinery install',     s: 'W15 · upcoming',   start: 64, end: 73, pct: 0,   signal: true, label: 'Starts 22 May' },
        { t: 'Stone install',       s: 'W15–W17 · gated',  start: 64, end: 77, pct: 0,   signal: true, label: 'Gated by Q-019' },
        { t: 'Lighting install',    s: 'W16–W18',          start: 68, end: 82, pct: 0 },
        { t: 'Finishing & paint',   s: 'W17–W20',          start: 73, end: 91, pct: 0 },
        { t: 'FF&E install',        s: 'W19–W21',          start: 82, end: 95, pct: 0 },
        { t: 'Snagging & handover', s: 'W21–W22 · 11 Jul', start: 91, end: 100, pct: 0 },
      ]}
    />
  );
}

function MockMilestones() {
  return (
    <>
      <Row title="Joinery install starts" sub="22 May · 4 days · zone A,B" right="Wk 15" />
      <Row title="Stone delivered to site" sub="26 May · supplier ETA" right="Wk 15" />
      <Row title="MEP final fix" sub="14 Jun · inspection scheduled" right="Wk 18" />
      <Row title="Practical completion" sub="11 Jul · handover walk" right="Wk 22" />
    </>
  );
}

function MockRisks() {
  return (
    <>
      <Row attn title="Stone slot dependent on Q-019 signoff" sub="Mitigation: client review 16 May" right="High" />
      <Row title="Lighting finish decision pending" sub="Mitigation: site visit 12 May" right="Med" />
      <Row dim title="Supplier longshoring delay risk" sub="Italy → Jebel Ali · 4 days buffer" right="Low" />
    </>
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

function statusTitle(d: PortalScheduleData): string {
  if (Math.abs(d.varianceDays) <= 3) return 'On schedule';
  return d.varianceDays > 0 ? 'Ahead of schedule' : 'Behind schedule';
}

function statusValue(varianceDays: number): string {
  if (Math.abs(varianceDays) <= 3) return 'On schedule';
  return varianceDays > 0 ? 'Ahead' : 'Behind';
}

function varianceSub(varianceDays: number): string {
  if (Math.abs(varianceDays) <= 3) return '0 days variance';
  return `${Math.abs(varianceDays)} day${Math.abs(varianceDays) === 1 ? '' : 's'} ${varianceDays > 0 ? 'ahead' : 'behind'}`;
}

function statusSub(d: PortalScheduleData): string {
  const bits: string[] = [];
  if (Math.abs(d.varianceDays) <= 3) bits.push('0 days variance against baseline.');
  else bits.push(`${Math.abs(d.varianceDays)} days ${d.varianceDays > 0 ? 'ahead' : 'behind'} baseline.`);
  if (d.criticalPath !== 'None') bits.push(`${d.criticalPath} is the current critical path.`);
  return bits.join(' ');
}

function criticalPathSub(d: PortalScheduleData): string {
  const row = d.ganttRows.find((r) => r.signal);
  if (!row) return 'No blockers';
  const w = Math.round((row.start / 100) * d.weeksTotal) + 1;
  return `Wk ${w} · ${row.barLabel ?? 'gated'}`;
}

function formatRange(from: Date | undefined, to: Date | undefined): string {
  if (!from || !to) return '—';
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(from)} – ${fmt(to)}`;
}

function milestoneSub(m: ProjectMilestone): string | undefined {
  const parts: string[] = [];
  const md = tsToDate(m.date);
  if (md) parts.push(md.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  if (m.detail) parts.push(m.detail);
  return parts.join(' · ') || undefined;
}

function severityLabel(s: ProjectRisk['severity']): string {
  return s === 'high' ? 'High' : s === 'medium' ? 'Med' : 'Low';
}

// ── Loading / error states ──────────────────────────────────

function LoadingState({ project }: { project: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Loading…', tag: project, sub: '', line: 'finishes' }}
        title="Programme"
        dataMode="live"
      >
        <Card>
          <Eyebrow>Loading schedule…</Eyebrow>
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
        title="Programme"
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
