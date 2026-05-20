/**
 * KBBrowser — Full Design Knowledge Base browser
 *
 * Shows DKB entries from Firestore with option to view source wiki article.
 */
import { useState } from 'react';
import { useDKBSearch } from '../../hooks/useDesignKB';
import type { DKBEntryType } from '../../constants/knowledgeBase.constants';
import { DKB_ENTRY_TYPES } from '../../constants/knowledgeBase.constants';

interface KBBrowserProps {
  entryType?: DKBEntryType;
  searchQuery?: string;
}

const ENTRY_TYPE_LABELS: Record<DKBEntryType, string> = {
  component: 'Components',
  assembly_pattern: 'Assembly Patterns',
  hardware_spec: 'Hardware Specs',
  material_rule: 'Material Rules',
  product_archetype: 'Product Archetypes',
  dimensional_standard: 'Dimensional Standards',
};

export function KBBrowser({ entryType: initialType, searchQuery: initialQuery }: KBBrowserProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [selectedType, setSelectedType] = useState<DKBEntryType | undefined>(initialType);

  const { data: entries, isLoading } = useDKBSearch(query || 'a', selectedType, query.length >= 1);

  return (
    <div className="space-y-4">
      {/* Search + Filter */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search knowledge base..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={selectedType || ''}
          onChange={e => setSelectedType((e.target.value || undefined) as DKBEntryType | undefined)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {DKB_ENTRY_TYPES.map(type => (
            <option key={type} value={type}>
              {ENTRY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {entries?.map(entry => (
            <div key={entry.id} className="rounded-lg border p-3 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">{entry.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {ENTRY_TYPE_LABELS[entry.entryType]}
                </span>
              </div>
              <div className="flex gap-1 mt-2">
                {entry.tags.slice(0, 5).map(tag => (
                  <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )) ?? (
            <p className="text-sm text-gray-500">No entries found. Try a different search.</p>
          )}
        </div>
      )}
    </div>
  );
}
