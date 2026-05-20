/**
 * PO PDF Import Dialog
 * Upload a supplier PDF, AI-parse line items, review/match, and create a PO.
 */

import { useRef, useCallback } from 'react';
import {
  Upload, FileText, Loader2, Check, AlertTriangle, Search, Link2, Trash2, /* X removed */
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { SupplierPicker } from './SupplierPicker';
import { POItemPicker } from './POItemPicker';
import { usePOPdfImport } from '../hooks/usePOPdfImport';
import { PO_LINE_ITEM_CATEGORY_LABELS } from '../types/purchaseOrder';
import type { POLineItemCategory } from '../types/purchaseOrder';
import type { POImportLineItemDraft } from '../types/poPdfImport';
import type { UnifiedSearchResult } from '../hooks/usePOItemSearch';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (poId: string) => void;
  subsidiaryId: string;
  userId: string;
}

const CURRENCIES = ['UGX', 'USD', 'GBP', 'EUR', 'KES', 'AED', 'ZAR', 'CNY'];

const STAGE_LABELS: Record<string, string> = {
  uploading: 'Uploading PDF...',
  extracting: 'Extracting tables and text...',
  parsing: 'AI analyzing document...',
  matching: 'Matching items to inventory...',
  creating: 'Creating purchase order...',
};

