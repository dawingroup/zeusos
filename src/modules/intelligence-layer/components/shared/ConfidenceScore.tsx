// ============================================================================
// CONFIDENCE SCORE
// DawinOS v2.0 - Intelligence Layer
// Displays AI confidence with visual indicator
// ============================================================================

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { CONFIDENCE_THRESHOLDS } from '../../constants';

interface ConfidenceScoreProps {
  score: number; // 0-1
  showLabel?: boolean;
  showBar?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const ConfidenceScore: React.FC<ConfidenceScoreProps> = ({
  score,
  showLabel = true,
  showBar = false,
  size = 'medium',
}) => {
  const percentage = Math.round(score * 100);

  const getLevel = (): 'high' | 'medium' | 'low' => {
    if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
    if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
    return 'low';
  };

  const level = getLevel();

  const config = {
    high: {
      color: '#4CAF50',
      label: 'High Confidence',
      Icon: CheckCircle,
    },
    medium: {
      color: '#FF9800',
      label: 'Medium Confidence',
      Icon: AlertTriangle,
    },
    low: {
      color: '#F44336',
      label: 'Low Confidence',
      Icon: XCircle,
    },
  };

  const { color, label, Icon } = config[level];

  const iconSize = size === 'small' ? 'h-3.5 w-3.5' : size === 'medium' ? 'h-4 w-4' : 'h-5 w-5';
  const fontSize = size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1">
            <Icon className={iconSize} style={{ color }} />

            {showLabel && (
              <span className={`font-medium ${fontSize}`} style={{ color }}>
                {percentage}%
              </span>
            )}

            {showBar && (
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden ml-1">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {label}: {percentage}%
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ConfidenceScore;
