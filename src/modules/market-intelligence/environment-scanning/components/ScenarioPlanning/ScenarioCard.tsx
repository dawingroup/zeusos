// ============================================================================
// SCENARIO CARD COMPONENT
// DawinOS v2.0 - Market Intelligence Module
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
        className="p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-all"
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
              <h4 className="font-medium text-sm text-gray-900 line-clamp-1">
                {scenario.title}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{typeConfig?.label}</span>
                <span className="text-xs font-medium text-blue-600">
                  {scenario.probability}% likely
                </span>
              </div>
            </div>
          </div>
          <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded ${
              scenario.status === 'approved' ? 'bg-green-100 text-green-700' :
              scenario.status === 'under_review' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}
          >
            {scenario.status}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
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
                    scenario.status === 'approved' ? 'bg-green-100 text-green-700' :
                    scenario.status === 'under_review' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}
                >
                  {scenario.status}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900">{scenario.title}</h4>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
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
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Probability & Timeline */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">{scenario.probability}%</div>
            <div className="text-xs text-gray-500">Probability</div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-700">{timeConfig?.label}</div>
              <div className="text-xs text-gray-500">Target: {scenario.scope.targetYear}</div>
            </div>
          </div>
        </div>
        {/* Signpost Status */}
        {scenario.signposts.length > 0 && (
          <div className="flex items-center gap-2">
            {triggeredSignposts > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                {triggeredSignposts} triggered
              </span>
            )}
            {approachingSignposts > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
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
              scenario.businessImpact.revenueImpact >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatImpact(scenario.businessImpact.revenueImpact)}
            </div>
            <div className="text-xs text-gray-500">Revenue</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              scenario.businessImpact.costImpact <= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatImpact(scenario.businessImpact.costImpact)}
            </div>
            <div className="text-xs text-gray-500">Costs</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              scenario.businessImpact.marketShareImpact >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatImpact(scenario.businessImpact.marketShareImpact)}
            </div>
            <div className="text-xs text-gray-500">Market Share</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              scenario.businessImpact.employmentImpact >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatImpact(scenario.businessImpact.employmentImpact)}
            </div>
            <div className="text-xs text-gray-500">Employment</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{scenario.drivingForces.length} driving forces</span>
          <span>{scenario.assumptions.length} assumptions</span>
          <span>{scenario.strategicOptions.length} strategic options</span>
        </div>
        {scenario.status === 'approved' && scenario.approvedBy && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            Approved
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioCard;
