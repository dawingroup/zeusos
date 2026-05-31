/**
 * Strategy Assessment & Rewrite Cloud Functions
 *
 * assessStrategySection  — Scores a strategy document section (1-5) against
 *                          live business data and identifies gaps.
 * rewriteStrategySection — Generates an AI rewrite for a section and stores
 *                          it as pendingRewrite (or applies immediately).
 *
 * Both are called by the DawinOS MCP dawinos_assess_strategy_section and
 * dawinos_rewrite_strategy_section tools.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ─── Firestore paths ──────────────────────────────────────────────────────────

function sectionsPath(companyId, reviewId) {
  return `companies/${companyId}/strategy_reviews/${reviewId}/document_sections`;
}

function auditLogPath(companyId, reviewId) {
  return `companies/${companyId}/strategy_reviews/${reviewId}/section_audit_log`;
}

// ─── Business context loader ──────────────────────────────────────────────────

/**
 * Loads a lightweight snapshot of current ZeusOS business data to ground the
 * assessment: master-job (engagement) status mix, recent client-invoice
 * activity, and spend-plan summaries. (Phase 3.4 — re-pointed off the DawinOS
 * manufacturing/PO reads.)
 */
async function loadBusinessContext(companyId) {
  const ctx = {};

  try {
    // Engagements (master_jobs) by status — top-level collection in ZeusOS.
    const mjSnap = await db.collection('master_jobs').limit(50).get();
    const statusCounts = {};
    mjSnap.docs.forEach((d) => {
      const s = d.data().status ?? 'unknown';
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    });
    ctx.masterJobsByStatus = statusCounts;
    ctx.activeMasterJobs = mjSnap.size;
  } catch { ctx.masterJobsByStatus = {}; ctx.activeMasterJobs = 0; }

  try {
    // Recent client-invoice activity (revenue signal).
    const invSnap = await db.collection('client_invoices')
      .where('status', 'in', ['ISSUED', 'PART_PAID', 'PAID']).limit(10).get();
    ctx.openClientInvoices = invSnap.size;
  } catch { ctx.openClientInvoices = 0; }

  try {
    // Spend plan summary (native).
    const spendSnap = await db
      .collection(`companies/${companyId}/spend_plans`)
      .orderBy('createdAt', 'desc').limit(3).get();
    ctx.recentSpendPlans = spendSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title,
      totalBudget: d.data().totalBudget,
      status: d.data().status,
    }));
  } catch { ctx.recentSpendPlans = []; }

  return ctx;
}

// ─── assessStrategySection ────────────────────────────────────────────────────

