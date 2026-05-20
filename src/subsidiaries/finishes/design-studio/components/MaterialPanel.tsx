/**
 * MaterialPanel — Swatch picker for live material swapping
 *
 * Lists all model materials with their resolved Finish Library matches.
 * Click a material row to expand and see available finishes for swapping.
 */

import { useState, useMemo } from 'react';
import { Palette, RotateCcw, Check, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useFinishLibrary } from '@/modules/inventory/hooks/useFinishLibrary';
import type { FinishCategory } from '@/modules/inventory/types/finishLibrary';
import type { MaterialMapping } from '../services/materialResolverService';

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  code: { label: 'Exact', color: 'bg-green-100 text-green-700' },
  name: { label: 'Name', color: 'bg-green-100 text-green-700' },
  fuzzy_name: { label: 'Fuzzy', color: 'bg-amber-100 text-amber-700' },
  fuzzy_code: { label: 'Code~', color: 'bg-amber-100 text-amber-700' },
  color: { label: 'Color', color: 'bg-blue-100 text-blue-700' },
  none: { label: 'None', color: 'bg-gray-100 text-gray-500' },
};

interface MaterialPanelProps {
  materialMappings: MaterialMapping[];
  onSwapMaterial: (materialName: string, finishId: string) => void;
  onResetMaterial: (materialName: string) => void;
  onResetAll: () => void;
  overrides: Map<string, string>;
  /** P21.7 — how many mappings were resolved via the project palette. */
  paletteMatchedCount?: number;
}

export default function MaterialPanel({
  materialMappings,
  onSwapMaterial,
  onResetMaterial,
  onResetAll,
  overrides,
  paletteMatchedCount = 0,
}: MaterialPanelProps) {
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FinishCategory | ''>('');
  const { finishes } = useFinishLibrary({ isActive: true });

  const filteredFinishes = useMemo(() => {
    let list = finishes;
    if (categoryFilter) list = list.filter(f => f.category === categoryFilter);
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q) ||
        (f.tags || []).some(t => t.toLowerCase().includes(q)),
      );
    }
    return list.slice(0, 50); // limit for performance
  }, [finishes, categoryFilter, searchText]);

  const hasOverrides = overrides.size > 0;

  return (
    <div className="flex flex-col gap-2 p-2 sm:p-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Materials ({materialMappings.length})
          </span>
          {paletteMatchedCount > 0 && (
            <span
              className="px-1 py-0.5 rounded text-[9px] font-medium bg-emerald-100 text-emerald-800"
              title="Matches resolved from the project's material palette"
            >
              {paletteMatchedCount} from palette
            </span>
          )}
        </div>
        {hasOverrides && (
          <button
            onClick={onResetAll}
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
          >
            <RotateCcw className="h-3 w-3" />
            Reset all
          </button>
        )}
      </div>

      {/* Material list */}
      <div className="divide-y divide-border border rounded-lg overflow-hidden">
        {materialMappings.map((mapping) => {
          const isExpanded = expandedMaterial === mapping.threeDsMaterialName;
          const isOverridden = overrides.has(mapping.threeDsMaterialName);
          const badge = CONFIDENCE_LABELS[mapping.matchedOn] || CONFIDENCE_LABELS.none;

          return (
            <div key={mapping.threeDsMaterialName}>
              {/* Material row */}
              <button
                onClick={() => setExpandedMaterial(isExpanded ? null : mapping.threeDsMaterialName)}
                className={`w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-muted/30 transition-colors ${
                  isExpanded ? 'bg-muted/20' : ''
                }`}
              >
                {/* Color swatch */}
                <div
                  className="w-5 h-5 rounded border border-border shrink-0"
                  style={{ backgroundColor: mapping.hexColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {mapping.finishName || mapping.threeDsMaterialName}
                  </div>
                  {mapping.finishName && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {mapping.threeDsMaterialName}
                    </div>
                  )}
                </div>
                <span className={`px-1 py-0.5 rounded text-[8px] font-medium shrink-0 ${badge.color}`}>
                  {badge.label}
                </span>
                {/* P21.7 — palette hit: the resolver picked a finish that's
                    on the project's curated materialPalette. Signals to
                    the user that this match is on-brief, not a stray
                    Finish Library lookalike. */}
                {mapping.viaProjectPalette && (
                  <span
                    className="px-1 py-0.5 rounded text-[8px] font-medium shrink-0 bg-emerald-100 text-emerald-800"
                    title="Matched from project's material palette"
                  >
                    Palette
                  </span>
                )}
                {isOverridden && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onResetMaterial(mapping.threeDsMaterialName); }}
                    className="p-0.5 hover:bg-muted rounded shrink-0"
                    title="Reset to original"
                  >
                    <RotateCcw className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              </button>

              {/* Expanded: finish picker */}
              {isExpanded && (
                <div className="px-2 py-2 bg-muted/10 border-t border-border">
                  {/* Search & filter */}
                  <div className="flex flex-col sm:flex-row gap-1 mb-2">
                    <div className="flex-1 relative min-w-0">
                      <Search className="h-3 w-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search finishes..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full pl-5 pr-2 py-1 text-[10px] border rounded bg-background"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as FinishCategory | '')}
                      className="text-[10px] border rounded px-1 py-1 bg-background sm:w-auto"
                    >
                      <option value="">All</option>
                      <option value="board">Board</option>
                      <option value="paint">Paint</option>
                      <option value="laminate">Laminate</option>
                      <option value="veneer">Veneer</option>
                      <option value="fabric">Fabric</option>
                      <option value="metal">Metal</option>
                    </select>
                  </div>

                  {/* Swatch grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 max-h-[220px] overflow-y-auto">
                    {filteredFinishes.map((finish) => {
                      const isSelected = overrides.get(mapping.threeDsMaterialName) === finish.id;
                      return (
                        <button
                          key={finish.id}
                          onClick={() => onSwapMaterial(mapping.threeDsMaterialName, finish.id)}
                          className={`
                            flex flex-col items-center gap-0.5 p-1 rounded border transition-colors
                            ${isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-transparent hover:border-border hover:bg-muted/30'
                            }
                          `}
                          title={`${finish.name} (${finish.code})`}
                        >
                          <div className="relative">
                            <div
                              className="w-8 h-8 rounded border border-border"
                              style={{ backgroundColor: finish.hexColor || '#CCC' }}
                            />
                            {isSelected && (
                              <Check className="h-3 w-3 absolute top-0.5 right-0.5 text-primary" />
                            )}
                          </div>
                          <span className="text-[7px] text-center leading-tight truncate w-full">
                            {finish.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {filteredFinishes.length === 0 && (
                    <div className="text-[10px] text-muted-foreground text-center py-2">
                      No finishes found
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
