/**
 * Asset Intelligence Service
 * AI-powered asset back-search, maintenance predictions,
 * utilization analysis, cost tracking, and recommendations.
 *
 * Uses Firebase Cloud Functions:
 * - Gemini 2.0 Flash + Google Search grounding for back-search enrichment
 * - Claude Sonnet for analysis, predictions, and recommendations
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';
import type { Asset, AssetStatusChange } from '@/shared/types';
import type { MaintenanceLog, AssetCheckout } from '../types';
import type {
  AssetEnrichmentResult,
  AssetIntelligenceResult,
  AssetCostAnalysis,
  UtilizationInsight,
  MaintenancePrediction,
  AssetRecommendation,
  RepairPartsStrategy,
} from '../types/assetIntelligence';

// ============================================================================
// CLOUD FUNCTION CALLABLE
// ============================================================================

interface AssetIntelligenceRequest {
  action: 'enrich' | 'analyze';
  asset: Record<string, unknown>;
  maintenanceHistory?: Record<string, unknown>[];
  statusHistory?: Record<string, unknown>[];
  localMetrics?: {
    costAnalysis: AssetCostAnalysis;
    utilization: UtilizationInsight;
  };
}

interface EnrichResponse {
  enrichment: AssetEnrichmentResult;
}

interface AnalyzeResponse {
  enrichment: AssetEnrichmentResult;
  maintenancePredictions: MaintenancePrediction[];
  utilization: Partial<UtilizationInsight>;
  costAnalysis: Partial<AssetCostAnalysis>;
  recommendations: AssetRecommendation[];
  repairPartsStrategy?: RepairPartsStrategy | null;
}

const assetIntelligenceFn = httpsCallable<AssetIntelligenceRequest, EnrichResponse | AnalyzeResponse>(
  functions,
  'assetIntelligence'
);

// ============================================================================
// AI API CALLS
// ============================================================================

/**
 * Back-search an asset by brand+model to enrich its profile.
 * Uses Gemini with Google Search grounding to find specs, manuals, pricing, etc.
 */
export async function enrichAssetProfile(
  asset: Asset
): Promise<AssetEnrichmentResult> {
  const result = await assetIntelligenceFn({
    action: 'enrich',
    asset: {
      brand: asset.brand,
      model: asset.model,
      category: asset.category,
      serialNumber: asset.serialNumber,
      existingSpecs: asset.specs,
    },
  });

  return (result.data as EnrichResponse).enrichment;
}

/**
 * Full AI analysis: maintenance predictions, utilization, cost, recommendations.
 * Combines Gemini enrichment + Claude analysis with local data computation.
 */
