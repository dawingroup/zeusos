// ============================================================================
// FACTOR CARD COMPONENT
// ZeusOS v2.0 - Market Intelligence Module
// Displays a single PESTEL factor with impact assessment
// ============================================================================

import React from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Minus,
  Clock,
  Eye,
  Edit,
  MoreVertical,
} from 'lucide-react';
import { PESTELFactor } from '../../types/scanning.types';
import {
  PESTEL_DIMENSION_CONFIG,
  IMPACT_LEVEL_CONFIG,
  PROBABILITY_LEVEL_CONFIG,
  ALERT_PRIORITY_CONFIG,
  TIME_HORIZON_CONFIG,
  AFFECTED_BUSINESS_AREA_LABELS,
  PESTELDimension,
} from '../../constants/scanning.constants';

interface FactorCardProps {
  factor: PESTELFactor;
  onSelect?: (factor: PESTELFactor) => void;
  onEdit?: (factor: PESTELFactor) => void;
  compact?: boolean;
}

export const FactorCard: React.FC<FactorCardProps> = ({
  factor,
  onSelect,
  onEdit,
  compact = false,
}) => {
  const dimensionConfig = PESTEL_DIMENSION_CONFIG[factor.dimension as PESTELDimension];
  const impactConfig = IMPACT_LEVEL_CONFIG[factor.impact.level];
  const probabilityConfig = PROBABILITY_LEVEL_CONFIG[factor.impact.probability];
  const priorityConfig = ALERT_PRIORITY_CONFIG[factor.watchPriority];
  const timeConfig = TIME_HORIZON_CONFIG[factor.impact.timeToImpact];

  const getTypeIcon = () => {
    switch (factor.type) {
      case 'opportunity':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'threat':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeColor = () => {
    switch (factor.type) {
      case 'opportunity':
        return 'bg-green-50 border-green-200';
      case 'threat':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-[var(--bg-sunken)] border-[var(--border-subtle)]';
    }
  };

  if (compact) {
    return (
      <div
        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${getTypeColor()}`}
        onClick={() => onSelect?.(factor)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: dimensionConfig?.color || '#666' }}
            />
            {getTypeIcon()}
            <span className="font-medium text-sm text-foreground line-clamp-1">
              {factor.title}
            </span>
          </div>
          <div
            className="px-1.5 py-0.5 text-xs font-medium rounded"
            style={{
              backgroundColor: `${impactConfig?.color}20`,
              color: impactConfig?.color,
            }}
          >
            {factor.impact.riskScore}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border transition-all hover:shadow-md ${getTypeColor()}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                style={{ backgroundColor: dimensionConfig?.color || '#666' }}
              >
                {dimensionConfig?.label || factor.dimension}
              </span>
              <span className="text-xs text-muted-foreground">{factor.subFactor}</span>
            </div>
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              {getTypeIcon()}
              {factor.title}
            </h4>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(factor);
              }}
              className="p-1.5 text-[var(--fg-tertiary)] hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(factor);
              }}
              className="p-1.5 text-[var(--fg-tertiary)] hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[var(--fg-tertiary)] hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {factor.description}
        </p>
      </div>

      {/* Impact Assessment */}
      <div className="p-4 grid grid-cols-4 gap-3">
        {/* Risk Score */}
        <div className="text-center">
          <div
            className="text-2xl font-bold"
            style={{ color: impactConfig?.color }}
          >
            {factor.impact.riskScore}
          </div>
          <div className="text-xs text-muted-foreground">Risk Score</div>
        </div>

        {/* Impact Level */}
        <div className="text-center">
          <div
            className="inline-block px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: `${impactConfig?.color}20`,
              color: impactConfig?.color,
            }}
          >
            {impactConfig?.label || factor.impact.level}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Impact</div>
        </div>

        {/* Probability */}
        <div className="text-center">
          <div className="text-sm font-medium text-muted-foreground">
            {probabilityConfig?.percentage || factor.impact.probability}
          </div>
          <div className="text-xs text-muted-foreground">Probability</div>
        </div>

        {/* Time Horizon */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timeConfig?.label || factor.impact.timeToImpact}
          </div>
          <div className="text-xs text-muted-foreground">Timeline</div>
        </div>
      </div>

      {/* Affected Areas */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-1">
          {factor.affectedAreas.slice(0, 4).map((area) => (
            <span
              key={area}
              className="px-2 py-0.5 text-xs bg-[var(--bg-sunken)] text-muted-foreground rounded"
            >
              {AFFECTED_BUSINESS_AREA_LABELS[area] || area}
            </span>
          ))}
          {factor.affectedAreas.length > 4 && (
            <span className="px-2 py-0.5 text-xs bg-[var(--bg-sunken)] text-muted-foreground rounded">
              +{factor.affectedAreas.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-[var(--bg-sunken)] border-t border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: priorityConfig?.color }}
          />
          <span className="text-xs text-muted-foreground">
            {priorityConfig?.label} Priority
          </span>
        </div>
        {factor.evidence.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {factor.evidence.length} evidence items
          </span>
        )}
      </div>
    </div>
  );
};

export default FactorCard;
