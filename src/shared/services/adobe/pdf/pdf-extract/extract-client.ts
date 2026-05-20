/**
 * Adobe PDF Extract API Client
 *
 * Extracts text, tables, and images from PDFs using Adobe's AI-powered extraction.
 * Particularly useful for BOQ import and invoice processing in MatFlow.
 *
 * @see https://developer.adobe.com/document-services/docs/overview/pdf-extract-api/
 */

import {
  ExtractPdfOptions,
  PdfExtractResult,
  ExtractedTable,
  ExtractedText,
  ExtractedFigure,
} from '../../types/pdf-services.types';
import { AdobeOperationResult, AdobeFileRef, ProgressCallback } from '../../types/common';
import { parseAdobeError, isRetryableError, getRetryDelay, ADOBE_ERROR_CODES } from '../../utils/error-handler';
import { getAdobeConfig, logAdobeDebug } from '../../config';
import { httpsCallable, getFunctions } from 'firebase/functions';

const MAX_RETRIES = 3;

export class AdobePdfExtractClient {
  private functions = getFunctions();

  /**
   * Check if PDF Extract is enabled
   */
  isEnabled(): boolean {
    return getAdobeConfig().pdfServices.enabled;
  }

  /**
   * Extract content from PDF (text, tables, figures)
   */
  async extract(
    options: ExtractPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<PdfExtractResult>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const fileData = await this.prepareFileData(options.input);

      onProgress?.({ percent: 25, status: 'Uploading to Adobe...' });

      const extractPdfFn = httpsCallable<
        {
          fileData: string;
          elementsToExtract: string[];
          tableOutputFormat?: string;
          includeRenditions?: boolean;
          includeStyling?: boolean;
        },
        {
          text: ExtractedText[];
          tables: ExtractedTable[];
          figures?: ExtractedFigure[];
          metadata?: PdfExtractResult['metadata'];
        }
      >(this.functions, 'adobeExtractPdf');

      onProgress?.({ percent: 50, status: 'Extracting content...' });

      const result = await extractPdfFn({
        fileData: fileData.base64,
        elementsToExtract: options.elementsToExtract,
        tableOutputFormat: options.tableOutputFormat,
        includeRenditions: options.includeRenditions,
        includeStyling: options.includeStyling,
      });

      onProgress?.({ percent: 90, status: 'Processing results...' });

      const extractResult: PdfExtractResult = {
        text: result.data.text || [],
        tables: result.data.tables || [],
        figures: result.data.figures,
        metadata: result.data.metadata,
      };

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: extractResult,
      };
    });
  }

  /**
   * Extract tables only from PDF
   * Optimized for BOQ import use case in MatFlow
   */
  async extractTables(
    input: AdobeFileRef,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<ExtractedTable[]>> {
    const result = await this.extract(
      {
        input,
        elementsToExtract: ['tables'],
        tableOutputFormat: 'json',
      },
      onProgress
    );

    if (!result.success) {
      return {
        success: false,
        status: 'failed',
        error: result.error,
      };
    }

    return {
      success: true,
      status: 'completed',
      data: result.data?.tables || [],
    };
  }

  /**
   * Extract text only from PDF
   */
  async extractText(
    input: AdobeFileRef,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<ExtractedText[]>> {
    const result = await this.extract(
      {
        input,
        elementsToExtract: ['text'],
      },
      onProgress
    );

    if (!result.success) {
      return {
        success: false,
        status: 'failed',
        error: result.error,
      };
    }

    return {
      success: true,
      status: 'completed',
      data: result.data?.text || [],
    };
  }

  /**
   * Extract all content (text, tables, figures) from PDF
   */
  async extractAll(
    input: AdobeFileRef,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<PdfExtractResult>> {
    return this.extract(
      {
        input,
        elementsToExtract: ['text', 'tables', 'figures'],
        includeRenditions: true,
        includeStyling: true,
      },
      onProgress
    );
  }

  /**
   * Extract tables and convert to structured data for BOQ import
   * This is a high-level method specifically for MatFlow BOQ processing
   */
  async extractTablesForBOQ(
    input: AdobeFileRef,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<BOQExtractionResult>> {
    const result = await this.extractTables(input, onProgress);

    if (!result.success || !result.data) {
      return {
        success: false,
        status: 'failed',
        error: result.error,
      };
    }

    // Analyze tables to find BOQ-like structure
    const boqTables = result.data.filter(table => this.isLikelyBOQTable(table));

    const items: BOQItem[] = [];
    for (const table of boqTables) {
      const parsedItems = this.parseBOQTable(table);
      items.push(...parsedItems);
    }

    return {
      success: true,
      status: 'completed',
      data: {
        items,
        rawTables: result.data,
        confidence: items.length > 0 ? this.calculateConfidence(items) : 0,
      },
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async prepareFileData(fileRef: AdobeFileRef): Promise<{
    base64: string;
    fileName: string;
    mimeType: string;
  }> {
    let blob: Blob;
    let fileName = fileRef.fileName || 'document.pdf';
    const mimeType = fileRef.mimeType || 'application/pdf';

    switch (fileRef.type) {
      case 'url':
        const response = await fetch(fileRef.value as string);
        blob = await response.blob();
        break;

      case 'base64':
        const binaryString = atob(fileRef.value as string);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: mimeType });
        break;

      case 'buffer':
        // Convert Buffer to Uint8Array for Blob compatibility
        const bufferValue = fileRef.value as Buffer;
        blob = new Blob([new Uint8Array(bufferValue)], { type: mimeType });
        break;

      case 'storage':
        const storageResponse = await fetch(fileRef.value as string);
        blob = await storageResponse.blob();
        break;

      default:
        throw new Error(`Unsupported file reference type: ${fileRef.type}`);
    }

    const base64 = await this.blobToBase64(blob);

    return { base64, fileName, mimeType };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Check if a table looks like a BOQ (Bill of Quantities)
   */
  private isLikelyBOQTable(table: ExtractedTable): boolean {
    const headers = table.headers || (table.rows.length > 0 ? table.rows[0] : []);
    const headerText = headers.join(' ').toLowerCase();

    // Common BOQ column headers
    const boqKeywords = [
      'item', 'description', 'quantity', 'qty', 'unit', 'rate',
      'amount', 'total', 'price', 'cost', 'spec', 'material',
      'no.', 'no', 'sn', 's/n', 'ref', 'code'
    ];

    const matchCount = boqKeywords.filter(kw => headerText.includes(kw)).length;

    // Need at least 3 BOQ-like headers to consider it a BOQ table
    return matchCount >= 3;
  }

  /**
   * Parse a BOQ table into structured items
   */
  private parseBOQTable(table: ExtractedTable): BOQItem[] {
    const items: BOQItem[] = [];

    // Determine header row
    const headers = table.headers || (table.rows.length > 0 ? table.rows[0] : []);
    const dataRows = table.headers ? table.rows : table.rows.slice(1);

    // Map column indices
    const columnMap = this.mapBOQColumns(headers);

    for (const row of dataRows) {
      // Skip empty rows
      if (row.every(cell => !cell.trim())) continue;

      const item: BOQItem = {
        itemNumber: columnMap.itemNumber !== undefined ? row[columnMap.itemNumber]?.trim() : undefined,
        description: columnMap.description !== undefined ? row[columnMap.description]?.trim() : '',
        quantity: columnMap.quantity !== undefined ? this.parseNumber(row[columnMap.quantity]) : undefined,
        unit: columnMap.unit !== undefined ? row[columnMap.unit]?.trim() : undefined,
        rate: columnMap.rate !== undefined ? this.parseNumber(row[columnMap.rate]) : undefined,
        amount: columnMap.amount !== undefined ? this.parseNumber(row[columnMap.amount]) : undefined,
        confidence: table.confidence || 0.8,
      };

      // Only add items with at least a description
      if (item.description) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Map BOQ column headers to standard fields
   */
  private mapBOQColumns(headers: string[]): BOQColumnMap {
    const map: BOQColumnMap = {};
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    for (let i = 0; i < lowerHeaders.length; i++) {
      const header = lowerHeaders[i];

      if (header.match(/^(item|no\.?|sn|s\/n|ref|#)$/)) {
        map.itemNumber = i;
      } else if (header.match(/desc|specification|particulars|material/)) {
        map.description = i;
      } else if (header.match(/^(qty|quantity|qnty)$/)) {
        map.quantity = i;
      } else if (header.match(/^(unit|uom)$/)) {
        map.unit = i;
      } else if (header.match(/rate|price|cost$/)) {
        map.rate = i;
      } else if (header.match(/amount|total|value$/)) {
        map.amount = i;
      }
    }

    return map;
  }

  /**
   * Parse a number from a string, handling currency formatting
   */
  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;

    // Remove currency symbols, commas, and spaces
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);

    return isNaN(num) ? undefined : num;
  }

  /**
   * Calculate confidence score for extracted BOQ items
   */
  private calculateConfidence(items: BOQItem[]): number {
    if (items.length === 0) return 0;

    let totalScore = 0;
    for (const item of items) {
      let itemScore = 0;
      if (item.description) itemScore += 0.3;
      if (item.quantity !== undefined) itemScore += 0.2;
      if (item.unit) itemScore += 0.15;
      if (item.rate !== undefined) itemScore += 0.2;
      if (item.amount !== undefined) itemScore += 0.15;
      totalScore += itemScore;
    }

    return totalScore / items.length;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AdobeOperationResult<T>>
  ): Promise<AdobeOperationResult<T>> {
    let lastError: ReturnType<typeof parseAdobeError> | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = parseAdobeError(error);
        logAdobeDebug('PDF Extract error', { attempt, error: lastError });

        if (!isRetryableError(lastError)) {
          return {
            success: false,
            status: 'failed',
            error: lastError,
          };
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = getRetryDelay(attempt);
          logAdobeDebug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      status: 'failed',
      error: lastError || {
        code: ADOBE_ERROR_CODES.OPERATION_FAILED,
        message: 'Max retries exceeded',
        retryable: false,
      },
    };
  }
}

// =============================================================================
// BOQ-specific Types
// =============================================================================

interface BOQColumnMap {
  itemNumber?: number;
  description?: number;
  quantity?: number;
  unit?: number;
  rate?: number;
  amount?: number;
}

export interface BOQItem {
  itemNumber?: string;
  description: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
  confidence: number;
}

export interface BOQExtractionResult {
  items: BOQItem[];
  rawTables: ExtractedTable[];
  confidence: number;
}

// Singleton export
export const adobePdfExtract = new AdobePdfExtractClient();
