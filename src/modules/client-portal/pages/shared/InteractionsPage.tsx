import { useParams } from 'react-router-dom';
import { PortalShell, PageHead, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Sep, Eyebrow, Mono, Row,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { Icon, type IconName } from '../../components/Icon';
import { VELA_PROJECT, NAQAA_PROJECT } from '../../fixtures/projects';
import { usePortalProjectShell } from '../../hooks/usePortalProjectShell';
import { usePortalInteractions, type InteractionEntry } from '../../hooks/usePortalInteractions';
import '../../styles/portal.css';

interface InteractionsPageProps { project: PortalProject; }

interface LogEntry {
  id: string;
  kind: 'Call' | 'Visit' | 'Email' | 'Decision' | 'Meeting';
  title: string;
  with: string;
  on: string;
  body: string;
  star?: boolean;
}

const VELA_LOG: LogEntry[] = [
  { id: 'INT-031', kind: 'Decision', title: 'Stone slab upgrade to 20mm', with: 'You · D. Wahab', on: '7 May', body: 'Client confirmed during the 7 May call. Triggers Q-019 v2. Locks Wk 15 install slot.', star: true },
  { id: 'INT-030', kind: 'Visit',    title: 'Site walk · Wk 13',         with: 'D. Wahab · M. Othmani', on: '8 May', body: '90-minute walkthrough. Photos uploaded. Veneer direction agreed for cashwrap.' },
  { id: 'INT-029', kind: 'Call',     title: 'Lighting finish review',    with: 'Vibia ES + D. Wahab',   on: '6 May', body: '30 min. Bronze vs black finish to be decided after sample arrives on 14 May.' },
  { id: 'INT-028', kind: 'Email',    title: 'IFC sealed · MEP first fix',with: 'Contractor',             on: '4 May', body: 'IFC-08 Rev B distributed; inspection booked for 2 Jun.' },
  { id: 'INT-027', kind: 'Meeting',  title: 'Weekly progress · Wk 12',   with: 'Project team',           on: '2 May', body: 'Procurement at 94%. Construction 51%. No variance against baseline.' },
];

const NAQAA_LOG: LogEntry[] = [
  { id: 'INT-044', kind: 'Decision', title: 'Approve BOQ pack v3 for Naqaa-08 & 09', with: 'You · Naqaa CFO', on: '12 May', body: 'Pricing locked with vendors for 14 days. Joinery & lighting LOAs ready.', star: true },
  { id: 'INT-043', kind: 'Meeting',  title: 'Monthly steerco · May',       with: 'Naqaa board + delivery',   on: '8 May',  body: 'Stage gate review for Naqaa-08, 09. Q3 hand-over plan reviewed.' },
  { id: 'INT-042', kind: 'Visit',    title: 'Naqaa-04 walk · Avenues',     with: 'CD KSA + ops',             on: '6 May',  body: 'Storefront sign misalignment raised as SNG-022.' },
  { id: 'INT-041', kind: 'Call',     title: 'Vendor consolidation review', with: 'Naqaa procurement',        on: '4 May',  body: '22 active vendors. 8 onboarding. -0.8% variance vs BOQ.' },
  { id: 'INT-040', kind: 'Email',    title: 'Phase 2 progress update',     with: 'Distribution list',         on: '2 May',  body: 'Sent to 12 stakeholders. 3 stores live · 2 in fit-out.' },
];

// ── Live page (route-driven) ────────────────────────────────

export default function InteractionsPage(_props?: InteractionsPageProps) {
  // Two render modes: when called from the route (named exports below
  // pass a fixed project), the URL :code is also present and live
  // data is fetched. When called outside the route (preview canvas),
  // `_props.project` is used and live data falls back to mock.
  const params = useParams<{ code?: string }>();
  const { project: shellProject, loading: shellLoading } = usePortalProjectShell();
  const { entries: liveEntries, loading: entriesLoading } = usePortalInteractions(params.code);

  // Outside a route → use the fixture project supplied by the
  // named wrapper; show mock log.
  if (!params.code && _props?.project) {
    const log = _props.project.line === 'advisory' ? NAQAA_LOG : VELA_LOG;
    return <View project={_props.project} mock={log} live={null} loading={false} />;
  }

  const project = shellProject;
  const live = liveEntries;
  // Live entries empty + still loading → loading state. Live empty +
  // done loading → fall back to mock data so the page never looks
  // empty even before staff have logged any real activity.
  const showMock = !shellLoading && !entriesLoading && live.length === 0;
  return (
    <View
      project={project}
      mock={showMock ? (project.line === 'advisory' ? NAQAA_LOG : VELA_LOG) : null}
      live={showMock ? null : live}
      loading={shellLoading || entriesLoading}
    />
  );
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  project: PortalProject;
  mock: LogEntry[] | null;
  live: InteractionEntry[] | null;
  loading: boolean;
}

function View({ project, mock, live, loading }: ViewProps) {
  const isLive = live !== null;
  const all = isLive
    ? (live ?? [])
    : (mock ?? []);
  const total = all.length;
  const decisionsCount = countLive(all, ['Decision', 'Signoff']);
  const callsCount = countMock(mock, ['Call']);
  const visitsCount = countMock(mock, ['Visit']);
  const emailsCount = countMock(mock, ['Email']);
  const meetingsCount = countMock(mock, ['Meeting']);
  const issuedCount = countLive(all, ['Issued', 'Quote', 'Update']);

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        crumbs={[project.line === 'advisory' ? 'Advisory' : 'Finishes', project.name, 'Interactions']}
        title="Interactions"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">Export log</Btn>
            <Btn primary sm icon="plus">Log interaction</Btn>
          </>
        }
      >
        <PageHead
          eyebrow={isLive
            ? 'Activity timeline · approvals · signoffs · variations'
            : 'Decision log · meetings · calls · site visits'}
          title={loading
            ? 'Loading interactions…'
            : `${total} interaction${total === 1 ? '' : 's'}${isLive ? ' · derived from your project record' : ' · last 14 days'}`}
          sub={isLive
            ? 'A continuous record of every approval, drawing issue, and variation that shaped this project. Manual entries (calls, visits, meetings) are coming next round.'
            : 'A continuous record of every conversation that shaped this project. Filter to decisions for an audit trail.'}
        />

        {isLive ? (
          <div className="h-grid cols-4" style={{ gap: 14 }}>
            <Stat label="Decisions" value={decisionsCount} sub="signoffs + variation responses" />
            <Stat label="Issued items" value={issuedCount} sub="drawings · quotes · events" />
            <Stat
              label="Latest entry"
              value={isLive && all[0] ? (all[0] as InteractionEntry).dateLabel.split('·')[0]?.trim() ?? '—' : '—'}
              sub={all[0]?.kind ?? '—'}
            />
            <Stat label="Total" value={total} sub="rolling all time" />
          </div>
        ) : (
          <div className="h-grid cols-4" style={{ gap: 14 }}>
            <Stat label="Decisions" value={decisionsCount} sub="logged this cycle" />
            <Stat label="Calls" value={callsCount} sub="incl. supplier" />
            <Stat label="Site visits" value={visitsCount} sub="documented" />
            <Stat label="Emails" value={emailsCount} sub="logged" />
          </div>
        )}

        <Tabs items={[
          { l: 'All', c: total, on: true },
          ...(isLive
            ? [
                { l: 'Decisions', c: decisionsCount },
                { l: 'Issued', c: issuedCount },
              ]
            : [
                { l: 'Decisions', c: decisionsCount },
                { l: 'Visits', c: visitsCount },
                { l: 'Calls', c: callsCount },
                { l: 'Emails', c: emailsCount },
                { l: 'Meetings', c: meetingsCount },
              ]),
        ]} />

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card>
            <Eyebrow>Recent client decisions</Eyebrow>
            {(isLive ? (live ?? []).filter((l) => l.star) : (mock ?? []).filter((l) => l.star)).slice(0, 4).map((l) => (
              <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Mono style={{ color: 'var(--ink-3)' }}>{l.id} · {isLive ? (l as InteractionEntry).dateLabel : (l as LogEntry).on}</Mono>
                <div style={{ font: '600 16px/1.25 var(--font-display)', letterSpacing: '-0.02em' }}>
                  {l.title}
                </div>
                <div className="h-p is-dim" style={{ fontSize: 13 }}>{l.body}</div>
              </div>
            ))}
            <Sep />
            <Btn sm>Promote to changelog</Btn>
          </Card>

          <Pane title="Recent interactions" flush>
            <Tbl
              cols={[
                { l: 'Type', w: '90px' },
                { l: 'Subject', w: '3fr' },
                { l: 'With', w: '1.4fr' },
                { l: 'When', w: '110px', a: 'right' },
              ]}
              rows={all.slice(0, 20).map((l) => ({
                cells: [
                  <Mono>{(l as InteractionEntry).kind ?? (l as LogEntry).kind}</Mono>,
                  <Cell t={l.title} s={(l.body || '').slice(0, 80) + ((l.body || '').length > 80 ? '…' : '')} />,
                  isLive ? (l as InteractionEntry).with : (l as LogEntry).with,
                  <CellNum>{isLive ? (l as InteractionEntry).dateLabel.split('·')[0].trim() : (l as LogEntry).on}</CellNum>,
                ],
              }))}
            />
          </Pane>
        </div>

        <Pane title="Timeline" action={isLive ? 'Live · derived from project history' : 'View as gantt →'}>
          {all.map((l) => (
            <Row
              key={l.id}
              icon={iconForKind(isLive ? (l as InteractionEntry).kind : (l as LogEntry).kind)}
              title={l.title}
              sub={`${l.id} · ${(l as InteractionEntry).kind ?? (l as LogEntry).kind} · ${isLive ? (l as InteractionEntry).with : (l as LogEntry).with}`}
              right={isLive ? (l as InteractionEntry).dateLabel.split('·')[0].trim() : (l as LogEntry).on}
              rightSub={<Icon name="arrow-r" size={12} color="var(--ink-3)" />}
            />
          ))}
          {!loading && all.length === 0 ? (
            <Mono>No activity recorded yet on this project.</Mono>
          ) : null}
        </Pane>
      </PortalShell>
    </div>
  );
}

function iconForKind(kind: string): IconName {
  switch (kind) {
    case 'Decision': return 'star';
    case 'Signoff':  return 'check';
    case 'Issued':   return 'doc';
    case 'Quote':    return 'doc';
    case 'Visit':    return 'pin';
    case 'Call':     return 'chat';
    case 'Email':    return 'mail';
    case 'Meeting':  return 'calendar';
    default:         return 'star';
  }
}

function countLive(entries: Array<InteractionEntry | LogEntry>, kinds: string[]): number {
  return entries.filter((e) => kinds.includes((e as InteractionEntry).kind ?? (e as LogEntry).kind)).length;
}

function countMock(mock: LogEntry[] | null, kinds: string[]): number {
  if (!mock) return 0;
  return mock.filter((e) => kinds.includes(e.kind)).length;
}

export function FinishesInteractionsPage() { return <InteractionsPage project={VELA_PROJECT} />; }
export function AdvisoryInteractionsPage() { return <InteractionsPage project={NAQAA_PROJECT} />; }
