// ============================================================================
// OptionsAnalysisPage — /strategy/options
//
// Enterprise surface for AuthoredOptionsAnalysis records. Flattens every
// analysis across every strategy doc in the org, lets the user filter
// by source doc / status / theme / search, and opens a detail drawer
// that hosts the OptionsAnalysisEditor.
//
// Sized between an experiment and a financial model: a structured
// decision surface for infrastructure / capital / vendor / build-vs-buy
// choices. Functions like AI-assist for criteria suggestion, risk-
// adjusted NPV per option, and approval workflow are deferred.
// ============================================================================

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Download,
  Scale,
  Loader2,
  X,
  Check,
  Trash2,
  Wallet,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

import { strategyReviewService } from '../services/strategyReview.service';
import type {
  AuthoredOptionsAnalysis,
  AuthoredSpinoff,
  AuthoredCapitalBucket,
  OptionsAnalysisOption,
  StrategyReviewData,
} from '../types/strategy.types';
import { STRATEGY_COMPANY_ID } from '../constants/company';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  OptionsAnalysisEditor,
  createEmptyOptionsAnalysis,
  weightedScore,
} from '../components/review';

type Status = AuthoredOptionsAnalysis['status'];

interface FlatAnalysis extends AuthoredOptionsAnalysis {
  sourceDocId: string;
  sourceDocTitle: string;
  sourceDocThemes: NonNullable<StrategyReviewData['strategicThemes']>;
}

const STATUS_META: Record<Status, { label: string; color: string; soft: string }> = {
  draft:     { label: 'Draft',     color: 'var(--fg-tertiary)', soft: 'var(--bg-sunken)' },
  in_review: { label: 'In review', color: 'var(--rag-amber)',   soft: 'var(--rag-amber-soft)' },
  decided:   { label: 'Decided',   color: 'var(--rag-green)',   soft: 'var(--rag-green-soft)' },
  executing: { label: 'Executing', color: 'var(--rag-blue)',    soft: 'var(--rag-blue-soft)' },
};
const STATUS_ORDER: Status[] = ['draft', 'in_review', 'decided', 'executing'];

