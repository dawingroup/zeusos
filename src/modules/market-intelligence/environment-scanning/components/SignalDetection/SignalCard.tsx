// ============================================================================
// SIGNAL CARD COMPONENT
// ZeusOS v2.0 - Market Intelligence Module
// Displays a single environment signal with assessment details
// ============================================================================

import React from 'react';
import {
  Radio,
  Activity,
  Zap,
  Clock,
  Eye,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { EnvironmentSignal } from '../../types/scanning.types';
import {
  SIGNAL_TYPE_CONFIG,
  SIGNAL_SOURCE_CONFIG,
  SIGNAL_STATUS_CONFIG,
  PESTEL_DIMENSION_CONFIG,
  IMPACT_LEVEL_CONFIG,
  TIME_HORIZON_CONFIG,
  AFFECTED_BUSINESS_AREA_LABELS,
  SignalType,
  SignalSource,
  SignalStatus,
  PESTELDimension,
} from '../../constants/scanning.constants';

interface SignalCardProps {
  signal: EnvironmentSignal;
  onSelect?: (signal: EnvironmentSignal) => void;
  onStatusChange?: (signal: EnvironmentSignal, newStatus: SignalStatus) => void;
  compact?: boolean;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  onSelect,
  onStatusChange: _onStatusChange,
  compact = false,
}) => {
  const typeConfig = SIGNAL_TYPE_CONFIG[signal.signalType as SignalType];
  const sourceConfig = SIGNAL_SOURCE_CONFIG[signal.source as SignalSource];
  const statusConfig = SIGNAL_STATUS_CONFIG[signal.status as SignalStatus];
  const dimensionConfig = PESTEL_DIMENSION_CONFIG[signal.pestelDimension as PESTELDimension];
  const impactConfig = IMPACT_LEVEL_CONFIG[signal.assessment.impactLevel];
  const timeConfig = TIME_HORIZON_CONFIG[signal.assessment.timeToImpact];

  const getSignalIcon = () => {
    switch (signal.signalType) {
      case 'weak':
        return <Radio className="w-4 h-4" />;
      case 'moderate':
        return <Activity className="w-4 h-4" />;
      case 'strong':
        return <Zap className="w-4 h-4" />;
      default:
        return <Radio className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-blue-600';
    if (confidence >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (compact) {
    return (
      <div
        className="p-3 bg-card rounded-lg border border-[var(--border-subtle)] cursor-pointer hover:shadow-md transition-all"
        onClick={() => onSelect?.(signal)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded"
              style={{ backgroundColor: `${typeConfig?.color}20` }}
            >
              <span style={{ color: typeConfig?.color }}>{getSignalIcon()}</span>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground line-clamp-1">
                {signal.title}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: dimensionConfig?.color }}
                />
                <span className="text-xs text-muted-foreground">{sourceConfig?.label}</span>
              </div>
            </div>
          </div>
          <span
            className="px-2 py-0.5 text-xs font-medium rounded-full"
            style={{
              backgroundColor: `${statusConfig?.color}20`,
              color: statusConfig?.color,
            }}
          >
            {statusConfig?.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-[var(--border-subtle)] hover:shadow-md transition-all">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${typeConfig?.color}20` }}
            >
              <span style={{ color: typeConfig?.color }}>{getSignalIcon()}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full"
                  style={{
                    backgroundColor: typeConfig?.color,
                    color: 'white',
                  }}
                >
                  {typeConfig?.label}
                </span>
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: dimensionConfig?.color }}
                >
                  {dimensionConfig?.label}
                </span>
              </div>
              <h4 className="font-semibold text-foreground">{signal.title}</h4>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {signal.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(signal);
              }}
              className="p-1.5 text-[var(--fg-tertiary)] hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[var(--fg-tertiary)] hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Source Info */}
      <div className="px-4 py-3 bg-[var(--bg-sunken)] border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Source:</span>
            <span className="text-sm font-medium text-muted-foreground">{signal.sourceDetails.name}</span>
            {signal.sourceDetails.url && (
              <a
                href={signal.sourceDetails.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${
                sourceConfig?.reliability === 'high' ? 'bg-green-500' :
                sourceConfig?.reliability === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-muted-foreground">{sourceConfig?.reliability} reliability</span>
          </div>
        </div>
        <span
          className="px-2 py-1 text-xs font-medium rounded"
          style={{
            backgroundColor: `${statusConfig?.color}20`,
            color: statusConfig?.color,
          }}
        >
          {statusConfig?.label}
        </span>
      </div>

      {/* Assessment */}
      <div className="p-4 grid grid-cols-4 gap-4">
        <div className="text-center">
          <div
            className="text-lg font-bold"
            style={{ color: impactConfig?.color }}
          >
            {impactConfig?.label}
          </div>
          <div className="text-xs text-muted-foreground">Impact</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">
            {signal.assessment.strengthScore}/10
          </div>
          <div className="text-xs text-muted-foreground">Strength</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${getConfidenceColor(signal.assessment.confidenceLevel)}`}>
            {signal.assessment.confidenceLevel}%
          </div>
          <div className="text-xs text-muted-foreground">Confidence</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">{timeConfig?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">Timeline</div>
        </div>
      </div>

      {/* Implications Preview */}
      {(signal.implications.opportunities.length > 0 || signal.implications.threats.length > 0) && (
        <div className="px-4 pb-4 flex gap-4">
          {signal.implications.opportunities.length > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">{signal.implications.opportunities.length} opportunities</span>
            </div>
          )}
          {signal.implications.threats.length > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{signal.implications.threats.length} threats</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-[var(--bg-sunken)] border-t border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {signal.affectedAreas.slice(0, 3).map((area) => (
            <span
              key={area}
              className="px-2 py-0.5 text-xs bg-[var(--bg-sunken)] text-muted-foreground rounded"
            >
              {AFFECTED_BUSINESS_AREA_LABELS[area] || area}
            </span>
          ))}
          {signal.affectedAreas.length > 3 && (
            <span className="px-2 py-0.5 text-xs bg-[var(--bg-sunken)] text-muted-foreground rounded">
              +{signal.affectedAreas.length - 3}
            </span>
          )}
        </div>
        {signal.actionItems.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {signal.actionItems.filter(a => a.status === 'pending').length} pending actions
          </span>
        )}
      </div>
    </div>
  );
};

export default SignalCard;
