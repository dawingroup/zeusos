/**
 * KPI Scorecards Page
 * Lists all scorecards with ability to create new ones.
 */

import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ClipboardCheck,
  BarChart3,
  Calendar,
  Layers,
} from 'lucide-react';
import { useKPIScorecards } from '../hooks/useKPIScorecard';
import {
  KPI_SCORECARD_TYPE_LABELS,
  type KPIScorecardType,
} from '../constants/kpi.constants';

const COMPANY_ID = 'dawinos';

export function KPIScorecardsPage() {
  const navigate = useNavigate();

  const { scorecards, loading } = useKPIScorecards({
    companyId: COMPANY_ID,
    autoFetch: true,
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">KPI Scorecards</h1>
          <p className="text-muted-foreground text-sm">
            Organize KPIs into balanced scorecards for strategic performance tracking.
          </p>
        </div>
        <button
          onClick={() => navigate('/strategy/kpis/scorecards/new')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue)]"
        >
          <Plus className="w-4 h-4" />
          New Scorecard
        </button>
      </div>

      {/* Scorecards Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading scorecards...</div>
      ) : scorecards.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-[var(--bg-sunken)] rounded-full p-6 inline-block mb-4">
            <ClipboardCheck className="w-12 h-12 text-[var(--fg-tertiary)]" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No Scorecards Yet</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Create a scorecard to group related KPIs and track performance across strategic perspectives.
          </p>
          <button
            onClick={() => navigate('/strategy/kpis/scorecards/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue)]"
          >
            <Plus className="w-4 h-4" />
            Create First Scorecard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scorecards.map((sc) => (
            <div
              key={sc.id}
              className="bg-card rounded-lg border border-[var(--border-subtle)] p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/strategy/kpis/scorecards/${sc.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="bg-[var(--rag-blue-soft)] rounded-lg p-2">
                  <BarChart3 className="w-5 h-5 text-[var(--rag-blue)]" />
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-[var(--bg-sunken)] rounded-full px-2 py-0.5">
                  {KPI_SCORECARD_TYPE_LABELS[sc.type as KPIScorecardType] || sc.type}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-1">{sc.name}</h3>
              {sc.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{sc.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {sc.sections?.length || 0} sections
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  FY {sc.fiscalYear}
                </span>
              </div>

              {sc.overallScore != null && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Overall Score</span>
                    <span className="text-sm font-semibold text-foreground">
                      {sc.overallScore.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(sc.overallScore, 100)}%`,
                        backgroundColor: sc.overallScore >= 80 ? '#22C55E' : sc.overallScore >= 60 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KPIScorecardsPage;
