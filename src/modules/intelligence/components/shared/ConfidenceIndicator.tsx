// ============================================================================
// CONFIDENCE INDICATOR COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Visual indicator for data confidence level
// ============================================================================

import React from 'react';
import { CheckCircle, HelpCircle } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { CONFIDENCE_LEVELS, ConfidenceLevel } from '../../constants';

interface ConfidenceIndicatorProps {
  score: number; // 0 to 1
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'bar' | 'badge' | 'icon';
}

const getConfidenceLevel = (score: number): ConfidenceLevel => {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
};

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  score,
  showLabel = false,
  showPercentage = true,
  size = 'small',
  variant = 'bar',
}) => {
  const level = getConfidenceLevel(score);
  const config = CONFIDENCE_LEVELS.find(c => c.id === level);
  const percentage = Math.round(score * 100);

  const tooltipText = `${config?.label}: ${percentage}% confidence based on data quality and source reliability`;

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: config?.color }}
              />
              {showLabel && (
                <span className="text-xs text-muted-foreground">{config?.label}</span>
              )}
              {showPercentage && (
                <span className="text-xs font-medium">{percentage}%</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {score >= 0.8 ? (
                <CheckCircle className={`${size === 'small' ? 'h-4 w-4' : 'h-5 w-5'}`} style={{ color: config?.color }} />
              ) : (
                <HelpCircle className={`${size === 'small' ? 'h-4 w-4' : 'h-5 w-5'}`} style={{ color: config?.color }} />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Bar variant (default)
  const heightClass = size === 'small' ? 'h-1' : size === 'medium' ? 'h-1.5' : 'h-2';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full max-w-[120px]">
            {showLabel && (
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">Confidence</span>
                {showPercentage && (
                  <span className="text-xs font-medium" style={{ color: config?.color }}>
                    {percentage}%
                  </span>
                )}
              </div>
            )}
            <div className={`${heightClass} w-full bg-gray-200 rounded-full overflow-hidden`}>
              <div
                className={`${heightClass} rounded-full transition-all`}
                style={{ width: `${percentage}%`, backgroundColor: config?.color }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ConfidenceIndicator;