export const OptionsAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const companyId = STRATEGY_COMPANY_ID;
  const { user } = useAuth();
  const userId = user?.uid ?? 'unknown';

  const [docs, setDocs] = React.useState<StrategyReviewData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [filterDoc, setFilterDoc] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<'all' | Status>('all');
  const [filterTheme, setFilterTheme] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');

  const [newOpen, setNewOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<{
    analysis: AuthoredOptionsAnalysis;
    sourceDocId: string;
  } | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await strategyReviewService.getReviews(companyId, { limit: 200 });
      setDocs(rows.filter((r) => r.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  // ── Persistence helpers ────────────────────────────────────────────────
  const upsertAnalysis = React.useCallback(
    async (sourceDocId: string, analysis: AuthoredOptionsAnalysis) => {
      const source = docs.find((d) => d.id === sourceDocId);
      if (!source) throw new Error('Source strategy doc not found');
      const existing = source.optionsAnalyses ?? [];
      const next = existing.some((a) => a.id === analysis.id)
        ? existing.map((a) => (a.id === analysis.id ? analysis : a))
        : [...existing, analysis];
      const updated: StrategyReviewData = { ...source, optionsAnalyses: next };
      await strategyReviewService.saveReview(companyId, sourceDocId, updated, userId);
      setDocs((prev) => prev.map((d) => (d.id === sourceDocId ? updated : d)));
    },
    [companyId, docs, userId],
  );

  const deleteAnalysis = React.useCallback(
    async (sourceDocId: string, analysisId: string) => {
      const source = docs.find((d) => d.id === sourceDocId);
      if (!source) return;
      const next = (source.optionsAnalyses ?? []).filter((a) => a.id !== analysisId);
      const updated: StrategyReviewData = { ...source, optionsAnalyses: next };
      await strategyReviewService.saveReview(companyId, sourceDocId, updated, userId);
      setDocs((prev) => prev.map((d) => (d.id === sourceDocId ? updated : d)));
    },
    [companyId, docs, userId],
  );

  /** Spawn an AuthoredSpinoff on the same source doc, prewired with sourceAnalysis. */
  const spawnPilot = React.useCallback(
    async (
      sourceDocId: string,
      analysis: AuthoredOptionsAnalysis,
      option: OptionsAnalysisOption,
    ) => {
      const source = docs.find((d) => d.id === sourceDocId);
      if (!source) return;
      const spinoff: AuthoredSpinoff = {
        id: `SP-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        parent: analysis.themeId || sourceDocId,
        name: `Pilot · ${option.name}`,
        hypothesis: `Pilot proves option ${option.name}`,
        mechanism: 'Run a timeboxed pilot to validate the decision before full commit.',
        metric: '',
        owner: analysis.approver ?? '',
        stage: 'brief',
        confidence: 50,
        sourceDoc: sourceDocId,
        sourceAnalysis: analysis.id,
      };
      const nextSpins = [...(source.spinoffs ?? []), spinoff];
      const updated: StrategyReviewData = { ...source, spinoffs: nextSpins };
      await strategyReviewService.saveReview(companyId, sourceDocId, updated, userId);
      setDocs((prev) => prev.map((d) => (d.id === sourceDocId ? updated : d)));
    },
    [companyId, docs, userId],
  );

  /** Reserve a placeholder capital bucket from the option capex. */
  const reserveCapital = React.useCallback(
    async (
      sourceDocId: string,
      analysis: AuthoredOptionsAnalysis,
      option: OptionsAnalysisOption,
    ) => {
      const source = docs.find((d) => d.id === sourceDocId);
      if (!source) return;
      const bucket: AuthoredCapitalBucket = {
        id: `CAP-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        label: `Reserved · ${option.name}`,
        amount: option.capex ?? 0,
        themeId: analysis.themeId,
        tag: 'options-analysis',
      };
      const next = [...(source.capitalAllocation ?? []), bucket];
      const updated: StrategyReviewData = { ...source, capitalAllocation: next };
      await strategyReviewService.saveReview(companyId, sourceDocId, updated, userId);
      setDocs((prev) => prev.map((d) => (d.id === sourceDocId ? updated : d)));
    },
    [companyId, docs, userId],
  );

  // ── Flatten ────────────────────────────────────────────────────────────
  const allAnalyses: FlatAnalysis[] = React.useMemo(() => {
    const out: FlatAnalysis[] = [];
    for (const d of docs) {
      const items = d.optionsAnalyses ?? [];
      for (const a of items) {
        out.push({
          ...a,
          sourceDocId: d.id,
          sourceDocTitle: d.title || 'Untitled',
          sourceDocThemes: d.strategicThemes ?? [],
        });
      }
    }
    return out;
  }, [docs]);

  const themeOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const a of allAnalyses) if (a.themeId) set.add(a.themeId);
    return Array.from(set);
  }, [allAnalyses]);

  const docOptions = React.useMemo(
    () => docs.map((d) => ({ id: d.id, title: d.title || 'Untitled' })),
    [docs],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAnalyses.filter(
      (a) =>
        (filterDoc === 'all' || a.sourceDocId === filterDoc) &&
        (filterStatus === 'all' || a.status === filterStatus) &&
        (filterTheme === 'all' || a.themeId === filterTheme) &&
        (!q || a.question.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)),
    );
  }, [allAnalyses, filterDoc, filterStatus, filterTheme, search]);

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const total = allAnalyses.length;
    const inReview = allAnalyses.filter((a) => a.status === 'in_review').length;
    const decided = allAnalyses.filter((a) => a.status === 'decided' || a.status === 'executing');
    // Avg time-to-decision in days from createdAt → decisionDate.
    let avgDays = 0;
    if (decided.length > 0) {
      const sum = decided.reduce((acc, a) => {
        if (!a.decisionDate) return acc;
        const start = new Date(a.createdAt).getTime();
        const end = new Date(a.decisionDate).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return acc;
        return acc + (end - start) / (1000 * 60 * 60 * 24);
      }, 0);
      avgDays = Math.round(sum / decided.length);
    }
    const pendingApproval = allAnalyses.filter(
      (a) => a.status === 'in_review' && !!a.recommendation,
    ).length;
    return {
      total,
      inReview,
      decided: decided.length,
      avgDays,
      pendingApproval,
    };
  }, [allAnalyses]);

  // ── Detail drawer source ───────────────────────────────────────────────
  const detailSourceDoc = detail ? docs.find((d) => d.id === detail.sourceDocId) ?? null : null;
  const detailNpv = detailSourceDoc?.financialModel?.npvAssessments ?? [];

  // Related analyses (same source doc OR same theme), excluding self.
  const detailRelated = React.useMemo(() => {
    if (!detail) return [] as FlatAnalysis[];
    return allAnalyses.filter(
      (a) =>
        a.id !== detail.analysis.id &&
        (a.sourceDocId === detail.sourceDocId ||
          (detail.analysis.themeId && a.themeId === detail.analysis.themeId)),
    );
  }, [allAnalyses, detail]);

  // Linked experiments (same source doc, sourceAnalysis = this analysis id).
  const detailLinkedExperiments = React.useMemo(() => {
    if (!detail || !detailSourceDoc) return [] as AuthoredSpinoff[];
    return (detailSourceDoc.spinoffs ?? []).filter((s) => s.sourceAnalysis === detail.analysis.id);
  }, [detail, detailSourceDoc]);

  return (
    <div className="page-inner" style={{ padding: '24px 32px 64px', maxWidth: 1640, margin: '0 auto' }}>
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
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
            Options analysis
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
            Structured decisions across the cascade · {allAnalyses.length} analyses · {docs.length} docs
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
            onClick={() => setNewOpen(true)}
            disabled={docs.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 9px',
              borderRadius: 6,
              border: '1px solid var(--fg-primary)',
              background: 'var(--fg-primary)',
              cursor: docs.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: '#fff',
              opacity: docs.length === 0 ? 0.5 : 1,
            }}
            title={
              docs.length === 0 ? 'Create a strategy document first — analyses attach to a source doc' : undefined
            }
          >
            <Plus className="h-3 w-3" /> New analysis
          </button>
        </div>
      </div>

      {/* KPI band */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <KPITile label="Total analyses" value={String(stats.total)} unit="across docs" delta={`${docs.length} docs`} />
        <KPITile label="In review" value={String(stats.inReview)} unit="active" delta="awaiting call" />
        <KPITile label="Decided" value={String(stats.decided)} unit="moved" delta="incl. executing" />
        <KPITile label="Avg time-to-decision" value={String(stats.avgDays)} unit="days" delta="created → decided" />
        <KPITile
          label="Recommendations pending"
          value={String(stats.pendingApproval)}
          unit="for approval"
          delta="in review w/ rec"
        />
      </div>

      {/* Filter bar */}
      {!loading && (
        <div
          className="card"
          style={{
            padding: 0,
            marginBottom: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <FilterChips
              label="Source doc"
              value={filterDoc}
              setValue={setFilterDoc}
              options={[{ v: 'all', l: 'All' }, ...docOptions.map((d) => ({ v: d.id, l: d.title }))]}
            />
            <FilterChips
              label="Status"
              value={filterStatus}
              setValue={(v) => setFilterStatus(v as 'all' | Status)}
              options={[
                { v: 'all', l: 'All' },
                ...STATUS_ORDER.map((s) => ({ v: s, l: STATUS_META[s].label })),
              ]}
            />
            <FilterChips
              label="Theme"
              value={filterTheme}
              setValue={setFilterTheme}
              options={[{ v: 'all', l: 'All' }, ...themeOptions.map((t) => ({ v: t, l: t }))]}
            />
            <input
              placeholder="Search question or id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                marginLeft: 'auto',
                padding: '5px 10px',
                fontSize: 12,
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                minWidth: 220,
                background: 'var(--bg-surface)',
              }}
            />
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
            <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {filtered.length}
            </span>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              of {allAnalyses.length} analyses
            </span>
            <span style={{ flex: 1 }} />
            {(filterDoc !== 'all' || filterStatus !== 'all' || filterTheme !== 'all' || search) && (
              <button
                onClick={() => {
                  setFilterDoc('all');
                  setFilterStatus('all');
                  setFilterTheme('all');
                  setSearch('');
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

      {error && (
        <div
          style={{
            marginBottom: 12,
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
          Loading analyses…
        </div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'flex-start' }}>
          <div>
            {filtered.length === 0 ? (
              <EmptyState
                navigate={navigate}
                hasFilters={filterDoc !== 'all' || filterStatus !== 'all' || filterTheme !== 'all' || !!search}
              />
            ) : (
              <ListView
                analyses={filtered}
                onOpenSource={(id) => navigate(`/strategy/plans/review/${id}`)}
                onOpenDetail={(a) =>
                  setDetail({
                    analysis: stripFlatFields(a),
                    sourceDocId: a.sourceDocId,
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
            <SidePanel
              title="Linked experiments"
              icon={<ArrowUpRight className="h-3 w-3" style={{ color: 'var(--accent)' }} />}
              empty="No pilot spin-offs yet."
            >
              {(() => {
                // Linked experiments across all analyses.
                const all: Array<{ s: AuthoredSpinoff; analysis: FlatAnalysis }> = [];
                for (const a of allAnalyses) {
                  const doc = docs.find((d) => d.id === a.sourceDocId);
                  for (const s of doc?.spinoffs ?? []) {
                    if (s.sourceAnalysis === a.id) all.push({ s, analysis: a });
                  }
                }
                if (all.length === 0) return null;
                return all.slice(0, 6).map(({ s, analysis }) => (
                  <div
                    key={s.id}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: 'var(--bg-sunken)',
                      borderLeft: '3px solid var(--accent)',
                    }}
                  >
                    <div className="text-mono" style={{ fontSize: 9.5, color: 'var(--fg-tertiary)' }}>
                      {s.id} · from {analysis.id}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2 }}>{s.name}</div>
                  </div>
                ));
              })()}
            </SidePanel>
            <SidePanel
              title="Capital impact"
              icon={<Wallet className="h-3 w-3" style={{ color: 'var(--rag-green)' }} />}
              empty="No decided options with capex yet."
            >
              {(() => {
                const decided = allAnalyses.filter(
                  (a) => a.status === 'decided' || a.status === 'executing',
                );
                const totalCapex = decided.reduce((acc, a) => {
                  const opt = a.options.find((o) => o.id === (a.recommendation ?? a.options[0]?.id));
                  return acc + (opt?.capex ?? 0);
                }, 0);
                if (totalCapex === 0) return null;
                return (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: 'var(--bg-sunken)',
                    }}
                  >
                    <div className="text-tertiary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                      Sum of decided options · capex
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        marginTop: 4,
                        color: 'var(--rag-green)',
                      }}
                    >
                      {fmtMoney(totalCapex)}
                    </div>
                    <div className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
                      across {decided.length} decided analyses
                    </div>
                  </div>
                );
              })()}
            </SidePanel>
            <SidePanel
              title="Recommendations pending"
              icon={<Sparkles className="h-3 w-3" style={{ color: 'var(--rag-amber)' }} />}
              empty="Nothing waiting for approval."
            >
              {(() => {
                const pending = allAnalyses.filter((a) => a.status === 'in_review');
                if (pending.length === 0) return null;
                return pending.slice(0, 8).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setDetail({ analysis: stripFlatFields(a), sourceDocId: a.sourceDocId })}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: 'var(--bg-sunken)',
                      borderLeft: '3px solid var(--rag-amber)',
                      border: 0,
                      borderLeftWidth: 3,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div className="text-mono" style={{ fontSize: 9.5, color: 'var(--fg-tertiary)' }}>{a.id}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, lineHeight: 1.35 }}>
                      {a.question || '(no question)'}
                    </div>
                    <div className="text-tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
                      {a.sourceDocTitle}
                    </div>
                  </button>
                ));
              })()}
            </SidePanel>
          </aside>
        </div>
      )}

      {/* New analysis dialog */}
      <NewOptionsAnalysisDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        sourceDocs={docs}
        onCreate={async ({ sourceDocId, analysis }) => {
          await upsertAnalysis(sourceDocId, analysis);
        }}
      />

      {/* Detail drawer */}
      <OptionsAnalysisDetailDrawer
        open={!!detail}
        onClose={() => setDetail(null)}
        analysis={detail?.analysis ?? null}
        sourceDocId={detail?.sourceDocId ?? null}
        npvAssessments={detailNpv}
        relatedAnalyses={detailRelated}
        linkedExperiments={detailLinkedExperiments}
        companyId={companyId}
        onSave={async ({ sourceDocId, analysis }) => {
          await upsertAnalysis(sourceDocId, analysis);
        }}
        onDelete={async ({ sourceDocId, analysisId }) => {
          await deleteAnalysis(sourceDocId, analysisId);
          setDetail(null);
        }}
        onSpawnPilot={async ({ sourceDocId, analysis, option }) => {
          await spawnPilot(sourceDocId, analysis, option);
        }}
        onReserveCapital={async ({ sourceDocId, analysis, option }) => {
          await reserveCapital(sourceDocId, analysis, option);
        }}
      />
    </div>
  );
};

