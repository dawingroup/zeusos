/**
 * MergeItemsDialog Component
 * Merges selected inventory items into a target item.
 * Transfers stock, supplier pricing, tags, aliases, and archives source items.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  GitMerge,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Package,
  X,
  ArrowRight,
  Boxes,
  DollarSign,
  Tags,
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
  searchInventory,
  getInventoryItem,
  updateInventoryItem,
} from '../services/inventoryService';
import { transferStockToItem } from '../services/stockLevelService';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { InventoryListItem } from '../types';

/**
 * Repoint all PO line items and procurement requirements from sourceItemId to targetItemId.
 * Records audit entries (revisionHistory + businessEvent) on each affected PO.
 */
async function repointReferencesToTarget(
  sourceItemId: string,
  targetItemId: string,
  targetName: string,
  targetSku: string,
  sourceName: string,
  userId: string,
): Promise<{ posUpdated: number; requirementsUpdated: number }> {
  let posUpdated = 0;
  let requirementsUpdated = 0;

  // 1. Repoint PO line items
  const poQuery = query(collection(db, 'purchaseOrders'));
  const poSnap = await getDocs(poQuery);

  for (const poDoc of poSnap.docs) {
    const poData = poDoc.data();
    const lineItems = poData.lineItems || [];
    let changed = false;
    const changes: Array<{ field: string; lineItemId?: string; previousValue: unknown; newValue: unknown }> = [];

    const updatedLineItems = lineItems.map((li: Record<string, unknown>) => {
      if (li.inventoryItemId === sourceItemId) {
        changes.push(
          { field: 'inventoryItemId', lineItemId: li.id as string, previousValue: sourceItemId, newValue: targetItemId },
          { field: 'description', lineItemId: li.id as string, previousValue: li.description, newValue: `${targetName}${li.description ? ' (was: ' + (li.description as string).slice(0, 40) + ')' : ''}` },
        );
        changed = true;
        return {
          ...li,
          inventoryItemId: targetItemId,
          sku: targetSku || li.sku,
          _mergedFrom: sourceItemId,
          _mergedFromName: sourceName,
        };
      }
      return li;
    });

    if (changed) {
      const batch = writeBatch(db);
      const poRef = doc(db, 'purchaseOrders', poDoc.id);

      // Update line items
      batch.update(poRef, {
        lineItems: updatedLineItems,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });

      // Add revision history entry for audit trail
      const existingRevisions = poData.revisionHistory || [];
      const revisionNumber = existingRevisions.length + 1;
      batch.update(poRef, {
        revisionHistory: [
          ...existingRevisions,
          {
            id: `REV-MERGE-${Date.now()}`,
            revisionNumber,
            editedAt: new Date(),
            editedBy: userId,
            changes,
            previousLineItems: lineItems,
          },
        ],
      });

      // Record business event
      const eventRef = doc(collection(db, 'businessEvents'));
      batch.set(eventRef, {
        type: 'inventory_item_merged',
        entityType: 'purchase_order',
        entityId: poDoc.id,
        entityNumber: poData.poNumber || '',
        description: `Inventory item "${sourceName}" merged into "${targetName}" — PO line items repointed`,
        sourceItemId,
        targetItemId,
        userId,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      posUpdated++;
    }
  }

  // 2. Repoint procurement requirements
  const reqQuery = query(
    collection(db, 'procurementRequirements'),
    where('inventoryItemId', '==', sourceItemId),
  );
  const reqSnap = await getDocs(reqQuery);

  for (const reqDoc of reqSnap.docs) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'procurementRequirements', reqDoc.id), {
      inventoryItemId: targetItemId,
      itemDescription: targetName,
      _mergedFrom: sourceItemId,
      _mergedFromName: sourceName,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    requirementsUpdated++;
  }

  // 3. Repoint procurement requests
  const pReqQuery = query(
    collection(db, 'procurementRequests'),
    where('materialId', '==', sourceItemId),
  );
  const pReqSnap = await getDocs(pReqQuery);

  for (const pReqDoc of pReqSnap.docs) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'procurementRequests', pReqDoc.id), {
      materialId: targetItemId,
      materialName: targetName,
      materialCode: targetSku,
      _mergedFrom: sourceItemId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    requirementsUpdated++;
  }

  return { posUpdated, requirementsUpdated };
}

interface MergeItemsDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  selectedItems: InventoryListItem[];
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

type Step = 'select-target' | 'confirm' | 'processing' | 'done' | 'error';

interface MergePreview {
  sourceItems: InventoryListItem[];
  targetItem: InventoryListItem;
  stockToTransfer: boolean;
  tagsToMerge: string[];
  aliasesToAdd: string[];
  suppliersToMerge: number;
}

