// ============================================================================
// OptionsAnalysisEditor — author + score a single AuthoredOptionsAnalysis.
//
// Sized between an Experiment (timeboxed test) and a Financial Model
// (one set of numbers). The editor manages criteria + options + per-cell
// 0..5 scores, computes a weighted total per option, and surfaces the
// top-ranked option as a recommendation the user can override.
//
// One analysis per editor instance — the page-level tab manages the list.
// Persistence is the caller's responsibility (via strategyReviewService).
// ============================================================================

import * as React from 'react';
import {
  Plus,
  Trash2,
  Scale,
  Link2,
  Check,
  ArrowUpRight,
  Sparkles,
  Wallet,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import type {
  AuthoredOptionsAnalysis,
  OptionsAnalysisApprover,
  OptionsAnalysisCriterion,
  OptionsAnalysisOption,
  NPVAssessment,
} from '../../types/strategy.types';
import {
  analyzeStrategySection,
} from '../../services/strategyAI.service';
import { EXTENDED_SECTIONS } from '../../constants/sectionRegistry';

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ id: AuthoredOptionsAnalysis['status']; label: string; color: string }> = [
  { id: 'draft',     label: 'Draft',     color: 'var(--fg-tertiary)' },
  { id: 'in_review', label: 'In review', color: 'var(--rag-amber)' },
  { id: 'decided',   label: 'Decided',   color: 'var(--rag-green)' },
  { id: 'executing', label: 'Executing', color: 'var(--rag-blue)' },
];

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

