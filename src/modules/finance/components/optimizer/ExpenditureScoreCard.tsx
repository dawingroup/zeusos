// ============================================================================
// EXPENDITURE SCORE CARD
// Radar chart + tier badge + 6-dimension score breakdown for a single item
// Also: CostBreakdownPanel, CrossLinksPanel, CommitmentBadge
// ============================================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { Card } from '@/core/components/ui/card';
import {
  User,
  Palette,
  Factory,
  FileText,
  Truck,
  Box,
  Briefcase,
  Layers,
  ExternalLink,
} from 'lucide-react';
import type {
  ExpenditureItem,
  ExpenditureScores,
  ItemCostBreakdown,
  ExpenditureCrossLinks,
  CommitmentLevel,
} from '../../types/optimizer.types';
import { PRIORITY_TIER_COLORS, PRIORITY_TIER_LABELS } from '../../constants/optimizer.constants';

// ────────────────────────────────────────────────────────────────────────────
// TIER BADGE
// ────────────────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: ExpenditureItem['priorityTier'] }) {
  const color = PRIORITY_TIER_COLORS[tier];
  const label = PRIORITY_TIER_LABELS[tier];

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COMMITMENT BADGE
// ────────────────────────────────────────────────────────────────────────────

const COMMITMENT_STYLES: Record<CommitmentLevel, { label: string; bg: string; text: string }> = {
  committed: { label: 'Committed', bg: 'bg-green-50', text: 'text-green-700' },
  probable: { label: 'Probable', bg: 'bg-amber-50', text: 'text-amber-700' },
  projected: { label: 'Probable', bg: 'bg-amber-50', text: 'text-amber-700' }, // legacy → probable
  approved: { label: 'Committed', bg: 'bg-green-50', text: 'text-green-700' }, // legacy → committed
};

function CommitmentBadge({ level }: { level: CommitmentLevel }) {
  const style = COMMITMENT_STYLES[level] || COMMITMENT_STYLES.probable;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COST BREAKDOWN PANEL
// ────────────────────────────────────────────────────────────────────────────

const COST_COMPONENTS: {
  key: keyof Pick<ItemCostBreakdown, 'materialsCost' | 'laborCost' | 'processingCost' | 'logisticsCost' | 'subcontractorCost'>;
  label: string;
  color: string;
}[] = [
  { key: 'materialsCost', label: 'Materials', color: '#3B82F6' },
  { key: 'laborCost', label: 'Labor', color: '#8B5CF6' },
  { key: 'processingCost', label: 'Processing', color: '#F59E0B' },
  { key: 'logisticsCost', label: 'Logistics', color: '#10B981' },
  { key: 'subcontractorCost', label: 'Subcontractor', color: '#EF4444' },
];

const CONFIDENCE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  estimated: { label: 'Estimated', bg: 'bg-gray-100', text: 'text-gray-600' },
  quoted: { label: 'Quoted', bg: 'bg-blue-100', text: 'text-blue-700' },
  actual: { label: 'Actual', bg: 'bg-green-100', text: 'text-green-700' },
};

