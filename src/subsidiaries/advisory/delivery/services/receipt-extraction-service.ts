/**
 * RECEIPT EXTRACTION SERVICE
 *
 * Uses Gemini Flash (client-side) to extract structured data from receipt/invoice photos.
 * Supports general receipts, mobile money transactions (MTN MoMo, Airtel Money),
 * and EFRIS tax receipts.
 * Designed for Uganda context: UGX default currency, local language support.
 */

import type { PaymentMethod } from '../types/quick-capture';
import type {
  ReceiptExtractionResult,
  MobileMoneyTransaction,
  MobileMoneyProvider,
  EFRISReceiptData,
  EFRISExtractedItem,
} from '../types/ocr.types';
import { isValidFDN, isValidUgandaTIN } from '../types/ocr.types';

// Re-export for backward compatibility
export type { ReceiptExtractionResult } from '../types/ocr.types';

// ─────────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a receipt/invoice data extractor for a construction project management system in Uganda.

Analyze this receipt or invoice image and extract the following information. Return ONLY valid JSON, no markdown.

{
  "vendorName": "Name of the vendor/shop/supplier",
  "totalAmount": 1234567,
  "currency": "UGX or USD",
  "date": "YYYY-MM-DD",
  "description": "Brief description of items purchased",
  "paymentMethodHint": "Cash or MobileMoney or BankTransfer or Cheque",
  "confidence": 0.85,
  "lineItems": [{"description": "item name", "quantity": 1, "unitPrice": 5000, "totalPrice": 5000}],
  "isMobileMoney": false,
  "isEFRIS": false,
  "mobileMoneyProvider": null,
  "hasFDN": false
}

Rules:
- totalAmount must be a number (no commas, no currency symbols)
- Default currency to "UGX" if unclear
- date should be in ISO format YYYY-MM-DD
- If you cannot extract a field, set it to null
- confidence is 0-1 indicating how readable the receipt is
- The receipt may be in English, Luganda, Runyankole, or Swahili
- Common Uganda vendors: hardware stores, cement dealers, fuel stations, mobile money agents
- paymentMethodHint: look for clues like "MTN", "Airtel", "mobile money" → MobileMoney; "cash" → Cash; "bank", "transfer" → BankTransfer; "cheque" → Cheque
- For description, summarize the purchased items (e.g., "50 bags Portland cement, 10 rolls binding wire")
- Set isMobileMoney=true if this appears to be a mobile money receipt/screenshot (MTN MoMo, Airtel Money)
- Set mobileMoneyProvider to "MTN" or "Airtel" if detected
- Set isEFRIS=true if you see EFRIS branding, FDN (Fiscal Document Number), or URA markings
- Set hasFDN=true if a Fiscal Document Number is visible
- lineItems: extract individual items if visible on the receipt`;

const MOBILE_MONEY_PROMPT = `You are a mobile money transaction data extractor for Uganda. Analyze this image of a mobile money receipt, SMS, or screenshot.

Extract the following. Return ONLY valid JSON, no markdown.

{
  "provider": "MTN or Airtel",
  "transactionId": "The transaction ID (e.g., TxnId: 12345678901, Ref: ABC123)",
  "referenceCode": "Reference code if separate from transaction ID",
  "senderName": "Person who sent money",
  "senderPhone": "Sender phone number (format: 256XXXXXXXXX or 07XXXXXXXX)",
  "receiverName": "Person or business who received money",
  "receiverPhone": "Receiver phone number",
  "amount": 50000,
  "fee": 1000,
  "currency": "UGX",
  "timestamp": "YYYY-MM-DDTHH:mm:ss",
  "status": "Successful or Failed or Pending",
  "confidence": 0.9,
  "rawMessage": "The full SMS or receipt text if visible"
}

Rules:
- amount and fee must be numbers (no commas)
- MTN MoMo patterns: "MoMo", "TxnId:", "Financial Transaction Id:", "MTN Mobile Money"
- Airtel Money patterns: "Airtel Money", "Transaction ID:", "Ref:"
- Phone numbers: Uganda format 256XXXXXXXXX or 07XXXXXXXX
- Set null for any field you cannot find
- confidence: 0-1 indicating extraction reliability`;

const EFRIS_PROMPT = `You are an EFRIS (Electronic Fiscal Receipting and Invoicing Solution) tax receipt extractor for Uganda Revenue Authority.

Analyze this EFRIS receipt/invoice image and extract tax information. Return ONLY valid JSON, no markdown.

