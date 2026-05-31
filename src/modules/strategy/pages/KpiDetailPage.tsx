// ============================================================================
// KpiDetailPage
// DawinOS v2.0 - CEO Strategy Command Module
// Detail view + measurement entry for a single KPI definition
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  Edit2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Banner } from '@/shared/components/data-display';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { kpiService } from '../services/kpi.service';
import {
  isKPIAutoComputable,
  syncSingleKPI,
  invalidateAutoMeasurementCache,
} from '../services/kpiAutoMeasurement.service';
import { useKPIs } from '../hooks/useKPIs';
import { useKPIData } from '../hooks/useKPIData';
import { okrService } from '../services/okr.service';
import { KpiDialog } from '../components/kpi/KpiDialog';
import { DataPointDialog } from '../components/kpi/DataPointDialog';
import { KpiTrendChart } from '../components/kpi/KpiTrendChart';
import { ThresholdsEditor } from '../components/kpi/ThresholdsEditor';
import { KpiAlertsList } from '../components/kpi/KpiAlertsList';
import { STRATEGY_COMPANY_ID } from '../constants/company';
import type { KPIDefinition, KPIDataPoint } from '../types/kpi.types';
import type { OKRObjective, KeyResult } from '../types/okr.types';
import {
  KPI_CATEGORY_COLORS,
  KPI_CATEGORY_LABELS,
  KPI_DIRECTION_LABELS,
  KPI_FREQUENCY_LABELS,
  KPI_PERFORMANCE,
  KPI_PERFORMANCE_COLORS,
  KPI_PERFORMANCE_LABELS,
  KPI_SCOPE_LABELS,
  KPI_STATUS,
  KPI_STATUS_LABELS,
  KPI_TYPE,
} from '../constants/kpi.constants';

const COMPANY_ID = STRATEGY_COMPANY_ID;

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  deprecated: 'bg-red-50 text-red-700 border-red-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
};

function formatValue(value: number | undefined, type: string, unit?: string, decimals = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const rounded = decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
  switch (type) {
    case KPI_TYPE.CURRENCY:
      return `${unit ? unit + ' ' : ''}${rounded.toLocaleString()}`;
    case KPI_TYPE.PERCENTAGE:
      return `${rounded}%`;
    case KPI_TYPE.RATING:
      return `${rounded}/5`;
    case KPI_TYPE.BINARY:
      return value >= 1 ? 'Yes' : 'No';
    default:
      return `${rounded.toLocaleString()}${unit ? ' ' + unit : ''}`;
  }
}

