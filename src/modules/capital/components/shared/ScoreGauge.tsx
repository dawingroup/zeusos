import React from 'react';
import {
  READINESS_LEVEL_LABELS,
  READINESS_LEVEL_COLORS,
} from '../../constants/capital.constants';
import { getReadinessLevel } from '../../services/readinessService';

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLevel?: boolean;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  label,
  size = 'md',
  showLevel = true,
}) => {
  const level = getReadinessLevel(score);
  const color = READINESS_LEVEL_COLORS[level] || '#9E9E9E';
  const levelLabel = READINESS_LEVEL_LABELS[level] || '';

  const sizeConfig = {
    sm: { width: 60, height: 60, textSize: 'text-sm', strokeWidth: 4 },
    md: { width: 100, height: 100, textSize: 'text-xl', strokeWidth: 6 },
    lg: { width: 140, height: 140, textSize: 'text-3xl', strokeWidth: 8 },
  };

  const { width, height, textSize, strokeWidth } = sizeConfig[size];
  const radius = (width - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-xs text-muted-foreground font-medium">{label}</span>}
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="-rotate-90">
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${textSize}`} style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      {showLevel && (
        <span className="text-xs text-muted-foreground text-center max-w-[120px]">
          {levelLabel}
        </span>
      )}
    </div>
  );
};

export default ScoreGauge;
