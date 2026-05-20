/**
 * Generate Formula Breakdown Cloud Function
 *
 * Uses Claude AI to analyze a BOQ work item description and generate a
 * materials breakdown formula with quantities, wastage, and specifications.
 * Uses East African construction standards and practices.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const VALID_CATEGORIES = [
  'concrete', 'masonry', 'steel', 'timber', 'roofing', 'finishes',
  'plumbing', 'electrical', 'doors_windows', 'earthworks', 'provisional', 'other',
];

const SYSTEM_PROMPT = `You are an experienced construction quantity surveyor specializing in East African building projects (Uganda, Kenya, Tanzania). Your task is to analyze a BOQ (Bill of Quantities) work item description and produce a detailed materials breakdown.

REQUIREMENTS:
1. Break down the work item into its constituent materials with quantities PER UNIT of output
2. Include realistic wastage percentages for East African construction conditions
3. Use locally available materials and standard specifications
4. Quantities should be per single unit of the output measure (per m3, per m2, per m, per nr, etc.)

OUTPUT FORMAT - Return a JSON object:
{
  "formulaName": "Short descriptive name for this formula",
  "category": "One of: ${VALID_CATEGORIES.join(', ')}",
  "components": [
    {
      "materialName": "Material name as commonly known in East Africa",
      "quantity": <number per unit of output>,
      "unit": "bags|kg|m|m2|m3|nr|litres|rolls|sheets|lengths|tonnes",
      "wastagePercent": <realistic wastage 2-15%>,
      "specification": "Material specification/grade",
      "reasoning": "Brief explanation of how quantity was derived"
    }
  ],
  "laborComponent": {
    "description": "Brief labor description",
    "skillLevel": "skilled|semi-skilled|unskilled",
    "hoursPerUnit": <estimated hours per unit of output>
  },
  "assumptions": ["List of assumptions made in the calculation"],
  "confidence": <0.0 to 1.0 - how confident you are in this breakdown>,
  "notes": "Any important notes about the formula"
}

RULES:
1. Material names should match common East African market names (e.g., "Cement OPC 42.5N" not just "cement")
2. Use 50kg bags for cement, not tonnes
3. Include binding wire, spacers, and formwork where applicable for concrete/reinforcement work
4. Include water where relevant (concrete mixing, curing, plastering)
5. Sand should be specified as "sharp sand" or "plastering sand" as appropriate
6. Aggregate should specify max size (e.g., "20mm crushed aggregate")
7. For masonry, include mortar components (cement, sand, water)
8. Wastage should reflect typical East African site conditions (slightly higher than UK/US standards)
9. Be precise with quantities - use standard mix ratios and coverage rates
10. If the description mentions a specific brand or standard, include it in the specification`;

const generateFormulaBreakdown = onCall(
  {
    timeoutSeconds: 120,
    memory: '256MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { description, specification, unit, quantity, existingMaterials } = request.data;

    if (!description || !unit) {
      throw new HttpsError('invalid-argument', 'description and unit are required');
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('internal', 'AI service not configured');
    }

    // Build user message
    let userMessage = `Analyze this BOQ work item and generate a materials breakdown:

DESCRIPTION: ${description}
OUTPUT UNIT: ${unit}`;

    if (specification) {
      userMessage += `\nGOVERNING SPECIFICATION: ${specification}`;
    }

    if (quantity) {
      userMessage += `\nCONTRACT QUANTITY: ${quantity} ${unit}
NOTE: Generate per-unit material quantities as instructed. The contract quantity of ${quantity} ${unit} is provided for context — the system will automatically multiply your per-unit quantities by ${quantity} to get totals.`;
    }

    if (existingMaterials && existingMaterials.length > 0) {
      userMessage += `\n\nAVAILABLE MATERIALS IN LIBRARY (use these names where they match):
${existingMaterials.slice(0, 50).join('\n')}`;
    }

    userMessage += '\n\nReturn ONLY the JSON object, no other text.';

    logger.info('generateFormulaBreakdown called', {
      description: description.substring(0, 100),
      unit,
      userId: request.auth.uid,
    });

    try {
      const responseText = await createMessageWithRetry(
        apiKey, 'standard', SYSTEM_PROMPT, userMessage
      );

      const parsed = parseJsonFromResponse(responseText);

      // Validate category
      if (parsed.category && !VALID_CATEGORIES.includes(parsed.category)) {
        parsed.category = 'other';
      }

      // Ensure components array exists
      if (!Array.isArray(parsed.components)) {
        throw new HttpsError('internal', 'AI returned invalid format — no components array');
      }

      // Validate and clean components
      parsed.components = parsed.components.map((c, i) => ({
        materialName: c.materialName || `Material ${i + 1}`,
        quantity: typeof c.quantity === 'number' ? c.quantity : 0,
        unit: c.unit || 'nr',
        wastagePercent: typeof c.wastagePercent === 'number' ? c.wastagePercent : 5,
        specification: c.specification || '',
        reasoning: c.reasoning || '',
      }));

      // If quantity provided, calculate totals for each component
      if (quantity) {
        parsed.totalQuantities = parsed.components.map(c => ({
          materialName: c.materialName,
          quantityPerUnit: c.quantity,
          totalQuantity: Math.ceil(c.quantity * quantity * (1 + c.wastagePercent / 100) * 100) / 100,
          unit: c.unit,
        }));
      }

      logger.info('generateFormulaBreakdown success', {
        componentsCount: parsed.components.length,
        category: parsed.category,
        confidence: parsed.confidence,
      });

      return parsed;
    } catch (error) {
      logger.error('generateFormulaBreakdown failed', { error: error.message });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `AI analysis failed: ${error.message}`);
    }
  }
);

module.exports = { generateFormulaBreakdown };
