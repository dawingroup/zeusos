// ============================================================================
// COMPETITOR CARD
// DawinOS v2.0 - Market Intelligence Module
// Displays competitor summary in card format
// ============================================================================

import React from 'react';
import {
  Building2,
  MapPin,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Edit,
} from 'lucide-react';
import { Competitor } from '../../types/competitor.types';
import {
  COMPETITOR_TYPE_LABELS,
  COMPETITOR_TYPE_COLORS,
  THREAT_LEVEL_LABELS,
  THREAT_LEVEL_COLORS,
  COMPETITOR_STATUS_LABELS,
  INDUSTRY_LABELS,
  GEOGRAPHY_LABELS,
  CompetitorType,
  ThreatLevel,
  CompetitorStatus,
  Industry,
  Geography,
} from '../../constants/competitor.constants';

interface CompetitorCardProps {
  competitor: Competitor;
  onSelect?: (competitor: Competitor) => void;
  onEdit?: (competitor: Competitor) => void;
  compact?: boolean;
}

const formatCurrency = (amount: number | undefined, currency = 'USD'): string => {
  if (!amount) return 'N/A';
  if (amount >= 1000000000) {
    return `${currency} ${(amount / 1000000000).toFixed(1)}B`;
  }
  if (amount >= 1000000) {
    return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${currency} ${(amount / 1000).toFixed(0)}K`;
  }
  return `${currency} ${amount}`;
};

export const CompetitorCard: React.FC<CompetitorCardProps> = ({
  competitor,
  onSelect,
  onEdit,
  compact = false,
}) => {
  const typeColor = COMPETITOR_TYPE_COLORS[competitor.type as CompetitorType];
  const threatColor = THREAT_LEVEL_COLORS[competitor.threatLevel as ThreatLevel];
  const isHighThreat = competitor.threatLevel === 'high' || competitor.threatLevel === 'critical';

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isHighThreat ? 'border-red-200' : 'border-gray-200'
      }`}
      onClick={() => onSelect?.(competitor)}
    >
      {/* Threat Level Bar */}
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: threatColor }}
      />

      <div className={compact ? 'p-3' : 'p-4'}>
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-start gap-3">
            {competitor.logoUrl ? (
              <img
                src={competitor.logoUrl}
                alt={competitor.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{competitor.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="px-1.5 py-0.5 text-xs font-medium rounded"
                  style={{
                    backgroundColor: `${typeColor}20`,
                    color: typeColor,
                  }}
                >
                  {COMPETITOR_TYPE_LABELS[competitor.type as CompetitorType]}
                </span>
                <span className="text-xs text-gray-500">
                  {COMPETITOR_STATUS_LABELS[competitor.status as CompetitorStatus]}
                </span>
              </div>
            </div>
          </div>

          {/* Threat Level Badge */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${threatColor}15`,
              color: threatColor,
            }}
          >
            {isHighThreat && <AlertTriangle className="w-3 h-3" />}
            {THREAT_LEVEL_LABELS[competitor.threatLevel as ThreatLevel]}
          </div>
        </div>

        {/* Description */}
        {!compact && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {competitor.description}
          </p>
        )}

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{competitor.headquarters.city}, {competitor.headquarters.country}</span>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(competitor.estimatedRevenue, competitor.revenueCurrency)}
            </p>
            <p className="text-xs text-gray-500">Revenue</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-sm font-semibold text-gray-900">
              {competitor.employeeCount?.toLocaleString() || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">Employees</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-sm font-semibold text-gray-900">
              {competitor.estimatedMarketShare ? `${competitor.estimatedMarketShare}%` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">Market Share</p>
          </div>
        </div>

        {/* Industries */}
        {!compact && competitor.industries.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Industries</p>
            <div className="flex flex-wrap gap-1">
              {competitor.industries.slice(0, 3).map((ind) => (
                <span
                  key={ind}
                  className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                >
                  {INDUSTRY_LABELS[ind as Industry]}
                </span>
              ))}
              {competitor.industries.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-gray-500">
                  +{competitor.industries.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Geographies */}
        {!compact && competitor.geographies.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Markets</p>
            <div className="flex flex-wrap gap-1">
              {competitor.geographies.slice(0, 4).map((geo) => (
                <span
                  key={geo}
                  className="px-1.5 py-0.5 text-xs bg-green-50 text-green-700 rounded"
                >
                  {GEOGRAPHY_LABELS[geo as Geography]}
                </span>
              ))}
              {competitor.geographies.length > 4 && (
                <span className="px-1.5 py-0.5 text-xs text-gray-500">
                  +{competitor.geographies.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Competing Subsidiaries */}
        {competitor.subsidiariesCompeting.length > 0 && (
          <div className="text-xs text-gray-500">
            <span className="font-medium">Competes with: </span>
            {competitor.subsidiariesCompeting.join(', ')}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-lg">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{competitor.keyExecutives.length} execs</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>{competitor.intelligenceSources.length} intel</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(competitor);
              }}
              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export default CompetitorCard;
