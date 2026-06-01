// ============================================================================
// ExperimentsPage — /strategy/experiments
//
// Enterprise synthesis surface for spin-off experiments. Pulls every
// AuthoredSpinoff from every strategy document in the company, lets the
// user filter by theme / subsidiary / stage, and switch between three
// views:
//   - Pipeline: kanban by lifecycle stage (Brief → Running → Learning → Decided)
//   - Matrix:   theme × subsidiary heatmap of where the bets sit
//   - List:     sortable table with source-doc attribution
//
// A right sidebar surfaces:
//   - Synthesis · patterns observed across experiments (scaffold for now)
//   - Promotion queue · decided experiments returning to the spine
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Download,
  FileText,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Sparkles,
  Kanban,
  Network,
  List as ListIcon,
  Loader2,
} from 'lucide-react';

import { strategyReviewService } from '../services/strategyReview.service';
import type { AuthoredSpinoff, StrategyReviewData } from '../types/strategy.types';
import { STRATEGY_COMPANY_ID } from '../constants/company';
import { useAuth } from '@/shared/hooks/useAuth';
import { useKPIs } from '../hooks/useKPIs';
import { KPI_PERFORMANCE } from '../constants/kpi.constants';
import {
  NewExperimentDialog,
  ExperimentDetailDrawer,
  type ExperimentSourceDocRef,
  type ExperimentKPIResolved,
} from '../components/review';

type Stage = AuthoredSpinoff['stage'];
type Decision = NonNullable<AuthoredSpinoff['decision']>;

interface FlatSpinoff extends AuthoredSpinoff {
  sourceDocId: string;
  sourceDocTitle: string;
}

/** Drop the page-only attribution fields before persisting. */
function stripFlatFields(s: FlatSpinoff): AuthoredSpinoff {
  const { sourceDocId: _src, sourceDocTitle: _title, ...rest } = s;
  return rest as AuthoredSpinoff;
}

const STAGE_META: Record<Stage, { n: string; label: string; color: string; soft: string; note: string }> = {
  brief:    { n: '01', label: 'Brief',    color: 'var(--rag-na)',    soft: 'var(--bg-sunken)',       note: 'Hypothesis written, not started' },
  running:  { n: '02', label: 'Running',  color: 'var(--rag-blue)',  soft: 'var(--rag-blue-soft)',   note: 'In-market, evidence accruing' },
  learning: { n: '03', label: 'Learning', color: 'var(--rag-amber)', soft: 'var(--rag-amber-soft)',  note: 'Test concluded, interpreting results' },
  decided:  { n: '04', label: 'Decided',  color: 'var(--rag-green)', soft: 'var(--rag-green-soft)',  note: 'Promoted, iterated, paused, or killed' },
};
const STAGE_ORDER: Stage[] = ['brief', 'running', 'learning', 'decided'];

const DECISION_META: Record<Decision, { label: string; glyph: string; color: string }> = {
  promote: { label: 'Promote', glyph: '↑', color: 'var(--rag-green)' },
  iterate: { label: 'Iterate', glyph: '↺', color: 'var(--rag-amber)' },
  pause:   { label: 'Pause',   glyph: '∥', color: 'var(--rag-na)' },
  kill:    { label: 'Kill',    glyph: '×', color: 'var(--rag-red)' },
};

