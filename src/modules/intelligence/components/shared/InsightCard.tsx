// ============================================================================
// INSIGHT CARD COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Card for displaying AI-generated insights
// ============================================================================

import React from 'react';
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  AlertCircle, 
  ThumbsUp,
  CheckCircle,
  X,
  Bot,
  User,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { Insight } from '../../types';
import { InsightType } from '../../constants';
import { INSIGHT_TYPES, MODULE_COLOR } from '../../constants';
import { ConfidenceIndicator } from './ConfidenceIndicator';

interface InsightCardProps {
  insight: Insight;
  onClick?: (insight: Insight) => void;
  onAction?: (insight: Insight) => void;
  onDismiss?: (insight: Insight) => void;
  compact?: boolean;
}

const INSIGHT_ICONS: Record<InsightType, React.ReactNode> = {
  opportunity: <Lightbulb className="h-5 w-5" />,
  threat: <AlertTriangle className="h-5 w-5" />,
  trend: <TrendingUp className="h-5 w-5" />,
  anomaly: <AlertCircle className="h-5 w-5" />,
  recommendation: <ThumbsUp className="h-5 w-5" />,
};

const PRIORITY_STYLES = {
  critical: { borderColor: '#c62828', bgColor: '#c6282810' },
  high: { borderColor: '#f44336', bgColor: '#f4433610' },
  medium: { borderColor: '#ff9800', bgColor: '#ff980010' },
  low: { borderColor: '#4caf50', bgColor: '#4caf5010' },
};

export const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  onClick,
  onAction,
  onDismiss,
  compact = false,
}) => {
  const insightConfig = INSIGHT_TYPES.find(t => t.id === insight.type);
  const priorityStyle = PRIORITY_STYLES[insight.priority];

  if (compact) {
    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        style={{ borderLeft: `4px solid ${insightConfig?.color}` }}
        onClick={() => onClick?.(insight)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div
              className="p-1 rounded"
              style={{ backgroundColor: `${insightConfig?.color}20`, color: insightConfig?.color }}
            >
              {INSIGHT_ICONS[insight.type]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{insight.title}</p>
              <p className="text-xs text-muted-foreground truncate">{insight.description}</p>
            </div>
            <Badge
              className="text-xs capitalize shrink-0"
              style={{
                backgroundColor: priorityStyle.bgColor,
                color: priorityStyle.borderColor,
              }}
            >
              {insight.priority}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="h-full flex flex-col"
      style={{
        borderLeft: `4px solid ${insightConfig?.color}`,
        backgroundColor: priorityStyle.bgColor,
      }}
    >
      <CardContent className="p-4 flex-1">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded"
              style={{ backgroundColor: `${insightConfig?.color}20`, color: insightConfig?.color }}
            >
              {INSIGHT_ICONS[insight.type]}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{insightConfig?.label}</p>
              <Badge
                className="mt-1 text-xs capitalize text-white"
                style={{ backgroundColor: priorityStyle.borderColor }}
              >
                {insight.priority}
              </Badge>
            </div>
          </div>
          
          {onDismiss && insight.status === 'new' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(insight);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="font-semibold mb-2">{insight.title}</h3>
        <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>

        {/* Recommendations */}
        {insight.recommendations && insight.recommendations.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Recommendations:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {insight.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Metadata */}
        <div className="flex justify-between items-center mt-auto pt-3">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {insight.generatedBy === 'ai' ? (
                    <Bot className="h-4 w-4" style={{ color: MODULE_COLOR }} />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  Generated by {insight.generatedBy === 'ai' ? 'AI' : 'Manual analysis'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ConfidenceIndicator score={insight.confidence} variant="badge" />
          </div>
          
          <span className="text-xs text-muted-foreground">
            {insight.dataPoints} data points
          </span>
        </div>
      </CardContent>

      {/* Actions */}
      {(onAction || onClick) && insight.status === 'new' && (
        <div className="border-t px-4 py-2 flex justify-between">
          {onClick && (
            <Button variant="ghost" size="sm" onClick={() => onClick(insight)}>
              View Details
            </Button>
          )}
          {onAction && insight.isActionable && (
            <Button
              size="sm"
              className="gap-1 text-white"
              style={{ backgroundColor: insightConfig?.color }}
              onClick={() => onAction(insight)}
            >
              <CheckCircle className="h-4 w-4" />
              Take Action
            </Button>
          )}
        </div>
      )}

      {/* Status Badge */}
      {insight.status !== 'new' && (
        <div className="px-4 py-2 bg-muted/50 border-t">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">
              {insight.status === 'actioned' ? 'Action taken' : insight.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}
              {insight.reviewedAt && ` • ${new Date(insight.reviewedAt).toLocaleDateString()}`}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default InsightCard;