export async function analyzeAssetHealth(
  asset: Asset,
  maintenanceLogs: MaintenanceLog[],
  statusChanges: AssetStatusChange[],
  checkouts: AssetCheckout[]
): Promise<AssetIntelligenceResult> {
  // Compute local metrics first
  const costAnalysis = computeCostAnalysis(maintenanceLogs);
  const utilization = computeUtilization(statusChanges, checkouts);

  const result = await assetIntelligenceFn({
    action: 'analyze',
    asset: {
      id: asset.id,
      brand: asset.brand,
      model: asset.model,
      category: asset.category,
      status: asset.status,
      specs: asset.specs,
      maintenance: {
        intervalHours: asset.maintenance.intervalHours,
        tasks: asset.maintenance.tasks,
        nextServiceDue: asset.maintenance.nextServiceDue,
        lastServicedAt: asset.maintenance.lastServicedAt,
        historyCount: asset.maintenance.history.length,
      },
      location: asset.location,
    },
    maintenanceHistory: maintenanceLogs.map((log) => ({
      type: log.type,
      description: log.description,
      cost: log.cost,
      performedAt: log.performedAt,
      hoursAtService: log.hoursAtService,
      tasksCompleted: log.tasksCompleted,
    })),
    statusHistory: statusChanges.map((sc) => ({
      fromStatus: sc.fromStatus,
      toStatus: sc.toStatus,
      reason: sc.reason,
      changedAt: sc.changedAt,
    })),
    localMetrics: {
      costAnalysis,
      utilization,
    },
  });

  const data = result.data as AnalyzeResponse;

  return {
    enrichment: data.enrichment,
    maintenancePredictions: data.maintenancePredictions || [],
    utilization: {
      ...utilization,
      ...(data.utilization || {}),
    },
    costAnalysis: {
      ...costAnalysis,
      ...(data.costAnalysis || {}),
    },
    recommendations: data.recommendations || [],
    repairPartsStrategy: data.repairPartsStrategy || undefined,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Quick recommendations based on current asset state.
 * Uses the analyze action and extracts just the recommendations.
 */
export async function getAssetRecommendations(
  asset: Asset,
  maintenanceLogs: MaintenanceLog[]
): Promise<AssetRecommendation[]> {
  const costAnalysis = computeCostAnalysis(maintenanceLogs);

  const result = await assetIntelligenceFn({
    action: 'analyze',
    asset: {
      brand: asset.brand,
      model: asset.model,
      category: asset.category,
      status: asset.status,
      specs: asset.specs,
      maintenance: {
        intervalHours: asset.maintenance.intervalHours,
        nextServiceDue: asset.maintenance.nextServiceDue,
        lastServicedAt: asset.maintenance.lastServicedAt,
      },
    },
    maintenanceHistory: maintenanceLogs.slice(0, 5).map((log) => ({
      type: log.type,
      description: log.description,
      cost: log.cost,
      performedAt: log.performedAt,
    })),
    localMetrics: {
      costAnalysis,
      utilization: {
        uptimePercentage: 100,
        avgCheckoutDuration: 'N/A',
        peakUsagePeriods: [],
        idlePeriods: [],
        utilizationTrend: 'stable',
        recommendation: '',
      },
    },
  });

  const data = result.data as AnalyzeResponse;
  return data.recommendations || [];
}

// ============================================================================
// LOCAL COMPUTATION HELPERS
// ============================================================================

/**
 * Compute cost analysis from maintenance logs locally.
 */
function computeCostAnalysis(logs: MaintenanceLog[]): AssetCostAnalysis {
  const logsWithCost = logs.filter((l) => l.cost != null && l.cost > 0);
  const totalCost = logsWithCost.reduce((sum, l) => sum + (l.cost || 0), 0);
  const avgCost = logsWithCost.length > 0 ? totalCost / logsWithCost.length : 0;

  // Determine cost trend from last 5 vs previous 5
  let costTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (logsWithCost.length >= 4) {
    const sorted = [...logsWithCost].sort(
      (a, b) => toMs(a.performedAt) - toMs(b.performedAt)
    );
    const mid = Math.floor(sorted.length / 2);
    const olderAvg =
      sorted.slice(0, mid).reduce((s, l) => s + (l.cost || 0), 0) / mid;
    const newerAvg =
      sorted.slice(mid).reduce((s, l) => s + (l.cost || 0), 0) /
      (sorted.length - mid);

    if (newerAvg > olderAvg * 1.15) costTrend = 'increasing';
    else if (newerAvg < olderAvg * 0.85) costTrend = 'decreasing';
  }

  // Project annual cost based on frequency
  let projectedAnnualCost = 0;
  if (logsWithCost.length >= 2) {
    const sorted = [...logsWithCost].sort(
      (a, b) => toMs(a.performedAt) - toMs(b.performedAt)
    );
    const firstMs = toMs(sorted[0].performedAt);
    const lastMs = toMs(sorted[sorted.length - 1].performedAt);
    const spanDays = (lastMs - firstMs) / (1000 * 60 * 60 * 24);
    if (spanDays > 0) {
      projectedAnnualCost = (totalCost / spanDays) * 365;
    }
  }

  return {
    totalMaintenanceCost: totalCost,
    avgCostPerService: Math.round(avgCost),
    costTrend,
    projectedAnnualCost: Math.round(projectedAnnualCost),
  };
}

/**
 * Compute utilization metrics from status changes and checkouts.
 */
function computeUtilization(
  statusChanges: AssetStatusChange[],
  checkouts: AssetCheckout[]
): UtilizationInsight {
  // Calculate uptime percentage from status changes
  let uptimeMs = 0;
  let totalMs = 0;

  if (statusChanges.length >= 2) {
    const sorted = [...statusChanges].sort(
      (a, b) => toMs(a.changedAt) - toMs(b.changedAt)
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const start = toMs(sorted[i].changedAt);
      const end = toMs(sorted[i + 1].changedAt);
      const duration = end - start;
      totalMs += duration;

      if (sorted[i].toStatus === 'ACTIVE' || sorted[i].toStatus === 'CHECKED_OUT') {
        uptimeMs += duration;
      }
    }
  }

  const uptimePercentage = totalMs > 0 ? Math.round((uptimeMs / totalMs) * 100) : 100;

  // Calculate average checkout duration
  const completedCheckouts = checkouts.filter((c) => c.checkedInAt);
  let avgCheckoutDuration = 'N/A';

  if (completedCheckouts.length > 0) {
    const totalDurationMs = completedCheckouts.reduce((sum, c) => {
      return sum + (toMs(c.checkedInAt!) - toMs(c.checkedOutAt));
    }, 0);
    const avgMs = totalDurationMs / completedCheckouts.length;
    const avgHours = Math.round(avgMs / (1000 * 60 * 60));
    avgCheckoutDuration = avgHours < 24
      ? `${avgHours}h`
      : `${Math.round(avgHours / 24)}d`;
  }

  return {
    uptimePercentage,
    avgCheckoutDuration,
    peakUsagePeriods: [],
    idlePeriods: [],
    utilizationTrend: 'stable',
    recommendation: '',
  };
}

/**
 * Convert Firestore Timestamp or Date to milliseconds.
 */
function toMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    return new Date(value).getTime();
  }
  return 0;
}
