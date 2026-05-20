/**
 * Confidence Indicator Component
 * 
 * Visual display of AI parsing confidence levels.
 */

import React from 'react';
import type { ConfidenceScore } from '../types/parsing';
import { getConfidenceLevel } from '../types/parsing';
import { cn } from '@/core/lib/utils';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react';

// ============================================================================
// CONFIDENCE BADGE
// ============================================================================

interface ConfidenceBadgeProps {
  score: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  score,
  showPercentage = true,
  size = 'md',
}) => {
  const level = getConfidenceLevel(score);

  const config = {
    high: {
      icon: CheckCircle,
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-200',
      label: 'High Confidence',
    },
    medium: {
      icon: AlertCircle,
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      label: 'Medium Confidence',
    },
    low: {
      icon: AlertTriangle,
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-200',
      label: 'Low Confidence',
    },
    very_low: {
      icon: XCircle,
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-200',
      label: 'Very Low Confidence',
    },
  };

  const { icon: Icon, bg, text, border, label } = config[level];

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium cursor-help',
        bg,
        text,
        border,
        sizes[size]
      )}
      title={`${label} - AI confidence: ${(score * 100).toFixed(1)}%`}
    >
      <Icon className={iconSizes[size]} />
      {showPercentage && <span>{Math.round(score * 100)}%</span>}
    </div>
  );
};

// ============================================================================
// CONFIDENCE BAR
// ============================================================================

interface ConfidenceBarProps {
  score: number;
  showLabel?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  score,
  showLabel = true,
  height = 'md',
}) => {
  const level = getConfidenceLevel(score);
  const percentage = Math.round(score * 100);

  const colors = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-orange-500',
    very_low: 'bg-red-500',
  };

  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-medium">{percentage}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full bg-gray-200 rounded-full overflow-hidden',
          heights[height]
        )}
      >
        <div
          className={cn('h-full transition-all duration-300', colors[level])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// FIELD CONFIDENCE DISPLAY
// ============================================================================

interface FieldConfidenceProps {
  confidence: ConfidenceScore;
  showFactors?: boolean;
}

export const FieldConfidenceDisplay: React.FC<FieldConfidenceProps> = ({
  confidence,
  showFactors = false,
}) => {
  const fields = Object.entries(confidence.fields);

  return (
    <div className="space-y-3">
      {/* Overall confidence */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Overall Confidence</span>
          <ConfidenceBadge score={confidence.overall} size="sm" />
        </div>
        <ConfidenceBar score={confidence.overall} showLabel={false} />
      </div>

      {/* Per-field confidence */}
      {fields.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Field Confidence
          </h4>
          {fields.map(([field, score]) => (
            <div key={field} className="flex items-center gap-2">
              <span className="text-sm w-24 truncate capitalize">
                {field.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <div className="flex-1">
                <ConfidenceBar score={score || 0} showLabel={false} height="sm" />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {Math.round((score || 0) * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Confidence factors */}
      {showFactors && confidence.factors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Factors
          </h4>
          <div className="space-y-1">
            {confidence.factors.map((factor, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-2 text-xs p-2 rounded',
                  factor.impact === 'positive' && 'bg-green-50 text-green-700',
                  factor.impact === 'negative' && 'bg-red-50 text-red-700',
                  factor.impact === 'neutral' && 'bg-gray-50 text-gray-700'
                )}
              >
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{factor.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CONFIDENCE SUMMARY
// ============================================================================

interface ConfidenceSummaryProps {
  items: Array<{ confidence: ConfidenceScore }>;
}

export const ConfidenceSummary: React.FC<ConfidenceSummaryProps> = ({
  items,
}) => {
  const total = items.length;
  const high = items.filter(
    (i) => getConfidenceLevel(i.confidence.overall) === 'high'
  ).length;
  const medium = items.filter(
    (i) => getConfidenceLevel(i.confidence.overall) === 'medium'
  ).length;
  const low = items.filter(
    (i) => getConfidenceLevel(i.confidence.overall) === 'low'
  ).length;
  const veryLow = items.filter(
    (i) => getConfidenceLevel(i.confidence.overall) === 'very_low'
  ).length;

  const avgConfidence =
    items.length > 0
      ? items.reduce((sum, i) => sum + i.confidence.overall, 0) / items.length
      : 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Confidence Summary</h3>
        <ConfidenceBadge score={avgConfidence} size="md" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-2 bg-green-100 rounded">
          <div className="text-xl font-bold text-green-700">{high}</div>
          <div className="text-xs text-green-600">High</div>
        </div>
        <div className="text-center p-2 bg-yellow-100 rounded">
          <div className="text-xl font-bold text-yellow-700">{medium}</div>
          <div className="text-xs text-yellow-600">Medium</div>
        </div>
        <div className="text-center p-2 bg-orange-100 rounded">
          <div className="text-xl font-bold text-orange-700">{low}</div>
          <div className="text-xs text-orange-600">Low</div>
        </div>
        <div className="text-center p-2 bg-red-100 rounded">
          <div className="text-xl font-bold text-red-700">{veryLow}</div>
          <div className="text-xs text-red-600">Very Low</div>
        </div>
      </div>

      <div className="h-4 rounded-full overflow-hidden flex">
        {high > 0 && (
          <div
            className="bg-green-500 h-full"
            style={{ width: `${(high / total) * 100}%` }}
          />
        )}
        {medium > 0 && (
          <div
            className="bg-yellow-500 h-full"
            style={{ width: `${(medium / total) * 100}%` }}
          />
        )}
        {low > 0 && (
          <div
            className="bg-orange-500 h-full"
            style={{ width: `${(low / total) * 100}%` }}
          />
        )}
        {veryLow > 0 && (
          <div
            className="bg-red-500 h-full"
            style={{ width: `${(veryLow / total) * 100}%` }}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {total} items analyzed • Average confidence:{' '}
        {Math.round(avgConfidence * 100)}%
      </p>
    </div>
  );
};

// ============================================================================
// REVIEW STATUS BADGE
// ============================================================================

interface ReviewStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const ReviewStatusBadge: React.FC<ReviewStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Pending',
    },
    auto_approved: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Auto-Approved',
    },
    needs_review: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Needs Review',
    },
    approved: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Approved',
    },
    modified: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      label: 'Modified',
    },
    rejected: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Rejected',
    },
  };

  const { bg, text, label } = config[status] || config.pending;

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        bg,
        text,
        sizes[size]
      )}
    >
      {label}
    </span>
  );
};

export default {
  ConfidenceBadge,
  ConfidenceBar,
  FieldConfidenceDisplay,
  ConfidenceSummary,
  ReviewStatusBadge,
};
