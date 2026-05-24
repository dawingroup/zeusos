// ============================================================================
// OPERATIONAL GAP ANALYSIS
// ZeusOS v2.0 - CEO Strategy Command
// AI-powered organizational/process/technology gap detection using HR data
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Users,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Building2,
  Cpu,
  GitBranch,
} from 'lucide-react';
import type { HRSummaryData } from '../../services/strategyDataAggregator';
import { aggregateStrategyContext, contextToPromptText } from '../../services/strategyDataAggregator';
import { analyzeStrategySection, createUserMessage } from '../../services/strategyAI.service';
import type { AIMessage } from '../../types/strategy.types';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface GapItem {
  id: string;
  area: 'organizational' | 'process' | 'technology' | 'skills';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  currentState: string;
  desiredState: string;
}

interface OperationalGapAnalysisProps {
  companyId: string;
  reviewId: string;
  conversationHistory: AIMessage[];
  onConversationUpdate: (messages: AIMessage[]) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)] border-[var(--rag-red)]',
  high: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] border-[var(--rag-amber)]',
  medium: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] border-[var(--rag-amber)]',
  low: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] border-[var(--rag-blue)]',
};

const AREA_ICONS: Record<string, React.FC<{ className?: string }>> = {
  organizational: Building2,
  process: GitBranch,
  technology: Cpu,
  skills: Users,
};

