import { useParams } from 'react-router-dom';
import { PortalShell, type PortalProject as P } from '../../components/DesktopShell';
import {
  Btn, Pane, Card, Chip, Sep, Eyebrow, Mono, SignalLine,
} from '../../components/primitives';
import { DemoBanner } from '../../components/DemoBanner';
import { VELA_PROJECT, NAQAA_PROJECT } from '../../fixtures/projects';
import { usePortalProjectShell } from '../../hooks/usePortalProjectShell';
import '../../styles/portal.css';

interface MessagesPageProps { project: P; }

interface Thread {
  id: string;
  with: string;
  role: string;
  subject: string;
  preview: string;
  unread: number;
  last: string;
  attn?: boolean;
  selected?: boolean;
}

const VELA_THREADS: Thread[] = [
  { id: 'T-007', with: 'D. Wahab',     role: 'Project director',  subject: 'Q-019 v2 stone variation',     preview: "Updated slab thickness. Quick review when you have a moment — locks the install slot.", unread: 2, last: '14:22', attn: true, selected: true },
  { id: 'T-006', with: 'M. Othmani',   role: 'Site supervisor',   subject: 'Wk 14 walk · photos uploaded', preview: 'Sent the latest walk photos. MEP first fix looks clean.', unread: 0, last: '11:08' },
  { id: 'T-005', with: 'Vibia ES',     role: 'Lighting supplier', subject: 'Bronze finish sample ETA',     preview: "Sample arriving DXB on 14 May. We'll meet on site once it's in.", unread: 1, last: 'Yesterday' },
  { id: 'T-004', with: 'Falcon Joinery', role: 'Joinery contractor', subject: 'Joinery install plan · Wk 15', preview: '4 fitters · 4 days. Will brief tomorrow morning.', unread: 0, last: '9 May' },
  { id: 'T-003', with: 'Marmi Bruno',  role: 'Stone supplier',    subject: 'Calacatta shipment notice',    preview: 'Sailed from Genova 8 May. ETA Jebel Ali 22 May.', unread: 0, last: '8 May' },
];

const NAQAA_THREADS: Thread[] = [
  { id: 'T-021', with: 'Naqaa CFO',         role: 'Client lead',  subject: 'BOQ pack v3 questions',  preview: 'Two clarifications on the Naqaa-08 lighting line items before sign.', unread: 3, last: '15:48', attn: true, selected: true },
  { id: 'T-020', with: 'CD KSA',            role: 'Country Director', subject: 'Storefront sign issue · Naqaa-04', preview: 'Vendor re-fix scheduled Tuesday. Costing absorbed in retention.', unread: 1, last: '11:30' },
  { id: 'T-019', with: 'Naqaa procurement', role: 'Procurement',  subject: 'Vendor consolidation review', preview: 'Recommended onboarding 3 more vendors before Phase 3. Memo attached.', unread: 0, last: 'Yesterday' },
  { id: 'T-018', with: 'CD UAE',            role: 'Country Director', subject: 'Yas Mall progress · Wk 2', preview: 'Site ready for fit-out. Lighting layout final check sent.', unread: 0, last: '8 May' },
  { id: 'T-017', with: 'D. Wahab',          role: 'Programme director', subject: 'May steerco prep',    preview: "Slides drafted. We'll cover RAG, vendor, Phase 3 cut-off.", unread: 0, last: '6 May' },
];

export default function MessagesPage({ project: fixtureProject }: MessagesPageProps) {
  const params = useParams<{ code?: string }>();
  const { project: shellProject } = usePortalProjectShell();
  const project = params.code ? shellProject : fixtureProject;
  const threads = project.line === 'advisory' ? NAQAA_THREADS : VELA_THREADS;
  const selected = threads.find((t) => t.selected) ?? threads[0];
  const unread = threads.reduce((acc, t) => acc + t.unread, 0);

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        crumbs={[project.line === 'advisory' ? 'Advisory' : 'Finishes', project.name, 'Messages']}
        title="Messages"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn primary sm icon="plus">New message</Btn>
          </>
        }
      >
        {params.code ? (
          <DemoBanner
            source="the threaded messaging service (planned: clientPortalMessages with real-time updates)"
            hint={<>For now, your project director will reply by email or WhatsApp.</>}
          />
        ) : null}
        <div className="h-grid" style={{ gridTemplateColumns: '380px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <Pane title="Inbox" action={`${unread} unread`} flush>
            <div className="h-inbox">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={'h-inbox-i' + (t.attn ? ' is-signal' : '') + (t.selected ? ' is-on' : '')}
                >
                  <div className="h-inbox-i-h">
                    <span className="h-inbox-i-tag">{t.with} · {t.role}</span>
                    <span className="h-inbox-i-due">{t.last}</span>
                  </div>
                  <div className="h-inbox-i-t">{t.subject}</div>
                  <div className="h-inbox-i-s">{t.preview}</div>
                  {t.unread > 0 ? (
                    <div className="h-inbox-i-m">
                      <span className="h-badge">{t.unread} new</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Pane>

          <Pane title={selected.subject} action="Open in new tab ↗">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selected.attn ? <SignalLine>Needs your reply</SignalLine> : <Eyebrow>Thread · {selected.id}</Eyebrow>}
                <div className="h-d4" style={{ marginTop: 2 }}>{selected.subject}</div>
                <Mono>{selected.with} · {selected.role} · last activity {selected.last}</Mono>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Chip outline>Star</Chip>
                <Chip outline>Mark resolved</Chip>
              </div>
            </div>

            <Sep />

            <ThreadEntry
              who={selected.with}
              role={selected.role}
              when={selected.last}
              body={selected.preview}
            />
            <ThreadEntry
              who={'You'}
              role={'Client'}
              when={'Earlier today'}
              body={'Thanks — opening Q-019 v2 now. Will sign once I check the slab spec vs the storefront line.'}
              you
            />
            <ThreadEntry
              who={selected.with}
              role={selected.role}
              when={'Yesterday'}
              body={'No rush — we held the install slot. Just flag if anything else is needed.'}
            />

            <Sep />

            <Card>
              <Eyebrow>Reply to thread</Eyebrow>
              <div style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '12px 14px',
                font: '400 13px/1.5 var(--font-sans)',
                color: 'var(--ink-3)',
                minHeight: 96,
              }}>Type a reply…</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn sm icon="paperclip">Attach</Btn>
                  <Btn sm>@ mention</Btn>
                </div>
                <Btn primary sm iconRight="send">Send reply</Btn>
              </div>
            </Card>
          </Pane>
        </div>
      </PortalShell>
    </div>
  );
}

function ThreadEntry({ who, role, when, body, you }: { who: string; role: string; when: string; body: string; you?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      paddingBottom: 8,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 18, flex: '0 0 36px',
        background: you
          ? 'var(--ink)'
          : 'linear-gradient(135deg, #d4b896 0%, #8a6f55 100%)',
        color: you ? 'var(--paper)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: '600 13px/1 var(--font-sans)',
      }}>{you ? 'Y' : who.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Mono style={{ color: 'var(--ink-2)' }}>
            <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{who}</span> · {role}
          </Mono>
          <Mono>{when}</Mono>
        </div>
        <div className="h-p" style={{ fontSize: 13.5, marginTop: 6 }}>{body}</div>
      </div>
    </div>
  );
}

export function FinishesMessagesPage() { return <MessagesPage project={VELA_PROJECT} />; }
export function AdvisoryMessagesPage() { return <MessagesPage project={NAQAA_PROJECT} />; }
