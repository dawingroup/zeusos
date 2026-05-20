/**
 * Readiness Gauge Component
 * Visual indicator for product readiness/completion percentage
 */

import React from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ReadinessGaugeProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  label?: string;
  className?: string;
}

const getReadinessConfig = (percentage: number) => {
  if (percentage >= 90) {
    return {
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      fillColor: 'bg-emerald-500',
      icon: CheckCircle,
      status: 'Ready',
    };
  } else if (percentage >= 60) {
    return {
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      fillColor: 'bg-blue-500',
      icon: Clock,
      status: 'In Progress',
    };
  } else if (percentage >= 30) {
    return {
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      fillColor: 'bg-amber-500',
      icon: Clock,
      status: 'Early Stage',
    };
  } else {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      fillColor: 'bg-red-500',
      icon: AlertCircle,
      status: 'Not Ready',
    };
  }
};

const sizeConfig = {
  sm: {
    height: 'h-1.5',
    width: 'w-16',
    text: 'text-xs',
    icon: 'w-3 h-3',
    gap: 'gap-1',
  },
  md: {
    height: 'h-2',
    width: 'w-24',
    text: 'text-sm',
    icon: 'w-4 h-4',
    gap: 'gap-1.5',
  },
  lg: {
    height: 'h-3',
    width: 'w-32',
    text: 'text-base',
    icon: 'w-5 h-5',
    gap: 'gap-2',
  },
};

export const ReadinessGauge: React.FC<ReadinessGaugeProps> = ({
  percentage,
  size = 'md',
  showLabel = true,
  showIcon = false,
  label,
  className = '',
}) => {
  const config = getReadinessConfig(percentage);
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className={`inline-flex items-center ${sizes.gap} ${className}`}>
      {showIcon && <Icon className={`${sizes.icon} ${config.color}`} />}

      <div className="flex items-center gap-2">
        {/* Progress bar */}
        <div
          className={`${sizes.width} ${sizes.height} ${config.bgColor} rounded-full overflow-hidden`}
        >
          <div
            className={`${sizes.height} ${config.fillColor} rounded-full transition-all duration-300`}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>

        {/* Percentage / Label */}
        {showLabel && (
          <span className={`${sizes.text} ${config.color} font-medium whitespace-nowrap`}>
            {label || `${Math.round(clampedPercentage)}%`}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Circular readiness gauge variant
 */
interface CircularGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  className?: string;
}

export const CircularReadinessGauge: React.FC<CircularGaugeProps> = ({
  percentage,
  size = 48,
  strokeWidth = 4,
  showPercentage = true,
  className = '',
}) => {
  const config = getReadinessConfig(percentage);
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={config.fillColor.replace('bg-', 'text-')}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>

      {showPercentage && (
        <span
          className={`absolute text-xs font-semibold ${config.color}`}
          style={{ fontSize: size * 0.25 }}
        >
          {Math.round(clampedPercentage)}
        </span>
      )}
    </div>
  );
};

export default ReadinessGauge;
