/**
 * BulkFormulaRunner
 *
 * Dialog for processing multiple BOQ items through the AI formula assistant.
 * Matches the UI pattern of BulkAIEnhanceDialog from the inventory module:
 * config → processing → done steps with progress bar and summary stats.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { useFormulaAssistant } from '@/subsidiaries/advisory/matflow/hooks/useFormulaAssistant';

/** Minimal item shape accepted by BulkFormulaRunner — works with both BOQItem and ControlBOQItem */
export interface BulkFormulaItem {
  id: string;
  description: string;
  itemCode?: string;
  unit?: string;
  quantityContract?: number;
  quantity?: number;
  sectionName?: string;
  elementName?: string;
  specification?: string;
}

interface BulkFormulaRunnerProps {
  open: boolean;
  items: BulkFormulaItem[];
  orgId: string;
  projectId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface ItemResult {
  itemId: string;
  itemName: string;
  success: boolean;
  formulaName?: string;
  componentCount?: number;
  error?: string;
}

type Step = 'config' | 'processing' | 'done' | 'error';

export function BulkFormulaRunner({
  open,
  items,
  orgId,
  projectId,
  onClose,
  onComplete,
}: BulkFormulaRunnerProps) {
  const { generateBreakdown, saveAsFormula, applyToItem, reset } = useFormulaAssistant(orgId, projectId);

  const [step, setStep] = useState<Step>('config');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentItemName, setCurrentItemName] = useState('');
  const [results, setResults] = useState<ItemResult[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const cancelRef = useRef(false);

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  const handleStart = useCallback(async () => {
    setStep('processing');
    setResults([]);
    setCurrentIndex(0);
    cancelRef.current = false;

    const allResults: ItemResult[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        if (cancelRef.current) break;

        const item = items[i];
        setCurrentIndex(i);
        setCurrentItemName(item.description || item.itemCode || `Item ${i + 1}`);

        try {
          reset();

          const itemQty = item.quantityContract ?? item.quantity ?? 0;

          const breakdown = await generateBreakdown({
            description: item.description || '',
            specification: [item.sectionName, item.elementName, item.specification].filter(Boolean).join('. '),
            unit: item.unit || 'nr',
            quantity: itemQty,
          });

          if (!breakdown || cancelRef.current) {
            allResults.push({
              itemId: item.id,
              itemName: item.description || item.itemCode || '',
              success: false,
              error: 'No breakdown generated',
            });
            setResults([...allResults]);
            continue;
          }

          const formulaId = await saveAsFormula(breakdown);
          const boqQty = itemQty;
          const success = await applyToItem(item.id, boqQty, breakdown, formulaId || undefined);

          allResults.push({
            itemId: item.id,
            itemName: item.description || item.itemCode || '',
            success,
            formulaName: success ? breakdown.formulaName : undefined,
            componentCount: success ? breakdown.components.length : undefined,
            error: success ? undefined : 'Failed to apply formula',
          });
        } catch (err: any) {
          allResults.push({
            itemId: item.id,
            itemName: item.description || item.itemCode || '',
            success: false,
            error: err.message || 'Unknown error',
          });
        }

        setResults([...allResults]);
      }

      setStep('done');
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
      setStep('error');
    }
  }, [items, generateBreakdown, saveAsFormula, applyToItem, reset]);

  const handleClose = useCallback(() => {
    if (step === 'processing') {
      cancelRef.current = true;
    }
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    // Reset state for next open
    setStep('config');
    setResults([]);
    setCurrentIndex(0);
    setCurrentItemName('');
    setErrorMessage('');
  }, [step, onClose, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Formula Generation — {items.length} Item{items.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Configuration */}
        {step === 'config' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Claude AI will analyse each BOQ item and generate a material formula breakdown.
              Generated formulas are automatically saved to the library and applied to each item.
            </p>

            {/* Items preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Items to process:
              </label>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2 py-1 px-2 text-sm">
                      <span className="text-gray-400 font-mono text-xs w-6">{i + 1}.</span>
                      <span className="text-gray-700 truncate">{item.description}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{item.quantityContract ?? item.quantity ?? 0} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
              Items will be processed one at a time. Each formula considers the item's quantity, unit, and specification context.
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-sm text-gray-600">
                Generating: <span className="font-medium">{currentItemName || '...'}</span>
              </p>
              <p className="text-xs text-gray-400">
                {currentIndex + 1} of {items.length}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{
                  width: `${((currentIndex + 1) / items.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm text-green-700 font-medium">
                Formula generation complete
              </p>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-700">{successCount}</div>
                <div className="text-xs text-green-600">Applied</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-700">{failureCount}</div>
                <div className="text-xs text-red-600">Failed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-700">{results.length}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>

            {/* Failed items list */}
            {failureCount > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Failed Items</h4>
                <ScrollArea className="max-h-32">
                  <div className="space-y-1">
                    {results
                      .filter(r => !r.success)
                      .map(r => (
                        <div key={r.itemId} className="flex items-center gap-2 py-1 px-2 text-sm">
                          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          <span className="text-gray-700 truncate">{r.itemName}</span>
                          <span className="text-xs text-gray-400">{r.error}</span>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-600">{errorMessage || 'An error occurred'}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'config' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleStart}>
                <Sparkles className="w-4 h-4 mr-1" />
                Start Generation
              </Button>
            </div>
          )}
          {step === 'processing' && (
            <Button variant="outline" size="sm" onClick={() => { cancelRef.current = true; }}>
              Stop
            </Button>
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
