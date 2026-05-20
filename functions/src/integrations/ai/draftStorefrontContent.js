/**
 * draftStorefrontContent
 *
 * Callable Cloud Function that drafts storefront prose (descriptions,
 * narratives, care instructions, etc.) for any dawinfinishes.com entity
 * using Claude. Pulls structured context from DawinOS — for projects, the
 * linked DesignProject record provides the foundational "first section"
 * (client, location, dates, team, scope) and Claude writes the rest.
 *
 * Inputs (callable data):
 *   - entityType: 'project' | 'finish' | 'material' | 'voice' | 'press_mention' | 'featured_update'
 *   - entityId:   Firestore doc id in the source collection
 *   - sections?:  string[]  — optional whitelist of fields to draft
 *   - tone?:      string    — optional voice override (default "warm, confident, Dawin-house style")
 *
 * Returns:
 *   { drafts: Record<string, string>, model: string, sourceContext: object }
 *
 * Permission: requires authenticated user. The drafts are NOT written back
 * to Firestore — caller previews + edits + saves via the existing services.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore } = require('firebase-admin/firestore');
const {
  createMessageWithRetry,
  parseJsonFromResponse,
} = require('../../utils/claudeClient');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const ALLOWED_ORIGINS = [
  'https://dawinos.web.app',
  'https://dawinos.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

// House voice — kept short and stable so drafts stay on-brand.
const HOUSE_VOICE = `
You write for **Dawin Finishes**, a Kampala-based design studio (founded 2014) specialising in
hand-mixed wall finishes, bespoke furniture, fit-outs, and home fragrance. The voice is:
  · warm but unsentimental — confidence, not hype
  · technically literate (talk about lime, plaster, cure-time, sheen by number)
  · proudly local (workshop in Kyambogo, materials from Lake Albert, Uganda-made)
  · short sentences; no marketing fluff; no exclamation marks
  · British/Commonwealth spelling (colour, organisation, finalised)
Avoid: "elevate", "transform", "stunning", "luxurious", "premium", "perfect", "passion".
Prefer: specifics over adjectives. If you don't have a fact, leave it out.
`.trim();

// Schemas — what we draft for each entity, with concise per-field prompts.
const ENTITY_DRAFTS = {
  project: {
    label: 'Project case study',
    fields: {
      'hero.summary': '1–2 sentence hook for the project, drawn from sector, location, year, scope, and the linked DesignProject description if any. Under 220 chars.',
      'narrative.heading': 'A short section heading (3–6 words) for the project narrative — anchored to a specific aspect (material, room, moment), not generic.',
      'narrative.body': 'The main case-study body. 3–4 short paragraphs. Cover: brief: scope + setting; process: what was hand-mixed or made on-site; result: client experience. Reference finishes_used / materials_used / partner_architect when present. No fabricated facts.',
      'narrative.asideHeading': 'A short eyebrow for an aside callout (e.g. "On the bench", "From the workshop").',
      'narrative.asideContent': 'A 1–2 sentence callout for the aside — pull a notable workshop or material detail.',
      'cta.headline': 'A short CTA headline (under 8 words) for the bottom of the page.',
      'cta.body': 'A 1–2 sentence CTA body inviting the reader to start a similar project.',
      'storefront.description': 'OBSOLETE — do not draft (storefront body lives in narrative.body).',
    },
  },
  finish: {
    label: 'Finish library entry',
    fields: {
      description: 'The finish description shown on /finishes/{handle}. 2–3 sentences. Reference family, sheen, hand_count, cure_hours, and any locality (Kyambogo workshop). Write as a confident description, not marketing copy. 300–500 chars.',
    },
  },
  material: {
    label: 'Material (inventory item)',
    fields: {
      materialDescription: 'The material description shown on the storefront. 2–3 sentences. Reference category, origin (country/region), supplier if local, and whether it\'s sustainable. Specific, not flowery. 200–400 chars.',
      careInstructions: 'Optional plain-text care instructions if this item is also a finished product. 1–3 sentences. Practical (how to clean, what to avoid).',
    },
  },
  voice: {
    label: 'Client testimonial (voice)',
    fields: {
      // Voices are user-written quotes — we don't draft the quote itself.
      // We can suggest a refined attribution / role phrasing if asked.
      _note: 'Voice quotes are the client\'s words and should not be drafted by AI. This entity is included for completeness.',
    },
  },
  press_mention: {
    label: 'Press mention',
    fields: {
      pullQuote: 'A short pull quote (under 140 chars) drawn from the article title and any context. If insufficient context, decline politely.',
    },
  },
  featured_update: {
    label: 'Featured update (Today in the studio)',
    fields: {
      headline: 'A short, punchy headline for the storefront "Today" tile. Under 30 chars. Should NOT end with a period.',
      subhead: 'A 1-sentence subhead with a specific workshop or process detail (e.g. "Hand-rubbed oil · day 4 of 7"). Under 60 chars.',
      eyebrow: 'A short eyebrow chip (e.g. "Bench 03", "Workshop"). Under 16 chars.',
    },
  },
};

function entitySchema(entityType, requestedSections) {
  const def = ENTITY_DRAFTS[entityType];
  if (!def) throw new HttpsError('invalid-argument', `Unknown entityType: ${entityType}`);
  const all = Object.entries(def.fields);
  const filtered = requestedSections && requestedSections.length > 0
    ? all.filter(([key]) => requestedSections.includes(key))
    : all.filter(([key]) => !key.startsWith('_') && def.fields[key] !== undefined);
  return { label: def.label, fields: Object.fromEntries(filtered) };
}

async function loadContext(db, entityType, entityId) {
  switch (entityType) {
    case 'project': {
      const cs = (await db.collection('projectCaseStudies').doc(entityId).get()).data();
      if (!cs) throw new HttpsError('not-found', `Case study ${entityId} not found`);
      const ctx = { caseStudy: cs };
      if (cs.linkedProjectId) {
        const proj = (await db.collection('projects').doc(cs.linkedProjectId).get()).data();
        if (proj) ctx.designProject = proj;
      }
      // Pull linked finishes + materials summaries for the model to reference
      const finishIds = cs.storefront?.finishesUsedIds || [];
      const materialIds = cs.storefront?.materialsUsedIds || [];
      if (finishIds.length) {
        const finishes = await Promise.all(finishIds.slice(0, 6).map(async (id) => {
          const f = (await db.collection('finishLibrary').doc(id).get()).data();
          return f ? { name: f.name, code: f.code, family: f.dawinFinishes?.family, color: f.hexColor } : null;
        }));
        ctx.linkedFinishes = finishes.filter(Boolean);
      }
      if (materialIds.length) {
        const materials = await Promise.all(materialIds.slice(0, 6).map(async (id) => {
          const m = (await db.collection('inventoryItems').doc(id).get()).data();
          return m ? { name: m.name, sku: m.sku, category: m.category } : null;
        }));
        ctx.linkedMaterials = materials.filter(Boolean);
      }
      return ctx;
    }
    case 'finish': {
      const f = (await db.collection('finishLibrary').doc(entityId).get()).data();
      if (!f) throw new HttpsError('not-found', `Finish ${entityId} not found`);
      return { finish: f };
    }
    case 'material': {
      const m = (await db.collection('inventoryItems').doc(entityId).get()).data();
      if (!m) throw new HttpsError('not-found', `Inventory item ${entityId} not found`);
      return { material: m };
    }
    case 'voice': {
      const v = (await db.collection('voices').doc(entityId).get()).data();
      if (!v) throw new HttpsError('not-found', `Voice ${entityId} not found`);
      return { voice: v };
    }
    case 'press_mention': {
      const p = (await db.collection('pressMentions').doc(entityId).get()).data();
      if (!p) throw new HttpsError('not-found', `Press mention ${entityId} not found`);
      return { pressMention: p };
    }
    case 'featured_update': {
      const fu = (await db.collection('featuredUpdates').doc(entityId).get()).data();
      if (!fu) throw new HttpsError('not-found', `Featured update ${entityId} not found`);
      return { featuredUpdate: fu };
    }
    default:
      throw new HttpsError('invalid-argument', `Unknown entityType: ${entityType}`);
  }
}

function buildUserPrompt(entityType, schema, context, tone) {
  const fieldsBlock = Object.entries(schema.fields)
    .map(([key, instruction]) => `  - ${key}:  ${instruction}`)
    .join('\n');

  // Strip the noisy Firestore Timestamp objects so the model gets clean JSON
  const clean = JSON.parse(JSON.stringify(context, (_k, v) =>
    (v && typeof v === 'object' && v._seconds !== undefined) ? new Date(v._seconds * 1000).toISOString() : v
  ));

  return [
    `Entity type: ${entityType} (${schema.label})`,
    `Tone: ${tone || 'warm, confident, Dawin-house style'}`,
    '',
    'Fields to draft:',
    fieldsBlock,
    '',
    'Source context (use only the facts present here — do not invent):',
    '```json',
    JSON.stringify(clean, null, 2),
    '```',
    '',
    'Return a single JSON object whose keys are exactly the field names above',
    '(e.g. "hero.summary", "narrative.body"). Use dotted keys verbatim. No prose,',
    'no preamble — JSON only.',
  ].join('\n');
}

const draftStorefrontContent = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '1GiB',
    secrets: [ANTHROPIC_API_KEY],
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign-in required');
    }
    const { entityType, entityId, sections, tone } = request.data || {};
    if (!entityType || !entityId) {
      throw new HttpsError('invalid-argument', 'entityType and entityId are required');
    }

    const db = getFirestore();
    const schema = entitySchema(entityType, sections);
    if (Object.keys(schema.fields).length === 0) {
      return { drafts: {}, model: null, sourceContext: null, note: 'No draftable fields for this entity type.' };
    }

    const context = await loadContext(db, entityType, entityId);
    const userPrompt = buildUserPrompt(entityType, schema, context, tone);

    const systemPrompt = [
      HOUSE_VOICE,
      '',
      'You are drafting storefront copy for the Dawin Finishes website (dawinfinishes.com).',
      'You must return strict JSON. Each requested field gets exactly one string value.',
      'If you genuinely have no factual basis to draft a field, return an empty string for that field.',
      'Never fabricate client names, project years, supplier names, or technical specs not in the source context.',
    ].join('\n');

    const t0 = Date.now();
    const responseText = await createMessageWithRetry(
      ANTHROPIC_API_KEY.value(),
      'standard',
      systemPrompt,
      userPrompt,
      2
    );
    const drafts = parseJsonFromResponse(responseText);

    logger.info('ai.draftStorefrontContent', {
      entityType,
      entityId,
      requestedSections: Object.keys(schema.fields),
      uid: request.auth.uid,
      duration_ms: Date.now() - t0,
      model: 'claude-sonnet-4-20250514',
    });

    return {
      drafts,
      model: 'claude-sonnet-4-20250514',
      entityType,
      sourceFields: Object.keys(context),
    };
  }
);

module.exports = { draftStorefrontContent };
