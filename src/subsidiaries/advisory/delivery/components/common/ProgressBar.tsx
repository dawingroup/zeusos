/**
 * Progress Bar - Visual progress indicator with status colors
 */

import { ProgressStatusType } from '../../types/project-progress';

interface ProgressBarProps {
  value: number;
  status?: ProgressStatusType | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animate?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ahead: 'bg-blue-500',
  on_track: 'bg-green-500',
  slightly_behind: 'bg-yellow-500',
  significantly_behind: 'bg-orange-500',
  critical: 'bg-red-500',
  behind: 'bg-yellow-500',
  default: 'bg-primary',
};

const SIZE_CLASSES = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({ 
  value, 
  status = 'default', 
  size = 'md',
  showLabel = false,
  animate = false 
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.default;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium">{clampedValue.toFixed(1)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClass}`}>
        <div
          className={`${colorClass} ${sizeClass} rounded-full ${animate ? 'transition-all duration-500' : ''}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

interface DualProgressBarProps {
  physical: number;
  financial: number;
  size?: 'sm' | 'md' | 'lg';
}

export function DualProgressBar({ 
  physical, 
  financial, 
  size = 'md' 
}: DualProgressBarProps) {
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">Physical</span>
          <span className="font-medium">{physical.toFixed(1)}%</span>
        </div>
        <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClass}`}>
          <div
            className={`bg-green-500 ${sizeClass} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(100, physical)}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">Financial</span>
          <span className="font-medium">{financial.toFixed(1)}%</span>
        </div>
        <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClass}`}>
          <div
            className={`bg-blue-500 ${sizeClass} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(100, financial)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
