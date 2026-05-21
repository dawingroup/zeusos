import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PortalShell, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Card, Pane, Sep, Chip, SignalLine, Eyebrow, Mono, Row,
} from '../../components/primitives';
import { DrawingViewer } from '../../components/DrawingViewer';
import { Icon } from '../../components/Icon';
import { RejectDialog } from '../../components/RejectDialog';
import { VELA_PROJECT } from '../../fixtures/projects';
import { tsToDate } from '../../utils/dates';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  useFinishesPortalDrawing,
  type DrawingItem,
} from '../../hooks/useFinishesPortalDrawings';
import { useDrawingPins } from '../../hooks/useDrawingPins';
import type { DrawingPin } from '@/modules/customer-hub/services/client-portal/drawingPinsService';
import {
  approveSignOffFromPortal,
  rejectSignOffFromPortal,
} from '@/modules/customer-hub/services/client-portal/portalApprovalActions';
import type { DesignProject } from '@/modules/design-manager/types';
import '../../styles/portal.css';

/**
 * Drawing detail. Mock mode → wireframe fixture (SD-104). Live mode →
 * resolves the drawing by URL id (signOff number slug) via
 * useFinishesPortalDrawing, renders details + sign / reject actions
 * that share the same Approvals service.
 */
export default function FinishesDrawingPage() {
  const params = useParams<{ code?: string; id?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { drawing, loading, error } = useFinishesPortalDrawing(params.code, params.id);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) return <DrawingDetailView mode="mock" project={VELA_PROJECT} />;
  if (loading || authLoading) return <LoadingState code={params.code} />;
  if (error) return <ErrorState code={params.code} message={error.message} />;
  if (!drawing) return <ErrorState code={params.code} message={`Drawing ${params.id} not found`} />;

  return <DrawingDetailView mode="live" project={{
    name: params.code, tag: params.code, sub: '', slug: params.code, line: 'finishes',
  }} drawing={drawing} projectCode={params.code} />;
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  drawing?: DrawingItem;
  projectCode?: string;
}

