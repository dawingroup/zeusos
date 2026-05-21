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
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
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
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-orange-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Operational Gap Analysis</h3>
            <p className="text-xs text-gray-500">
              {gaps.length > 0
                ? `${gaps.length} gaps identified across ${Object.keys(gapsByArea).length} areas`
                : 'AI-powered analysis of organizational, process, and technology gaps'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hrData && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              HR Data Loaded
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isAnalyzing ? 'Analyzing...' : gaps.length > 0 ? 'Re-analyze' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* HR Data Preview */}
      {hrData?.stats && (
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span><strong>{hrData.stats.totalEmployees}</strong> employees</span>
            <span><strong>{Object.keys(hrData.stats.byDepartment).length}</strong> departments</span>
            <span>Turnover: <strong>{(hrData.stats.turnoverRate * 100).toFixed(1)}%</strong></span>
            <span>Avg tenure: <strong>{hrData.stats.avgTenureYears.toFixed(1)}yr</strong></span>
            <button onClick={loadHRData} disabled={isLoadingData} className="text-blue-600 hover:text-blue-700 ml-auto">
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
        <div className="px-5 py-4 bg-orange-50 border-b border-orange-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
          <div>
            <p className="text-sm font-medium text-orange-900">Analyzing operational structure...</p>
            <p className="text-xs text-orange-700">AI is reviewing HR data, org structure, and processes to identify gaps.</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {gaps.length > 0 && (
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              activeFilter === 'all' ? 'bg-gray-200 text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'
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
                  activeFilter === area ? 'bg-gray-200 text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'
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
      <div className="divide-y divide-gray-100">
        {gaps.length === 0 && !isAnalyzing ? (
          <div className="px-5 py-8 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-1">No gaps analyzed yet</p>
            <p className="text-xs text-gray-400 mb-3">Click "Run Analysis" to identify operational gaps using your HR and organizational data.</p>
          </div>
        ) : (
          filteredGaps.map(gap => {
            const isExpanded = expandedGaps.has(gap.id);
            const Icon = AREA_ICONS[gap.area] || Users;
            return (
              <div key={gap.id}>
                <div
                  onClick={() => toggleGap(gap.id)}
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{gap.title}</h4>
                      <span className="text-[10px] text-gray-400">{AREA_LABELS[gap.area] || gap.area}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${SEVERITY_COLORS[gap.severity]}`}>
                      {gap.severity}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-2">
                    <p className="text-sm text-gray-700">{gap.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-2.5 bg-red-50 rounded-lg">
                        <p className="text-[10px] font-medium text-red-600 uppercase tracking-wider mb-1">Current State</p>
                        <p className="text-xs text-red-800">{gap.currentState}</p>
                      </div>
                      <div className="p-2.5 bg-green-50 rounded-lg">
                        <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider mb-1">Desired State</p>
                        <p className="text-xs text-green-800">{gap.desiredState}</p>
                      </div>
                    </div>
                    <div className="p-2.5 bg-blue-50 rounded-lg">
                      <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider mb-1">Recommendation</p>
                      <p className="text-xs text-blue-800">{gap.recommendation}</p>
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
