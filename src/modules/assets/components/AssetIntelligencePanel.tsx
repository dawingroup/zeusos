/**
 * Asset Intelligence Panel
 * AI-powered asset analysis: back-search enrichment, maintenance predictions,
 * utilization insights, cost analysis, and recommendations.
 */

import { useState } from 'react';
import {
  Sparkles,
  Search,
  Wrench,
  BarChart3,
  DollarSign,
  Lightbulb,
  Loader2,
  AlertTriangle,
  ExternalLink,
  FileText,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Download,
  Plus,
  Shield,
  Clock,
  Package,
} from 'lucide-react';
import { useAssetIntelligence } from '../hooks/useAssetIntelligence';
import { consumableService } from '../services/consumableService';
import { useAuth } from '@/shared/hooks';
import type { Asset, AssetStatusChange } from '@/shared/types';
import type { MaintenanceLog, AssetCheckout } from '../types';
import { CONSUMABLE_TYPE_LABELS } from '../types/consumable';
import type {
  AssetEnrichmentResult,
  AssetIntelligenceResult,
  MaintenancePrediction,
  AssetRecommendation,
  AIConsumableSuggestion,
  RepairPartsStrategy,
  Priority,
} from '../types/assetIntelligence';

// ============================================================================
// CONFIG
// ============================================================================

const PRIORITY_CONFIG: Record<Priority, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Low' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Medium' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'High' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
};

const RISK_CONFIG: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
};

const TREND_ICON = {
  increasing: TrendingUp,
  stable: Minus,
  decreasing: TrendingDown,
};

type PanelSection = 'enrichment' | 'maintenance' | 'utilization' | 'cost' | 'recommendations';

// ============================================================================
// COMPONENT
// ============================================================================

interface AssetIntelligencePanelProps {
  asset: Asset;
  maintenanceLogs: MaintenanceLog[];
  statusChanges: AssetStatusChange[];
  checkouts: AssetCheckout[];
  onAssetUpdated: () => void;
}

