/**
 * ArchetypeSelector — Search/browse product archetypes for PDD initialization
 */
import { useState } from 'react';
import { useDKBSearch } from '../../hooks/useDesignKB';
import type { ProductArchetypeEntry } from '../../types/knowledgeBase.types';

interface ArchetypeSelectorProps {
  onSelect: (archetype: ProductArchetypeEntry) => void;
}

export function ArchetypeSelector({ onSelect }: ArchetypeSelectorProps) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useDKBSearch(
    query || 'cabinet wardrobe table chair',
    'product_archetype',
  );

  const archetypes = (results || []) as ProductArchetypeEntry[];

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search archetypes (e.g. kitchen base, wardrobe, dining table)..."
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {archetypes.map(arch => (
            <button
              key={arch.id}
              type="button"
              onClick={() => onSelect(arch)}
              className="rounded-lg border p-3 text-left hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <h4 className="text-sm font-medium">{arch.name}</h4>
              <p className="text-xs text-gray-500 mt-1">
                {arch.standardDimensions.width.default} x {arch.standardDimensions.depth.default} x{' '}
                {arch.standardDimensions.height.default} mm
              </p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">{arch.productType}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
