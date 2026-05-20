/**
 * Material Pricing AI — Cloud Function
 *
 * Uses Gemini 2.0 Flash with Google Search grounding to find current market
 * prices for construction materials in Uganda, averages 5 data points, and
 * records the result in the material's rate history.
 *
 * Callable:  priceMaterialAI({ materialId, materialName, unit, category })
 * Scheduled: see materialPricingScheduled.js
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const MATERIALS_COLLECTION = 'advisoryPlatform/matflow/materials';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractJSON(text) {
  // Try fenced code block first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Fall back to first {...} block in the text
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text.trim();
}

/**
 * Evaluate simple arithmetic expressions inside a JSON string so that values
 * like 115000/25 or 4600*50 become valid numbers before JSON.parse().
 * Only handles integer and decimal operands with + - * / operators.
 */
function resolveArithmeticInJSON(jsonStr) {
  return jsonStr.replace(/(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)/g, (_, a, op, b) => {
    const x = parseFloat(a);
    const y = parseFloat(b);
    if (op === '+') return String(x + y);
    if (op === '-') return String(x - y);
    if (op === '*') return String(x * y);
    if (op === '/') return y !== 0 ? String(Math.round(x / y)) : '0';
    return _;
  });
}

// ─── Core pricing logic (shared by callable and scheduled) ───────────────────

/**
 * Fetch 5 market price data points for a material and return the average.
 * @param {string} materialName
 * @param {string} unit
 * @param {string} category
 * @param {string} apiKey
 * @returns {{ averagePrice: number, prices: number[], sources: string[], notes: string }}
 */
async function fetchMarketPrices(materialName, unit, category, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const year = new Date().getFullYear();

  let model;
  try {
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    });
  } catch (e) {
    // Fall back to without grounding — will use training data
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.warn('[materialPricingAI] Google Search grounding unavailable:', e.message);
  }

  const prompt = `You are a construction materials pricing analyst for Uganda.

Search the internet for CURRENT market prices (${year}) for the following construction material in Uganda:

Material: ${materialName}
Unit: ${unit}
Category: ${category}

Find at least 5 different price data points from different suppliers, regions, or market sources in Uganda (Kampala, Entebbe, Jinja, Mbarara, or national averages). Sources can include:
- Hardware store price lists
- Building materials supplier websites
- Uganda construction industry reports
- UNBS or Ministry of Works price indices
- Contractor quotations or tenders

IMPORTANT: Respond with ONLY a JSON object. Do not include any introductory text, explanation, or markdown outside the JSON block.

Return this exact JSON structure:
{
  "prices": [number, number, number, number, number],
  "currency": "UGX",
  "unit": "${unit}",
  "sources": ["source1", "source2", "source3", "source4", "source5"],
  "notes": "Brief note on price range and key factors affecting price",
  "dataQuality": "high"
}

STRICT RULES for the prices array:
- Every element MUST be a plain integer or decimal number — NO formulas, NO division, NO expressions (e.g. write 4600 not 115000/25)
- All prices must be in UGX (Uganda Shillings) per ${unit}
- If you find a price per different unit (e.g. per bag when unit is kg), CONVERT it first and write the converted number
- If you find prices in USD, multiply by 3750 and write the result as a number
- If fewer than 5 prices are found, repeat the closest estimate — do NOT leave the array shorter than 5
- dataQuality must be one of: "high", "medium", or "low"
- Prices should reflect retail/supply rates a contractor would pay, not wholesale or bulk`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonStr = extractJSON(text);

  let parsed;
  try {
    parsed = JSON.parse(resolveArithmeticInJSON(jsonStr));
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${text.substring(0, 200)}`);
  }

  const prices = (parsed.prices || []).filter(p => typeof p === 'number' && p > 0);
  if (prices.length === 0) {
    throw new Error('No valid prices returned from AI search');
  }

  const averagePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  return {
    averagePrice,
    prices,
    sources: parsed.sources || [],
    notes: parsed.notes || '',
    dataQuality: parsed.dataQuality || 'medium',
    currency: parsed.currency || 'UGX',
  };
}

// ─── Update Firestore ─────────────────────────────────────────────────────────

/**
 * Write the new market rate into the material's rateHistory and standardRate.
 */
async function savePriceToMaterial(materialId, averagePrice, currency, notes, prices, sources, updatedBy) {
  const matRef = db.doc(`${MATERIALS_COLLECTION}/${materialId}`);
  const snap = await matRef.get();
  if (!snap.exists) throw new Error(`Material ${materialId} not found`);

  const material = snap.data();
  const now = admin.firestore.Timestamp.now();

  // Close previous open rate entry
  const rateHistory = (material.rateHistory || []).map((r, i) => {
    if (i === 0 && !r.effectiveTo) {
      return { ...r, effectiveTo: now };
    }
    return r;
  });

  // Add new market-sourced rate
  rateHistory.unshift({
    rate: { amount: averagePrice, currency },
    effectiveFrom: now,
    source: 'market',
    notes: `AI market price: ${notes} | Prices sampled: [${prices.join(', ')}] ${currency} | Sources: ${sources.slice(0, 3).join('; ')}`,
  });

  await matRef.update({
    standardRate: { amount: averagePrice, currency },
    rateHistory,
    lastMarketPricedAt: now,
    lastMarketPriceData: { prices, sources, notes, dataQuality: 'auto' },
    'audit.updatedAt': now,
    'audit.updatedBy': updatedBy || 'system',
  });

  return averagePrice;
}

// ─── Callable Function ────────────────────────────────────────────────────────

exports.priceMaterialAI = onCall({
  secrets: [GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 120,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { materialId, materialName, unit, category } = request.data;

  if (!materialId || !materialName || !unit) {
    throw new HttpsError('invalid-argument', 'materialId, materialName, and unit are required');
  }

  const apiKey = GEMINI_API_KEY.value();
  const userId = request.auth.uid;

  console.log(`[priceMaterialAI] Pricing "${materialName}" (${unit}) for user ${userId}`);

  try {
    const { averagePrice, prices, sources, notes, dataQuality, currency } =
      await fetchMarketPrices(materialName, unit, category || 'other', apiKey);

    const savedRate = await savePriceToMaterial(
      materialId, averagePrice, currency, notes, prices, sources, userId
    );

    return {
      success: true,
      materialId,
      averagePrice: savedRate,
      currency,
      prices,
      sources,
      notes,
      dataQuality,
      priceCount: prices.length,
    };
  } catch (err) {
    console.error('[priceMaterialAI] Error:', err);
    throw new HttpsError('internal', err.message || 'Failed to fetch market prices');
  }
});

// ─── Export helpers for scheduled function ────────────────────────────────────

exports._fetchMarketPrices = fetchMarketPrices;
exports._savePriceToMaterial = savePriceToMaterial;
