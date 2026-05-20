/**
 * Edit Goods Receipt Dialog
 * Admin-only dialog for correcting quantities and dates on a goods receipt
 * Triggers backward linkages (stock adjustments, cost corrections)
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import type { PurchaseOrder, GoodsReceipt } from '../types/purchaseOrder';

interface Props {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  receipt: GoodsReceipt;
  onSave: (
    receiptId: string,
    updatedLines: { lineItemId: string; quantityReceived: number }[],
    updatedReceivedDate: Date | undefined,
    reason: string,
  ) => Promise<void>;
}

export function EditGoodsReceiptDialog({ open, onClose, order, receipt, onSave }: Props) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    receipt.lines.forEach((rl) => {
      init[rl.lineItemId] = String(rl.quantityReceived);
    });
    return init;
  });
  const [receivedDate, setReceivedDate] = useState(() => {
    if ((receipt as any).receivedDate && typeof ((receipt as any).receivedDate as any).toDate === 'function') {
      return ((receipt as any).receivedDate as any).toDate().toISOString().split('T')[0];
    }
    if (receipt.receivedAt && typeof (receipt.receivedAt as any).toDate === 'function') {
      return (receipt.receivedAt as any).toDate().toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!reason.trim()) {
      setError('Please provide a reason for this correction');
      return;
    }

    // Build updated lines
    const updatedLines = receipt.lines.map((rl) => ({
      lineItemId: rl.lineItemId,
      quantityReceived: parseFloat(quantities[rl.lineItemId] || '0'),
    }));

    // Check for negative quantities
    for (const line of updatedLines) {
      if (line.quantityReceived < 0) {
        const poLine = order?.lineItems?.find((li) => li.id === line.lineItemId);
        setError(`Quantity cannot be negative for "${poLine?.description || line.lineItemId}"`);
        return;
      }
    }

    // Check if anything actually changed
    const hasQtyChange = updatedLines.some((ul) => {
      const orig = receipt.lines.find((rl) => rl.lineItemId === ul.lineItemId);
      return orig && orig.quantityReceived !== ul.quantityReceived;
    });

    const originalDate = (receipt as any).receivedDate && typeof ((receipt as any).receivedDate as any).toDate === 'function'
      ? ((receipt as any).receivedDate as any).toDate().toISOString().split('T')[0]
      : receipt.receivedAt && typeof (receipt.receivedAt as any).toDate === 'function'
        ? (receipt.receivedAt as any).toDate().toISOString().split('T')[0]
        : null;
    const dateChanged = originalDate !== receivedDate;

    if (!hasQtyChange && !dateChanged) {
      setError('No changes detected');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        receipt.id,
        updatedLines,
        dateChanged ? new Date(receivedDate) : undefined,
        reason.trim(),
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Edit Goods Receipt — {receipt.id}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warning Banner */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <strong>Admin Correction:</strong> Changes to receipt quantities will adjust inventory
            stock levels and record cost corrections. This action is audited.
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Receipt Date</Label>
            <Input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="max-w-[200px]"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Original Qty
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                    New Qty
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {receipt.lines.map((rl) => {
                  const poLine = order?.lineItems?.find((li) => li.id === rl.lineItemId);
                  const originalQty = rl.quantityReceived;
                  const newQty = parseFloat(quantities[rl.lineItemId] || '0');
                  const delta = newQty - originalQty;

                  return (
                    <tr key={rl.lineItemId}>
                      <td className="px-3 py-3 text-sm">
                        <div>{poLine?.description || rl.lineItemId}</div>
                        {poLine?.sku && (
                          <div className="text-xs text-muted-foreground">{poLine.sku}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-muted-foreground">
                        {originalQty}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Input
                          type="number"
                          value={quantities[rl.lineItemId] || ''}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [rl.lineItemId]: e.target.value,
                            }))
                          }
                          min={0}
                          step={1}
                          className="h-8 w-24 ml-auto text-right"
                        />
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-medium">
                        {delta !== 0 && (
                          <span className={delta > 0 ? 'text-green-600' : 'text-red-600'}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <Label>
              Reason for Correction <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Physical recount showed fewer items delivered"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
