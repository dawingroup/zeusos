/**
 * Readiness Gauge Component
 * Circular progress gauge showing readiness percentage
 */

import { cn } from '@/shared/lib/utils';

export interface ReadinessGaugeProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { size: 32, strokeWidth: 3, fontSize: 'text-[10px]' },
  md: { size: 48, strokeWidth: 4, fontSize: 'text-xs' },
  lg: { size: 64, strokeWidth: 5, fontSize: 'text-sm' },
};

function getColorClass(value: number): string {
  if (value >= 80) return 'text-green-500';
  if (value >= 50) return 'text-amber-500';
  return 'text-red-500';
}

function getStrokeColor(value: number): string {
  if (value >= 80) return '#22C55E'; // green-500
  if (value >= 50) return '#F59E0B'; // amber-500
  return '#EF4444'; // red-500
}

export function ReadinessGauge({ 
  value, 
  size = 'md',
  showLabel = true,
  className 
}: ReadinessGaugeProps) {
  const config = sizeConfig[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const center = config.size / 2;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={config.size}
        height={config.size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={getStrokeColor(value)}
          strokeWidth={config.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <span className={cn(
          'absolute font-medium',
          config.fontSize,
          getColorClass(value)
        )}>
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}

export default ReadinessGauge;
