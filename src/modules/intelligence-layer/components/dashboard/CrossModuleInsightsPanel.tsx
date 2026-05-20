// ============================================================================
// CROSS MODULE INSIGHTS PANEL
// DawinOS v2.0 - Intelligence Layer
// Panel showing insights that span multiple modules
// ============================================================================

import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  LineChart,
  Lightbulb,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Eye,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';

import { MODULE_COLOR, SOURCE_MODULES } from '../../constants';
import type { CrossModuleInsight, InsightDataPoint } from '../../types';
import { ConfidenceScore } from '../shared/ConfidenceScore';

interface CrossModuleInsightsPanelProps {
  insights: CrossModuleInsight[];
  onViewInsight?: (insight: CrossModuleInsight) => void;
  onActionInsight?: (insight: CrossModuleInsight) => void;
}

const insightTypeIcons: Record<string, React.ReactNode> = {
  correlation: <TrendingUp className="h-5 w-5" />,
  trend: <LineChart className="h-5 w-5" />,
  opportunity: <Lightbulb className="h-5 w-5" />,
  risk: <AlertTriangle className="h-5 w-5" />,
  optimization: <Zap className="h-5 w-5" />,
};

const insightTypeColors: Record<string, string> = {
  correlation: '#2196F3',
  trend: '#9C27B0',
  opportunity: '#4CAF50',
  risk: '#F44336',
  optimization: '#FF9800',
};

const severityColors: Record<string, string> = {
  high: '#F44336',
  medium: '#FF9800',
  low: '#4CAF50',
};

export const CrossModuleInsightsPanel: React.FC<CrossModuleInsightsPanelProps> = ({
  insights,
  onViewInsight,
  onActionInsight,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderDataPoint = (dataPoint: InsightDataPoint) => {
    const moduleConfig = SOURCE_MODULES.find(m => m.id === dataPoint.module);
    return (
      <div
        key={`${dataPoint.module}-${dataPoint.metric}`}
        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Badge
            className="text-xs h-5"
            style={{
              backgroundColor: moduleConfig?.color || '#9e9e9e',
              color: 'white',
            }}
          >
            {moduleConfig?.label || dataPoint.module}
          </Badge>
          <span className="text-sm">{dataPoint.metric}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{dataPoint.value.toLocaleString()}</span>
          <Badge
            variant="outline"
            className={`text-xs h-5 ${
              dataPoint.trend === 'up'
                ? 'bg-green-100 text-green-700 border-green-300'
                : dataPoint.trend === 'down'
                ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
          >
            {dataPoint.trend === 'up' ? '↑' : dataPoint.trend === 'down' ? '↓' : '→'}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${MODULE_COLOR}15` }}
        >
          <Sparkles className="h-5 w-5" style={{ color: MODULE_COLOR }} />
        </div>
        <div>
          <CardTitle className="text-lg">Cross-Module Insights</CardTitle>
          <p className="text-sm text-muted-foreground">
            AI-detected patterns across DawinOS modules
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {insights.map((insight) => {
            const isExpanded = expandedId === insight.id;
            const typeColor = insightTypeColors[insight.insightType] || MODULE_COLOR;
            const icon = insightTypeIcons[insight.insightType] || <Sparkles className="h-5 w-5" />;

            return (
              <div key={insight.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
                  >
                    {icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className="text-xs capitalize"
                        style={{ backgroundColor: typeColor, color: 'white' }}
                      >
                        {insight.insightType}
                      </Badge>
                      <Badge
                        className="text-xs capitalize"
                        style={{
                          backgroundColor: severityColors[insight.severity],
                          color: 'white',
                        }}
                      >
                        {insight.severity}
                      </Badge>
                      <ConfidenceScore score={insight.confidence} size="small" />
                    </div>

                    <h4 className="font-medium mb-1">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>

                    {/* Source Modules */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {insight.sourceModules.map((module) => {
                        const config = SOURCE_MODULES.find(m => m.id === module);
                        return (
                          <Badge
                            key={module}
                            variant="outline"
                            className="text-xs h-5"
                            style={{
                              borderColor: config?.color,
                              color: config?.color,
                            }}
                          >
                            {config?.label || module}
                          </Badge>
                        );
                      })}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-4 space-y-4">
                        {/* Data Points */}
                        {insight.dataPoints.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">
                              Related Data Points
                            </p>
                            <div className="space-y-1">
                              {insight.dataPoints.map(renderDataPoint)}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {insight.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">
                              Recommendations
                            </p>
                            <ul className="space-y-1">
                              {insight.recommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          {onViewInsight && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewInsight(insight)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          )}
                          {onActionInsight && insight.status === 'new' && (
                            <Button
                              size="sm"
                              onClick={() => onActionInsight(insight)}
                              style={{ backgroundColor: MODULE_COLOR }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Take Action
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleExpand(insight.id)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {insights.length === 0 && (
          <div className="p-8 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No cross-module insights detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CrossModuleInsightsPanel;
