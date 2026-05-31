/**
 * Client Strategy Assistant — Phase 3.5 (headline feature).
 *
 * For a given client, aggregates four dimensions and has Claude synthesise a
 * structured strategy brief:
 *   1. Stakeholders   — clients/{id}/client_contacts (+ inline client.contacts)
 *   2. Competitors    — client_competitors (the conflict-firewall named list)
 *   3. Regulatory     — regulatory_changes matched on the client's sector
 *   4. Business memory — ai_memory scoped to the client (best-effort)
 *
 * Persists the brief to clients/{id}/strategy_briefs/{briefId} for history and
 * emits ClientStrategyBriefGenerated via the outbox. Gated by
 * assertCommercialPrincipal so brand-direct ADs can run it for their own clients.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertCommercialPrincipal } = require('../assignment/lib/auth');
const { getAnthropic } = require('./_anthropic');
const { appendDomainEvent } = require('../platform/outbox');

if (!admin.apps.length) admin.initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const BRIEF_JSON_SCHEMA = `{
  "executiveSummary": "2-3 sentence strategic read on this client",
  "stakeholderMap": [
    { "name": "Stakeholder", "role": "Their role", "influence": "high|medium|low", "approach": "How to engage them" }
  ],
  "regulatoryExposure": [
    { "title": "The change", "impact": "critical|high|medium|low", "implication": "What it means for this client/our work" }
  ],
  "competitivePositioning": {
    "summary": "1-2 sentences on the competitive landscape",
    "threats": ["threat 1"],
    "opportunities": ["opportunity 1"]
  },
  "recommendedPlays": [
    { "play": "Specific recommended action", "rationale": "Why", "priority": 1 }
  ]
}`;

async function gatherStakeholders(db, clientId, client) {
  const out = [];
  try {
    const snap = await db.collection(`clients/${clientId}/client_contacts`).get();
    for (const d of snap.docs) {
      const c = d.data() || {};
      out.push({
        name: c.name || 'Unknown',
        role: c.role || null,
        organization: c.organization || client.name || null,
        influence: c.influence || null,
        sentiment: c.sentiment || null,
      });
    }
  } catch (_) { /* best-effort */ }
  // Fall back to / supplement with inline client.contacts.
  if (Array.isArray(client.contacts)) {
    for (const c of client.contacts) {
      if (out.some((s) => s.name === (c.name || c.fullName))) continue;
      out.push({
        name: c.name || c.fullName || 'Unknown',
        role: c.role || c.title || null,
        organization: client.name || null,
        influence: null,
        sentiment: null,
      });
    }
  }
  return out;
}

async function gatherCompetitors(db, clientId) {
  const out = [];
  try {
    const snap = await db.collection('client_competitors').where('clientId', '==', clientId).get();
    for (const d of snap.docs) {
      const c = d.data() || {};
      let name = c.competitorName || c.competitorClientId || null;
      // Resolve a friendlier name if the competitor is itself a Zeus client.
      if (c.competitorClientId) {
        try {
          const cs = await db.doc(`clients/${c.competitorClientId}`).get();
          if (cs.exists && cs.data().name) name = cs.data().name;
        } catch (_) { /* keep id */ }
      }
      out.push({ name, competitorClientId: c.competitorClientId || null });
    }
  } catch (_) { /* best-effort */ }
  return out;
}

async function gatherRegulatory(db, client) {
  const sector = (client.sector || '').toLowerCase().trim();
  if (!sector) return [];
  try {
    const snap = await db
      .collection('regulatory_changes')
      .where('sector', 'array-contains', sector)
      .get();
    return snap.docs
      .map((d) => {
        const r = d.data() || {};
        return {
          title: r.title,
          impactLevel: r.impactLevel,
          status: r.status,
          effectiveDate: r.effectiveDate,
          summary: r.summary,
        };
      })
      .sort((a, b) => String(b.effectiveDate || '').localeCompare(String(a.effectiveDate || '')))
      .slice(0, 15);
  } catch (err) {
    logger.warn('[ClientStrategyBrief] regulatory gather failed:', err.message);
    return [];
  }
}

