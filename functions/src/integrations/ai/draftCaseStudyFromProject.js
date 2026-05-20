/**
 * draftCaseStudyFromProject
 *
 * Callable that creates a brand-new ProjectCaseStudy draft from an existing
 * DesignProject record. Claude reads the project (client / location / dates /
 * description) and writes the entire opening pass — hero, narrative, CTA,
 * suggested handle, suggested storefront block (sector / scope / etc.) and
 * a draft tag set.
 *
 * The output is written to `projectCaseStudies` with `status: 'draft'` and
 * `linkedProjectId` set; the marketing editor then opens the new case study
 * to review + edit + publish.
 *
 * Companion to `draftStorefrontContent.js` — that one drafts INTO an existing
 * case study; this one CREATES a case study from project data.
 *
 * Inputs:
 *   - projectId    (required): designProjects/{id} doc id
 *   - subsidiaryId (optional): defaults to 'finishes'
 *   - tone         (optional): house-voice override
 *
 * Returns:
 *   - caseStudyId: the new projectCaseStudies/{id}
 *   - draftedFields: string[] of field paths that were populated
 *   - sourceProject: { id, name, customerName, completedDate? }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
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

const SYSTEM_PROMPT = [
  HOUSE_VOICE,
  '',
  'You draft a brand-new case study from a DesignProject record. Return strict JSON',
  'matching the schema below — no preamble, no markdown wrapping. Use only facts from',
  'the source DesignProject. If you genuinely lack a fact (e.g. area_sqm), return null',
  'for that field — never fabricate.',
  '',
  'Schema (every field is REQUIRED in the response object, value `null` is allowed where',
  'noted):',
  '{',
  '  "handle": "kebab-case-slug",                          // from project name; under 60 chars',
  '  "hero": {',
  '    "title":   "the public title of the case study",   // can be project name verbatim',
  '    "client":  "client name",',
  '    "location":"City, Country",',
  '    "year":    "2025",                                  // four-digit string',
  '    "eyebrow": "Hospitality" or "Residential" etc.,    // sector label, short',
  '    "summary": "1-2 sentence hook, under 220 chars"',
  '  },',
  '  "narrative": {',
  '    "heading":      "short scene-anchored heading",    // 3-6 words',
  '    "body":         "3-4 short paragraphs covering brief → process → result",',
  '    "asideHeading": "On the bench" or similar,         // optional callout eyebrow',
  '    "asideContent": "1-2 sentence workshop or material detail"',
  '  },',
  '  "cta": {',
  '    "headline":     "short CTA headline, under 8 words",',
  '    "body":         "1-2 sentence CTA body inviting a similar project"',
  '  },',
  '  "tags": ["3-5 short kebab-case tags"],',
  '  "storefront": {',
  '    "sector":          "Residential | Hospitality | Commercial | Exhibition | Cultural",',
  '    "subSector":       null or e.g. "Hotel lounge",',
  '    "locationCity":    "Kampala",',
  '    "locationCountry": "UG",                            // ISO-2',
  '    "yearCompleted":   2025,',
  '    "monthCompleted":  null or 1-12,',
  '    "areaSqm":         null or integer m²,              // only if hinted in description',
  '    "scope":           ["design","fitout","furniture","finishes","lighting","styling"],',
  '    "teamLead":        null or "M. Kalu",',
  '    "teamSize":        null or integer,',
  '    "durationWeeks":   null or integer,',
  '    "budgetBand":      null or "S"|"M"|"L"|"XL"',
  '  }',
  '}',
].join('\n');

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

function isoYear(value) {
  if (!value) return null;
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

const draftCaseStudyFromProject = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 90,
    memory: '1GiB',
    secrets: [ANTHROPIC_API_KEY],
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign-in required');
    }
    const { projectId, subsidiaryId, tone } = request.data || {};
    if (!projectId) throw new HttpsError('invalid-argument', 'projectId is required');

    const db = getFirestore();

    // 1. Load the design project (collection: designProjects)
    const projRef = db.collection('designProjects').doc(projectId);
    const projSnap = await projRef.get();
    if (!projSnap.exists) {
      throw new HttpsError('not-found', `DesignProject ${projectId} not found`);
    }
    const project = projSnap.data();

    // 2. Strip Firestore Timestamps for the prompt
    const cleanProject = JSON.parse(JSON.stringify(project, (_k, v) =>
      v && typeof v === 'object' && v._seconds !== undefined
        ? new Date(v._seconds * 1000).toISOString()
        : v
    ));

    const userPrompt = [
      `Tone override: ${tone || 'warm, confident, Dawin-house style'}`,
      '',
      'Source DesignProject (use only these facts; do not invent client names, dates,',
      'team sizes, or area figures that aren\'t present):',
      '```json',
      JSON.stringify(cleanProject, null, 2),
      '```',
      '',
      'Draft the full case-study JSON per the schema in the system prompt. Return JSON only.',
    ].join('\n');

    const t0 = Date.now();
    const responseText = await createMessageWithRetry(
      ANTHROPIC_API_KEY.value(),
      'standard',
      SYSTEM_PROMPT,
      userPrompt,
      2
    );
    const draft = parseJsonFromResponse(responseText);

    if (!draft || typeof draft !== 'object') {
      throw new HttpsError('internal', 'AI returned an unparseable response');
    }

    // 3. Build the Firestore document. Map AI output → ProjectCaseStudy shape.
    const now = FieldValue.serverTimestamp();
    const handle = draft.handle || slugify(draft.hero?.title || project.name);
    const completedYear =
      isoYear(project.completedDate) || isoYear(project.dueDate) || isoYear(project.startDate);

    const caseStudy = {
      subsidiaryId: subsidiaryId || 'finishes',
      handle,
      status: 'draft',
      category: 'project_showcase',
      tags: Array.isArray(draft.tags) ? draft.tags.slice(0, 8).map(String) : [],
      hero: {
        title: draft.hero?.title || project.name || '',
        client: draft.hero?.client || project.customerName || '',
        location: draft.hero?.location || [project.siteLocation?.city, project.siteLocation?.country].filter(Boolean).join(', '),
        year: draft.hero?.year || (completedYear ? String(completedYear) : ''),
        eyebrow: draft.hero?.eyebrow || '',
        summary: draft.hero?.summary || '',
      },
      narrative: {
        heading: draft.narrative?.heading || '',
        body: draft.narrative?.body || '',
        asideHeading: draft.narrative?.asideHeading || '',
        asideContent: draft.narrative?.asideContent || '',
      },
      stats: [],
      materials: [],
      actionPoints: [],
      cta: {
        headline: draft.cta?.headline || '',
        body: draft.cta?.body || '',
      },
      linkedProjectId: projectId,
      storefront: draft.storefront
        ? {
            sector: draft.storefront.sector || 'Residential',
            subSector: draft.storefront.subSector || undefined,
            locationCity: draft.storefront.locationCity || project.siteLocation?.city || '',
            locationCountry: draft.storefront.locationCountry || project.siteLocation?.country || 'UG',
            yearCompleted: Number(draft.storefront.yearCompleted) || completedYear || new Date().getFullYear(),
            monthCompleted: draft.storefront.monthCompleted || undefined,
            areaSqm: Number(draft.storefront.areaSqm) || 0,
            scope: Array.isArray(draft.storefront.scope) ? draft.storefront.scope : [],
            teamLead: draft.storefront.teamLead || undefined,
            teamSize: draft.storefront.teamSize || undefined,
            durationWeeks: draft.storefront.durationWeeks || undefined,
            budgetBand: draft.storefront.budgetBand || undefined,
            storefrontPublished: true,
            shouldPublishToShopify: false, // editor opts in after review
          }
        : undefined,
      authorId: request.auth.uid,
      authorName: request.auth.token?.name || request.auth.token?.email || 'AI Draft',
      createdAt: now,
      createdBy: request.auth.uid,
      updatedAt: now,
      updatedBy: request.auth.uid,
      // Provenance — caller can see this was AI-drafted, not hand-written
      draftedByAI: {
        at: Timestamp.now(),
        model: 'claude-sonnet-4-20250514',
        sourceProjectId: projectId,
        rawDraft: draft,
      },
    };

    // Strip undefineds so Firestore accepts the write
    function stripUndef(o) {
      if (Array.isArray(o)) return o.map(stripUndef);
      if (o && typeof o === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(o)) {
          if (v === undefined) continue;
          out[k] = stripUndef(v);
        }
        return out;
      }
      return o;
    }

    const newRef = db.collection('projectCaseStudies').doc();
    await newRef.set(stripUndef(caseStudy));

    // Inventory which fields actually got populated so the UI can summarise.
    const drafted = [];
    if (draft.hero?.summary) drafted.push('hero.summary');
    if (draft.narrative?.body) drafted.push('narrative.body');
    if (draft.narrative?.heading) drafted.push('narrative.heading');
    if (draft.narrative?.asideContent) drafted.push('narrative.aside');
    if (draft.cta?.headline) drafted.push('cta.headline');
    if (draft.cta?.body) drafted.push('cta.body');
    if (draft.storefront?.sector) drafted.push('storefront.sector');
    if (draft.storefront?.scope?.length) drafted.push('storefront.scope');
    if (draft.tags?.length) drafted.push('tags');

    logger.info('ai.draftCaseStudyFromProject', {
      caseStudyId: newRef.id,
      projectId,
      uid: request.auth.uid,
      duration_ms: Date.now() - t0,
      drafted_count: drafted.length,
      model: 'claude-sonnet-4-20250514',
    });

    return {
      caseStudyId: newRef.id,
      handle,
      draftedFields: drafted,
      sourceProject: {
        id: projectId,
        name: project.name || '',
        customerName: project.customerName || '',
        completedYear: completedYear || null,
      },
      model: 'claude-sonnet-4-20250514',
    };
  }
);

module.exports = { draftCaseStudyFromProject };