function DrawingDetailView({ mode, project, drawing, projectCode }: ViewProps) {
  const live = mode === 'live' && drawing;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const actionable = live && drawing.bucket === 'awaiting';

  // Pins are only live-meaningful for live drawings. In mock mode the
  // hook is given `undefined` and returns an empty state so the
  // showcase route renders the wireframe fixture instead.
  const isClient = !user?.email?.endsWith('@zeusgroup.co.ug');
  const drawingPins = useDrawingPins({
    signOffId: live ? drawing.id : undefined,
    isClient,
  });

  // "Drop pin" mode + the modal used to capture the first comment.
  const [dropMode, setDropMode] = useState(false);
  const [dropPosition, setDropPosition] = useState<{ x: number; y: number } | null>(null);
  const [submittingPin, setSubmittingPin] = useState(false);

  // Which pin (by id) is currently focused in the side panel.
  const [activePinId, setActivePinId] = useState<string | null>(null);

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        crumbs={['Finishes', project.name, 'Plans & drawings', live ? drawing!.number : 'SD-104']}
        title={live ? `${drawing!.number} · ${drawing!.title}` : 'SD-104 · Cashwrap joinery'}
        actions={
          <>
            <Btn sm icon="download">Download</Btn>
            {!live ? <Btn sm>Compare to Rev B</Btn> : null}
            {actionable ? (
              <Btn signal iconRight="check" onClick={() => setPendingAction('approve')}>
                Sign v{drawing!.designVersion}
              </Btn>
            ) : !live ? (
              <Btn signal iconRight="check">Sign Rev C</Btn>
            ) : null}
          </>
        }
      >
        <div className="h-grid" style={{ gridTemplateColumns: '1fr 360px', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="h-segment">
                  <div className="h-segment-i">Plan</div>
                  <div className="h-segment-i is-on">Elev. A</div>
                  <div className="h-segment-i">Elev. B</div>
                  <div className="h-segment-i">Section</div>
                  <div className="h-segment-i">3D</div>
                </div>
                <Mono style={{ color: 'var(--ink-3)' }}>
                  {live
                    ? `${drawing!.documentCount} ${drawing!.documentCount === 1 ? 'sheet' : 'sheets'} · 1:20 @ A3`
                    : 'Sheet 2 of 4 · 1:20 @ A3'}
                </Mono>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {live ? (
                  <Chip active>v{drawing!.designVersion}</Chip>
                ) : (
                  <>
                    <Chip outline>Rev A</Chip>
                    <Chip outline>Rev B</Chip>
                    <Chip active>Rev C</Chip>
                    <Chip outline quiet>Rev D draft</Chip>
                  </>
                )}
              </div>
            </div>

            <DrawingViewer
              kind="elevation"
              pins={live
                ? drawingPins.pins.map((p) => ({
                    id: p.id,
                    n: p.n,
                    x: p.x, y: p.y,
                    signal: p.id === activePinId && p.status === 'open',
                    resolved: p.status === 'resolved',
                    onClick: () => setActivePinId(p.id),
                  }))
                : [
                    { n: 1, x: 32, y: 38 },
                    { n: 2, x: 56, y: 55, signal: true },
                    { n: 3, x: 72, y: 78 },
                  ]
              }
              dropMode={dropMode}
              onDropPin={(x, y) => {
                setDropPosition({ x, y });
                setDropMode(false);
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn
                  sm
                  icon="pin"
                  primary={dropMode}
                  onClick={() => setDropMode((v) => !v)}
                  disabled={!live}
                >{dropMode ? 'Cancel pin' : 'Add pin'}</Btn>
                <Btn sm icon="pencil" disabled>Annotate</Btn>
                <Btn sm disabled>Measure</Btn>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Mono style={{ color: 'var(--fg-tertiary)' }}>
                  {live
                    ? pinSummary(drawingPins.pins)
                    : '3 pins · 2 unresolved'}
                </Mono>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 0,
            overflow: 'auto',
          }}>
            {live ? <LiveDetailCard d={drawing!} /> : <MockDetailCard />}

            {live ? <LiveDocsPane d={drawing!} /> : null}

            {live ? (
              <LivePinsPanel
                pins={drawingPins.pins}
                loading={drawingPins.loading}
                activeId={activePinId}
                onSelect={setActivePinId}
                onReply={async (pinId, body) => {
                  try {
                    await drawingPins.addComment(pinId, body);
                  } catch (err) {
                    setToast({
                      kind: 'err',
                      message: `Failed to reply: ${(err as Error).message}`,
                    });
                    setTimeout(() => setToast(null), 6000);
                  }
                }}
                onResolve={async (pinId) => {
                  try {
                    await drawingPins.resolvePin(pinId);
                    setToast({ kind: 'ok', message: 'Pin resolved.' });
                    setTimeout(() => setToast(null), 3000);
                  } catch (err) {
                    setToast({
                      kind: 'err',
                      message: `Failed to resolve: ${(err as Error).message}`,
                    });
                    setTimeout(() => setToast(null), 6000);
                  }
                }}
                onReopen={async (pinId) => {
                  try { await drawingPins.reopenPin(pinId); }
                  catch (err) {
                    setToast({
                      kind: 'err',
                      message: `Failed to reopen: ${(err as Error).message}`,
                    });
                    setTimeout(() => setToast(null), 6000);
                  }
                }}
              />
            ) : <MockPinComments />}

            {actionable ? (
              <Pane title="Actions">
                <div className="h-p is-dim" style={{ fontSize: 13 }}>
                  Review the drawing then sign at this revision, or reject with a reason to send it back to the team.
                </div>
                <Sep />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn sm onClick={() => setPendingAction('reject')}>Reject</Btn>
                  <Btn
                    signal
                    sm
                    iconRight="check"
                    onClick={() => setPendingAction('approve')}
                  >Sign v{drawing!.designVersion}</Btn>
                </div>
              </Pane>
            ) : null}
          </div>
        </div>

        {toast ? (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: toast.kind === 'ok' ? 'var(--ink)' : 'var(--signal)',
            color: '#fff',
            padding: '14px 18px',
            borderRadius: 12,
            font: '500 13px/1.3 var(--font-sans)',
            zIndex: 900,
            boxShadow: '0 20px 40px -15px rgba(20,18,14,0.45)',
            maxWidth: 360,
          }}>{toast.message}</div>
        ) : null}

        {/* Drop-pin dialog — captures the first comment at the click
            position the user dropped on the viewer. Reuses RejectDialog
            for its layout + the same UX patterns (mandatory text, ESC
            to close, async error surface). */}
        <RejectDialog
          open={dropPosition !== null}
          title={`Drop a pin · ${drawing?.number ?? ''}`}
          description={dropPosition
            ? `Position ${dropPosition.x.toFixed(1)}%, ${dropPosition.y.toFixed(1)}% on the drawing. Write a short note so the team knows what you want them to look at.`
            : ''}
          confirmLabel={submittingPin ? 'Posting…' : 'Drop pin'}
          confirmPrimary
          reasonRequired
          reasonPlaceholder="What's this pin about? e.g. 'Confirm POS cable cut-out width'"
          onClose={() => {
            if (!submittingPin) {
              setDropPosition(null);
            }
          }}
          onConfirm={async (body) => {
            if (!dropPosition || !drawing) return;
            setSubmittingPin(true);
            try {
              const newPin = await drawingPins.addPin({
                x: dropPosition.x,
                y: dropPosition.y,
                firstComment: body,
              });
              if (newPin) {
                setActivePinId(newPin.id);
                setToast({ kind: 'ok', message: `Pin ${newPin.n} dropped.` });
                setTimeout(() => setToast(null), 3000);
              }
              setDropPosition(null);
            } catch (err) {
              setToast({
                kind: 'err',
                message: `Failed to drop pin: ${(err as Error).message}`,
              });
              setTimeout(() => setToast(null), 6000);
              throw err;
            } finally {
              setSubmittingPin(false);
            }
          }}
        />

        <RejectDialog
          open={pendingAction !== null}
          title={pendingAction === 'approve'
            ? `Approve ${drawing?.number ?? ''} · ${drawing?.title ?? ''}`
            : `Reject ${drawing?.number ?? ''} · ${drawing?.title ?? ''}`}
          description={pendingAction === 'approve'
            ? 'Signing approves this drawing at the current revision. The team will move into fabrication.'
            : 'Reject this drawing — the team will revise and re-issue with your reason recorded in the history.'}
          confirmLabel={pendingAction === 'approve' ? 'Sign & approve' : 'Reject'}
          confirmSignal={pendingAction === 'reject'}
          confirmPrimary={pendingAction === 'approve'}
          reasonRequired={pendingAction === 'reject'}
          reasonPlaceholder={pendingAction === 'reject'
            ? 'What needs to change before we can approve?'
            : 'Optional: any context for the team'}
          onClose={() => setPendingAction(null)}
          onConfirm={async (reason) => {
            if (!drawing || !user || !pendingAction) return;
            try {
              if (pendingAction === 'approve') {
                await approveSignOffFromPortal(drawing.id, user, { notes: reason || undefined });
              } else {
                await rejectSignOffFromPortal(drawing.id, user, reason);
              }
              setToast({
                kind: 'ok',
                message: pendingAction === 'approve'
                  ? `Approved · ${drawing.number} v${drawing.designVersion}`
                  : `Rejected · ${drawing.number} v${drawing.designVersion}`,
              });
              setTimeout(() => setToast(null), 4000);
              // Bounce back to the index so the bucket counts refresh.
              setTimeout(() => navigate(`/portal/p/${projectCode}/drawings`), 800);
            } catch (err) {
              setToast({
                kind: 'err',
                message: `Failed to ${pendingAction}: ${(err as Error).message}`,
              });
              setTimeout(() => setToast(null), 6000);
              throw err;
            }
          }}
        />
      </PortalShell>
    </div>
  );
}

