// ============================================================================
// INTELLIGENCE OVERVIEW CARD
// DawinOS v2.0 - Intelligence Layer
// Summary card showing AI intelligence metrics
// ============================================================================

import React from 'react';
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  FileText,
  MessageCircle,
  Gauge,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';

import { MODULE_COLOR } from '../../constants';
import type { IntelligenceOverview } from '../../types';

interface IntelligenceOverviewCardProps {
  overview: IntelligenceOverview;
  loading?: boolean;
}

export const IntelligenceOverviewCard: React.FC<IntelligenceOverviewCardProps> = ({
  overview,
}) => {
  const metrics = [
    {
      label: 'Active Suggestions',
      value: overview.activeSuggestions,
      icon: <Lightbulb className="h-5 w-5" />,
      color: '#FF9800',
    },
    {
      label: 'Pending Anomalies',
      value: overview.pendingAnomalies,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: '#F44336',
    },
    {
      label: 'Predictions',
      value: overview.activePredictions,
      icon: <TrendingUp className="h-5 w-5" />,
      color: '#4CAF50',
    },
    {
      label: 'Docs Analyzed',
      value: overview.documentsAnalyzed,
      icon: <FileText className="h-5 w-5" />,
      color: '#2196F3',
    },
    {
      label: 'Queries Today',
      value: overview.queriesProcessed,
      icon: <MessageCircle className="h-5 w-5" />,
      color: '#9C27B0',
    },
    {
      label: 'AI Accuracy',
      value: `${Math.round(overview.aiAccuracy * 100)}%`,
      icon: <Gauge className="h-5 w-5" />,
      color: '#00BCD4',
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: MODULE_COLOR }}
          >
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">Intelligence Overview</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered insights across all modules
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="text-center p-3 rounded-lg"
              style={{ backgroundColor: `${metric.color}10` }}
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: metric.color, color: 'white' }}
              >
                {metric.icon}
              </div>
              <p className="text-2xl font-bold" style={{ color: metric.color }}>
                {metric.value}
              </p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Accuracy Progress */}
        <div className="mt-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Overall AI Accuracy</span>
            <span className="text-sm font-bold" style={{ color: MODULE_COLOR }}>
              {Math.round(overview.aiAccuracy * 100)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${overview.aiAccuracy * 100}%`,
                backgroundColor: MODULE_COLOR,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IntelligenceOverviewCard;
