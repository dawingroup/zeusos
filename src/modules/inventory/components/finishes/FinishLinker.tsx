/**
 * FinishLinker Component
 * Search, link/unlink finishes to a product, manage defaults and overrides.
 */

import { useState, useMemo } from 'react';
import { Search, Link2, Loader2 } from 'lucide-react';
import type { FinishDocument, FinishCategory, LinkedFinish } from '../../types';
import { useFinishLibrary } from '../../hooks/useFinishLibrary';
import { FinishSwatchChip } from './FinishSwatchChip';

interface FinishLinkerProps {
  organizationId: string;
  category?: FinishCategory;
  subtype?: string;
  linkedFinishes: LinkedFinish[];
  onChange: (linkedFinishes: LinkedFinish[]) => void;
}

export function FinishLinker({
  organizationId,
  category,
  subtype,
  linkedFinishes,
  onChange,
}: FinishLinkerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { finishes: allFinishes, loading } = useFinishLibrary({
    organizationId,
    category,
    isActive: true,
  });

  const linkedIds = new Set(linkedFinishes.map(lf => lf.finishId));

  // Filter available finishes
  const available = useMemo(() => {
    let filtered = allFinishes.filter(f => !linkedIds.has(f.id));
    if (subtype) {
      filtered = filtered.filter(f => f.subtype === subtype);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(term) ||
        f.code.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [allFinishes, linkedIds, subtype, searchTerm]);

  // All finishes matching the subtype that aren't linked yet
  const unlinkdInSubtype = useMemo(() => {
    if (!subtype) return [];
    return allFinishes.filter(f => f.subtype === subtype && !linkedIds.has(f.id));
  }, [allFinishes, subtype, linkedIds]);

  const handleLink = (finish: FinishDocument) => {
    const newLinked: LinkedFinish = {
      finishId: finish.id,
      finishName: finish.name,
      finishCode: finish.code,
      isDefault: linkedFinishes.length === 0, // first one is default
    };
    onChange([...linkedFinishes, newLinked]);
  };

  const handleUnlink = (finishId: string) => {
    const updated = linkedFinishes.filter(lf => lf.finishId !== finishId);
    // If we removed the default, make the first one default
    if (updated.length > 0 && !updated.some(lf => lf.isDefault)) {
      updated[0].isDefault = true;
    }
    onChange(updated);
  };

  const handleSetDefault = (finishId: string) => {
    const updated = linkedFinishes.map(lf => ({
      ...lf,
      isDefault: lf.finishId === finishId,
    }));
    onChange(updated);
  };

  const handleCostOverride = (finishId: string, costOverride: number | undefined) => {
    const updated = linkedFinishes.map(lf =>
      lf.finishId === finishId ? { ...lf, costOverride } : lf
    );
    onChange(updated);
  };

  const handleLinkAllInSubtype = () => {
    const newEntries: LinkedFinish[] = unlinkdInSubtype.map(f => ({
      finishId: f.id,
      finishName: f.name,
      finishCode: f.code,
    }));
    const updated = [...linkedFinishes, ...newEntries];
    if (!updated.some(lf => lf.isDefault) && updated.length > 0) {
      updated[0].isDefault = true;
    }
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Linked finishes */}
      {linkedFinishes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Linked Finishes ({linkedFinishes.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {linkedFinishes.map(lf => (
              <div key={lf.finishId} className="flex items-center gap-1">
                <FinishSwatchChip
                  name={lf.finishName}
                  code={lf.finishCode}
                  hexColor={allFinishes.find(f => f.id === lf.finishId)?.hexColor}
                  isDefault={lf.isDefault}
                  onSetDefault={() => handleSetDefault(lf.finishId)}
                  onRemove={() => handleUnlink(lf.finishId)}
                />
                {/* Inline cost override */}
                <input
                  type="number"
                  value={lf.costOverride ?? ''}
                  onChange={e => handleCostOverride(
                    lf.finishId,
                    e.target.value ? Number(e.target.value) : undefined
                  )}
                  placeholder="Override"
                  className="w-20 px-1.5 py-0.5 border border-gray-200 rounded text-xs"
                  title="Cost override for this finish"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search / Add controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
        >
          <Link2 className="w-3.5 h-3.5" />
          Link Finishes
        </button>

        {subtype && unlinkdInSubtype.length > 0 && (
          <button
            type="button"
            onClick={handleLinkAllInSubtype}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Link All {String(subtype).replace(/_/g, ' ')} ({unlinkdInSubtype.length})
          </button>
        )}
      </div>

      {/* Search dropdown */}
      {showSearch && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search finishes to link..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && available.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-2">
              {searchTerm ? 'No matching finishes found' : 'All finishes already linked'}
            </p>
          )}

          {!loading && available.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {available.slice(0, 20).map(finish => (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => handleLink(finish)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left rounded-md hover:bg-white"
                >
                  <span
                    className="w-5 h-5 rounded-md border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: finish.hexColor || '#ccc' }}
                  />
                  <span className="font-medium">{finish.name}</span>
                  <span className="text-gray-400 text-xs font-mono">{finish.code}</span>
                </button>
              ))}
              {available.length > 20 && (
                <p className="text-xs text-gray-400 text-center py-1">
                  +{available.length - 20} more — refine your search
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
