// ============================================================================
// PESTEL DASHBOARD COMPONENT
// ZeusOS v2.0 - Market Intelligence Module
// Overview of all PESTEL analyses with key metrics
// ============================================================================

import React, { useMemo } from 'react';
import {
  Plus,
  Filter,
  TrendingUp,
  AlertTriangle,
  Target,
  Clock,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { PESTELAnalysis, PESTELFactor } from '../../types/scanning.types';
import { PESTEL_DIMENSION_CONFIG } from '../../constants/scanning.constants';
import { FactorCard } from './FactorCard';
import { ImpactMatrix } from './ImpactMatrix';

interface PESTELDashboardProps {
  analyses: PESTELAnalysis[];
  selectedAnalysis: PESTELAnalysis | null;
  isLoading: boolean;
  onSelectAnalysis: (analysis: PESTELAnalysis) => void;
  onCreateAnalysis: () => void;
  onSelectFactor: (factor: PESTELFactor) => void;
}

export const PESTELDashboard: React.FC<PESTELDashboardProps> = ({
  analyses,
  selectedAnalysis,
  isLoading,
  onSelectAnalysis,
  onCreateAnalysis,
  onSelectFactor,
}) => {
  const allFactors = useMemo(() => {
    return analyses.flatMap(a => a.factors);
  }, [analyses]);

  const stats = useMemo(() => {
    const opportunities = allFactors.filter(f => f.type === 'opportunity');
    const threats = allFactors.filter(f => f.type === 'threat');
    const highRisk = allFactors.filter(f => f.impact.riskScore >= 15);
    
    const dimensionCounts: Record<string, number> = {};
    allFactors.forEach(f => {
      dimensionCounts[f.dimension] = (dimensionCounts[f.dimension] || 0) + 1;
    });

    return {
      totalAnalyses: analyses.length,
      totalFactors: allFactors.length,
      opportunities: opportunities.length,
      threats: threats.length,
      highRiskCount: highRisk.length,
      avgRiskScore: allFactors.length > 0
        ? allFactors.reduce((sum, f) => sum + f.impact.riskScore, 0) / allFactors.length
        : 0,
      dimensionCounts,
    };
  }, [analyses, allFactors]);

  const topThreats = useMemo(() => {
    return allFactors
      .filter(f => f.type === 'threat')
      .sort((a, b) => b.impact.riskScore - a.impact.riskScore)
      .slice(0, 5);
  }, [allFactors]);

  const topOpportunities = useMemo(() => {
    return allFactors
      .filter(f => f.type === 'opportunity')
      .sort((a, b) => b.impact.riskScore - a.impact.riskScore)
      .slice(0, 5);
  }, [allFactors]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">PESTEL Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Macro-environment analysis across Political, Economic, Social, Technological, Environmental, and Legal dimensions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-sunken)] flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={onCreateAnalysis}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Analysis
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Analyses</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalAnalyses}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium">Total Factors</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalFactors}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Opportunities</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.opportunities}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">Threats</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.threats}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">High Risk</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{stats.highRiskCount}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Risk Score</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.avgRiskScore.toFixed(1)}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Analyses List */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)]">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-semibold text-foreground">Recent Analyses</h3>
            </div>
            <div className="divide-y divide-[var(--border-subtle)] max-h-96 overflow-y-auto">
              {analyses.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto text-[var(--fg-tertiary)] mb-3" />
                  <p>No analyses yet</p>
                  <button
                    onClick={onCreateAnalysis}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                  >
                    Create your first analysis
                  </button>
                </div>
              ) : (
                analyses.slice(0, 10).map(analysis => (
                  <div
                    key={analysis.id}
                    className={`p-4 cursor-pointer hover:bg-[var(--bg-sunken)] transition-colors ${
                      selectedAnalysis?.id === analysis.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => onSelectAnalysis(analysis)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{analysis.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{analysis.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            analysis.status === 'completed' ? 'bg-green-100 text-green-700' :
                            analysis.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-[var(--bg-sunken)] text-muted-foreground'
                          }`}>
                            {analysis.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {analysis.factors.length} factors
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[var(--fg-tertiary)]" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dimension Distribution */}
          <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] mt-4">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-semibold text-foreground">Dimension Distribution</h3>
            </div>
            <div className="p-4 space-y-3">
              {Object.entries(PESTEL_DIMENSION_CONFIG).map(([key, config]) => {
                const count = stats.dimensionCounts[key] || 0;
                const percentage = stats.totalFactors > 0
                  ? (count / stats.totalFactors) * 100
                  : 0;
                
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">{config.label}</span>
                      <span className="text-sm font-medium text-foreground">{count}</span>
                    </div>
                    <div className="h-2 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: config.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Matrix & Top Factors */}
        <div className="lg:col-span-2 space-y-6">
          {/* Impact Matrix */}
          {allFactors.length > 0 && (
            <ImpactMatrix
              factors={allFactors}
              onFactorClick={onSelectFactor}
            />
          )}

          {/* Top Threats & Opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Threats */}
            <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)]">
              <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="font-semibold text-foreground">Top Threats</h3>
              </div>
              <div className="p-4 space-y-3">
                {topThreats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No threats identified</p>
                ) : (
                  topThreats.map(factor => (
                    <FactorCard
                      key={factor.id}
                      factor={factor}
                      onSelect={onSelectFactor}
                      compact
                    />
                  ))
                )}
              </div>
            </div>

            {/* Top Opportunities */}
            <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)]">
              <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-foreground">Top Opportunities</h3>
              </div>
              <div className="p-4 space-y-3">
                {topOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No opportunities identified</p>
                ) : (
                  topOpportunities.map(factor => (
                    <FactorCard
                      key={factor.id}
                      factor={factor}
                      onSelect={onSelectFactor}
                      compact
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PESTELDashboard;
