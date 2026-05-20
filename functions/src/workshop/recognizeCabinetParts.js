/**
 * recognizeCabinetParts — Cloud Function
 *
 * Uses Claude to identify, name, and classify cabinet parts from 3D model
 * geometry. Enables processing models without a CSV cutlist.
 *
 * Input: geometry summaries (bounding boxes, dims, neighbors, materials)
 * Output: part identifications with human-readable names, roles, assemblies
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');
const { ALLOWED_ORIGINS } = require('../config/cors');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are an expert cabinet-making analyst. You identify parts in 3D furniture models from their geometry (bounding boxes, dimensions, material, relative positions, and neighbor relationships).

Your task: Given a list of mesh objects with geometry data, identify each part with:
1. A human-readable engineering name (e.g., "Left Side Panel", "Top Shelf", "Door - Left")
2. Its structural role in the cabinet
3. Which assembly group it belongs to
4. Confidence in your identification

You MUST respond with valid JSON only. No markdown, no explanation.

NAMING CONVENTIONS:
- Use descriptive names: "Left Side Panel" not "Side I1"
- Include position when relevant: "Top Rail", "Bottom Shelf"
- For multiples, number them: "Shelf 1", "Shelf 2" (top to bottom)
- Doors: "Door - Left", "Door - Right" or "Door 1", "Door 2"
- Drawers: "Drawer Front 1" (top), "Drawer Front 2", etc.
- Drawer box parts: "Drawer 1 - Left Side", "Drawer 1 - Back"

ROLE CLASSIFICATION:
- side: Left/right panels (tallest vertical panels)
- top_bottom: Top and bottom horizontal panels spanning full width
- back: Thin panel at the rear
- shelf: Horizontal panel between sides (not top/bottom)
- mobile_shelf: Adjustable shelf (similar dims to fixed shelf but may be thinner)
- vertical_division: Vertical panel between compartments
- door: Front-facing panel with similar width/height to openings
- drawer: Drawer front panel
- drawer_component: Drawer box sides, back, bottom
- cover: Decorative cover panels
- plinth: Base/kick plate
- rail: Horizontal structural member (narrow)
- stile: Vertical structural member in a frame
- panel: Generic flat panel
- bar: Elongated narrow piece
- other: Unidentifiable

ASSEMBLY GROUPING:
- "Carcase": sides, top, bottom, back, vertical divisions
- "Fixed Shelves": non-adjustable shelves
- "Mobile Shelves": adjustable shelves
- "Drawer Box N": drawer box components (sides, back, bottom for drawer N)
- "Drawer Front N": drawer front panel for drawer N
- "Door N": door panel(s) for opening N
- "Cover": decorative panels, fillers
- "Hardware": hinges, slides (rarely in 3D models)`;

function buildUserPrompt(request) {
  const { geometrySummaries, overallDims, materialList, materialPalette, ragExamples, furnitureTypeContext } = request;

  const partsList = geometrySummaries
    .map(g => {
      let line = `  - "${g.partName}" (${Math.round(g.dims.w)}×${Math.round(g.dims.d)}×${Math.round(g.dims.h)}mm`;
      if (g.material) line += `, material: ${g.material}`;
      if (g.materialColor) line += `, color: ${g.materialColor}`;
      line += `, pos: ${g.relativePosition}`;
      if (g.neighbors.length > 0) line += `, near: [${g.neighbors.slice(0, 4).join(', ')}]`;
      line += `, bbox: X[${Math.round(g.bbox.min.x)},${Math.round(g.bbox.max.x)}] Y[${Math.round(g.bbox.min.y)},${Math.round(g.bbox.max.y)}] Z[${Math.round(g.bbox.min.z)},${Math.round(g.bbox.max.z)}]`;
      line += ')';
      return line;
    })
    .join('\n');

  let prompt = `Identify all parts in this cabinet model.

OVERALL DIMENSIONS: ${Math.round(overallDims.width)}W × ${Math.round(overallDims.depth)}D × ${Math.round(overallDims.height)}H mm
PART COUNT: ${geometrySummaries.length}
MATERIALS IN MODEL: ${materialList.join(', ') || 'unknown'}

PARTS (with geometry):
${partsList}`;

  if (materialPalette && materialPalette.length > 0) {
    prompt += '\n\nPROJECT MATERIAL PALETTE:';
    for (const m of materialPalette) {
      prompt += `\n  - ${m.name}${m.code ? ` (${m.code})` : ''}${m.thickness ? `, ${m.thickness}mm` : ''}`;
    }
    prompt += '\nMatch each part to the best material from this palette when possible.';
  }

  // Furniture type context — most impactful for naming accuracy
  if (furnitureTypeContext) {
    prompt += `\n\n=== FURNITURE TYPE: ${furnitureTypeContext.name} ===`;
    prompt += `\nCONSTRUCTION METHOD: ${furnitureTypeContext.constructionMethod}`;
    prompt += `\nNAMING: ${furnitureTypeContext.namingPatterns.convention}`;
    if (furnitureTypeContext.namingPatterns.includePosition) prompt += ', include position (Left/Right/Top/Bottom)';
    if (furnitureTypeContext.namingPatterns.includeNumber) prompt += ', number multiples (Shelf 1, Shelf 2)';

    prompt += '\n\nEXPECTED PARTS (use these names and roles as your template):';
    for (const p of furnitureTypeContext.expectedParts) {
      prompt += `\n  - ${typeof p.quantity === 'number' ? p.quantity + 'x' : 'varies'} ${p.nameTemplate} (role: ${p.role}`;
      if (p.typicalThickness) prompt += `, ~${p.typicalThickness}mm`;
      if (p.notes) prompt += `, ${p.notes}`;
      prompt += ')';
    }

    prompt += '\n\nASSEMBLY GROUPS (assign each part to one of these groups):';
    for (const g of furnitureTypeContext.assemblyGroups) {
      prompt += `\n  - ${g.name} (${g.category}): roles=[${g.roles.join(', ')}] → purchase: ${g.purchaseCategory}`;
      if (g.description) prompt += ` — ${g.description}`;
    }

    // Override naming prefixes
    const prefixes = furnitureTypeContext.namingPatterns.prefixes;
    if (prefixes && Object.keys(prefixes).length > 0) {
      prompt += '\n\nNAMING PREFIXES (use these exact names for each role):';
      for (const [role, prefix] of Object.entries(prefixes)) {
        if (prefix) prompt += `\n  - ${role} → "${prefix}"`;
      }
    }

    prompt += '\n\nIMPORTANT: Use the expected parts template above as your primary guide for naming. Match each mesh to the closest expected part based on dimensions and position.';
  }

  if (ragExamples && ragExamples.length > 0) {
    prompt += '\n\nEXAMPLES FROM PAST PROJECTS (use these as guidance):';
    for (const ex of ragExamples.slice(0, 10)) {
      prompt += `\n  - "${ex.originalName}" → "${ex.confirmedName}" (role: ${ex.role}, ${Math.round(ex.dims.w)}×${Math.round(ex.dims.d)}×${Math.round(ex.dims.h)}mm, material: ${ex.material})`;
    }
  }

  prompt += `

Return JSON with this exact structure:
{
  "parts": [
    {
      "originalName": "exact name from parts list",
      "suggestedName": "Human-Readable Name",
      "role": "side|top_bottom|back|shelf|door|drawer|drawer_component|...",
      "assemblyGroup": "Carcase|Fixed Shelves|Drawer Box 1|Door 1|...",
      "confidence": 0.0 to 1.0,
      "dims": { "length": mm, "width": mm, "thickness": mm },
      "inferredMaterial": "material name or null",
      "notes": "optional note"
    }
  ],
  "assemblies": [
    {
      "name": "Assembly Name",
      "category": "carcase|fixed_shelves|mobile_shelves|drawer_box|drawer_front|door|cover|hardware|other",
      "partNames": ["originalName1", "originalName2"]
    }
  ],
  "modelSummary": "Brief description of the cabinet (1-2 sentences)",
  "confidence": 0.0 to 1.0
}

IMPORTANT:
- Every part from the input MUST appear in the output
- dims.thickness = smallest dimension, dims.length = largest, dims.width = middle
- Use the bbox and neighbor data to determine left/right/top/bottom positioning
- Parts near each other (in neighbors list) likely belong to the same assembly`;

  return prompt;
}

exports.recognizeCabinetParts = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 90,
    memory: '256MiB',
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const data = request.data;
    if (!data || !data.geometrySummaries || !Array.isArray(data.geometrySummaries)) {
      throw new HttpsError('invalid-argument', 'geometrySummaries array is required');
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    const userPrompt = buildUserPrompt(data);

    try {
      const response = await createMessageWithRetry(apiKey, {
        preset: 'standard',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const result = parseJsonFromResponse(response);

      if (!result || !Array.isArray(result.parts)) {
        throw new HttpsError('internal', 'AI returned invalid structure');
      }

      return {
        ...result,
        source: 'ai',
      };
    } catch (err) {
      console.error('recognizeCabinetParts AI error:', err.message || err);

      // Return a minimal fallback — client should use rule-based engine
      return {
        parts: [],
        assemblies: [],
        modelSummary: 'AI analysis unavailable — use rule-based fallback',
        source: 'rule-based',
        confidence: 0,
        error: err.message || 'Unknown error',
      };
    }
  },
);