async function gatherMemory(db, clientId) {
  try {
    const snap = await db
      .collection('ai_memory')
      .where('customerId', '==', clientId)
      .limit(20)
      .get();
    return snap.docs.map((d) => {
      const m = d.data() || {};
      return { content: m.content || m.text || '', category: m.category || null };
    }).filter((m) => m.content);
  } catch (_) {
    return [];
  }
}

exports.generateClientStrategyBrief = onCall(
  {
    cors: ALLOWED_ORIGINS,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    const { clientId } = request.data || {};
    if (!clientId || typeof clientId !== 'string') {
      throw new HttpsError('invalid-argument', 'clientId is required');
    }
    // Brand-direct ADs (own client) or parent-org principals.
    const { uid } = await assertCommercialPrincipal(request.auth, clientId);

    const db = getFirestore();
    const clientSnap = await db.doc(`clients/${clientId}`).get();
    if (!clientSnap.exists) {
      throw new HttpsError('not-found', `Client ${clientId} not found`);
    }
    const client = clientSnap.data();

    try {
      const [stakeholders, competitors, regulatory, memories] = await Promise.all([
        gatherStakeholders(db, clientId, client),
        gatherCompetitors(db, clientId),
        gatherRegulatory(db, client),
        gatherMemory(db, clientId),
      ]);

      const context = {
        client: { name: client.name, sector: client.sector || null, primaryBrandId: client.primaryBrandId || null, status: client.status || null },
        stakeholders,
        competitors,
        regulatoryChanges: regulatory,
        businessMemories: memories,
      };

      const { client: anthropic, model } = await getAnthropic();
      const response = await anthropic.messages.create({
        model,
        max_tokens: 2000,
        system: `You are a strategic account advisor for Zeus Group, an East African marketing consortium.
Produce a concise, board-ready client strategy brief in structured JSON from the context provided.
Ground every point in the context — name the actual stakeholders, competitors, and regulatory changes given. Do not invent facts.
If a dimension is empty, return an empty array for it rather than fabricating entries.
Format your response as JSON with this exact structure:
${BRIEF_JSON_SCHEMA}
priority must be a number (1=highest). Return ONLY valid JSON, no markdown.`,
        messages: [
          { role: 'user', content: `Generate the client strategy brief from this context:\n\n${JSON.stringify(context, null, 2)}` },
        ],
      });

      const content = response.content[0]?.text || '{}';
      let brief;
      try {
        const m = content.match(/\{[\s\S]*\}/);
        brief = JSON.parse(m ? m[0] : content);
      } catch {
        brief = { executiveSummary: content, stakeholderMap: [], regulatoryExposure: [], competitivePositioning: { summary: '', threats: [], opportunities: [] }, recommendedPlays: [] };
      }

      const briefDoc = {
        clientId,
        clientName: client.name,
        generatedAt: FieldValue.serverTimestamp(),
        generatedBy: uid,
        executiveSummary: brief.executiveSummary || '',
        stakeholderMap: brief.stakeholderMap || [],
        regulatoryExposure: brief.regulatoryExposure || [],
        competitivePositioning: brief.competitivePositioning || { summary: '', threats: [], opportunities: [] },
        recommendedPlays: brief.recommendedPlays || [],
        sourceCounts: {
          stakeholders: stakeholders.length,
          competitors: competitors.length,
          regulatory: regulatory.length,
          memories: memories.length,
        },
      };

      const briefRef = db.collection(`clients/${clientId}/strategy_briefs`).doc();
      await db.runTransaction(async (tx) => {
        tx.set(briefRef, briefDoc);
        appendDomainEvent({
          tx,
          db,
          eventType: 'ClientStrategyBriefGenerated',
          aggregateType: 'Client',
          aggregateId: clientId,
          payload: {
            clientId,
            briefId: briefRef.id,
            sectors: client.sector ? [client.sector] : [],
            competitorCount: competitors.length,
            regulatoryCount: regulatory.length,
            stakeholderCount: stakeholders.length,
          },
          emittedByUserId: uid,
        });
      });

      return { success: true, briefId: briefRef.id, brief: { id: briefRef.id, ...briefDoc } };
    } catch (error) {
      if (error && error.code === 'NOT_CONFIGURED') {
        throw new HttpsError('failed-precondition', error.message);
      }
      if (error instanceof HttpsError) throw error;
      logger.error('[ClientStrategyBrief] error:', error);
      throw new HttpsError('internal', error.message);
    }
  },
);
