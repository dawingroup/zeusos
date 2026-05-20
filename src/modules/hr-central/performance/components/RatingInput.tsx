// ============================================================================
// RATING INPUT
// DawinOS v2.0 - HR Module
// Star rating input component
// ============================================================================

import React from 'react';
import { Star } from 'lucide-react';
import { FIVE_POINT_RATINGS } from '../constants/performance.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface RatingInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  description?: string;
  disabled?: boolean;
  showLabels?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const RatingInput: React.FC<RatingInputProps> = ({
  label,
  value,
  onChange,
  description,
  disabled = false,
  showLabels = true,
  size = 'medium',
}) => {
  const getRatingLabel = (rating: number | null) => {
    if (!rating) return '';
    const ratingInfo = Object.values(FIVE_POINT_RATINGS).find(r => r.value === rating);
    return ratingInfo?.label || '';
  };
  
  const getRatingDescription = (rating: number | null) => {
    if (!rating) return '';
    const ratingInfo = Object.values(FIVE_POINT_RATINGS).find(r => r.value === rating);
    return ratingInfo?.description || '';
  };

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6',
  };

  const starSize = sizeClasses[size];
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {description && (
        <p className="text-sm text-gray-500 mb-2">
          {description}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => !disabled && onChange(star === value ? null : star)}
              disabled={disabled}
              className={`p-0.5 rounded transition-colors ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
              }`}
            >
              <Star
                className={`${starSize} transition-colors ${
                  value && star <= value
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
        {showLabels && value && (
          <span 
            className="text-sm font-medium text-indigo-600"
            title={getRatingDescription(value)}
          >
            {value} - {getRatingLabel(value)}
          </span>
        )}
      </div>
    </div>
  );
};
