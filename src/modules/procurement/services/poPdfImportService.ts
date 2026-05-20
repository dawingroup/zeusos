/**
 * PO PDF Import Service
 * Orchestrates the pipeline: Upload → AI Parse (Gemini) → Match
 *
 * Sends the raw PDF directly to Gemini 2.0 Flash via Cloud Function.
 * Gemini natively supports PDF as inline data — no Adobe extraction needed.
 */

import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, functions } from '@/shared/services/firebase';
import { searchInventory } from '@/modules/inventory/services/inventoryService';
import type {
  POPdfParseResult,
  ParsedPOLineItem,
  POImportLineItemDraft,
} from '../types/poPdfImport';
import type { UnifiedSearchResult } from '../hooks/usePOItemSearch';

// ============================================
// Step 1: Upload PDF to Storage
// ============================================

export async function uploadPdfToStorage(
  file: File,
  subsidiaryId: string,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `po-imports/${subsidiaryId}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  return { storagePath, downloadUrl };
}

// ============================================
// Step 2: AI Parse via Cloud Function (direct PDF)
// ============================================

/** Convert a File to base64 string */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip the data:application/pdf;base64, prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function parsePdfWithAI(pdfBase64: string): Promise<POPdfParseResult> {
  const parseFn = httpsCallable<
    { pdfBase64: string },
    POPdfParseResult
  >(functions, 'parsePurchaseOrderPdf', { timeout: 330_000 }); // 5.5 min — covers 300s function + overhead

  const result = await parseFn({ pdfBase64 });
  return result.data;
}

// ============================================
// Step 3: Match against inventory
// ============================================

/**
 * Extract meaningful keywords from a supplier description for fallback searching.
 * Filters out stop words and very short tokens so we search on the actual item
 * words (e.g. "marine", "plywood", "18mm") rather than noise ("and", "for", "pcs").
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'and', 'the', 'for', 'with', 'from', 'size', 'type', 'grade', 'class',
    'each', 'per', 'qty', 'piece', 'pcs', 'box', 'pack', 'set', 'lot', 'new',
    'used', 'ref', 'item', 'part', 'no', 'nos', 'unit', 'units',
  ]);
  return description
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t))
    .filter((v, i, arr) => arr.indexOf(v) === i) // dedupe
    .slice(0, 4);
}

export async function matchLineItems(
  parsedLines: ParsedPOLineItem[],
  onLineMatched?: (index: number, total: number) => void,
): Promise<POImportLineItemDraft[]> {
  const drafts: POImportLineItemDraft[] = [];

  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i];
    onLineMatched?.(i, parsedLines.length);

    let matchCandidates: UnifiedSearchResult[] = [];
    let bestMatch: UnifiedSearchResult | undefined;
    let matchStatus: POImportLineItemDraft['matchStatus'] = 'no-match';

    try {
      // Primary: SKU match (most precise — check first)
      if (line.sku) {
        const skuResults = await searchInventory(line.sku, { limit: 3 });
        for (const skuItem of skuResults) {
          matchCandidates.unshift({ source: 'inventory' as const, item: skuItem });
        }
      }

      // Secondary: full description search (first 60 chars)
      if (matchCandidates.length === 0) {
        const primaryTerm = line.description.substring(0, 60);
        const descResults = await searchInventory(primaryTerm, { limit: 5 });
        matchCandidates = descResults.map((item) => ({
          source: 'inventory' as const,
          item,
        }));
      }

      // Fallback: individual keyword searches — only triggered when the above
      // found nothing (handles cases where supplier wording differs from our names)
      if (matchCandidates.length === 0) {
        const keywords = extractKeywords(line.description);
        for (const kw of keywords.slice(0, 3)) {
          const kwResults = await searchInventory(kw, { limit: 5 });
          for (const item of kwResults) {
            if (!matchCandidates.some((c) => c.source === 'inventory' && c.item.id === item.id)) {
              matchCandidates.push({ source: 'inventory' as const, item });
            }
          }
          if (matchCandidates.length >= 6) break;
        }
      }

      if (matchCandidates.length > 0) {
        bestMatch = matchCandidates[0];
        matchStatus = 'matched';
      }
    } catch {
      // Non-critical — line stays as no-match
    }

    drafts.push({
      key: crypto.randomUUID(),
      parsed: line,
      description: line.description,
      sku: line.sku || '',
      quantity: line.quantity.toString(),
      unitCost: line.unitCost.toString(),
      unit: line.unit,
      weight: '',
      category: line.suggestedCategory,
      matchStatus,
      bestMatch,
      matchCandidates,
      inventoryItemId: '',
      materialId: '',
      assetId: '',
      assetCategory: '',
      packagingQty: '',
      packagingUnit: '',
      derivedUnitCost: '',
      baseUnit: '',
    });
  }

  return drafts;
}

// ============================================
// Full pipeline orchestrator
// ============================================

export interface ImportPipelineCallbacks {
  onStageChange: (stage: string) => void;
  onProgress: (p: { percent: number; status: string }) => void;
  onLineMatched?: (index: number, total: number) => void;
}

export async function runImportPipeline(
  file: File,
  subsidiaryId: string,
  callbacks: ImportPipelineCallbacks,
): Promise<{
  parseResult: POPdfParseResult;
  drafts: POImportLineItemDraft[];
  storagePath: string;
}> {
  // Step 1: Upload to Storage (for audit trail)
  callbacks.onStageChange('uploading');
  callbacks.onProgress({ percent: 5, status: 'Uploading PDF...' });
  const { storagePath } = await uploadPdfToStorage(file, subsidiaryId);

  // Step 2: Convert file to base64
  callbacks.onStageChange('extracting');
  callbacks.onProgress({ percent: 15, status: 'Preparing PDF for AI...' });
  const pdfBase64 = await fileToBase64(file);

  // Step 3: AI Parse (Gemini reads the PDF directly)
  callbacks.onStageChange('parsing');
  callbacks.onProgress({ percent: 25, status: 'AI analyzing document...' });
  const parseResult = await parsePdfWithAI(pdfBase64);
  callbacks.onProgress({ percent: 70, status: `Found ${parseResult.lineItems.length} line items` });

  // Step 4: Match against inventory
  callbacks.onStageChange('matching');
  const drafts = await matchLineItems(parseResult.lineItems, callbacks.onLineMatched);

  return { parseResult, drafts, storagePath };
}