const AREA_LABELS: Record<string, string> = {
  organizational: 'Organizational Structure',
  process: 'Business Processes',
  technology: 'Technology & Systems',
  skills: 'Skills & Capabilities',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export const OperationalGapAnalysis: React.FC<OperationalGapAnalysisProps> = ({
  companyId,
  reviewId,
  conversationHistory,
  onConversationUpdate,
}) => {
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [hrData, setHrData] = useState<HRSummaryData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const toggleGap = (id: string) => {
    setExpandedGaps(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Load HR data on mount
  useEffect(() => {
    loadHRData();
  }, [companyId]);

  const loadHRData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const ctx = await aggregateStrategyContext(companyId);
      setHrData(ctx.hr);
    } catch (err) {
      console.warn('[OpGap] Failed to load HR data:', err);
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
        section: 'operationalGapAnalysis',
        currentData: {
          hrSummary: ctx.hr,
          assetSummary: ctx.assets,
          contextText,
          customPrompt: `You are analyzing the operational structure of a business. Using the HR, asset, and organizational data provided below, identify gaps in:

1. **Organizational Structure** - Missing roles, reporting gaps, span of control issues, department imbalances
2. **Business Processes** - Inefficiencies, bottlenecks, missing processes, automation opportunities
3. **Technology & Systems** - Missing tools, outdated systems, integration gaps
4. **Skills & Capabilities** - Skill gaps, training needs, succession risks

DATA CONTEXT:
${contextText}

Return your analysis as a JSON array of gap items with this structure:
[{
  "area": "organizational|process|technology|skills",
  "title": "Brief gap title",
  "description": "Detailed description of the gap",
  "severity": "critical|high|medium|low",
  "recommendation": "What to do about it",
  "currentState": "What exists now",
  "desiredState": "What should be in place"
}]

Wrap the JSON in \`\`\`json code fences. After the JSON, provide a brief executive summary of the key operational gaps.`,
        },
        conversationHistory,
      });

      if (response.conversationMessage) {
        const newHistory = [
          ...conversationHistory,
          createUserMessage('Run operational gap analysis using HR and organizational data.', 'operationalGapAnalysis'),
          response.conversationMessage,
        ];
        onConversationUpdate(newHistory);

        // Parse gaps from AI response
        const content = response.conversationMessage.content;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed)) {
              setGaps(parsed.map((g: GapItem, i: number) => ({ ...g, id: `gap-${i}` })));
              // Expand all by default
              setExpandedGaps(new Set(parsed.map((_: GapItem, i: number) => `gap-${i}`)));
            }
          } catch { /* JSON parse failed, show raw */ }
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

  const filteredGaps = activeFilter === 'all'
    ? gaps
    : gaps.filter(g => g.area === activeFilter);

  const gapsByArea = gaps.reduce<Record<string, number>>((acc, g) => {
    acc[g.area] = (acc[g.area] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-card border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[var(--rag-amber)]" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Operational Gap Analysis</h3>
            <p className="text-xs text-muted-foreground">
              {gaps.length > 0
                ? `${gaps.length} gaps identified across ${Object.keys(gapsByArea).length} areas`
                : 'AI-powered analysis of organizational, process, and technology gaps'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hrData && (
            <span className="text-xs text-[var(--rag-green)] bg-[var(--rag-green-soft)] px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              HR Data Loaded
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--rag-amber)] rounded-lg hover:bg-[var(--rag-amber)] disabled:opacity-50 transition-colors"
          >
            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isAnalyzing ? 'Analyzing...' : gaps.length > 0 ? 'Re-analyze' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* HR Data Preview */}
      {hrData?.stats && (
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]/50">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span><strong>{hrData.stats.totalEmployees}</strong> employees</span>
            <span><strong>{Object.keys(hrData.stats.byDepartment).length}</strong> departments</span>
            <span>Turnover: <strong>{(hrData.stats.turnoverRate * 100).toFixed(1)}%</strong></span>
            <span>Avg tenure: <strong>{hrData.stats.avgTenureYears.toFixed(1)}yr</strong></span>
            <button onClick={loadHRData} disabled={isLoadingData} className="text-[var(--rag-blue)] hover:text-[var(--rag-blue)] ml-auto">
              <RefreshCw className={`w-3 h-3 ${isLoadingData ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-[var(--rag-red-soft)] border-b border-[var(--rag-red)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--rag-red)]" />
          <p className="text-xs text-[var(--rag-red)]">{error}</p>
        </div>
      )}

      {/* Analyzing Banner */}
      {isAnalyzing && (
        <div className="px-5 py-4 bg-[var(--rag-amber-soft)] border-b border-[var(--rag-amber)] flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[var(--rag-amber)] animate-spin" />
          <div>
            <p className="text-sm font-medium text-[var(--rag-amber)]">Analyzing operational structure...</p>
            <p className="text-xs text-[var(--rag-amber)]">AI is reviewing HR data, org structure, and processes to identify gaps.</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {gaps.length > 0 && (
        <div className="px-5 py-2 border-b border-[var(--border-subtle)] flex items-center gap-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              activeFilter === 'all' ? 'bg-[var(--bg-sunken)] text-foreground font-medium' : 'text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            All ({gaps.length})
          </button>
          {Object.entries(gapsByArea).map(([area, count]) => {
            const Icon = AREA_ICONS[area] || Users;
            return (
              <button
                key={area}
                onClick={() => setActiveFilter(area)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                  activeFilter === area ? 'bg-[var(--bg-sunken)] text-foreground font-medium' : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                <Icon className="w-3 h-3" />
                {AREA_LABELS[area] || area} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Gap Items */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {gaps.length === 0 && !isAnalyzing ? (
          <div className="px-5 py-8 text-center">
            <Users className="w-8 h-8 text-[var(--fg-tertiary)] mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">No gaps analyzed yet</p>
            <p className="text-xs text-[var(--fg-tertiary)] mb-3">Click "Run Analysis" to identify operational gaps using your HR and organizational data.</p>
          </div>
        ) : (
          filteredGaps.map(gap => {
            const isExpanded = expandedGaps.has(gap.id);
            const Icon = AREA_ICONS[gap.area] || Users;
            return (
              <div key={gap.id}>
                <div
                  onClick={() => toggleGap(gap.id)}
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[var(--bg-sunken)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{gap.title}</h4>
                      <span className="text-[10px] text-[var(--fg-tertiary)]">{AREA_LABELS[gap.area] || gap.area}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${SEVERITY_COLORS[gap.severity]}`}>
                      {gap.severity}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--fg-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)]" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-2">
                    <p className="text-sm text-muted-foreground">{gap.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-2.5 bg-[var(--rag-red-soft)] rounded-lg">
                        <p className="text-[10px] font-medium text-[var(--rag-red)] uppercase tracking-wider mb-1">Current State</p>
                        <p className="text-xs text-[var(--rag-red)]">{gap.currentState}</p>
                      </div>
                      <div className="p-2.5 bg-[var(--rag-green-soft)] rounded-lg">
                        <p className="text-[10px] font-medium text-[var(--rag-green)] uppercase tracking-wider mb-1">Desired State</p>
                        <p className="text-xs text-[var(--rag-green)]">{gap.desiredState}</p>
                      </div>
                    </div>
                    <div className="p-2.5 bg-[var(--rag-blue-soft)] rounded-lg">
                      <p className="text-[10px] font-medium text-[var(--rag-blue)] uppercase tracking-wider mb-1">Recommendation</p>
                      <p className="text-xs text-[var(--rag-blue)]">{gap.recommendation}</p>
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

export default OperationalGapAnalysis;
