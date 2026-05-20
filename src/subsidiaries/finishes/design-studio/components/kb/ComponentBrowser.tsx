/**
 * ComponentBrowser — Searchable/filterable list of DKB components
 * Grouped by category (panels, hardware, etc.)
 */
import { useState } from 'react';
import { useDKBSearch } from '../../hooks/useDesignKB';
import type { ComponentEntry } from '../../types/knowledgeBase.types';

interface ComponentBrowserProps {
  onSelect?: (component: ComponentEntry) => void;
}

export function ComponentBrowser({ onSelect }: ComponentBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: results, isLoading } = useDKBSearch(
    searchQuery || 'panel', // Default to showing panels
    'component',
    searchQuery.length >= 2 || searchQuery === '',
  );

  const components = (results || []).filter(
    (e): e is ComponentEntry => e.entryType === 'component',
  );

  // Group by category
  const grouped = components.reduce<Record<string, ComponentEntry[]>>((acc, comp) => {
    const cat = comp.componentCategory || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(comp);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-2 p-2">
      <input
        type="text"
        placeholder="Search components..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
      />

      {isLoading && (
        <div className="text-[10px] text-muted-foreground text-center py-2">Loading...</div>
      )}

      {Object.entries(grouped).map(([category, comps]) => (
        <div key={category}>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {category}
          </div>
          {comps.map((comp) => (
            <button
              key={comp.id}
              onClick={() => onSelect?.(comp)}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs flex flex-col gap-0.5"
            >
              <span className="font-medium">{comp.name}</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {comp.dimensions.width.default}×{comp.dimensions.depth.default}×{comp.dimensions.height.default}mm
              </span>
            </button>
          ))}
        </div>
      ))}

      {!isLoading && components.length === 0 && (
        <div className="text-[10px] text-muted-foreground text-center py-4">
          No components found. Compile the DKB to populate entries.
        </div>
      )}
    </div>
  );
}
