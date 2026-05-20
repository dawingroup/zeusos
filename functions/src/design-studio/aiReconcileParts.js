/**
 * aiReconcileParts — Cloud Function (HTTPS Callable)
 *
 * AI-driven reconciliation between the 3D-derived ScenePart list and
 * the uploaded cutlist CSV. Where the client-side heuristic matcher
 * (exact name → token overlap → dimensions within 5mm) fails on
 * naming drift — "Side_L_01" ↔ "Left Side Panel" when token overlap
 * is thin and dims differ by 8mm from bbox-vs-cut variance — Claude
 * Sonnet has the context to pair them on semantic grounds (furniture
 * part role, symmetric-sibling patterns, cabinet partitioning).
 *
 * Returns index-based pairings so the client can assemble the final
 * PartEntry list using its existing converter + merge logic.
 *
 * Runtime: ~20-40s for a typical scene (300 parts + 200 CSV rows).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are a furniture cutlist reconciliator for Dawin Finishes, a custom millwork shop.

You are given TWO part lists for ONE scene:
  A. **ScenePart[]** — parts extracted from a 3D model (.3ds/.glb). Each has a mesh name, a cabinet code, an assembly type, bbox-derived dimensions (length × width × thickness in mm), and maybe a material name.
  B. **CsvRow[]** — rows from a PolyBoard / SketchUp / generic cutlist CSV. Each has a human-readable part name, cut dimensions, material, grain direction, edge banding, and a part type (sheet / bar).

Your job: pair them up. For every ScenePart, decide which CsvRow (if any) describes the same physical part. The pairing is CORRECT when:
  - The part plays the same role (side / bottom / back / shelf / door / drawer front / drawer box side / cover panel / toe kick / etc.)
  - Dimensions align within reasonable tolerance (bbox dims include hardware envelope, so CSV can be 2-15mm smaller on any axis)
  - When names are ambiguous, use symmetry + cabinet context to resolve (e.g. "Side_L_01" in cabinet KB-A pairs with "Left Side" not "Right Side")

## Rules

1. **Bijective pairing** — a CsvRow pairs with AT MOST one ScenePart. A ScenePart pairs with AT MOST one CsvRow. If two scene parts could plausibly match one CSV row, pick the best by dim proximity + name similarity.

2. **Scene-only is fine** — ScenePart without a CSV match sync with bbox dims. Don't force bad pairings to "catch them all". Precision > recall.

3. **CSV-only is flagged** — CsvRow without a ScenePart match remains in \`looseCsvRowIndices\`. The client imports those as loose parts. Don't try to hallucinate a fit.

4. **Symmetric sibling rule** — cabinets have L/R pairs (sides, doors, drawer fronts). If CSV has ONE "Side Panel" row with qty=2, pair it with ONE ScenePart and leave the sibling as scene-only. Client will handle quantity summation downstream.

5. **Drawer detection** — Dawin drawers are 6-part sets: 2 sides + bottom + back + front-box + drawer front (visible). CSV often lists the 5 drawer-box parts by role + 1 drawer front. Match by role name — "drw_side_L" ↔ "Drawer side", "drw_bottom" ↔ "Drawer bottom", etc.

6. **Dimension hierarchy** — when names disagree but dims match exactly (within 3mm), pair them. When names agree but dims diverge >20mm on any axis, question the pairing (might be two different parts with similar names).

7. **Confidence per pairing** — 0.9+ when names + dims + role all agree. 0.5-0.7 when bbox/name proximity is the only signal. <0.5 if uncertain — prefer leaving as scene-only.

8. **One-shot** — process every ScenePart and CsvRow in ONE pass. You have enough context. Don't ask for more.

## Response Format

Return ONLY valid JSON, no prose. **DO NOT include per-pair reasoning** — verbose reasoning on 300+ pairings blows the output token budget and truncates the response mid-array. Only the top-level \`reasoning\` field exists; per-pair entries are just id + index + confidence.

\`\`\`json
{
  "confidence": 0.85,
  "reasoning": "One-paragraph summary of what paired + what didn't + why, covering the whole scene. This is the ONLY reasoning text in the response.",
  "pairings": [
    { "scenePartId": "KB-A-carcass-1-side_L_01", "csvRowIndex": 14, "confidence": 0.92 }
  ],
  "looseCsvRowIndices": [42, 88, 131],
  "unpairableScenePartIds": ["KB-C-hardware_kit-1-hinge_01"]
}
\`\`\`

Keep the output strictly to the shape above. The top-level \`reasoning\` can be up to ~500 words; per-pair fields are ONLY the three keys shown.

\`unpairableScenePartIds\` is for scene parts you consciously decided not to pair (e.g. hardware meshes without cutlist equivalents) — not a guess, an explicit opt-out. Everything not in \`pairings\` AND not in \`unpairableScenePartIds\` is treated as "you forgot about it" and the client will log a warning.
`;

const aiReconcileParts = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '1GiB',
    secrets: [ANTHROPIC_API_KEY],
    // Callable from any browser origin; the handler still requires Firebase Auth.
    // (Origin allowlists are easy to misconfigure for OPTIONS; true avoids preflight 403 without ACAO.)
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to run AI part reconciliation');
    }

    const { sceneParts, csvRows, sceneName } = request.data || {};

    if (!Array.isArray(sceneParts) || sceneParts.length === 0) {
      throw new HttpsError('invalid-argument', 'sceneParts must be a non-empty array');
    }
    if (!Array.isArray(csvRows) || csvRows.length === 0) {
      throw new HttpsError('invalid-argument', 'csvRows must be a non-empty array');
    }

    logger.info(
      `aiReconcileParts: scene="${sceneName || 'unnamed'}", ${sceneParts.length} scene parts vs ${csvRows.length} CSV rows`,
    );

    // Build a compact user message. Each ScenePart on one line, each
    // CsvRow on one line — keeps token count under control.
    const sceneLines = sceneParts
      .map((p, i) =>
        `${i + 1}. id=${p.id} · cab=${p.cabinetCode || '?'} · asm=${p.assemblyType || '?'} · name="${p.partName}" · dims=${p.dimensions?.length || 0}×${p.dimensions?.width || 0}×${p.dimensions?.thickness || 0} · mat="${p.materialName || ''}"`,
      )
      .join('\n');

    const csvLines = csvRows
      .map(
        (r, i) =>
          `[${i}] name="${r.name}" · dims=${r.length}×${r.width}×${r.thickness} · qty=${r.quantity} · mat="${r.materialName || ''}" · grain=${r.grainDirection || 'none'} · type=${r.partType || 'sheet'}`,
      )
      .join('\n');

    const userMessage = [
      `Scene: ${sceneName || 'unnamed'}`,
      '',
      `Scene parts (${sceneParts.length}) — each has a stable id you echo back in pairings:`,
      sceneLines,
      '',
      `CSV rows (${csvRows.length}) — reference by [index]:`,
      csvLines,
      '',
      'Pair them per the rules. Return JSON.',
    ].join('\n');

    let responseText;
    let parsed;
    const startedAt = Date.now();

    try {
      // Use `detailed` preset for the 16K output token budget — a
      // scene with 300+ parts produces a pairings array large enough
      // to truncate at 8K (standard preset). Per-pair objects are
      // kept to 3 keys to stay under 16K as well.
      responseText = await createMessageWithRetry(
        ANTHROPIC_API_KEY.value(),
        'detailed',
        SYSTEM_PROMPT,
        userMessage,
        2,
      );
    } catch (err) {
      logger.error('aiReconcileParts Claude call failed:', err);
      throw new HttpsError('internal', `AI reconciliation failed: ${err.message}`);
    }

    try {
      parsed = parseJsonFromResponse(responseText);
    } catch (err) {
      logger.error('aiReconcileParts JSON parse failed. Raw:', responseText);
      throw new HttpsError('internal', `AI returned invalid JSON: ${err.message}`);
    }

    const durationMs = Date.now() - startedAt;
    logger.info(
      `aiReconcileParts complete in ${durationMs}ms, confidence=${parsed.confidence}, pairs=${(parsed.pairings || []).length}`,
    );

    return {
      model: 'claude-sonnet-4-20250514',
      durationMs,
      ...parsed,
    };
  },
);

module.exports = { aiReconcileParts };