export const KpiDetailPage: React.FC = () => {
  const { kpiId } = useParams<{ kpiId: string }>();
  const navigate = useNavigate();

  const [kpi, setKpi] = useState<KPIDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Bumped after every measurement log + after activate/pause so the alerts
  // list re-fetches (checkThresholds may have minted new alerts on log).
  const [alertsRefreshKey, setAlertsRefreshKey] = useState(0);

  // Cross-OKR linked KR resolution. KRs are embedded on OKRObjective docs
  // so the only way to render names for `linkedOKRKeyResultIds` is to fetch
  // OKRs and search. We do this lazily on detail page load — fine for the
  // current scale (tens of objectives per company).
  const [linkedKrEntries, setLinkedKrEntries] = useState<
    { kr: KeyResult; objective: OKRObjective }[]
  >([]);
  const [linkedKrsLoading, setLinkedKrsLoading] = useState(false);

  // Auto-tracking status — true when this KPI's library entry says it can
  // be computed from in-system data. Drives the "Auto-tracking" badge +
  // the on-mount sync.
  const isAutoTracked = useMemo(() => (kpi ? isKPIAutoComputable(kpi) : false), [kpi]);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncMsg, setAutoSyncMsg] = useState<string | null>(null);

  const {
    updateKPI,
    deleteKPI,
    activateKPI,
    pauseKPI,
    archiveKPI,
    addThreshold,
    updateThreshold,
    removeThreshold,
  } = useKPIs({
    companyId: COMPANY_ID,
    autoFetch: false,
  });

  const {
    dataPoints,
    latestDataPoint,
    trend,
    loading: dataLoading,
    refresh: refreshData,
    recordValue,
  } = useKPIData({
    companyId: COMPANY_ID,
    kpiId: kpiId || null,
    filters: { maxResults: 24 },
  });

  const loadKpi = async () => {
    if (!kpiId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await kpiService.getKPI(COMPANY_ID, kpiId);
      if (!data) {
        setError('KPI not found');
      } else {
        setKpi(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KPI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiId]);

  // Once we have the KPI definition, fire a background auto-sync if it's
  // auto-trackable. Failures are silent — the manual entry path still works.
  const runAutoSync = async (silent = false) => {
    if (!kpi || !isKPIAutoComputable(kpi)) return;
    setAutoSyncing(true);
    setAutoSyncMsg(null);
    try {
      invalidateAutoMeasurementCache();
      const result = await syncSingleKPI(COMPANY_ID, kpi, 'auto-sync', 'Auto Sync');
      if (result.status === 'inserted' || result.status === 'updated') {
        if (!silent) {
          setAutoSyncMsg(
            `Synced ${kpi.code}: ${result.value?.toFixed(2)} (${result.status === 'updated' ? 'corrected existing measurement' : 'new measurement logged'})`,
          );
        }
        await loadKpi();
        await refreshData();
        setAlertsRefreshKey((k) => k + 1);
      } else if (result.status === 'skipped' && !silent) {
        setAutoSyncMsg(`No source data available yet — manual entry still active.`);
      } else if (result.status === 'error' && !silent) {
        setAutoSyncMsg(`Sync failed: ${result.reason}`);
      }
    } finally {
      setAutoSyncing(false);
    }
  };

  useEffect(() => {
    // Run a silent sync as soon as we know this KPI is auto-trackable.
    // Re-runs whenever the KPI id changes — also picks up source-data
    // corrections because invalidateAutoMeasurementCache is called.
    if (kpi && isKPIAutoComputable(kpi)) {
      void runAutoSync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpi?.id]);

  // Resolve linked OKR KRs (id → KR + parent objective)
  useEffect(() => {
    const ids = kpi?.linkedOKRKeyResultIds || [];
    if (ids.length === 0) {
      setLinkedKrEntries([]);
      return;
    }
    setLinkedKrsLoading(true);
    okrService
      .getObjectives(COMPANY_ID, {})
      .then((objectives) => {
        const found: { kr: KeyResult; objective: OKRObjective }[] = [];
        for (const obj of objectives) {
          for (const kr of obj.keyResults) {
            if (ids.includes(kr.id)) {
              found.push({ kr, objective: obj });
            }
          }
        }
        setLinkedKrEntries(found);
      })
      .catch((err) => {
        console.warn('[KpiDetail] failed to resolve linked KRs:', err);
        setLinkedKrEntries([]);
      })
      .finally(() => setLinkedKrsLoading(false));
  }, [kpi?.linkedOKRKeyResultIds]);

  const handleActivate = async () => {
    if (!kpi) return;
    setBusy(true);
    try {
      const next = await activateKPI(kpi.id);
      setKpi(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate');
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    if (!kpi) return;
    setBusy(true);
    try {
      const next = await pauseKPI(kpi.id);
      setKpi(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!kpi) return;
    setBusy(true);
    try {
      await archiveKPI(kpi.id);
      navigate('/strategy/kpis/active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive');
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!kpi) return;
    setBusy(true);
    try {
      await deleteKPI(kpi.id);
      navigate('/strategy/kpis/active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setBusy(false);
    }
  };

  const handleLog = async (input: Parameters<typeof recordValue>[0]) => {
    await recordValue(input);
    await loadKpi(); // refresh currentValue + lastDataPointDate denormalization
    setAlertsRefreshKey((k) => k + 1); // surface any new threshold-crossed alerts
  };

  const perfColor = kpi?.currentPerformance
    ? KPI_PERFORMANCE_COLORS[kpi.currentPerformance]
    : KPI_PERFORMANCE_COLORS[KPI_PERFORMANCE.NO_DATA];

  const variancePct = useMemo(() => {
    if (!kpi || kpi.currentValue === undefined || !kpi.target?.value) return null;
    const t = kpi.target.value;
    if (t === 0) return null;
    return ((kpi.currentValue - t) / t) * 100;
  }, [kpi]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading KPI…
      </div>
    );
  }

  if (error || !kpi) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/strategy/kpis/active')}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to KPIs
        </Button>
        <Banner
          tone="danger"
          title="Couldn't load KPI"
          message={error || 'KPI not available'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
    );
  }

  const isDraft = kpi.status === KPI_STATUS.DRAFT;
  const isActive = kpi.status === KPI_STATUS.ACTIVE;
  const isPaused = kpi.status === KPI_STATUS.PAUSED;
  const categoryColor = KPI_CATEGORY_COLORS[kpi.category];

  const TrendIcon =
    kpi.trendDirection === 'up'
      ? ArrowUpRight
      : kpi.trendDirection === 'down'
      ? ArrowDownRight
      : Minus;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1100px] mx-auto">
      {autoSyncMsg && (
        <Banner
          tone={autoSyncMsg.startsWith('Sync failed') ? 'danger' : 'info'}
          title={autoSyncMsg.startsWith('Sync failed') ? 'Auto-sync failed' : 'Auto-sync'}
          message={autoSyncMsg}
          icon={<Zap className="h-4 w-4" />}
        />
      )}
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
        <button
          onClick={() => navigate('/strategy/kpis/active')}
          className="hover:text-gray-700 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Active KPIs
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-700 truncate">
          <span className="font-mono mr-1.5 text-[11px]">{kpi.code}</span>
          {kpi.name}
        </span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                {kpi.code}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  STATUS_BADGE_CLASS[kpi.status] || STATUS_BADGE_CLASS.draft
                }`}
              >
                {KPI_STATUS_LABELS[kpi.status]}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
                style={{
                  borderColor: categoryColor + '33',
                  backgroundColor: categoryColor + '11',
                  color: categoryColor,
                }}
              >
                {KPI_CATEGORY_LABELS[kpi.category]}
              </span>
              <span className="text-[11px] text-gray-500">
                {KPI_SCOPE_LABELS[kpi.scope]}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{kpi.name}</h1>
            {kpi.description && (
              <p className="mt-1.5 text-sm text-gray-600">{kpi.description}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-[12px] text-gray-500 flex-wrap">
              {kpi.ownerName && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {kpi.ownerName}
                </span>
              )}
              <span>{KPI_FREQUENCY_LABELS[kpi.frequency]}</span>
              <span className="text-gray-400">·</span>
              <span>{KPI_DIRECTION_LABELS[kpi.direction]}</span>
              {kpi.lastDataPointDate && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Last data {kpi.lastDataPointDate.toDate().toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isAutoTracked && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
                title="This KPI auto-pulls its value from in-system data. Corrections to the source flow through on the next sync."
              >
                <Zap className="h-2.5 w-2.5" />
                Auto-tracking
              </span>
            )}
            {isAutoTracked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAutoSync(false)}
                disabled={autoSyncing}
                title="Recompute this KPI from current source data"
              >
                <Zap className={`h-3.5 w-3.5 ${autoSyncing ? 'animate-pulse' : ''}`} />
                Sync now
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadKpi}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Big-number current vs target */}
        <div className="grid grid-cols-3 gap-5 mt-2">
          <div className="col-span-2 flex items-end gap-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide mb-0.5">
                Current
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-4xl font-semibold tabular-nums"
                  style={{ color: perfColor }}
                >
                  {formatValue(kpi.currentValue, kpi.type, kpi.unit, kpi.decimalPlaces)}
                </span>
                <TrendIcon
                  className="h-4 w-4"
                  style={{
                    color:
                      kpi.trendDirection === 'up'
                        ? '#22c55e'
                        : kpi.trendDirection === 'down'
                        ? '#ef4444'
                        : '#9ca3af',
                  }}
                />
              </div>
              {variancePct !== null && (
                <p className="mt-1 text-[12px] text-gray-500">
                  {variancePct > 0 ? '+' : ''}
                  {variancePct.toFixed(1)}% vs target
                </p>
              )}
            </div>
            <div className="text-gray-300 text-2xl">→</div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide mb-0.5">
                Target
              </p>
              <p className="text-2xl font-semibold tabular-nums text-gray-700">
                {formatValue(kpi.target?.value, kpi.type, kpi.unit, kpi.decimalPlaces)}
              </p>
              {kpi.target?.stretchValue !== undefined && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Stretch:{' '}
                  {formatValue(kpi.target.stretchValue, kpi.type, kpi.unit, kpi.decimalPlaces)}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end justify-end gap-2">
            <div
              className="text-[11px] font-medium uppercase tracking-wide px-2.5 py-1 rounded border"
              style={{
                color: perfColor,
                borderColor: perfColor + '40',
                backgroundColor: perfColor + '11',
              }}
            >
              {KPI_PERFORMANCE_LABELS[kpi.currentPerformance || KPI_PERFORMANCE.NO_DATA]}
            </div>
            <Button variant="primary" size="sm" onClick={() => setLogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Log measurement
            </Button>
            {isDraft && (
              <Button variant="outline" size="sm" onClick={handleActivate} disabled={busy}>
                Activate
              </Button>
            )}
            {isActive && (
              <Button variant="outline" size="sm" onClick={handlePause} disabled={busy}>
                Pause
              </Button>
            )}
            {(isPaused || kpi.status === KPI_STATUS.DEPRECATED) && (
              <Button variant="outline" size="sm" onClick={handleArchive} disabled={busy}>
                Archive
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            Trend
            {trend?.trendDirection && (
              <span
                className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  color:
                    trend.trendDirection === 'up'
                      ? '#22c55e'
                      : trend.trendDirection === 'down'
                      ? '#ef4444'
                      : '#9ca3af',
                  backgroundColor:
                    trend.trendDirection === 'up'
                      ? '#dcfce7'
                      : trend.trendDirection === 'down'
                      ? '#fee2e2'
                      : '#f3f4f6',
                }}
              >
                {trend.trendDirection === 'stable' ? 'Stable' : trend.trendDirection === 'up' ? 'Improving' : 'Declining'}
              </span>
            )}
          </h2>
          <span className="text-[11px] text-gray-500">
            {dataPoints.length} data point{dataPoints.length === 1 ? '' : 's'}
          </span>
        </div>
        <KpiTrendChart
          dataPoints={dataPoints}
          target={kpi.target?.value}
          unit={kpi.unit}
        />
      </div>

      {/* Thresholds */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Thresholds
            <span className="text-[12px] text-gray-500 font-normal">
              {kpi.thresholds?.length || 0}/4
            </span>
          </h2>
        </div>
        <ThresholdsEditor
          kpi={kpi}
          unit={kpi.unit}
          onAdd={async (t) => {
            await addThreshold(kpi.id, t);
            await loadKpi();
          }}
          onUpdate={async (id, updates) => {
            await updateThreshold(kpi.id, id, updates);
            await loadKpi();
          }}
          onRemove={async (id) => {
            await removeThreshold(kpi.id, id);
            await loadKpi();
          }}
        />
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Alerts
          </h2>
        </div>
        <KpiAlertsList
          companyId={COMPANY_ID}
          kpiId={kpi.id}
          refreshKey={alertsRefreshKey}
        />
      </div>

      {/* Data points history */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Measurements
            <span className="ml-2 text-[12px] text-gray-500 font-normal">
              {dataPoints.length} recent
            </span>
          </h2>
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        {dataLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 text-[12px]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading…
          </div>
        ) : dataPoints.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p className="mb-3">No measurements logged yet.</p>
            <Button variant="primary" size="sm" onClick={() => setLogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Log first measurement
            </Button>
          </div>
        ) : (
          <DataPointTable
            points={dataPoints}
            kpi={kpi}
            latestId={latestDataPoint?.id}
          />
        )}
      </div>

      {/* Linked OKR Key Results */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Linked OKR key results
            <span className="text-[12px] text-gray-500 font-normal">
              {kpi.linkedOKRKeyResultIds?.length || 0}
            </span>
          </h2>
        </div>
        {!kpi.linkedOKRKeyResultIds || kpi.linkedOKRKeyResultIds.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing here yet. Open any OKR key result and use the “Link KPI” action to track this
            KPI from the OKR side.
          </p>
        ) : linkedKrsLoading ? (
          <div className="flex items-center text-gray-400 text-[12px]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Resolving links…
          </div>
        ) : linkedKrEntries.length === 0 ? (
          <p className="text-sm text-gray-500">
            {kpi.linkedOKRKeyResultIds.length} link
            {kpi.linkedOKRKeyResultIds.length === 1 ? '' : 's'} on record but the parent objectives
            couldn't be found — they may have been deleted.
          </p>
        ) : (
          <ul className="space-y-2">
            {linkedKrEntries.map(({ kr, objective }) => (
              <li key={kr.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/strategy/okrs/${objective.id}`)}
                  className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-md border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-gray-900 truncate">{kr.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      Objective: {objective.title}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {kr.currentValue}/{kr.targetValue}
                    {kr.unit ? ` ${kr.unit}` : ''}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dialogs */}
      {editOpen && (
        <KpiDialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) loadKpi();
          }}
          mode="edit"
          kpi={kpi}
          defaultOwner={{ id: kpi.ownerId, name: kpi.ownerName || '' }}
          onUpdate={async (id, input) => {
            const next = await updateKPI(id, input);
            setKpi(next);
            return next;
          }}
        />
      )}

      {logOpen && (
        <DataPointDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          kpi={kpi}
          onSubmit={handleLog}
        />
      )}

      {confirmDelete && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this KPI?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              This will permanently delete the KPI definition and all of its measurements. Linked
              OKR key results will keep their data but will lose the link back to this KPI. This
              cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete KPI
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// DataPointTable
// ---------------------------------------------------------------------------
interface DataPointTableProps {
  points: KPIDataPoint[];
  kpi: KPIDefinition;
  latestId?: string;
}

const DataPointTable: React.FC<DataPointTableProps> = ({ points, kpi, latestId }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-gray-200 text-[10.5px] uppercase tracking-wide text-gray-500">
            <th className="text-left font-medium py-2">Date</th>
            <th className="text-right font-medium py-2">Value</th>
            <th className="text-right font-medium py-2">Δ vs target</th>
            <th className="text-left font-medium py-2 pl-3">Note</th>
            <th className="text-left font-medium py-2 pl-3">Logged by</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => {
            const target = p.target ?? kpi.target?.value;
            const variance = target !== undefined ? p.value - target : null;
            const perfColor = KPI_PERFORMANCE_COLORS[p.performanceStatus] || '#9ca3af';
            return (
              <tr key={p.id} className="border-b border-gray-50 last:border-b-0">
                <td className="py-2 text-gray-700">
                  {p.date.toDate().toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {p.id === latestId && (
                    <span className="ml-1.5 text-[9px] uppercase font-medium text-blue-600">
                      latest
                    </span>
                  )}
                </td>
                <td
                  className="text-right tabular-nums font-medium"
                  style={{ color: perfColor }}
                >
                  {formatValue(p.value, kpi.type, kpi.unit, kpi.decimalPlaces)}
                </td>
                <td
                  className="text-right tabular-nums"
                  style={{ color: variance !== null && variance >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {variance !== null
                    ? `${variance > 0 ? '+' : ''}${variance.toFixed(kpi.decimalPlaces ?? 1)}`
                    : '—'}
                </td>
                <td className="pl-3 text-gray-600 max-w-[260px] truncate" title={p.note || ''}>
                  {p.note || <span className="text-gray-300">—</span>}
                </td>
                <td className="pl-3 text-gray-500">
                  {p.enteredByName || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default KpiDetailPage;
