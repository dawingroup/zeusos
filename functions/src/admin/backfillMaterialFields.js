/**
 * Backfill Material Fields Cloud Function
 *
 * Reads all materials from Firestore, identifies those missing the new
 * enrichment fields (subcategory, useCases, functionalUse, applicationAreas,
 * properties), and uses Gemini AI to infer and write the missing data.
 *
 * Supports dryRun mode (default true) for safe testing.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');
const { parseGeminiJSON } = require('../intelligence/intelligenceUtils');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Valid subcategories per category (must match client-side MATERIAL_SUBCATEGORIES)
const SUBCATEGORIES = {
  'sheet-goods': ['Plywood', 'MDF', 'Particle Board', 'Melamine', 'HPL/Laminate', 'Veneer', 'Acrylic Sheet'],
  'solid-wood': ['Hardwood', 'Softwood', 'Engineered Wood', 'Reclaimed Wood'],
  'hardware': ['Hinges', 'Drawer Slides', 'Handles/Knobs', 'Locks', 'Connectors/Brackets', 'Casters', 'Lighting'],
  'edge-banding': ['PVC', 'ABS', 'Veneer', 'Solid Wood', 'Melamine'],
  'finishing': ['Paints', 'Stains', 'Lacquers', 'Oils/Waxes', 'Sealers', 'Adhesives'],
  'glass': ['Clear Float', 'Tinted', 'Frosted', 'Tempered', 'Laminated', 'Low-E'],
  'metal': ['Steel', 'Aluminium', 'Brass', 'Stainless Steel', 'Copper'],
  'fabric-upholstery': ['Fabric', 'Leather', 'Faux Leather', 'Foam', 'Batting/Webbing'],
  'stone-composite': ['Natural Stone', 'Quartz', 'Solid Surface', 'Ceramic/Porcelain'],
  'other': ['General'],
};

const VALID_FUNCTIONAL_USES = ['structural', 'decorative', 'functional', 'protective', 'finishing'];

const VALID_APPLICATION_AREAS = [
  'Kitchen', 'Bedroom', 'Bathroom', 'Living Room', 'Office',
  'Dining Room', 'Outdoor', 'Commercial', 'Hospitality',
];

// ============================================
// Check if a material needs backfilling
// ============================================

function needsBackfill(data) {
  const missing = [];
  if (!data.subcategory) missing.push('subcategory');
  if (!data.useCases || !data.useCases.length) missing.push('useCases');
  if (!data.functionalUse) missing.push('functionalUse');
  if (!data.applicationAreas || !data.applicationAreas.length) missing.push('applicationAreas');
  if (!data.properties || !Object.values(data.properties).some((v) => v != null)) missing.push('properties');
  return missing;
}

// ============================================
// Build the backfill prompt
// ============================================

function buildBackfillPrompt(material) {
  const category = material.category || 'other';
  const subcats = SUBCATEGORIES[category] || ['General'];

  return `You are a materials specialist for a high-end interior design and furniture manufacturing company in East Africa.

Given the following material from our library, fill in the missing classification fields.

## Material Data
- **Name:** ${material.name || 'Unknown'}
- **Description:** ${material.description || 'None'}
- **Category:** ${category}
- **Quality Tier:** ${material.qualityTier || 'unknown'}
- **Grain Pattern:** ${material.grainPattern || 'none'}
- **Dimensions:** ${material.dimensions ? `${material.dimensions.length || '?'} × ${material.dimensions.width || '?'} × ${material.dimensions.thickness || '?'} mm` : 'Not specified'}
- **Pricing:** ${material.pricing ? `${material.pricing.unitCost} ${material.pricing.currency || 'USD'} per ${material.pricing.unit || 'ea'}` : 'Not specified'}
- **Source URL:** ${material.sourceUrl || 'N/A'}

## Instructions
Return ONLY a valid JSON object with these fields:

{
  "subcategory": "Pick the best match from: ${subcats.join(', ')}",
  "useCases": ["3-5 specific use cases for interior design & furniture, e.g. cabinet doors, drawer fronts, wall cladding"],
  "functionalUse": "one of: structural, decorative, functional, protective, finishing",
  "applicationAreas": ["Pick 2-4 from: ${VALID_APPLICATION_AREAS.join(', ')}"],
  "properties": {
    "weight": null,
    "density": null,
    "fireRating": null,
    "moistureResistance": "one of: Low, Medium, High, Waterproof, or null if unknown",
    "durabilityRating": "one of: Light Duty, Medium, Heavy Duty, or null if unknown",
    "colorCode": null,
    "finish": "e.g. Matt, Gloss, Satin, Textured, or null if unknown",
    "texture": "e.g. Smooth, Rough, Embossed, Wood Grain, or null if unknown"
  }
}

Set property values to null if genuinely unknown. Be specific and practical for a furniture manufacturing context.`;
}

// ============================================
// Validate and sanitize AI response
// ============================================

function sanitizeResponse(parsed, category) {
  const result = {};

  // Subcategory — must be valid for the category
  const validSubs = SUBCATEGORIES[category] || ['General'];
  if (parsed.subcategory && validSubs.includes(parsed.subcategory)) {
    result.subcategory = parsed.subcategory;
  } else if (parsed.subcategory) {
    // Try case-insensitive match
    const match = validSubs.find(
      (s) => s.toLowerCase() === parsed.subcategory.toLowerCase()
    );
    if (match) result.subcategory = match;
  }

  // Use cases — array of strings
  if (Array.isArray(parsed.useCases) && parsed.useCases.length > 0) {
    result.useCases = parsed.useCases
      .filter((uc) => typeof uc === 'string' && uc.trim())
      .slice(0, 10);
  }

  // Functional use — must be valid enum
  if (parsed.functionalUse && VALID_FUNCTIONAL_USES.includes(parsed.functionalUse)) {
    result.functionalUse = parsed.functionalUse;
  }

  // Application areas — must be from valid list
  if (Array.isArray(parsed.applicationAreas) && parsed.applicationAreas.length > 0) {
    result.applicationAreas = parsed.applicationAreas.filter((area) => {
      // Case-insensitive match
      return VALID_APPLICATION_AREAS.some(
        (va) => va.toLowerCase() === area.toLowerCase()
      );
    });
    // Normalize casing to match our constants
    result.applicationAreas = result.applicationAreas.map((area) => {
      return VALID_APPLICATION_AREAS.find(
        (va) => va.toLowerCase() === area.toLowerCase()
      ) || area;
    });
  }

  // Properties — object with optional fields
  if (parsed.properties && typeof parsed.properties === 'object') {
    const props = {};
    const allowedKeys = [
      'weight', 'density', 'fireRating', 'moistureResistance',
      'durabilityRating', 'colorCode', 'finish', 'texture',
    ];
    for (const key of allowedKeys) {
      if (parsed.properties[key] != null && parsed.properties[key] !== '') {
        props[key] = parsed.properties[key];
      }
    }
    if (Object.keys(props).length > 0) {
      result.properties = props;
    }
  }

  return result;
}

// ============================================
// Cloud Function
// ============================================

exports.backfillMaterialFields = onCall(
  {
    secrets: [GEMINI_API_KEY],
    cors: true,
    timeoutSeconds: 540,
    memory: '1GiB',
    maxInstances: 1,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { dryRun = true } = request.data || {};

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    });

    const stats = {
      total: 0,
      needsUpdate: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      details: [],
    };

    try {
      // Step 1: Read all materials
      logger.info('Step 1: Reading all materials from Firestore...');
      const snapshot = await db.collection('materials').get();
      stats.total = snapshot.size;
      logger.info(`Found ${stats.total} materials`);

      if (snapshot.empty) {
        return stats;
      }

      // Step 2: Filter to those needing backfill
      const materialsToUpdate = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const missingFields = needsBackfill(data);
        if (missingFields.length > 0) {
          materialsToUpdate.push({ id: doc.id, data, missingFields });
        } else {
          stats.skipped++;
        }
      }
      stats.needsUpdate = materialsToUpdate.length;
      logger.info(`${stats.needsUpdate} materials need backfilling, ${stats.skipped} already complete`);

      if (materialsToUpdate.length === 0) {
        return stats;
      }

      // Step 3: Process each material sequentially
      logger.info(`Step 2: Processing ${materialsToUpdate.length} materials with Gemini...`);

      for (let i = 0; i < materialsToUpdate.length; i++) {
        const { id, data, missingFields } = materialsToUpdate[i];
        const materialName = data.name || id;

        try {
          logger.info(`[${i + 1}/${materialsToUpdate.length}] Processing: ${materialName} (missing: ${missingFields.join(', ')})`);

          const prompt = buildBackfillPrompt(data);
          const result = await model.generateContent(prompt);
          const responseText = result.response.text();
          const parsed = parseGeminiJSON(responseText);

          if (!parsed) {
            stats.failed++;
            stats.errors.push({ id, name: materialName, error: 'Failed to parse AI response' });
            continue;
          }

          // Sanitize and validate
          const sanitized = sanitizeResponse(parsed, data.category || 'other');

          // Only include fields that are actually missing on the document
          const updateData = {};
          if (!data.subcategory && sanitized.subcategory) {
            updateData.subcategory = sanitized.subcategory;
          }
          if ((!data.useCases || !data.useCases.length) && sanitized.useCases) {
            updateData.useCases = sanitized.useCases;
          }
          if (!data.functionalUse && sanitized.functionalUse) {
            updateData.functionalUse = sanitized.functionalUse;
          }
          if ((!data.applicationAreas || !data.applicationAreas.length) && sanitized.applicationAreas) {
            updateData.applicationAreas = sanitized.applicationAreas;
          }
          if ((!data.properties || !Object.values(data.properties || {}).some((v) => v != null)) && sanitized.properties) {
            updateData.properties = sanitized.properties;
          }

          if (Object.keys(updateData).length === 0) {
            logger.info(`  → No valid fields returned by AI, skipping`);
            stats.skipped++;
            continue;
          }

          const detail = {
            id,
            name: materialName,
            fieldsUpdated: Object.keys(updateData),
            values: updateData,
          };

          if (dryRun) {
            logger.info(`  → [DRY RUN] Would update: ${JSON.stringify(Object.keys(updateData))}`);
            stats.details.push(detail);
            stats.updated++;
          } else {
            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.updatedBy = 'system:backfill';
            await db.collection('materials').doc(id).update(updateData);
            logger.info(`  → Updated: ${JSON.stringify(Object.keys(updateData))}`);
            stats.details.push(detail);
            stats.updated++;
          }

          // Small delay between Gemini calls to avoid rate limiting
          if (i < materialsToUpdate.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (err) {
          logger.error(`  → Error processing ${materialName}:`, err.message);
          stats.failed++;
          stats.errors.push({ id, name: materialName, error: err.message });
        }
      }

      logger.info('Backfill complete:', JSON.stringify({
        total: stats.total,
        needsUpdate: stats.needsUpdate,
        updated: stats.updated,
        skipped: stats.skipped,
        failed: stats.failed,
      }));

      return stats;
    } catch (err) {
      logger.error('Backfill failed:', err);
      throw new HttpsError('internal', `Backfill failed: ${err.message}`);
    }
  }
);
