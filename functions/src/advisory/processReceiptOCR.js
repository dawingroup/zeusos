/**
 * PROCESS RECEIPT OCR (Cloud Function)
 *
 * Server-side fallback OCR using Google Cloud Vision API.
 * Used when client-side Gemini extraction fails or returns low confidence.
 * Also supports batch processing of multiple receipt images.
 *
 * Trigger: onCall (authenticated users only)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { ALLOWED_ORIGINS } = require('../config/cors');

// ─────────────────────────────────────────────────────────────────
// REGEX PATTERNS FOR DATA EXTRACTION
// ─────────────────────────────────────────────────────────────────

const AMOUNT_PATTERNS = [
  /(?:total|amount|grand\s*total|net|balance)[:\s]*(?:ugx|ush|shs|=)?\.?\s*([\d,]+(?:\.\d{2})?)/i,
  /(?:ugx|ush|shs)\s*([\d,]+(?:\.\d{2})?)/i,
  /(?:usd|\$)\s*([\d,]+(?:\.\d{2})?)/i,
];

const DATE_PATTERNS = [
  /(\d{4}[-/]\d{2}[-/]\d{2})/,                  // YYYY-MM-DD
  /(\d{2}[-/]\d{2}[-/]\d{4})/,                  // DD-MM-YYYY or MM-DD-YYYY
  /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
];

const VENDOR_PATTERNS = [
  /(?:from|vendor|supplier|sold\s*by|shop|store)[:\s]+([^\n]+)/i,
  /^([A-Z][A-Z\s&.]+(?:LTD|LIMITED|CO|COMPANY|HARDWARE|STORE|SUPPLIES|ENTERPRISES))/im,
];

const FDN_PATTERN = /(\d{8}-\d{8}-\d{4})/;
const TIN_PATTERN = /(?:TIN|tin)[:\s]*(\d{10})/;

const MTN_PATTERNS = {
  transactionId: /(?:TxnId|Financial Transaction Id|Trans\.?\s*ID)[:\s]*([A-Z0-9]+)/i,
  amount: /(?:UGX|Ugx)\s*([\d,]+(?:\.\d{2})?)/,
  fee: /(?:Fee|Charge)[:\s]*(?:UGX|Ugx)?\s*([\d,]+(?:\.\d{2})?)/i,
  phone: /(256\d{9}|0[37]\d{8})/,
};

const AIRTEL_PATTERNS = {
  transactionId: /(?:Transaction ID|Ref|Reference)[:\s]*([A-Z0-9]+)/i,
  amount: /(?:UGX|Ugx)\s*([\d,]+(?:\.\d{2})?)/,
  fee: /(?:Fee|Charge)[:\s]*(?:UGX|Ugx)?\s*([\d,]+(?:\.\d{2})?)/i,
  phone: /(256\d{9}|0[37]\d{8})/,
};

// ─────────────────────────────────────────────────────────────────
// TEXT EXTRACTION FROM IMAGE USING CLOUD VISION
// ─────────────────────────────────────────────────────────────────

async function extractTextFromStorage(imageUrl) {
  const vision = require('@google-cloud/vision');
  const client = new vision.ImageAnnotatorClient();

  // Cloud Vision can read directly from GCS URIs
  if (imageUrl.startsWith('gs://')) {
    const [result] = await client.textDetection(imageUrl);
    return result.textAnnotations?.[0]?.description || '';
  }

  // For HTTPS URLs (signed URLs), download first
  const https = require('https');
  const imageBuffer = await new Promise((resolve, reject) => {
    https.get(imageUrl, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });

  const [result] = await client.textDetection({ image: { content: imageBuffer } });
  return result.textAnnotations?.[0]?.description || '';
}

// ─────────────────────────────────────────────────────────────────
// RECEIPT DATA EXTRACTION FROM TEXT
// ─────────────────────────────────────────────────────────────────

function extractReceiptData(text) {
  const result = {
    vendorName: null,
    totalAmount: null,
    currency: 'UGX',
    date: null,
    description: null,
    confidence: 0.5,
  };

  // Extract vendor
  for (const pattern of VENDOR_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.vendorName = match[1].trim();
      break;
    }
  }

  // Extract amount
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.totalAmount = parseFloat(match[1].replace(/,/g, ''));
      // Detect currency
      if (/usd|\$/i.test(match[0])) {
        result.currency = 'USD';
      }
      break;
    }
  }

  // Extract date
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.date = normalizeDate(match[1]);
      break;
    }
  }

  // Generate description from first meaningful lines
  const lines = text.split('\n').filter(l => l.trim().length > 3);
  if (lines.length > 0) {
    result.description = lines.slice(0, 3).join(', ').substring(0, 200);
  }

  // Calculate confidence
  let fieldsFound = 0;
  if (result.vendorName) fieldsFound++;
  if (result.totalAmount) fieldsFound++;
  if (result.date) fieldsFound++;
  result.confidence = Math.min(0.9, fieldsFound * 0.3);

  return result;
}

function extractMobileMoneyData(text) {
  const isMTN = /MTN|MoMo|Mobile Money/i.test(text);
  const patterns = isMTN ? MTN_PATTERNS : AIRTEL_PATTERNS;

  const txnMatch = text.match(patterns.transactionId);
  const amountMatch = text.match(patterns.amount);
  const feeMatch = text.match(patterns.fee);
  const phoneMatch = text.match(patterns.phone);

  return {
    provider: isMTN ? 'MTN' : 'Airtel',
    transactionId: txnMatch?.[1] || null,
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
    fee: feeMatch ? parseFloat(feeMatch[1].replace(/,/g, '')) : null,
    phone: phoneMatch?.[1] || null,
    status: /success|completed|confirmed/i.test(text) ? 'Successful'
      : /fail|rejected|declined/i.test(text) ? 'Failed' : 'Pending',
    confidence: txnMatch && amountMatch ? 0.8 : 0.4,
  };
}

function extractEFRISData(text) {
  const fdnMatch = text.match(FDN_PATTERN);
  const tinMatch = text.match(TIN_PATTERN);

  // Extract amounts
  const vatMatch = text.match(/(?:vat|tax)\s*(?:amount)?[:\s]*(?:ugx)?\s*([\d,]+)/i);
  const totalMatch = text.match(/(?:total|grand\s*total)[:\s]*(?:ugx)?\s*([\d,]+)/i);

  return {
    fdn: fdnMatch?.[1] || null,
    tin: tinMatch?.[1] || null,
    vatAmount: vatMatch ? parseFloat(vatMatch[1].replace(/,/g, '')) : null,
    totalInclVAT: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : null,
    isValid: !!(fdnMatch && /^\d{8}-\d{8}-\d{4}$/.test(fdnMatch[1])),
    confidence: (fdnMatch ? 0.4 : 0) + (tinMatch ? 0.3 : 0) + (vatMatch ? 0.2 : 0),
  };
}

function normalizeDate(dateStr) {
  try {
    // Handle DD/MM/YYYY format
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateStr)) {
      const parts = dateStr.split(/[-/]/);
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    // Handle text dates like "15 Jan 2026"
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// ─────────────────────────────────────────────────────────────────
// CLOUD FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Process a single receipt image via Cloud Vision OCR.
 */
