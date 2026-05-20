/**
 * useReceiptExtraction Hook
 *
 * Wraps ReceiptExtractionService for use in React components.
 * Non-blocking: extraction runs in the background while user can fill the form.
 * Supports auto-detection of mobile money and EFRIS receipts.
 */

import { useState, useCallback } from 'react';
import { ReceiptExtractionService } from '../services/receipt-extraction-service';
import type {
  ReceiptExtractionResult,
  MobileMoneyTransaction,
  EFRISReceiptData,
  ExtractionMode,
} from '../types/ocr.types';

export interface UseReceiptExtractionReturn {
  extract: (file: File, mode?: ExtractionMode) => Promise<ReceiptExtractionResult>;
  extractMobileMoney: (file: File) => Promise<MobileMoneyTransaction>;
  extractMobileMoneyFromText: (smsText: string) => Promise<MobileMoneyTransaction>;
  extractEFRIS: (file: File) => Promise<EFRISReceiptData>;
  reExtract: (file: File, mode: ExtractionMode) => Promise<void>;
  result: ReceiptExtractionResult | null;
  mobileMoneyData: MobileMoneyTransaction | null;
  efrisData: EFRISReceiptData | null;
  extracting: boolean;
  error: Error | null;
  clear: () => void;
}

export function useReceiptExtraction(): UseReceiptExtractionReturn {
  const [result, setResult] = useState<ReceiptExtractionResult | null>(null);
  const [mobileMoneyData, setMobileMoneyData] = useState<MobileMoneyTransaction | null>(null);
  const [efrisData, setEfrisData] = useState<EFRISReceiptData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const extract = useCallback(async (
    file: File,
    mode: ExtractionMode = 'auto'
  ): Promise<ReceiptExtractionResult> => {
    setExtracting(true);
    setError(null);
    try {
      const service = ReceiptExtractionService.getInstance();

      if (mode === 'mobileMoney') {
        const momoResult = await service.extractMobileMoneyFromImage(file);
        setMobileMoneyData(momoResult);
        // Create a ReceiptExtractionResult from mobile money data
        const receiptResult: ReceiptExtractionResult = {
          vendorName: momoResult.receiverName,
          totalAmount: momoResult.amount,
          currency: momoResult.currency,
          date: momoResult.timestamp?.split('T')[0] || null,
          description: `Mobile Money to ${momoResult.receiverName || momoResult.receiverPhone || 'Unknown'}`,
          paymentMethodHint: 'MobileMoney',
          confidence: momoResult.confidence,
          rawText: momoResult.rawMessage,
          mobileMoneyData: momoResult,
        };
        setResult(receiptResult);
        return receiptResult;
      }

      if (mode === 'efris') {
        const efris = await service.extractEFRISData(file);
        setEfrisData(efris);
        const receiptResult: ReceiptExtractionResult = {
          vendorName: efris.sellerName,
          totalAmount: efris.totalInclVAT,
          currency: efris.currency,
          date: efris.invoiceDate,
          description: efris.items.map(i => i.description).filter(Boolean).join(', ') || null,
          paymentMethodHint: null,
          confidence: efris.confidence,
          rawText: null,
          efrisData: efris,
        };
        setResult(receiptResult);
        return receiptResult;
      }

      // Auto or receipt mode — use general extraction (auto-detects MoMo/EFRIS)
      const extraction = await service.extractFromImage(file);
      setResult(extraction);

      // Store extended data if detected
      if (extraction.mobileMoneyData) {
        setMobileMoneyData(extraction.mobileMoneyData);
      }
      if (extraction.efrisData) {
        setEfrisData(extraction.efrisData);
      }

      return extraction;
    } catch (err) {
      const extractionError = err instanceof Error ? err : new Error('Extraction failed');
      setError(extractionError);
      throw extractionError;
    } finally {
      setExtracting(false);
    }
  }, []);

  const extractMobileMoney = useCallback(async (file: File): Promise<MobileMoneyTransaction> => {
    setExtracting(true);
    setError(null);
    try {
      const service = ReceiptExtractionService.getInstance();
      const momoResult = await service.extractMobileMoneyFromImage(file);
      setMobileMoneyData(momoResult);
      return momoResult;
    } catch (err) {
      const extractionError = err instanceof Error ? err : new Error('Mobile money extraction failed');
      setError(extractionError);
      throw extractionError;
    } finally {
      setExtracting(false);
    }
  }, []);

  const extractMobileMoneyFromText = useCallback(async (smsText: string): Promise<MobileMoneyTransaction> => {
    setExtracting(true);
    setError(null);
    try {
      const service = ReceiptExtractionService.getInstance();
      const momoResult = await service.extractMobileMoneyFromText(smsText);
      setMobileMoneyData(momoResult);
      return momoResult;
    } catch (err) {
      const extractionError = err instanceof Error ? err : new Error('SMS extraction failed');
      setError(extractionError);
      throw extractionError;
    } finally {
      setExtracting(false);
    }
  }, []);

  const extractEFRIS = useCallback(async (file: File): Promise<EFRISReceiptData> => {
    setExtracting(true);
    setError(null);
    try {
      const service = ReceiptExtractionService.getInstance();
      const efris = await service.extractEFRISData(file);
      setEfrisData(efris);
      return efris;
    } catch (err) {
      const extractionError = err instanceof Error ? err : new Error('EFRIS extraction failed');
      setError(extractionError);
      throw extractionError;
    } finally {
      setExtracting(false);
    }
  }, []);

  const reExtract = useCallback(async (file: File, mode: ExtractionMode): Promise<void> => {
    await extract(file, mode);
  }, [extract]);

  const clear = useCallback(() => {
    setResult(null);
    setMobileMoneyData(null);
    setEfrisData(null);
    setError(null);
  }, []);

  return {
    extract,
    extractMobileMoney,
    extractMobileMoneyFromText,
    extractEFRIS,
    reExtract,
    result,
    mobileMoneyData,
    efrisData,
    extracting,
    error,
    clear,
  };
}
