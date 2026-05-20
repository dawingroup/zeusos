/**
 * Cloud Function - Cash Flow Scenario Analysis (Gen 2)
 *
 * What-if scenario analysis powered by Claude:
 * - Delay payment scenarios
 * - Late receipt scenarios
 * - Cash injection scenarios
 * - Combined multi-factor scenarios
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

exports.runCashFlowScenario = onCall(
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

    const { companyId, scenario } = request.data;
    if (!companyId || !scenario) {
      throw new HttpsError('invalid-argument', 'companyId and scenario are required');
    }

    logger.info(`[Scenario] Running scenario "${scenario.name}" for ${companyId}`);

    try {
      // Get current baseline data
      const baseline = await getBaselineData(companyId);

      // Apply scenario modifications
      const modified = applyModifications(baseline, scenario.modifications || []);

      // Get AI analysis
      const AnthropicModule = require('@anthropic-ai/sdk');
      const Anthropic = AnthropicModule.default || AnthropicModule;
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `You are a financial scenario analyst for a Ugandan construction company. Analyze a what-if cash flow scenario and provide insights. All amounts in UGX.
Respond in JSON format:
{
  "impact": "positive|negative|neutral",
  "impactSummary": "1-2 sentence summary",
  "cashPositionChange": number,
  "riskAssessment": "low|medium|high|critical",
  "recommendations": ["actionable recommendation 1", "..."],
  "keyInsights": ["insight 1", "..."],
  "tradeoffs": ["tradeoff 1", "..."]
}`,
        messages: [
          {
            role: 'user',
            content: `Scenario: ${scenario.name}\nDescription: ${scenario.description || ''}\n\nBaseline:\n${JSON.stringify(baseline, null, 2)}\n\nModified:\n${JSON.stringify(modified, null, 2)}\n\nModifications:\n${JSON.stringify(scenario.modifications, null, 2)}`,
          },
        ],
      });

      const content = response.content[0]?.text || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { impactSummary: content };

      // Save scenario result
      const result = {
        companyId,
        scenarioName: scenario.name,
        description: scenario.description || '',
        modifications: scenario.modifications || [],
        baseline: {
          cashPosition: baseline.cashPosition,
          totalPending: baseline.totalPending,
          criticalCount: baseline.criticalCount,
        },
        modified: {
          cashPosition: modified.cashPosition,
          totalPending: modified.totalPending,
        },
        analysis,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
      };

      const docRef = await db.collection('companies').doc(companyId)
        .collection('scenario_results').add(result);

      return {
        success: true,
        scenarioId: docRef.id,
        result,
      };
    } catch (error) {
      logger.error('[Scenario] Error:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

async function getBaselineData(companyId) {
  const queueSnap = await db.collection('companies').doc(companyId)
    .collection('expenditure_queue')
    .where('status', '==', 'pending')
    .orderBy('compositeScore', 'desc')
    .limit(30)
    .get();

  const items = queueSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      description: data.description,
      amount: data.amountUGX,
      category: data.category,
      priorityTier: data.priorityTier,
      vendor: data.vendor,
      dueDate: data.latestDate?.toDate?.()?.toISOString?.() || null,
    };
  });

  const today = new Date().toISOString().split('T')[0];
  const planSnap = await db.collection('companies').doc(companyId)
    .collection('spend_plans')
    .where('date', '==', today)
    .where('status', 'in', ['draft', 'active'])
    .orderBy('generatedAt', 'desc')
    .limit(1)
    .get();

  const plan = planSnap.empty ? null : planSnap.docs[0].data();

  return {
    cashPosition: plan?.openingBankBalance || 0,
    totalPending: items.reduce((s, i) => s + (i.amount || 0), 0),
    criticalCount: items.filter(i => i.priorityTier === 'CRITICAL').length,
    items: items.slice(0, 15),
    todaysOutflow: plan?.totalOutflow || 0,
    closingBalance: plan?.closingBalance || 0,
  };
}

function applyModifications(baseline, modifications) {
  const modified = { ...baseline };

  for (const mod of modifications) {
    switch (mod.type) {
      case 'delay_payment':
        // Remove delayed items from today's outflow
        modified.todaysOutflow = Math.max(0, modified.todaysOutflow - (mod.amount || 0));
        modified.cashPosition = baseline.cashPosition + (mod.amount || 0);
        break;
      case 'late_receipt':
        // Reduce cash position
        modified.cashPosition = baseline.cashPosition - (mod.amount || 0);
        break;
      case 'cash_injection':
        modified.cashPosition = baseline.cashPosition + (mod.amount || 0);
        break;
      case 'cost_increase':
        modified.totalPending = baseline.totalPending + (mod.amount || 0);
        break;
      default:
        break;
    }
  }

  modified.closingBalance = modified.cashPosition - modified.todaysOutflow;
  return modified;
}
