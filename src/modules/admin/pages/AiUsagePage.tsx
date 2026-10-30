/**
 * /admin/ai-usage — what the platform spends on AI, which features spend it,
 * and what was billed for nothing. Reads the rollups (`ai_usage_daily`,
 * `ai_usage_monthly`), never the raw ledger. Budgets and the pause switches
 * (`ai_policy/global`) are admin-only — the rules refuse the write regardless
 * of what this page shows.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Ban, Play, RefreshCw } from 'lucide-react';
import { KPICard } from '@/shared/components/data-display';
import { Banner } from '@/shared/components/data-display';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { PageHero } from '@/shared/components/refresh';
import { useCurrentDawinUser } from '@/core/settings';
import { formatRate } from '@/shared/constants/aiPricing';
import { findWaste, getMonth, getPolicy, getRecentDays, mergeBreakdown, projectMonth, savePolicy, setFeatureEnabled, sumDays, toMonthKey, toRows } from '../services/aiUsageService';
import type { AiPolicy, AiUsageDaily, AiUsageMonthly, AiUsageRow } from '../types/aiUsage';

const WINDOWS = [7, 30, 90] as const;
type WindowDays = (typeof WINDOWS)[number];

const DIMENSIONS = [
  { key: 'byFeature', label: 'Feature' },
  { key: 'byModel', label: 'Model' },
  { key: 'byAgent', label: 'Agent' },
  { key: 'byTrigger', label: 'Triggered by' },
  { key: 'bySubsidiary', label: 'Brand' },
  { key: 'byUser', label: 'User' },
] as const;
type DimensionKey = (typeof DIMENSIONS)[number]['key'];

const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`;
const compactUsd = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`);
const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

export default function AiUsagePage() {
  const { dawinUser } = useCurrentDawinUser();
  const canEditPolicy = dawinUser?.globalRole === 'admin' || dawinUser?.globalRole === 'owner';
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [dimension, setDimension] = useState<DimensionKey>('byFeature');
  const [days, setDays] = useState<AiUsageDaily[]>([]);
  const [month, setMonth] = useState<AiUsageMonthly | null>(null);
  const [policy, setPolicy] = useState<AiPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, m, p] = await Promise.all([getRecentDays(windowDays), getMonth(toMonthKey(new Date())), getPolicy()]);
      setDays(d);
      setMonth(m);
      setPolicy(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => sumDays(days), [days]);
  const rows = useMemo(() => toRows(mergeBreakdown(days, dimension)), [days, dimension]);
  const waste = useMemo(() => findWaste(days), [days]);
  const projected = useMemo(() => projectMonth(month), [month]);
  const cacheable = totals.inputTokens + totals.cacheReadTokens;
  const cacheHitRate = cacheable > 0 ? totals.cacheReadTokens / cacheable : 0;
  const budgetUsed = policy?.monthlyBudgetUsd && month ? month.costUsd / policy.monthlyBudgetUsd : null;
  const noData = !loading && days.length === 0;

  const withSaving = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); await load(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5" data-testid="ai-usage-page">
      <PageHero
        eyebrow="Admin"
        title="AI usage & cost"
        body="Every model call the platform makes, priced when it is recorded. Which features spend it, and what was billed for nothing."
        actions={
          <div className="flex items-center gap-2">
            {WINDOWS.map((w) => (
              <Button key={w} size="sm" variant={w === windowDays ? 'default' : 'outline'} onClick={() => setWindowDays(w)}>{w}d</Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {error && <Banner tone="danger" title="Could not load usage" message={error} onDismiss={() => setError(null)} />}

      {noData && !error && (
        <Banner tone="info" title="No AI usage has been rolled up yet" message="The hourly job writes the first day within an hour of a model call being made." />
      )}

      {!noData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard label="Spend · month" value={month ? compactUsd(month.costUsd) : '—'} unit={month ? `UGX ${Math.round(month.costUgx).toLocaleString()}` : undefined} />
            <KPICard label="Projected" value={projected != null ? compactUsd(projected) : '—'} unit="straight-line estimate" />
            <KPICard label="Budget used" value={budgetUsed != null ? pct(budgetUsed) : 'no budget'} unit={policy?.monthlyBudgetUsd ? `of ${usd(policy.monthlyBudgetUsd)}` : undefined} trend={budgetUsed != null && budgetUsed >= 1 ? 'down' : 'flat'} />
            <KPICard label="Cache hit rate" value={pct(cacheHitRate)} unit={`${tokens(totals.cacheReadTokens)} cached`} />
            <KPICard label="Wasted" value={compactUsd(totals.wasteCostUsd)} unit={`${totals.wasteCalls.toLocaleString()} calls`} />
            <KPICard label="Calls" value={totals.calls.toLocaleString()} unit={`${pct(totals.calls ? totals.okCalls / totals.calls : 0)} succeeded`} />
          </div>

          {waste.length > 0 && <WasteFinder findings={waste} />}

          <BreakdownTable
            rows={rows}
            dimension={dimension}
            onDimensionChange={setDimension}
            canEditPolicy={canEditPolicy}
            policy={policy}
            saving={saving}
            onToggleFeature={(feature, enabled) => withSaving(() => setFeatureEnabled(feature, enabled))}
          />

          {canEditPolicy && policy && <BudgetEditor policy={policy} saving={saving} onSave={(patch) => withSaving(() => savePolicy(patch))} />}
        </>
      )}
    </div>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <header className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <h3 className="text-h3" style={{ color: 'var(--fg-primary)' }}>{title}</h3>
        {subtitle && <p className="text-small mt-0.5" style={{ color: 'var(--fg-tertiary)' }}>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function WasteFinder({ findings }: { findings: ReturnType<typeof findWaste> }) {
  return (
    <Shell title="Where the money went for nothing" subtitle="Known failure patterns, ranked by what they cost.">
      <ul data-testid="waste-finder">
        {findings.map((f) => (
          <li key={f.id} className="px-4 py-3 flex items-start gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: f.severity === 'critical' ? 'var(--rag-red)' : f.severity === 'warning' ? 'var(--rag-amber)' : 'var(--fg-tertiary)' }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-small font-medium" style={{ color: 'var(--fg-primary)' }}>{f.title}</span>
                <span className="text-small tabular-nums shrink-0" style={{ color: 'var(--fg-primary)' }}>{f.costUsd > 0 ? compactUsd(f.costUsd) : `${f.calls.toLocaleString()} calls`}</span>
              </div>
              <p className="text-small mt-0.5" style={{ color: 'var(--fg-tertiary)' }}>{f.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function BreakdownTable({ rows, dimension, onDimensionChange, canEditPolicy, policy, saving, onToggleFeature }: {
  rows: AiUsageRow[];
  dimension: DimensionKey;
  onDimensionChange: (d: DimensionKey) => void;
  canEditPolicy: boolean;
  policy: AiPolicy | null;
  saving: boolean;
  onToggleFeature: (feature: string, enabled: boolean) => Promise<void>;
}) {
  const showPause = canEditPolicy && dimension === 'byFeature';
  return (
    <Shell title="Cost by dimension" subtitle="Cost per successful call is the number that compares two features — a cheap model that fails and gets retried is not cheap.">
      <div className="px-4 py-2 flex flex-wrap gap-1.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
        {DIMENSIONS.map((d) => (
          <Button key={d.key} size="sm" variant={d.key === dimension ? 'default' : 'ghost'} onClick={() => onDimensionChange(d.key)}>{d.label}</Button>
        ))}
      </div>
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
        <table className="w-full text-small" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <tr style={{ color: 'var(--fg-tertiary)' }}>
              <th className="text-left font-medium px-4 py-2">Name</th>
              <th className="text-right font-medium px-3 py-2">Calls</th>
              <th className="text-right font-medium px-3 py-2">Success</th>
              <th className="text-right font-medium px-3 py-2">In / out</th>
              <th className="text-right font-medium px-3 py-2">Cached</th>
              <th className="text-right font-medium px-3 py-2">Cost</th>
              <th className="text-right font-medium px-3 py-2">Per success</th>
              <th className="text-right font-medium px-3 py-2">Share</th>
              {showPause && <th className="text-right font-medium px-4 py-2">Live</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const paused = policy?.features?.[r.key]?.enabled === false;
              return (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border-default)' }} data-testid="usage-row">
                  <td className="px-4 py-2" style={{ color: 'var(--fg-primary)' }}>
                    <span className="font-medium">{r.key}</span>
                    {dimension === 'byModel' && <span className="ml-2" style={{ color: 'var(--fg-tertiary)' }}>{formatRate(r.key)}</span>}
                    {paused && <span className="ml-2 text-tiny" style={{ color: 'var(--rag-amber)' }}>paused</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.calls.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: r.successRate < 0.9 ? 'var(--rag-amber)' : undefined }}>{pct(r.successRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--fg-secondary)' }}>{tokens(r.inputTokens)} / {tokens(r.outputTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--fg-secondary)' }}>{tokens(r.cacheReadTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--fg-primary)' }}>{compactUsd(r.costUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{compactUsd(r.costPerOkCallUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--fg-tertiary)' }}>{pct(r.shareOfCost)}</td>
                  {showPause && (
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" disabled={saving} onClick={() => void onToggleFeature(r.key, paused)} title={paused ? 'Resume this feature' : 'Pause this feature'} aria-label={`${paused ? 'Resume' : 'Pause'} ${r.key}`}>
                        {paused ? <Play className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={showPause ? 9 : 8} className="px-4 py-6 text-center" style={{ color: 'var(--fg-tertiary)' }}>Nothing recorded in this window.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function BudgetEditor({ policy, saving, onSave }: { policy: AiPolicy; saving: boolean; onSave: (patch: Partial<AiPolicy>) => Promise<void> }) {
  const [monthly, setMonthly] = useState(policy.monthlyBudgetUsd?.toString() ?? '');
  const [daily, setDaily] = useState(policy.dailyBudgetUsd?.toString() ?? '');
  return (
    <Shell title="Budgets" subtitle="Thresholds raise an alert to the admins; they never refuse a call. A cap that stops work mid-month turns a cost problem into an outage.">
      <div className="px-4 py-3 flex flex-wrap items-end gap-4">
        <label className="text-small" style={{ color: 'var(--fg-tertiary)' }}>
          <span className="block mb-1">Monthly budget (USD)</span>
          <Input value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="none" className="w-36" inputMode="decimal" aria-label="Monthly budget (USD)" />
        </label>
        <label className="text-small" style={{ color: 'var(--fg-tertiary)' }}>
          <span className="block mb-1">Daily budget (USD)</span>
          <Input value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="none" className="w-36" inputMode="decimal" aria-label="Daily budget (USD)" />
        </label>
        <Button size="sm" disabled={saving} onClick={() => void onSave({ monthlyBudgetUsd: monthly.trim() === '' ? null : Number(monthly), dailyBudgetUsd: daily.trim() === '' ? null : Number(daily) })}>
          Save budgets
        </Button>
        <span className="text-small" style={{ color: 'var(--fg-tertiary)' }}>Alerts at {policy.alertThresholds.map((t) => pct(t)).join(', ')} of budget.</span>
      </div>
    </Shell>
  );
}