function stripFlatFields(a: FlatAnalysis): AuthoredOptionsAnalysis {
  const { sourceDocId: _src, sourceDocTitle: _t, sourceDocThemes: _th, ...rest } = a;
  return rest as AuthoredOptionsAnalysis;
}

// ── ListView ───────────────────────────────────────────────────────────────

const ListView: React.FC<{
  analyses: FlatAnalysis[];
  onOpenSource: (id: string) => void;
  onOpenDetail: (a: FlatAnalysis) => void;
}> = ({ analyses, onOpenSource, onOpenDetail }) => (
  <div className="card" style={{ overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ width: 70 }}>Ref</th>
            <th>Question</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 84 }}>Options</th>
            <th style={{ width: 140 }}>Recommendation</th>
            <th style={{ width: 200 }}>Source doc</th>
            <th style={{ width: 110 }}>Approver</th>
            <th style={{ width: 100 }}>Decision</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((a) => {
            const recId = a.recommendation ?? a.options[0]?.id;
            const rec = a.options.find((o) => o.id === recId);
            const recScore = rec ? weightedScore(rec, a.criteria) : 0;
            return (
              <tr
                key={a.id}
                onClick={() => onOpenDetail(a)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <span className="text-mono" style={{ fontSize: 10.5 }}>{a.id}</span>
                </td>
                <td>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      lineHeight: 1.4,
                      maxWidth: 460,
                    }}
                  >
                    {a.question || '(no question)'}
                  </div>
                  {a.themeId && (
                    <div className="text-tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
                      theme · {a.themeId}
                    </div>
                  )}
                </td>
                <td>
                  <StatusChip status={a.status} />
                </td>
                <td className="text-secondary" style={{ fontSize: 11.5 }}>
                  {a.options.length}
                </td>
                <td>
                  {rec ? (
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600 }}>{rec.name}</div>
                      <div
                        className="text-tertiary"
                        style={{ fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}
                      >
                        Σ {recScore.toFixed(2)} / 5
                      </div>
                    </div>
                  ) : (
                    <span className="text-tertiary" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSource(a.sourceDocId);
                    }}
                    style={{
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span className="text-mono" style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}>
                      {a.sourceDocId.slice(0, 8)}
                    </span>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>
                      {a.sourceDocTitle}
                    </div>
                  </button>
                </td>
                <td className="text-secondary" style={{ fontSize: 11.5 }}>{a.approver ?? '—'}</td>
                <td className="text-secondary" style={{ fontSize: 11 }}>
                  {a.decisionDate ? a.decisionDate.slice(0, 10) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// ── KPITile / FilterChips / StatusChip / SidePanel / EmptyState ────────────

const KPITile: React.FC<{ label: string; value: string; unit?: string; delta?: string }> = ({
  label,
  value,
  unit,
  delta,
}) => (
  <div className="kpi" style={{ padding: 14 }}>
    <span className="kpi-label">{label}</span>
    <span className="kpi-value">
      {value}
      {unit && <span className="unit">{unit}</span>}
    </span>
    {delta && (
      <span style={{ fontSize: 11.5, color: 'var(--fg-tertiary)' }}>
        {delta}
      </span>
    )}
  </div>
);

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
      {options.slice(0, 6).map((o) => {
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
              maxWidth: 160,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {o.l}
          </button>
        );
      })}
      {options.length > 6 && (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            padding: '3px 6px',
            fontSize: 11,
            border: 0,
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--fg-tertiary)',
          }}
        >
          {options.map((o) => (
            <option key={o.v} value={o.v}>{o.l}</option>
          ))}
        </select>
      )}
    </div>
  </div>
);

