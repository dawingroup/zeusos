/**
 * FinishSwatchChip Component
 * Reusable chip showing a finish color swatch + name.
 * Used across finish library, product config, and estimation picker.
 */

import { X, Star } from 'lucide-react';

interface FinishSwatchChipProps {
  name: string;
  code?: string;
  hexColor?: string;
  thumbnailUrl?: string;
  isDefault?: boolean;
  isSelected?: boolean;
  onRemove?: () => void;
  onSetDefault?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function FinishSwatchChip({
  name,
  code,
  hexColor,
  thumbnailUrl,
  isDefault,
  isSelected,
  onRemove,
  onSetDefault,
  onClick,
  size = 'md',
}: FinishSwatchChipProps) {
  const sizeClasses = {
    sm: 'h-6 text-xs px-2 gap-1',
    md: 'h-8 text-sm px-3 gap-1.5',
    lg: 'h-10 text-sm px-4 gap-2',
  };

  const swatchSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border
        ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-300 bg-white'}
        ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}
        ${sizeClasses[size]}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Color swatch */}
      <span
        className={`rounded-full border border-gray-200 flex-shrink-0 ${swatchSizes[size]}`}
        style={{
          backgroundColor: hexColor || '#ccc',
          backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : undefined,
          backgroundSize: 'cover',
        }}
      />

      {/* Name */}
      <span className="truncate max-w-[120px]">{name}</span>

      {/* Code */}
      {code && size !== 'sm' && (
        <span className="text-gray-400 text-xs">{code}</span>
      )}

      {/* Default star */}
      {isDefault && (
        <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
      )}

      {/* Set default button */}
      {onSetDefault && !isDefault && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
          className="text-gray-400 hover:text-amber-500"
          title="Set as default"
        >
          <Star className="w-3 h-3" />
        </button>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-gray-400 hover:text-red-500"
          title="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
