/**
 * KPI Active Tracking Page
 * Shows all currently tracked KPIs with filtering, performance status, and actions.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  Pause,
  Archive,
  BookOpen,
  Target,
} from 'lucide-react';
import { useKPIs } from '../hooks/useKPIs';
import {
  KPI_CATEGORY_LABELS,
  KPI_PERFORMANCE,
  KPI_PERFORMANCE_LABELS,
  KPI_PERFORMANCE_COLORS,
  formatKPIValue,
  type KPICategory,
} from '../constants/kpi.constants';
import type { KPIDefinition, KPITarget } from '../types/kpi.types';
import { SetTargetDialog } from '../components/kpi/SetTargetDialog';

// ── Performance Badge ─────────────────────────────────────────────────────

function PerformanceBadge({ performance }: { performance: string }) {
  const label = KPI_PERFORMANCE_LABELS[performance as keyof typeof KPI_PERFORMANCE_LABELS] || 'No Data';
  const color = KPI_PERFORMANCE_COLORS[performance as keyof typeof KPI_PERFORMANCE_COLORS] || '#9E9E9E';

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ── Trend Icon ────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'stable' }) {
  switch (trend) {
    case 'up':
      return <ArrowUp className="w-3.5 h-3.5 text-[var(--rag-green)]" />;
    case 'down':
      return <ArrowDown className="w-3.5 h-3.5 text-[var(--rag-red)]" />;
    default:
      return <Minus className="w-3.5 h-3.5 text-[var(--fg-tertiary)]" />;
  }
}

// ── Target Cell ───────────────────────────────────────────────────────────

function TargetCell({ kpi }: { kpi: KPIDefinition }) {
  const t = kpi.target;
  if (!t || t.value == null) {
    return <span className="text-sm text-[var(--fg-tertiary)] italic">No target</span>;
  }

  return (
    <div className="text-right">
      <span className="text-sm text-muted-foreground">
        {formatKPIValue(t.value, kpi.type, kpi.unit)}
      </span>
      {/* Stretch / Minimum indicators */}
      {(t.stretchValue != null || t.minimumValue != null) && (
        <div className="flex items-center gap-1.5 justify-end mt-0.5">
          {t.minimumValue != null && (
            <span className="text-[10px] text-[var(--rag-amber)]" title="Minimum acceptable">
              Min {formatKPIValue(t.minimumValue, kpi.type, kpi.unit)}
            </span>
          )}
          {t.stretchValue != null && (
            <span className="text-[10px] text-[var(--rag-green)]" title="Stretch target">
              Stretch {formatKPIValue(t.stretchValue, kpi.type, kpi.unit)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── KPI Row ───────────────────────────────────────────────────────────────

function KPIRow({ kpi, onSetTarget, onPause, onArchive }: {
  kpi: KPIDefinition;
  onSetTarget: (kpi: KPIDefinition) => void;
  onPause: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const variance = kpi.currentValue != null && kpi.target?.value
    ? ((kpi.currentValue - kpi.target.value) / kpi.target.value * 100).toFixed(1)
    : null;

  const hasTarget = kpi.target?.value != null;

  return (
    <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-sunken)] transition-colors">
      <td className="py-3 px-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--fg-tertiary)] bg-[var(--bg-sunken)] px-1.5 py-0.5 rounded">
              {kpi.code}
            </span>
            <span className="text-sm font-medium text-foreground">{kpi.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {KPI_CATEGORY_LABELS[kpi.category as KPICategory] || kpi.category}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-sm font-semibold text-foreground">
          {kpi.currentValue != null
            ? formatKPIValue(kpi.currentValue, kpi.type, kpi.unit)
            : '-'}
        </span>
      </td>
      <td className="py-3 px-4">
        <TargetCell kpi={kpi} />
      </td>
      <td className="py-3 px-4 text-right">
        {variance != null ? (
          <span className={`text-sm font-medium ${parseFloat(variance) >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
            {parseFloat(variance) >= 0 ? '+' : ''}{variance}%
          </span>
        ) : (
          <span className="text-sm text-[var(--fg-tertiary)]">-</span>
        )}
      </td>
      <td className="py-3 px-4">
        <PerformanceBadge performance={kpi.currentPerformance || KPI_PERFORMANCE.NO_DATA} />
      </td>
      <td className="py-3 px-4 text-center">
        <TrendIcon trend={kpi.trendDirection} />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => onSetTarget(kpi)}
            className={`p-1 rounded ${hasTarget ? 'text-[var(--fg-tertiary)] hover:text-[var(--rag-blue)]' : 'text-[var(--rag-blue)] hover:text-[var(--rag-blue)]'}`}
            title={hasTarget ? 'Edit Target' : 'Set Target'}
          >
            <Target className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onPause(kpi.id)}
            className="p-1 text-[var(--fg-tertiary)] hover:text-[var(--rag-amber)] rounded"
            title="Pause"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onArchive(kpi.id)}
            className="p-1 text-[var(--fg-tertiary)] hover:text-[var(--rag-red)] rounded"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

const COMPANY_ID = 'dawinos';

export function KPIActivePage() {
  const navigate = useNavigate();

  const {
    activeKPIs,
    loading,
    refresh,
    updateTarget,
    pauseKPI,
    archiveKPI,
  } = useKPIs({
    companyId: COMPANY_ID,
    autoFetch: true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('');
  const [targetDialogKPI, setTargetDialogKPI] = useState<KPIDefinition | null>(null);

  // Filter KPIs
  let filtered = activeKPIs;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (k) => k.name.toLowerCase().includes(q) || k.code.toLowerCase().includes(q)
    );
  }
  if (categoryFilter) {
    filtered = filtered.filter((k) => k.category === categoryFilter);
  }
  if (performanceFilter) {
    filtered = filtered.filter((k) => k.currentPerformance === performanceFilter);
  }

  const uniqueCategories = Array.from(new Set(activeKPIs.map((k) => k.category)));

  async function handleSaveTarget(kpiId: string, target: KPITarget) {
    await updateTarget(kpiId, target);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Active KPI Tracking</h1>
          <p className="text-muted-foreground text-sm">
            {activeKPIs.length} KPIs being actively tracked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground bg-card border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-sunken)]"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => navigate('/strategy/kpis/library')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue)]"
          >
            <BookOpen className="w-4 h-4" />
            Add from Library
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search KPIs..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-[var(--border-subtle)] rounded-lg px-3 py-2 bg-card"
        >
          <option value="">All Categories</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>
              {KPI_CATEGORY_LABELS[cat as KPICategory] || cat}
            </option>
          ))}
        </select>

        <select
          value={performanceFilter}
          onChange={(e) => setPerformanceFilter(e.target.value)}
          className="text-sm border border-[var(--border-subtle)] rounded-lg px-3 py-2 bg-card"
        >
          <option value="">All Performance</option>
          {Object.entries(KPI_PERFORMANCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading KPIs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-[var(--fg-tertiary)] mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-2">No active KPIs found.</p>
          <button
            onClick={() => navigate('/strategy/kpis/library')}
            className="text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)] font-medium"
          >
            Browse the KPI Library to add some
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-[var(--border-subtle)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">KPI</th>
                  <th className="py-2.5 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Current</th>
                  <th className="py-2.5 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</th>
                  <th className="py-2.5 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Variance</th>
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="py-2.5 px-4 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Trend</th>
                  <th className="py-2.5 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((kpi) => (
                  <KPIRow
                    key={kpi.id}
                    kpi={kpi}
                    onSetTarget={(k) => setTargetDialogKPI(k)}
                    onPause={(id) => pauseKPI(id)}
                    onArchive={(id) => archiveKPI(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Set / Edit Target Dialog */}
      {targetDialogKPI && (
        <SetTargetDialog
          kpi={targetDialogKPI}
          isOpen={!!targetDialogKPI}
          onClose={() => setTargetDialogKPI(null)}
          onSave={handleSaveTarget}
        />
      )}
    </div>
  );
}

export default KPIActivePage;
