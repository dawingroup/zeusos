/**
 * enrichTripoPrompt — Cloud Function (HTTPS Callable)
 *
 * Enriches a Tripo AI mesh generation prompt with DKB archetype context.
 * Injects dimensional standards, material specs, and assembly patterns.
 *
 * Timeout: 10s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();

const enrichTripoPrompt = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 10,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { prompt, productType, archetypeId } = request.data;

    if (!prompt || typeof prompt !== 'string') {
      throw new HttpsError('invalid-argument', 'prompt is required');
    }

    logger.info('enrichTripoPrompt called', { promptLength: prompt.length, productType, archetypeId });

    // 1. Find archetype (by ID or search)
    let archetype = null;
    if (archetypeId) {
      const snap = await db.collection('designKnowledgeBase').doc(archetypeId).get();
      if (snap.exists) archetype = { id: snap.id, ...snap.data() };
    }

    if (!archetype) {
      // Search by prompt terms
      const snap = await db.collection('designKnowledgeBase')
        .where('entryType', '==', 'product_archetype')
        .where('isActive', '==', true)
        .get();

      const promptLower = prompt.toLowerCase();
      archetype = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(a => {
          const terms = (a.searchTerms || a.tags || []);
          return terms.some(t => promptLower.includes(t.toLowerCase()));
        });
    }

    // 2. Build enriched prompt
    const parts = [prompt];
    const contextInjected = [];

    if (archetype) {
      parts.push(`\n[Design Context from ${archetype.name}]`);
      if (archetype.aiPromptContext) {
        parts.push(archetype.aiPromptContext);
        contextInjected.push('aiPromptContext');
      }

      const dims = archetype.standardDimensions;
      if (dims) {
        parts.push(
          `Standard dimensions: ${dims.width?.default || '?'}mm W × ${dims.depth?.default || '?'}mm D × ${dims.height?.default || '?'}mm H`
        );
        contextInjected.push('standardDimensions');
      }

      if (archetype.defaultFinishCategory) {
        parts.push(`Typical finish: ${archetype.defaultFinishCategory}`);
        contextInjected.push('defaultFinishCategory');
      }
    }

    // 3. Add dimensional standards
    const standardsSnap = await db.collection('designKnowledgeBase')
      .where('entryType', '==', 'dimensional_standard')
      .where('isActive', '==', true)
      .get();

    if (!standardsSnap.empty) {
      const promptLower = prompt.toLowerCase();
      const relevant = standardsSnap.docs
        .map(d => d.data())
        .filter(s => (s.tags || []).some(t => promptLower.includes(t.toLowerCase())))
        .slice(0, 2);

      if (relevant.length > 0) {
        parts.push('\n[Dimensional Standards]');
        for (const std of relevant) {
          const vals = Object.entries(std.values || {})
            .map(([k, v]) => `${k}: ${v}mm`)
            .join(', ');
          parts.push(`${std.standardName}: ${vals}`);
          contextInjected.push(`dimensionalStandard:${std.standardName}`);
        }
      }
    }

    const enrichedPrompt = parts.join('\n');

    logger.info('Prompt enriched', {
      archetypeUsed: archetype?.id || null,
      contextInjectedCount: contextInjected.length,
    });

    return {
      enrichedPrompt,
      archetypeUsed: archetype?.id || null,
      contextInjected,
    };
  },
);

module.exports = { enrichTripoPrompt };
