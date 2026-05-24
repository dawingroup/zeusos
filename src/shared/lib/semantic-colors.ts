/**
 * Semantic color helpers — Phase U.3
 *
 * The DawinOS portal styling tech spec carries the Zeus brand palette + the
 * RAG (Red/Amber/Green) semantic palette + the cash-flow (--cf-pos/--cf-neg)
 * + the chart series palette (--chart-1..5). This module is the typed
 * single-source-of-truth for mapping high-level intent ("this number is
 * negative", "this is the third chart series") to those tokens.
 *
 * Use the helpers below instead of:
 *   ❌  style={{ color: value > 0 ? '#22C55E' : '#EF4444' }}
 *   ❌  <Bar fill="#1976d2" />
 *   ❌  <span className="bg-red-100 text-red-700 ...">Off track</span>
 *
 *   ✅  <span style={{ color: ragToken(ragForDelta(value)) }}>{value}</span>
 *   ✅  <Bar fill={chartSeriesColor(idx)} />
 *   ✅  <span className={ragClass('red')}>Off track</span>
 *
 * Why a helper rather than inline tokens?
 *   - Centralised thresholds (e.g. "below 60% utilisation = amber") instead
 *     of every dashboard hard-coding its own thresholds
 *   - Type safety for the union of valid RAG colors
 *   - One place to extend for new semantic categories (NPS bands, sentiment
 *     scores, urgency levels, ...) without touching consumers
 *   - The ESLint guard rails in U.1 don't flag CSS-var refs returned from
 *     here; they DO flag literal hex strings, so this helper is the
 *     escape hatch
 *
 * See docs/STYLING.md §5 (RAG semantics) and §1.1 (token list).
 */

// ============================================================================
// RAG (semantic health)
// ============================================================================

/**
 * RAG color identifier. These are the only valid status semantics in the
 * design system. Workflow lifecycle states (draft/active/paused/...) are
 * a separate concept — see {@link WorkflowStatus} below.
 */
export type RagColor = 'green' | 'amber' | 'red' | 'blue' | 'na';

const RAG_VAR: Record<RagColor, string> = {
  green: 'var(--rag-green)',
  amber: 'var(--rag-amber)',
  red: 'var(--rag-red)',
  blue: 'var(--rag-blue)',
  na: 'var(--rag-na)',
};

const RAG_SOFT_VAR: Record<RagColor, string> = {
  green: 'var(--rag-green-soft)',
  amber: 'var(--rag-amber-soft)',
  red: 'var(--rag-red-soft)',
  blue: 'var(--rag-blue-soft)',
  na: 'var(--bg-sunken)', // matches the .rag.na CSS rule
};

/** CSS-var ref for the solid RAG color. Use in `style={{ color: ragToken(...) }}` or for SVG/chart `stroke`. */
export function ragToken(color: RagColor): string {
  return RAG_VAR[color];
}

/** CSS-var ref for the soft (background) RAG color. Use for filled pills, alert backgrounds. */
export function softRagToken(color: RagColor): string {
  return RAG_SOFT_VAR[color];
}

/** className string for the spec §8 .rag pill. Renders `rag green` etc. */
export function ragClass(color: RagColor): string {
  return `rag ${color}`;
}

// ============================================================================
// RAG inference helpers
// ============================================================================

/**
 * Map a positive/negative delta to a RAG color.
 * Use for variance numbers, period-over-period change, etc.
 *   ragForDelta(+12)  → 'green'
 *   ragForDelta(-3)   → 'red'
 *   ragForDelta(0)    → 'na'
 *
 * The "positive is good" assumption fits revenue, profit, retention, NPS.
 * For metrics where lower is better (cost, churn, defects), invert at the
 * call site: `ragForDelta(-cost)`.
 */
export function ragForDelta(delta: number, zeroTolerance = 0): RagColor {
  if (Math.abs(delta) <= zeroTolerance) return 'na';
  return delta > 0 ? 'green' : 'red';
}

/**
 * Map an actual-vs-target percentage to RAG.
 *   100% or more → green
 *   85–99%       → amber
 *   <85%         → red
 * Thresholds are spec defaults. Override per call site if a domain has its
 * own ratings (e.g. SLA tiers).
 */
export function ragForAttainment(
  pctOfTarget: number,
  thresholds: { green?: number; amber?: number } = {},
): RagColor {
  const greenAt = thresholds.green ?? 100;
  const amberAt = thresholds.amber ?? 85;
  if (pctOfTarget >= greenAt) return 'green';
  if (pctOfTarget >= amberAt) return 'amber';
  return 'red';
}

/**
 * Map a -100..100 sentiment score (e.g. social listening, NPS detractor/
 * promoter balance, market signal polarity) to RAG.
 *   >= +20  → green
 *   -20..20 → amber
 *   <= -20  → red
 */
export function ragForSentiment(score: number): RagColor {
  if (score >= 20) return 'green';
  if (score <= -20) return 'red';
  return 'amber';
}

// ============================================================================
// Chart palette (Recharts series colors)
// ============================================================================

/**
 * CSS-var ref for the n-th chart series color. Index is taken mod 5 so the
 * palette wraps after 5 series. Returns an HSL string ready to pass to
 * Recharts (`fill`, `stroke`, etc.).
 *
 *   <Bar fill={chartSeriesColor(0)} />        // chart-1
 *   <Line stroke={chartSeriesColor(idx)} />
 */
export function chartSeriesColor(idx: number): string {
  const n = (idx % 5) + 1;
  return `hsl(var(--chart-${n}))`;
}

/**
 * Same as {@link chartSeriesColor} but with an opacity modifier. Useful for
 * area-fills on line charts: `chartSeriesColor(idx) for the line + alpha
 * fill for the under-line area.
 */
export function chartSeriesColorAlpha(idx: number, alpha: number): string {
  const n = (idx % 5) + 1;
  return `hsl(var(--chart-${n}) / ${alpha})`;
}

// ============================================================================
// Cash-flow waterfall
// ============================================================================

/** CSS-var ref for inflow / outflow bars. Pair with --fg-primary for the net bar. */
export const cashFlowToken = {
  pos: 'var(--cf-pos)',
  neg: 'var(--cf-neg)',
  net: 'var(--fg-primary)',
} as const;

// ============================================================================
// Workflow lifecycle status (DIFFERENT from RAG)
// ============================================================================

/**
 * Lifecycle states — NOT health signals. The spec §8 explicitly warns
 * against conflating these with RAG.
 *
 * These describe where an entity sits in its publishing workflow; they
 * have no "good/bad" semantics. Render via {@link statusBadgeClass}.
 */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'deprecated' | 'archived';

const STATUS_BADGE_CLASS: Record<WorkflowStatus, string> = {
  // Soft fills, no RAG semantics. Pulled into one place so module-specific
  // badge maps (KpiCard, RoleProfilePanel, etc.) can reuse rather than
  // each defining their own slightly-different shades.
  draft: 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
  active: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  paused: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  deprecated: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  archived: 'bg-[var(--bg-sunken)] text-[var(--fg-tertiary)]',
};

export function statusBadgeClass(status: WorkflowStatus): string {
  return STATUS_BADGE_CLASS[status];
}