function CostBreakdownPanel({ breakdown }: { breakdown: ItemCostBreakdown }) {
  const nonZeroComponents = COST_COMPONENTS.filter(c => breakdown[c.key] > 0);
  const total = breakdown.totalPureCost || 1;
  const confidence = CONFIDENCE_STYLES[breakdown.confidenceLevel] || CONFIDENCE_STYLES.estimated;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Cost Breakdown</h5>
        <span className={`text-xs px-1.5 py-0.5 rounded ${confidence.bg} ${confidence.text}`}>
          {confidence.label}
        </span>
      </div>

      {/* Stacked bar */}
      {nonZeroComponents.length > 0 && (
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
          {nonZeroComponents.map(c => {
            const pct = (breakdown[c.key] / total) * 100;
            return (
              <div
                key={c.key}
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: c.color }}
                title={`${c.label}: ${formatUGX(breakdown[c.key])} (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Component list */}
      <div className="space-y-1.5">
        {nonZeroComponents.map(c => (
          <div key={c.key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="text-gray-600">{c.label}</span>
            </div>
            <span className="font-medium text-gray-900">{formatUGX(breakdown[c.key])}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
          <span className="font-semibold text-gray-700">Total Pure Cost</span>
          <span className="font-semibold text-gray-900">{formatUGX(breakdown.totalPureCost)}</span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CROSS-LINKS PANEL
// ────────────────────────────────────────────────────────────────────────────

interface LinkConfig {
  idKey: keyof ExpenditureCrossLinks;
  nameKey: keyof ExpenditureCrossLinks;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: (links: ExpenditureCrossLinks) => string;
}

const LINK_CONFIGS: LinkConfig[] = [
  {
    idKey: 'customerId',
    nameKey: 'customerName',
    label: 'Customer',
    icon: User,
    route: (l) => `/customers/${l.customerId}`,
  },
  {
    idKey: 'designProjectId',
    nameKey: 'designProjectName',
    label: 'Design Project',
    icon: Palette,
    route: (l) => `/design/project/${l.designProjectId}`,
  },
  {
    idKey: 'designItemId',
    nameKey: 'designItemName',
    label: 'Design Item',
    icon: Layers,
    route: (l) => `/design/project/${l.designProjectId}/item/${l.designItemId}`,
  },
  {
    idKey: 'manufacturingOrderId',
    nameKey: 'manufacturingOrderRef',
    label: 'Manufacturing Order',
    icon: Factory,
    route: (l) => `/manufacturing/orders/${l.manufacturingOrderId}`,
  },
  {
    idKey: 'purchaseOrderId',
    nameKey: 'purchaseOrderRef',
    label: 'Purchase Order',
    icon: FileText,
    route: (l) => `/manufacturing/purchase-orders/${l.purchaseOrderId}`,
  },
  {
    idKey: 'supplierId',
    nameKey: 'supplierName',
    label: 'Supplier',
    icon: Truck,
    route: (l) => `/suppliers/${l.supplierId}`,
  },
  {
    idKey: 'assetId',
    nameKey: 'assetName',
    label: 'Asset',
    icon: Box,
    route: (l) => `/assets/${l.assetId}`,
  },
  {
    idKey: 'dealId',
    nameKey: 'dealName',
    label: 'CRM Deal',
    icon: Briefcase,
    route: (l) => `/crm/deals/${l.dealId}`,
  },
];

function CrossLinksPanel({ crossLinks }: { crossLinks: ExpenditureCrossLinks }) {
  const navigate = useNavigate();
  const availableLinks = LINK_CONFIGS.filter(c => crossLinks[c.idKey]);

  if (availableLinks.length === 0) return null;

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Related Entities</h5>
      <div className="space-y-1">
        {availableLinks.map(config => {
          const Icon = config.icon;
          const name = (crossLinks[config.nameKey] as string) || crossLinks[config.idKey] as string;

          // Don't render design item link without design project
          if (config.idKey === 'designItemId' && !crossLinks.designProjectId) return null;

          return (
            <button
              key={config.idKey}
              onClick={() => navigate(config.route(crossLinks))}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 text-left rounded-md hover:bg-gray-50 transition-colors group"
            >
              <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500">{config.label}</span>
                <p className="text-sm text-gray-800 truncate">{name}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SCORE CARD
// ────────────────────────────────────────────────────────────────────────────

interface ExpenditureScoreCardProps {
  item: ExpenditureItem;
  compact?: boolean;
  className?: string;
}

const DIMENSION_LABELS: Record<keyof ExpenditureScores, string> = {
  urgencyScore: 'Urgency',
  revenueUnlockScore: 'Revenue Unlock',
  riskScore: 'Risk',
  cashPositionScore: 'Cash Position',
  relationshipScore: 'Relationship',
  operationalScore: 'Operational',
};

function formatUGX(value: number): string {
  return `UGX ${value.toLocaleString('en-UG')}`;
}

export function ExpenditureScoreCard({
  item,
  compact = false,
  className = '',
}: ExpenditureScoreCardProps) {
  const radarData = useMemo(() => {
    if (!item.scores) return [];
    return (Object.keys(DIMENSION_LABELS) as (keyof ExpenditureScores)[]).map(key => ({
      dimension: DIMENSION_LABELS[key],
      score: item.scores[key] || 0,
      fullMark: 100,
    }));
  }, [item.scores]);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <TierBadge tier={item.priorityTier} />
        <span className="text-sm font-bold" style={{ color: PRIORITY_TIER_COLORS[item.priorityTier] }}>
          {item.compositeScore.toFixed(0)}
        </span>
        <span className="text-sm text-gray-600 truncate flex-1">{item.description}</span>
        <span className="text-sm font-medium text-gray-900">{formatUGX(item.amountUGX)}</span>
      </div>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">{item.description}</h4>
          {item.vendor && (
            <p className="text-xs text-gray-500 mt-0.5">{item.vendor}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {item.commitmentLevel && <CommitmentBadge level={item.commitmentLevel} />}
          <TierBadge tier={item.priorityTier} />
        </div>
      </div>

      {/* Composite Score */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="text-2xl font-bold"
          style={{ color: PRIORITY_TIER_COLORS[item.priorityTier] }}
        >
          {item.compositeScore.toFixed(0)}
        </div>
        <span className="text-xs text-gray-500">/100</span>
        <div className="flex-1" />
        <span className="text-sm font-semibold text-gray-900">{formatUGX(item.amountUGX)}</span>
      </div>

      {/* Radar Chart */}
      {radarData.length > 0 && (
        <div className="h-48">
          <SafeResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fontSize: 10, fill: '#6B7280' }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="score"
                stroke={PRIORITY_TIER_COLORS[item.priorityTier]}
                fill={PRIORITY_TIER_COLORS[item.priorityTier]}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </SafeResponsiveContainer>
        </div>
      )}

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
        {radarData.map(d => (
          <div key={d.dimension} className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{d.dimension}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${d.score}%`,
                    backgroundColor: PRIORITY_TIER_COLORS[item.priorityTier],
                  }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 w-6 text-right">
                {d.score.toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Metadata */}
      {(item.projectName || item.category) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {item.projectName && (
            <span className="text-xs text-gray-400 truncate">{item.projectName}</span>
          )}
          {item.category && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {item.category}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

export { TierBadge, CommitmentBadge, CostBreakdownPanel, CrossLinksPanel, formatUGX };
export default ExpenditureScoreCard;
