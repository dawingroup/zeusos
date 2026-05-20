/**
 * Progress Donut - Circular progress indicator
 */

interface ProgressDonutProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  status?: 'success' | 'warning' | 'danger' | 'default';
}

const STATUS_COLORS = {
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  default: '#6366F1',
};

export function ProgressDonut({
  value,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  status = 'default',
}: ProgressDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
  const color = STATUS_COLORS[status];

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">
          {clampedValue.toFixed(0)}%
        </span>
        {label && (
          <span className="text-xs text-gray-500">{label}</span>
        )}
        {sublabel && (
          <span className="text-xs text-gray-400">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

interface DualProgressRingProps {
  physical: number;
  financial: number;
  size?: number;
}

export function DualProgressRing({
  physical,
  financial,
  size = 140,
}: DualProgressRingProps) {
  const outerRadius = (size - 12) / 2;
  const innerRadius = outerRadius - 14;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Outer ring - Physical */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius}
          stroke="#E5E7EB"
          strokeWidth={10}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius}
          stroke="#059669"
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={outerCircumference}
          strokeDashoffset={outerCircumference - (physical / 100) * outerCircumference}
          className="transition-all duration-500"
        />
        
        {/* Inner ring - Financial */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerRadius}
          stroke="#E5E7EB"
          strokeWidth={8}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerRadius}
          stroke="#3B82F6"
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={innerCircumference}
          strokeDashoffset={innerCircumference - (financial / 100) * innerCircumference}
          className="transition-all duration-500"
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold text-green-600">{physical.toFixed(0)}%</span>
        <span className="text-xs text-gray-500">Physical</span>
        <span className="text-sm font-medium text-blue-600 mt-1">{financial.toFixed(0)}%</span>
        <span className="text-xs text-gray-500">Financial</span>
      </div>
    </div>
  );
}