exports.assessStrategySection = onCall(
  { cors: ALLOWED_ORIGINS, secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB', region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { companyId, reviewId, sectionId } = request.data;
    if (!companyId || !reviewId || !sectionId) {
      throw new HttpsError('invalid-argument', 'companyId, reviewId, and sectionId are required');
    }

    // Load section
    const sectionRef = db.collection(sectionsPath(companyId, reviewId)).doc(sectionId);
    const sectionSnap = await sectionRef.get();
    if (!sectionSnap.exists) throw new HttpsError('not-found', 'Section not found');
    const section = { id: sectionSnap.id, ...sectionSnap.data() };

    // Load business context
    const bizCtx = await loadBusinessContext(companyId);

    const apiKey = GEMINI_API_KEY.value();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a strategy analyst reviewing a section of a company strategy document for alignment with current business realities.

SECTION HEADING: ${section.headingText}
SECTION TYPE: ${section.sectionType ?? 'general'}

CURRENT SECTION CONTENT:
${section.content}

CURRENT BUSINESS DATA SNAPSHOT:
- Active engagements (master jobs): ${bizCtx.activeMasterJobs}
- Engagements by status: ${JSON.stringify(bizCtx.masterJobsByStatus, null, 2)}
- Open client invoices: ${bizCtx.openClientInvoices}
- Recent spend plans: ${JSON.stringify(bizCtx.recentSpendPlans, null, 2)}

TASK: Assess how well this strategy section aligns with the current business data.

Respond with ONLY a JSON object (no introductory text, no markdown fences):
{
  "score": <integer 1-5, where 5=fully aligned, 1=severely misaligned>,
  "gaps": [<list of specific gaps or outdated claims, max 5 items>],
  "outdatedClaims": [<list of specific claims that contradict the business data, max 3>],
  "recommendation": <one of: "rewrite", "minor_update", "no_action", "flag_for_ceo">,
  "sectionHeading": "${section.headingText}",
  "rationale": <1-2 sentences explaining the score>
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new HttpsError('internal', `Failed to parse Gemini response: ${text.substring(0, 200)}`);
    }

    // Persist score back to section
    await sectionRef.update({
      alignmentScore: parsed.score,
      lastAssessedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Write audit log entry
    await db.collection(auditLogPath(companyId, reviewId)).add({
      sectionId,
      sectionHeading: section.headingText,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      changeType: 'assessment_only',
      alignmentScoreBefore: section.alignmentScore ?? null,
      alignmentScoreAfter: parsed.score,
      rationale: parsed.rationale ?? '',
      triggeredBy: 'automated',
      approvedBy: null,
      dataSnapshot: bizCtx,
    });

    return {
      score: parsed.score,
      gaps: parsed.gaps ?? [],
      outdatedClaims: parsed.outdatedClaims ?? [],
      recommendation: parsed.recommendation ?? 'no_action',
      sectionHeading: parsed.sectionHeading ?? section.headingText,
    };
  }
);

// ─── rewriteStrategySection ───────────────────────────────────────────────────

exports.rewriteStrategySection = onCall(
  { cors: ALLOWED_ORIGINS, secrets: [GEMINI_API_KEY], timeoutSeconds: 180, memory: '512MiB', region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { companyId, reviewId, sectionId, autoApprove = false } = request.data;
    if (!companyId || !reviewId || !sectionId) {
      throw new HttpsError('invalid-argument', 'companyId, reviewId, and sectionId are required');
    }

    // Load section
    const sectionRef = db.collection(sectionsPath(companyId, reviewId)).doc(sectionId);
    const sectionSnap = await sectionRef.get();
    if (!sectionSnap.exists) throw new HttpsError('not-found', 'Section not found');
    const section = { id: sectionSnap.id, ...sectionSnap.data() };

    // Load business context
    const bizCtx = await loadBusinessContext(companyId);

    const apiKey = GEMINI_API_KEY.value();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a strategic business writer rewriting a section of a company strategy document to better reflect current business realities while maintaining the professional tone and intent of the original.

SECTION HEADING: ${section.headingText}
SECTION TYPE: ${section.sectionType ?? 'general'}
CURRENT ALIGNMENT SCORE: ${section.alignmentScore ?? 'not assessed'}/5

ORIGINAL SECTION CONTENT:
${section.content}

CURRENT BUSINESS DATA:
- Active engagements (master jobs): ${bizCtx.activeMasterJobs}
- Engagements by status: ${JSON.stringify(bizCtx.masterJobsByStatus, null, 2)}
- Open client invoices: ${bizCtx.openClientInvoices}
- Recent spend plans: ${JSON.stringify(bizCtx.recentSpendPlans, null, 2)}

TASK: Rewrite this section to improve its alignment score. The rewrite should:
1. Correct any outdated claims using current business data
2. Maintain the original structure and professional tone
3. Keep roughly the same length as the original
4. Be factual — only include claims supported by the business data or the original strategic intent

Respond with ONLY a JSON object (no introductory text, no markdown fences):
{
  "rewritePreview": <the complete rewritten section text>,
  "sectionHeading": "${section.headingText}",
  "changesSummary": <1-2 sentences describing what was changed and why>
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new HttpsError('internal', `Failed to parse Gemini response: ${text.substring(0, 200)}`);
    }

    const rewrite = parsed.rewritePreview;
    if (!rewrite) throw new HttpsError('internal', 'No rewrite content in response');

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (autoApprove) {
      // Apply immediately
      await sectionRef.update({
        content: rewrite,
        pendingRewrite: null,
        rewriteStatus: 'applied',
        updatedAt: now,
      });

      await db.collection(auditLogPath(companyId, reviewId)).add({
        sectionId,
        sectionHeading: section.headingText,
        timestamp: now,
        changeType: 'rewrite',
        alignmentScoreBefore: section.alignmentScore ?? null,
        alignmentScoreAfter: null,
        rationale: parsed.changesSummary ?? 'AI rewrite auto-applied',
        triggeredBy: 'automated',
        approvedBy: null,
        dataSnapshot: bizCtx,
      });

      return {
        rewritePreview: rewrite,
        sectionHeading: section.headingText,
        status: 'applied',
      };
    } else {
      // Store as pending
      await sectionRef.update({
        pendingRewrite: rewrite,
        rewriteStatus: 'pending_review',
        updatedAt: now,
      });

      return {
        rewritePreview: rewrite,
        sectionHeading: section.headingText,
        status: 'pending_review',
      };
    }
  }
);
