/**
 * Enhance Clip for Material Cloud Function
 *
 * Takes clip data and uses Gemini AI to classify, enhance, and assess
 * the material for addition to the Materials Library.
 * Replaces the client-side Gemini call that required VITE_GEMINI_API_KEY.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');
const { parseGeminiJSON } = require('../intelligence/intelligenceUtils');
const { checkRateLimit } = require('../utils/rateLimiter');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ============================================
// Enhancement Prompt
// ============================================

function buildEnhancementPrompt(clip, existingMaterialsSummary) {
  return `You are a materials specialist for a high-end interior design and furniture manufacturing company in East Africa.

Analyze the following product/material clipped from the web and return a structured JSON response to add it to our Materials Library.

## Clipped Item Data
- **Title:** ${clip.title || 'Unknown'}
- **Source URL:** ${clip.sourceUrl || 'N/A'}
- **Brand:** ${clip.brand || 'Unknown'}
- **SKU:** ${clip.sku || 'N/A'}
- **Price:** ${clip.price ? `${clip.price.amount} ${clip.price.currency || 'USD'}` : 'Not specified'}
- **Dimensions:** ${clip.dimensions ? `${clip.dimensions.width || '?'} × ${clip.dimensions.height || '?'} × ${clip.dimensions.depth || '?'} ${clip.dimensions.unit || 'mm'}` : 'Not specified'}
- **Materials:** ${clip.materials && clip.materials.length ? clip.materials.join(', ') : 'Not extracted'}
- **Colors:** ${clip.colors && clip.colors.length ? clip.colors.join(', ') : 'Not extracted'}
- **Description:** ${clip.description || 'None'}
- **Notes:** ${clip.notes || 'None'}
- **Tags:** ${clip.tags && clip.tags.length ? clip.tags.join(', ') : 'None'}
- **AI Analysis:** ${clip.aiAnalysis ? JSON.stringify(clip.aiAnalysis) : 'None'}

## Existing Materials Library (for competitive context)
${existingMaterialsSummary}

## Instructions
1. Determine the best material category: 'sheet-goods' | 'solid-wood' | 'hardware' | 'edge-banding' | 'finishing' | 'glass' | 'metal' | 'fabric-upholstery' | 'stone-composite' | 'other'
2. Pick the best subcategory from the list for the chosen category:
   - sheet-goods: Plywood, MDF, Particle Board, Melamine, HPL/Laminate, Veneer, Acrylic Sheet
   - solid-wood: Hardwood, Softwood, Engineered Wood, Reclaimed Wood
   - hardware: Hinges, Drawer Slides, Handles/Knobs, Locks, Connectors/Brackets, Casters, Lighting
   - edge-banding: PVC, ABS, Veneer, Solid Wood, Melamine
   - finishing: Paints, Stains, Lacquers, Oils/Waxes, Sealers, Adhesives
   - glass: Clear Float, Tinted, Frosted, Tempered, Laminated, Low-E
   - metal: Steel, Aluminium, Brass, Stainless Steel, Copper
   - fabric-upholstery: Fabric, Leather, Faux Leather, Foam, Batting/Webbing
   - stone-composite: Natural Stone, Quartz, Solid Surface, Ceramic/Porcelain
   - other: General
3. Classify quality tier: 'economy' | 'standard' | 'premium' | 'luxury'
4. Identify use cases, functional use, and application areas relevant to interior design & furniture
5. Estimate physical properties where possible
6. Fill in all material fields with best estimates
7. Assess competitive position relative to our existing materials
8. Score strategy alignment (0-100) based on our business context
9. Suggest alternatives if this material is expensive or hard to source

Return ONLY a valid JSON object with this structure:
{
  "name": "Clear descriptive name for our library",
  "description": "2-3 sentence description with key properties",
  "category": "one of the categories listed above",
  "subcategory": "one of the subcategories for the selected category",
  "qualityTier": "one of: economy, standard, premium, luxury",
  "dimensions": { "length": 0, "width": 0, "thickness": 0 },
  "pricing": { "unitCost": 0, "currency": "USD", "unit": "one of: sheet, sqft, sqm, lft, pcs, gal, ea" },
  "grainPattern": "one of: none, lengthwise, crosswise, random",
  "useCases": ["cabinet doors", "drawer fronts", "countertops"],
  "functionalUse": "one of: structural, decorative, functional, protective, finishing",
  "applicationAreas": ["kitchen", "bedroom", "bathroom"],
  "properties": { "weight": null, "density": null, "fireRating": null, "moistureResistance": null, "durabilityRating": null, "colorCode": null, "finish": null, "texture": null },
  "confidence": 0.85,
  "competitivePosition": "Summary of how this material compares to our existing collection",
  "strategyAlignment": 75,
  "suggestedAlternatives": ["Alternative 1", "Alternative 2"],
  "aiNotes": "Full reasoning about classification, pricing assessment, sourcing considerations"
}

Set dimensions to null if not applicable. Set property values to null if unknown. Be specific about units and currencies.`;
}

// ============================================
// Generate Material Code
// ============================================

function generateMaterialCode(name, category) {
  const prefixMap = {
    'sheet-goods': 'SG',
    'solid-wood': 'SW',
    'hardware': 'HW',
    'edge-banding': 'EB',
    'finishing': 'FN',
    'glass': 'GL',
    'metal': 'ML',
    'fabric-upholstery': 'FB',
    'stone-composite': 'SC',
    'other': 'OT',
  };
  const prefix = prefixMap[category] || 'OT';
  const slug = (name || 'material')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 4)
    .toUpperCase();
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${slug}-${rand}`;
}

// ============================================
// Cloud Function
// ============================================

exports.enhanceClipForMaterial = onCall(
  {
    secrets: [GEMINI_API_KEY],
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
    const { clip, existingMaterials } = request.data;

    if (!clip || !clip.title) {
      throw new HttpsError('invalid-argument', 'Clip data with title is required');
    }

    // Rate limit
    const rateResult = await checkRateLimit(userId, 'search', db);
    if (!rateResult.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. ${rateResult.remaining} requests remaining.`
      );
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Use Google Search grounding for better results
    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: [{ googleSearch: {} }],
      });
    } catch (e) {
      logger.warn('Google Search grounding not available, falling back:', e.message);
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    try {
      // Build existing materials summary
      const existingMaterialsSummary =
        existingMaterials && existingMaterials.length
          ? existingMaterials
              .slice(0, 30)
              .map(
                (m) =>
                  `- ${m.name} (${m.category}, ${m.qualityTier || 'unknown'} tier, ${m.unitCost || '?'} ${m.currency || ''})`
              )
              .join('\n')
          : 'No existing materials in library yet.';

      const prompt = buildEnhancementPrompt(clip, existingMaterialsSummary);

      logger.info('Enhancing clip for material:', clip.title);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed = parseGeminiJSON(responseText);

      if (!parsed) {
        throw new Error('Failed to parse AI response');
      }

      // Build the enhancement result
      const code = generateMaterialCode(
        parsed.name || clip.title,
        parsed.category || 'other'
      );

      const enhancement = {
        name: parsed.name || clip.title,
        code,
        description: parsed.description || clip.description || '',
        category: parsed.category || 'other',
        subcategory: parsed.subcategory || null,
        qualityTier: parsed.qualityTier || 'standard',
        grainPattern: parsed.grainPattern || 'none',
        useCases: parsed.useCases || [],
        functionalUse: parsed.functionalUse || null,
        applicationAreas: parsed.applicationAreas || [],
        properties: parsed.properties || null,
        confidence: parsed.confidence || 0.5,
        competitivePosition: parsed.competitivePosition || '',
        strategyAlignment: parsed.strategyAlignment || 50,
        suggestedAlternatives: parsed.suggestedAlternatives || [],
        aiNotes: parsed.aiNotes || '',
        sourceUrl: clip.sourceUrl || '',
        sourceImageUrl: clip.imageUrl || '',
        clipId: clip.id || '',
        brand: clip.brand || null,
        sku: clip.sku || null,
      };

      // Parse dimensions if provided
      if (parsed.dimensions && (parsed.dimensions.length || parsed.dimensions.width || parsed.dimensions.thickness)) {
        enhancement.dimensions = {
          length: parsed.dimensions.length || 0,
          width: parsed.dimensions.width || 0,
          thickness: parsed.dimensions.thickness || 0,
        };
      }

      // Parse pricing if provided
      if (parsed.pricing && parsed.pricing.unitCost) {
        enhancement.pricing = {
          unitCost: parsed.pricing.unitCost,
          currency: parsed.pricing.currency || clip.price?.currency || 'USD',
          unit: parsed.pricing.unit || 'ea',
        };
      } else if (clip.price && clip.price.amount) {
        enhancement.pricing = {
          unitCost: clip.price.amount,
          currency: clip.price.currency || 'USD',
          unit: 'ea',
        };
      }

      logger.info('Enhancement complete:', enhancement.name, '| category:', enhancement.category);

      return { success: true, enhancement };
    } catch (err) {
      logger.error('Enhancement failed:', err);
      throw new HttpsError('internal', `Enhancement failed: ${err.message}`);
    }
  }
);
