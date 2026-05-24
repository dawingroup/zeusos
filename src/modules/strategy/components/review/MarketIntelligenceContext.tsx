// ============================================================================
// MARKET INTELLIGENCE CONTEXT
// ZeusOS v2.0 - CEO Strategy Command
// Displays market intelligence data relevant to strategy review
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Globe,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Compass,
  Radio,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { MarketIntelSummaryData } from '../../services/strategyDataAggregator';
import { aggregateStrategyContext } from '../../services/strategyDataAggregator';

interface MarketIntelligenceContextProps {
  companyId: string;
}

const TREND_ICONS: Record<string, React.FC<{ className?: string }>> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

export const MarketIntelligenceContext: React.FC<MarketIntelligenceContextProps> = ({ companyId }) => {
  const [data, setData] = useState<MarketIntelSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ctx = await aggregateStrategyContext(companyId);
      setData(ctx.marketIntel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market intelligence');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const hasData = data && (
    data.recentSignals.length > 0 ||
    data.activeScenarios.length > 0 ||
    data.regulatoryItems.length > 0 ||
    data.trackedIndicators.length > 0 ||
    data.pestelSummary.length > 0
  );

  return (
    <div className="bg-card border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-[var(--rag-blue)]" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Market Intelligence Context</h3>
            <p className="text-xs text-muted-foreground">
              {hasData
                ? `${data!.recentSignals.length} signals • ${data!.activeScenarios.length} scenarios • ${data!.regulatoryItems.length} regulatory items`
                : 'Environment signals, scenarios, and indicators'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); loadData(); }}
            disabled={isLoading}
            className="p-1 text-[var(--fg-tertiary)] hover:text-muted-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--fg-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)]" />}
        </div>
      </div>

      {isExpanded && (
        <div className="divide-y divide-[var(--border-subtle)]">
          {isLoading && !data && (
            <div className="px-5 py-6 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--rag-blue)] mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading market intelligence...</p>
            </div>
          )}

          {error && (
            <div className="px-5 py-3 bg-[var(--rag-red-soft)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--rag-red)]" />
              <p className="text-xs text-[var(--rag-red)]">{error}</p>
            </div>
          )}

          {data && !hasData && !isLoading && (
            <div className="px-5 py-6 text-center">
              <Globe className="w-8 h-8 text-[var(--fg-tertiary)] mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No market intelligence data available</p>
              <p className="text-xs text-[var(--fg-tertiary)]">Add signals, scenarios, and indicators in the Market Intelligence module.</p>
            </div>
          )}

          {/* Recent Signals */}
          {data && data.recentSignals.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-3.5 h-3.5 text-[var(--rag-blue)]" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Environment Signals</h4>
              </div>
              <div className="space-y-1.5">
                {data.recentSignals.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-[var(--bg-sunken)] rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                      <span className="text-[10px] text-muted-foreground">{s.category}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      s.impact === 'critical' ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]' :
                      s.impact === 'high' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' :
                      'bg-[var(--bg-sunken)] text-muted-foreground'
                    }`}>{s.impact}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Scenarios */}
          {data && data.activeScenarios.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Compass className="w-3.5 h-3.5 text-[var(--rag-blue)]" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scenarios</h4>
              </div>
              <div className="space-y-1.5">
                {data.activeScenarios.slice(0, 3).map((s, i) => (
                  <div key={i} className="p-2 bg-[var(--bg-sunken)] rounded-lg">
                    <p className="text-xs font-medium text-foreground">{s.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">Probability: {s.probability}</span>
                      <span className="text-[10px] text-muted-foreground">Impact: {s.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regulatory Items */}
          {data && data.regulatoryItems.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-[var(--rag-blue)]" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regulatory Tracking</h4>
              </div>
              <div className="space-y-1.5">
                {data.regulatoryItems.slice(0, 3).map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-[var(--bg-sunken)] rounded-lg">
                    <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] rounded">{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracked Indicators */}
          {data && data.trackedIndicators.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-3.5 h-3.5 text-[var(--rag-blue)]" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Economic Indicators</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {data.trackedIndicators.slice(0, 6).map((ind, i) => {
                  const TrendIcon = TREND_ICONS[ind.trend] || Minus;
                  return (
                    <div key={i} className="p-2 bg-[var(--bg-sunken)] rounded-lg flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground truncate">{ind.name}</p>
                        <p className="text-xs font-semibold text-foreground">{ind.value}</p>
                      </div>
                      <TrendIcon className={`w-3.5 h-3.5 flex-shrink-0 ${
                        ind.trend === 'up' ? 'text-[var(--rag-green)]' : ind.trend === 'down' ? 'text-[var(--rag-red)]' : 'text-[var(--fg-tertiary)]'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PESTEL Summary */}
          {data && data.pestelSummary.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-3.5 h-3.5 text-[var(--rag-blue)]" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PESTEL Factors</h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.pestelSummary.map((p, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] rounded-full">
                    {p.category}: {p.factorCount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketIntelligenceContext;
