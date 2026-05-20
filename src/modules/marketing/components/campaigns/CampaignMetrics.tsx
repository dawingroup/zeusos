/**
 * CampaignMetrics Component
 * Displays real-time campaign performance metrics
 */

import type { CampaignMetrics as CampaignMetricsType } from '../../types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface CampaignMetricsProps {
  metrics: CampaignMetricsType;
  campaignType: 'whatsapp' | 'social_media' | 'product_promotion' | 'hybrid';
  showROI?: boolean;
}

export function CampaignMetrics({ metrics, campaignType, showROI = true }: CampaignMetricsProps) {
  const isWhatsAppCampaign = campaignType === 'whatsapp' || campaignType === 'hybrid';

  return (
    <div className="space-y-4">
      {/* Overview Metrics */}
      <KPIGrid cols={4}>
        <KPICard label="Total Sent" value={metrics.totalSent.toLocaleString()} />
        <KPICard
          label="Total Reached"
          value={metrics.totalReached.toLocaleString()}
          delta={`${((metrics.totalReached / metrics.totalSent) * 100 || 0).toFixed(1)}% of sent`}
        />
        <KPICard
          label="Engagements"
          value={metrics.totalEngagements.toLocaleString()}
          delta={`${(metrics.engagementRate * 100).toFixed(1)}% rate`}
        />
        <KPICard
          label="Conversions"
          value={metrics.totalConversions.toLocaleString()}
          delta={`${(metrics.conversionRate * 100).toFixed(2)}% rate`}
        />
      </KPIGrid>

      {/* WhatsApp-specific metrics */}
      {isWhatsAppCampaign && metrics.whatsappDelivered !== undefined && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">WhatsApp Metrics</h3>
          <KPIGrid cols={3}>
            <KPICard
              label="Delivered"
              value={metrics.whatsappDelivered.toLocaleString()}
              delta={`${((metrics.whatsappDelivered / metrics.totalSent) * 100 || 0).toFixed(1)}%`}
            />
            <KPICard
              label="Read"
              value={(metrics.whatsappRead || 0).toLocaleString()}
              delta={`${(((metrics.whatsappRead || 0) / metrics.whatsappDelivered) * 100 || 0).toFixed(1)}%`}
            />
            <KPICard
              label="Replied"
              value={(metrics.whatsappReplied || 0).toLocaleString()}
              delta={`${(((metrics.whatsappReplied || 0) / metrics.whatsappDelivered) * 100 || 0).toFixed(1)}%`}
            />
          </KPIGrid>
        </div>
      )}

      {/* ROI */}
      {showROI && metrics.roi !== undefined && (
        <KPICard
          label="Return on Investment"
          value={`${metrics.roi > 0 ? '+' : ''}${(metrics.roi * 100).toFixed(1)}%`}
          trend={metrics.roi >= 0 ? 'up' : 'down'}
        />
      )}
    </div>
  );
}

export default CampaignMetrics;
