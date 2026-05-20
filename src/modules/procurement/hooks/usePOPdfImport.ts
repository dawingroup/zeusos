/**
 * PO PDF Import Hook
 * Manages pipeline state for the PDF import dialog
 */

import { useState, useCallback } from 'react';
import type {
  POImportStage,
  POPdfParseResult,
  POImportLineItemDraft,
} from '../types/poPdfImport';
import type { POLineItem } from '../types/purchaseOrder';
import { DEFAULT_LANDED_COSTS } from '../types/purchaseOrder';
import { runImportPipeline } from '../services/poPdfImportService';
import { resolveInventoryItem } from './usePOItemSearch';
import type { UnifiedSearchResult } from './usePOItemSearch';
import { createPurchaseOrder } from '../services/purchaseOrderService';
import { createInventoryItem, generateSku } from '@/modules/inventory/services/inventoryService';
import type { InventoryCategory, InventoryUnit } from '@/modules/inventory/types';

const VALID_INVENTORY_UNITS = new Set<string>([
  'pcs', 'ea', 'sheet', 'lft', 'm', 'sqft', 'sqm', 'kg', 'ltr', 'gal', 'roll', 'box', 'sht', 'len', 'pair', 'set', 'pack',
]);

export function usePOPdfImport(subsidiaryId: string, userId: string) {
  const [stage, setStage] = useState<POImportStage>('idle');
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pipeline results
  const [parseResult, setParseResult] = useState<POPdfParseResult | null>(null);
  const [drafts, setDrafts] = useState<POImportLineItemDraft[]>([]);
  const [storagePath, setStoragePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);

  // Editable header (pre-filled from AI parse)
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');

  // ── Start the import pipeline ──

  const startImport = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    setStage('uploading');

    try {
      const result = await runImportPipeline(file, subsidiaryId, {
        onStageChange: (s) => setStage(s as POImportStage),
        onProgress: (p) => {
          setProgress(p.percent);
          setProgressStatus(p.status);
        },
        onLineMatched: (idx, total) => {
          setProgress(Math.round((idx / total) * 100));
          setProgressStatus(`Matching item ${idx + 1} of ${total}...`);
        },
      });

      setParseResult(result.parseResult);
      setDrafts(result.drafts);
      setStoragePath(result.storagePath);

      // Pre-fill header from AI parse
      const header = result.parseResult.header;
      if (header.supplierName) setSupplierName(header.supplierName);
      if (header.currency) setCurrency(header.currency);
      if (header.invoiceNumber) setInvoiceRef(header.invoiceNumber);

      setStage('reviewing');
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  }, [subsidiaryId]);

  // ── Draft management ──

  const updateDraft = useCallback((key: string, field: string, value: unknown) => {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)),
    );
  }, []);

  const acceptMatch = useCallback(
    async (key: string, result: UnifiedSearchResult) => {
      if (result.source === 'inventory') {
        try {
          const resolved = resolveInventoryItem(result.item);
          setDrafts((prev) =>
            prev.map((d) =>
              d.key === key
                ? {
                    ...d,
                    matchStatus: 'matched' as const,
                    bestMatch: result,
                    inventoryItemId: resolved.inventoryItemId,
                    description: resolved.description,
                    sku: resolved.sku,
                    unitCost: resolved.unitCost.toString(),
                    unit: resolved.unit,
                    packagingQty: resolved.packagingQty?.toString() ?? '',
                    packagingUnit: resolved.packagingUnit ?? '',
                    derivedUnitCost: resolved.derivedUnitCost?.toString() ?? '',
                    baseUnit: resolved.packagingQty ? resolved.unit : '',
                  }
                : d,
            ),
          );
        } catch {
          // Fall back to basic match without resolution
          setDrafts((prev) =>
            prev.map((d) =>
              d.key === key
                ? {
                    ...d,
                    matchStatus: 'matched' as const,
                    bestMatch: result,
                    inventoryItemId: result.item.id,
                    description: result.item.name,
                    sku: result.item.sku || '',
                  }
                : d,
            ),
          );
        }
      } else if ((result as any).source === 'asset') {
        const assetResult = result as any;
        setDrafts((prev) =>
          prev.map((d) =>
            d.key === key
              ? {
                  ...d,
                  matchStatus: 'matched' as const,
                  bestMatch: result,
                  assetId: assetResult.item.id,
                  description: `${assetResult.item.brand} ${assetResult.item.model}`,
                  category: 'asset',
                  assetCategory: assetResult.item.category,
                }
              : d,
          ),
        );
      }
    },
    [supplierId],
  );

  const removeDraft = useCallback((key: string) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }, []);

  // ── Create PO from reviewed drafts ──

  const createPO = useCallback(async (): Promise<string | null> => {
    if (!supplierName) {
      setError('Supplier name is required');
      return null;
    }

    const validDrafts = drafts.filter(
      (d) => d.description && parseFloat(d.quantity) > 0 && parseFloat(d.unitCost) > 0,
    );
    if (validDrafts.length === 0) {
      setError('No valid line items');
      return null;
    }

    setStage('creating');
    setError(null);

    try {
      const poLineItems: POLineItem[] = validDrafts.map((d, idx) => {
        const qty = parseFloat(d.quantity);
        const cost = parseFloat(d.unitCost);
        const item: POLineItem = {
          id: `LI-${Date.now()}-${idx}`,
          description: d.description,
          quantity: qty,
          unitCost: cost,
          totalCost: qty * cost,
          currency,
          unit: d.unit,
          quantityReceived: 0,
        };
        if (d.sku) item.sku = d.sku;
        if (d.inventoryItemId) item.inventoryItemId = d.inventoryItemId;
        if (d.materialId) item.materialId = d.materialId;
        if (d.category !== 'inventory') item.category = d.category;
        if (d.assetId) item.assetId = d.assetId;
        if (d.assetCategory) item.assetCategory = d.assetCategory as any;
        if (d.weight) item.weight = parseFloat(d.weight);
        if (d.packagingQty) {
          item.packagingQty = parseFloat(d.packagingQty);
          item.packagingUnit = d.packagingUnit || d.unit;
          item.baseUnit = d.baseUnit || 'pcs';
        }
        if (d.derivedUnitCost) item.derivedUnitCost = parseFloat(d.derivedUnitCost);
        return item;
      });

      const poId = await createPurchaseOrder(
        {
          supplierName,
          supplierId: supplierId || undefined,
          supplierContact: supplierContact || undefined,
          lineItems: poLineItems,
          landedCosts: { ...DEFAULT_LANDED_COSTS, currency },
          subsidiaryId,
          notes: notes || `Imported from PDF: ${fileName}`,
        } as any,
        userId,
      );

      setStage('complete');
      return poId;
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
      return null;
    }
  }, [
    drafts, supplierName, supplierId, supplierContact, currency, notes,
    fileName, fileSize, storagePath, parseResult, subsidiaryId, userId,
  ]);

  // ── Auto-create inventory item from an unmatched draft line ──

  const createAndLinkInventory = useCallback(async (key: string) => {
    const draft = drafts.find((d) => d.key === key);
    if (!draft) return;

    // Optimistically show spinner while creating
    setDrafts((prev) =>
      prev.map((d) => d.key === key ? { ...d, matchStatus: 'pending' as const } : d),
    );

    try {
      const name = draft.description.trim() || 'Unnamed Item';
      const invCategory: InventoryCategory = 'other';
      const unit = (VALID_INVENTORY_UNITS.has(draft.unit) ? draft.unit : 'pcs') as InventoryUnit;
      const costPerUnit = parseFloat(draft.unitCost) || 0;
      const sku = draft.sku || generateSku(name, invCategory);

      const newId = await createInventoryItem(
        {
          sku,
          name,
          category: invCategory,
          pricing: { costPerUnit, currency, unit },
          status: 'active',
        },
        userId,
      );

      setDrafts((prev) =>
        prev.map((d) =>
          d.key === key
            ? { ...d, matchStatus: 'matched' as const, inventoryItemId: newId, sku }
            : d,
        ),
      );
    } catch (err) {
      // Revert to no-match so the button stays visible
      setDrafts((prev) =>
        prev.map((d) => d.key === key ? { ...d, matchStatus: 'no-match' as const } : d),
      );
      setError(`Failed to create inventory item: ${(err as Error).message}`);
    }
  }, [drafts, userId, currency]);

  // ── Reset ──

  const reset = useCallback(() => {
    setStage('idle');
    setProgress(0);
    setProgressStatus('');
    setError(null);
    setParseResult(null);
    setDrafts([]);
    setStoragePath('');
    setFileName('');
    setFileSize(0);
    setSupplierName('');
    setSupplierContact('');
    setSupplierId('');
    setCurrency('USD');
    setNotes('');
    setInvoiceRef('');
  }, []);

  return {
    // State
    stage, progress, progressStatus, error,
    parseResult, drafts, fileName, fileSize,
    // Header fields
    supplierName, setSupplierName,
    supplierContact, setSupplierContact,
    supplierId, setSupplierId,
    currency, setCurrency,
    notes, setNotes,
    invoiceRef, setInvoiceRef,
    // Actions
    startImport, updateDraft, acceptMatch, removeDraft, createAndLinkInventory, createPO, reset,
  };
}
