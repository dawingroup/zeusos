/**
 * Quality Score Badge Component
 * Displays product quality/audit score with appropriate styling
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, Star } from 'lucide-react';

interface QualityScoreBadgeProps {
  score: number | null | undefined;
  maxScore?: number;
  variant?: 'badge' | 'star' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const getScoreConfig = (score: number | null | undefined, maxScore: number) => {
  if (score === null || score === undefined) {
    return {
      label: 'Not Audited',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
      icon: HelpCircle,
      grade: '?',
    };
  }

  const normalizedScore = (score / maxScore) * 100;

  if (normalizedScore >= 90) {
    return {
      label: 'Excellent',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-100',
      borderColor: 'border-emerald-300',
      icon: CheckCircle,
      grade: 'A',
    };
  } else if (normalizedScore >= 75) {
    return {
      label: 'Good',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300',
      icon: CheckCircle,
      grade: 'B',
    };
  } else if (normalizedScore >= 60) {
    return {
      label: 'Fair',
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
      borderColor: 'border-amber-300',
      icon: AlertTriangle,
      grade: 'C',
    };
  } else if (normalizedScore >= 40) {
    return {
      label: 'Needs Work',
      color: 'text-orange-700',
      bgColor: 'bg-orange-100',
      borderColor: 'border-orange-300',
      icon: AlertTriangle,
      grade: 'D',
    };
  } else {
    return {
      label: 'Poor',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-300',
      icon: XCircle,
      grade: 'F',
    };
  }
};

const sizeConfig = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'w-3 h-3',
    star: 'w-3 h-3',
    gap: 'gap-1',
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'w-4 h-4',
    star: 'w-4 h-4',
    gap: 'gap-1.5',
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 'w-5 h-5',
    star: 'w-5 h-5',
    gap: 'gap-2',
  },
};

export const QualityScoreBadge: React.FC<QualityScoreBadgeProps> = ({
  score,
  maxScore = 100,
  variant = 'badge',
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const config = getScoreConfig(score, maxScore);
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  if (variant === 'star') {
    // Star rating variant (1-5 stars)
    const starCount = score !== null && score !== undefined
      ? Math.round((score / maxScore) * 5)
      : 0;

    return (
      <div className={`inline-flex items-center ${sizes.gap} ${className}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizes.star} ${
              star <= starCount
                ? 'text-amber-400 fill-amber-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        {showLabel && score !== null && score !== undefined && (
          <span className={`${sizes.badge} ${config.color} font-medium`}>
            {score}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'pill') {
    // Pill with grade letter
    return (
      <span
        className={`
          inline-flex items-center ${sizes.gap} ${sizes.badge}
          ${config.bgColor} ${config.color}
          border ${config.borderColor}
          rounded-full font-semibold
          ${className}
        `.trim()}
      >
        <span className="font-bold">{config.grade}</span>
        {showLabel && score !== null && score !== undefined && (
          <span className="opacity-75">({score})</span>
        )}
      </span>
    );
  }

  // Default badge variant
  return (
    <span
      className={`
        inline-flex items-center ${sizes.gap} ${sizes.badge}
        ${config.bgColor} ${config.color}
        border ${config.borderColor}
        rounded-md font-medium
        ${className}
      `.trim()}
    >
      <Icon className={sizes.icon} />
      {showLabel && (
        <span>
          {score !== null && score !== undefined ? (
            <>
              {score}/{maxScore}
              <span className="ml-1 opacity-75">({config.label})</span>
            </>
          ) : (
            config.label
          )}
        </span>
      )}
    </span>
  );
};

/**
 * Mini score indicator for list views
 */
interface MiniScoreProps {
  score: number | null | undefined;
  maxScore?: number;
  className?: string;
}

export const MiniQualityScore: React.FC<MiniScoreProps> = ({
  score,
  maxScore = 100,
  className = '',
}) => {
  const config = getScoreConfig(score, maxScore);

  return (
    <span
      className={`
        inline-flex items-center justify-center
        w-8 h-8 rounded-full text-xs font-bold
        ${config.bgColor} ${config.color}
        ${className}
      `.trim()}
      title={score !== null && score !== undefined ? `Quality: ${score}/${maxScore}` : 'Not audited'}
    >
      {config.grade}
    </span>
  );
};

export default QualityScoreBadge;
