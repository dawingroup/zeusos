/**
 * ReclassifyAsVariantDialog Component
 * Multi-step dialog for reclassifying existing materials as variants of a parent material.
 * Supports both single and bulk reclassification.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  GitBranch,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Package,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import {
  reclassifyAsVariant,
  batchReclassifyAsVariants,
  reclassifyAsSkuOfFamily,
  batchReclassifyAsSkusOfFamily,
  searchInventory,
} from '../services/inventoryService';
import {
  COMMON_VARIANT_ATTRIBUTES,
  type InventoryListItem,
  type VariantAttribute,
} from '../types';

interface ReclassifyAsVariantDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  selectedItems: InventoryListItem[];
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

type Step = 'select-parent' | 'set-attributes' | 'processing' | 'done' | 'error';

export function ReclassifyAsVariantDialog({
  open,
  selectedIds,
  selectedItems,
  onClose,
  onComplete,
  userId,
}: ReclassifyAsVariantDialogProps) {
  const [step, setStep] = useState<Step>('select-parent');
  const [parentItem, setParentItem] = useState<InventoryListItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [attributesMap, setAttributesMap] = useState<Record<string, VariantAttribute[]>>({});
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<{ successCount: number; failureCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const isFamilyMode = parentItem?.isFamily === true;

  // Initialize attributes map when moving to set-attributes step
  const initAttributesMap = useCallback(() => {
    const map: Record<string, VariantAttribute[]> = {};
    // If parent is a family, pre-populate with its required attribute definitions
    const familyDefs: string[] = parentItem?.variantAttributeDefinitions || [];
    const defaultAttrs: VariantAttribute[] = familyDefs.length > 0
      ? familyDefs.map((key) => ({ key, value: '' }))
      : [{ key: 'color', value: '' }];
    for (const id of selectedIds) {
      map[id] = defaultAttrs.map((a) => ({ ...a }));
    }
    setAttributesMap(map);
  }, [selectedIds, parentItem]);

  // Debounced search
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchInventory(searchTerm, { limit: 20 });
        // Filter out selected items and items that are themselves variants/SKUs
        const filtered = results.filter(
          (r) =>
            !selectedIds.has(r.id) &&
            !r.parentItemId &&
            !r.familyId,
        );
        setSearchResults(filtered);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchTerm, selectedIds]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectParent = (item: InventoryListItem) => {
    setParentItem(item);
    setSearchTerm('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleContinueToAttributes = () => {
    initAttributesMap();
    setStep('set-attributes');
  };

  const handleAttributeChange = (
    itemId: string,
    index: number,
    field: 'key' | 'value',
    val: string,
  ) => {
    setAttributesMap((prev) => {
      const updated = { ...prev };
      const attrs = [...(updated[itemId] || [])];
      attrs[index] = { ...attrs[index], [field]: val };
      updated[itemId] = attrs;
      return updated;
    });
  };

  const handleAddAttribute = (itemId: string) => {
    setAttributesMap((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { key: 'color', value: '' }],
    }));
  };

  const handleRemoveAttribute = (itemId: string, index: number) => {
    setAttributesMap((prev) => {
      const attrs = [...(prev[itemId] || [])];
      if (attrs.length <= 1) return prev;
      return { ...prev, [itemId]: attrs.filter((_, i) => i !== index) };
    });
  };

  const handleProcess = async () => {
    if (!parentItem) return;
    setStep('processing');
    setError(null);

    try {
      // Clean attributes: only include those with non-empty values
      const cleanedMap: Record<string, VariantAttribute[]> = {};
      for (const [id, attrs] of Object.entries(attributesMap)) {
        cleanedMap[id] = attrs.filter((a) => a.value.trim());
      }

      const ids = Array.from(selectedIds);
      if (parentItem.isFamily) {
        // Family mode — reclassify as SKU of family
        if (ids.length === 1) {
          await reclassifyAsSkuOfFamily(ids[0], parentItem.id, cleanedMap[ids[0]] || [], userId);
          setResult({ successCount: 1, failureCount: 0 });
        } else {
          const batchResult = await batchReclassifyAsSkusOfFamily(
            ids,
            parentItem.id,
            cleanedMap,
            userId,
            (completed, total) => setProgress({ current: completed, total }),
          );
          setResult({ successCount: batchResult.successCount, failureCount: batchResult.failureCount });
        }
      } else {
        // Legacy variant mode
        if (ids.length === 1) {
          await reclassifyAsVariant(ids[0], parentItem.id, cleanedMap[ids[0]] || [], userId);
          setResult({ successCount: 1, failureCount: 0 });
        } else {
          const batchResult = await batchReclassifyAsVariants(
            ids,
            parentItem.id,
            cleanedMap,
            userId,
            (completed, total) => setProgress({ current: completed, total }),
          );
          setResult({ successCount: batchResult.successCount, failureCount: batchResult.failureCount });
        }
      }
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('error');
    }
  };

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    // Reset
    setStep('select-parent');
    setParentItem(null);
    setSearchTerm('');
    setSearchResults([]);
    setAttributesMap({});
    setProgress(null);
    setResult(null);
    setError(null);
  }, [step, onClose, onComplete]);

  const itemsArray: InventoryListItem[] = selectedItems.length > 0
    ? selectedItems
    : Array.from(selectedIds).map((id) => ({ id, sku: '', name: id, category: 'other' as const, tier: 'catalogue' as const, source: 'manual' as const, status: 'active' as const }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-500" />
            {isFamilyMode
              ? `Add to Family — ${selectedIds.size} Item${selectedIds.size !== 1 ? 's' : ''}`
              : `Make Variant${selectedIds.size > 1 ? 's' : ''} — ${selectedIds.size} Item${selectedIds.size !== 1 ? 's' : ''}`
            }
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select Parent */}
        {step === 'select-parent' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Choose a parent material or family. The selected item{selectedIds.size > 1 ? 's' : ''} will become {parentItem?.isFamily ? 'SKU' : 'variant'}{selectedIds.size > 1 ? 's' : ''} of the parent.
            </p>

            {/* Items being reclassified */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Items to reclassify
              </label>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {itemsArray.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded text-sm"
                  >
                    <Package className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{item.displayName || item.name}</span>
                    {item.sku && <span className="text-xs text-gray-400 font-mono">{item.sku}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-gray-300 rotate-90" />
            </div>

            {/* Parent selector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Parent material
              </label>

              {parentItem ? (
                <div className={`flex items-center justify-between p-3 rounded-lg border ${parentItem.isFamily ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className={`w-4 h-4 flex-shrink-0 ${parentItem.isFamily ? 'text-emerald-500' : 'text-indigo-500'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                        {parentItem.displayName || parentItem.name}
                        {parentItem.isFamily && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">Family</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{parentItem.sku}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setParentItem(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div ref={containerRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search for parent material..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </div>

                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-indigo-50"
                          onClick={() => handleSelectParent(item)}
                        >
                          <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              {item.displayName || item.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="font-mono">{item.sku}</span>
                              {item.isFamily && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">
                                  Family
                                </span>
                              )}
                              {item.isVariantParent && !item.isFamily && (
                                <span className="text-indigo-500">
                                  <GitBranch className="inline w-3 h-3" /> {item.variantCount || 0} variants
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {showDropdown && !searching && searchResults.length === 0 && searchTerm.trim().length >= 2 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-4 text-center text-xs text-gray-400">
                      No matching items found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Set Attributes */}
        {step === 'set-attributes' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
              <GitBranch className="w-4 h-4 text-indigo-500" />
              <span className="text-sm text-indigo-800">
                Parent: <strong>{parentItem?.displayName || parentItem?.name}</strong>
              </span>
            </div>

            <p className="text-sm text-gray-500">
              {isFamilyMode
                ? 'Set variant attributes for each item. These must match the family\'s attribute definitions.'
                : 'Set variant attributes for each item (optional). These describe what makes each variant unique.'
              }
            </p>

            <div className="max-h-64 overflow-y-auto space-y-4">
              {itemsArray.map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <h4 className="text-xs font-medium text-gray-700 truncate">
                    {item.displayName || item.name}
                  </h4>

                  {(attributesMap[item.id] || []).map((attr, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={attr.key}
                        onChange={(e) => handleAttributeChange(item.id, index, 'key', e.target.value)}
                        className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400"
                      >
                        {COMMON_VARIANT_ATTRIBUTES.map((k) => (
                          <option key={k} value={k}>
                            {k.charAt(0).toUpperCase() + k.slice(1)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => handleAttributeChange(item.id, index, 'value', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400"
                        placeholder={`e.g., ${attr.key === 'color' ? 'White' : attr.key === 'finish' ? 'Matte' : 'Value'}`}
                      />
                      {(attributesMap[item.id]?.length || 0) > 1 && (
                        <button
                          onClick={() => handleRemoveAttribute(item.id, index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => handleAddAttribute(item.id)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    + Add attribute
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm text-gray-500">
              Reclassifying {progress?.current ?? 0} of {progress?.total ?? selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}...
            </p>
            {selectedIds.size > 1 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-700 font-medium">
              {result?.successCount ?? 0} item{(result?.successCount ?? 0) !== 1 ? 's' : ''} {parentItem?.isFamily ? 'added as SKU' : 'reclassified as variant'}{(result?.successCount ?? 0) !== 1 ? 's' : ''} of {parentItem?.displayName || parentItem?.name}
            </p>
            {(result?.failureCount ?? 0) > 0 && (
              <p className="text-sm text-red-600">
                {result?.failureCount} item{result!.failureCount !== 1 ? 's' : ''} failed
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-600">{error || 'An error occurred'}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'select-parent' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleContinueToAttributes}
                disabled={!parentItem}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Continue
              </Button>
            </div>
          )}
          {step === 'set-attributes' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('select-parent')}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleProcess}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isFamilyMode ? 'Add to Family' : 'Reclassify'} {selectedIds.size > 1 ? `${selectedIds.size} Items` : 'Item'}
              </Button>
            </div>
          )}
          {(step === 'done' || step === 'error') && (
            <Button variant="outline" size="sm" onClick={handleClose}>
              {step === 'done' ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
