// ============================================================================
// PREDICTION CARD
// DawinOS v2.0 - Intelligence Layer
// Card displaying AI predictions with confidence intervals
// ============================================================================

import React from 'react';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';

import { MODULE_COLOR } from '../../constants';
import type { Prediction, PredictionFactor } from '../../types';
import { ModuleSourceBadge } from '../shared/ModuleSourceBadge';
import { ConfidenceScore } from '../shared/ConfidenceScore';

interface PredictionCardProps {
  prediction: Prediction;
  onValidate?: (prediction: Prediction, actualValue: number) => void;
  compact?: boolean;
}

const statusConfig = {
  active: { color: '#2196F3', Icon: Timer, label: 'Active' },
  validated: { color: '#4CAF50', Icon: CheckCircle, label: 'Validated' },
  invalidated: { color: '#F44336', Icon: XCircle, label: 'Invalidated' },
  expired: { color: '#9E9E9E', Icon: Clock, label: 'Expired' },
};

export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  compact = false,
}) => {
  const status = statusConfig[prediction.status];

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderFactor = (factor: PredictionFactor) => {
    return (
      <div
        key={factor.name}
        className="flex items-center justify-between py-1"
      >
        <span className="text-sm">{factor.name}</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                factor.impact === 'positive'
                  ? 'bg-green-500'
                  : factor.impact === 'negative'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
              }`}
              style={{ width: `${factor.weight * 100}%` }}
            />
          </div>
          <Badge
            variant="outline"
            className={`text-xs h-5 ${
              factor.impact === 'positive'
                ? 'bg-green-100 text-green-700 border-green-300'
                : factor.impact === 'negative'
                ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
          >
            {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '→'}
          </Badge>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg shrink-0"
              style={{ backgroundColor: `${MODULE_COLOR}15` }}
            >
              <TrendingUp className="h-5 w-5" style={{ color: MODULE_COLOR }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{prediction.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold" style={{ color: MODULE_COLOR }}>
                  {formatValue(prediction.predictedValue)}
                </span>
                <ConfidenceScore score={prediction.confidence} size="small" />
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDate(prediction.targetDate)}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="p-3 rounded-xl shrink-0"
            style={{ backgroundColor: `${MODULE_COLOR}15` }}
          >
            <TrendingUp className="h-7 w-7" style={{ color: MODULE_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className="gap-1"
                style={{ backgroundColor: status.color, color: 'white' }}
              >
                <status.Icon className="h-3 w-3" />
                {status.label}
              </Badge>
              <ModuleSourceBadge module={prediction.sourceModule} size="small" />
            </div>
            <h4 className="font-semibold">{prediction.title}</h4>
            <p className="text-sm text-muted-foreground">{prediction.description}</p>
          </div>
        </div>

        {/* Prediction Value */}
        <div className="p-4 bg-muted/50 rounded-xl mb-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-muted-foreground">Predicted Value</p>
              <p className="text-3xl font-bold" style={{ color: MODULE_COLOR }}>
                {formatValue(prediction.predictedValue)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Target Date</p>
              <p className="font-medium">{formatDate(prediction.targetDate)}</p>
            </div>
          </div>

          {/* Confidence Interval */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1">Confidence Interval (95%)</p>
            <div className="flex items-center gap-3">
              <span className="text-sm">{formatValue(prediction.confidenceInterval.lower)}</span>
              <div className="flex-1 relative h-2">
                <div className="absolute inset-0 bg-muted rounded-full" />
                <div
                  className="absolute top-0 bottom-0 rounded-full opacity-30"
                  style={{
                    left: '20%',
                    right: '20%',
                    backgroundColor: MODULE_COLOR,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                  style={{
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: MODULE_COLOR,
                  }}
                />
              </div>
              <span className="text-sm">{formatValue(prediction.confidenceInterval.upper)}</span>
            </div>
          </div>

          {/* Confidence Score */}
          <div className="mt-4 flex items-center justify-between">
            <ConfidenceScore score={prediction.confidence} showBar />
            {prediction.historicalAccuracy !== undefined && (
              <Badge variant="outline" className="text-xs">
                {Math.round(prediction.historicalAccuracy * 100)}% historical accuracy
              </Badge>
            )}
          </div>
        </div>

        {/* Contributing Factors */}
        {prediction.factors.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Contributing Factors</p>
            <div className="space-y-1">
              {prediction.factors.map(renderFactor)}
            </div>
          </div>
        )}

        {/* Actual Value (if validated) */}
        {prediction.status === 'validated' && prediction.actualValue !== undefined && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs text-green-700">Actual Value</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-green-700">
                {formatValue(prediction.actualValue)}
              </span>
              <Badge className="bg-green-500">
                {(
                  ((prediction.actualValue - prediction.predictedValue) /
                    prediction.predictedValue) *
                  100
                ).toFixed(1)}% variance
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PredictionCard;