export const ExperimentsPage: React.FC = () => {
  const navigate = useNavigate();
  const companyId = STRATEGY_COMPANY_ID;
  const { user } = useAuth();
  const userId = user?.uid ?? 'unknown';

  const [docs, setDocs] = useState<StrategyReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterTheme, setFilterTheme] = useState<string>('all');
  const [filterSub, setFilterSub] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<'all' | Stage>('all');
  const [view, setView] = useState<'pipeline' | 'matrix' | 'list'>('pipeline');

  // Create + edit surfaces
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<{ spinoff: AuthoredSpinoff; sourceDocId: string } | null>(null);

  // Tracked KPI library — for the experiment ↔ KPI linkage.
  const { kpis: trackedKPIs } = useKPIs({ companyId, activeOnly: true, autoFetch: true });
  const resolveLinkedKpi = React.useCallback(
    (id: string): ExperimentKPIResolved | null => {
      const k = trackedKPIs.find((x) => x.id === id);
      if (!k) return null;
      const perf = k.currentPerformance ?? KPI_PERFORMANCE.NO_DATA;
      const status: 'green' | 'amber' | 'red' | undefined =
        perf === KPI_PERFORMANCE.EXCEEDING || perf === KPI_PERFORMANCE.ON_TARGET
          ? 'green'
          : perf === KPI_PERFORMANCE.BELOW_TARGET
          ? 'amber'
          : perf === KPI_PERFORMANCE.CRITICAL
          ? 'red'
          : undefined;
      const valueStr = k.currentValue == null ? '—' : `${k.currentValue}${k.unit ? ' ' + k.unit : ''}`;
      const targetStr = k.target?.value != null ? `${k.target.value}${k.unit ? ' ' + k.unit : ''}` : undefined;
      return { id: k.id, label: k.name, value: valueStr, target: targetStr, status };
    },
    [trackedKPIs],
  );

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await strategyReviewService.getReviews(companyId, { limit: 200 });
      setDocs(rows.filter((r) => r.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ── Persistence helpers ─────────────────────────────────────────────

  /** Upsert (create or replace) a spinoff inside its source doc. Persists
   *  via saveReview and triggers a reload of the page state. */
  const upsertSpinoff = React.useCallback(
    async (sourceDocId: string, spinoff: AuthoredSpinoff) => {
      const source = docs.find((d) => d.id === sourceDocId);
      if (!source) throw new Error('Source strategy doc not found');
      const existing = source.spinoffs ?? [];
      const next = existing.some((s) => s.id === spinoff.id)
        ? existing.map((s) => (s.id === spinoff.id ? spinoff : s))
        : [...existing, spinoff];
      const updated: StrategyReviewData = { ...source, spinoffs: next };
      await strategyReviewService.saveReview(companyId, sourceDocId, updated, userId);
      // Update local cache so the UI refreshes immediately.
      setDocs((prev) => prev.map((d) => (d.id === sourceDocId ? updated : d)));
    },
    [companyId, docs, userId],
  );

  const deleteSpinoff = React.useCallback(
    async (sourceDocId: string, spinoffId: string) => {
      const source = docs.find((d) => d.id === sourceDocId);
      if (!source) return;
      const next = (source.spinoffs ?? []).filter((s) => s.id !== spinoffId);
      const updated: StrategyReviewData = { ...source, spinoffs: next };
      await strategyReviewService.saveReview(companyId, sourceDocId, updated, userId);
      setDocs((prev) => prev.map((d) => (d.id === sourceDocId ? updated : d)));
    },
    [companyId, docs, userId],
  );

  /** Inline stage / decision change from a card without opening the drawer. */
  const inlineUpdate = React.useCallback(
    (s: FlatSpinoff, patch: Partial<AuthoredSpinoff>) => {
      const updated: AuthoredSpinoff = { ...s, ...patch };
      // Strip the FlatSpinoff-only fields before saving.
      const { sourceDocId: _src, sourceDocTitle: _t, ...clean } = updated as FlatSpinoff;
      void upsertSpinoff(s.sourceDocId, clean as AuthoredSpinoff);
    },
    [upsertSpinoff],
  );

  // Source-doc references for the new-experiment dialog.
  const sourceDocRefs: ExperimentSourceDocRef[] = useMemo(
    () =>
      docs.map((d) => ({
        id: d.id,
        title: d.title || 'Untitled',
        strategicThemes: d.strategicThemes,
      })),
    [docs],
  );

  // Flatten every spin-off across every doc + carry its source attribution.
  const allSpinoffs: FlatSpinoff[] = useMemo(() => {
    const out: FlatSpinoff[] = [];
    for (const d of docs) {
      const items = d.spinoffs ?? [];
      for (const s of items) {
        out.push({
          ...s,
          sourceDocId: d.id,
          sourceDocTitle: d.title || 'Untitled',
        });
      }
    }
    return out;
  }, [docs]);

  // Build dynamic filter option lists from the data so the chips only
  // show themes/subs that actually exist.
  const themeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSpinoffs) if (s.parent) set.add(s.parent);
    return Array.from(set);
  }, [allSpinoffs]);
  const subOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSpinoffs) if (s.sub) set.add(s.sub);
    return Array.from(set);
  }, [allSpinoffs]);

  const filtered = useMemo(
    () =>
      allSpinoffs.filter(
        (s) =>
          (filterTheme === 'all' || s.parent === filterTheme) &&
          (filterSub === 'all' || s.sub === filterSub) &&
          (filterStage === 'all' || s.stage === filterStage),
      ),
    [allSpinoffs, filterTheme, filterSub, filterStage],
  );

  // Enterprise stats — over the full dataset, not filtered.
  const stats = useMemo(() => {
    const total = allSpinoffs.length;
    const byStage: Record<Stage, number> = { brief: 0, running: 0, learning: 0, decided: 0 };
    for (const s of allSpinoffs) byStage[s.stage]++;
    const byDecision: Record<Decision, number> = { promote: 0, iterate: 0, pause: 0, kill: 0 };
    for (const s of allSpinoffs) {
      if (s.decision) byDecision[s.decision]++;
    }
    const confidences = allSpinoffs.map((s) => s.confidence ?? 50);
    const avgConfidence = confidences.length === 0 ? 0 : Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);
    return { total, byStage, byDecision, avgConfidence };
  }, [allSpinoffs]);

  return (
    <div className="space-y-6">
      {/* Page head */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            Experiments
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
            Implementation strategies · enterprise synthesis · {allSpinoffs.length}{' '}
            across {themeOptions.length} theme{themeOptions.length === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 9px',
              borderRadius: 6,
              border: '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--fg-primary)',
            }}
          >
            <Download className="h-3 w-3" /> Export
          </button>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 9px',
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--fg-primary)',
            }}
          >
            <FileText className="h-3 w-3" /> Patterns
          </button>
          <button
            onClick={() => setNewOpen(true)}
            disabled={sourceDocRefs.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 9px',
              borderRadius: 6,
              border: '1px solid var(--fg-primary)',
              background: 'var(--fg-primary)',
              cursor: sourceDocRefs.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: '#fff',
              opacity: sourceDocRefs.length === 0 ? 0.5 : 1,
            }}
            title={
              sourceDocRefs.length === 0
                ? 'Create a strategy document first — experiments attach to a source doc'
                : undefined
            }
          >
            <Plus className="h-3 w-3" /> New experiment
          </button>
        </div>
      </div>

      {/* KPI band — 5 tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <KPITile label="Active experiments" value={String(stats.total)} unit="live" trend="up" delta={`across ${docs.length} docs`} />
        <KPITile label="In market" value={String(stats.byStage.running)} unit="running" trend="flat" delta={`+ ${stats.byStage.brief} briefed`} />
        <KPITile
          label="Learnings ready"
          value={String(stats.byStage.learning + stats.byStage.decided)}
          unit="decisions"
          trend="up"
          delta={`${stats.byDecision.promote} promote · ${stats.byDecision.iterate} iterate`}
        />
        <KPITile label="Avg confidence" value={String(stats.avgConfidence)} unit="/ 100" trend={stats.avgConfidence >= 65 ? 'up' : 'flat'} delta="rolling 30d" />
        <KPITile label="Decisions queued" value={String(stats.byDecision.promote + stats.byDecision.iterate + stats.byDecision.pause + stats.byDecision.kill)} unit="QBR" trend="up" delta="awaiting board" />
      </div>

      {/* Pipeline funnel hero */}
      <PipelineHero stats={stats} />

      {error && (
        <div
          style={{
            marginTop: 18,
            padding: '10px 14px',
            background: 'var(--rag-red-soft)',
            color: 'var(--rag-red)',
            border: '1px solid var(--rag-red)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '36px 0',
            color: 'var(--fg-tertiary)',
            fontSize: 13,
          }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading experiments…
        </div>
      )}

      {/* Filter + view bar */}
      {!loading && (
        <div
          className="card"
          style={{
            padding: 0,
            marginTop: 18,
            marginBottom: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flex: 1,
                borderRight: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
              }}
            >
              <FilterChips
                label="Theme"
                value={filterTheme}
                setValue={setFilterTheme}
                options={[{ v: 'all', l: 'All' }, ...themeOptions.map((t) => ({ v: t, l: t }))]}
              />
              <FilterChips
                label="Subsidiary"
                value={filterSub}
                setValue={setFilterSub}
                options={[{ v: 'all', l: 'All' }, ...subOptions.map((s) => ({ v: s, l: s }))]}
              />
              <FilterChips
                label="Stage"
                value={filterStage}
                setValue={(v) => setFilterStage(v as 'all' | Stage)}
                options={[
                  { v: 'all', l: 'All' },
                  ...STAGE_ORDER.map((s) => ({ v: s, l: STAGE_META[s].label })),
                ]}
              />
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {(
                [
                  { id: 'pipeline', label: 'Pipeline', icon: Kanban },
                  { id: 'matrix', label: 'Matrix', icon: Network },
                  { id: 'list', label: 'List', icon: ListIcon },
                ] as const
              ).map((v) => {
                const Icon = v.icon;
                const on = view === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      borderRadius: 5,
                      fontSize: 11.5,
                      fontWeight: on ? 700 : 500,
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--fg-secondary)',
                      border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon className="h-3 w-3" /> {v.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--bg-sunken)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span className="text-tertiary" style={{ fontSize: 11 }}>Showing</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {filtered.length}
            </span>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              of {allSpinoffs.length} experiments
            </span>
            <span style={{ flex: 1 }} />
            {(filterTheme !== 'all' || filterSub !== 'all' || filterStage !== 'all') && (
              <button
                onClick={() => {
                  setFilterTheme('all');
                  setFilterSub('all');
                  setFilterStage('all');
                }}
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  color: 'var(--fg-secondary)',
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'flex-start' }}>
          <div>
            {filtered.length === 0 ? (
              <EmptyState
                navigate={navigate}
                hasFilters={filterTheme !== 'all' || filterSub !== 'all' || filterStage !== 'all'}
              />
            ) : view === 'pipeline' ? (
              <PipelineKanban
                experiments={filtered}
                onOpenSource={(id) => navigate(`/strategy/plans/review/${id}`)}
                onOpenDetail={(s) =>
                  setDetail({
                    spinoff: stripFlatFields(s),
                    sourceDocId: s.sourceDocId,
                  })
                }
                onInlineUpdate={inlineUpdate}
              />
            ) : view === 'matrix' ? (
              <MatrixView
                experiments={filtered}
                themeKeys={themeOptions}
                subKeys={subOptions}
                onOpenSource={(id) => navigate(`/strategy/plans/review/${id}`)}
                onOpenDetail={(s) =>
                  setDetail({
                    spinoff: stripFlatFields(s),
                    sourceDocId: s.sourceDocId,
                  })
                }
              />
            ) : (
              <ListView
                experiments={filtered}
                onOpenSource={(id) => navigate(`/strategy/plans/review/${id}`)}
                onOpenDetail={(s) =>
                  setDetail({
                    spinoff: stripFlatFields(s),
                    sourceDocId: s.sourceDocId,
                  })
                }
              />
            )}
          </div>
          <aside
            style={{
              position: 'sticky',
              top: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              alignSelf: 'flex-start',
            }}
          >
            <SynthesisPanel />
            <PromotionQueue experiments={allSpinoffs} />
          </aside>
        </div>
      )}

      {/* New experiment dialog */}
      <NewExperimentDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        sourceDocs={sourceDocRefs}
        onCreate={async ({ sourceDocId, spinoff }) => {
          await upsertSpinoff(sourceDocId, spinoff);
        }}
      />

      {/* Experiment detail drawer */}
      <ExperimentDetailDrawer
        open={detail !== null}
        onClose={() => setDetail(null)}
        spinoff={detail?.spinoff ?? null}
        sourceDocId={detail?.sourceDocId ?? null}
        companyId={companyId}
        resolveLinkedKpi={resolveLinkedKpi}
        onSave={async ({ sourceDocId, spinoff }) => {
          await upsertSpinoff(sourceDocId, spinoff);
        }}
        onDelete={async ({ sourceDocId, spinoffId }) => {
          await deleteSpinoff(sourceDocId, spinoffId);
          setDetail(null);
        }}
      />
    </div>
  );
};

// ── KPI tile ───────────────────────────────────────────────────────────

const KPITile: React.FC<{
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
}> = ({ label, value, unit, delta, trend = 'flat' }) => {
  const trendColor =
    trend === 'up' ? 'var(--rag-green)' : trend === 'down' ? 'var(--rag-red)' : 'var(--fg-tertiary)';
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : ChevronRight;
  return (
    <div className="kpi" style={{ padding: 14 }}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      {delta && (
        <span style={{ fontSize: 11.5, color: trendColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <TrendIcon className="h-3 w-3" />
          {delta}
        </span>
      )}
    </div>
  );
};

// ── Filter chip group ──────────────────────────────────────────────────

const FilterChips: React.FC<{
  label: string;
  value: string;
  setValue: (v: string) => void;
  options: { v: string; l: string }[];
}> = ({ label, value, setValue, options }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span
      className="text-tertiary"
      style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
    >
      {label}
    </span>
    <div style={{ display: 'flex', gap: 3, padding: 2, background: 'var(--bg-sunken)', borderRadius: 6 }}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => setValue(o.v)}
            style={{
              padding: '3px 8px',
              fontSize: 11,
              borderRadius: 4,
              border: 0,
              background: on ? 'var(--bg-surface)' : 'transparent',
              color: on ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
              fontWeight: on ? 700 : 500,
              cursor: 'pointer',
              boxShadow: on ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  </div>
);

// ── Pipeline hero ──────────────────────────────────────────────────────

const PipelineHero: React.FC<{ stats: { byStage: Record<Stage, number>; byDecision: Record<Decision, number> } }> = ({ stats }) => {
  const max = Math.max(...STAGE_ORDER.map((s) => stats.byStage[s]), 1);
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.005em' }}>
            Implementation pipeline
          </div>
          <div className="text-tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
            How experiments move from a hypothesis to a learning that edits the plan
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {(Object.entries(stats.byDecision) as [Decision, number][]).map(([k, v]) => {
            const meta = DECISION_META[k];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: meta.color }}>{meta.glyph}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{meta.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGE_ORDER.length}, 1fr)`,
          gap: 8,
          alignItems: 'stretch',
        }}
      >
        {STAGE_ORDER.map((stage, i) => {
          const meta = STAGE_META[stage];
          const count = stats.byStage[stage];
          return (
            <div key={stage} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 80, display: 'flex', alignItems: 'flex-end', padding: '4px 0' }}>
                <div
                  style={{
                    width: '100%',
                    borderRadius: 6,
                    height: `${(count / max) * 100}%`,
                    minHeight: 4,
                    background: `linear-gradient(180deg, ${meta.color} 0%, ${meta.color}cc 100%)`,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -22,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: meta.color,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {count}
                  </span>
                </div>
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  background: meta.soft,
                  borderRadius: 6,
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    className="text-mono"
                    style={{ fontSize: 9, color: meta.color, fontWeight: 700, letterSpacing: '0.08em' }}
                  >
                    {meta.n}
                  </span>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: meta.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {meta.label}
                  </div>
                </div>
                <div className="text-tertiary" style={{ fontSize: 10.5, lineHeight: 1.45, marginTop: 4 }}>
                  {meta.note}
                </div>
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: 110,
                    zIndex: 1,
                    width: 12,
                    height: 12,
                    borderTop: '2px solid var(--fg-quaternary)',
                    borderRight: '2px solid var(--fg-quaternary)',
                    transform: 'rotate(45deg)',
                    background: 'var(--bg-surface)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Pipeline kanban view ───────────────────────────────────────────────

const PipelineKanban: React.FC<{
  experiments: FlatSpinoff[];
  onOpenSource: (docId: string) => void;
  onOpenDetail?: (s: FlatSpinoff) => void;
  onInlineUpdate?: (s: FlatSpinoff, patch: Partial<AuthoredSpinoff>) => void;
}> = ({ experiments, onOpenSource, onOpenDetail, onInlineUpdate }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGE_ORDER.length}, 1fr)`, gap: 12, alignItems: 'flex-start' }}>
    {STAGE_ORDER.map((stage) => {
      const meta = STAGE_META[stage];
      const items = experiments.filter((e) => e.stage === stage);
      return (
        <div key={stage} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              padding: '8px 10px',
              background: meta.soft,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: meta.color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {meta.label}
            </div>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 700,
                color: meta.color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {items.length}
            </span>
          </div>
          {items.length === 0 ? (
            <div
              className="text-tertiary"
              style={{
                fontSize: 11,
                padding: 12,
                textAlign: 'center',
                border: '1px dashed var(--border-default)',
                borderRadius: 6,
              }}
            >
              —
            </div>
          ) : (
            items.map((s) => (
              <ExperimentCard
                key={s.id}
                s={s}
                compact
                onOpenSource={onOpenSource}
                onOpenDetail={onOpenDetail}
                onInlineUpdate={onInlineUpdate}
              />
            ))
          )}
        </div>
      );
    })}
  </div>
);

// ── Matrix view: theme × subsidiary ────────────────────────────────────

const MatrixView: React.FC<{
  experiments: FlatSpinoff[];
  themeKeys: string[];
  subKeys: string[];
  onOpenSource: (docId: string) => void;
  onOpenDetail?: (s: FlatSpinoff) => void;
}> = ({ experiments, themeKeys, subKeys, onOpenSource: _onOpenSource, onOpenDetail }) => {
  if (subKeys.length === 0 || themeKeys.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--fg-tertiary)',
          fontSize: 13,
        }}
      >
        Matrix needs both themes and subsidiaries on experiments. Add a parent theme and subsidiary tag to a few experiments to see this view.
      </div>
    );
  }
  const cell = (sub: string, theme: string) =>
    experiments.filter((e) => e.sub === sub && e.parent === theme);
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        className="text-tertiary"
        style={{
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        Theme × Subsidiary · where the bets sit
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 6, minWidth: 600 }}>
          <thead>
            <tr>
              <th />
              {themeKeys.map((th) => (
                <th
                  key={th}
                  style={{
                    padding: '4px 8px',
                    fontSize: 10.5,
                    color: 'var(--fg-tertiary)',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  <div className="text-mono" style={{ fontSize: 10, letterSpacing: '0.06em' }}>
                    {th}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subKeys.map((sub) => (
              <tr key={sub}>
                <td style={{ padding: '4px 8px', fontWeight: 700, fontSize: 12 }}>{sub}</td>
                {themeKeys.map((th) => {
                  const items = cell(sub, th);
                  const intensity = items.length;
                  return (
                    <td key={th} style={{ padding: 0, verticalAlign: 'top' }}>
                      <div
                        style={{
                          minHeight: 56,
                          padding: 8,
                          borderRadius: 6,
                          background:
                            intensity > 0
                              ? `rgba(135, 46, 92, ${0.06 + Math.min(intensity, 3) * 0.14})`
                              : 'var(--bg-sunken)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {items.length === 0 ? (
                          <div
                            className="text-tertiary"
                            style={{
                              fontSize: 10.5,
                              textAlign: 'center',
                              alignSelf: 'center',
                              flex: 1,
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            —
                          </div>
                        ) : (
                          items.map((s) => (
                            <button
                              key={s.id}
                              title={s.name}
                              onClick={() => (onOpenDetail ? onOpenDetail(s) : undefined)}
                              style={{
                                padding: '4px 6px',
                                borderRadius: 3,
                                background: 'var(--bg-surface)',
                                fontSize: 10.5,
                                lineHeight: 1.3,
                                borderLeft: `2px solid ${STAGE_META[s.stage].color}`,
                                cursor: 'pointer',
                                border: 0,
                                textAlign: 'left',
                                borderLeftWidth: 2,
                                borderLeftStyle: 'solid',
                                borderLeftColor: STAGE_META[s.stage].color,
                              }}
                            >
                              <div
                                className="text-mono"
                                style={{ fontSize: 9, color: 'var(--fg-tertiary)' }}
                              >
                                {s.id}
                              </div>
                              <div style={{ fontWeight: 500, marginTop: 1 }}>
                                {s.name.length > 26 ? s.name.slice(0, 26) + '…' : s.name}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── List view ──────────────────────────────────────────────────────────

const ListView: React.FC<{
  experiments: FlatSpinoff[];
  onOpenSource: (docId: string) => void;
  onOpenDetail?: (s: FlatSpinoff) => void;
}> = ({ experiments, onOpenSource, onOpenDetail }) => (
  <div className="card" style={{ overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: 880 }}>
        <thead>
          <tr>
            <th style={{ width: 70 }}>Ref</th>
            <th>Experiment · hypothesis</th>
            <th style={{ width: 80 }}>Theme</th>
            <th style={{ width: 200 }}>Source doc</th>
            <th style={{ width: 110 }}>Owner</th>
            <th style={{ width: 90 }}>Stage</th>
            <th style={{ width: 90 }}>Conf</th>
            <th style={{ width: 70 }}>Ends</th>
          </tr>
        </thead>
        <tbody>
          {experiments.map((s) => (
            <tr
              key={s.id}
              onClick={() => (onOpenDetail ? onOpenDetail(s) : undefined)}
              style={{ cursor: onOpenDetail ? 'pointer' : 'default' }}
            >
              <td>
                <span className="text-mono" style={{ fontSize: 10.5 }}>{s.id}</span>
              </td>
              <td>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>{s.name}</div>
                <div
                  className="text-tertiary"
                  style={{ fontSize: 11, marginTop: 2, lineHeight: 1.4, maxWidth: 380 }}
                >
                  {s.hypothesis}
                </div>
              </td>
              <td>
                <span className="text-mono" style={{ fontSize: 10.5, color: 'var(--fg-tertiary)' }}>{s.parent}</span>
              </td>
              <td>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSource(s.sourceDocId);
                  }}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    className="text-mono"
                    style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}
                  >
                    {s.sourceDocId.slice(0, 8)}
                  </span>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--accent)',
                    }}
                  >
                    {s.sourceDocTitle}
                  </div>
                </button>
              </td>
              <td className="text-secondary" style={{ fontSize: 11.5 }}>{s.owner}</td>
              <td>
                <StageChip stage={s.stage} />
              </td>
              <td>
                <ConfidenceBar value={s.confidence ?? 0} />
              </td>
              <td className="text-secondary" style={{ fontSize: 11 }}>{s.ends ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── Reusable chips and bars ────────────────────────────────────────────

const StageChip: React.FC<{ stage: Stage }> = ({ stage }) => {
  const meta = STAGE_META[stage];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: 600,
        background: meta.soft,
        color: meta.color,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color }} />
      {meta.label}
    </span>
  );
};

const DecisionChip: React.FC<{ d: Decision }> = ({ d }) => {
  const m = DECISION_META[d];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: 600,
        border: `1px solid ${m.color}`,
        color: m.color,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)' }}>{m.glyph}</span>
      {m.label}
    </span>
  );
};

const ConfidenceBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 70 }}>
    <div
      style={{
        flex: 1,
        height: 4,
        background: 'var(--bg-sunken)',
        borderRadius: 2,
        overflow: 'hidden',
        maxWidth: 60,
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: '100%',
          background:
            value >= 70 ? 'var(--rag-green)' : value >= 50 ? 'var(--rag-amber)' : 'var(--rag-red)',
        }}
      />
    </div>
    <span
      style={{
        fontSize: 10.5,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--fg-tertiary)',
      }}
    >
      {value}
    </span>
  </div>
);

// ── Experiment card ────────────────────────────────────────────────────

const ExperimentCard: React.FC<{
  s: FlatSpinoff;
  compact?: boolean;
  onOpenSource?: (id: string) => void;
  onOpenDetail?: (s: FlatSpinoff) => void;
  onInlineUpdate?: (s: FlatSpinoff, patch: Partial<AuthoredSpinoff>) => void;
}> = ({ s, compact, onOpenSource, onOpenDetail, onInlineUpdate }) => {
  const meta = STAGE_META[s.stage];
  return (
    <div
      className="card"
      onClick={() => (onOpenDetail ? onOpenDetail(s) : undefined)}
      style={{
        padding: 12,
        borderLeft: `3px solid ${meta.color}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: onOpenDetail ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="text-mono" style={{ fontSize: 9.5, color: 'var(--fg-tertiary)', fontWeight: 600 }}>
          {s.id}
        </span>
        {/* Inline stage selector */}
        {onInlineUpdate ? (
          <select
            value={s.stage}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              onInlineUpdate(s, { stage: e.target.value as Stage })
            }
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '1px 4px',
              border: `1px solid ${meta.color}`,
              borderRadius: 4,
              background: meta.soft,
              color: meta.color,
              cursor: 'pointer',
            }}
          >
            {STAGE_ORDER.map((sg) => (
              <option key={sg} value={sg}>
                {STAGE_META[sg].label}
              </option>
            ))}
          </select>
        ) : null}
        {s.stage === 'decided' && onInlineUpdate ? (
          <select
            value={s.decision ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              onInlineUpdate(s, { decision: (e.target.value || undefined) as Decision | undefined })
            }
            style={{
              fontSize: 9.5,
              padding: '1px 4px',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              background: 'var(--bg-surface)',
              cursor: 'pointer',
            }}
          >
            <option value="">— Decision</option>
            {(Object.entries(DECISION_META) as [Decision, { label: string; glyph: string; color: string }][]).map(
              ([id, m]) => (
                <option key={id} value={id}>
                  {m.glyph} {m.label}
                </option>
              ),
            )}
          </select>
        ) : (
          s.decision && <DecisionChip d={s.decision} />
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9.5,
            color: 'var(--fg-tertiary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {s.timebox ?? ''}
        </span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.3, color: onOpenDetail ? 'var(--fg-primary)' : 'var(--fg-primary)' }}>
        {s.name}
      </div>
      <div className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, fontStyle: 'italic' }}>
        {compact && s.hypothesis.length > 100
          ? s.hypothesis.slice(0, 98) + '…'
          : s.hypothesis}
      </div>
      {(s.target || s.current) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            background: 'var(--bg-sunken)',
            borderRadius: 4,
            fontSize: 10.5,
          }}
        >
          <span className="text-tertiary">{s.metric}</span>
          <span style={{ fontWeight: 600 }}>
            {s.current ?? '—'} → {s.target ?? '—'}
          </span>
        </div>
      )}
      <ConfidenceBar value={s.confidence ?? 0} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
        <span className="text-tertiary">
          {s.owner}
          {s.sub ? ` · ${s.sub}` : ''}
        </span>
        <span
          className="pill"
          style={{ fontSize: 9.5 }}
          title={s.parent}
        >
          {s.parent}
        </span>
      </div>
      {onOpenSource && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSource(s.sourceDocId);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: 'var(--accent)',
            paddingTop: 4,
            borderTop: '1px solid var(--border-subtle)',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <span className="text-mono">{s.sourceDocId.slice(0, 8)}</span>
          <span style={{ color: 'var(--fg-tertiary)' }}>·</span>
          <span>{s.sourceDocTitle}</span>
        </button>
      )}
    </div>
  );
};

// ── Synthesis sidebar (scaffold) ───────────────────────────────────────

const SynthesisPanel: React.FC = () => {
  // Patterns are a placeholder. Real implementation will derive them from
  // tags or AI cross-experiment analysis. Functions refined later.
  const patterns = [
    {
      id: 'P-01',
      name: 'Fixed-price productisation',
      count: 3,
      lift: '+38% margin · +2.4× win-rate',
      body: 'Productised offers beat custom equivalents on both conversion AND margin.',
      tone: 'var(--rag-green)',
    },
    {
      id: 'P-02',
      name: 'Cadence interventions',
      count: 2,
      lift: '−5 d time-to-flag · +12pp KR freshness',
      body: 'Short-cycle rituals catch drift 2 weeks earlier than monthly ones.',
      tone: 'var(--rag-green)',
    },
    {
      id: 'P-03',
      name: 'Channel pay-to-play',
      count: 2,
      lift: 'mixed · 1 of 2 works',
      body: 'Paid referral programmes deliver only when the partner has a healthy book.',
      tone: 'var(--rag-amber)',
    },
  ];
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-sunken)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles className="h-3 w-3" style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 12, fontWeight: 700 }}>Synthesis · patterns observed</div>
        </div>
        <div className="text-tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
          Repeatable playbooks across experiments
        </div>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {patterns.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 10,
              borderRadius: 6,
              background: 'var(--bg-sunken)',
              borderLeft: `3px solid ${p.tone}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="text-mono" style={{ fontSize: 9.5, color: 'var(--fg-tertiary)' }}>{p.id}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--fg-tertiary)' }}>{p.count} exp</span>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: p.tone, marginTop: 4 }}>{p.lift}</div>
            <div className="text-secondary" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>{p.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Promotion queue ────────────────────────────────────────────────────

const PromotionQueue: React.FC<{ experiments: FlatSpinoff[] }> = ({ experiments }) => {
  const decisions = experiments.filter((s) => s.decision);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-sunken)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowUp className="h-3 w-3" style={{ color: 'var(--rag-green)' }} />
          <div style={{ fontSize: 12, fontWeight: 700 }}>Returning to plan</div>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-tertiary)' }}>
            {decisions.length} decision{decisions.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="text-tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
          Decided experiments queued for the next QBR
        </div>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {decisions.length === 0 ? (
          <div
            className="text-tertiary"
            style={{ fontSize: 11, padding: 12, textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: 6 }}
          >
            No decisions queued.
          </div>
        ) : (
          decisions.map((d) => {
            const meta = DECISION_META[d.decision!];
            return (
              <div
                key={d.id}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: 'var(--bg-sunken)',
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DecisionChip d={d.decision!} />
                  <span className="text-mono" style={{ fontSize: 9.5, color: 'var(--fg-tertiary)' }}>{d.id}</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4 }}>{d.name}</div>
                <div
                  className="text-tertiary"
                  style={{
                    fontSize: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 2,
                  }}
                >
                  <ArrowUp className="h-2.5 w-2.5" />
                  <span>{d.parent}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Empty state ────────────────────────────────────────────────────────

const EmptyState: React.FC<{
  navigate: (path: string) => void;
  hasFilters: boolean;
}> = ({ navigate, hasFilters }) => (
  <div
    className="card"
    style={{
      padding: '48px 24px',
      textAlign: 'center',
      color: 'var(--fg-tertiary)',
      fontSize: 13,
      lineHeight: 1.6,
    }}
  >
    <Sparkles className="h-8 w-8" style={{ margin: '0 auto 10px', opacity: 0.4 }} />
    {hasFilters ? (
      <>
        <div style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>
          No experiments match these filters
        </div>
        <div style={{ marginTop: 4 }}>Clear filters to see all experiments.</div>
      </>
    ) : (
      <>
        <div style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>No experiments yet</div>
        <div style={{ marginTop: 4 }}>
          Open a strategy document and add a spin-off to test a piece of the thesis.
        </div>
        <button
          onClick={() => navigate('/strategy/plans')}
          style={{
            marginTop: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Open strategy plans
        </button>
      </>
    )}
  </div>
);

export default ExperimentsPage;