{
  "fdn": "XXXXXXXX-YYYYYYYY-ZZZZ (Fiscal Document Number)",
  "tin": "Seller's 10-digit Tax Identification Number",
  "sellerName": "Seller/supplier business name",
  "sellerTIN": "Seller TIN",
  "buyerName": "Buyer name if visible",
  "buyerTIN": "Buyer TIN if visible",
  "invoiceNumber": "Invoice number",
  "invoiceDate": "YYYY-MM-DD",
  "vatAmount": 45000,
  "totalExclVAT": 250000,
  "totalInclVAT": 295000,
  "currency": "UGX",
  "items": [
    {"description": "item", "quantity": 1, "unitPrice": 250000, "totalPrice": 250000, "vatRate": 18}
  ],
  "verificationCode": "QR code or verification code if visible",
  "confidence": 0.85
}

Rules:
- FDN format: XXXXXXXX-YYYYYYYY-ZZZZ (8 digits, dash, 8 digits, dash, 4 digits)
- TIN is exactly 10 digits
- VAT standard rate in Uganda is 18%
- amounts must be numbers (no commas)
- Items should include VAT rate (18 for standard, 0 for zero-rated)
- Set null for any field you cannot extract`;

// ─────────────────────────────────────────────────────────────────
// MOBILE MONEY SMS REGEX PATTERNS
// ─────────────────────────────────────────────────────────────────

const MTN_PATTERNS = {
  transactionId: /(?:TxnId|Financial Transaction Id|Trans\.?\s*ID)[:\s]*([A-Z0-9]+)/i,
  amount: /(?:UGX|Ugx)\s*([\d,]+(?:\.\d{2})?)/,
  fee: /(?:Fee|Charge)[:\s]*(?:UGX|Ugx)?\s*([\d,]+(?:\.\d{2})?)/i,
  phone: /(256\d{9}|0[37]\d{8})/,
  name: /(?:to|from|sent to|received from)\s+([A-Z][A-Za-z\s]+?)(?:\s+\d|\.|\,)/i,
  date: /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
};

const AIRTEL_PATTERNS = {
  transactionId: /(?:Transaction ID|Ref|Reference)[:\s]*([A-Z0-9]+)/i,
  amount: /(?:UGX|Ugx)\s*([\d,]+(?:\.\d{2})?)/,
  fee: /(?:Fee|Charge)[:\s]*(?:UGX|Ugx)?\s*([\d,]+(?:\.\d{2})?)/i,
  phone: /(256\d{9}|0[37]\d{8})/,
  name: /(?:to|from|sent to|received from)\s+([A-Z][A-Za-z\s]+?)(?:\s+\d|\.|\,)/i,
  date: /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
};

// ─────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────

export class ReceiptExtractionService {
  private static instance: ReceiptExtractionService;
  private genAI: any = null;

  private constructor() {}

  static getInstance(): ReceiptExtractionService {
    if (!ReceiptExtractionService.instance) {
      ReceiptExtractionService.instance = new ReceiptExtractionService();
    }
    return ReceiptExtractionService.instance;
  }

  private async getGenAI(): Promise<any> {
    if (!this.genAI) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY not configured');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  /**
   * Convert a File to base64 data.
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Send image to Gemini with a specific prompt.
   */
  private async callGemini(file: File, prompt: string): Promise<string> {
    const genAI = await this.getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const base64Data = await this.fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } },
    ]);

    return result.response.text();
  }

  /**
   * Parse JSON from Gemini response, stripping markdown fences.
   */
  private parseJSON(text: string): any {
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  }

  // ─────────────────────────────────────────────────────────────
  // GENERAL RECEIPT EXTRACTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Extract receipt data from an image file using Gemini Flash.
   * Auto-detects mobile money and EFRIS receipts and extracts additional data.
   */
  async extractFromImage(file: File): Promise<ReceiptExtractionResult> {
    try {
      const text = await this.callGemini(file, EXTRACTION_PROMPT);

      try {
        const parsed = this.parseJSON(text);

        const baseResult: ReceiptExtractionResult = {
          vendorName: parsed.vendorName || null,
          totalAmount: typeof parsed.totalAmount === 'number' ? parsed.totalAmount : null,
          currency: parsed.currency === 'USD' ? 'USD' : parsed.currency === 'UGX' ? 'UGX' : null,
          date: parsed.date || null,
          description: parsed.description || null,
          paymentMethodHint: this.validatePaymentMethod(parsed.paymentMethodHint),
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          rawText: null,
          lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : undefined,
        };

        // Auto-detect and extract mobile money data
        if (parsed.isMobileMoney || parsed.mobileMoneyProvider) {
          try {
            baseResult.mobileMoneyData = await this.extractMobileMoneyFromImage(file);
            if (!baseResult.paymentMethodHint) {
              baseResult.paymentMethodHint = 'MobileMoney';
            }
          } catch {
            // Mobile money extraction failed — continue with base result
          }
        }

        // Auto-detect and extract EFRIS data
        if (parsed.isEFRIS || parsed.hasFDN) {
          try {
            baseResult.efrisData = await this.extractEFRISData(file);
          } catch {
            // EFRIS extraction failed — continue with base result
          }
        }

        return baseResult;
      } catch {
        return {
          vendorName: null,
          totalAmount: null,
          currency: null,
          date: null,
          description: null,
          paymentMethodHint: null,
          confidence: 0,
          rawText: text,
        };
      }
    } catch (err) {
      console.error('Receipt extraction failed:', err);
      return {
        vendorName: null,
        totalAmount: null,
        currency: null,
        date: null,
        description: null,
        paymentMethodHint: null,
        confidence: 0,
        rawText: null,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MOBILE MONEY EXTRACTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Extract mobile money transaction data from an image.
   */
  async extractMobileMoneyFromImage(file: File): Promise<MobileMoneyTransaction> {
    try {
      const text = await this.callGemini(file, MOBILE_MONEY_PROMPT);
      const parsed = this.parseJSON(text);

      return {
        provider: this.validateProvider(parsed.provider),
        transactionId: parsed.transactionId || null,
        referenceCode: parsed.referenceCode || null,
        senderName: parsed.senderName || null,
        senderPhone: parsed.senderPhone || null,
        receiverName: parsed.receiverName || null,
        receiverPhone: parsed.receiverPhone || null,
        amount: typeof parsed.amount === 'number' ? parsed.amount : null,
        fee: typeof parsed.fee === 'number' ? parsed.fee : null,
        currency: parsed.currency === 'USD' ? 'USD' : 'UGX',
        timestamp: parsed.timestamp || null,
        status: this.validateMoMoStatus(parsed.status),
        rawMessage: parsed.rawMessage || null,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch (err) {
      console.error('Mobile money extraction failed:', err);
      return this.emptyMobileMoneyResult();
    }
  }

  /**
   * Extract mobile money data from SMS text (regex + Gemini fallback).
   */
  async extractMobileMoneyFromText(smsText: string): Promise<MobileMoneyTransaction> {
    // Determine provider
    const isMTN = /MTN|MoMo|Mobile Money/i.test(smsText);
    const isAirtel = /Airtel/i.test(smsText);
    const provider: MobileMoneyProvider = isAirtel ? 'Airtel' : 'MTN';
    const patterns = provider === 'MTN' ? MTN_PATTERNS : AIRTEL_PATTERNS;

    // Try regex extraction first
    const transactionIdMatch = smsText.match(patterns.transactionId);
    const amountMatch = smsText.match(patterns.amount);
    const feeMatch = smsText.match(patterns.fee);
    const phoneMatch = smsText.match(patterns.phone);
    const nameMatch = smsText.match(patterns.name);
    const dateMatch = smsText.match(patterns.date);

    const regexResult: MobileMoneyTransaction = {
      provider,
      transactionId: transactionIdMatch?.[1] || null,
      referenceCode: null,
      senderName: null,
      senderPhone: null,
      receiverName: nameMatch?.[1]?.trim() || null,
      receiverPhone: phoneMatch?.[1] || null,
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
      fee: feeMatch ? parseFloat(feeMatch[1].replace(/,/g, '')) : null,
      currency: 'UGX',
      timestamp: dateMatch ? this.parseDateString(dateMatch[1]) : null,
      status: /success|completed|confirmed/i.test(smsText) ? 'Successful'
        : /fail|rejected|declined/i.test(smsText) ? 'Failed'
        : 'Pending',
      rawMessage: smsText,
      confidence: transactionIdMatch && amountMatch ? 0.8 : 0.4,
    };

    // If regex extraction has low confidence, try Gemini as fallback
    if (regexResult.confidence < 0.6 && (isMTN || isAirtel)) {
      try {
        const genAI = await this.getGenAI();
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const textPrompt = MOBILE_MONEY_PROMPT.replace(
          'Analyze this image of a mobile money receipt, SMS, or screenshot.',
          'Analyze this mobile money SMS text message.'
        );

        const result = await model.generateContent([textPrompt, smsText]);
        const parsed = this.parseJSON(result.response.text());

        return {
          ...regexResult,
          ...parsed,
          provider: this.validateProvider(parsed.provider || regexResult.provider),
          amount: typeof parsed.amount === 'number' ? parsed.amount : regexResult.amount,
          rawMessage: smsText,
          confidence: Math.max(
            regexResult.confidence,
            typeof parsed.confidence === 'number' ? parsed.confidence : 0
          ),
        };
      } catch {
        // Gemini fallback failed — return regex result
      }
    }

    return regexResult;
  }

  // ─────────────────────────────────────────────────────────────
  // EFRIS TAX RECEIPT EXTRACTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Extract EFRIS tax receipt data from an image.
   */
  async extractEFRISData(file: File): Promise<EFRISReceiptData> {
    try {
      const text = await this.callGemini(file, EFRIS_PROMPT);
      const parsed = this.parseJSON(text);

      const fdn = parsed.fdn || null;
      const tin = parsed.tin || parsed.sellerTIN || null;

      return {
        fdn,
        tin,
        sellerName: parsed.sellerName || null,
        sellerTIN: parsed.sellerTIN || null,
        buyerName: parsed.buyerName || null,
        buyerTIN: parsed.buyerTIN || null,
        invoiceNumber: parsed.invoiceNumber || null,
        invoiceDate: parsed.invoiceDate || null,
        vatAmount: typeof parsed.vatAmount === 'number' ? parsed.vatAmount : null,
        totalExclVAT: typeof parsed.totalExclVAT === 'number' ? parsed.totalExclVAT : null,
        totalInclVAT: typeof parsed.totalInclVAT === 'number' ? parsed.totalInclVAT : null,
        currency: parsed.currency === 'USD' ? 'USD' : 'UGX',
        items: Array.isArray(parsed.items)
          ? parsed.items.map((item: any): EFRISExtractedItem => ({
              description: item.description || '',
              quantity: typeof item.quantity === 'number' ? item.quantity : null,
              unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
              totalPrice: typeof item.totalPrice === 'number' ? item.totalPrice : null,
              vatRate: typeof item.vatRate === 'number' ? item.vatRate : null,
            }))
          : [],
        verificationCode: parsed.verificationCode || null,
        isValid: (fdn ? isValidFDN(fdn) : false) || (tin ? isValidUgandaTIN(tin) : false),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch (err) {
      console.error('EFRIS extraction failed:', err);
      return this.emptyEFRISResult();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  private validatePaymentMethod(value: string | null): PaymentMethod | null {
    const valid: PaymentMethod[] = ['Cash', 'MobileMoney', 'BankTransfer', 'Cheque'];
    if (value && valid.includes(value as PaymentMethod)) {
      return value as PaymentMethod;
    }
    return null;
  }

  private validateProvider(value: string | null): MobileMoneyProvider {
    if (value === 'Airtel') return 'Airtel';
    return 'MTN'; // Default to MTN
  }

  private validateMoMoStatus(value: string | null): MobileMoneyTransaction['status'] {
    if (value === 'Failed') return 'Failed';
    if (value === 'Pending') return 'Pending';
    return 'Successful';
  }

  private parseDateString(dateStr: string): string | null {
    try {
      // Format: DD/MM/YYYY HH:mm:ss
      const [datePart, timePart] = dateStr.split(/\s+/);
      const [day, month, year] = datePart.split('/');
      return `${year}-${month}-${day}T${timePart || '00:00:00'}`;
    } catch {
      return null;
    }
  }

  private emptyMobileMoneyResult(): MobileMoneyTransaction {
    return {
      provider: 'MTN',
      transactionId: null,
      referenceCode: null,
      senderName: null,
      senderPhone: null,
      receiverName: null,
      receiverPhone: null,
      amount: null,
      fee: null,
      currency: 'UGX',
      timestamp: null,
      status: 'Pending',
      rawMessage: null,
      confidence: 0,
    };
  }

  private emptyEFRISResult(): EFRISReceiptData {
    return {
      fdn: null,
      tin: null,
      sellerName: null,
      sellerTIN: null,
      buyerName: null,
      buyerTIN: null,
      invoiceNumber: null,
      invoiceDate: null,
      vatAmount: null,
      totalExclVAT: null,
      totalInclVAT: null,
      currency: 'UGX',
      items: [],
      verificationCode: null,
      isValid: false,
      confidence: 0,
    };
  }
}
