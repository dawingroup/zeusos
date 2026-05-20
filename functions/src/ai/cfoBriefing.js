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

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

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
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { companyId } = request.data;
    if (!companyId) {
      throw new HttpsError('invalid-argument', 'companyId is required');
    }

    logger.info(`[CFOBriefing] Generating briefing for ${companyId}`);

    try {
      // Gather context data
      const context = await gatherBriefingContext(companyId);

      // Call Claude
      const AnthropicModule = require('@anthropic-ai/sdk');
      const Anthropic = AnthropicModule.default || AnthropicModule;
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an AI CFO assistant for DawinOS, a Ugandan construction and interior finishes company.
You provide daily financial briefings in a structured format. All amounts are in UGX (Ugandan Shillings).
Be concise, actionable, and highlight risks clearly. Use business-appropriate language.
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
        subsidiaryId: 'dawin-group',
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
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async () => {
    logger.info('[CFOBriefing] Starting daily auto-briefing...');

    const companiesSnap = await db.collection('companies').get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      try {
        const context = await gatherBriefingContext(companyId);

        // Only generate if there's meaningful data
        if (context.pendingExpenditures === 0 && context.totalPending === 0) {
          continue;
        }

        const AnthropicModule = require('@anthropic-ai/sdk');
        const Anthropic = AnthropicModule.default || AnthropicModule;
        const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: `You are an AI CFO assistant for a Ugandan construction company. Generate a brief daily financial summary in JSON format matching this structure:
${BRIEFING_JSON_SCHEMA}
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
          subsidiaryId: 'dawin-group',
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
          },
        });

        logger.info(`[CFOBriefing] Auto-briefing generated for ${companyId}`);
      } catch (error) {
        logger.error(`[CFOBriefing] Error for ${companyId}:`, error);
      }
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

  // Get expenditure queue
  const queueSnap = await db.collection('companies').doc(companyId)
    .collection('expenditure_queue')
    .where('status', '==', 'pending')
    .orderBy('compositeScore', 'desc')
    .limit(20)
    .get();

  const items = queueSnap.docs.map(d => {
    const data = d.data();
    return {
      description: data.description,
      amount: data.amountUGX,
      category: data.category,
      priorityTier: data.priorityTier,
      compositeScore: data.compositeScore,
      vendor: data.vendor,
    };
  });

  const criticalItems = items.filter(i => i.priorityTier === 'CRITICAL');
  const totalPending = items.reduce((s, i) => s + (i.amount || 0), 0);

  // Get today's spend plan (use status filter to match existing composite index)
  const planSnap = await db.collection('companies').doc(companyId)
    .collection('spend_plans')
    .where('date', '==', today)
    .where('status', 'in', ['draft', 'active'])
    .orderBy('generatedAt', 'desc')
    .limit(1)
    .get();

  const plan = planSnap.empty ? null : planSnap.docs[0].data();

  // Get savings balance (field is 'date', not 'createdAt')
  const savingsSnap = await db.collection('companies').doc(companyId)
    .collection('savings_ledger')
    .orderBy('date', 'desc')
    .limit(1)
    .get();

  const savingsBalance = savingsSnap.empty ? 0 : (savingsSnap.docs[0].data().runningBalance || 0);

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
    pendingExpenditures: queueSnap.size,
    criticalCount: criticalItems.length,
    totalPending,
    topItems: items.slice(0, 10),
    cashPosition: plan?.openingBankBalance || 0,
    todaysSpendPlan: plan ? {
      scheduledCount: plan.scheduledExpenditures?.length || 0,
      totalOutflow: plan.totalOutflow || 0,
      closingBalance: plan.closingBalance || 0,
      riskFlags: plan.riskFlags || [],
    } : null,
    savingsBalance,
    liabilities,
  };
}
