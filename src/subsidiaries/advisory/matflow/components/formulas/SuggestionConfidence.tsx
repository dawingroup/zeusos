/**
 * Suggestion Confidence Component
 * Visual indicator for formula suggestion confidence levels
 */

import React from 'react';

interface SuggestionConfidenceProps {
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
  isSelected?: boolean;
}

export const SuggestionConfidence: React.FC<SuggestionConfidenceProps> = ({
  confidence,
  size = 'md',
  isSelected = false,
}) => {
  const percentage = Math.round(confidence * 100);
  
  // Determine color based on confidence
  const getColor = () => {
    if (isSelected) return { ring: 'stroke-white', fill: 'stroke-purple-300' };
    if (confidence >= 0.85) return { ring: 'stroke-green-500', fill: 'stroke-green-200' };
    if (confidence >= 0.65) return { ring: 'stroke-amber-500', fill: 'stroke-amber-200' };
    if (confidence >= 0.45) return { ring: 'stroke-orange-500', fill: 'stroke-orange-200' };
    return { ring: 'stroke-red-500', fill: 'stroke-red-200' };
  };

  const colors = getColor();
  
  const sizeConfig = {
    sm: { size: 28, strokeWidth: 3, fontSize: 'text-[9px]' },
    md: { size: 36, strokeWidth: 4, fontSize: 'text-[10px]' },
    lg: { size: 48, strokeWidth: 5, fontSize: 'text-xs' },
  };

  const { size: ringSize, strokeWidth, fontSize } = sizeConfig[size];
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (confidence * circumference);

  return (
    <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
      <svg
        className="transform -rotate-90"
        width={ringSize}
        height={ringSize}
      >
        {/* Background circle */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={colors.fill}
        />
        {/* Progress circle */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colors.ring} transition-all duration-500`}
        />
      </svg>
      <span className={`absolute font-bold ${fontSize} ${isSelected ? 'text-white' : 'text-gray-700'}`}>
        {percentage}
      </span>
    </div>
  );
};

/**
 * Simple linear confidence bar
 */
interface ConfidenceBarProps {
  confidence: number;
  showLabel?: boolean;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  confidence,
  showLabel = true,
}) => {
  const percentage = Math.round(confidence * 100);
  
  const getColorClass = () => {
    if (confidence >= 0.85) return 'bg-green-500';
    if (confidence >= 0.65) return 'bg-amber-500';
    if (confidence >= 0.45) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColorClass()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 w-10 text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
};

export default SuggestionConfidence;
