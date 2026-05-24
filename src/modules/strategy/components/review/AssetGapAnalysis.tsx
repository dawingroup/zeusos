// ============================================================================
// ASSET GAP ANALYSIS
// ZeusOS v2.0 - CEO Strategy Command
// AI-powered asset inventory analysis and gap identification for growth
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Package,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Wrench,
  ShoppingCart,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import type { AssetSummaryData } from '../../services/strategyDataAggregator';
import { aggregateStrategyContext, contextToPromptText } from '../../services/strategyDataAggregator';
import { analyzeStrategySection, createUserMessage } from '../../services/strategyAI.service';
import type { AIMessage } from '../../types/strategy.types';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AssetGapItem {
  id: string;
  category: 'missing_asset' | 'underutilized' | 'maintenance_risk' | 'capacity_gap' | 'technology_upgrade';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedCost?: string;
  recommendation: string;
  businessImpact: string;
  timeframe: string;
}

interface AssetGapAnalysisProps {
  companyId: string;
  reviewId: string;
  conversationHistory: AIMessage[];
  onConversationUpdate: (messages: AIMessage[]) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  missing_asset: { label: 'Missing Asset', icon: ShoppingCart, color: 'text-red-600' },
  underutilized: { label: 'Underutilized', icon: TrendingUp, color: 'text-amber-600' },
  maintenance_risk: { label: 'Maintenance Risk', icon: Wrench, color: 'text-orange-600' },
  capacity_gap: { label: 'Capacity Gap', icon: Package, color: 'text-purple-600' },
  technology_upgrade: { label: 'Tech Upgrade', icon: TrendingUp, color: 'text-blue-600' },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export const AssetGapAnalysis: React.FC<AssetGapAnalysisProps> = ({
  companyId,
  reviewId,
  conversationHistory,
  onConversationUpdate,
}) => {
  const [gaps, setGaps] = useState<AssetGapItem[]>([]);
  const [assetData, setAssetData] = useState<AssetSummaryData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());