export function AssetIntelligencePanel({
  asset,
  maintenanceLogs,
  statusChanges,
  checkouts,
  onAssetUpdated,
}: AssetIntelligencePanelProps) {
  const { user } = useAuth();
  const {
    result,
    enrichmentResult,
    isAnalyzing,
    isEnriching,
    isApplying,
    error,
    runAnalysis,
    enrichProfile,
    applyEnrichment,
  } = useAssetIntelligence();

  const [activeSection, setActiveSection] = useState<PanelSection>('enrichment');

  const handleFullAnalysis = () => {
    runAnalysis(asset, maintenanceLogs, statusChanges, checkouts);
  };

  const handleEnrich = () => {
    enrichProfile(asset);
  };

  const handleApplyEnrichment = async () => {
    if (!enrichmentResult) return;
    await applyEnrichment(asset.id, enrichmentResult);
    onAssetUpdated();
  };

  const sections: { id: PanelSection; label: string; icon: React.ElementType }[] = [
    { id: 'enrichment', label: 'Profile Enrichment', icon: Search },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'utilization', label: 'Utilization', icon: BarChart3 },
    { id: 'cost', label: 'Cost Analysis', icon: DollarSign },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  ];

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Asset Intelligence</h3>
          <p className="text-xs text-gray-500">
            AI-powered analysis for {asset.brand} {asset.model}
          </p>
        </div>
        <button
          onClick={handleEnrich}
          disabled={isEnriching || isAnalyzing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {isEnriching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          Enrich Profile
        </button>
        <button
          onClick={handleFullAnalysis}
          disabled={isAnalyzing || isEnriching}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {isAnalyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          Full Analysis
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Section Tabs */}
      {(enrichmentResult || result) && (
        <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const isDisabled =
              section.id !== 'enrichment' && !result;
            return (
              <button
                key={section.id}
                onClick={() => !isDisabled && setActiveSection(section.id)}
                disabled={isDisabled}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md flex-1 justify-center transition-colors ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : isDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{section.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Section Content */}
      {activeSection === 'enrichment' && enrichmentResult && (
        <EnrichmentSection
          enrichment={enrichmentResult}
          isApplying={isApplying}
          onApply={handleApplyEnrichment}
          asset={asset}
          userId={user?.uid}
        />
      )}

      {activeSection === 'maintenance' && result && (
        <MaintenancePredictionsSection predictions={result.maintenancePredictions} />
      )}

      {activeSection === 'utilization' && result && (
        <UtilizationSection utilization={result.utilization} />
      )}

      {activeSection === 'cost' && result && (
        <CostSection costAnalysis={result.costAnalysis} />
      )}

      {activeSection === 'recommendations' && result && (
        <>
          <RecommendationsSection recommendations={result.recommendations} />
          {result.repairPartsStrategy && (
            <RepairPartsStrategySection strategy={result.repairPartsStrategy} />
          )}
        </>
      )}

      {/* Empty State */}
      {!enrichmentResult && !result && !isAnalyzing && !isEnriching && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-300" />
          <p className="text-sm text-gray-500 mb-1">
            No intelligence data yet
          </p>
          <p className="text-xs text-gray-400">
            Click "Enrich Profile" for a back-search or "Full Analysis" for complete insights
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ENRICHMENT SECTION
// ============================================================================

function EnrichmentSection({
  enrichment,
  isApplying,
  onApply,
  asset,
  userId,
}: {
  enrichment: AssetEnrichmentResult;
  isApplying: boolean;
  onApply: () => void;
  asset?: Asset;
  userId?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Profile Enrichment</h3>
        </div>
        <button
          onClick={onApply}
          disabled={isApplying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {isApplying ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          Apply to Asset
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Specs */}
        {enrichment.specs && Object.keys(enrichment.specs).length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">
              Technical Specifications
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(enrichment.specs).map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-400 uppercase">{key}</div>
                  <div className="text-sm font-medium text-gray-900">{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        <div className="flex flex-wrap gap-3">
          {enrichment.manualUrl && (
            <a
              href={enrichment.manualUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-primary"
            >
              <FileText className="w-3.5 h-3.5" />
              Manual
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {enrichment.productPageUrl && (
            <a
              href={enrichment.productPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-primary"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Product Page
            </a>
          )}
        </div>

        {/* Pricing & Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {enrichment.currentRetailPrice && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Retail Price</div>
              <div className="text-sm font-medium text-gray-900">
                {enrichment.currentRetailPrice.amount.toLocaleString()}{' '}
                {enrichment.currentRetailPrice.currency}
              </div>
              <div className="text-[10px] text-gray-400">
                via {enrichment.currentRetailPrice.source}
              </div>
            </div>
          )}
          {enrichment.discontinuedStatus && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Product Status</div>
              <div
                className={`text-sm font-medium ${
                  enrichment.discontinuedStatus === 'active'
                    ? 'text-green-700'
                    : enrichment.discontinuedStatus === 'discontinued'
                      ? 'text-red-700'
                      : 'text-amber-700'
                }`}
              >
                {enrichment.discontinuedStatus === 'active'
                  ? 'Active'
                  : enrichment.discontinuedStatus === 'discontinued'
                    ? 'Discontinued'
                    : enrichment.discontinuedStatus === 'end-of-life'
                      ? 'End of Life'
                      : 'Unknown'}
              </div>
            </div>
          )}
          {enrichment.yearReleased && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Year Released</div>
              <div className="text-sm font-medium text-gray-900">
                {enrichment.yearReleased}
              </div>
            </div>
          )}
          {enrichment.replacementModel && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Replacement</div>
              <div className="text-sm font-medium text-primary">
                {enrichment.replacementModel}
              </div>
            </div>
          )}
        </div>

        {/* Safety Alerts */}
        {enrichment.safetyAlerts && enrichment.safetyAlerts.length > 0 && (
          <div>
            <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Safety Alerts
            </div>
            <div className="space-y-1">
              {enrichment.safetyAlerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {alert}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common Issues */}
        {enrichment.commonIssues && enrichment.commonIssues.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">
              Known Issues
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enrichment.commonIssues.map((issue, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded"
                >
                  {issue}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Consumables & Repair Parts */}
        {enrichment.consumablesAndParts && enrichment.consumablesAndParts.length > 0 && (
          <ConsumablesAndPartsSection
            parts={enrichment.consumablesAndParts}
            asset={asset}
            userId={userId}
          />
        )}

        {/* Legacy Accessories (if no structured parts) */}
        {(!enrichment.consumablesAndParts || enrichment.consumablesAndParts.length === 0) &&
          enrichment.accessories && enrichment.accessories.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">
              Compatible Accessories
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enrichment.accessories.map((acc, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                >
                  {acc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Warranty */}
        {enrichment.warrantyInfo && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400">Warranty</div>
            <div className="text-sm text-gray-900">{enrichment.warrantyInfo}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAINTENANCE PREDICTIONS SECTION
// ============================================================================

function MaintenancePredictionsSection({
  predictions,
}: {
  predictions: MaintenancePrediction[];
}) {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-400">
        <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No maintenance predictions available</p>
        <p className="text-xs">More data needed for accurate predictions</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Wrench className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Maintenance Predictions</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {predictions.map((pred, i) => {
          const riskConfig = RISK_CONFIG[pred.riskLevel] || RISK_CONFIG.low;
          return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${riskConfig.bg} ${riskConfig.text}`}
                  >
                    {pred.riskLevel.toUpperCase()} RISK
                  </span>
                  <span className="text-xs text-gray-400">
                    {pred.confidence}% confidence
                  </span>
                </div>
                {pred.estimatedCost && (
                  <span className="text-xs text-gray-500">
                    Est. {pred.estimatedCost.toLocaleString()} UGX
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                {pred.predictedIssue}
              </p>
              <p className="text-xs text-gray-500 mb-2">
                {pred.recommendedAction}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>
                  Window: {pred.nextFailureWindow.earliest} — {pred.nextFailureWindow.latest}
                </span>
                <span>Based on: {pred.basedOn}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// UTILIZATION SECTION
// ============================================================================

function UtilizationSection({
  utilization,
}: {
  utilization: AssetIntelligenceResult['utilization'];
}) {
  const TrendIcon = TREND_ICON[utilization.utilizationTrend] || Minus;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Utilization Insights</h3>
      </div>
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {utilization.uptimePercentage}%
            </div>
            <div className="text-xs text-gray-500">Uptime</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {utilization.avgCheckoutDuration}
            </div>
            <div className="text-xs text-gray-500">Avg Checkout</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendIcon className="w-5 h-5 text-gray-600" />
              <span className="text-lg font-bold text-gray-900 capitalize">
                {utilization.utilizationTrend}
              </span>
            </div>
            <div className="text-xs text-gray-500">Trend</div>
          </div>
        </div>

        {utilization.peakUsagePeriods.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-500 mb-1">
              Peak Usage Periods
            </div>
            <div className="flex flex-wrap gap-1.5">
              {utilization.peakUsagePeriods.map((period, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded"
                >
                  {period}
                </span>
              ))}
            </div>
          </div>
        )}

        {utilization.recommendation && (
          <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
            <strong>Recommendation:</strong> {utilization.recommendation}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COST SECTION
// ============================================================================

function CostSection({
  costAnalysis,
}: {
  costAnalysis: AssetIntelligenceResult['costAnalysis'];
}) {
  const TrendIcon = TREND_ICON[costAnalysis.costTrend] || Minus;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Cost Analysis</h3>
      </div>
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
            <div className="text-xl font-bold text-gray-900">
              {costAnalysis.totalMaintenanceCost.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total Cost (UGX)</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
            <div className="text-xl font-bold text-gray-900">
              {costAnalysis.avgCostPerService.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Avg Per Service</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
            <div className="text-xl font-bold text-gray-900">
              {costAnalysis.projectedAnnualCost.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Projected Annual</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendIcon
                className={`w-5 h-5 ${
                  costAnalysis.costTrend === 'increasing'
                    ? 'text-red-500'
                    : costAnalysis.costTrend === 'decreasing'
                      ? 'text-green-500'
                      : 'text-gray-500'
                }`}
              />
              <span className="text-lg font-bold text-gray-900 capitalize">
                {costAnalysis.costTrend}
              </span>
            </div>
            <div className="text-xs text-gray-500">Cost Trend</div>
          </div>
        </div>

        {costAnalysis.costPerOperatingHour && (
          <div className="mt-4 bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-xs text-gray-400">Cost Per Operating Hour</div>
            <div className="text-sm font-medium text-gray-900">
              {costAnalysis.costPerOperatingHour.toLocaleString()} UGX
            </div>
          </div>
        )}

        {costAnalysis.replacementBreakeven && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
            <strong>Replacement breakeven:</strong>{' '}
            {costAnalysis.replacementBreakeven}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RECOMMENDATIONS SECTION
// ============================================================================

function RecommendationsSection({
  recommendations,
}: {
  recommendations: AssetRecommendation[];
}) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-400">
        <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No recommendations at this time</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Recommendations</h3>
        <span className="text-xs text-gray-400">
          ({recommendations.length})
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {recommendations.map((rec, i) => {
          const priorityConfig = PRIORITY_CONFIG[rec.priority];
          return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${priorityConfig.bg} ${priorityConfig.text}`}
                >
                  {priorityConfig.label}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
                  {rec.type}
                </span>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                {rec.title}
              </h4>
              <p className="text-xs text-gray-500 mb-2">{rec.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  Impact: {rec.estimatedImpact}
                </span>
                {rec.estimatedCost && (
                  <span>Est. cost: {rec.estimatedCost.toLocaleString()} UGX</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// CONSUMABLES & PARTS SECTION (within Enrichment)
// ============================================================================

const PART_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'cutting-tool': { bg: 'bg-red-50', text: 'text-red-700' },
  'abrasive': { bg: 'bg-orange-50', text: 'text-orange-700' },
  'filter': { bg: 'bg-sky-50', text: 'text-sky-700' },
  'lubricant': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'wear-part': { bg: 'bg-amber-50', text: 'text-amber-700' },
  'electrical': { bg: 'bg-violet-50', text: 'text-violet-700' },
  'accessory': { bg: 'bg-blue-50', text: 'text-blue-700' },
};

function ConsumablesAndPartsSection({
  parts,
  asset,
  userId,
}: {
  parts: AIConsumableSuggestion[];
  asset?: Asset;
  userId?: string;
}) {
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const handleAddToCatalog = async (suggestion: AIConsumableSuggestion, index: number) => {
    if (!asset || !userId) return;
    setAddingIndex(index);
    try {
      await consumableService.createFromAISuggestions([suggestion], asset.category, userId);
      setAddedIndices(prev => new Set(prev).add(index));
    } catch (err) {
      console.error('Failed to add to catalog:', err);
    } finally {
      setAddingIndex(null);
    }
  };

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
        <Package className="w-3.5 h-3.5" />
        Consumables & Repair Parts ({parts.length})
      </div>
      <div className="space-y-2">
        {parts.map((part, i) => {
          const typeColor = PART_TYPE_COLORS[part.type] || PART_TYPE_COLORS.accessory;
          const isAdding = addingIndex === i;
          const isAdded = addedIndices.has(i);

          return (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm font-medium text-gray-900">{part.name}</span>
                    {part.isCritical && (
                      <Shield className="w-3 h-3 text-red-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor.bg} ${typeColor.text}`}>
                      {CONSUMABLE_TYPE_LABELS[part.type] || part.type}
                    </span>
                    {part.partNumber && (
                      <span className="text-[10px] text-gray-400">#{part.partNumber}</span>
                    )}
                    {part.expectedLifeHours && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                        <Clock className="w-2.5 h-2.5" />
                        {part.expectedLifeHours}h
                      </span>
                    )}
                    {part.estimatedCost && (
                      <span className="text-[10px] text-gray-400">
                        ~{part.estimatedCost.amount} {part.estimatedCost.currency}
                      </span>
                    )}
                  </div>
                  {part.replacementTrigger && (
                    <p className="text-[10px] text-gray-400 mt-1">{part.replacementTrigger}</p>
                  )}
                </div>

                {asset && userId && (
                  <button
                    onClick={() => handleAddToCatalog(part, i)}
                    disabled={isAdding || isAdded}
                    className={`shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ${
                      isAdded
                        ? 'bg-green-100 text-green-600 cursor-default'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50'
                    }`}
                  >
                    {isAdding ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isAdded ? (
                      'Added'
                    ) : (
                      <>
                        <Plus className="w-2.5 h-2.5" />
                        Catalog
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// REPAIR PARTS STRATEGY SECTION
// ============================================================================

function RepairPartsStrategySection({
  strategy,
}: {
  strategy: RepairPartsStrategy;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Shield className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Repair Parts Strategy</h3>
      </div>
      <div className="px-5 py-4 space-y-4">
        {/* Uptime Risk Assessment */}
        {strategy.uptimeRiskAssessment && (
          <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Uptime Risk:</strong> {strategy.uptimeRiskAssessment}
          </div>
        )}

        {/* Critical Spares */}
        {strategy.criticalSpares.length > 0 && (
          <div>
            <div className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Critical Spares to Stock
            </div>
            <div className="space-y-2">
              {strategy.criticalSpares.map((spare, i) => (
                <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{spare.part}</span>
                    <span className="text-xs text-gray-500">
                      Recommended: {spare.recommendedStock}
                      {spare.estimatedCost ? ` (~${spare.estimatedCost.toLocaleString()} UGX)` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{spare.reason}</p>
                  {spare.replacementInterval && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {spare.replacementInterval}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Maintenance Kits */}
        {strategy.maintenanceKits.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5" />
              Recommended Maintenance Kits
            </div>
            <div className="space-y-2">
              {strategy.maintenanceKits.map((kit, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{kit.name}</span>
                    {kit.estimatedCost && (
                      <span className="text-xs text-gray-500">
                        ~{kit.estimatedCost.toLocaleString()} UGX
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {kit.parts.map((part, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-600">
                        {part}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                    {kit.frequency}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
