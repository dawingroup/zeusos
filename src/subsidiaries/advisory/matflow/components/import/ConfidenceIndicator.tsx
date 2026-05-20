/**
 * Confidence Indicator Component
 * Visual display of AI confidence scores
 */

import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import {
  getConfidenceLevel,
  CONFIDENCE_CONFIG,
  type ConfidenceLevel,
} from '../../utils/reviewHelpers';

interface ConfidenceIndicatorProps {
  score: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ICON_MAP = {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
};

const SIZE_MAP = {
  sm: { icon: 14, text: 'text-xs' },
  md: { icon: 18, text: 'text-sm' },
  lg: { icon: 22, text: 'text-base' },
};

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  score,
  showLabel = false,
  showPercentage = true,
  size = 'md',
  className = '',
}) => {
  const level = getConfidenceLevel(score);
  const config = CONFIDENCE_CONFIG[level];
  const IconComponent = ICON_MAP[config.icon as keyof typeof ICON_MAP] || HelpCircle;
  const sizeConfig = SIZE_MAP[size];
  
  const percentage = Math.round(score * 100);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor} ${className}`}
      title={config.description}
    >
      <IconComponent size={sizeConfig.icon} className={config.color} />
      {showLabel && (
        <span className={`font-medium ${config.color} ${sizeConfig.text}`}>
          {config.label}
        </span>
      )}
      {showPercentage && (
        <span className={`font-mono ${config.color} ${sizeConfig.text}`}>
          {percentage}%
        </span>
      )}
    </div>
  );
};

/**
 * Confidence bar for visual representation
 */
interface ConfidenceBarProps {
  score: number;
  height?: number;
  showLabel?: boolean;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  score,
  height = 8,
  showLabel = false,
}) => {
  const level = getConfidenceLevel(score);
  const percentage = Math.round(score * 100);
  
  const colorMap: Record<ConfidenceLevel, string> = {
    high: 'bg-green-500',
    medium: 'bg-amber-500',
    low: 'bg-orange-500',
    very_low: 'bg-red-500',
  };

  return (
    <div className="w-full">
      <div
        className="w-full bg-gray-200 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className={`h-full ${colorMap[level]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 mt-1">
          {percentage}% confidence
        </span>
      )}
    </div>
  );
};

export default ConfidenceIndicator;