  const toggleGap = (id: string) => {
    setExpandedGaps(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  useEffect(() => {
    loadAssetData();
  }, [companyId]);

  const loadAssetData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const ctx = await aggregateStrategyContext(companyId);
      setAssetData(ctx.assets);
    } catch (err) {
      console.warn('[AssetGap] Failed to load asset data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [companyId]);

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const ctx = await aggregateStrategyContext(companyId);
      const contextText = contextToPromptText(ctx);

      const response = await analyzeStrategySection({
        companyId,
        reviewId,
        section: 'assetGapAnalysis',
        currentData: {
          assetSummary: ctx.assets,
          hrSummary: ctx.hr,
          contextText,
          customPrompt: `You are analyzing the asset and equipment inventory of a business for strategic growth readiness. Using the data provided, identify:

1. **Missing Assets** - Equipment/tools needed but not yet acquired
2. **Underutilized Assets** - Existing assets not being fully leveraged
3. **Maintenance Risks** - Assets with overdue or upcoming maintenance that pose operational risk
4. **Capacity Gaps** - Areas where current capacity doesn't meet growth targets
5. **Technology Upgrades** - Opportunities to upgrade for efficiency/quality improvements

DATA CONTEXT:
${contextText}

Return your analysis as a JSON array of gap items with this structure:
[{
  "category": "missing_asset|underutilized|maintenance_risk|capacity_gap|technology_upgrade",
  "title": "Brief gap title",
  "description": "Detailed description",
  "priority": "critical|high|medium|low",
  "estimatedCost": "Cost estimate if applicable",
  "recommendation": "What to do",
  "businessImpact": "Impact on business if not addressed",
  "timeframe": "When to address (immediate/short-term/medium-term/long-term)"
}]

Wrap the JSON in \`\`\`json code fences. After the JSON, provide a brief investment summary with total estimated costs and ROI considerations.`,
        },
        conversationHistory,
      });

      if (response.conversationMessage) {
        const newHistory = [
          ...conversationHistory,
          createUserMessage('Run asset gap analysis for business growth readiness.', 'assetGapAnalysis'),
          response.conversationMessage,
        ];
        onConversationUpdate(newHistory);

        const content = response.conversationMessage.content;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed)) {
              setGaps(parsed.map((g: AssetGapItem, i: number) => ({ ...g, id: `agap-${i}` })));
              setExpandedGaps(new Set(parsed.map((_: AssetGapItem, i: number) => `agap-${i}`)));
            }
          } catch { /* JSON parse failed */ }
        }
      }

      if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [companyId, reviewId, conversationHistory, onConversationUpdate]);

  const gapsByCategory = gaps.reduce<Record<string, number>>((acc, g) => {
    acc[g.category] = (acc[g.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-card border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-teal-600" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Asset Gap Analysis</h3>
            <p className="text-xs text-muted-foreground">
              {gaps.length > 0
                ? `${gaps.length} gaps identified • ${gaps.filter(g => g.priority === 'critical' || g.priority === 'high').length} high priority`
                : 'Identify asset requirements for business growth'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {assetData && assetData.totalAssets > 0 && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {assetData.totalAssets} assets loaded
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isAnalyzing ? 'Analyzing...' : gaps.length > 0 ? 'Re-analyze' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Asset Data Summary */}
      {assetData && assetData.totalAssets > 0 && (
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]/50">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span><strong>{assetData.totalAssets}</strong> total assets</span>
            <span>Utilization: <strong>{assetData.utilizationSummary}</strong></span>
            {assetData.maintenanceOverdue > 0 && (
              <span className="text-red-600 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                <strong>{assetData.maintenanceOverdue}</strong> maintenance overdue
              </span>
            )}
            <button onClick={loadAssetData} disabled={isLoadingData} className="text-blue-600 hover:text-blue-700 ml-auto">
              <RefreshCw className={`w-3 h-3 ${isLoadingData ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Analyzing Banner */}
      {isAnalyzing && (
        <div className="px-5 py-4 bg-teal-50 border-b border-teal-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
          <div>
            <p className="text-sm font-medium text-teal-900">Analyzing asset inventory...</p>
            <p className="text-xs text-teal-700">AI is reviewing current assets and identifying gaps for growth.</p>
          </div>
        </div>
      )}

      {/* Category Summary Chips */}
      {gaps.length > 0 && (
        <div className="px-5 py-2 border-b border-[var(--border-subtle)] flex items-center gap-2 flex-wrap">
          {Object.entries(gapsByCategory).map(([cat, count]) => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config?.icon || Package;
            return (
              <span key={cat} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-[var(--bg-sunken)] text-muted-foreground rounded-full">
                <Icon className={`w-3 h-3 ${config?.color || ''}`} />
                {config?.label || cat}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Gap Items */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {gaps.length === 0 && !isAnalyzing ? (
          <div className="px-5 py-8 text-center">
            <Package className="w-8 h-8 text-[var(--fg-tertiary)] mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">No asset gaps analyzed yet</p>
            <p className="text-xs text-[var(--fg-tertiary)]">Click "Run Analysis" to identify asset requirements for growth.</p>
          </div>
        ) : (
          gaps.map(gap => {
            const isExpanded = expandedGaps.has(gap.id);
            const config = CATEGORY_CONFIG[gap.category] || { label: gap.category, icon: Package, color: 'text-muted-foreground' };
            const Icon = config.icon;
            return (
              <div key={gap.id}>
                <div
                  onClick={() => toggleGap(gap.id)}
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[var(--bg-sunken)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 ${config.color} flex-shrink-0`} />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{gap.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--fg-tertiary)]">{config.label}</span>
                        {gap.estimatedCost && <span className="text-[10px] text-[var(--fg-tertiary)]">Est: {gap.estimatedCost}</span>}
                        {gap.timeframe && <span className="text-[10px] text-[var(--fg-tertiary)]">{gap.timeframe}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${PRIORITY_COLORS[gap.priority]}`}>
                      {gap.priority}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--fg-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)]" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-2">
                    <p className="text-sm text-muted-foreground">{gap.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-2.5 bg-red-50 rounded-lg">
                        <p className="text-[10px] font-medium text-red-600 uppercase tracking-wider mb-1">Business Impact</p>
                        <p className="text-xs text-red-800">{gap.businessImpact}</p>
                      </div>
                      <div className="p-2.5 bg-blue-50 rounded-lg">
                        <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider mb-1">Recommendation</p>
                        <p className="text-xs text-blue-800">{gap.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssetGapAnalysis;
