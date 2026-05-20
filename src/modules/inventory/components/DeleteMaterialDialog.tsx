/**
 * DeleteMaterialDialog Component
 * Multi-step dialog for safely deleting an inventory item.
 * Checks for stock, variant children, and family SKUs before deletion.
 * If stock exists, allows transferring to another item before deleting.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Package,
  ArrowRightLeft,
  Warehouse,
  GitBranch,
  X,
  ShieldAlert,
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
  checkDeleteSafety,
  safeDeleteItem,
  searchInventory,
} from '../services/inventoryService';
import { transferStockToItem } from '../services/stockLevelService';
import type { DeleteSafetyCheck, InventoryListItem } from '../types';

interface DeleteMaterialDialogProps {
  open: boolean;
  itemId: string;
  itemName: string;
  onClose: () => void;
  onDeleted: () => void;
  userId: string;
}

type Step = 'checking' | 'review' | 'transfer' | 'confirm' | 'processing' | 'done' | 'error';

export function DeleteMaterialDialog({
  open,
  itemId,
  itemName,
  onClose,
  onDeleted,
  userId,
}: DeleteMaterialDialogProps) {
  const [step, setStep] = useState<Step>('checking');
  const [safetyCheck, setSafetyCheck] = useState<DeleteSafetyCheck | null>(null);
  const [targetItem, setTargetItem] = useState<InventoryListItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<{ totalTransferred: number; warehouseCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Run safety check when dialog opens
  useEffect(() => {
    if (open && itemId) {
      setStep('checking');
      setSafetyCheck(null);
      setTargetItem(null);
      setSearchTerm('');
      setTransferResult(null);
      setError(null);

      checkDeleteSafety(itemId)
        .then((result) => {
          setSafetyCheck(result);
          setStep('review');
        })
        .catch((err) => {
          setError((err as Error).message);
          setStep('error');
        });
    }
  }, [open, itemId]);

  // Debounced search for transfer target
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
        // Filter out the item being deleted and family records
        const filtered = results.filter(
          (r) => r.id !== itemId && r.isOrderable !== false,
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
  }, [searchTerm, itemId]);

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

  const handleTransferAndContinue = async () => {
    if (!targetItem) return;
    setTransferring(true);
    try {
      const result = await transferStockToItem(itemId, targetItem.id, userId);
      setTransferResult(result);
      // Re-run safety check to confirm stock is now zero
      const updatedCheck = await checkDeleteSafety(itemId);
      setSafetyCheck(updatedCheck);
      setStep('confirm');
    } catch (err) {
      setError((err as Error).message);
      setStep('error');
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = async () => {
    setStep('processing');
    try {
      await safeDeleteItem(itemId, userId);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('error');
    }
  };

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onDeleted();
    } else {
      onClose();
    }
    // Reset
    setStep('checking');
    setSafetyCheck(null);
    setTargetItem(null);
    setSearchTerm('');
    setSearchResults([]);
    setTransferResult(null);
    setError(null);
  }, [step, onClose, onDeleted]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Delete Material
          </DialogTitle>
        </DialogHeader>

        {/* Step: Checking */}
        {step === 'checking' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-sm text-gray-500">Checking dependencies...</p>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && safetyCheck && (
          <div className="space-y-4 py-2">
            {/* Item info */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Package className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">{safetyCheck.itemName}</span>
            </div>

            {/* Warnings */}
            {safetyCheck.warnings.length > 0 ? (
              <div className="space-y-2">
                {safetyCheck.hasStock && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Warehouse className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          {safetyCheck.stockQty} units in stock
                        </p>
                        {safetyCheck.warehouseStockLevels.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {safetyCheck.warehouseStockLevels.map((wh, i) => (
                              <li key={i} className="text-xs text-amber-700">
                                • {wh.warehouseName}: {wh.qty} units
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-xs text-amber-600 mt-2">
                          You must transfer stock to another material before deleting.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {safetyCheck.isVariantParent && safetyCheck.variantCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <GitBranch className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Parent of {safetyCheck.variantCount} variant{safetyCheck.variantCount !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                          Variants will be detached and become standalone items.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {safetyCheck.isFamilyParent && safetyCheck.skuCount > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800">
                          Family parent with {safetyCheck.skuCount} SKU{safetyCheck.skuCount !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Delete or reassign SKUs before deleting this family.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-800">
                    No stock or dependencies. Safe to delete.
                  </p>
                </div>
              </div>
            )}

            {/* Destructive warning */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 font-medium">
                This action cannot be undone. The material will be permanently deleted.
              </p>
            </div>
          </div>
        )}

        {/* Step: Transfer */}
        {step === 'transfer' && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-amber-800">
                  Transfer <strong>{safetyCheck?.stockQty || 0}</strong> units to another material
                </p>
              </div>
            </div>

            {/* Target item selector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Transfer stock to
              </label>

              {targetItem ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {targetItem.displayName || targetItem.name}
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{targetItem.sku}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setTargetItem(null)}
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
                      placeholder="Search for target material..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
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
                          className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-blue-50"
                          onClick={() => {
                            setTargetItem(item);
                            setSearchTerm('');
                            setShowDropdown(false);
                          }}
                        >
                          <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              {item.displayName || item.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="font-mono">{item.sku}</span>
                              <span>{(item.inStock ?? 0).toLocaleString()} in stock</span>
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

            {/* Transfer preview */}
            {targetItem && safetyCheck && (
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <p>
                  <strong>{safetyCheck.stockQty}</strong> units will be transferred from{' '}
                  <strong>{safetyCheck.itemName}</strong> to{' '}
                  <strong>{targetItem.displayName || targetItem.name}</strong> across{' '}
                  {safetyCheck.warehouseStockLevels.length} warehouse location
                  {safetyCheck.warehouseStockLevels.length !== 1 ? 's' : ''}.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4 py-2">
            {transferResult && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-800">
                    Successfully transferred {transferResult.totalTransferred} units across {transferResult.warehouseCount} location{transferResult.warehouseCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <Trash2 className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-800">
                Permanently delete &ldquo;{safetyCheck?.itemName || itemName}&rdquo;?
              </p>
              <p className="text-xs text-red-600 mt-1">This action cannot be undone.</p>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-red-400" />
            <p className="text-sm text-gray-500">Deleting material...</p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-700 font-medium">Material deleted successfully</p>
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
          {step === 'review' && safetyCheck && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              {safetyCheck.hasStock ? (
                <Button
                  size="sm"
                  onClick={() => setStep('transfer')}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                  Transfer Stock First
                </Button>
              ) : safetyCheck.isFamilyParent && safetyCheck.skuCount > 0 ? (
                // Block deletion if family parent
                <Button size="sm" disabled variant="destructive">
                  Cannot Delete (Has SKUs)
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setStep('confirm')}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete
                </Button>
              )}
            </div>
          )}
          {step === 'transfer' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('review')}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleTransferAndContinue}
                disabled={!targetItem || transferring}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {transferring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                    Transfer &amp; Continue
                  </>
                )}
              </Button>
            </div>
          )}
          {step === 'confirm' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Permanently
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
