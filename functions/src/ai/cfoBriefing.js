/**
 * Cloud Function - AI CFO Daily Briefing (Gen 2)
 *
 * Uses Claude (Anthropic SDK) to generate daily financial briefings:
 * - Executive summary of cash position
 * - Key decisions requiring attention
 * - Risk alerts
 * - Recommendations
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');
const { getAnthropic } = require('./_anthropic');
const aging = require('../finance/aging');
const native = require('../finance/ledger/nativeLedgerSource');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
// Bootstrap binding — the runtime resolver in _anthropic.js prefers the
// Secret Manager latest version (rotatable from Settings → API Keys) and
// falls back to this env value.
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const GROUP_ORG_ID = 'zeus-group';

// JSON structure matching frontend CFOBriefing types
const BRIEFING_JSON_SCHEMA = `{
  "executiveSummary": "2-3 sentence overview of today's financial position",
  "keyDecisions": [
    {
      "decision": "What needs to be decided",
      "options": ["Option A", "Option B"],
      "recommendation": "Your recommended action",
      "rationale": "Why this is recommended",
      "urgency": "immediate|today|this_week"
    }
  ],
  "riskAlerts": [
    {
      "severity": "critical|warning|info",
      "message": "Description of the risk",
      "suggestedAction": "What to do about it"
    }
  ],
  "recommendations": [
    {
      "action": "Specific action to take",
      "expectedImpact": "What this will achieve",
      "priority": 1,
      "category": "collections|payments|savings|liabilities|operations"
    }
  ],
  "cashOutlookNarrative": "1-2 sentence forward-looking cash flow statement"
}`;

// ────────────────────────────────────────────────────────────────────────────
// GENERATE CFO BRIEFING (Callable)
// ────────────────────────────────────────────────────────────────────────────

exports.generateCFOBriefing = onCall(
  {
    cors: ALLOWED_ORIGINS,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    // Parent-org (commercial-scope) principals only — the consolidated CFO
    // view spans all brands.
    await assertParentOrgPrincipal(request.auth);

    const companyId = (request.data && request.data.companyId) || GROUP_ORG_ID;

    logger.info(`[CFOBriefing] Generating briefing for ${companyId}`);

    try {
      // Gather context data
      const context = await gatherBriefingContext(companyId);

      // Call Claude (key resolved at runtime — rotatable from Settings).
      const { client, model } = await getAnthropic();

      const response = await client.messages.create({
        model,
        max_tokens: 2000,
        system: `You are the AI CFO assistant for Zeus Group, an East African marketing consortium of five sibling brands.
You provide daily financial briefings in a structured format. All amounts are in MINOR units (cents) of the group presentation currency (context.presentationCurrency, default UGX).

Signals in the context object:
- ar.totalOutstanding, ar.buckets (current/d0_30/d31_60/d61_90/d90_plus), ar.dso, ar.topOverdue (named customers), ar.byBrand
- ap.totalOutstanding, ap.buckets, ap.dpo, ap.topOverdue (named vendors)
- cashPosition (GL cash balance), savingsBalance, liabilities, topItems, criticalCount, todaysSpendPlan

Rules:
- If ar.buckets.d61_90 or ar.buckets.d90_plus > 0, raise at least one riskAlert naming the top overdue customer + the bucket.
- If ar.dso or ap.dpo is null/0, do not fabricate a number — skip that commentary.
- If criticalCount >= 1 AND cashPosition < ap.buckets.d0_30, raise a 'critical' severity alert.
- Keep executiveSummary <= 3 sentences; each riskAlert.message <= 25 words.
Format your response as JSON with this exact structure:
${BRIEFING_JSON_SCHEMA}
Important: priority in recommendations must be a number (1=highest). Return ONLY valid JSON, no markdown.`,
        messages: [
          {
            role: 'user',
            content: `Generate today's CFO briefing based on the following data:\n\n${JSON.stringify(context, null, 2)}`,
          },
        ],
      });

      const content = response.content[0]?.text || '{}';
      let briefing;
      try {
        // Extract JSON from response (may have markdown wrapping)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        briefing = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        briefing = {
          executiveSummary: content,
          keyDecisions: [],
          riskAlerts: [],
          recommendations: [],
          cashOutlookNarrative: '',
        };
      }

      // Normalize the briefing to match frontend types
      briefing = normalizeBriefing(briefing);

      // Save briefing to Firestore
      const briefingDoc = {
        companyId,
        subsidiaryId: GROUP_ORG_ID,
        date: new Date().toISOString().split('T')[0],
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: request.auth.uid,
        executiveSummary: briefing.executiveSummary,
        keyDecisions: briefing.keyDecisions,
        riskAlerts: briefing.riskAlerts,
        recommendations: briefing.recommendations,
        cashOutlookNarrative: briefing.cashOutlookNarrative,
        contextSnapshot: {
          bankBalance: context.cashPosition || 0,
          projectedMinBalance: context.todaysSpendPlan?.closingBalance || 0,
          criticalExpenditures: context.criticalCount || 0,
          upcomingReceipts: 0,
          savingsBalance: context.savingsBalance || 0,
          liabilitiesDueSoon: context.liabilities?.length || 0,
          arOutstanding: context.ar?.totalOutstanding || 0,
          arBuckets: context.ar?.buckets || null,
          dso: context.ar?.dso ?? null,
          arOverdueCount: context.ar?.overdueCount || 0,
          apOutstanding: context.ap?.totalOutstanding || 0,
          apBuckets: context.ap?.buckets || null,
          dpo: context.ap?.dpo ?? null,
          apOverdueCount: context.ap?.overdueCount || 0,
          presentationCurrency: context.presentationCurrency || 'UGX',
        },
      };

      const docRef = await db.collection('companies').doc(companyId)
        .collection('cfo_briefings').add(briefingDoc);

      return {
        success: true,
        briefingId: docRef.id,
        briefing: { id: docRef.id, ...briefingDoc },
      };
    } catch (error) {
      if (error && error.code === 'NOT_CONFIGURED') {
        throw new HttpsError('failed-precondition', error.message);
      }
      logger.error('[CFOBriefing] Error:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// DAILY AUTO-BRIEFING (Scheduled — runs after optimizer)
// ────────────────────────────────────────────────────────────────────────────

exports.dailyCFOBriefing = onSchedule(
  {
    schedule: '30 5 * * 1-5', // 5:30 AM Mon-Fri (after optimizer runs at 5 AM)
    timeZone: 'Africa/Nairobi',
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async () => {
    logger.info('[CFOBriefing] Starting daily auto-briefing for the group...');

    // The CFO briefing is the consolidated, group-level view (zeus-group).
    // Per-brand briefings would need brand-scoped aging — a later refinement.
    const companyId = GROUP_ORG_ID;
    try {
      const context = await gatherBriefingContext(companyId);

      // Only generate if there's meaningful data.
      const hasReceivables = (context.ar?.totalOutstanding || 0) > 0;
      if (context.pendingExpenditures === 0 && context.totalPending === 0 && !hasReceivables) {
        logger.info('[CFOBriefing] No meaningful data; skipping auto-briefing.');
        return;
      }

      const { client, model } = await getAnthropic();

      const response = await client.messages.create({
        model,
        max_tokens: 1500,
        system: `You are the AI CFO assistant for Zeus Group, an East African marketing consortium. Generate a brief daily financial summary in JSON format matching this structure:
${BRIEFING_JSON_SCHEMA}
All amounts are minor units of context.presentationCurrency. Name the customer/vendor + aging bucket when surfacing AR/AP risk. If ar.dso or ap.dpo is null, do not invent a number.
Important: priority in recommendations must be a number (1=highest). Return ONLY valid JSON.`,
        messages: [
          { role: 'user', content: `Daily briefing data:\n${JSON.stringify(context, null, 2)}` },
        ],
      });

      const content = response.content[0]?.text || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let briefing = jsonMatch ? JSON.parse(jsonMatch[0]) : { executiveSummary: content };
      briefing = normalizeBriefing(briefing);

      await db.collection('companies').doc(companyId).collection('cfo_briefings').add({
        companyId,
        subsidiaryId: GROUP_ORG_ID,
        date: new Date().toISOString().split('T')[0],
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: 'system:daily-auto',
        executiveSummary: briefing.executiveSummary,
        keyDecisions: briefing.keyDecisions,
        riskAlerts: briefing.riskAlerts,
        recommendations: briefing.recommendations,
        cashOutlookNarrative: briefing.cashOutlookNarrative,
        contextSnapshot: {
          bankBalance: context.cashPosition || 0,
          projectedMinBalance: 0,
          criticalExpenditures: context.criticalCount || 0,
          upcomingReceipts: 0,
          savingsBalance: context.savingsBalance || 0,
          liabilitiesDueSoon: context.liabilities?.length || 0,
          arOutstanding: context.ar?.totalOutstanding || 0,
          arBuckets: context.ar?.buckets || null,
          dso: context.ar?.dso ?? null,
          apOutstanding: context.ap?.totalOutstanding || 0,
          apBuckets: context.ap?.buckets || null,
          dpo: context.ap?.dpo ?? null,
          presentationCurrency: context.presentationCurrency || 'UGX',
        },
      });

      logger.info(`[CFOBriefing] Auto-briefing generated for ${companyId}`);
    } catch (error) {
      logger.error(`[CFOBriefing] Error for ${companyId}:`, error);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// NORMALIZE BRIEFING — ensure output matches CFOBriefing types
// ────────────────────────────────────────────────────────────────────────────

function normalizeBriefing(raw) {
  return {
    executiveSummary: raw.executiveSummary || '',
    keyDecisions: (raw.keyDecisions || []).map(d => ({
      decision: d.decision || d.title || '',
      options: d.options || [],
      recommendation: d.recommendation || '',
      rationale: d.rationale || d.description || '',
      urgency: normalizeUrgency(d.urgency),
    })),
    riskAlerts: (raw.riskAlerts || []).map(a => ({
      severity: a.severity || 'info',
      message: a.message || a.title || '',
      suggestedAction: a.suggestedAction || a.mitigation || a.description || '',
    })),
    recommendations: (raw.recommendations || []).map((r, idx) => ({
      action: r.action || '',
      expectedImpact: r.expectedImpact || r.rationale || '',
      priority: typeof r.priority === 'number' ? r.priority : idx + 1,
      category: normalizeCategory(r.category),
    })),
    cashOutlookNarrative: raw.cashOutlookNarrative || raw.cashflowOutlook || '',
  };
}

function normalizeUrgency(urgency) {
  const map = { critical: 'immediate', high: 'today', medium: 'this_week', low: 'this_week' };
  return map[urgency] || urgency || 'today';
}

function normalizeCategory(category) {
  const valid = ['collections', 'payments', 'savings', 'liabilities', 'operations'];
  return valid.includes(category) ? category : 'operations';
}

// ────────────────────────────────────────────────────────────────────────────
// CONTEXT GATHERER
// ────────────────────────────────────────────────────────────────────────────

async function gatherBriefingContext(companyId) {
  const today = new Date().toISOString().split('T')[0];

  // AR/AP aging (native ledger, FX-normalised) + GL cash position run in
  // parallel with the expenditure queue read.
  const [queueSnap, arSummary, apSummary, cashPos] = await Promise.all([
    db.collection('companies').doc(companyId)
      .collection('expenditure_queue')
      .where('status', '==', 'pending')
      .limit(50)
      .get(),
    aging.getArAging({}).catch((e) => { logger.warn('[CFOBriefing] AR aging failed:', e.message); return null; }),
    aging.getApAging({}).catch((e) => { logger.warn('[CFOBriefing] AP aging failed:', e.message); return null; }),
    native.getCashPosition({ orgId: companyId }).catch(() => null),
  ]);

  // Sort by compositeScore in memory (avoids a composite index requirement).
  const items = queueSnap.docs
    .map(d => {
      const data = d.data();
      return {
        description: data.description,
        amount: data.amountUGX ?? data.amountMinor,
        category: data.category,
        priorityTier: data.priorityTier,
        compositeScore: data.compositeScore ?? (data.scores && data.scores.composite) ?? 0,
        vendor: data.vendor,
      };
    })
    .sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0))
    .slice(0, 20);

  const criticalItems = items.filter(i => i.priorityTier === 'CRITICAL');
  const totalPending = items.reduce((s, i) => s + (i.amount || 0), 0);

  // Get today's spend plan — filter in memory to avoid a composite index.
  const planSnap = await db.collection('companies').doc(companyId)
    .collection('spend_plans')
    .where('date', '==', today)
    .limit(10)
    .get();

  const plan = planSnap.empty
    ? null
    : planSnap.docs
      .map(d => d.data())
      .filter(p => ['draft', 'active'].includes(p.status))
      .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')))[0] || null;

  // Get savings balance — latest by date, chosen in memory.
  const savingsSnap = await db.collection('companies').doc(companyId)
    .collection('savings_ledger')
    .limit(50)
    .get();

  const latestSavings = savingsSnap.empty
    ? null
    : savingsSnap.docs
      .map(d => d.data())
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
  const savingsBalance = latestSavings ? (latestSavings.runningBalance || 0) : 0;

  // Get upcoming liabilities (status is 'current', not 'active')
  const liabilitiesSnap = await db.collection('companies').doc(companyId)
    .collection('liability_register')
    .where('status', '==', 'current')
    .limit(10)
    .get();

  const liabilities = liabilitiesSnap.docs.map(d => {
    const data = d.data();
    return {
      type: data.type,
      description: data.description,
      remaining: data.amountRemaining,
      vendorName: data.vendorName,
      nextDue: data.nextDueDate?.toDate?.()?.toISOString?.() || null,
    };
  });

  return {
    date: today,
    presentationCurrency: arSummary?.presentationCurrency || apSummary?.presentationCurrency || 'UGX',
    pendingExpenditures: queueSnap.size,
    criticalCount: criticalItems.length,
    totalPending,
    topItems: items.slice(0, 10),
    // GL cash balance is the source of truth; fall back to the spend plan's
    // opening bank balance when GL has no cash postings yet.
    cashPosition: cashPos?.balanceMinor ?? plan?.openingBankBalance ?? 0,
    todaysSpendPlan: plan ? {
      scheduledCount: plan.scheduledExpenditures?.length || 0,
      totalOutflow: plan.totalOutflow || 0,
      closingBalance: plan.closingBalance || 0,
      riskFlags: plan.riskFlags || [],
    } : null,
    savingsBalance,
    liabilities,
    ar: arSummary,
    ap: apSummary,
  };
}
