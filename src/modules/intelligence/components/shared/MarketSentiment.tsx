// ============================================================================
// MARKET SENTIMENT COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Sentiment gauge and display
// ============================================================================

import React from 'react';
import { Frown, Meh, Smile, ThumbsDown, ThumbsUp } from 'lucide-react';

import { Badge } from '@/core/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { SentimentLevel, SENTIMENT_LEVELS } from '../../constants';

interface MarketSentimentProps {
  sentiment: SentimentLevel;
  score?: number;
  showLabel?: boolean;
  variant?: 'icon' | 'chip' | 'gauge';
}

const SENTIMENT_ICONS: Record<SentimentLevel, React.ReactNode> = {
  very_positive: <ThumbsUp className="h-4 w-4" />,
  positive: <Smile className="h-4 w-4" />,
  neutral: <Meh className="h-4 w-4" />,
  negative: <Frown className="h-4 w-4" />,
  very_negative: <ThumbsDown className="h-4 w-4" />,
};

export const MarketSentiment: React.FC<MarketSentimentProps> = ({
  sentiment,
  score,
  showLabel = true,
  variant = 'chip',
}) => {
  const config = SENTIMENT_LEVELS.find(s => s.id === sentiment);

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div style={{ color: config?.color }}>
              {SENTIMENT_ICONS[sentiment]}
            </div>
          </TooltipTrigger>
          <TooltipContent>{config?.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'gauge') {
    const normalizedScore = score !== undefined ? (score + 1) / 2 : 0.5;
    
    return (
      <div className="w-full max-w-[200px]">
        {showLabel && (
          <p className="text-xs text-muted-foreground mb-1">Market Sentiment</p>
        )}
        <div
          className="relative h-2 rounded-full"
          style={{
            background: 'linear-gradient(to right, #c62828, #f44336, #9e9e9e, #4caf50, #2e7d32)',
          }}
        >
          <div
            className="absolute -top-1 w-4 h-4 rounded-full bg-white border-2 shadow"
            style={{
              left: `${normalizedScore * 100}%`,
              transform: 'translateX(-50%)',
              borderColor: config?.color,
            }}
          />
        </div>
        <p
          className="text-sm font-medium mt-2 text-center"
          style={{ color: config?.color }}
        >
          {config?.label}
        </p>
      </div>
    );
  }

  // Chip variant (default)
  return (
    <Badge
      variant="outline"
      className="gap-1"
      style={{
        backgroundColor: `${config?.color}20`,
        color: config?.color,
        borderColor: `${config?.color}40`,
      }}
    >
      {SENTIMENT_ICONS[sentiment]}
      {showLabel && <span>{config?.label}</span>}
    </Badge>
  );
};

interface SentimentDistributionProps {
  distribution: Record<SentimentLevel, number>;
  showLabels?: boolean;
}

export const SentimentDistribution: React.FC<SentimentDistributionProps> = ({
  distribution,
  showLabels = true,
}) => {
  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  if (total === 0) return null;

  const segments = (
    [
      { sentiment: 'very_positive' as SentimentLevel, percentage: (distribution.very_positive / total) * 100 },
      { sentiment: 'positive' as SentimentLevel, percentage: (distribution.positive / total) * 100 },
      { sentiment: 'neutral' as SentimentLevel, percentage: (distribution.neutral / total) * 100 },
      { sentiment: 'negative' as SentimentLevel, percentage: (distribution.negative / total) * 100 },
      { sentiment: 'very_negative' as SentimentLevel, percentage: (distribution.very_negative / total) * 100 },
    ]
  ).filter(s => s.percentage > 0);

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden">
        {segments.map(({ sentiment, percentage }) => {
          const config = SENTIMENT_LEVELS.find(s => s.id === sentiment);
          return (
            <TooltipProvider key={sentiment}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: config?.color,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {config?.label}: {percentage.toFixed(1)}%
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      {showLabels && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">Negative</span>
          <span className="text-xs text-muted-foreground">Positive</span>
        </div>
      )}
    </div>
  );
};

export default MarketSentiment;
