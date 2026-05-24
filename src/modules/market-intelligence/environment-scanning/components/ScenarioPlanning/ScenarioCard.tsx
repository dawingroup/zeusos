// ============================================================================
// SCENARIO CARD COMPONENT
// ZeusOS v2.0 - Market Intelligence Module
// Displays a single scenario with key metrics
// ============================================================================

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  HelpCircle,
  Target,
  Clock,
  Eye,
  MoreVertical,
  CheckCircle,
} from 'lucide-react';
import { Scenario } from '../../types/scanning.types';
import {
  SCENARIO_TYPE_CONFIG,
  TIME_HORIZON_CONFIG,
  ScenarioType,
  TimeHorizon,
} from '../../constants/scanning.constants';

interface ScenarioCardProps {
  scenario: Scenario;
  onSelect?: (scenario: Scenario) => void;
  compact?: boolean;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  onSelect,
  compact = false,
}) => {
  const typeConfig = SCENARIO_TYPE_CONFIG[scenario.type as ScenarioType];
  const timeConfig = TIME_HORIZON_CONFIG[scenario.scope.timeHorizon as TimeHorizon];

  const getTypeIcon = () => {
    switch (scenario.type) {
      case 'optimistic':
        return <TrendingUp className="w-4 h-4" />;
      case 'pessimistic':
        return <TrendingDown className="w-4 h-4" />;
      case 'disruptive':
        return <Zap className="w-4 h-4" />;
      case 'black_swan':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  const triggeredSignposts = scenario.signposts.filter(s => s.status === 'triggered').length;
  const approachingSignposts = scenario.signposts.filter(s => s.status === 'approaching').length;

  const formatImpact = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (compact) {
    return (
      <div
        className="p-3 bg-card rounded-lg border border-[var(--border-subtle)] cursor-pointer hover:shadow-md transition-all"
        onClick={() => onSelect?.(scenario)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded"
              style={{ backgroundColor: `${typeConfig?.color}20` }}
            >
              <span style={{ color: typeConfig?.color }}>{getTypeIcon()}</span>
            </div>
            <div>
              <h4 className="font-medium text-sm text-foreground line-clamp-1">
                {scenario.title}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{typeConfig?.label}</span>
                <span className="text-xs font-medium text-[var(--rag-blue)]">
                  {scenario.probability}% likely
                </span>
              </div>
            </div>
          </div>
          <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded ${
              scenario.status === 'approved' ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' :
              scenario.status === 'under_review' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' :
              'bg-[var(--bg-sunken)] text-muted-foreground'
            }`}
          >
            {scenario.status}
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
              <span style={{ color: typeConfig?.color }}>{getTypeIcon()}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: typeConfig?.color }}
                >
                  {typeConfig?.label}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    scenario.status === 'approved' ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' :
                    scenario.status === 'under_review' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' :
                    'bg-[var(--bg-sunken)] text-muted-foreground'
                  }`}
                >
                  {scenario.status}
                </span>
              </div>
              <h4 className="font-semibold text-foreground">{scenario.title}</h4>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {scenario.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(scenario);
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

      {/* Probability & Timeline */}
      <div className="px-4 py-3 bg-[var(--bg-sunken)] border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl font-bold text-[var(--rag-blue)]">{scenario.probability}%</div>
            <div className="text-xs text-muted-foreground">Probability</div>
          </div>
          <div className="h-8 w-px bg-[var(--bg-sunken)]" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--fg-tertiary)]" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">{timeConfig?.label}</div>
              <div className="text-xs text-muted-foreground">Target: {scenario.scope.targetYear}</div>
            </div>
          </div>
        </div>
        {/* Signpost Status */}
        {scenario.signposts.length > 0 && (
          <div className="flex items-center gap-2">
            {triggeredSignposts > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-[var(--rag-red-soft)] text-[var(--rag-red)] rounded text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                {triggeredSignposts} triggered
              </span>
            )}
            {approachingSignposts > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] rounded text-xs font-medium">
                <Target className="w-3 h-3" />
                {approachingSignposts} approaching
              </span>
            )}
          </div>
        )}
      </div>

      {/* Business Impact */}
      {scenario.businessImpact && (
        <div className="p-4 grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-lg font-bold ${
              scenario.businessImpact.revenueImpact >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
            }`}>
              {formatImpact(scenario.businessImpact.revenueImpact)}
            </div>
            <div className="text-xs text-muted-foreground">Revenue</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              scenario.businessImpact.costImpact <= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
            }`}>
              {formatImpact(scenario.businessImpact.costImpact)}
            </div>
            <div className="text-xs text-muted-foreground">Costs</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              scenario.businessImpact.marketShareImpact >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
            }`}>
              {formatImpact(scenario.businessImpact.marketShareImpact)}
            </div>
            <div className="text-xs text-muted-foreground">Market Share</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              scenario.businessImpact.employmentImpact >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
            }`}>
              {formatImpact(scenario.businessImpact.employmentImpact)}
            </div>
            <div className="text-xs text-muted-foreground">Employment</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-[var(--bg-sunken)] border-t border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{scenario.drivingForces.length} driving forces</span>
          <span>{scenario.assumptions.length} assumptions</span>
          <span>{scenario.strategicOptions.length} strategic options</span>
        </div>
        {scenario.status === 'approved' && scenario.approvedBy && (
          <div className="flex items-center gap-1 text-xs text-[var(--rag-green)]">
            <CheckCircle className="w-3 h-3" />
            Approved
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioCard;
