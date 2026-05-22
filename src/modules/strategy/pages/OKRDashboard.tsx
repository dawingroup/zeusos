// ============================================================================
// OKRDashboard PAGE
// Active-cycle OKR command surface — level breakdown, top-3 by progress,
// stale/at-risk callouts, recent check-ins. Reads through useOKRs().
// ============================================================================

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Building2,
  Users,
  User as UserIcon,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';
import { useOKRs } from '../hooks/useOKRs';
import {
  OKR_LEVEL,
  OKR_LEVEL_LABELS,
  OKR_LEVEL_ORDER,
  OKR_STATUS_LABELS,
  CONFIDENCE_LEVEL,
  CONFIDENCE_LEVEL_LABELS,
  type OKRLevel,
} from '../constants/okr.constants';
import type { OKRObjective } from '../types/okr.types';

const COMPANY_ID = 'dawinos';

const LEVEL_ICONS: Record<OKRLevel, React.ElementType> = {
  [OKR_LEVEL.COMPANY]: Building2,
  [OKR_LEVEL.SUBSIDIARY]: Building2,
  [OKR_LEVEL.DEPARTMENT]: Users,
  [OKR_LEVEL.TEAM]: Users,
  [OKR_LEVEL.INDIVIDUAL]: UserIcon,
};

const CONFIDENCE_COLOR: Record<string, string> = {
  [CONFIDENCE_LEVEL.ON_TRACK]: 'bg-emerald-100 text-emerald-700',
  [CONFIDENCE_LEVEL.AT_RISK]: 'bg-amber-100 text-amber-700',
  [CONFIDENCE_LEVEL.OFF_TRACK]: 'bg-rose-100 text-rose-700',
};