const StatusChip: React.FC<{ status: Status }> = ({ status }) => {
  const m = STATUS_META[status];
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
        background: m.soft,
        color: m.color,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color }} />
      {m.label}
    </span>
  );
};

const SidePanel: React.FC<{
  title: string;
  icon: React.ReactNode;
  empty: string;
  children?: React.ReactNode;
}> = ({ title, icon, empty, children }) => (
  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-sunken)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon}
      <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
    </div>
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {children ?? (
        <div
          className="text-tertiary"
          style={{
            fontSize: 11,
            padding: 10,
            textAlign: 'center',
            border: '1px dashed var(--border-default)',
            borderRadius: 6,
          }}
        >
          {empty}
        </div>
      )}
    </div>
  </div>
);

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
    <Scale className="h-8 w-8" style={{ margin: '0 auto 10px', opacity: 0.4 }} />
    {hasFilters ? (
      <>
        <div style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>No analyses match these filters</div>
        <div style={{ marginTop: 4 }}>Clear filters to see all analyses.</div>
      </>
    ) : (
      <>
        <div style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>No options analyses yet</div>
        <div style={{ marginTop: 4 }}>
          Frame a decision question and score the alternatives side-by-side.
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

// ── NewOptionsAnalysisDialog ───────────────────────────────────────────────

interface NewOptionsAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  sourceDocs: StrategyReviewData[];
  onCreate: (params: { sourceDocId: string; analysis: AuthoredOptionsAnalysis }) => Promise<void> | void;
}

const NewOptionsAnalysisDialog: React.FC<NewOptionsAnalysisDialogProps> = ({
  open,
  onClose,
  sourceDocs,
  onCreate,
}) => {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [sourceDocId, setSourceDocId] = React.useState('');
  const [themeId, setThemeId] = React.useState('');
  const [question, setQuestion] = React.useState('');
  const [criteriaRaw, setCriteriaRaw] = React.useState('NPV, Time-to-value, Strategic fit');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setSourceDocId(sourceDocs[0]?.id ?? '');
    setThemeId('');
    setQuestion('');
    setCriteriaRaw('NPV, Time-to-value, Strategic fit');
    setSubmitting(false);
  }, [open, sourceDocs]);

  if (!open) return null;

  const doc = sourceDocs.find((d) => d.id === sourceDocId);
  const themes = doc?.strategicThemes ?? [];
  const canSubmit = !!sourceDocId && question.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const base = createEmptyOptionsAnalysis(sourceDocId, question.trim(), themeId || undefined);
      const labels = criteriaRaw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
      const seeded =
        labels.length > 0
          ? labels.map((l, i, arr) => ({
              id: `CR-${i}-${Date.now().toString(36).slice(-3)}`,
              label: l,
              weight: Number((1 / arr.length).toFixed(2)),
            }))
          : base.criteria;
      const analysis: AuthoredOptionsAnalysis = { ...base, criteria: seeded };
      await onCreate({ sourceDocId, analysis });
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
        aria-label="New options analysis"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(620px, 92vw)',
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
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>New options analysis</h3>
            <div className="text-tertiary" style={{ fontSize: 12.5, marginTop: 2 }}>
              Step {step} of 2 · {step === 1 ? 'Source doc + theme' : 'Question + criteria'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', padding: 6, background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--fg-tertiary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {step === 1 ? (
            <>
              <div>
                <label style={dialogLabel}>Source strategy document</label>
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
                    style={dialogInput}
                  >
                    {sourceDocs.map((d) => (
                      <option key={d.id} value={d.id}>{d.title || 'Untitled'}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label style={dialogLabel}>Parent theme · optional</label>
                {themes.length === 0 ? (
                  <div className="text-tertiary" style={{ fontSize: 12 }}>
                    The selected doc has no themes — the analysis will roll up to the doc directly.
                  </div>
                ) : (
                  <select value={themeId} onChange={(e) => setThemeId(e.target.value)} style={dialogInput}>
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
                Options analyses sit between experiments and financial models. Score 2–4 options against weighted criteria; the top option becomes the default recommendation.
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={dialogLabel}>Decision question</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder='e.g. "How do we add 30% finishing capacity?"'
                  style={{ ...dialogInput, minHeight: 60, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                  autoFocus
                />
              </div>
              <div>
                <label style={dialogLabel}>Seed criteria · comma-separated</label>
                <input
                  value={criteriaRaw}
                  onChange={(e) => setCriteriaRaw(e.target.value)}
                  placeholder="NPV, Time-to-value, Strategic fit"
                  style={dialogInput}
                />
                <div className="text-tertiary" style={{ fontSize: 11, marginTop: 4 }}>
                  Weights are split equally — adjust them in the editor.
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
                }}
              >
                Back
              </button>
            )}
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!sourceDocId}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--fg-primary)',
                  background: 'var(--fg-primary)',
                  color: '#fff',
                  cursor: sourceDocId ? 'pointer' : 'not-allowed',
                  fontSize: 12.5,
                  fontWeight: 500,
                  opacity: sourceDocId ? 1 : 0.5,
                }}
              >
                Next
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
                <Check className="h-3 w-3" /> {submitting ? 'Creating…' : 'Create analysis'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const dialogLabel: React.CSSProperties = {
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 600,
  color: 'var(--fg-tertiary)',
  display: 'block',
  marginBottom: 4,
};
const dialogInput: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  background: 'var(--bg-surface)',
  fontSize: 13,
};

