/**
 * ShopifyImportDialog
 * Modal for importing Shopify products into the launch pipeline
 */

import { useState, useEffect } from 'react';
import {
  X,
  Download,
  CheckCircle,
  Loader2,
  Package,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { ShopifyApiProduct, ImportResult } from '../../services/shopifyService';
import { getUnlinkedShopifyProducts, importShopifyProducts } from '../../services/shopifyService';

interface ShopifyImportDialogProps {
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
}

type DialogState = 'loading' | 'ready' | 'importing' | 'complete' | 'error';

export function ShopifyImportDialog({ onClose, onImportComplete }: ShopifyImportDialogProps) {
  const [state, setState] = useState<DialogState>('loading');
  const [unlinked, setUnlinked] = useState<ShopifyApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setState('loading');
    try {
      const data = await getUnlinkedShopifyProducts();
      setUnlinked(data.unlinked);
      setTotal(data.total);
      setSelected(new Set(data.unlinked.map(p => p.id.toString())));
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setState('error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === unlinked.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unlinked.map(p => p.id.toString())));
    }
  };

  const handleImport = async () => {
    setState('importing');
    try {
      const ids = Array.from(selected);
      const result = await importShopifyProducts(ids.length === unlinked.length ? undefined : ids);
      setImportResult(result);
      setState('complete');
      onImportComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Import from Shopify</h2>
              <p className="text-sm text-gray-500">
                {state === 'loading' ? 'Checking products...' :
                 state === 'complete' ? 'Import complete' :
                 `${unlinked.length} unlinked of ${total} total products`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {state === 'loading' && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {state === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {state === 'ready' && unlinked.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="font-medium text-gray-900">All synced!</p>
              <p className="text-sm text-gray-500 mt-1">
                All {total} Shopify products are linked to the pipeline.
              </p>
            </div>
          )}

          {state === 'ready' && unlinked.length > 0 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === unlinked.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
                Select all ({unlinked.length})
              </label>

              <div className="divide-y border rounded-lg">
                {unlinked.map(product => (
                  <label
                    key={product.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(product.id.toString())}
                      onChange={() => toggleSelect(product.id.toString())}
                      className="rounded border-gray-300"
                    />
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0].src}
                        alt={product.title}
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{product.title}</p>
                      <p className="text-xs text-gray-500">
                        {product.status}
                        {product.variants?.[0]?.price ? ` · $${product.variants[0].price}` : ''}
                        {product.product_type ? ` · ${product.product_type}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {state === 'importing' && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Importing {selected.size} products...</p>
            </div>
          )}

          {state === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-sm text-green-700">Imported</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{importResult.alreadyLinked}</p>
                  <p className="text-sm text-blue-700">Already Linked</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                  <p className="text-sm text-red-700">Errors</p>
                </div>
              </div>

              {importResult.errorDetails.length > 0 && (
                <div className="border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-red-700">Error Details:</p>
                  {importResult.errorDetails.map((err, i) => (
                    <p key={i} className="text-sm text-red-600">
                      {err.title}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0">
          {state === 'ready' && unlinked.length > 0 && (
            <Button
              onClick={handleImport}
              disabled={selected.size === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Import {selected.size} Product{selected.size !== 1 ? 's' : ''}
            </Button>
          )}

          {state === 'complete' && (
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          )}

          {state === 'error' && (
            <Button onClick={loadProducts} variant="outline" className="w-full">
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShopifyImportDialog;