export function POPdfImportDialog({ open, onClose, onCreated, subsidiaryId, userId }: Props) {
  const imp = usePOPdfImport(subsidiaryId, userId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type === 'application/pdf') imp.startImport(file);
    },
    [imp.startImport],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) imp.startImport(file);
    },
    [imp.startImport],
  );

  const handleClose = () => {
    imp.reset();
    onClose();
  };

  const handleCreatePO = async () => {
    const poId = await imp.createPO();
    if (poId) onCreated(poId);
  };

  const subtotal = imp.drafts.reduce((sum, d) => {
    const qty = parseFloat(d.quantity) || 0;
    const cost = parseFloat(d.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-6xl max-h-[94vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Purchase Order from PDF
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ── Error ── */}
          {imp.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Import failed</div>
                <div>{imp.error}</div>
              </div>
            </div>
          )}

          {/* ── Stage: Idle — Upload Zone ── */}
          {imp.stage === 'idle' && (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center hover:border-primary/40 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <div className="text-lg font-medium mb-1">Drop a supplier PDF here</div>
              <div className="text-sm text-muted-foreground mb-4">
                Invoices, proformas, quotations — AI will extract line items automatically
              </div>
              <Button variant="outline" size="sm">
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* ── Stage: Processing ── */}
          {['uploading', 'extracting', 'parsing', 'matching'].includes(imp.stage) && (
            <div className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
              <div className="text-lg font-medium mb-2">
                {STAGE_LABELS[imp.stage] || 'Processing...'}
              </div>
              <div className="text-sm text-muted-foreground mb-4">{imp.progressStatus}</div>
              <div className="max-w-md mx-auto bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${imp.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Stage: Review ── */}
          {imp.stage === 'reviewing' && (
            <div className="space-y-4">
              {/* Header section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <SupplierPicker
                    value={imp.supplierId ? { supplierId: imp.supplierId, supplierName: imp.supplierName } : null}
                    onChange={(val) => {
                      imp.setSupplierId(val?.supplierId ?? '');
                      imp.setSupplierName(val?.supplierName ?? '');
                    }}
                  />
                  {!imp.supplierId && imp.supplierName && (
                    <div className="text-xs text-muted-foreground">
                      From PDF: {imp.supplierName}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={imp.currency} onValueChange={imp.setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Invoice / Reference</Label>
                  <Input
                    value={imp.invoiceRef}
                    onChange={(e) => imp.setInvoiceRef(e.target.value)}
                    placeholder="Invoice or quote number"
                  />
                </div>
              </div>

              {/* Parse confidence */}
              {imp.parseResult && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    AI parsed <strong>{imp.parseResult.lineItems.length}</strong> line items
                    in {Math.round(imp.parseResult.processingTimeMs / 1000)}s
                  </span>
                  {imp.parseResult.header.grandTotal != null && (
                    <span>
                      Document total: <strong>{imp.parseResult.header.grandTotal.toLocaleString()} {imp.currency}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Line items table */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-2.5 text-left text-[10px] font-medium text-muted-foreground uppercase w-8">
                        Match
                      </th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-medium text-muted-foreground uppercase">
                        Description
                      </th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-medium text-muted-foreground uppercase w-20">
                        SKU
                      </th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-medium text-muted-foreground uppercase w-16">
                        Qty
                      </th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-medium text-muted-foreground uppercase w-14">
                        Unit
                      </th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-medium text-muted-foreground uppercase w-24">
                        Unit Cost
                      </th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-medium text-muted-foreground uppercase w-28">
                        Category
                      </th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-medium text-muted-foreground uppercase w-24">
                        Total
                      </th>
                      <th className="px-2 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {imp.drafts.map((draft) => (
                      <ImportLineRow
                        key={draft.key}
                        draft={draft}
                        onUpdate={(field, value) => imp.updateDraft(draft.key, field, value)}
                        onAcceptMatch={(result) => imp.acceptMatch(draft.key, result)}
                        onCreateInventory={() => imp.createAndLinkInventory(draft.key)}
                        onRemove={() => imp.removeDraft(draft.key)}
                        supplierId={imp.supplierId}
                        userId={userId}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td colSpan={7} className="px-2 py-2.5 text-sm font-medium text-right">
                        Subtotal ({imp.drafts.length} items)
                      </td>
                      <td className="px-2 py-2.5 text-sm font-semibold text-right">
                        {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {imp.currency}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={imp.notes}
                  onChange={(e) => imp.setNotes(e.target.value)}
                  placeholder={`Imported from: ${imp.fileName}`}
                />
              </div>
            </div>
          )}

          {/* ── Stage: Creating ── */}
          {imp.stage === 'creating' && (
            <div className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
              <div className="text-lg font-medium">Creating purchase order...</div>
            </div>
          )}

          {/* ── Stage: Complete ── */}
          {imp.stage === 'complete' && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-lg font-medium mb-2">Purchase order created</div>
              <div className="text-sm text-muted-foreground">
                {imp.drafts.length} line items imported from {imp.fileName}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          {imp.stage === 'idle' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}

          {imp.stage === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={imp.reset}>Try Again</Button>
            </>
          )}

          {['uploading', 'extracting', 'parsing', 'matching'].includes(imp.stage) && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}

          {imp.stage === 'reviewing' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreatePO} disabled={!imp.supplierName || imp.drafts.length === 0}>
                Create Purchase Order
              </Button>
            </>
          )}

          {imp.stage === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Line Item Row ──

interface ImportLineRowProps {
  draft: POImportLineItemDraft;
  onUpdate: (field: string, value: unknown) => void;
  onAcceptMatch: (result: UnifiedSearchResult) => void;
  onCreateInventory: () => void;
  onRemove: () => void;
  supplierId: string;
  userId: string;
}

function ImportLineRow({ draft, onUpdate, onAcceptMatch, onCreateInventory, onRemove, supplierId: _supplierId, userId }: ImportLineRowProps) {
  const lineTotal = (parseFloat(draft.quantity) || 0) * (parseFloat(draft.unitCost) || 0);
  const confidence = draft.parsed.confidence;
  const confColor = confidence >= 0.8 ? 'text-green-600' : confidence >= 0.5 ? 'text-amber-600' : 'text-red-600';
  const isCreating = draft.matchStatus === 'pending';

  return (
    <tr className="group hover:bg-muted/30">
      {/* Match status */}
      <td className="px-2 py-2">
        {draft.matchStatus === 'matched' ? (
          <div className="flex items-center justify-center" title={`Matched: ${draft.bestMatch?.source === 'inventory' ? draft.bestMatch.item.name : 'asset'}`}>
            <Link2 className="h-3.5 w-3.5 text-green-600" />
          </div>
        ) : isCreating ? (
          <div className="flex items-center justify-center" title="Creating inventory item…">
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
          </div>
        ) : draft.matchStatus === 'no-match' ? (
          <div className="flex items-center justify-center" title="No match found">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
        ) : (
          <div className="flex items-center justify-center" title="Pending">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </td>

      {/* Description — live inventory search */}
      <td className="px-2 py-2 min-w-[220px]">
        <POItemPicker
          value={draft.description}
          onInputChange={(val) => onUpdate('description', val)}
          onSelect={onAcceptMatch}
          userId={userId}
          placeholder="Search inventory..."
        />
        {draft.matchStatus === 'no-match' && (
          <button
            type="button"
            onClick={onCreateInventory}
            className="text-[10px] text-blue-600 hover:underline mt-0.5 block"
          >
            + Create new inventory item
          </button>
        )}
        <div className={`text-[10px] ${confColor} mt-0.5`}>
          {Math.round(confidence * 100)}% confidence
        </div>
      </td>

      {/* SKU */}
      <td className="px-2 py-2">
        <Input
          value={draft.sku}
          onChange={(e) => onUpdate('sku', e.target.value)}
          className="h-7 text-xs"
          placeholder="—"
        />
      </td>

      {/* Qty */}
      <td className="px-2 py-2 text-right">
        <Input
          type="number"
          value={draft.quantity}
          onChange={(e) => onUpdate('quantity', e.target.value)}
          className="h-7 text-xs w-16 ml-auto text-right"
          min={0}
        />
      </td>

      {/* Unit */}
      <td className="px-2 py-2">
        <Input
          value={draft.unit}
          onChange={(e) => onUpdate('unit', e.target.value)}
          className="h-7 text-xs w-14"
        />
      </td>

      {/* Unit Cost */}
      <td className="px-2 py-2 text-right">
        <Input
          type="number"
          value={draft.unitCost}
          onChange={(e) => onUpdate('unitCost', e.target.value)}
          className="h-7 text-xs w-24 ml-auto text-right"
          min={0}
          step="0.01"
        />
      </td>

      {/* Category */}
      <td className="px-2 py-2">
        <Select
          value={draft.category}
          onValueChange={(val) => onUpdate('category', val as POLineItemCategory)}
        >
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PO_LINE_ITEM_CATEGORY_LABELS) as [POLineItemCategory, string][]).map(
              ([key, label]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </td>

      {/* Total */}
      <td className="px-2 py-2 text-sm text-right font-medium">
        {lineTotal > 0 ? lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
      </td>

      {/* Remove */}
      <td className="px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </td>
    </tr>
  );
}
