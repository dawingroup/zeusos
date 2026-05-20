/**
 * analyzeWorkshopModel — Cloud Function
 *
 * Uses Claude to intelligently analyse a 3D cabinet model's part structure
 * and determine critical dimensions, edge visibility priority, and annotations
 * for workshop production drawings.
 *
 * Called from the Workshop Viewer before PDF generation.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');
const { ALLOWED_ORIGINS } = require('../config/cors');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are a furniture workshop drawing analyst specialising in cabinet making.
You analyse 3D cabinet model data and determine:
1. Critical dimensions a cabinet maker needs for production
2. Which parts are most visually important in each view
3. Useful material/hardware annotations
4. When design context is provided: material matches against the project palette, discrepancies between the 3D model and declared parts, and CNC/assembly production notes

You respond ONLY with valid JSON matching the requested schema. No markdown, no explanation.`;

/**
 * Build the user prompt from the model summary
 */
function buildUserPrompt(summary, designContext) {
  const partsList = summary.parts
    .map(p => {
      let line = `  - ${p.name} (role: ${p.role}, ${Math.round(p.dims.w)}×${Math.round(p.dims.d)}×${Math.round(p.dims.h)}mm`;
      if (p.material) line += `, material: ${p.material}`;
      line += `, bbox X:[${Math.round(p.bbox.minX)},${Math.round(p.bbox.maxX)}] Y:[${Math.round(p.bbox.minY)},${Math.round(p.bbox.maxY)}] Z:[${Math.round(p.bbox.minZ)},${Math.round(p.bbox.maxZ)}]`;
      line += ')';
      return line;
    })
    .join('\n');

  let prompt = `Analyse this cabinet model for workshop production drawings.

CABINET OVERVIEW:
- Overall: ${Math.round(summary.overallDims.width)}W × ${Math.round(summary.overallDims.depth)}D × ${Math.round(summary.overallDims.height)}H mm
- Parts: ${summary.partCount}
- Has doors: ${summary.hasDoors}, Has drawers: ${summary.hasDrawers}
- Has shelves: ${summary.hasShelves}, Has vertical divisions: ${summary.hasVerticalDivisions}
- Materials: ${summary.materialList.join(', ') || 'unknown'}

PARTS (with bounding boxes in model coordinates):
${partsList}

Return JSON with this exact structure:
{
  "suggestedDimensions": [
    {
      "view": "front" | "right" | "top",
      "type": "horizontal_chain" | "vertical_chain" | "single_horizontal" | "single_vertical",
      "positions": [number, number, ...],
      "label": "string",
      "tier": 2 | 3,
      "reason": "string"
    }
  ],
  "partRanking": [
    {
      "partName": "exact part name from list above",
      "importance": "primary" | "secondary" | "background",
      "view": "front",
      "reason": "string"
    }
  ],
  "suggestedAnnotations": [
    {
      "text": "annotation text for drawing",
      "partName": "related part name",
      "type": "material" | "hardware" | "note"
    }
  ],
  "confidence": 0.0 to 1.0
}

RULES for suggestedDimensions:
- Use ACTUAL bbox coordinate values from the parts data as positions (not computed sizes)
- For horizontal_chain on front view: use X-axis bbox min/max values sorted ascending
- For vertical_chain on front view: use Z-axis bbox min/max values sorted ascending
- For horizontal_chain on right view: use Y-axis bbox min/max values sorted ascending
- For single_horizontal: exactly 2 positions [min, max] of a single opening
- For single_vertical: exactly 2 positions [min, max] of a single opening
- Focus on: door/drawer openings, shelf spacing, division positions, depth positions
- tier 2 = structural chains (divisions, shelves), tier 3 = detail openings

RULES for partRanking:
- primary = structural parts the cabinet maker needs to see clearly (sides, top, bottom, back, vertical divisions)
- secondary = functional parts (doors, drawers, shelves)
- background = sub-components (drawer sides, backs, edge banding, bars)

RULES for suggestedAnnotations:
- Include material names for key structural parts
- Note edge banding requirements if relevant
- Keep annotations concise (max 30 chars)`;

  // Append design context section if available (enhances analysis with project data)
  if (designContext) {
    let designSection = '\n\nDESIGN ITEM CONTEXT (from DawinOS Design Manager):';

    if (designContext.existingParts && designContext.existingParts.length > 0) {
      designSection += '\n\nDECLARED PARTS LIST:';
      for (const p of designContext.existingParts) {
        designSection += `\n  - ${p.name}: ${p.materialName}, ${p.length}×${p.width}×${p.thickness}mm, qty ${p.quantity}`;
      }
    }

    if (designContext.materialPalette && designContext.materialPalette.length > 0) {
      designSection += '\n\nPROJECT MATERIAL PALETTE:';
      for (const m of designContext.materialPalette) {
        designSection += `\n  - ${m.name}${m.code ? ` (${m.code})` : ''}${m.thickness ? `, ${m.thickness}mm` : ''}`;
      }
    }

    if (designContext.projectStage) {
      designSection += `\n\nPROJECT STAGE: ${designContext.projectStage}`;
    }

    designSection += `\n
ADDITIONAL ANALYSIS REQUIRED (include these in your JSON response):
- "materialMatches": For each model material, suggest the best match from the material palette
  [{ "modelMaterial": "...", "suggestedPaletteMaterial": "...", "paletteCode": "...", "confidence": 0.0-1.0 }]
- "partDiscrepancies": Compare 3D model parts against declared parts. Flag:
  - Parts in model but NOT in parts list ("missing_in_parts")
  - Parts in parts list but NOT in model ("missing_in_model")
  - Parts where dimensions differ significantly ("dimension_mismatch")
  [{ "type": "missing_in_model"|"missing_in_parts"|"dimension_mismatch", "partName": "...", "details": "..." }]
- "productionNotes": For structural parts, suggest CNC notes and assembly sequence
  [{ "partName": "...", "cncNotes": "...", "assemblySequence": number, "note": "..." }]`;

    prompt += designSection;
  }

  return prompt;
}

exports.analyzeWorkshopModel = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { modelSummary, designContext } = request.data;
    if (!modelSummary || !modelSummary.parts) {
      throw new HttpsError('invalid-argument', 'modelSummary with parts array is required');
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('internal', 'Anthropic API key not configured');
    }

    try {
      const userPrompt = buildUserPrompt(modelSummary, designContext);

      const responseText = await createMessageWithRetry(
        apiKey,
        'fast',
        SYSTEM_PROMPT,
        userPrompt,
      );

      const parsed = parseJsonFromResponse(responseText);

      return {
        success: true,
        analysis: {
          suggestedDimensions: parsed.suggestedDimensions || [],
          partRanking: parsed.partRanking || [],
          suggestedAnnotations: parsed.suggestedAnnotations || [],
          materialMatches: parsed.materialMatches || [],
          partDiscrepancies: parsed.partDiscrepancies || [],
          productionNotes: parsed.productionNotes || [],
          confidence: parsed.confidence || 0.7,
        },
      };
    } catch (error) {
      console.error('Claude workshop analysis failed:', error);
      throw new HttpsError('internal', `AI analysis failed: ${error.message}`);
    }
  }
);
