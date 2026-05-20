// ============================================================================
// OKR & KPI OUTPUT SECTION COMPONENT
// DawinOS v2.0 - CEO Strategy Command
// Generate and manage OKRs and KPIs from strategy review with AI
// ============================================================================

import React, { useState } from 'react';
import {
  Target,
  BarChart3,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  GeneratedOKR,
  GeneratedKPI,
  StrategyReviewData,
} from '../../types/strategy.types';
import {
  generateOKRsFromStrategy,
  generateKPIsFromStrategy,
} from '../../services/strategyAI.service';

export interface OKRKPIOutputSectionProps {
  okrs: GeneratedOKR[];
  kpis: GeneratedKPI[];
  reviewData: Partial<StrategyReviewData>;
  companyId: string;
  onOKRsChange: (okrs: GeneratedOKR[]) => void;
  onKPIsChange: (kpis: GeneratedKPI[]) => void;
  readOnly?: boolean;
}

const generateId = () => crypto.randomUUID().slice(0, 8);

export const OKRKPIOutputSection: React.FC<OKRKPIOutputSectionProps> = ({
  okrs,
  kpis,
  reviewData,
  companyId,
  onOKRsChange,
  onKPIsChange,
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<'okrs' | 'kpis'>('okrs');
  const [isGeneratingOKRs, setIsGeneratingOKRs] = useState(false);
  const [isGeneratingKPIs, setIsGeneratingKPIs] = useState(false);
  const [expandedOKR, setExpandedOKR] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateOKRs = async () => {
    setIsGeneratingOKRs(true);
    setError(null);
    try {
      const response = await generateOKRsFromStrategy(reviewData, companyId);
      if (response.success && response.suggestions.length > 0) {
        const newOKRs: GeneratedOKR[] = response.suggestions
          .filter(s => s.type === 'okr')
          .map(s => {
            let parsed: Partial<GeneratedOKR> = {};
            try { parsed = JSON.parse(s.content); } catch { /* use defaults */ }
            return {
              id: generateId(),
              objective: parsed.objective || s.title,
              description: parsed.description || s.content,
              keyResults: (parsed.keyResults || []).map(kr => ({
                id: generateId(),
                title: kr.title || '',
                targetValue: kr.targetValue || 0,
                currentValue: kr.currentValue || 0,
                unit: kr.unit || '%',
                weight: kr.weight || 1,
              })),
              timeframe: parsed.timeframe || 'Q1-Q4 FY2026',
              owner: parsed.owner || 'TBD',
              priority: parsed.priority || 'high',
              aiGenerated: true,
              accepted: false,
            };
          });

        if (newOKRs.length === 0) {
          // Fallback: create OKRs from all suggestions
          response.suggestions.forEach(s => {
            newOKRs.push({
              id: generateId(),
              objective: s.title,
              description: s.content,
              keyResults: [],
              timeframe: 'Q1-Q4 FY2026',
              owner: 'TBD',
              priority: 'high',
              aiGenerated: true,
              accepted: false,
            });
          });
        }

        onOKRsChange([...okrs, ...newOKRs]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate OKRs');
    } finally {
      setIsGeneratingOKRs(false);
    }
  };

  const handleGenerateKPIs = async () => {
    setIsGeneratingKPIs(true);
    setError(null);
    try {
      const response = await generateKPIsFromStrategy(reviewData, companyId);
      if (response.success && response.suggestions.length > 0) {
        const newKPIs: GeneratedKPI[] = response.suggestions
          .filter(s => s.type === 'kpi')
          .map(s => {
            let parsed: Partial<GeneratedKPI> = {};
            try { parsed = JSON.parse(s.content); } catch { /* use defaults */ }
            return {
              id: generateId(),
              name: parsed.name || s.title,
              description: parsed.description || s.content,
              category: parsed.category || 'operational',
              targetValue: parsed.targetValue || 0,
              currentValue: parsed.currentValue || 0,
              unit: parsed.unit || '%',
              frequency: parsed.frequency || 'monthly',
              owner: parsed.owner || 'TBD',
              aiGenerated: true,
              accepted: false,
            };
          });

        if (newKPIs.length === 0) {
          response.suggestions.forEach(s => {
            newKPIs.push({
              id: generateId(),
              name: s.title,
              description: s.content,
              category: 'operational',
              targetValue: 0,
              currentValue: 0,
              unit: '%',
              frequency: 'monthly',
              owner: 'TBD',
              aiGenerated: true,
              accepted: false,
            });
          });
        }

        onKPIsChange([...kpis, ...newKPIs]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate KPIs');
    } finally {
      setIsGeneratingKPIs(false);
    }
  };

  const handleAcceptOKR = (okrId: string) => {
    onOKRsChange(okrs.map(o => o.id === okrId ? { ...o, accepted: true } : o));
  };

  const handleRemoveOKR = (okrId: string) => {
    onOKRsChange(okrs.filter(o => o.id !== okrId));
  };

  const handleAcceptKPI = (kpiId: string) => {
    onKPIsChange(kpis.map(k => k.id === kpiId ? { ...k, accepted: true } : k));
  };

  const handleRemoveKPI = (kpiId: string) => {
    onKPIsChange(kpis.filter(k => k.id !== kpiId));
  };

  const PRIORITY_COLORS = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-700',
  };

  const CATEGORY_COLORS = {
    financial: 'bg-emerald-100 text-emerald-700',
    operational: 'bg-blue-100 text-blue-700',
    customer: 'bg-pink-100 text-pink-700',
    employee: 'bg-amber-100 text-amber-700',
    growth: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('okrs')}
          className={`flex items-center gap-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'okrs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target className="w-4 h-4" />
          OKRs ({okrs.length})
        </button>
        <button
          onClick={() => setActiveTab('kpis')}
          className={`flex items-center gap-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'kpis'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          KPIs ({kpis.length})
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* OKRs Tab */}
      {activeTab === 'okrs' && (
        <div className="space-y-3">
          {!readOnly && (
            <button
              onClick={handleGenerateOKRs}
              disabled={isGeneratingOKRs}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isGeneratingOKRs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGeneratingOKRs ? 'Generating OKRs...' : 'Generate OKRs with AI'}
            </button>
          )}

          {okrs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No OKRs generated yet. Use AI to generate strategic OKRs.</p>
            </div>
          ) : (
            okrs.map((okr) => (
              <div key={okr.id} className={`border rounded-lg overflow-hidden ${okr.accepted ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedOKR(expandedOKR === okr.id ? null : okr.id)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {okr.accepted ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Target className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900">{okr.objective}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_COLORS[okr.priority]}`}>
                      {okr.priority}
                    </span>
                    {okr.aiGenerated && <Sparkles className="w-3 h-3 text-purple-500" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{okr.keyResults.length} KRs</span>
                    {expandedOKR === okr.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {expandedOKR === okr.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    <p className="text-sm text-gray-600">{okr.description}</p>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>Timeframe: {okr.timeframe}</span>
                      <span>Owner: {okr.owner}</span>
                    </div>

                    {okr.keyResults.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold text-gray-700 uppercase">Key Results</h5>
                        {okr.keyResults.map((kr, i) => (
                          <div key={kr.id} className="flex items-center gap-3 p-2 bg-white rounded border border-gray-100">
                            <span className="text-xs font-medium text-blue-600 w-6">KR{i + 1}</span>
                            <span className="flex-1 text-sm text-gray-700">{kr.title}</span>
                            <span className="text-xs text-gray-500">
                              {kr.currentValue}/{kr.targetValue} {kr.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!readOnly && (
                      <div className="flex items-center gap-2 pt-2">
                        {!okr.accepted && (
                          <button
                            onClick={() => handleAcceptOKR(okr.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Accept OKR
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveOKR(okr.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* KPIs Tab */}
      {activeTab === 'kpis' && (
        <div className="space-y-3">
          {!readOnly && (
            <button
              onClick={handleGenerateKPIs}
              disabled={isGeneratingKPIs}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isGeneratingKPIs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGeneratingKPIs ? 'Generating KPIs...' : 'Generate KPIs with AI'}
            </button>
          )}

          {kpis.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No KPIs generated yet. Use AI to generate strategic KPIs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kpis.map((kpi) => (
                <div key={kpi.id} className={`border rounded-lg p-4 ${kpi.accepted ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <h5 className="text-sm font-medium text-gray-900">{kpi.name}</h5>
                    </div>
                    {kpi.aiGenerated && <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{kpi.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${CATEGORY_COLORS[kpi.category]}`}>
                      {kpi.category}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      {kpi.frequency}
                    </span>
                    <span className="text-xs text-gray-500">
                      Target: {kpi.targetValue} {kpi.unit}
                    </span>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      {!kpi.accepted ? (
                        <button
                          onClick={() => handleAcceptKPI(kpi.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Accept
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Accepted
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveKPI(kpi.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OKRKPIOutputSection;
