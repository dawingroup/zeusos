// ============================================================================
// ExperimentDialogs — create + edit surfaces for AuthoredSpinoff experiments.
//
// Exports two components:
//   - NewExperimentDialog: 3-step wizard to spawn an experiment under a
//     source strategy doc + optional theme.
//   - ExperimentDetailDrawer: right-side drawer to edit every field of an
//     existing experiment, including linking it to a tracked KPI.
//
// Both are dumb: they own their own form state and emit a final spinoff
// payload (plus the source doc id) so the caller can persist via the
// strategyReviewService. KPI linking uses the existing KPILinkPicker.
// ============================================================================

import * as React from 'react';
import {
  X,
  ArrowRight,
  Check,
  Link2,
  AlertTriangle,
  Trash2,
  Scale,
} from 'lucide-react';
import type { AuthoredSpinoff, StrategyReviewData } from '../../types/strategy.types';
import { KPILinkPicker } from './KPILinkPicker';

// ── Shared style + helpers ─────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  background: 'var(--bg-surface)',
  fontSize: 13,
  color: 'var(--fg-primary)',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 600,
  color: 'var(--fg-tertiary)',
  display: 'block',
  marginBottom: 4,
};

type Stage = AuthoredSpinoff['stage'];
type Decision = NonNullable<AuthoredSpinoff['decision']>;

const STAGES: Stage[] = ['brief', 'running', 'learning', 'decided'];
const STAGE_LABEL: Record<Stage, string> = {
  brief: 'Brief',
  running: 'Running',
  learning: 'Learning',
  decided: 'Decided',
};

const DECISIONS: Array<{ id: Decision; label: string; glyph: string; color: string }> = [
  { id: 'promote', label: 'Promote', glyph: '↑', color: 'var(--rag-green)' },
  { id: 'iterate', label: 'Iterate', glyph: '↺', color: 'var(--rag-amber)' },
  { id: 'pause',   label: 'Pause',   glyph: '∥', color: 'var(--rag-na)' },
  { id: 'kill',    label: 'Kill',    glyph: '×', color: 'var(--rag-red)' },
];

// ── Minimal source-doc shape we need ────────────────────────────────────

export interface ExperimentSourceDocRef {
  id: string;
  title: string;
  strategicThemes?: StrategyReviewData['strategicThemes'];
}

// ── KPI resolution shape (kept narrow) ──────────────────────────────────

export interface ExperimentKPIResolved {
  id: string;
  label: string;
  value: string;
  target?: string;
  status?: 'green' | 'amber' | 'red';
}

// ── NewExperimentDialog ─────────────────────────────────────────────────

export interface NewExperimentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Strategy docs available to attach the experiment to. */
  sourceDocs: ExperimentSourceDocRef[];
  /** Persist the new experiment. Caller picks the right strategyReview
   *  service call (saveReview / updateReview). */
  onCreate: (params: {
    sourceDocId: string;
    spinoff: AuthoredSpinoff;
  }) => Promise<void> | void;
}

