import { useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, X, Plus, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { convertToFamily } from '../services/inventoryService';
import { COMMON_VARIANT_ATTRIBUTES, type InventoryListItem } from '../types';

interface ConvertToFamilyDialogProps {
  open: boolean;
  item: InventoryListItem | null;
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

type Step = 'configure' | 'processing' | 'done' | 'error';

export function ConvertToFamilyDialog({
  open,
  item,
  onClose,
  onComplete,
  userId,
}: ConvertToFamilyDialogProps) {
  const [step, setStep] = useState<Step>('configure');
  const [definitions, setDefinitions] = useState<string[]>([]);
  const [customAttr, setCustomAttr] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const reset = useCallback(() => {
    setStep('configure');
    setDefinitions([]);
    setCustomAttr('');
    setErrorMessage('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const addDefinition = useCallback((attr: string) => {
    const trimmed = attr.trim().toLowerCase();
    if (trimmed && !definitions.includes(trimmed)) {
      setDefinitions((prev) => [...prev, trimmed]);
    }
    setCustomAttr('');
  }, [definitions]);

  const removeDefinition = useCallback((attr: string) => {
    setDefinitions((prev) => prev.filter((d) => d !== attr));
  }, []);

  const handleConvert = useCallback(async () => {
    if (!item || definitions.length === 0) return;
    setStep('processing');
    try {
      await convertToFamily(item.id, definitions, userId);
      setStep('done');
    } catch (err) {
      setErrorMessage((err as Error).message);
      setStep('error');
    }
  }, [item, definitions, userId]);

  const handleDone = useCallback(() => {
    reset();
    onComplete();
  }, [reset, onComplete]);

  const unusedSuggestions = COMMON_VARIANT_ATTRIBUTES.filter(
    (attr) => !definitions.includes(attr),
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Convert to Family
          </DialogTitle>
        </DialogHeader>

        {step === 'configure' && !item && (
          <div className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-gray-700 font-medium">Select exactly one item</p>
            <p className="text-xs text-gray-500 mt-1">
              Convert to Family works on a single item at a time because each family
              needs its own variant attribute definitions.
            </p>
          </div>
        )}

        {step === 'configure' && item && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-sm font-medium text-gray-900">{item.displayName || item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.sku}</p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">This will:</p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs">
                    <li>Mark this item as a <strong>Family parent</strong></li>
                    <li>Make it <strong>non-orderable</strong> (orders use child SKUs)</li>
                    <li>Set the variant dimensions you define below</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variant Attribute Definitions
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Define what varies across child SKUs (e.g. size, color, thickness).
                Each child SKU will need a value for every attribute.
              </p>

              {definitions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {definitions.map((attr) => (
                    <span
                      key={attr}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium bg-emerald-100 text-emerald-800 rounded-full"
                    >
                      {attr}
                      <button
                        type="button"
                        onClick={() => removeDefinition(attr)}
                        className="text-emerald-600 hover:text-emerald-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={customAttr}
                  onChange={(e) => setCustomAttr(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDefinition(customAttr);
                    }
                  }}
                  placeholder="Type a custom attribute..."
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addDefinition(customAttr)}
                  disabled={!customAttr.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {unusedSuggestions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Common attributes:</p>
                  <div className="flex flex-wrap gap-1">
                    {unusedSuggestions.map((attr) => (
                      <button
                        key={attr}
                        type="button"
                        onClick={() => addDefinition(attr)}
                        className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      >
                        + {attr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm text-gray-600">Converting to family...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            <p className="text-sm text-gray-700 font-medium">
              Converted to family successfully
            </p>
            <p className="text-xs text-gray-500">
              You can now add child SKUs with attributes: {definitions.join(', ')}
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertTriangle className="w-10 h-10 text-red-500" />
            <p className="text-sm text-red-700 font-medium">Conversion failed</p>
            <p className="text-xs text-gray-500">{errorMessage}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleConvert}
                disabled={definitions.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Convert to Family
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleDone} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Done
            </Button>
          )}
          {step === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <Button variant="outline" onClick={() => setStep('configure')}>Try Again</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
