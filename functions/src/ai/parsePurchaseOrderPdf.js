/**
 * Parse Purchase Order PDF — Cloud Function
 *
 * Accepts a raw PDF as base64 and uses Gemini 2.0 Flash to parse it directly
 * into structured PO header and line items with category suggestions.
 *
 * Gemini natively supports PDF as inline_data with mimeType 'application/pdf'.
 *
 * Input:  { pdfBase64: string }
 * Output: { header: ParsedPOHeader, lineItems: ParsedPOLineItem[], model, processingTimeMs }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getModel, parseJsonResponse, generateWithRetry } = require('../utils/geminiClient');
const { ALLOWED_ORIGINS } = require('../config/cors');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ============================================================================
// PROMPT (text-only instruction — PDF is sent as inline data alongside this)
// ============================================================================

const PARSE_PROMPT = `You are a procurement document parser for a manufacturing and interior finishing company based in Uganda.

You are looking at a supplier's PDF document (purchase order, invoice, proforma, or quotation). Extract all structured data from it.

Return a JSON object with this exact structure:

{
  "header": {
    "supplierName": "Company name from the document" or null,
    "supplierAddress": "Full address" or null,
    "supplierPhone": "Phone number" or null,
    "supplierEmail": "Email" or null,
    "invoiceNumber": "Invoice/PO/Proforma/Quote number" or null,
    "invoiceDate": "YYYY-MM-DD" or null,
    "currency": "GBP" (detect from document — look for symbols like £ $ € or text like USD, GBP, EUR, UGX, KES, AED),
    "subtotal": 0 or null,
    "tax": 0 or null,
    "grandTotal": 0 or null,
    "confidence": 0.0 to 1.0
  },
  "lineItems": [
    {
      "lineNumber": 1,
      "rawDescription": "exact text from PDF",
      "description": "cleaned/normalized description",
      "sku": "part number, item code, or SKU if present" or null,
      "quantity": 10,
      "unit": "pcs",
      "unitCost": 25.50,
      "totalCost": 255.00,
      "suggestedCategory": "inventory",
      "confidence": 0.0 to 1.0
    }
  ]
}

## Category Rules
Assign one of these categories to each line item:
- "inventory": Raw materials, components, consumables, hardware, fasteners, sheet goods, timber, board, finishing materials, adhesives, abrasives, dowels, connectors, edge banding, laminates
- "asset": Tools, machines, power tools, equipment, jigs, fixtures, cutters, routers (typically high-value individual items with a useful life > 1 year)
- "service": Labor, consulting, transport, freight, delivery charges, installation, calibration, training
- "overhead": Rent, utilities, subscriptions, insurance, licenses, software

## Parsing Rules
1. Detect currency from symbols (£ → GBP, $ → USD, € → EUR, UGX, KES, AED) or text mentions. Default to USD if ambiguous.
2. Parse quantities as numbers — handle "1,000" → 1000, handle decimal quantities
3. Parse costs removing currency symbols and commas
4. If unitCost is missing but totalCost and quantity exist, calculate unitCost = totalCost / quantity
5. If totalCost is missing but unitCost and quantity exist, calculate totalCost = unitCost * quantity
6. SKIP these rows from lineItems: subtotal rows, total rows, tax/VAT rows, shipping/delivery summary rows, blank rows, header/footer rows, page numbers
7. Normalize units: "pieces" → "pcs", "each" → "ea", "linear feet" → "lft", "square meters" → "sqm", "meters" → "m", "kilograms" → "kg", "packs" → "pack", "boxes" → "box", "sets" → "set", "pairs" → "pair", "rolls" → "roll", "sheets" → "sht", "lengths" → "len"
8. For descriptions, remove leading item/line numbers but preserve material specifications, dimensions, and brand names
9. Extract SKU/part numbers — these are typically alphanumeric codes like "DF 500", "492016", "KA 65", etc.
10. Set confidence lower (0.3-0.6) for lines where you had to infer or guess values
11. Set confidence higher (0.8-1.0) for lines with clear, unambiguous data

Return ONLY valid JSON, no markdown or explanation.`;

// ============================================================================
// CLOUD FUNCTION
// ============================================================================

const parsePurchaseOrderPdf = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 300, // allow up to 3 retries with 30s/60s/120s backoff on 429s
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY],
    // Allow larger payloads for PDF base64
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { pdfBase64 } = request.data;

    if (!pdfBase64) {
      throw new HttpsError('invalid-argument', 'pdfBase64 is required');
    }

    // Sanity check — base64 of a reasonable PDF should be at least a few KB
    if (pdfBase64.length < 100) {
      throw new HttpsError('invalid-argument', 'pdfBase64 appears too small to be a valid PDF');
    }

    const startTime = Date.now();
    const pdfSizeKB = Math.round((pdfBase64.length * 3) / 4 / 1024);
    console.log('PO PDF Parse: processing PDF (' + pdfSizeKB + ' KB)');

    try {
      const model = getModel(GEMINI_API_KEY.value(), 'structured', {
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.3,
        },
      });

      // Send PDF as inline data alongside the text prompt
      const parts = [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
        { text: PARSE_PROMPT },
      ];

      // Allow up to 3 retries — 429s get 30s/60s/120s backoff in geminiClient
      const responseText = await generateWithRetry(model, parts, 3);
      const parsed = parseJsonResponse(responseText);

      const processingTimeMs = Date.now() - startTime;
      console.log('PO PDF Parse: completed in ' + processingTimeMs + 'ms, ' + (parsed.lineItems || []).length + ' line items');

      return {
        header: {
          supplierName: parsed.header?.supplierName || null,
          supplierAddress: parsed.header?.supplierAddress || null,
          supplierPhone: parsed.header?.supplierPhone || null,
          supplierEmail: parsed.header?.supplierEmail || null,
          invoiceNumber: parsed.header?.invoiceNumber || null,
          invoiceDate: parsed.header?.invoiceDate || null,
          currency: parsed.header?.currency || 'USD',
          subtotal: parsed.header?.subtotal ?? null,
          tax: parsed.header?.tax ?? null,
          grandTotal: parsed.header?.grandTotal ?? null,
          confidence: Number(parsed.header?.confidence) || 0.5,
        },
        lineItems: (parsed.lineItems || []).map((li, idx) => ({
          lineNumber: li.lineNumber ?? idx + 1,
          rawDescription: li.rawDescription || li.description || '',
          description: li.description || '',
          sku: li.sku || null,
          quantity: Number(li.quantity) || 0,
          unit: li.unit || 'pcs',
          unitCost: Number(li.unitCost) || 0,
          totalCost: Number(li.totalCost) || 0,
          suggestedCategory: ['inventory', 'asset', 'service', 'overhead'].includes(li.suggestedCategory)
            ? li.suggestedCategory
            : 'inventory',
          confidence: Number(li.confidence) || 0.5,
        })),
        model: 'gemini-2.0-flash',
        processingTimeMs,
      };
    } catch (error) {
      console.error('PO PDF Parse error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to parse PO PDF: ' + error.message);
    }
  }
);

module.exports = { parsePurchaseOrderPdf };
