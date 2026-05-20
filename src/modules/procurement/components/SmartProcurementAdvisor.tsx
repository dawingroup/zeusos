/**
 * Smart Procurement Advisor
 * AI-powered supplier enrichment (addresses, websites, certifications),
 * procurement recommendations, price trends, and risk alerts.
 */

import { useState } from 'react';
import {
  Sparkles,
  Search,
  Globe,
  MapPin,
  Phone,
  Mail,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Lightbulb,
  Loader2,
  Download,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Building2,
  Star,
  Users,
  Calendar,
  Package,
  CheckCircle,
} from 'lucide-react';
import { useProcurementAdvisor } from '../hooks/useProcurementAdvisor';
import type { Supplier } from '@/modules/suppliers/types/supplier';
import type {
  SupplierEnrichmentResult,
  ProcurementRecommendation,
  PriceTrendAnalysis,
  SupplierRiskAlert,
  ProcurementAction,
} from '../types/procurementAdvisor';

// ============================================================================
// CONFIG
// ============================================================================

const ACTION_CONFIG: Record<ProcurementAction, { bg: string; text: string; label: string }> = {
  keep: { bg: 'bg-green-100', text: 'text-green-700', label: 'Keep' },
  switch: { bg: 'bg-red-100', text: 'text-red-700', label: 'Switch' },
  renegotiate: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Renegotiate' },
  'add-backup': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Add Backup' },
};

const RISK_SEVERITY: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  high: { bg: 'bg-red-100', text: 'text-red-700' },
};

const RISK_TYPE_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  quality: 'Quality',
  financial: 'Financial',
  concentration: 'Concentration',
  geopolitical: 'Geopolitical',
};

const ADDRESS_TYPE_ICONS: Record<string, React.ElementType> = {
  headquarters: Building2,
  branch: MapPin,
  warehouse: Package,
  showroom: Globe,
};

type AdvisorSection = 'enrichment' | 'recommendations' | 'trends' | 'risks' | 'insights';

// ============================================================================
// COMPONENT
// ============================================================================

interface SmartProcurementAdvisorProps {
  supplier: Supplier;
  onSupplierUpdated?: () => void;
}