const processReceiptOCR = onCall(
  {
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { imageStorageUrl, organizationId, mode = 'receipt' } = request.data;

    if (!imageStorageUrl || !organizationId) {
      throw new HttpsError(
        'invalid-argument',
        'imageStorageUrl and organizationId are required'
      );
    }

    try {
      // Extract text using Cloud Vision
      const rawText = await extractTextFromStorage(imageStorageUrl);

      if (!rawText || rawText.trim().length === 0) {
        return {
          success: false,
          error: 'No text detected in image',
          result: null,
        };
      }

      let result;

      switch (mode) {
        case 'mobileMoney':
          result = {
            type: 'mobileMoney',
            ...extractMobileMoneyData(rawText),
            rawText,
          };
          break;

        case 'efris':
          result = {
            type: 'efris',
            ...extractEFRISData(rawText),
            rawText,
          };
          break;

        default:
          result = {
            type: 'receipt',
            ...extractReceiptData(rawText),
            rawText,
          };

          // Auto-detect mobile money or EFRIS in receipt mode
          if (/MTN|Airtel|MoMo|Mobile Money/i.test(rawText)) {
            result.mobileMoneyData = extractMobileMoneyData(rawText);
          }
          if (FDN_PATTERN.test(rawText) || TIN_PATTERN.test(rawText)) {
            result.efrisData = extractEFRISData(rawText);
          }
          break;
      }

      // Store result in Firestore
      const db = getFirestore();
      const docRef = await db
        .collection(`organizations/${organizationId}/ocr_results`)
        .add({
          imageUrl: imageStorageUrl,
          mode,
          result,
          processedAt: Timestamp.now(),
          processedBy: request.auth.uid,
          source: 'cloud_vision',
        });

      return {
        success: true,
        resultId: docRef.id,
        result,
      };
    } catch (error) {
      console.error('processReceiptOCR error:', error);
      throw new HttpsError('internal', `OCR processing failed: ${error.message}`);
    }
  }
);

/**
 * Batch process multiple receipt images.
 */
const batchProcessReceipts = onCall(
  {
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { imageUrls, organizationId } = request.data;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new HttpsError('invalid-argument', 'imageUrls must be a non-empty array');
    }

    if (imageUrls.length > 10) {
      throw new HttpsError('invalid-argument', 'Maximum 10 images per batch');
    }

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    try {
      const results = await Promise.allSettled(
        imageUrls.map(async (url) => {
          const rawText = await extractTextFromStorage(url);
          if (!rawText || rawText.trim().length === 0) {
            return { imageUrl: url, success: false, error: 'No text detected' };
          }

          const receiptData = extractReceiptData(rawText);

          // Auto-detect
          let mobileMoneyData = null;
          let efrisData = null;

          if (/MTN|Airtel|MoMo|Mobile Money/i.test(rawText)) {
            mobileMoneyData = extractMobileMoneyData(rawText);
          }
          if (FDN_PATTERN.test(rawText) || TIN_PATTERN.test(rawText)) {
            efrisData = extractEFRISData(rawText);
          }

          return {
            imageUrl: url,
            success: true,
            result: { ...receiptData, mobileMoneyData, efrisData, rawText },
          };
        })
      );

      // Store batch results
      const db = getFirestore();
      const batchResults = results.map((r) =>
        r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }
      );

      await db
        .collection(`organizations/${organizationId}/ocr_results`)
        .add({
          type: 'batch',
          imageCount: imageUrls.length,
          results: batchResults,
          processedAt: Timestamp.now(),
          processedBy: request.auth.uid,
          source: 'cloud_vision',
        });

      return {
        success: true,
        totalProcessed: imageUrls.length,
        successCount: batchResults.filter((r) => r.success).length,
        results: batchResults,
      };
    } catch (error) {
      console.error('batchProcessReceipts error:', error);
      throw new HttpsError('internal', `Batch OCR processing failed: ${error.message}`);
    }
  }
);

module.exports = { processReceiptOCR, batchProcessReceipts };
