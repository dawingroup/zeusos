// ============================================================================
// SUGGESTION CARD
// DawinOS v2.0 - Intelligence Layer
// Card for displaying smart suggestions
// ============================================================================

import React from 'react';
import {
  Lightbulb,
  ClipboardList,
  CheckCircle,
  Bell,
  Zap,
  Clock,
  Check,
  X,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { SUGGESTION_TYPES, MODULE_COLOR } from '../../constants';
import type { SmartSuggestion } from '../../types';
import { ConfidenceScore } from './ConfidenceScore';
import { ModuleSourceBadge } from './ModuleSourceBadge';

interface SuggestionCardProps {
  suggestion: SmartSuggestion;
  onAccept?: (suggestion: SmartSuggestion) => void;
  onDismiss?: (suggestion: SmartSuggestion) => void;
  onAction?: (suggestion: SmartSuggestion) => void;
  compact?: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  task: <ClipboardList className="h-5 w-5" />,
  approval: <CheckCircle className="h-5 w-5" />,
  alert: <Bell className="h-5 w-5" />,
  insight: <Lightbulb className="h-5 w-5" />,
  optimization: <Zap className="h-5 w-5" />,
  reminder: <Clock className="h-5 w-5" />,
};

const priorityColors: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F44336',
  medium: '#FF9800',
  low: '#4CAF50',
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  onAction,
  compact = false,
}) => {
  const typeConfig = SUGGESTION_TYPES.find(t => t.id === suggestion.type);
  const icon = typeIcons[suggestion.type] || <Lightbulb className="h-5 w-5" />;

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (compact) {
    return (
      <Card
        className="border-l-4"
        style={{ borderLeftColor: typeConfig?.color || MODULE_COLOR }}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div
              className="p-1.5 rounded-lg shrink-0"
              style={{ backgroundColor: `${typeConfig?.color || MODULE_COLOR}15`, color: typeConfig?.color || MODULE_COLOR }}
            >
              {icon}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{suggestion.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <ModuleSourceBadge module={suggestion.sourceModule} size="small" />
                <ConfidenceScore score={suggestion.confidence} size="small" />
              </div>
            </div>

            <div className="flex gap-1 shrink-0">
              {onAccept && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAccept(suggestion)}>
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Accept</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {onDismiss && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDismiss(suggestion)}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Dismiss</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="border-l-4"
      style={{ borderLeftColor: typeConfig?.color || MODULE_COLOR }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className="p-2.5 rounded-lg shrink-0"
            style={{ backgroundColor: `${typeConfig?.color || MODULE_COLOR}15`, color: typeConfig?.color || MODULE_COLOR }}
          >
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge style={{ backgroundColor: typeConfig?.color, color: 'white' }}>
                {typeConfig?.label}
              </Badge>
              <Badge style={{ backgroundColor: priorityColors[suggestion.priority], color: 'white' }} className="capitalize">
                {suggestion.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(suggestion.createdAt)}
              </span>
            </div>

            <h4 className="font-medium mb-1">{suggestion.title}</h4>
            <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>

            <div className="flex items-center gap-4">
              <ModuleSourceBadge module={suggestion.sourceModule} />
              <ConfidenceScore score={suggestion.confidence} showBar />
            </div>

            {suggestion.context && (
              <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Related: {suggestion.context.entityType} - {suggestion.context.entityName}
                </p>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t">
          {suggestion.actionLabel && onAction && (
            <Button
              size="sm"
              onClick={() => onAction(suggestion)}
              style={{ backgroundColor: MODULE_COLOR }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {suggestion.actionLabel}
            </Button>
          )}
          {onAccept && (
            <Button variant="outline" size="sm" className="text-green-600 border-green-600" onClick={() => onAccept(suggestion)}>
              <Check className="h-4 w-4 mr-2" />
              Accept
            </Button>
          )}
          {onDismiss && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-600" onClick={() => onDismiss(suggestion)}>
              <X className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SuggestionCard;