export function SmartProcurementAdvisor({
  supplier,
  onSupplierUpdated,
}: SmartProcurementAdvisorProps) {
  const {
    result,
    enrichmentResult,
    isAnalyzing,
    isEnriching,
    isApplying,
    isSaving,
    error,
    runFullAnalysis,
    enrichProfile,
    applyEnrichment,
    saveResults,
  } = useProcurementAdvisor();

  const [activeSection, setActiveSection] = useState<AdvisorSection>('enrichment');

  const handleFullAnalysis = () => {
    runFullAnalysis(supplier);
  };

  const handleEnrich = () => {
    enrichProfile(supplier);
  };

  const handleApplyEnrichment = async () => {
    if (!enrichmentResult) return;
    await applyEnrichment(supplier.id, enrichmentResult);
    onSupplierUpdated?.();
  };

  const handleSaveToProfile = async () => {
    await saveResults(supplier.id);
    onSupplierUpdated?.();
  };

  const sections: { id: AdvisorSection; label: string; icon: React.ElementType }[] = [
    { id: 'enrichment', label: 'Profile Enrichment', icon: Search },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
    { id: 'trends', label: 'Price Trends', icon: TrendingUp },
    { id: 'risks', label: 'Risk Alerts', icon: ShieldAlert },
    { id: 'insights', label: 'Market Insights', icon: Globe },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Smart Procurement Advisor
              </h3>
              <p className="text-xs text-gray-500">
                AI-powered intelligence for {supplier.name}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
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
            {result && (
              <button
                onClick={handleSaveToProfile}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Save to Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Section Tabs */}
      {(enrichmentResult || result) && (
        <div className="mx-5 mt-4 flex gap-1 bg-gray-50 p-1 rounded-lg">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const isDisabled = section.id !== 'enrichment' && !result;
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

      {/* Content */}
      <div className="px-5 py-4">
        {activeSection === 'enrichment' && enrichmentResult && (
          <SupplierEnrichmentSection
            enrichment={enrichmentResult}
            isApplying={isApplying}
            onApply={handleApplyEnrichment}
          />
        )}

        {activeSection === 'recommendations' && result && (
          <RecommendationsSection recommendations={result.recommendations} />
        )}

        {activeSection === 'trends' && result && (
          <PriceTrendsSection trends={result.priceTrends} />
        )}

        {activeSection === 'risks' && result && (
          <RiskAlertsSection alerts={result.riskAlerts} />
        )}

        {activeSection === 'insights' && result && (
          <MarketInsightsSection insights={result.marketInsights} />
        )}

        {/* Empty State */}
        {!enrichmentResult && !result && !isAnalyzing && !isEnriching && (
          <div className="text-center py-8 text-gray-400">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-300" />
            <p className="text-sm mb-1">No intelligence data yet</p>
            <p className="text-xs">
              Click "Enrich Profile" to find addresses, websites, and
              certifications, or "Full Analysis" for complete procurement
              insights
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUPPLIER ENRICHMENT SECTION
// ============================================================================

function SupplierEnrichmentSection({
  enrichment,
  isApplying,
  onApply,
}: {
  enrichment: SupplierEnrichmentResult;
  isApplying: boolean;
  onApply: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Apply Button */}
      <div className="flex justify-end">
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
          Apply to Supplier
        </button>
      </div>

      {/* Website */}
      {enrichment.website && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-3">
          <Globe className="w-4 h-4 text-gray-400" />
          <a
            href={enrichment.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {enrichment.website}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Addresses */}
      {enrichment.addresses && enrichment.addresses.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Locations Found ({enrichment.addresses.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {enrichment.addresses.map((addr, i) => {
              const TypeIcon =
                ADDRESS_TYPE_ICONS[addr.type] || MapPin;
              return (
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <TypeIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600 capitalize">
                      {addr.type}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900">{addr.line1}</div>
                  {addr.line2 && (
                    <div className="text-sm text-gray-700">{addr.line2}</div>
                  )}
                  <div className="text-sm text-gray-700">
                    {addr.city}
                    {addr.region && `, ${addr.region}`}
                  </div>
                  <div className="text-sm text-gray-700">{addr.country}</div>
                  {addr.phone && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" />
                      {addr.phone}
                    </div>
                  )}
                  {addr.email && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="w-3 h-3" />
                      {addr.email}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Business Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {enrichment.yearEstablished && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400">
              <Calendar className="w-3 h-3 inline mr-1" />
              Established
            </div>
            <div className="text-sm font-medium text-gray-900">
              {enrichment.yearEstablished}
            </div>
          </div>
        )}
        {enrichment.employeeCount && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400">
              <Users className="w-3 h-3 inline mr-1" />
              Employees
            </div>
            <div className="text-sm font-medium text-gray-900">
              {enrichment.employeeCount}
            </div>
          </div>
        )}
        {enrichment.annualRevenue && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400">Annual Revenue</div>
            <div className="text-sm font-medium text-gray-900">
              {enrichment.annualRevenue}
            </div>
          </div>
        )}
      </div>

      {/* Certifications */}
      {enrichment.certifications && enrichment.certifications.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            Certifications
          </div>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.certifications.map((cert, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded font-medium"
              >
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Brands */}
      {enrichment.brands && enrichment.brands.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Brands Distributed
          </div>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.brands.map((brand, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Specializations */}
      {enrichment.specializations && enrichment.specializations.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Specializations
          </div>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.specializations.map((spec, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Service Areas */}
      {enrichment.serviceAreas && enrichment.serviceAreas.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Service Areas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.serviceAreas.map((area, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {enrichment.reviews && enrichment.reviews.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Online Reviews
          </div>
          <div className="flex flex-wrap gap-3">
            {enrichment.reviews.map((review, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
              >
                <Star className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {review.rating}/5
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {review.reviewCount} reviews on {review.source}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social Media */}
      {enrichment.socialMedia && enrichment.socialMedia.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Social Media
          </div>
          <div className="flex flex-wrap gap-2">
            {enrichment.socialMedia.map((social, i) => (
              <a
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-primary capitalize"
              >
                <Globe className="w-3 h-3" />
                {social.platform}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* News Alerts */}
      {enrichment.newsAlerts && enrichment.newsAlerts.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">
            Recent News
          </div>
          <div className="space-y-2">
            {enrichment.newsAlerts.map((news, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-lg border text-xs ${
                  news.sentiment === 'positive'
                    ? 'bg-green-50 border-green-100 text-green-800'
                    : news.sentiment === 'negative'
                      ? 'bg-red-50 border-red-100 text-red-800'
                      : 'bg-gray-50 border-gray-100 text-gray-800'
                }`}
              >
                <div className="font-medium">{news.title}</div>
                <div className="mt-0.5 opacity-75">{news.summary}</div>
                <div className="mt-1 text-[10px] opacity-50">{news.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RECOMMENDATIONS SECTION
// ============================================================================

function RecommendationsSection({
  recommendations,
}: {
  recommendations: ProcurementRecommendation[];
}) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No procurement recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, i) => {
        const actionConfig = ACTION_CONFIG[rec.action];
        return (
          <div
            key={i}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${actionConfig.bg} ${actionConfig.text}`}
                >
                  {actionConfig.label}
                </span>
                <span className="text-xs text-gray-400">
                  {rec.confidence}% confidence
                </span>
              </div>
              {rec.potentialSavings && (
                <span className="text-xs font-medium text-green-600">
                  Save {rec.potentialSavings.percentage}% (
                  {rec.potentialSavings.amount.toLocaleString()}{' '}
                  {rec.potentialSavings.currency})
                </span>
              )}
            </div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              {rec.itemName}
            </h4>
            <p className="text-xs text-gray-500 mb-2">{rec.reason}</p>
            {rec.action === 'switch' && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{rec.currentSupplierName}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium text-primary">
                  {rec.recommendedSupplierName}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// PRICE TRENDS SECTION
// ============================================================================

function PriceTrendsSection({ trends }: { trends: PriceTrendAnalysis[] }) {
  if (!trends || trends.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No price trend data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trends.map((trend, i) => {
        const TrendIcon =
          trend.trend === 'rising'
            ? TrendingUp
            : trend.trend === 'falling'
              ? TrendingDown
              : Minus;
        const trendColor =
          trend.trend === 'rising'
            ? 'text-red-600'
            : trend.trend === 'falling'
              ? 'text-green-600'
              : 'text-gray-600';

        return (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">
                {trend.supplierName}
              </h4>
              <div className={`flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="w-4 h-4" />
                <span className="text-xs font-medium capitalize">
                  {trend.trend} ({trend.avgChangePercent > 0 ? '+' : ''}
                  {trend.avgChangePercent.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Simple sparkline using data points */}
            {trend.dataPoints.length > 1 && (
              <div className="flex items-end gap-0.5 h-8 mb-2">
                {trend.dataPoints.map((dp, j) => {
                  const maxPrice = Math.max(
                    ...trend.dataPoints.map((d) => d.price)
                  );
                  const height = maxPrice > 0 ? (dp.price / maxPrice) * 100 : 50;
                  return (
                    <div
                      key={j}
                      className={`flex-1 rounded-t ${
                        trend.trend === 'rising'
                          ? 'bg-red-200'
                          : trend.trend === 'falling'
                            ? 'bg-green-200'
                            : 'bg-gray-200'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${dp.date}: ${dp.price.toLocaleString()}`}
                    />
                  );
                })}
              </div>
            )}

            {trend.renegotiationWindow && (
              <div className="px-2 py-1.5 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700">
                Best time to renegotiate: {trend.renegotiationWindow}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// RISK ALERTS SECTION
// ============================================================================

function RiskAlertsSection({ alerts }: { alerts: SupplierRiskAlert[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-300" />
        <p className="text-sm text-green-600">No risk alerts</p>
        <p className="text-xs">This supplier looks good</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => {
        const severityConfig = RISK_SEVERITY[alert.severity] || RISK_SEVERITY.low;
        return (
          <div
            key={i}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert
                className={`w-4 h-4 ${
                  alert.severity === 'high'
                    ? 'text-red-500'
                    : alert.severity === 'medium'
                      ? 'text-amber-500'
                      : 'text-gray-400'
                }`}
              />
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.bg} ${severityConfig.text}`}
              >
                {alert.severity.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {RISK_TYPE_LABELS[alert.riskType] || alert.riskType}
              </span>
            </div>
            <p className="text-sm text-gray-900 mb-1">{alert.description}</p>
            <p className="text-xs text-gray-500">
              <strong>Recommendation:</strong> {alert.recommendation}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MARKET INSIGHTS SECTION
// ============================================================================

function MarketInsightsSection({ insights }: { insights: string[] }) {
  if (!insights || insights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No market insights available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800"
        >
          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {insight}
        </div>
      ))}
    </div>
  );
}