export function MergeItemsDialog({
  open,
  selectedIds,
  selectedItems,
  onClose,
  onComplete,
  userId,
}: MergeItemsDialogProps) {
  const [step, setStep] = useState<Step>('select-target');
  const [targetItem, setTargetItem] = useState<InventoryListItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ merged: number; stockTransferred: number; posUpdated: number; reqsUpdated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveSources, setArchiveSources] = useState(true);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

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
        // Exclude selected items from results
        const filtered = results.filter((r) => !selectedIds.has(r.id));
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

  const handleSelectTarget = (item: InventoryListItem) => {
    setTargetItem(item);
    setSearchTerm('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleContinueToConfirm = useCallback(async () => {
    if (!targetItem) return;

    // Build merge preview
    const sourceItems: InventoryListItem[] = selectedItems.length > 0
      ? selectedItems
      : Array.from(selectedIds).map((id) => ({
          id, sku: '', name: id, category: 'other' as const,
          tier: 'catalogue' as const, source: 'manual' as const, status: 'active' as const,
        }));

    // Collect unique tags and aliases from sources
    const allTags = new Set<string>();
    const allAliases = new Set<string>();
    let supplierCount = 0;

    for (const item of sourceItems) {
      if (item.tags) item.tags.forEach((t: string) => allTags.add(t));
      allAliases.add(item.displayName || item.name);
    }

    // Fetch full item data to count suppliers
    for (const item of sourceItems) {
      try {
        const full = await getInventoryItem(item.id);
        if (full?.supplierPricing?.length) {
          supplierCount += full.supplierPricing.length;
        }
        if (full?.tags) full.tags.forEach((t: string) => allTags.add(t));
        if (full?.aliases) full.aliases.forEach((a: string) => allAliases.add(a));
      } catch {
        // Skip items we can't fetch
      }
    }

    setMergePreview({
      sourceItems,
      targetItem,
      stockToTransfer: true,
      tagsToMerge: Array.from(allTags),
      aliasesToAdd: Array.from(allAliases),
      suppliersToMerge: supplierCount,
    });
    setStep('confirm');
  }, [targetItem, selectedItems, selectedIds]);

  const handleMerge = async () => {
    if (!targetItem || !mergePreview) return;
    setStep('processing');
    setError(null);

    try {
      let totalStockTransferred = 0;
      let totalPosUpdated = 0;
      let totalReqsUpdated = 0;
      const sourceIds = Array.from(selectedIds);

      // 1. Fetch target item fully
      const targetFull = await getInventoryItem(targetItem.id);
      if (!targetFull) throw new Error('Target item not found');

      const mergedTags = new Set(targetFull.tags || []);
      const mergedAliases = new Set(targetFull.aliases || []);
      let mergedSupplierPricing = [...(targetFull.supplierPricing || [])];
      let bestDescription = targetFull.description || '';

      for (let i = 0; i < sourceIds.length; i++) {
        const sourceId = sourceIds[i];
        setProgress(`Processing ${i + 1} of ${sourceIds.length}...`);

        // Fetch source item
        const sourceFull = await getInventoryItem(sourceId);
        if (!sourceFull) continue;

        // Transfer stock
        try {
          const transferResult = await transferStockToItem(
            sourceId,
            targetItem.id,
            userId,
            `Merged into ${targetFull.displayName || targetFull.name}`,
          );
          totalStockTransferred += transferResult.totalTransferred;
        } catch {
          // Stock transfer may fail if item is non-transactable — continue
        }

        // Repoint PO line items, procurement requirements, and add audit entries
        setProgress(`Repointing references for ${i + 1} of ${sourceIds.length}...`);
        try {
          const repointResult = await repointReferencesToTarget(
            sourceId,
            targetItem.id,
            targetFull.displayName || targetFull.name,
            targetFull.sku || '',
            sourceFull.displayName || sourceFull.name,
            userId,
          );
          totalPosUpdated += repointResult.posUpdated;
          totalReqsUpdated += repointResult.requirementsUpdated;
        } catch {
          // Non-fatal — continue merge even if repointing fails
        }

        // Merge tags
        if (sourceFull.tags) sourceFull.tags.forEach((t: string) => mergedTags.add(t));

        // Merge aliases (add source name as alias)
        mergedAliases.add(sourceFull.displayName || sourceFull.name);
        if (sourceFull.aliases) sourceFull.aliases.forEach((a: string) => mergedAliases.add(a));

        // Merge supplier pricing (dedupe by supplier name)
        if (sourceFull.supplierPricing?.length) {
          const existingNames = new Set(mergedSupplierPricing.map((sp) => sp.supplierName));
          for (const sp of sourceFull.supplierPricing) {
            if (!existingNames.has(sp.supplierName)) {
              mergedSupplierPricing.push(sp);
              existingNames.add(sp.supplierName);
            }
          }
        }

        // Pick best description (longest)
        if (sourceFull.description && sourceFull.description.length > bestDescription.length) {
          bestDescription = sourceFull.description;
        }

        // Archive or mark source item
        if (archiveSources) {
          await updateInventoryItem(sourceId, {
            status: 'discontinued',
            _mergedIntoPrimary: targetItem.id,
            _mergedAt: new Date().toISOString(),
            _mergedBy: userId,
          } as Record<string, unknown>, userId);
        }
      }

      // Remove target's own name from aliases
      mergedAliases.delete(targetFull.displayName || targetFull.name);
      mergedAliases.delete(targetFull.name);

      // 2. Update target item with merged data
      await updateInventoryItem(targetItem.id, {
        tags: Array.from(mergedTags),
        aliases: Array.from(mergedAliases),
        supplierPricing: mergedSupplierPricing,
        description: bestDescription,
      } as Record<string, unknown>, userId);

      setResult({ merged: sourceIds.length, stockTransferred: totalStockTransferred, posUpdated: totalPosUpdated, reqsUpdated: totalReqsUpdated });
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
    setStep('select-target');
    setTargetItem(null);
    setSearchTerm('');
    setSearchResults([]);
    setMergePreview(null);
    setProgress('');
    setResult(null);
    setError(null);
  }, [step, onClose, onComplete]);

  const itemsArray: InventoryListItem[] = selectedItems.length > 0
    ? selectedItems
    : Array.from(selectedIds).map((id) => ({
        id, sku: '', name: id, category: 'other' as const,
        tier: 'catalogue' as const, source: 'manual' as const, status: 'active' as const,
      }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-500" />
            Merge {selectedIds.size} Item{selectedIds.size !== 1 ? 's' : ''} Into Target
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select Target */}
        {step === 'select-target' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Choose the target item. Stock, tags, aliases, and supplier pricing from the selected items will be merged into it.
            </p>

            {/* Source items */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Items to merge (will be archived)
              </label>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {itemsArray.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-red-50 rounded text-sm"
                  >
                    <Package className="w-3.5 h-3.5 text-red-400" />
                    <span className="truncate">{item.displayName || item.name}</span>
                    {item.sku && <span className="text-xs text-gray-400 font-mono">{item.sku}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-gray-300 rotate-90" />
            </div>

            {/* Target selector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Merge into (target)
              </label>

              {targetItem ? (
                <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {targetItem.displayName || targetItem.name}
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{targetItem.sku}</span>
                    </div>
                  </div>
                  <button onClick={() => setTargetItem(null)} className="p-1 text-gray-400 hover:text-gray-600">
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
                      placeholder="Search for target item..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
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
                          className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-purple-50"
                          onClick={() => handleSelectTarget(item)}
                        >
                          <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              {item.displayName || item.name}
                            </div>
                            <span className="text-xs text-gray-400 font-mono">{item.sku}</span>
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

        {/* Step 2: Confirm */}
        {step === 'confirm' && mergePreview && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
              <GitMerge className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-purple-800">
                Merging into: <strong>{targetItem?.displayName || targetItem?.name}</strong>
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Boxes className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Stock Transfer</div>
                  <div className="text-xs text-gray-500">All warehouse stock will be moved to target</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Tags className="w-4 h-4 text-green-500" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Tags & Aliases</div>
                  <div className="text-xs text-gray-500">
                    {mergePreview.tagsToMerge.length} tags, {mergePreview.aliasesToAdd.length} aliases will be merged
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <DollarSign className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Supplier Pricing</div>
                  <div className="text-xs text-gray-500">
                    {mergePreview.suppliersToMerge} supplier price entries will be consolidated
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <ArrowRight className="w-4 h-4 text-purple-500" />
                <div>
                  <div className="text-sm font-medium text-gray-700">PO & Procurement References</div>
                  <div className="text-xs text-gray-500">
                    Purchase order line items and procurement requirements will be repointed with full audit trail
                  </div>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={archiveSources}
                onChange={(e) => setArchiveSources(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Archive source items after merge (mark as discontinued)
            </label>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <p className="text-sm text-gray-500">{progress || 'Merging items...'}</p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-700 font-medium">
              {result?.merged ?? 0} item{(result?.merged ?? 0) !== 1 ? 's' : ''} merged into {targetItem?.displayName || targetItem?.name}
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              {(result?.stockTransferred ?? 0) > 0 && (
                <p>{result?.stockTransferred} units of stock transferred</p>
              )}
              {(result?.posUpdated ?? 0) > 0 && (
                <p>{result?.posUpdated} purchase order{result!.posUpdated !== 1 ? 's' : ''} updated with audit trail</p>
              )}
              {(result?.reqsUpdated ?? 0) > 0 && (
                <p>{result?.reqsUpdated} procurement requirement{result!.reqsUpdated !== 1 ? 's' : ''} repointed</p>
              )}
            </div>
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
          {step === 'select-target' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleContinueToConfirm}
                disabled={!targetItem}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Continue
              </Button>
            </div>
          )}
          {step === 'confirm' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('select-target')}>Back</Button>
              <Button
                size="sm"
                onClick={handleMerge}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Merge {selectedIds.size} Item{selectedIds.size > 1 ? 's' : ''}
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