/** Generate a short stable id. */
function shortId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`.toUpperCase();
}

/** Sum of all criterion weights. */
function totalWeight(criteria: OptionsAnalysisCriterion[]): number {
  return criteria.reduce((acc, c) => acc + (c.weight || 0), 0);
}

/** Compute the weighted total for an option. Uses normalised weights so
 *  the user can author with arbitrary weights and still get a 0..5 score. */
export function weightedScore(
  option: OptionsAnalysisOption,
  criteria: OptionsAnalysisCriterion[],
): number {
  const tot = totalWeight(criteria);
  if (tot <= 0) return 0;
  let sum = 0;
  for (const c of criteria) {
    const score = option.scores[c.id] ?? 0;
    sum += (c.weight / tot) * score;
  }
  return sum;
}

/**
 * Risk-adjusted NPV penalty per declared risk on an option.
 * Each risk knocks 10% off the NPV; capped so the floor is 50% of NPV
 * (a risk-laden option still keeps half its value rather than going to
 * zero — the user-authored mitigation work isn't modelled yet).
 *
 * TODO: replace with a configurable risk weighting once we add severity
 * to OptionsAnalysisOption.risks[] (currently strings).
 */
export function riskAdjustment(option: OptionsAnalysisOption): number {
  const n = option.risks?.length ?? 0;
  return Math.max(0.5, 1 - 0.1 * n);
}

/** Risk-adjusted NPV. Returns the base NPV when no risks are recorded. */
export function riskAdjustedNpv(
  option: OptionsAnalysisOption,
  npvAssessment: NPVAssessment | null | undefined,
): number | null {
  if (!npvAssessment) return null;
  return npvAssessment.npv * riskAdjustment(option);
}

/**
 * Heuristic criteria suggestions based on the decision question. Used as
 * a fallback when the AI service is unreachable, and as a deterministic
 * baseline when the AI response can't be parsed.
 */
export function suggestCriteriaHeuristic(question: string): OptionsAnalysisCriterion[] {
  const q = question.toLowerCase();
  const seen = new Set<string>();
  const out: Array<{ label: string; weight: number }> = [];
  const push = (label: string, weight: number) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, weight });
  };

  // Always-on baseline criteria.
  push('NPV', 0.3);
  push('Time-to-value', 0.2);
  push('Strategic fit', 0.2);

  // Topical additions based on keyword detection.
  if (/\b(vendor|supplier|outsourc|partner|3pl)\b/.test(q)) {
    push('Vendor lock-in', 0.1);
    push('SLA reliability', 0.1);
  }
  if (/\b(build|in-house|insourc|hire|manufactur)\b/.test(q)) {
    push('Internal capability fit', 0.1);
    push('Team capacity', 0.1);
  }
  if (/\b(buy|acquire|m&a|acquisition)\b/.test(q)) {
    push('Integration risk', 0.1);
    push('Culture fit', 0.1);
  }
  if (/\b(capex|capital|invest|cnc|machine|facility|plant)\b/.test(q)) {
    push('Capex envelope', 0.1);
    push('Utilisation upside', 0.1);
  }
  if (/\b(software|saas|platform|tech|migration|cloud)\b/.test(q)) {
    push('Switching cost', 0.1);
    push('Security & compliance', 0.1);
  }
  if (/\b(risk|regulat|compliance|legal)\b/.test(q)) {
    push('Regulatory exposure', 0.1);
  }

  // Normalise weights so they sum to 1.
  const total = out.reduce((acc, c) => acc + c.weight, 0);
  return out.map((c) => ({
    id: shortId('CR'),
    label: c.label,
    weight: Number((c.weight / total).toFixed(3)),
  }));
}

/**
 * Try to parse criteria out of the AI response. The endpoint shape is a
 * generic AIStrategyAnalysisResponse — we look for a JSON code block in
 * the message body, and fall back to suggestion titles otherwise.
 */
function parseAiCriteria(message: string, suggestionTitles: string[]): OptionsAnalysisCriterion[] {
  // 1. Try parsing a JSON code block with a `criteria` array.
  const jsonMatch = message.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed: unknown = JSON.parse(jsonMatch[1]);
      const arr: unknown[] | null = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { criteria?: unknown }).criteria)
        ? ((parsed as { criteria: unknown[] }).criteria)
        : null;
      if (arr) {
        type Cleaned = { label: string; weight?: number };
        const cleaned: Cleaned[] = arr
          .map((c: unknown): Cleaned | null => {
            if (typeof c === 'string') return { label: c };
            if (c && typeof c === 'object' && 'label' in c) {
              const o = c as { label: unknown; weight?: unknown };
              const lbl = typeof o.label === 'string' ? o.label.trim() : '';
              const w = typeof o.weight === 'number' ? o.weight : undefined;
              return lbl ? { label: lbl, weight: w } : null;
            }
            return null;
          })
          .filter((x): x is Cleaned => x !== null);
        if (cleaned.length > 0) {
          const totalProvided = cleaned.reduce((a: number, c: Cleaned) => a + (c.weight ?? 0), 0);
          const useProvided = totalProvided > 0;
          return cleaned.map((c: Cleaned, _i: number, all: Cleaned[]) => ({
            id: shortId('CR'),
            label: c.label,
            weight: useProvided
              ? Number(((c.weight ?? 0) / totalProvided).toFixed(3))
              : Number((1 / all.length).toFixed(3)),
          }));
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 2. Look for short bulleted lines like "- NPV (weight 0.3)" or "1. NPV".
  const lines = message
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+\.)\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+\.)\s+/, '').trim())
    .filter((l) => l.length > 0 && l.length < 80);

  const labels = lines.length > 0 ? lines : suggestionTitles.filter((t) => t && t.length < 80);
  if (labels.length === 0) return [];
  return labels.slice(0, 7).map((l, _i, arr) => ({
    id: shortId('CR'),
    label: l,
    weight: Number((1 / arr.length).toFixed(3)),
  }));
}

/** Default empty analysis factory. */
export function createEmptyOptionsAnalysis(
  sourceDocId: string,
  question = '',
  themeId?: string,
): AuthoredOptionsAnalysis {
  const now = new Date().toISOString();
  return {
    id: shortId('OA'),
    question,
    sourceDocId,
    themeId,
    criteria: [
      { id: shortId('CR'), label: 'NPV',             weight: 0.4 },
      { id: shortId('CR'), label: 'Time-to-value',   weight: 0.3 },
      { id: shortId('CR'), label: 'Strategic fit',   weight: 0.3 },
    ],
    options: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export interface OptionsAnalysisEditorProps {
  value: AuthoredOptionsAnalysis;
  onChange: (next: AuthoredOptionsAnalysis) => void;
  /** Available NPV assessments on the source doc, surfaced for option linking. */
  npvAssessments?: NPVAssessment[];
  /** Company id for the AI service. When omitted, the AI button still
   *  works but uses the deterministic heuristic fallback only. */
  companyId?: string;
  /** Review id for the AI service (defaults to the analysis id). */
  reviewId?: string;
  /**
   * Spawn a pilot spin-off experiment from this analysis. Caller persists
   * the resulting AuthoredSpinoff on the source doc with `sourceAnalysis`
   * pre-wired back to this analysis id.
   */
  onSpawnPilot?: (params: {
    analysis: AuthoredOptionsAnalysis;
    option: OptionsAnalysisOption;
  }) => void;
  /** Reserve a placeholder capital bucket. */
  onReserveCapital?: (params: {
    analysis: AuthoredOptionsAnalysis;
    option: OptionsAnalysisOption;
  }) => void;
}

export const OptionsAnalysisEditor: React.FC<OptionsAnalysisEditorProps> = ({
  value,
  onChange,
  npvAssessments = [],
  companyId,
  reviewId,
  onSpawnPilot,
  onReserveCapital,
}) => {
  const [drawerOptionId, setDrawerOptionId] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<'order' | 'score'>('score');
  const [aiSuggesting, setAiSuggesting] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  const patch = (p: Partial<AuthoredOptionsAnalysis>) =>
    onChange({ ...value, ...p, updatedAt: new Date().toISOString() });

  // ── Criteria mutators ───────────────────────────────────────────────────
  const addCriterion = () =>
    patch({
      criteria: [
        ...value.criteria,
        { id: shortId('CR'), label: 'New criterion', weight: 0.1 },
      ],
    });
  const removeCriterion = (id: string) => {
    // Also strip the matching score key off each option.
    const nextOptions = value.options.map((o) => {
      const next = { ...o.scores };
      delete next[id];
      return { ...o, scores: next };
    });
    patch({
      criteria: value.criteria.filter((c) => c.id !== id),
      options: nextOptions,
    });
  };
  const patchCriterion = (id: string, p: Partial<OptionsAnalysisCriterion>) =>
    patch({
      criteria: value.criteria.map((c) => (c.id === id ? { ...c, ...p } : c)),
    });
  const normalizeWeights = () => {
    const tot = totalWeight(value.criteria);
    if (tot <= 0) return;
    patch({
      criteria: value.criteria.map((c) => ({ ...c, weight: c.weight / tot })),
    });
  };

  /**
   * Ask the strategy AI for criteria, append (de-duplicated by label).
   * Falls back to the deterministic heuristic when the AI is unreachable
   * or returns nothing useful — so the button always advances the work.
   */
  const suggestCriteria = async () => {
    setAiSuggesting(true);
    setAiError(null);
    try {
      const existingLabels = new Set(value.criteria.map((c) => c.label.toLowerCase().trim()));
      let suggested: OptionsAnalysisCriterion[] = [];

      if (companyId && value.question.trim()) {
        const res = await analyzeStrategySection({
          companyId,
          reviewId: reviewId ?? value.id,
          section: EXTENDED_SECTIONS.OPTIONS_ANALYSIS,
          currentData: {
            question: value.question,
            existingCriteria: value.criteria.map((c) => c.label),
            optionNames: value.options.map((o) => o.name),
          },
          question:
            `For the decision question "${value.question}", suggest 4–6 weighted criteria for an options analysis. ` +
            `Return as a JSON code block: [{ "label": "…", "weight": 0..1 }] with weights summing to 1.`,
        });
        if (res.success) {
          const titles = (res.suggestions ?? []).map((s) => s.title);
          suggested = parseAiCriteria(res.message ?? '', titles);
        } else if (res.error) {
          setAiError(res.error);
        }
      }

      if (suggested.length === 0) {
        suggested = suggestCriteriaHeuristic(value.question || '');
      }

      const additions = suggested.filter(
        (c) => !existingLabels.has(c.label.toLowerCase().trim()),
      );
      if (additions.length === 0) {
        setAiError('No new criteria — all suggestions already exist.');
        return;
      }

      // Append, then re-normalise weights across all criteria so we keep Σ = 1.
      const merged: OptionsAnalysisCriterion[] = [...value.criteria, ...additions];
      const tot = totalWeight(merged);
      const next = tot > 0
        ? merged.map((c) => ({ ...c, weight: Number((c.weight / tot).toFixed(3)) }))
        : merged;
      patch({ criteria: next });
    } finally {
      setAiSuggesting(false);
    }
  };

  // ── Options mutators ────────────────────────────────────────────────────
  const addOption = () => {
    const seed: OptionsAnalysisOption = {
      id: shortId('OP'),
      name: 'New option',
      pros: [],
      cons: [],
      risks: [],
      scores: Object.fromEntries(value.criteria.map((c) => [c.id, 0])),
    };
    patch({ options: [...value.options, seed] });
  };
  const removeOption = (id: string) =>
    patch({
      options: value.options.filter((o) => o.id !== id),
      recommendation: value.recommendation === id ? undefined : value.recommendation,
    });
  const patchOption = (id: string, p: Partial<OptionsAnalysisOption>) =>
    patch({
      options: value.options.map((o) => (o.id === id ? { ...o, ...p } : o)),
    });
  const setScore = (optionId: string, criterionId: string, score: number) => {
    const clamped = Math.max(0, Math.min(5, score));
    patch({
      options: value.options.map((o) =>
        o.id === optionId ? { ...o, scores: { ...o.scores, [criterionId]: clamped } } : o,
      ),
    });
  };

  // ── Approval-chain mutators ─────────────────────────────────────────────
  const approvers = value.approvers ?? [];
  const addApprover = () => {
    const next: OptionsAnalysisApprover[] = [
      ...approvers,
      { id: shortId('AP'), name: '', role: '', status: 'pending' },
    ];
    patch({ approvers: next });
  };
  const removeApprover = (id: string) =>
    patch({ approvers: approvers.filter((a) => a.id !== id) });
  const patchApprover = (id: string, p: Partial<OptionsAnalysisApprover>) => {
    const next = approvers.map((a) =>
      a.id === id
        ? {
            ...a,
            ...p,
            // Stamp / clear the date when status flips between pending and a
            // signed/declined state.
            date:
              p.status && p.status !== 'pending' && !a.date
                ? new Date().toISOString()
                : p.status === 'pending'
                ? undefined
                : a.date,
          }
        : a,
    );
    // Auto-advance: every approver signed + currently in_review → decided.
    let nextStatus = value.status;
    let nextDecisionDate = value.decisionDate;
    if (
      next.length > 0 &&
      next.every((a) => a.status === 'signed') &&
      value.status === 'in_review'
    ) {
      nextStatus = 'decided';
      nextDecisionDate = nextDecisionDate ?? new Date().toISOString();
    }
    patch({ approvers: next, status: nextStatus, decisionDate: nextDecisionDate });
  };

  const signedCount = approvers.filter((a) => a.status === 'signed').length;
  const declinedCount = approvers.filter((a) => a.status === 'declined').length;
  const approvalsAllSigned = approvers.length > 0 && signedCount === approvers.length;

  // ── Derived ─────────────────────────────────────────────────────────────
  const sumW = totalWeight(value.criteria);
  const weightsValid = Math.abs(sumW - 1) < 0.001 && value.criteria.length > 0;

  const ranked = React.useMemo(() => {
    const withScores = value.options.map((o) => ({ o, score: weightedScore(o, value.criteria) }));
    if (sortBy === 'score') withScores.sort((a, b) => b.score - a.score);
    return withScores;
  }, [value.options, value.criteria, sortBy]);

  const topOption = ranked[0]?.o;
  const recommendedId = value.recommendation ?? topOption?.id;
  const recommended = value.options.find((o) => o.id === recommendedId);

  const drawerOption = drawerOptionId ? value.options.find((o) => o.id === drawerOptionId) : null;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Scale className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span
            className="text-mono"
            style={{ fontSize: 10.5, letterSpacing: '0.08em', fontWeight: 700, color: 'var(--fg-tertiary)' }}
          >
            {value.id}
          </span>
          <span style={{ flex: 1 }} />
          <select
            value={value.status}
            onChange={(e) => patch({ status: e.target.value as AuthoredOptionsAnalysis['status'] })}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              borderRadius: 5,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              fontWeight: 600,
              color: STATUS_OPTIONS.find((s) => s.id === value.status)?.color ?? 'var(--fg-primary)',
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <input
          value={value.question}
          onChange={(e) => patch({ question: e.target.value })}
          placeholder='Decision question · "How do we add 30% finishing capacity?"'
          style={{
            ...inputStyle,
            border: 0,
            padding: 0,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            background: 'transparent',
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px', gap: 10 }}>
          <div>
            <label style={labelStyle}>Approver</label>
            <input
              value={value.approver ?? ''}
              onChange={(e) => patch({ approver: e.target.value })}
              placeholder="Who signs the decision"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Decision date</label>
            <input
              type="date"
              value={value.decisionDate ? value.decisionDate.slice(0, 10) : ''}
              onChange={(e) => patch({ decisionDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={value.status}
              onChange={(e) => patch({ status: e.target.value as AuthoredOptionsAnalysis['status'] })}
              style={inputStyle}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Criteria row ───────────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-sunken)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
            }}
          >
            Criteria · weighted
          </div>
          <span
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              background: weightsValid ? 'var(--rag-green-soft)' : 'var(--rag-amber-soft)',
              color: weightsValid ? 'var(--rag-green)' : 'var(--rag-amber)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
            title="Weights should sum to 1.00"
          >
            Σ {sumW.toFixed(2)}
          </span>
          {!weightsValid && value.criteria.length > 0 && (
            <button
              data-author-add
              onClick={normalizeWeights}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid var(--rag-amber)',
                background: 'transparent',
                color: 'var(--rag-amber)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Normalize to 1.00
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            data-author-add
            onClick={suggestCriteria}
            disabled={aiSuggesting}
            title={
              value.question.trim()
                ? 'Suggest weighted criteria based on the decision question'
                : 'Write a decision question first for better AI suggestions (heuristic fallback still works)'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 5,
              border: '1px solid var(--accent)',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: aiSuggesting ? 'wait' : 'pointer',
              opacity: aiSuggesting ? 0.6 : 1,
            }}
          >
            {aiSuggesting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Suggest criteria
          </button>
          <button
            data-author-add
            onClick={addCriterion}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 5,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus className="h-3 w-3" /> Criterion
          </button>
        </div>
        {aiError && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--rag-amber)',
              marginBottom: 8,
            }}
          >
            {aiError}
          </div>
        )}
        {value.criteria.length === 0 ? (
          <EmptyHint message="Add 2–5 criteria — what matters when picking between options." />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {value.criteria.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  minWidth: 220,
                }}
              >
                <input
                  value={c.label}
                  onChange={(e) => patchCriterion(c.id, { label: e.target.value })}
                  placeholder="Criterion"
                  style={{
                    border: 0,
                    background: 'transparent',
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: 0,
                    flex: 1,
                    minWidth: 0,
                    color: 'var(--fg-primary)',
                  }}
                />
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={c.weight}
                  onChange={(e) =>
                    patchCriterion(c.id, { weight: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })
                  }
                  style={{
                    width: 64,
                    padding: '2px 6px',
                    fontSize: 11.5,
                    border: '1px solid var(--border-default)',
                    borderRadius: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title="Weight 0..1"
                />
                <button
                  aria-label="Remove"
                  onClick={() => removeCriterion(c.id)}
                  style={{
                    padding: 2,
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    color: 'var(--fg-tertiary)',
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Options × criteria matrix ──────────────────────────────────── */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
            }}
          >
            Options · score 0–5 per criterion
          </div>
          <span style={{ flex: 1 }} />
          <button
            data-author-only
            onClick={() => setSortBy(sortBy === 'score' ? 'order' : 'score')}
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--fg-secondary)',
              cursor: 'pointer',
            }}
          >
            Sort: {sortBy === 'score' ? 'weighted score ↓' : 'insertion order'}
          </button>
          <button
            data-author-add
            onClick={addOption}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 5,
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus className="h-3 w-3" /> Option
          </button>
        </div>

        {value.options.length === 0 ? (
          <EmptyHint message="Add 2–4 options. Click an option name to edit pros, cons, risks, and link an NPV assessment." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Option</th>
                  {value.criteria.map((c) => (
                    <th key={c.id} style={{ ...thStyle, textAlign: 'center', width: 80 }}>
                      <div style={{ fontWeight: 700 }}>{c.label}</div>
                      <div
                        className="text-tertiary"
                        style={{ fontVariantNumeric: 'tabular-nums', fontSize: 10, fontWeight: 500 }}
                      >
                        w {c.weight.toFixed(2)}
                      </div>
                    </th>
                  ))}
                  <th style={{ ...thStyle, textAlign: 'right', width: 90 }}>Capex</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 90 }}>Opex</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 70 }}>TTV (mo)</th>
                  <th
                    style={{ ...thStyle, textAlign: 'right', width: 84 }}
                    title="Risk-adjusted NPV — base NPV × (1 − 0.1 per declared risk, floor 50%)."
                  >
                    rNPV
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 84 }}>Σ Score</th>
                  <th style={{ ...thStyle, width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ o, score }, idx) => {
                  const isRec = o.id === recommendedId;
                  return (
                    <tr key={o.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setDrawerOptionId(o.id)}
                          style={{
                            background: 'transparent',
                            border: 0,
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isRec && (
                              <span
                                style={{
                                  fontSize: 9,
                                  letterSpacing: '0.06em',
                                  background: 'var(--rag-green)',
                                  color: '#fff',
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  fontWeight: 700,
                                }}
                              >
                                REC
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: 'var(--accent)',
                              }}
                            >
                              {o.name || `Option ${idx + 1}`}
                            </span>
                          </div>
                          {o.summary && (
                            <div className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
                              {o.summary}
                            </div>
                          )}
                        </button>
                      </td>
                      {value.criteria.map((c) => (
                        <td key={c.id} style={{ ...tdStyle, textAlign: 'center' }}>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            value={o.scores[c.id] ?? 0}
                            onChange={(e) => setScore(o.id, c.id, Number(e.target.value) || 0)}
                            style={{
                              width: 50,
                              padding: '3px 4px',
                              fontSize: 12,
                              fontVariantNumeric: 'tabular-nums',
                              textAlign: 'center',
                              border: '1px solid var(--border-default)',
                              borderRadius: 4,
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input
                          type="number"
                          value={o.capex ?? ''}
                          onChange={(e) =>
                            patchOption(o.id, { capex: e.target.value === '' ? undefined : Number(e.target.value) })
                          }
                          placeholder="—"
                          style={{
                            width: 80,
                            padding: '3px 4px',
                            fontSize: 11.5,
                            fontVariantNumeric: 'tabular-nums',
                            textAlign: 'right',
                            border: '1px solid var(--border-default)',
                            borderRadius: 4,
                          }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input
                          type="number"
                          value={o.opex ?? ''}
                          onChange={(e) =>
                            patchOption(o.id, { opex: e.target.value === '' ? undefined : Number(e.target.value) })
                          }
                          placeholder="—"
                          style={{
                            width: 80,
                            padding: '3px 4px',
                            fontSize: 11.5,
                            fontVariantNumeric: 'tabular-nums',
                            textAlign: 'right',
                            border: '1px solid var(--border-default)',
                            borderRadius: 4,
                          }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input
                          type="number"
                          value={o.timeToValueMonths ?? ''}
                          onChange={(e) =>
                            patchOption(o.id, {
                              timeToValueMonths: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          placeholder="—"
                          style={{
                            width: 60,
                            padding: '3px 4px',
                            fontSize: 11.5,
                            fontVariantNumeric: 'tabular-nums',
                            textAlign: 'right',
                            border: '1px solid var(--border-default)',
                            borderRadius: 4,
                          }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {(() => {
                          const linked = o.linkedNpvAssessmentId
                            ? npvAssessments.find((a) => a.id === o.linkedNpvAssessmentId)
                            : null;
                          const r = riskAdjustedNpv(o, linked);
                          if (r === null || !linked) {
                            return (
                              <span
                                className="text-tertiary"
                                style={{ fontSize: 11, fontStyle: 'italic' }}
                              >
                                —
                              </span>
                            );
                          }
                          const adj = riskAdjustment(o);
                          return (
                            <div
                              title={`NPV ${fmtMoney(linked.npv)} × ${(adj * 100).toFixed(0)}% (${o.risks.length} risk${o.risks.length === 1 ? '' : 's'})`}
                              style={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                lineHeight: 1.2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  fontVariantNumeric: 'tabular-nums',
                                  color: r >= 0 ? 'var(--cf-pos)' : 'var(--cf-neg)',
                                }}
                              >
                                {fmtMoney(r)}
                              </span>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  color: 'var(--fg-tertiary)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                ×{(adj * 100).toFixed(0)}%
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <ScorePill score={score} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button
                          aria-label="Remove"
                          onClick={() => removeOption(o.id)}
                          style={{
                            padding: 2,
                            background: 'transparent',
                            border: 0,
                            cursor: 'pointer',
                            color: 'var(--fg-tertiary)',
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recommendation strip ───────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--rag-green-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Sparkles className="h-4 w-4" style={{ color: 'var(--rag-green)' }} />
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--rag-green)',
            }}
          >
            Recommendation
          </div>
          {topOption && value.recommendation && value.recommendation !== topOption.id && (
            <span
              className="text-tertiary"
              style={{ fontSize: 11 }}
              title={`Top-scored is ${topOption.name}`}
            >
              · overridden from top score
            </span>
          )}
          <span style={{ flex: 1 }} />
          <select
            value={recommendedId ?? ''}
            onChange={(e) => patch({ recommendation: e.target.value || undefined })}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: '1px solid var(--border-default)',
              borderRadius: 5,
              background: 'var(--bg-surface)',
              fontWeight: 500,
            }}
          >
            <option value="">— Pick option —</option>
            {value.options.map((o) => (
              <option key={o.id} value={o.id}>{o.name || o.id}</option>
            ))}
          </select>
        </div>
        {recommended ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{recommended.name}</div>
            <textarea
              value={value.rationale ?? ''}
              onChange={(e) => patch({ rationale: e.target.value })}
              placeholder="Rationale — why this option won."
              style={{
                ...inputStyle,
                minHeight: 64,
                resize: 'vertical',
                fontFamily: 'var(--font-sans)',
                background: 'var(--bg-surface)',
              }}
            />
          </>
        ) : (
          <EmptyHint message="Add options and the top-scoring one will be recommended automatically." />
        )}
      </div>

      {/* ── Approval chain ─────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <ShieldCheck className="h-4 w-4" style={{ color: 'var(--fg-secondary)' }} />
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
            }}
          >
            Approval chain
          </div>
          {approvers.length > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 4,
                background: approvalsAllSigned
                  ? 'var(--rag-green-soft)'
                  : declinedCount > 0
                  ? 'var(--rag-red-soft)'
                  : 'var(--bg-sunken)',
                color: approvalsAllSigned
                  ? 'var(--rag-green)'
                  : declinedCount > 0
                  ? 'var(--rag-red)'
                  : 'var(--fg-secondary)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
              title={
                approvalsAllSigned
                  ? 'All approvers signed — analysis auto-advanced to Decided when in review.'
                  : `${signedCount} of ${approvers.length} signed`
              }
            >
              {signedCount}/{approvers.length} signed
              {declinedCount > 0 && ` · ${declinedCount} declined`}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button
            data-author-add
            onClick={addApprover}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 5,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus className="h-3 w-3" /> Approver
          </button>
        </div>
        {approvers.length === 0 ? (
          <EmptyHint message="No approvers yet. Add the chain — when all sign, the analysis auto-advances from In review → Decided." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {approvers.map((a, i) => {
              const statusMeta = a.status === 'signed'
                ? { color: 'var(--rag-green)', soft: 'var(--rag-green-soft)' }
                : a.status === 'declined'
                ? { color: 'var(--rag-red)',   soft: 'var(--rag-red-soft)' }
                : { color: 'var(--fg-tertiary)', soft: 'var(--bg-sunken)' };
              return (
                <div
                  key={a.id}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    borderLeft: `3px solid ${statusMeta.color}`,
                    display: 'grid',
                    gridTemplateColumns: '28px 1.4fr 1fr 130px 110px 24px',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div
                    className="text-mono"
                    style={{
                      fontSize: 10.5,
                      color: 'var(--fg-tertiary)',
                      letterSpacing: '0.06em',
                      fontWeight: 700,
                    }}
                  >
                    #{i + 1}
                  </div>
                  <input
                    value={a.name}
                    onChange={(e) => patchApprover(a.id, { name: e.target.value })}
                    placeholder="Approver name"
                    style={{
                      padding: '4px 8px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      border: '1px solid var(--border-default)',
                      borderRadius: 4,
                      background: 'var(--bg-surface)',
                    }}
                  />
                  <input
                    value={a.role ?? ''}
                    onChange={(e) => patchApprover(a.id, { role: e.target.value })}
                    placeholder="Role (CFO, MD…)"
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      border: '1px solid var(--border-default)',
                      borderRadius: 4,
                      background: 'var(--bg-surface)',
                      color: 'var(--fg-secondary)',
                    }}
                  />
                  <select
                    value={a.status}
                    onChange={(e) =>
                      patchApprover(a.id, { status: e.target.value as OptionsAnalysisApprover['status'] })
                    }
                    style={{
                      padding: '4px 8px',
                      fontSize: 11.5,
                      border: `1px solid ${statusMeta.color}`,
                      borderRadius: 4,
                      background: statusMeta.soft,
                      color: statusMeta.color,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="signed">Signed</option>
                    <option value="declined">Declined</option>
                  </select>
                  <div
                    className="text-tertiary"
                    style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {a.date ? a.date.slice(0, 10) : '—'}
                  </div>
                  <button
                    aria-label="Remove"
                    onClick={() => removeApprover(a.id)}
                    style={{
                      padding: 2,
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      color: 'var(--fg-tertiary)',
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer actions ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 20px',
          background: 'var(--bg-sunken)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          data-author-only
          onClick={() => recommended && onSpawnPilot?.({ analysis: value, option: recommended })}
          disabled={!recommended || !onSpawnPilot}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            fontSize: 12,
            fontWeight: 500,
            cursor: recommended && onSpawnPilot ? 'pointer' : 'not-allowed',
            opacity: recommended && onSpawnPilot ? 1 : 0.5,
          }}
          title={recommended ? `Spawn a pilot for ${recommended.name}` : 'Pick a recommended option first'}
        >
          <ArrowUpRight className="h-3 w-3" /> Spawn pilot spin-off
        </button>
        <button
          data-author-only
          onClick={() => recommended && onReserveCapital?.({ analysis: value, option: recommended })}
          disabled={!recommended || !onReserveCapital}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            fontSize: 12,
            fontWeight: 500,
            cursor: recommended && onReserveCapital ? 'pointer' : 'not-allowed',
            opacity: recommended && onReserveCapital ? 1 : 0.5,
          }}
          title="Reserve a placeholder bucket in capitalAllocation"
        >
          <Wallet className="h-3 w-3" /> Reserve capital bucket
        </button>
      </div>

      {/* ── Per-option drawer ──────────────────────────────────────────── */}
      {drawerOption && (
        <OptionDrawer
          option={drawerOption}
          npvAssessments={npvAssessments}
          onClose={() => setDrawerOptionId(null)}
          onChange={(p) => patchOption(drawerOption.id, p)}
        />
      )}
    </div>
  );
};

// ── Shared sub-bits ────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
  color: 'var(--fg-tertiary)',
  textAlign: 'left',
  borderBottom: '1px solid var(--border-subtle)',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 8px',
  fontSize: 12.5,
  verticalAlign: 'middle',
};

const ScorePill: React.FC<{ score: number }> = ({ score }) => {
  const color =
    score >= 4 ? 'var(--rag-green)' :
    score >= 3 ? 'var(--rag-blue)' :
    score >= 2 ? 'var(--rag-amber)' :
    'var(--rag-red)';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: 4,
        background: 'var(--bg-sunken)',
        color,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700,
        fontSize: 12.5,
        border: `1px solid ${color}`,
      }}
    >
      {score.toFixed(2)}
    </span>
  );
};

const EmptyHint: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      padding: 14,
      border: '1px dashed var(--border-default)',
      borderRadius: 8,
      color: 'var(--fg-tertiary)',
      fontSize: 12,
      textAlign: 'center',
    }}
  >
    {message}
  </div>
);

// ── Per-option side drawer ─────────────────────────────────────────────────

interface OptionDrawerProps {
  option: OptionsAnalysisOption;
  npvAssessments: NPVAssessment[];
  onClose: () => void;
  onChange: (patch: Partial<OptionsAnalysisOption>) => void;
}

const OptionDrawer: React.FC<OptionDrawerProps> = ({ option, npvAssessments, onClose, onChange }) => {
  const linked = option.linkedNpvAssessmentId
    ? npvAssessments.find((a) => a.id === option.linkedNpvAssessmentId)
    : null;
  const isLinked = !!option.linkedNpvAssessmentId;

  const updateList = (
    key: 'pros' | 'cons' | 'risks',
    idx: number,
    value: string,
  ) => {
    const next = [...option[key]];
    next[idx] = value;
    onChange({ [key]: next } as Partial<OptionsAnalysisOption>);
  };
  const addToList = (key: 'pros' | 'cons' | 'risks') =>
    onChange({ [key]: [...option[key], ''] } as Partial<OptionsAnalysisOption>);
  const removeFromList = (key: 'pros' | 'cons' | 'risks', idx: number) => {
    const next = option[key].filter((_, i) => i !== idx);
    onChange({ [key]: next } as Partial<OptionsAnalysisOption>);
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
        aria-label="Option detail"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 520,
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          boxShadow: '-8px 0 32px rgba(20, 20, 22, 0.16)',
          zIndex: 95,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="text-mono"
              style={{ fontSize: 10.5, color: 'var(--fg-tertiary)', letterSpacing: '0.08em', fontWeight: 700 }}
            >
              {option.id}
            </div>
            <input
              value={option.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Option name"
              style={{
                ...inputStyle,
                border: 0,
                padding: '4px 0',
                fontSize: 17,
                fontWeight: 600,
                background: 'transparent',
              }}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: 'var(--fg-tertiary)',
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Summary</label>
            <textarea
              value={option.summary ?? ''}
              onChange={(e) => onChange({ summary: e.target.value })}
              placeholder="One-line description of this option."
              style={{ ...inputStyle, minHeight: 50, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          {/* NPV linkage */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${isLinked ? 'var(--accent)' : 'var(--border-default)'}`,
              background: isLinked ? 'var(--accent-soft)' : 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Link2
                className="h-3.5 w-3.5"
                style={{ color: isLinked ? 'var(--accent)' : 'var(--fg-tertiary)' }}
              />
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isLinked ? 'var(--accent)' : 'var(--fg-tertiary)',
                }}
              >
                {isLinked ? 'Linked NPV assessment' : 'No NPV link'}
              </div>
            </div>
            <select
              value={option.linkedNpvAssessmentId ?? ''}
              onChange={(e) => onChange({ linkedNpvAssessmentId: e.target.value || undefined })}
              style={inputStyle}
            >
              <option value="">— Link an NPV assessment from this doc —</option>
              {npvAssessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            {linked && (
              <>
                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                  }}
                >
                  <Metric label="NPV" value={fmtMoney(linked.npv)} tone={linked.npv >= 0 ? 'pos' : 'neg'} />
                  <Metric
                    label="IRR"
                    value={Number.isFinite(linked.irr ?? NaN) ? `${(((linked.irr ?? 0) as number) * 100).toFixed(1)}%` : '—'}
                  />
                  <Metric
                    label="Payback"
                    value={Number.isFinite(linked.paybackPeriods ?? NaN) ? `${(linked.paybackPeriods as number).toFixed(1)}` : '—'}
                  />
                </div>
                {(() => {
                  const r = riskAdjustedNpv(option, linked);
                  if (r === null) return null;
                  const adj = riskAdjustment(option);
                  return (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        borderRadius: 6,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} />
                      <div style={{ flex: 1 }}>
                        <div
                          className="text-tertiary"
                          style={{
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                          }}
                        >
                          Risk-adjusted NPV
                        </div>
                        <div
                          className="text-tertiary"
                          style={{ fontSize: 10.5, marginTop: 1 }}
                        >
                          {option.risks.length} risk{option.risks.length === 1 ? '' : 's'} · adjustment ×{(adj * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: r >= 0 ? 'var(--cf-pos)' : 'var(--cf-neg)',
                        }}
                      >
                        {fmtMoney(r)}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Capex / Opex / TTV */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Capex</label>
              <input
                type="number"
                value={option.capex ?? ''}
                onChange={(e) => onChange({ capex: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={inputStyle}
                placeholder="—"
              />
            </div>
            <div>
              <label style={labelStyle}>Opex</label>
              <input
                type="number"
                value={option.opex ?? ''}
                onChange={(e) => onChange({ opex: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={inputStyle}
                placeholder="—"
              />
            </div>
            <div>
              <label style={labelStyle}>Time-to-value (mo)</label>
              <input
                type="number"
                value={option.timeToValueMonths ?? ''}
                onChange={(e) =>
                  onChange({ timeToValueMonths: e.target.value === '' ? undefined : Number(e.target.value) })
                }
                style={inputStyle}
                placeholder="—"
              />
            </div>
          </div>

          {/* Pros / Cons / Risks */}
          {(['pros', 'cons', 'risks'] as const).map((k) => (
            <ListEditor
              key={k}
              label={k === 'pros' ? 'Pros' : k === 'cons' ? 'Cons' : 'Risks'}
              items={option[k]}
              onAdd={() => addToList(k)}
              onUpdate={(i, v) => updateList(k, i, v)}
              onRemove={(i) => removeFromList(k, i)}
            />
          ))}
        </div>

        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Check className="h-3 w-3" /> Done
          </button>
        </div>
      </div>
    </>
  );
};

const ListEditor: React.FC<{
  label: string;
  items: string[];
  onAdd: () => void;
  onUpdate: (i: number, v: string) => void;
  onRemove: (i: number) => void;
}> = ({ label, items, onAdd, onUpdate, onRemove }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={labelStyle as React.CSSProperties}>{label}</span>
      <span style={{ flex: 1 }} />
      <button
        data-author-add
        onClick={onAdd}
        style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          border: '1px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--fg-secondary)',
          cursor: 'pointer',
        }}
      >
        + Add
      </button>
    </div>
    {items.length === 0 ? (
      <div className="text-tertiary" style={{ fontSize: 11.5, fontStyle: 'italic' }}>
        —
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={v}
              onChange={(e) => onUpdate(i, e.target.value)}
              style={{ ...inputStyle, padding: '4px 8px', fontSize: 12.5 }}
              placeholder={label.slice(0, -1)}
            />
            <button
              aria-label="Remove"
              onClick={() => onRemove(i)}
              style={{
                padding: 4,
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                color: 'var(--fg-tertiary)',
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const Metric: React.FC<{ label: string; value: string; tone?: 'pos' | 'neg' }> = ({ label, value, tone }) => (
  <div
    style={{
      padding: 8,
      background: 'var(--bg-surface)',
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
    }}
  >
    <div
      className="text-tertiary"
      style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color: tone === 'pos' ? 'var(--cf-pos)' : tone === 'neg' ? 'var(--cf-neg)' : 'var(--fg-primary)',
      }}
    >
      {value}
    </div>
  </div>
);

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export default OptionsAnalysisEditor;