// ── Live sub-views ──────────────────────────────────────────

function LiveDetailCard({ d }: { d: DrawingItem }) {
  const isAwaiting = d.bucket === 'awaiting';
  return (
    <Card signal={isAwaiting}>
      {isAwaiting
        ? <SignalLine>Signoff required{d.expiresAt ? ` · due ${d.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</SignalLine>
        : <Eyebrow>{statusEyebrow(d.bucket)}</Eyebrow>}
      <div className="h-d4" style={{ fontSize: 22 }}>Revision v{d.designVersion}</div>
      <div className="h-p is-dim">
        {d.description || 'No description provided.'}
      </div>
      <Sep />
      <div className="h-grid cols-3" style={{ gap: 10 }}>
        <div>
          <Eyebrow style={{ fontSize: 9.5 }}>Issued</Eyebrow>
          <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 4 }}>
            {d.issuedAt ? d.issuedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
          </div>
          <Mono style={{ fontSize: 11 }}>{d.raw.createdBy}</Mono>
        </div>
        <div>
          <Eyebrow style={{ fontSize: 9.5 }}>Sheets</Eyebrow>
          <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 4 }}>{d.documentCount}</div>
          <Mono style={{ fontSize: 11 }}>
            {d.documentCount === 0 ? '—' : `${d.documentCount} ${d.documentCount === 1 ? 'doc' : 'docs'}`}
          </Mono>
        </div>
        <div>
          <Eyebrow style={{ fontSize: 9.5 }}>Scope</Eyebrow>
          <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 4 }}>v{d.scopeVersion}</div>
          <Mono style={{ fontSize: 11 }}>contract rev</Mono>
        </div>
      </div>
    </Card>
  );
}

function LiveDocsPane({ d }: { d: DrawingItem }) {
  const docs = d.raw.designDocuments ?? [];
  return (
    <Pane title="Documents" action={`${docs.length} attached`}>
      {docs.length === 0 ? (
        <div className="h-p is-dim" style={{ fontSize: 13 }}>No documents attached to this revision.</div>
      ) : docs.map((doc) => (
        <Row
          key={doc.id}
          icon="doc"
          title={doc.fileName}
          sub={doc.description || doc.type.replace(/_/g, ' ')}
          right={<Icon name="arrow-r" size={14} color="var(--ink-3)" />}
        />
      ))}
    </Pane>
  );
}

// ── Live pin panel ──────────────────────────────────────────

interface LivePinsPanelProps {
  pins: DrawingPin[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onReply: (pinId: string, body: string) => Promise<void>;
  onResolve: (pinId: string) => Promise<void>;
  onReopen: (pinId: string) => Promise<void>;
}

function LivePinsPanel({ pins, loading, activeId, onSelect, onReply, onResolve, onReopen }: LivePinsPanelProps) {
  const open = pins.filter((p) => p.status === 'open');
  const action = pins.length === 0
    ? 'None yet'
    : `${open.length} open · ${pins.length - open.length} resolved`;

  if (loading && pins.length === 0) {
    return (
      <Pane title="Pin comments" action="Loading…">
        <Mono>Loading…</Mono>
      </Pane>
    );
  }

  if (pins.length === 0) {
    return (
      <Pane title="Pin comments" action="Tap Add pin then click the drawing">
        <div className="h-p is-dim" style={{ fontSize: 13 }}>
          No pins on this revision yet. Drop a pin on the drawing to ask a question or flag something
          to the team — they get notified and reply inline.
        </div>
      </Pane>
    );
  }

  return (
    <Pane title="Pin comments" action={action}>
      {pins.map((p, i) => (
        <div key={p.id} style={{ paddingTop: i === 0 ? 0 : 4 }}>
          {i > 0 ? <Sep style={{ marginBottom: 12 }} /> : null}
          <PinThread
            pin={p}
            isActive={activeId === p.id}
            onActivate={() => onSelect(p.id)}
            onReply={(body) => onReply(p.id, body)}
            onResolve={() => onResolve(p.id)}
            onReopen={() => onReopen(p.id)}
          />
        </div>
      ))}
    </Pane>
  );
}

function PinThread({
  pin, isActive, onActivate, onReply, onResolve, onReopen,
}: {
  pin: DrawingPin;
  isActive: boolean;
  onActivate: () => void;
  onReply: (body: string) => Promise<void>;
  onResolve: () => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<'resolve' | 'reopen' | null>(null);
  const resolved = pin.status === 'resolved';

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await onReply(body);
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={() => !isActive && onActivate()}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        cursor: isActive ? 'default' : 'pointer',
        padding: isActive ? 12 : 0,
        margin: isActive ? '-12px -12px 0' : 0,
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--bg-sunken)' : 'transparent',
        transition: 'background 120ms',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 14, flex: '0 0 28px',
        background: resolved ? 'var(--bg-sunken)' : 'var(--accent)',
        color: resolved ? 'var(--fg-tertiary)' : 'var(--accent-fg)',
        border: resolved
          ? '1.5px solid var(--border-default)'
          : '1.5px solid var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: '600 12px/1 var(--font-sans)',
      }}>{pin.n}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div style={{ font: '500 13px/1.3 var(--font-sans)' }}>
            {(pin.comments[0]?.body || 'Pin').slice(0, 80)}
            {(pin.comments[0]?.body || '').length > 80 ? '…' : ''}
          </div>
          {resolved ? (
            <Chip>Resolved</Chip>
          ) : null}
        </div>
        <Mono style={{ marginTop: 2 }}>
          {pin.createdByName} · {formatRel(tsToDate(pin.createdAt))}
          {pin.comments.length > 1 ? ` · ${pin.comments.length - 1} ${pin.comments.length - 1 === 1 ? 'reply' : 'replies'}` : ''}
        </Mono>

        {isActive ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {pin.comments.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <Mono style={{ color: 'var(--fg-tertiary)' }}>
                  {i === 0 ? '①' : '↳'} {c.byName} · {formatRel(tsToDate(c.at))}
                  {c.isClient ? ' · client' : ' · team'}
                </Mono>
                <div className="h-p" style={{ fontSize: 13, marginTop: 2 }}>{c.body}</div>
              </div>
            ))}

            {!resolved ? (
              <form onSubmit={handleReply} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply to this pin…"
                  rows={2}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    font: '400 12.5px/1.4 var(--font-sans)',
                    color: 'var(--fg-primary)',
                    background: 'var(--bg-surface)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <Btn
                    sm
                    type="button"
                    onClick={async () => {
                      setBusy('resolve');
                      try { await onResolve(); } finally { setBusy(null); }
                    }}
                    disabled={busy === 'resolve'}
                  >Resolve</Btn>
                  <Btn
                    sm
                    type="submit"
                    primary
                    disabled={!draft.trim() || submitting}
                  >{submitting ? 'Posting…' : 'Reply'}</Btn>
                </div>
              </form>
            ) : (
              <div>
                <Btn
                  sm
                  type="button"
                  onClick={async () => {
                    setBusy('reopen');
                    try { await onReopen(); } finally { setBusy(null); }
                  }}
                  disabled={busy === 'reopen'}
                >Reopen pin</Btn>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function pinSummary(pins: DrawingPin[]): string {
  if (pins.length === 0) return 'No pins · click "Add pin" to drop one';
  const open = pins.filter((p) => p.status === 'open').length;
  return `${pins.length} pin${pins.length === 1 ? '' : 's'} · ${open} unresolved`;
}

function formatRel(d: Date | undefined): string {
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function statusEyebrow(b: DrawingItem['bucket']): string {
  switch (b) {
    case 'awaiting': return 'Awaiting signoff';
    case 'approved': return 'Signed';
    case 'superseded': return 'Superseded';
    case 'draft': return 'Draft';
  }
}

// ── Mock sub-views (wireframe fixtures) ─────────────────────

function MockDetailCard() {
  return (
    <Card signal>
      <SignalLine>Signoff required · due 18 May</SignalLine>
      <div className="h-d4" style={{ fontSize: 22 }}>Revision C</div>
      <div className="h-p is-dim">
        Veneer now runs vertically on front face per client direction.
        Cable tray detail updated to suit POS unit footprint.
      </div>
      <Sep />
      <div className="h-grid cols-3" style={{ gap: 10 }}>
        <div>
          <Eyebrow style={{ fontSize: 9.5 }}>Issued</Eyebrow>
          <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 4 }}>8 May</div>
          <Mono style={{ fontSize: 11 }}>D. Wahab</Mono>
        </div>
        <div>
          <Eyebrow style={{ fontSize: 9.5 }}>Sheets</Eyebrow>
          <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 4 }}>4</div>
          <Mono style={{ fontSize: 11 }}>plan · elev · section</Mono>
        </div>
        <div>
          <Eyebrow style={{ fontSize: 9.5 }}>Pins</Eyebrow>
          <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 4 }}>3</div>
          <Mono style={{ fontSize: 11 }}>2 open</Mono>
        </div>
      </div>
    </Card>
  );
}

function MockPinComments() {
  return (
    <Pane title="Pin comments" action="3 open">
      <PinComment n={1} signal={false} who="D. Wahab · 9 May 11:42" title="Grain match between panels"
        body="Workshop will book-match adjacent panels to keep grain reading horizontally across the run." />
      <Sep />
      <PinComment n={2} signal who="You · 8 May · 2 replies" title="Confirm POS cable cut-out"
        body="Need final dimensions for the cable management — POS unit is now wider than v1.">
        <Btn sm icon="comment" style={{ marginTop: 8 }}>Reply</Btn>
      </PinComment>
      <Sep />
      <PinComment n={3} signal={false} who="M. Othmani · 7 May" title="Plinth height confirmation" />
    </Pane>
  );
}

function PinComment({
  n, signal, who, title, body, children,
}: {
  n: number;
  signal: boolean;
  who: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 4 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14, flex: '0 0 28px',
        background: signal ? 'var(--signal)' : 'var(--surface)',
        color: signal ? '#fff' : 'var(--ink)',
        border: signal ? '1.5px solid var(--signal)' : '1.5px solid var(--ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '600 12px/1 var(--font-sans)',
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ font: '500 13px/1.3 var(--font-sans)' }}>{title}</div>
        <Mono style={{ marginTop: 2 }}>{who}</Mono>
        {body ? (
          <div className="h-p is-dim" style={{ fontSize: 12.5, marginTop: 6 }}>{body}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// ── Loading / error states ──────────────────────────────────

function LoadingState({ code }: { code: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: code, name: 'Loading…', tag: code, sub: '', line: 'finishes' }}
        title="Drawing"
        dataMode="live"
      >
        <Card>
          <Eyebrow>Loading drawing…</Eyebrow>
          <Mono>Resolving {code}</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}

function ErrorState({ code, message }: { code: string; message: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: code, name: 'Project', tag: code, sub: '', line: 'finishes' }}
        title="Drawing"
        dataMode="live"
      >
        <Card>
          <Eyebrow signal>Couldn't load — {message}</Eyebrow>
          <Mono>The drawing may have been removed or the URL may be wrong.</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}

// dataToShellProject not strictly needed; the live caller passes project
// based on URL params. Kept here for parity with other portal pages.
function _dataToShellProject(p: DesignProject): PortalProject {
  return {
    name: p.name, tag: p.code, sub: p.customerName, slug: p.code, line: 'finishes',
  };
}
void _dataToShellProject;
