/**
 * Enhance Inventory Item Cloud Function
 *
 * Takes a single inventory item and uses Claude AI to suggest improvements
 * to its name, description, categorisation, tags, and data quality.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');
const { checkRateLimit } = require('../utils/rateLimiter');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `You are an inventory data specialist for DawinOS, an ERP system used by a premium furniture manufacturing and interior design company based in East Africa. The company works with sheet goods (MDF, plywood, melamine), solid woods, hardware, edge banding, finishing materials, adhesives, and fasteners.

Your task: Analyse the given inventory item and suggest improvements to its metadata for better searchability, consistency, and data quality.

VALID CATEGORIES: sheet-goods | solid-wood | hardware | edge-banding | finishing | adhesives | fasteners | other
VALID CLASSIFICATIONS: material | product
VALID GRAIN PATTERNS: none | lengthwise | crosswise | random
VALID UNITS: sheet | sqft | sqm | lft | pcs | gal | ea | kg | ltr

NAMING RULES:
1. Names should be professional, descriptive, and follow the pattern: [Thickness] [Color/Finish] [Material Type] [Size] (e.g., "18mm White Melamine MDF 8x4")
2. Display names should be shorter, human-friendly versions (e.g., "White Melamine 18mm")
3. Descriptions should be 1-2 sentences covering key properties and typical manufacturing uses
4. Tags should include: material type, colour, finish, thickness, brand, common use-cases
5. Aliases should include common workshop names workers might use informally

BRAND EXTRACTION:
- If the item name starts with a brand name (e.g., "Plascon NC Furniture Lacquer"), suggest removing the brand from the name and populating the brand field separately
- The displayName should be a clean functional name without brand prefixes (e.g., "NC Furniture Lacquer")
- Names should describe what the item IS, not who makes it

STRUCTURED NAME:
- For all items, suggest structuredName fields:
  - function: the core functional purpose (e.g., "NC Furniture Lacquer", "Full Overlay Hinge", "Edge Band")
  - keySpecs: distinguishing specifications (e.g., "5L Gloss", "110° Soft-Close", "0.5mm PVC White")
  - qualityTier: "Premium", "Standard", or "Economy" if determinable from price/brand context
  - brandName: the manufacturer brand if known

ASSESSMENT RULES:
1. Only suggest changes where you see meaningful improvement — keep confidence low for uncertain suggestions
2. Confidence is a number 0-1 indicating certainty about a suggestion
3. Flag data quality issues: missing descriptions, wrong categories, missing dimensions for sheet goods, etc.
4. If the item appears well-maintained, say so — don't invent unnecessary changes

Return ONLY valid JSON — no markdown, no explanation outside the JSON.`;

// ============================================
// Build User Message
// ============================================

function buildUserMessage(item, inventoryContext) {
  let message = `## Inventory Item to Analyse

- **SKU:** ${item.sku || 'N/A'}
- **Name:** ${item.name || 'Unknown'}
- **Display Name:** ${item.displayName || 'Not set'}
- **Description:** ${item.description || 'Not set'}
- **Classification:** ${item.classification || 'Not set'}
- **Category:** ${item.category || 'other'}
- **Subcategory:** ${item.subcategory || 'Not set'}
- **Brand:** ${item.brand || 'Not set'}
- **Tags:** ${item.tags && item.tags.length ? item.tags.join(', ') : 'None'}
- **Aliases:** ${item.aliases && item.aliases.length ? item.aliases.join(', ') : 'None'}
- **Status:** ${item.status || 'active'}
- **Grain Pattern:** ${item.grainPattern || 'Not set'}`;

  if (item.structuredName) {
    message += `\n- **Structured Name:** function="${item.structuredName.function || 'N/A'}", keySpecs="${item.structuredName.keySpecs || 'N/A'}", qualityTier="${item.structuredName.qualityTier || 'N/A'}", brandName="${item.structuredName.brandName || 'N/A'}"`;
  } else {
    message += `\n- **Structured Name:** Not set`;
  }

  if (item.dimensions) {
    message += `\n- **Dimensions:** ${item.dimensions.thickness || '?'}mm thick × ${item.dimensions.length || '?'}mm × ${item.dimensions.width || '?'}mm`;
  } else {
    message += `\n- **Dimensions:** Not set`;
  }

  if (item.pricing) {
    message += `\n- **Pricing:** ${item.pricing.costPerUnit || 0} ${item.pricing.currency || 'UGX'} per ${item.pricing.unit || 'ea'}`;
  }

  if (item.inventory) {
    message += `\n- **Stock:** ${item.inventory.inStock ?? 'Unknown'} in stock, reorder level: ${item.inventory.reorderLevel ?? 'Not set'}`;
  }

  if (item.supplierPricing && item.supplierPricing.length) {
    message += `\n- **Suppliers:** ${item.supplierPricing.map(sp => `${sp.supplierName} (${sp.unitPrice} ${sp.currency || 'UGX'})`).join(', ')}`;
  } else {
    message += `\n- **Suppliers:** None configured`;
  }

  // Add context about existing items for dedup / consistency
  if (inventoryContext && inventoryContext.existingItems && inventoryContext.existingItems.length) {
    const itemList = inventoryContext.existingItems
      .slice(0, 40)
      .map(i => `  - ${i.name} (${i.sku}, ${i.category}${i.subcategory ? '/' + i.subcategory : ''})`)
      .join('\n');
    message += `\n\n## Other Items in Inventory (for naming consistency)\n${itemList}`;
  }

  message += `

## Required Response Format
{
  "suggestions": {
    "name": { "current": "", "suggested": "", "confidence": 0.0, "reason": "" },
    "displayName": { "current": "", "suggested": "", "confidence": 0.0, "reason": "" },
    "description": { "current": "", "suggested": "", "confidence": 0.0, "reason": "" },
    "category": { "current": "", "suggested": "", "confidence": 0.0, "reason": "" },
    "subcategory": { "current": "", "suggested": "", "confidence": 0.0, "reason": "" },
    "tags": { "current": [], "suggested": [], "confidence": 0.0, "reason": "" },
    "aliases": { "current": [], "suggested": [], "confidence": 0.0, "reason": "" },
    "classification": { "current": "", "suggested": "", "confidence": 0.0, "reason": "" },
    "brand": { "current": "", "suggested": "", "confidence": 0.0, "reason": "" },
    "structuredName": {
      "current": { "function": "", "keySpecs": "", "qualityTier": "", "brandName": "" },
      "suggested": { "function": "", "keySpecs": "", "qualityTier": "", "brandName": "" },
      "confidence": 0.0,
      "reason": ""
    }
  },
  "dataQualityIssues": [
    { "field": "", "severity": "critical|warning|info", "message": "", "suggestedFix": "" }
  ],
  "overallConfidence": 0.0,
  "aiNotes": ""
}`;

  return message;
}

// ============================================
// Cloud Function
// ============================================

exports.enhanceInventoryItem = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 10,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = request.auth.uid;
    const { item, inventoryContext } = request.data;

    if (!item || !item.name) {
      throw new HttpsError('invalid-argument', 'Item data with name is required');
    }

    // Rate limit
    const rateResult = await checkRateLimit(userId, 'ai', db);
    if (!rateResult.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. ${rateResult.remaining} requests remaining.`
      );
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'ANTHROPIC_API_KEY not configured');
    }

    try {
      const userMessage = buildUserMessage(item, inventoryContext);

      logger.info('Enhancing inventory item:', item.name, '(SKU:', item.sku, ')');

      const responseText = await createMessageWithRetry(apiKey, 'standard', SYSTEM_PROMPT, userMessage, 2);
      const parsed = parseJsonFromResponse(responseText);

      if (!parsed || !parsed.suggestions) {
        throw new Error('Failed to parse AI response — missing suggestions');
      }

      logger.info('Enhancement complete for:', item.name, '| confidence:', parsed.overallConfidence);

      return {
        success: true,
        suggestions: parsed.suggestions,
        dataQualityIssues: parsed.dataQualityIssues || [],
        overallConfidence: parsed.overallConfidence || 0.5,
        aiNotes: parsed.aiNotes || '',
      };
    } catch (err) {
      logger.error('Enhancement failed for item:', item.name, err);
      throw new HttpsError('internal', `Enhancement failed: ${err.message}`);
    }
  }
);
