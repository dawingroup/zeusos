/**
 * aiGroupModel — Cloud Function (HTTPS Callable)
 *
 * AI-powered model grouping: analyzes mesh names, bounding boxes, materials,
 * and archetype context; returns structured assembly groupings with reasoning
 * and confidence per group.
 *
 * Uses Claude Sonnet via the shared claudeClient utility.
 *
 * Timeout: 45s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are a furniture CAD analyst for Dawin Finishes, a custom millwork shop in Uganda.

Your job: given a 3D model's mesh list (names, bounding boxes, materials), group meshes into canonical **assemblies** that a carpenter would recognize.

DawinOS furniture goes WAY beyond kitchen cabinets. Treat the model as belonging to one of these DOMAINS and let the archetype context (provided in the user message) narrow it further:

- **kitchen** — kitchen base / wall cabinets. Carcass + doors + drawers + plinth.
- **wardrobe** — tall wardrobes with hanging rails, shelves, drawers.
- **workspace** — desks, workstations, clustered bench furniture. Work surface + modesty panel + cable tray + drawer pedestal + COVER PANELS concealing cable routing.
- **reception** — reception / transaction counters. Two-zone (staff carcass + client fascia). Fascia is a distinct cover_panel_run, not part of the carcass.
- **retail** — gondolas, slatwall displays. Vertical UPRIGHTS / gables + display shelves + pegboard backing + end-cap COVER PANELS.
- **pharmacy** — dispensary shelving + back-bar storage. Dense adjustable shelves + SECURITY GRILLES + gable cover panels.
- **library / storage / display** — bookcases, storage walls, glass display cases.

## Canonical Assembly Types
Kitchen / wardrobe core:
- **carcass** — box structure (sides, bottom, top rail, back panel)
- **door_assembly** — hinged door(s), rails, stiles, panels
- **drawer_box** — drawer body (sides, bottom, back, front-box)
- **drawer_front** — visible drawer face
- **shelf_pack** — shelves (fixed or adjustable)
- **hardware_kit** — hinges, slides, handles, connectors, legs
- **plinth_assembly** — kickboard / toe-kick
- **cornice_run** — top trim / pelmet / valance / light rail / fascia
- **panel_run** — decorative end panels / fillers
- **custom** — anything that doesn't fit the above

Workspace / reception:
- **work_surface** — desk top, reception transaction counter top
- **counter_front** — tall front-facing panel on a reception counter (client side)
- **modesty_panel** — privacy panel between user and front edge of a desk
- **cable_tray** — cable-routing tray / cable cover channel

Retail / pharmacy / display:
- **gable_run** — vertical uprights / gables on gondolas + shelving
- **display_shelf_pack** — adjustable display shelves (retail + pharmacy)
- **display_back** — slatwall / pegboard backing
- **cover_panel_run** — structural-join / cable-cover / end-cap concealers. CRITICAL: meshes named "cover", "cable_cover", "rear_cover", "gable_cover", "end_cap", "infill", "filler", "fascia" (when structural), "modesty", "shroud", "apron", "client_side" are cover panels. DO NOT group them into carcass.
- **security_grille** — roller shutters / security grilles (pharmacies, after-hours retail)
- **bookcase_frame** — open bookcase/library shelving frame

## Part Categories
Every part gets one: **panel, cover_panel, toe_kick, fascia, upright, stretcher, edge_band, hardware, fastener, fitting, finish_consumable, packaging**.

- **cover_panel** — any panel whose primary role is CONCEALING structure, cable routing, service voids. Reception fascias, desk cable covers, gondola end caps.
- **toe_kick** — floor-level visible kicker (distinct from structural plinth parts because toe-kicks are almost always veneer / visible-grade finish).
- **fascia** — upper decorative banding. Valances, light rails, reception brow panels, cornice covers.
- **upright** — vertical structural posts in retail / pharmacy / library. Linear, not sheet.
- **stretcher** — horizontal rails linking uprights.

## Rules
1. Every mesh MUST be assigned to exactly one assembly OR listed in "unmapped" with a reason. **Unmapped is a last resort** — if you're unsure but the mesh has a plausible home (carcass, hardware_kit, custom), assign it there rather than dropping to unmapped, because unmapped meshes don't flow into the procurement cutlist and prices go wrong.
2. Use bbox proximity + naming conventions + material clues TOGETHER. A mesh named "side_L" at the carcass bbox extreme is a carcass panel. A small cylindrical mesh near a door edge is a hinge (hardware_kit).
3. **Archetype locks** — if an archetype is given, match its expectedAssemblies list preferentially. DO invent archetype-appropriate assemblies (e.g., add cover_panel_run even when not listed if meshes obviously need it); DO NOT wander into unrelated domains.
4. **Cover panels FIRST** — before classifying anything as carcass, scan for cover-panel tokens in mesh names ("cover", "cable_cover", "rear_cover", "end_cap", "infill", "filler", "fascia", "modesty", "shroud", "apron", "gable_cover", "client_side"). Prefer cover_panel_run over carcass when names are ambiguous but domain-appropriate. Refer to coverPanelHints in the user message for archetype-specific extras.

5. **Doors vs drawer_fronts vs carcass panels** — the three most-confused classes. Tie-break hierarchy:

   **Door tokens (→ door_assembly):** "door", "dr_", "dr-", "door_L", "door_R", "door_panel", "face", "front_panel" (when thin + rectangular + matching an opening). Doors are:
   - Thin (typically 16–25 mm thickness, smallest dim)
   - Bbox roughly matches a carcass opening (width × height of the opening)
   - Rectangular, near-zero offset from the front face of the carcass
   - Often in pairs (left / right suffix); double-doors share height
   - Use door_assembly for ONE door; multiple doors on the same cabinet can be one door_assembly with meshNodeIds listed together OR split into door_assembly-left + door_assembly-right.

   **Drawer front tokens (→ drawer_front):** "drawer_front", "drw_front", "dwr_front", "df_", "front_N" where N is a number and the height is typical drawer-face height (~130–300 mm). Drawer fronts are:
   - Thin (16–25 mm) sheet, visible-face finish
   - Width = carcass width; height = drawer slot height
   - Stack vertically (4-drawer bank → 4 fronts with increasing y coordinates)

   **Drawer box tokens (→ drawer_box):** "drawer_box", "drw_box", "drw_side", "drw_bottom", "drw_back", "drawer_side_L/R", "bottom_drawer", "front_box", "drw_front_inner". Drawer boxes in Dawin's shop are built as a **6-part set**:
     1. drawer side (left)
     2. drawer side (right)
     3. drawer bottom (thin sheet, ~6–12 mm, spanning both sides' inner faces)
     4. drawer back (thin vertical panel spanning the two sides at the rear)
     5. drawer front-box / inner-front (thin vertical panel at the front of the BOX, BEHIND the visible drawer front — often same thickness as sides)
     6. drawer front (the separately-classified drawer_front assembly — step A above)
   So for a bank of N drawers expect N × 5 drawer-box parts + N drawer_front parts. If you see a carcass with 15 thin panels clustered toward the front that aren't named as door/cover, it's almost certainly a 3-drawer bank (15 = 3 × 5). Bucket them as **one drawer_box assembly per drawer** — five meshes each — not one monster drawer_box.
   - Sides are thin (12–18 mm) tall rectangles; bottom is thin (6–12 mm) wide panel; back + front-box are thin vertical rectangles spanning the two sides
   - Sit INSIDE the carcass footprint, not at its front face
   - A mesh named "drw_side_L" is a drawer-box side, NOT a carcass side — bbox depth is less than the carcass depth.

   **Matched pair detection:** if you see a drawer_front and a drawer_box with the same y-position and width, they're the same drawer — group them as two separate assemblies (drawer_front + drawer_box). A 3-drawer bank → 3 drawer_front assemblies + 3 drawer_box assemblies = 6 assemblies total, NOT one combined group.

   **When in doubt**: if a thin rectangular sheet sits at the front face of the carcass envelope and is NOT named as cover/fascia/plinth → it's a door or drawer front. Use height to disambiguate: ≥300 mm is almost always a door; 100–300 mm is a drawer front; a stack of 3–4 same-width panels in the same bay is a drawer bank.

6. **Hardware inference** — small cylindrical / pin-shaped / non-rectangular meshes near door edges are hinges; along drawer sides are slides; on door/drawer faces are handles. All go to hardware_kit. NEVER drop them to unmapped just because they're "small".

7. **Part category per mesh** — use the most specific PartCategory the mesh supports. "toe_kick" / "kickboard" → toe_kick, not panel. "fascia" / "valance" → fascia, not panel. "upright" / "gondola_post" → upright, not panel.

8. **Confidence** (0-1) per group: 0.9+ when naming + bbox + archetype agree. 0.5-0.7 when only bbox/proximity is clear. <0.5 if uncertain.

9. **Reasoning** (1-3 sentences) explains WHY you grouped this way: patterns you saw, ambiguities, archetype + domain match.

## Response Format
Return ONLY valid JSON, no prose:

\`\`\`json
{
  "confidence": 0.87,
  "reasoning": "All 8 meshes matched expected kitchen_base archetype. Side panels positioned at carcass extremes, two hinge cylinders near door edge.",
  "assemblies": [
    {
      "assemblyType": "carcass",
      "assemblyCode": "carcass-1",
      "displayName": "Main Carcass",
      "confidence": 0.95,
      "meshNodeIds": ["side_L", "side_R", "bottom", "back_panel", "top_rail"],
      "reasoning": "5 panels form the structural box, named and positioned consistently."
    }
  ],
  "unmapped": [
    { "meshName": "weird_nub_01", "reason": "Small floating mesh with no clear role." }
  ]
}
\`\`\`
`;

const aiGroupModel = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 45,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const {
      geometrySummaries,
      archetypeKey,
      // v2.5 — optional multi-archetype list (cross-domain fixtures).
      archetypeKeys,
      archetypeContext,
      modelName,
      // v2 fields — domain-aware context from
      // aiAssemblyGrouper.service.ts. All optional; older clients
      // continue to work.
      domain,
      domains,
      domainPrompt,
      archetypeLabel,
      archetypeLabels,
      archetypeDescription,
      expectedAssemblies,
      expectedPartCategories,
      coverPanelHints,
      typicalDimensions,
    } = request.data || {};

    if (!Array.isArray(geometrySummaries) || geometrySummaries.length === 0) {
      throw new HttpsError('invalid-argument', 'geometrySummaries must be a non-empty array');
    }

    const keysForLog = Array.isArray(archetypeKeys) && archetypeKeys.length
      ? archetypeKeys.join('+')
      : (archetypeKey || 'none');
    logger.info(`aiGroupModel: ${geometrySummaries.length} meshes, archetypes=${keysForLog}, domain=${domain || 'none'}`);

    // Build user message
    const meshLines = geometrySummaries.map((m, i) =>
      `${i + 1}. "${m.name}" — bbox ${JSON.stringify(m.bbox)} material="${m.material || 'none'}"`,
    ).join('\n');

    // Assemble the context block. Every line is optional — cheap to
    // include when present, skipped cleanly when missing.
    const effectiveKeys = Array.isArray(archetypeKeys) && archetypeKeys.length
      ? archetypeKeys
      : (archetypeKey ? [archetypeKey] : []);
    const effectiveDomains = Array.isArray(domains) && domains.length
      ? domains
      : (domain ? [domain] : []);

    const contextBlock = [];
    contextBlock.push(`Model: ${modelName || 'unnamed'}`);

    if (effectiveDomains.length > 1) {
      contextBlock.push(
        `Domains: ${effectiveDomains.join(' + ')} — this cabinet spans multiple furniture domains. ` +
        `Treat the assembly + part hints below as a UNION of expectations; a single fixture may legitimately ` +
        `carry assemblies from every listed domain (e.g. a workstation with integrated retail display).`,
      );
    } else if (effectiveDomains.length === 1) {
      contextBlock.push(`Domain: ${effectiveDomains[0]}`);
    }
    if (domainPrompt) contextBlock.push(`Domain context: ${domainPrompt}`);

    if (effectiveKeys.length > 0) {
      const labelList = Array.isArray(archetypeLabels) && archetypeLabels.length
        ? archetypeLabels
        : (archetypeLabel ? [archetypeLabel] : []);
      if (effectiveKeys.length > 1) {
        contextBlock.push(
          `Archetypes (${effectiveKeys.length}): ${effectiveKeys.join(', ')}` +
          (labelList.length ? ` — ${labelList.join(' + ')}` : ''),
        );
      } else {
        contextBlock.push(
          `Archetype: ${effectiveKeys[0]}${labelList[0] ? ` (${labelList[0]})` : ''}`,
        );
      }
      if (archetypeDescription) contextBlock.push(`Archetype context: ${archetypeDescription}`);
      const expected = expectedAssemblies || archetypeContext;
      if (expected && expected.length) {
        contextBlock.push(`Expected assemblies: ${JSON.stringify(expected)}`);
      }
      if (expectedPartCategories && expectedPartCategories.length) {
        contextBlock.push(`Expected part categories: ${JSON.stringify(expectedPartCategories)}`);
      }
      if (coverPanelHints && coverPanelHints.length) {
        contextBlock.push(
          `Cover-panel name hints for this archetype (check these FIRST before classifying as carcass): ${JSON.stringify(coverPanelHints)}`,
        );
      }
      if (typicalDimensions) {
        contextBlock.push(`Typical envelope (mm): ${JSON.stringify(typicalDimensions)}`);
      }
    } else {
      contextBlock.push('Archetype: unknown (infer from data)');
    }

    const userMessage = [
      contextBlock.join('\n'),
      '',
      `Meshes (${geometrySummaries.length}):`,
      meshLines,
      '',
      'Group these meshes into assemblies and return JSON per the schema. Apply the cover-panel rule (rule 4) before carcass classification.',
    ].join('\n');

    let responseText;
    let parsed;
    const startedAt = Date.now();

    try {
      responseText = await createMessageWithRetry(
        ANTHROPIC_API_KEY.value(),
        'standard',
        SYSTEM_PROMPT,
        userMessage,
        2, // retries
      );
    } catch (err) {
      logger.error('aiGroupModel Claude call failed:', err);
      throw new HttpsError('internal', `AI grouping failed: ${err.message}`);
    }

    try {
      parsed = parseJsonFromResponse(responseText);
    } catch (err) {
      logger.error('aiGroupModel JSON parse failed. Raw:', responseText);
      throw new HttpsError('internal', `AI returned invalid JSON: ${err.message}`);
    }

    const durationMs = Date.now() - startedAt;
    logger.info(`aiGroupModel complete in ${durationMs}ms, confidence=${parsed.confidence}`);

    return {
      source: 'ai',
      model: 'claude-sonnet-4-20250514',
      durationMs,
      ...parsed,
    };
  },
);

module.exports = { aiGroupModel };
