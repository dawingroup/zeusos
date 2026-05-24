// ============================================================================
// CROSS-MODULE CONTEXT PANEL
// ZeusOS v2.0 - CEO Strategy Command
// Unified panel showing aggregated data from HR, Assets, Finance, Market Intel
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Layers, RefreshCw, Loader2, Users, Package, DollarSign,
  Globe, ArrowRightLeft, ChevronDown, ChevronUp, CheckCircle, XCircle,
} from 'lucide-react';
import type { AggregatedStrategyContext } from '../../services/strategyDataAggregator';
import { aggregateStrategyContext } from '../../services/strategyDataAggregator';

interface CrossModuleContextProps {
  companyId: string;
  subsidiaryId?: string;
  onContextLoaded?: (ctx: AggregatedStrategyContext) => void;
  activeSectionType?: string;
}

export const CrossModuleContext: React.FC<CrossModuleContextProps> = ({ companyId, subsidiaryId, onContextLoaded, activeSectionType }) => {
  const [ctx, setCtx] = useState<AggregatedStrategyContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await aggregateStrategyContext(companyId, subsidiaryId);
      setCtx(data);
      setLastFetched(new Date().toLocaleTimeString());
      onContextLoaded?.(data);
    } catch (err) {
      console.warn('[CrossModule] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, subsidiaryId, onContextLoaded]);

  useEffect(() => { loadData(); }, [loadData]);

  // Section type → relevant modules mapping for filtering
  const SECTION_TYPE_MODULES: Record<string, string[]> = {
    financial: ['Finance'],
    market: ['Market Intel'],
    operations: ['Assets'],
    growth: ['Finance', 'Market Intel'],
    risk: ['Finance', 'Market Intel'],
    people: ['HR'],
    governance: ['Pivots'],
    general: ['HR', 'Assets', 'Finance', 'Market Intel', 'Pivots'],
  };

  const allModules = ctx ? [
    { name: 'HR', icon: Users, loaded: !!ctx.hr.stats, count: ctx.hr.stats?.totalEmployees || 0, color: 'blue' },
    { name: 'Assets', icon: Package, loaded: ctx.assets.totalAssets > 0, count: ctx.assets.totalAssets, color: 'teal' },
    { name: 'Finance', icon: DollarSign, loaded: ctx.finance.hasData, count: ctx.finance.hasData ? 1 : 0, color: 'green' },
    { name: 'Market Intel', icon: Globe,
      loaded: (ctx.marketIntel.recentSignals.length + ctx.marketIntel.activeScenarios.length + ctx.marketIntel.reports.length) > 0,
      count: ctx.marketIntel.recentSignals.length + ctx.marketIntel.activeScenarios.length + ctx.marketIntel.regulatoryItems.length + ctx.marketIntel.reports.length, color: 'violet' },
    { name: 'Pivots', icon: ArrowRightLeft, loaded: ctx.pivots.length > 0, count: ctx.pivots.length, color: 'indigo' },
  ] : [];

  // Filter modules by active section type if provided
  const modules = activeSectionType && SECTION_TYPE_MODULES[activeSectionType]
    ? allModules.filter(m => SECTION_TYPE_MODULES[activeSectionType].includes(m.name))
    : allModules;

  const loadedCount = modules.filter(m => m.loaded).length;

  return (
    <div className="bg-card border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[var(--bg-sunken)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cross-Module Data Context</h3>
            <p className="text-xs text-muted-foreground">
              {ctx ? `${loadedCount}/${modules.length} modules loaded` : 'Aggregated data for AI analysis'}
              {lastFetched && <span className="ml-2 text-[var(--fg-tertiary)]">Updated {lastFetched}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); loadData(); }} disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-muted-foreground rounded-md hover:bg-[var(--bg-sunken)]">
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--fg-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)]" />}
        </div>
      </div>

      {/* Module Status Chips */}
      <div className="px-5 pb-3 flex flex-wrap gap-1.5">
        {isLoading && !ctx ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading cross-module data...
          </div>
        ) : modules.map(m => {
          const Icon = m.icon;
          return (
            <span key={m.name} className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border ${
              m.loaded ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)] border-[var(--rag-green)]' : 'bg-[var(--bg-sunken)] text-[var(--fg-tertiary)] border-[var(--border-subtle)]'
            }`}>
              <Icon className="w-3 h-3" /> {m.name}
              {m.loaded ? <><CheckCircle className="w-2.5 h-2.5" /> {m.count}</> : <XCircle className="w-2.5 h-2.5" />}
            </span>
          );
        })}
      </div>

      {/* Expanded Details */}
      {isExpanded && ctx && (
        <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
          {/* HR */}
          {ctx.hr.stats && (
            <div className="px-5 py-3">
              <h4 className="text-xs font-semibold text-[var(--rag-blue)] mb-1.5 flex items-center gap-1"><Users className="w-3 h-3" /> HR Summary</h4>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <Stat label="Employees" value={String(ctx.hr.stats.totalEmployees)} bg="bg-[var(--rag-blue-soft)]" text="text-[var(--rag-blue)]" />
                <Stat label="Departments" value={String(Object.keys(ctx.hr.stats.byDepartment).length)} bg="bg-[var(--rag-blue-soft)]" text="text-[var(--rag-blue)]" />
                <Stat label="Turnover" value={`${(ctx.hr.stats.turnoverRate * 100).toFixed(1)}%`} bg="bg-[var(--rag-blue-soft)]" text="text-[var(--rag-blue)]" />
                <Stat label="Avg Tenure" value={`${ctx.hr.stats.avgTenureYears.toFixed(1)}yr`} bg="bg-[var(--rag-blue-soft)]" text="text-[var(--rag-blue)]" />
              </div>
            </div>
          )}
          {/* Assets */}
          {ctx.assets.totalAssets > 0 && (
            <div className="px-5 py-3">
              <h4 className="text-xs font-semibold text-teal-600 mb-1.5 flex items-center gap-1"><Package className="w-3 h-3" /> Assets Summary</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Total" value={String(ctx.assets.totalAssets)} bg="bg-teal-50" text="text-teal-800" />
                <Stat label="Utilization" value={ctx.assets.utilizationSummary} bg="bg-teal-50" text="text-teal-800" />
                <Stat label="Maint. Overdue" value={String(ctx.assets.maintenanceOverdue)} bg={ctx.assets.maintenanceOverdue > 0 ? 'bg-[var(--rag-red-soft)]' : 'bg-teal-50'} text={ctx.assets.maintenanceOverdue > 0 ? 'text-[var(--rag-red)]' : 'text-teal-800'} />
              </div>
            </div>
          )}
          {/* Finance */}
          {ctx.finance.hasData && (
            <div className="px-5 py-3">
              <h4 className="text-xs font-semibold text-[var(--rag-green)] mb-1.5 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Finance Summary (QuickBooks)</h4>
              <div className="space-y-1 text-xs">
                {ctx.finance.revenueOverview && <p className="text-muted-foreground">{ctx.finance.revenueOverview}</p>}
                {ctx.finance.expenseOverview && <p className="text-muted-foreground">{ctx.finance.expenseOverview}</p>}
                {ctx.finance.keyMetrics && Object.keys(ctx.finance.keyMetrics).length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {Object.entries(ctx.finance.keyMetrics).map(([k, v]) => (
                      <Stat key={k} label={k} value={v} bg="bg-[var(--rag-green-soft)]" text="text-[var(--rag-green)]" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Market Intel */}
          {(ctx.marketIntel.recentSignals.length > 0 || ctx.marketIntel.activeScenarios.length > 0 || ctx.marketIntel.reports.length > 0) && (
            <div className="px-5 py-3">
              <h4 className="text-xs font-semibold text-violet-600 mb-1.5 flex items-center gap-1"><Globe className="w-3 h-3" /> Market Intelligence</h4>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <Stat label="Signals" value={String(ctx.marketIntel.recentSignals.length)} bg="bg-violet-50" text="text-violet-800" />
                <Stat label="Scenarios" value={String(ctx.marketIntel.activeScenarios.length)} bg="bg-violet-50" text="text-violet-800" />
                <Stat label="Regulatory" value={String(ctx.marketIntel.regulatoryItems.length)} bg="bg-violet-50" text="text-violet-800" />
                <Stat label="Indicators" value={String(ctx.marketIntel.trackedIndicators.length)} bg="bg-violet-50" text="text-violet-800" />
                <Stat label="Reports" value={String(ctx.marketIntel.reports.length)} bg="bg-violet-50" text="text-violet-800" />
              </div>
              {ctx.marketIntel.reports.length > 0 && (
                <div className="mt-2 space-y-1">
                  {ctx.marketIntel.reports.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-violet-50 rounded text-xs">
                      <span className="font-medium text-violet-800 truncate">{r.title}</span>
                      <span className="text-[10px] text-violet-600 flex-shrink-0">{r.status} • {r.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Pivots */}
          {ctx.pivots.length > 0 && (
            <div className="px-5 py-3">
              <h4 className="text-xs font-semibold text-indigo-600 mb-1.5 flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Business Pivots</h4>
              <div className="space-y-1">
                {ctx.pivots.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-1.5 bg-indigo-50 rounded text-xs">
                    <span className="font-medium text-indigo-800 truncate">{p.title}</span>
                    <span className="text-[10px] text-indigo-600 flex-shrink-0">{p.status} • {new Date(p.pivotDate).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; bg: string; text: string }> = ({ label, value, bg, text }) => (
  <div className={`p-1.5 ${bg} rounded text-center`}>
    <p className={`font-bold ${text}`}>{value}</p>
    <p className={`text-[10px] ${text} opacity-70`}>{label}</p>
  </div>
);

export default CrossModuleContext;
