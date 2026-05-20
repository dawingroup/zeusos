/**
 * FinishSelector Component
 * Swatch grid for selecting a finish from linked finishes or the full library.
 */

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { FinishDocument, LinkedFinish } from '@/modules/inventory/types';

interface FinishSelectorProps {
  finishes: FinishDocument[];
  linkedFinishes?: LinkedFinish[];
  selectedFinishId?: string;
  onSelect: (finish: FinishDocument) => void;
  loading?: boolean;
}

export function FinishSelector({
  finishes,
  linkedFinishes,
  selectedFinishId,
  onSelect,
  loading,
}: FinishSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // If linkedFinishes exist, show only those (enriched with finish data)
  const displayFinishes = useMemo(() => {
    let list = finishes;

    if (linkedFinishes && linkedFinishes.length > 0) {
      const linkedIds = new Set(linkedFinishes.map(lf => lf.finishId));
      list = finishes.filter(f => linkedIds.has(f.id));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(term) ||
        f.code.toLowerCase().includes(term)
      );
    }

    return list;
  }, [finishes, linkedFinishes, searchTerm]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Select Finish</p>
        <span className="text-xs text-gray-400">{displayFinishes.length} available</span>
      </div>

      {/* Search */}
      {finishes.length > 6 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search finishes..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Swatch grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
        {displayFinishes.map(finish => (
          <button
            key={finish.id}
            type="button"
            onClick={() => onSelect(finish)}
            className={`
              flex flex-col items-center p-2 rounded-lg border-2 transition-all text-center
              ${finish.id === selectedFinishId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'}
            `}
          >
            <div
              className="w-8 h-8 rounded-md border border-gray-200 mb-1"
              style={{
                backgroundColor: finish.hexColor || '#ccc',
                backgroundImage: finish.thumbnailUrl ? `url(${finish.thumbnailUrl})` : undefined,
                backgroundSize: 'cover',
              }}
            />
            <span className="text-xs truncate w-full">{finish.name}</span>
          </button>
        ))}
      </div>

      {displayFinishes.length === 0 && !loading && (
        <p className="text-sm text-gray-500 text-center py-4">No finishes available</p>
      )}
    </div>
  );
}
