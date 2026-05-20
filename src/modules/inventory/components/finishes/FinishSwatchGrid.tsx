/**
 * FinishSwatchGrid Component
 * Grid view of finish color swatches.
 */

import { Loader2 } from 'lucide-react';
import type { FinishDocument } from '../../types';

interface FinishSwatchGridProps {
  finishes: FinishDocument[];
  loading: boolean;
  onSelect: (finish: FinishDocument) => void;
  selectedId?: string;
}

export function FinishSwatchGrid({
  finishes,
  loading,
  onSelect,
  selectedId,
}: FinishSwatchGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (finishes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">No finishes found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      {finishes.map(finish => {
        const isSelected = finish.id === selectedId;
        return (
          <button
            key={finish.id}
            type="button"
            onClick={() => onSelect(finish)}
            className={`
              group flex flex-col items-center p-2 rounded-lg border-2 transition-all
              ${isSelected
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}
            `}
          >
            {/* Swatch */}
            <div
              className="w-full aspect-square rounded-md border border-gray-200 mb-2 shadow-sm"
              style={{
                backgroundColor: finish.hexColor || '#ccc',
                backgroundImage: finish.thumbnailUrl ? `url(${finish.thumbnailUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Name */}
            <p className="text-xs font-medium text-gray-900 truncate w-full text-center">
              {finish.name}
            </p>

            {/* Code */}
            <p className="text-[10px] text-gray-400 font-mono truncate w-full text-center">
              {finish.code}
            </p>

            {/* Availability indicator */}
            {finish.availability !== 'in_stock' && (
              <span className={`mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                finish.availability === 'made_to_order' ? 'bg-blue-100 text-blue-600' :
                finish.availability === 'discontinued' ? 'bg-red-100 text-red-600' :
                'bg-yellow-100 text-yellow-600'
              }`}>
                {finish.availability === 'made_to_order' ? 'MTO' :
                 finish.availability === 'discontinued' ? 'Disc.' : 'Seasonal'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
