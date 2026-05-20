// ============================================================================
// TREND INDICATOR COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Visual indicator for trend direction
// ============================================================================

import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

import { Badge } from '@/core/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { TrendDirection, TREND_DIRECTIONS } from '../../constants';

interface TrendIndicatorProps {
  direction: TrendDirection;
  value?: number;
  showLabel?: boolean;
  showValue?: boolean;
  size?: 'small' | 'medium' | 'large';
  format?: 'percentage' | 'absolute' | 'currency';
}

const TREND_ICONS: Record<TrendDirection, React.ReactNode> = {
  strong_up: <TrendingUp className="h-4 w-4" />,
  up: <ArrowUpRight className="h-4 w-4" />,
  flat: <Minus className="h-4 w-4" />,
  down: <ArrowDownRight className="h-4 w-4" />,
  strong_down: <TrendingDown className="h-4 w-4" />,
};

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  direction,
  value,
  showLabel = false,
  showValue = true,
  size = 'medium',
  format = 'percentage',
}) => {
  const config = TREND_DIRECTIONS.find(t => t.id === direction);
  
  const sizeClass = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  const formatValue = (val: number): string => {
    const sign = val >= 0 ? '+' : '';
    switch (format) {
      case 'percentage':
        return `${sign}${val.toFixed(1)}%`;
      case 'currency':
        return `${sign}$${Math.abs(val).toLocaleString()}`;
      default:
        return `${sign}${val.toLocaleString()}`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-1 ${sizeClass[size]}`}
            style={{ color: config?.color }}
          >
            {TREND_ICONS[direction]}
            {showValue && value !== undefined && (
              <span className="font-medium">{formatValue(value)}</span>
            )}
            {showLabel && (
              <span className="text-muted-foreground">{config?.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{config?.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface TrendBadgeProps {
  direction: TrendDirection;
  label?: string;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ direction, label }) => {
  const config = TREND_DIRECTIONS.find(t => t.id === direction);
  
  return (
    <Badge
      variant="outline"
      className="gap-1"
      style={{
        backgroundColor: `${config?.color}15`,
        color: config?.color,
        borderColor: `${config?.color}30`,
      }}
    >
      {TREND_ICONS[direction]}
      {label && <span className="text-xs font-medium">{label}</span>}
    </Badge>
  );
};

export default TrendIndicator;
