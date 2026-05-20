/**
 * aiDetectCabinets — Cloud Function (HTTPS Callable)
 *
 * Identifies distinct cabinet boundaries within a single multi-cabinet
 * model. Returns one DetectedCabinet per identified cabinet with mesh
 * names, suggested archetype, and reasoning.
 *
 * Uses Claude Sonnet via shared claudeClient.
 *
 * Timeout: 60s (long mesh lists take more reasoning)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are a furniture CAD analyst for Dawin Finishes (custom millwork shop in Uganda).

Your job: given a 3D model containing **multiple cabinets** (e.g. a kitchen run, a wardrobe wall, a hospital fitout), identify the distinct cabinet boundaries.

## Rules

1. A "cabinet" is a self-contained box-like unit a carpenter would build, install, and ship as one piece. Examples: kitchen base unit, wall unit, wardrobe carcass, drawer pedestal.

2. Group meshes into cabinets using:
   - **Spatial proximity** — meshes within the same bbox region are likely the same cabinet
   - **X-axis runs** — kitchen cabinets are usually aligned on a wall; gaps > 50mm typically mark cabinet boundaries
   - **Naming clues** — names like "KB1_*", "Cabinet_2_*", "Unit_A_*" indicate explicit grouping
   - **Archetype matching** — typical sizes (kitchen base ~600×560×720mm; wall unit ~600×340×720mm; wardrobe ~600×580×2100mm)

3. Each cabinet should match ONE of these archetypes:
   - **kitchen_base** — bottom run, ~720mm tall, ~560mm deep
   - **kitchen_wall** — upper run, ~720mm tall, ~340mm deep
   - **wardrobe** — tall, ~2100mm tall, ~580mm deep
   - **drawer_unit** — drawer-only base unit
   - **tall_pantry** — full-height kitchen unit
   - **custom** — anything else

4. **provisionalCode** — Generate sequentially: KB-A, KB-B, KB-C... Use prefix matching the archetype (KB=kitchen base, KW=kitchen wall, WR=wardrobe, DR=drawer, TP=tall pantry, CU=custom).

5. **suggestedName** — Human-readable: "Kitchen Base 600 — Sink Run", "Wardrobe — Right Bank", etc.

6. **confidence** per cabinet (0-1): 0.9+ when bbox + naming + archetype agree. <0.5 if uncertain.

7. **reasoning** (1-2 sentences): why these meshes form one cabinet.

8. Every mesh MUST be assigned to exactly one cabinet OR listed in "unassigned".

## Response Format
Return ONLY valid JSON, no prose:

\`\`\`json
{
  "model": "claude-sonnet-4-20250514",
  "confidence": 0.85,
  "reasoning": "Detected 5 kitchen base units along a 3.6m wall run. Each ~720mm wide, side panels at clean 720mm gaps.",
  "cabinets": [
    {
      "provisionalCode": "KB-A",
      "suggestedName": "Kitchen Base 600 — Sink Run",
      "suggestedArchetypeKey": "kitchen_base",
      "confidence": 0.92,
      "reasoning": "5 meshes clustered in 0-720mm X range, ~720mm tall, includes side panels and a door.",
      "meshNames": ["side_L_1", "side_R_1", "bottom_1", "back_1", "door_1"]
    }
  ],
  "unassigned": [
    { "meshName": "stray_mesh", "reason": "No spatial proximity to any cabinet group." }
  ]
}
\`\`\`
`;

const aiDetectCabinets = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '1GiB',
    secrets: [ANTHROPIC_API_KEY],
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { meshes, expectedCount, contextHint } = request.data || {};

    if (!Array.isArray(meshes) || meshes.length === 0) {
      throw new HttpsError('invalid-argument', 'meshes must be a non-empty array');
    }

    logger.info(`aiDetectCabinets: ${meshes.length} meshes, expectedCount=${expectedCount || 'auto'}`);

    // Build user message
    const meshLines = meshes.map((m, i) => {
      const w = (m.bbox.max[0] - m.bbox.min[0]).toFixed(0);
      const h = (m.bbox.max[1] - m.bbox.min[1]).toFixed(0);
      const d = (m.bbox.max[2] - m.bbox.min[2]).toFixed(0);
      return `${i + 1}. "${m.name}" — origin (${m.bbox.min.map(v => v.toFixed(0)).join(',')}) size ${w}×${h}×${d}mm material="${m.material || '?'}"`;
    }).join('\n');

    const userMessage = [
      contextHint ? `Context hint: ${contextHint}` : '',
      expectedCount ? `Expected cabinet count: ${expectedCount}` : '',
      `Total meshes: ${meshes.length}`,
      '',
      'Meshes:',
      meshLines,
      '',
      'Identify the distinct cabinets in this model and return JSON per the schema.',
    ].filter(Boolean).join('\n');

    let responseText;
    let parsed;
    const startedAt = Date.now();

    try {
      responseText = await createMessageWithRetry(
        ANTHROPIC_API_KEY.value(),
        'detailed',
        SYSTEM_PROMPT,
        userMessage,
        2,
      );
    } catch (err) {
      logger.error('aiDetectCabinets Claude call failed:', err);
      throw new HttpsError('internal', `AI detection failed: ${err.message}`);
    }

    try {
      parsed = parseJsonFromResponse(responseText);
    } catch (err) {
      logger.error('aiDetectCabinets JSON parse failed. Raw:', responseText);
      throw new HttpsError('internal', `AI returned invalid JSON: ${err.message}`);
    }

    const durationMs = Date.now() - startedAt;
    logger.info(`aiDetectCabinets complete in ${durationMs}ms, found ${(parsed.cabinets || []).length} cabinets`);

    return {
      source: 'ai',
      model: parsed.model || 'claude-sonnet-4-20250514',
      durationMs,
      ...parsed,
    };
  },
);

module.exports = { aiDetectCabinets };