export const NewExperimentDialog: React.FC<NewExperimentDialogProps> = ({
  open,
  onClose,
  sourceDocs,
  onCreate,
}) => {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [sourceDocId, setSourceDocId] = React.useState('');
  const [themeId, setThemeId] = React.useState('');
  const [name, setName] = React.useState('');
  const [hypothesis, setHypothesis] = React.useState('');
  const [mechanism, setMechanism] = React.useState('');
  const [metric, setMetric] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [current, setCurrent] = React.useState('');
  const [owner, setOwner] = React.useState('');
  const [sub, setSub] = React.useState('');
  const [timebox, setTimebox] = React.useState('12 wks');
  const [stage, setStage] = React.useState<Stage>('brief');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setSourceDocId(sourceDocs[0]?.id ?? '');
    setThemeId('');
    setName('');
    setHypothesis('');
    setMechanism('');
    setMetric('');
    setTarget('');
    setCurrent('');
    setOwner('');
    setSub('');
    setTimebox('12 wks');
    setStage('brief');
    setSubmitting(false);
  }, [open, sourceDocs]);

  if (!open) return null;

  const sourceDoc = sourceDocs.find((d) => d.id === sourceDocId);
  const themes = sourceDoc?.strategicThemes ?? [];
  const canAdvance = !!sourceDocId;
  const canSubmit = !!sourceDocId && name.trim().length > 0 && hypothesis.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const spinoff: AuthoredSpinoff = {
        id: `SP-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        parent: themeId || sourceDocId,
        name: name.trim(),
        hypothesis: hypothesis.trim(),
        mechanism: mechanism.trim(),
        metric: metric.trim(),
        target: target || undefined,
        current: current || undefined,
        owner: owner.trim(),
        sub: sub || undefined,
        timebox: timebox || undefined,
        stage,
        confidence: 50,
        sourceDoc: sourceDocId,
      };
      await onCreate({ sourceDocId, spinoff });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20, 20, 22, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 90,
        }}
      />
      <div
        role="dialog"
        aria-label="New experiment"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(640px, 92vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(20, 20, 22, 0.16)',
          zIndex: 95,
        }}
      >
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>New experiment</h3>
            <div className="text-tertiary" style={{ fontSize: 12.5, marginTop: 2 }}>
              Step {step} of 2 ·{' '}
              {step === 1 ? 'Source doc + theme' : 'Hypothesis + metric'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: 'auto',
              padding: 6,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: 'var(--fg-tertiary)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {step === 1 ? (
            <>
              <div>
                <label style={labelStyle}>Source strategy document</label>
                {sourceDocs.length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      border: '1px dashed var(--border-default)',
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: 'var(--fg-tertiary)',
                    }}
                  >
                    No strategy documents available. Create one first under <b>/strategy/plans</b>.
                  </div>
                ) : (
                  <select
                    value={sourceDocId}
                    onChange={(e) => {
                      setSourceDocId(e.target.value);
                      setThemeId('');
                    }}
                    style={inputStyle}
                  >
                    {sourceDocs.map((d) => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label style={labelStyle}>Parent theme · optional</label>
                {themes.length === 0 ? (
                  <div className="text-tertiary" style={{ fontSize: 12 }}>
                    The selected doc has no themes — the experiment will roll up to the doc directly.
                  </div>
                ) : (
                  <select value={themeId} onChange={(e) => setThemeId(e.target.value)} style={inputStyle}>
                    <option value="">— No theme link —</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id} · {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div
                className="text-tertiary"
                style={{ fontSize: 11.5, padding: 12, background: 'var(--bg-sunken)', borderRadius: 6, lineHeight: 1.55 }}
              >
                Experiments are how thematic objectives get achieved. Each is a hypothesis with a clock — it runs, generates evidence, then returns a learning that edits the spine.
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Experiment name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g. "Hospitality framework deal"'
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Hypothesis — the bet</label>
                <textarea
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="What we believe will be true if this test succeeds."
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Mechanism — how we test</label>
                <textarea
                  value={mechanism}
                  onChange={(e) => setMechanism(e.target.value)}
                  placeholder="The structured test we run + what we measure."
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Metric moved</label>
                  <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="e.g. UG premium share" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Current</label>
                  <input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="—" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Target</label>
                  <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="—" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Owner</label>
                  <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sub</label>
                  <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="DF" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Timebox</label>
                  <input value={timebox} onChange={(e) => setTimebox(e.target.value)} placeholder="12 wks" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Stage</label>
                  <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} style={inputStyle}>
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            gap: 8,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2].map((s) => (
              <span
                key={s}
                style={{
                  width: 24,
                  height: 4,
                  borderRadius: 2,
                  background: s <= step ? 'var(--accent)' : 'var(--border-default)',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                Back
              </button>
            )}
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!canAdvance}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--fg-primary)',
                  background: 'var(--fg-primary)',
                  color: '#fff',
                  cursor: canAdvance ? 'pointer' : 'not-allowed',
                  fontSize: 12.5,
                  fontWeight: 500,
                  opacity: canAdvance ? 1 : 0.5,
                }}
              >
                Next <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--accent)',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  fontSize: 12.5,
                  fontWeight: 600,
                  opacity: canSubmit && !submitting ? 1 : 0.5,
                }}
              >
                <Check className="h-3 w-3" /> {submitting ? 'Creating…' : 'Create experiment'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ── ExperimentDetailDrawer ──────────────────────────────────────────────

export interface ExperimentDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Experiment being viewed/edited (null when drawer is closed). */
  spinoff: AuthoredSpinoff | null;
  /** Source doc id this experiment belongs to. */
  sourceDocId: string | null;
  /** Persist edits. */
  onSave: (params: {
    sourceDocId: string;
    spinoff: AuthoredSpinoff;
  }) => Promise<void> | void;
  /** Delete the experiment from its source doc. */
  onDelete?: (params: { sourceDocId: string; spinoffId: string }) => Promise<void> | void;
  /** Resolve a tracked KPI id → display fields (lets the drawer show
   *  live KPI status when linked). */
  resolveLinkedKpi?: (id: string) => ExperimentKPIResolved | null;
  /** Company id — passed through to the embedded KPILinkPicker. */
  companyId: string;
}

export const ExperimentDetailDrawer: React.FC<ExperimentDetailDrawerProps> = ({
  open,
  onClose,
  spinoff,
  sourceDocId,
  onSave,
  onDelete,
  resolveLinkedKpi,
  companyId,
}) => {
  const [draft, setDraft] = React.useState<AuthoredSpinoff | null>(spinoff);
  const [saving, setSaving] = React.useState(false);
  const [kpiPickerOpen, setKpiPickerOpen] = React.useState(false);

  React.useEffect(() => {
    setDraft(spinoff);
    setSaving(false);
  }, [spinoff?.id, open]);

  if (!open || !draft || !sourceDocId) return null;

  const patch = (p: Partial<AuthoredSpinoff>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));

  const resolved = draft.linkedKpiId && resolveLinkedKpi ? resolveLinkedKpi(draft.linkedKpiId) : null;
  const isLinked = !!draft.linkedKpiId;

  const handleSave = async () => {
    if (!draft || !sourceDocId) return;
    setSaving(true);
    try {
      await onSave({ sourceDocId, spinoff: draft });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20, 20, 22, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 90,
        }}
      />
      <div
        role="dialog"
        aria-label="Experiment detail"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          boxShadow: '-8px 0 32px rgba(20, 20, 22, 0.16)',
          zIndex: 95,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Head */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="text-mono"
                style={{ fontSize: 10.5, color: 'var(--fg-tertiary)', letterSpacing: '0.08em', fontWeight: 700 }}
              >
                {draft.id} · {STAGE_LABEL[draft.stage]}
              </div>
              <input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Experiment name"
                style={{
                  ...inputStyle,
                  border: 0,
                  padding: '4px 0',
                  fontSize: 17,
                  fontWeight: 600,
                  background: 'transparent',
                }}
              />
              {draft.sourceAnalysis && (
                <a
                  href="/strategy/options"
                  title={`Spawned from options analysis ${draft.sourceAnalysis}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 4,
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontSize: 10.5,
                    fontWeight: 600,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    border: '1px solid var(--accent)',
                    width: 'fit-content',
                  }}
                >
                  <Scale className="h-3 w-3" />
                  From analysis · {draft.sourceAnalysis}
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                padding: 6,
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                color: 'var(--fg-tertiary)',
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hypothesis */}
          <div>
            <label style={labelStyle}>Hypothesis · the bet</label>
            <textarea
              value={draft.hypothesis}
              onChange={(e) => patch({ hypothesis: e.target.value })}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          {/* Mechanism */}
          <div>
            <label style={labelStyle}>Mechanism · how we test</label>
            <textarea
              value={draft.mechanism}
              onChange={(e) => patch({ mechanism: e.target.value })}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          {/* Linked KPI block */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${isLinked ? 'var(--accent)' : 'var(--border-default)'}`,
              background: isLinked ? 'var(--accent-soft)' : 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Link2 className="h-3.5 w-3.5" style={{ color: isLinked ? 'var(--accent)' : 'var(--fg-tertiary)' }} />
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isLinked ? 'var(--accent)' : 'var(--fg-tertiary)',
                }}
              >
                {isLinked ? 'Linked tracked KPI' : 'Not linked to a tracked KPI'}
              </div>
              <span style={{ flex: 1 }} />
              {isLinked ? (
                <>
                  <button
                    onClick={() => setKpiPickerOpen(true)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--accent)',
                      background: 'transparent',
                      color: 'var(--accent)',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Change
                  </button>
                  <button
                    onClick={() => patch({ linkedKpiId: undefined })}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-surface)',
                      color: 'var(--fg-secondary)',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Unlink
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setKpiPickerOpen(true)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--accent)',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Link tracked KPI
                </button>
              )}
            </div>
            {isLinked && resolved ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 8, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{resolved.label}</div>
                  <div className="text-tertiary" style={{ fontSize: 11, marginTop: 1 }}>
                    {draft.linkedKpiId}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-tertiary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Current
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{resolved.value}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-tertiary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Target
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{resolved.target ?? '—'}</div>
                </div>
              </div>
            ) : isLinked && !resolved ? (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                  fontSize: 11.5,
                  color: 'var(--rag-amber)',
                }}
              >
                <AlertTriangle className="h-3 w-3" style={{ marginTop: 2 }} />
                <span>
                  Linked KPI <code>{draft.linkedKpiId}</code> couldn't be loaded — it may have been archived. Re-link or fall back to the free-text metric below.
                </span>
              </div>
            ) : (
              <div className="text-tertiary" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                Tie this experiment to a tracked KPI so its result feeds the scorecard automatically. Otherwise use the free-text metric below.
              </div>
            )}
          </div>

          {/* Metric · free-text fallback */}
          <div>
            <label style={labelStyle}>Metric moved {isLinked && resolved ? '· override' : ''}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <input value={draft.metric} onChange={(e) => patch({ metric: e.target.value })} placeholder="Metric label" style={inputStyle} />
              <input value={draft.current ?? ''} onChange={(e) => patch({ current: e.target.value })} placeholder="current" style={inputStyle} />
              <input value={draft.target ?? ''} onChange={(e) => patch({ target: e.target.value })} placeholder="target" style={inputStyle} />
            </div>
          </div>

          {/* Stage / Decision / Confidence */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Stage</label>
              <select value={draft.stage} onChange={(e) => patch({ stage: e.target.value as Stage })} style={inputStyle}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Decision</label>
              <select
                value={draft.decision ?? ''}
                onChange={(e) => patch({ decision: (e.target.value || undefined) as Decision | undefined })}
                style={inputStyle}
                disabled={draft.stage !== 'decided'}
              >
                <option value="">—</option>
                {DECISIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.glyph} {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Confidence (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.confidence ?? 50}
                onChange={(e) => patch({ confidence: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Owner / Sub / Timebox */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Owner</label>
              <input value={draft.owner} onChange={(e) => patch({ owner: e.target.value })} placeholder="Name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Sub</label>
              <input value={draft.sub ?? ''} onChange={(e) => patch({ sub: e.target.value })} placeholder="DF" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Timebox</label>
              <input value={draft.timebox ?? ''} onChange={(e) => patch({ timebox: e.target.value })} placeholder="12 wks" style={inputStyle} />
            </div>
          </div>

          {/* Start / End */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Started</label>
              <input value={draft.started ?? ''} onChange={(e) => patch({ started: e.target.value })} placeholder="08 Apr" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Ends</label>
              <input value={draft.ends ?? ''} onChange={(e) => patch({ ends: e.target.value })} placeholder="01 Jul" style={inputStyle} />
            </div>
          </div>

          {/* Evidence */}
          <div>
            <label style={labelStyle}>Evidence · what we've learned</label>
            <textarea
              value={draft.evidence ?? ''}
              onChange={(e) => patch({ evidence: e.target.value })}
              placeholder="Drop the data, the surprises, the next step here."
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            gap: 8,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {onDelete ? (
            <button
              onClick={() =>
                onDelete({ sourceDocId, spinoffId: draft.id })
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--rag-red)',
                background: 'transparent',
                color: 'var(--rag-red)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--accent)',
                background: 'var(--accent)',
                color: '#fff',
                cursor: saving ? 'wait' : 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Check className="h-3 w-3" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Embedded KPI picker — overlays the drawer */}
      <KPILinkPicker
        open={kpiPickerOpen}
        onClose={() => setKpiPickerOpen(false)}
        companyId={companyId}
        alreadyBoundIds={[]}
        onPick={(kpi) => {
          patch({ linkedKpiId: kpi.id, metric: kpi.name });
          setKpiPickerOpen(false);
        }}
      />
    </>
  );
};
