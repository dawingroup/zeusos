/**
 * PredictionPanel Component
 * Displays AI predictions with visualizations
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Target,
  Activity,
} from 'lucide-react';
import {
  AIPrediction,
  ProjectHealthAnalysis,
  DealScoring,
  DimensionHealth,
  PredictionFactor,
} from '../types/ai-extensions';

interface PredictionPanelProps {
  prediction: AIPrediction;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const PredictionPanel: React.FC<PredictionPanelProps> = ({
  prediction,
  onRefresh,
  isRefreshing = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const probabilityColor =
    prediction.probability >= 0.7
      ? 'text-green-600'
      : prediction.probability >= 0.4
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{prediction.type.replace(/_/g, ' ')}</h4>
              <p className="text-sm text-gray-600 mt-0.5">{prediction.prediction}</p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Probability */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Probability</span>
            <span className={`text-lg font-semibold ${probabilityColor}`}>
              {Math.round(prediction.probability * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                prediction.probability >= 0.7
                  ? 'bg-green-500'
                  : prediction.probability >= 0.4
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${prediction.probability * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{Math.round(prediction.confidenceInterval[0] * 100)}%</span>
            <span>{Math.round(prediction.confidenceInterval[1] * 100)}%</span>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Hide details' : 'Show factors & recommendations'}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Factors */}
            {(prediction.positiveFactors.length > 0 || prediction.negativeFactors.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {/* Positive factors */}
                <div>
                  <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
                    Positive Factors
                  </h5>
                  <div className="space-y-2">
                    {prediction.positiveFactors.length > 0 ? (
                      prediction.positiveFactors.map((factor, i) => (
                        <FactorItem key={i} factor={factor} positive />
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">None identified</p>
                    )}
                  </div>
                </div>

                {/* Negative factors */}
                <div>
                  <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
                    Risk Factors
                  </h5>
                  <div className="space-y-2">
                    {prediction.negativeFactors.length > 0 ? (
                      prediction.negativeFactors.map((factor, i) => (
                        <FactorItem key={i} factor={factor} positive={false} />
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">None identified</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {prediction.recommendations.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Recommendations
                </h5>
                <div className="space-y-2">
                  {prediction.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">{rec.action}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              rec.priority === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : rec.priority === 'high'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {rec.priority}
                          </span>
                          <span className="text-xs text-gray-500">
                            Effort: {rec.effort}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Model v{prediction.modelVersion}</span>
          <span>Valid until {new Date(prediction.validUntil).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Factor Item Component
 */
const FactorItem: React.FC<{ factor: PredictionFactor; positive: boolean }> = ({
  factor,
  positive,
}) => (
  <div
    className={`p-2 rounded-lg ${positive ? 'bg-green-50' : 'bg-red-50'}`}
  >
    <div className="flex items-center gap-2">
      {positive ? (
        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <TrendingDown className="w-3.5 h-3.5 text-red-600" />
      )}
      <span className="text-sm font-medium text-gray-700">{factor.factor}</span>
    </div>
    <p className="text-xs text-gray-500 mt-1">{factor.explanation}</p>
  </div>
);

/**
 * ProjectHealthPanel Component
 */
interface ProjectHealthPanelProps {
  health: ProjectHealthAnalysis;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ProjectHealthPanel: React.FC<ProjectHealthPanelProps> = ({
  health,
  onRefresh,
  isRefreshing = false,
}) => {
  const healthColors = {
    healthy: 'text-green-600 bg-green-50',
    at_risk: 'text-yellow-600 bg-yellow-50',
    critical: 'text-red-600 bg-red-50',
  };

  const trendIcons = {
    improving: <TrendingUp className="w-4 h-4 text-green-500" />,
    stable: <Minus className="w-4 h-4 text-gray-400" />,
    declining: <TrendingDown className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Project Health</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${healthColors[health.overallHealth]}`}
              >
                {health.overallHealth.replace('_', ' ')}
              </span>
              {trendIcons[health.trendDirection]}
            </div>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Health Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Overall Score</span>
          <span className="text-2xl font-bold text-gray-900">{health.healthScore}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              health.healthScore >= 70
                ? 'bg-green-500'
                : health.healthScore >= 40
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${health.healthScore}%` }}
          />
        </div>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <DimensionCard label="Schedule" dimension={health.dimensions.schedule} />
        <DimensionCard label="Budget" dimension={health.dimensions.budget} />
        <DimensionCard label="Quality" dimension={health.dimensions.quality} />
        <DimensionCard label="Safety" dimension={health.dimensions.safety} />
      </div>

      {/* Risk Factors */}
      {health.riskFactors.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Risk Factors</h5>
          <div className="space-y-2">
            {health.riskFactors.slice(0, 3).map((risk, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700">{risk.description}</p>
                  <span
                    className={`text-xs ${
                      risk.mitigationStatus === 'mitigated'
                        ? 'text-green-600'
                        : risk.mitigationStatus === 'in_progress'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {risk.mitigationStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</h5>
          <ul className="space-y-1">
            {health.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Dimension Card Component
 */
const DimensionCard: React.FC<{ label: string; dimension: DimensionHealth }> = ({
  label,
  dimension,
}) => {
  const statusColors = {
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
  };

  const trendIcons = {
    up: <TrendingUp className="w-3 h-3 text-green-500" />,
    stable: <Minus className="w-3 h-3 text-gray-400" />,
    down: <TrendingDown className="w-3 h-3 text-red-500" />,
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className={`px-1.5 py-0.5 text-xs rounded ${statusColors[dimension.status]}`}>
          {dimension.status}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-gray-900">{dimension.score}</span>
        {trendIcons[dimension.trend]}
      </div>
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{dimension.details}</p>
    </div>
  );
};

/**
 * DealScoringPanel Component
 */
interface DealScoringPanelProps {
  scoring: DealScoring;
}

export const DealScoringPanel: React.FC<DealScoringPanelProps> = ({ scoring }) => {
  const recommendationColors = {
    strong_proceed: 'text-green-700 bg-green-100',
    proceed: 'text-blue-700 bg-blue-100',
    conditional: 'text-yellow-700 bg-yellow-100',
    decline: 'text-red-700 bg-red-100',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Deal Score</h4>
        <span
          className={`px-3 py-1 text-sm font-medium rounded-full ${recommendationColors[scoring.recommendation]}`}
        >
          {scoring.recommendation.replace('_', ' ')}
        </span>
      </div>

      {/* Overall Score */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-gray-900">{scoring.overallScore}</div>
        <p className="text-sm text-gray-500">Overall Score</p>
      </div>

      {/* Dimensions */}
      <div className="space-y-3 mb-4">
        {Object.entries(scoring.dimensions).map(([key, value]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{key.replace('_', ' ')}</span>
              <span className="text-sm font-medium text-gray-900">{value}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Strengths & Risks */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Strengths</h5>
          <ul className="space-y-1">
            {scoring.keyStrengths.map((str, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-gray-600">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                {str}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Risks</h5>
          <ul className="space-y-1">
            {scoring.keyRisks.map((risk, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-gray-600">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PredictionPanel;