function getOverallConfidence(obj: OKRObjective): string {
  if (obj.keyResults.length === 0) return CONFIDENCE_LEVEL.ON_TRACK;
  const scores = obj.keyResults.map((kr) => {
    if (kr.confidence === CONFIDENCE_LEVEL.ON_TRACK) return 3;
    if (kr.confidence === CONFIDENCE_LEVEL.AT_RISK) return 2;
    return 1;
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg > 2.5) return CONFIDENCE_LEVEL.ON_TRACK;
  if (avg > 1.5) return CONFIDENCE_LEVEL.AT_RISK;
  return CONFIDENCE_LEVEL.OFF_TRACK;
}

function ProgressBar({ value, color = '#2563EB' }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export const OKRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    objectives,
    activeObjectives,
    draftObjectives,
    completedObjectives,
    objectivesByLevel,
    totalProgress,
    averageScore,
    loading,
    error,
    refresh,
  } = useOKRs({ companyId: COMPANY_ID, autoFetch: true });

  const topObjectives = useMemo(
    () =>
      [...activeObjectives]
        .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
        .slice(0, 5),
    [activeObjectives],
  );

  const atRiskObjectives = useMemo(
    () =>
      activeObjectives.filter((o) => {
        const conf = getOverallConfidence(o);
        return conf === CONFIDENCE_LEVEL.AT_RISK || conf === CONFIDENCE_LEVEL.OFF_TRACK;
      }),
    [activeObjectives],
  );

  const staleObjectives = useMemo(() => {
    const threshold = 14 * 24 * 60 * 60 * 1000; // 14 days
    const now = Date.now();
    return activeObjectives.filter((o) => {
      const lastCheck = o.lastCheckInDate?.toDate().getTime();
      return !lastCheck || now - lastCheck > threshold;
    });
  }, [activeObjectives]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-rose-200 bg-rose-50">
        <h2 className="text-sm font-semibold text-rose-800 mb-1">Failed to load OKRs</h2>
        <p className="text-xs text-rose-700 mb-3">{error.message}</p>
        <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">OKRs</h1>
            <p className="text-sm text-gray-500">
              Objectives & Key Results across Zeus Group
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => navigate('/strategy/okrs/new')}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Objective
        </Button>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Active OKRs"
          value={activeObjectives.length}
          accent="#2563EB"
        />
        <MetricCard
          label="Avg Progress"
          value={`${Math.round(totalProgress)}%`}
          accent="#059669"
        />
        <MetricCard
          label="Avg Score"
          value={averageScore.toFixed(2)}
          accent="#7C3AED"
        />
        <MetricCard
          label="At Risk / Stale"
          value={`${atRiskObjectives.length} / ${staleObjectives.length}`}
          accent="#DC2626"
        />
      </div>

      {/* Empty state */}
      {objectives.length === 0 && (
        <Card className="p-10 text-center border-dashed">
          <Target className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No objectives yet</h3>
          <p className="text-xs text-gray-500 mb-4">
            Set your first company-level objective to start tracking progress.
          </p>
          <Button size="sm" onClick={() => navigate('/strategy/okrs/new')}>
            <Plus className="w-4 h-4 mr-1.5" /> Create objective
          </Button>
        </Card>
      )}

      {/* Two-col content */}
      {objectives.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top objectives — wider column */}
          <Card className="lg:col-span-2 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Top objectives</h2>
                <p className="text-xs text-gray-500">Active OKRs ranked by progress</p>
              </div>
              <button
                onClick={() => navigate('/strategy/okrs/all')}
                className="text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <ul className="space-y-3">
              {topObjectives.map((o) => {
                const Icon = LEVEL_ICONS[o.level] || Target;
                const confidence = getOverallConfidence(o);
                return (
                  <li
                    key={o.id}
                    onClick={() => navigate(`/strategy/okrs/${o.id}`)}
                    className="p-3 border border-gray-100 rounded-md hover:border-gray-200 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{o.title}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {OKR_LEVEL_LABELS[o.level]} · {o.ownerName} · {o.keyResults.length} KR{o.keyResults.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] shrink-0 ${CONFIDENCE_COLOR[confidence] ?? ''}`}
                        variant="outline"
                      >
                        {CONFIDENCE_LEVEL_LABELS[confidence as keyof typeof CONFIDENCE_LEVEL_LABELS]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={o.progress ?? 0} />
                      <span className="text-xs font-semibold text-gray-700 tabular-nums w-10 text-right">
                        {Math.round(o.progress ?? 0)}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Sidebar column */}
          <div className="space-y-4">
            {/* By level */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">By level</h2>
              <ul className="space-y-2">
                {OKR_LEVEL_ORDER.map((level) => {
                  const items = objectivesByLevel[level] ?? [];
                  if (items.length === 0) return null;
                  const Icon = LEVEL_ICONS[level];
                  const active = items.filter((o) => o.status === 'active').length;
                  return (
                    <li key={level} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-700">{OKR_LEVEL_LABELS[level]}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-gray-900">
                        {active}<span className="text-gray-400">/{items.length}</span>
                      </span>
                    </li>
                  );
                })}
                {objectives.length === 0 && (
                  <li className="text-xs text-gray-400 italic">No objectives</li>
                )}
              </ul>
            </Card>

            {/* Status mix */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Status</h2>
              <div className="space-y-2 text-xs">
                <StatusRow label={OKR_STATUS_LABELS.active} count={activeObjectives.length} total={objectives.length} color="#2563EB" />
                <StatusRow label={OKR_STATUS_LABELS.draft} count={draftObjectives.length} total={objectives.length} color="#9CA3AF" />
                <StatusRow label={OKR_STATUS_LABELS.completed} count={completedObjectives.length} total={objectives.length} color="#059669" />
              </div>
            </Card>

            {/* At-risk callout */}
            {atRiskObjectives.length > 0 && (
              <Card className="p-5 border-amber-200 bg-amber-50/50">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-semibold text-amber-900">
                      {atRiskObjectives.length} objective{atRiskObjectives.length === 1 ? '' : 's'} at risk
                    </h2>
                    <p className="text-[11px] text-amber-700">
                      Check-in to recover confidence
                    </p>
                  </div>
                </div>
                <ul className="space-y-1 mt-3">
                  {atRiskObjectives.slice(0, 3).map((o) => (
                    <li
                      key={o.id}
                      onClick={() => navigate(`/strategy/okrs/${o.id}`)}
                      className="text-xs text-amber-900 truncate hover:underline cursor-pointer"
                    >
                      · {o.title}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Footer hint */}
      {objectives.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <TrendingUp className="w-3 h-3" />
          Showing {Math.min(topObjectives.length, 5)} of {activeObjectives.length} active objective{activeObjectives.length === 1 ? '' : 's'}.
        </div>
      )}
    </div>
  );
};

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className="text-2xl font-bold mt-1 tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </p>
    </Card>
  );
}

function StatusRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-900 font-semibold tabular-nums">{count}</span>
      </div>
      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default OKRDashboard;
