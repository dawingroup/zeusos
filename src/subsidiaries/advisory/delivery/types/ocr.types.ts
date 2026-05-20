/**
 * OCR & RECEIPT EXTRACTION TYPES
 *
 * Formal types for receipt data extraction, mobile money transactions,
 * EFRIS tax receipt data, and OCR review state.
 */

import type { PaymentMethod } from './quick-capture';

// ─────────────────────────────────────────────────────────────────
// RECEIPT EXTRACTION RESULT
// ─────────────────────────────────────────────────────────────────

export interface ReceiptExtractionResult {
  vendorName: string | null;
  totalAmount: number | null;
  currency: 'UGX' | 'USD' | null;
  date: string | null; // ISO date string YYYY-MM-DD
  description: string | null;
  paymentMethodHint: PaymentMethod | null;
  confidence: number; // 0-1 overall confidence
  rawText: string | null; // fallback raw text

  // Extended extraction data (Phase 3)
  mobileMoneyData?: MobileMoneyTransaction;
  efrisData?: EFRISReceiptData;
  lineItems?: ExtractedLineItem[];
}

// ─────────────────────────────────────────────────────────────────
// MOBILE MONEY TRANSACTION
// ─────────────────────────────────────────────────────────────────

export type MobileMoneyProvider = 'MTN' | 'Airtel';

export type MobileMoneyStatus = 'Successful' | 'Failed' | 'Pending';

export interface MobileMoneyTransaction {
  provider: MobileMoneyProvider;
  transactionId: string | null;
  referenceCode: string | null;
  senderName: string | null;
  senderPhone: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  amount: number | null;
  fee: number | null;
  currency: 'UGX' | 'USD';
  timestamp: string | null; // ISO datetime
  status: MobileMoneyStatus;
  rawMessage: string | null;
  confidence: number; // 0-1
}

// ─────────────────────────────────────────────────────────────────
// EFRIS RECEIPT DATA (lightweight OCR extraction)
// ─────────────────────────────────────────────────────────────────

export interface EFRISReceiptData {
  fdn: string | null; // Fiscal Document Number
  tin: string | null; // Tax Identification Number (10 digits)
  sellerName: string | null;
  sellerTIN: string | null;
  buyerName: string | null;
  buyerTIN: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // ISO date
  vatAmount: number | null;
  totalExclVAT: number | null;
  totalInclVAT: number | null;
  currency: 'UGX' | 'USD';
  items: EFRISExtractedItem[];
  verificationCode: string | null;
  isValid: boolean; // Whether the FDN format is valid
  confidence: number;
}

export interface EFRISExtractedItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  vatRate: number | null; // e.g. 18 for 18%
}

// ─────────────────────────────────────────────────────────────────
// EXTRACTED LINE ITEMS (generic)
// ─────────────────────────────────────────────────────────────────

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

// ─────────────────────────────────────────────────────────────────
// OCR FIELD CONFIDENCE (per-field tracking)
// ─────────────────────────────────────────────────────────────────

export type OCRSource = 'gemini_client' | 'cloud_vision' | 'manual';

export interface OCRFieldConfidence {
  fieldName: string;
  value: unknown;
  confidence: number;
  source: OCRSource;
}

// ─────────────────────────────────────────────────────────────────
// OCR REVIEW STATE (user confirmation tracking)
// ─────────────────────────────────────────────────────────────────

export interface OCRReviewField {
  value: string;
  confirmed: boolean;
  aiSuggested: string | null;
  confidence: number;
  source: OCRSource;
}

export interface OCRReviewState {
  fields: Record<string, OCRReviewField>;
  allConfirmed: boolean;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

// ─────────────────────────────────────────────────────────────────
// EXTRACTION MODE
// ─────────────────────────────────────────────────────────────────

export type ExtractionMode = 'auto' | 'receipt' | 'mobileMoney' | 'efris';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Create an empty OCR review state from an extraction result.
 */
export function createReviewStateFromExtraction(
  result: ReceiptExtractionResult,
  source: OCRSource = 'gemini_client'
): OCRReviewState {
  const fields: Record<string, OCRReviewField> = {};

  const fieldMap: Record<string, unknown> = {
    vendorName: result.vendorName,
    totalAmount: result.totalAmount,
    currency: result.currency,
    date: result.date,
    description: result.description,
    paymentMethod: result.paymentMethodHint,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    fields[key] = {
      value: value != null ? String(value) : '',
      confirmed: false,
      aiSuggested: value != null ? String(value) : null,
      confidence: result.confidence,
      source,
    };
  }

  return {
    fields,
    allConfirmed: false,
    reviewedAt: null,
    reviewedBy: null,
  };
}

/**
 * Validate a Uganda TIN format (10 digits).
 */
export function isValidUgandaTIN(tin: string): boolean {
  return /^\d{10}$/.test(tin.replace(/\s/g, ''));
}

/**
 * Validate EFRIS FDN format: XXXXXXXX-YYYYYYYY-ZZZZ
 */
export function isValidFDN(fdn: string): boolean {
  return /^\d{8}-\d{8}-\d{4}$/.test(fdn.trim());
}