// ── OptionsAnalysisDetailDrawer ────────────────────────────────────────────

interface OptionsAnalysisDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  analysis: AuthoredOptionsAnalysis | null;
  sourceDocId: string | null;
  npvAssessments: NonNullable<StrategyReviewData['financialModel']>['npvAssessments'];
  relatedAnalyses: FlatAnalysis[];
  linkedExperiments: AuthoredSpinoff[];
  companyId?: string;
  onSave: (params: { sourceDocId: string; analysis: AuthoredOptionsAnalysis }) => Promise<void> | void;
  onDelete?: (params: { sourceDocId: string; analysisId: string }) => Promise<void> | void;
  onSpawnPilot?: (params: {
    sourceDocId: string;
    analysis: AuthoredOptionsAnalysis;
    option: OptionsAnalysisOption;
  }) => Promise<void> | void;
  onReserveCapital?: (params: {
    sourceDocId: string;
    analysis: AuthoredOptionsAnalysis;
    option: OptionsAnalysisOption;
  }) => Promise<void> | void;
}

const OptionsAnalysisDetailDrawer: React.FC<OptionsAnalysisDetailDrawerProps> = ({
  open,
  onClose,
  analysis,
  sourceDocId,
  npvAssessments,
  relatedAnalyses,
  linkedExperiments,
  companyId,
  onSave,
  onDelete,
  onSpawnPilot,
  onReserveCapital,
}) => {
  const [draft, setDraft] = React.useState<AuthoredOptionsAnalysis | null>(analysis);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(analysis);
    setSaving(false);
  }, [analysis?.id, open]);

  if (!open || !draft || !sourceDocId) return null;

  const handleSave = async () => {
    if (!draft || !sourceDocId) return;
    setSaving(true);
    try {
      await onSave({ sourceDocId, analysis: draft });
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
          zIndex: 88,
        }}
      />
      <div
        role="dialog"
        aria-label="Options analysis detail"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(960px, 96vw)',
          background: 'var(--bg-surface)',
          boxShadow: '-8px 0 32px rgba(20, 20, 22, 0.16)',
          zIndex: 92,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Scale className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <div style={{ flex: 1 }}>
            <div className="text-mono" style={{ fontSize: 10.5, color: 'var(--fg-tertiary)', letterSpacing: '0.08em', fontWeight: 700 }}>
              {draft.id}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>
              {draft.question || '(no question)'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 6, background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--fg-tertiary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 18, alignItems: 'flex-start' }}>
          <OptionsAnalysisEditor
            value={draft}
            onChange={setDraft}
            npvAssessments={npvAssessments}
            companyId={companyId}
            reviewId={sourceDocId}
            onSpawnPilot={({ analysis: a, option }) =>
              onSpawnPilot?.({ sourceDocId, analysis: a, option })
            }
            onReserveCapital={({ analysis: a, option }) =>
              onReserveCapital?.({ sourceDocId, analysis: a, option })
            }
          />
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SidePanel
              title="Related analyses"
              icon={<Scale className="h-3 w-3" style={{ color: 'var(--fg-tertiary)' }} />}
              empty="No related analyses on this doc or theme."
            >
              {relatedAnalyses.length > 0
                ? relatedAnalyses.slice(0, 8).map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        background: 'var(--bg-sunken)',
                        borderLeft: `3px solid ${STATUS_META[r.status].color}`,
                      }}
                    >
                      <div className="text-mono" style={{ fontSize: 9.5, color: 'var(--fg-tertiary)' }}>{r.id}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, lineHeight: 1.35 }}>
                        {r.question || '—'}
                      </div>
                      <div className="text-tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
                        {STATUS_META[r.status].label}
                      </div>
                    </div>
                  ))
                : null}
            </SidePanel>
            <SidePanel
              title="Pilot spin-offs"
              icon={<ArrowUpRight className="h-3 w-3" style={{ color: 'var(--accent)' }} />}
              empty="No pilots spawned from this analysis yet."
            >
              {linkedExperiments.length > 0
                ? linkedExperiments.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        background: 'var(--bg-sunken)',
                        borderLeft: '3px solid var(--accent)',
                      }}
                    >
                      <div className="text-mono" style={{ fontSize: 9.5, color: 'var(--fg-tertiary)' }}>{s.id}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2 }}>{s.name}</div>
                      <div className="text-tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
                        Stage · {s.stage}
                      </div>
                    </div>
                  ))
                : null}
            </SidePanel>
          </aside>
        </div>

        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {onDelete ? (
            <button
              onClick={() => onDelete({ sourceDocId, analysisId: draft.id })}
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
    </>
  );
};

// ── tiny utils ─────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export default OptionsAnalysisPage;
