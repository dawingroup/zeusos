/**
 * ROICalculator Component
 * Displays return-on-investment metrics and budget vs. revenue breakdown
 */

import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { MarketingCampaign } from '../../types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface ROICalculatorProps {
  campaigns: MarketingCampaign[];
}

export function ROICalculator({ campaigns }: ROICalculatorProps) {
  // Only campaigns with a budget
  const funded = campaigns.filter((c) => c.budget && c.budget > 0);

  const totalBudget = funded.reduce((s, c) => s + (c.budget || 0), 0);
  const totalReach = funded.reduce((s, c) => s + (c.metrics?.totalReached || 0), 0);
  const totalEngagements = funded.reduce((s, c) => s + (c.metrics?.totalEngagements || 0), 0);
  const totalConversions = funded.reduce((s, c) => s + (c.metrics?.totalConversions || 0), 0);

  const costPerReach = totalReach > 0 ? totalBudget / totalReach : 0;
  const costPerEngagement = totalEngagements > 0 ? totalBudget / totalEngagements : 0;
  const costPerConversion = totalConversions > 0 ? totalBudget / totalConversions : 0;

  // Average ROI from campaigns that have it
  const roiCampaigns = funded.filter((c) => c.metrics?.roi !== undefined);
  const avgROI =
    roiCampaigns.length > 0
      ? roiCampaigns.reduce((s, c) => s + (c.metrics?.roi || 0), 0) / roiCampaigns.length
      : 0;
  const isPositiveROI = avgROI >= 0;

  if (funded.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <DollarSign className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          No campaigns with budgets found. Add budgets to your campaigns to track ROI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ROI Header */}
      <div
        className={`rounded-lg border p-5 ${
          isPositiveROI
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Average Return on Investment</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {isPositiveROI ? '+' : ''}
                {(avgROI * 100).toFixed(1)}%
              </span>
              {isPositiveROI ? (
                <ArrowUpRight className="h-6 w-6 text-green-600" />
              ) : (
                <ArrowDownRight className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${isPositiveROI ? 'bg-green-100' : 'bg-red-100'}`}>
            {isPositiveROI ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600" />
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Across {funded.length} campaign{funded.length !== 1 ? 's' : ''} with budgets
        </p>
      </div>

      {/* Cost Metrics */}
      <KPIGrid cols={3}>
        <KPICard
          label="Cost per Reach"
          value={`UGX ${costPerReach > 0 ? costPerReach.toFixed(0) : '0'}`}
          delta={`${totalReach.toLocaleString()} reached`}
        />
        <KPICard
          label="Cost per Engagement"
          value={`UGX ${costPerEngagement > 0 ? costPerEngagement.toFixed(0) : '0'}`}
          delta={`${totalEngagements.toLocaleString()} engagements`}
        />
        <KPICard
          label="Cost per Conversion"
          value={`UGX ${costPerConversion > 0 ? costPerConversion.toFixed(0) : '0'}`}
          delta={`${totalConversions.toLocaleString()} conversions`}
        />
      </KPIGrid>

      {/* Budget Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Budget Summary</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Budget Allocated</span>
            <span className="font-semibold text-gray-900">
              UGX {totalBudget.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Campaigns with Budget</span>
            <span className="font-semibold text-gray-900">{funded.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Average Budget per Campaign</span>
            <span className="font-semibold text-gray-900">
              UGX {Math.round(totalBudget / funded.length).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Per-Campaign ROI */}
      {roiCampaigns.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Campaign ROI</h4>
          <div className="space-y-2">
            {roiCampaigns
              .sort((a, b) => (b.metrics?.roi || 0) - (a.metrics?.roi || 0))
              .slice(0, 5)
              .map((c) => {
                const roi = (c.metrics?.roi || 0) * 100;
                const positive = roi >= 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        Budget: UGX {(c.budget || 0).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${positive ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {positive ? '+' : ''}{roi.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ROICalculator;
