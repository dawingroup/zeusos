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
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');
const { getAnthropic } = require('./_anthropic');
const native = require('../finance/ledger/nativeLedgerSource');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const GROUP_ORG_ID = 'zeus-group';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

exports.runCashFlowScenario = onCall(
  {
    cors: ALLOWED_ORIGINS,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    // Parent-org (commercial scope) only.
    await assertParentOrgPrincipal(request.auth);

    const { scenario } = request.data || {};
    const companyId = (request.data && request.data.companyId) || GROUP_ORG_ID;
    if (!scenario) {
      throw new HttpsError('invalid-argument', 'scenario is required');
    }

    logger.info(`[Scenario] Running scenario "${scenario.name}" for ${companyId}`);

    try {
      // Get current baseline data
      const baseline = await getBaselineData(companyId);

      // Apply scenario modifications
      const modified = applyModifications(baseline, scenario.modifications || []);

      // Get AI analysis (key resolved at runtime — rotatable from Settings).
      const { client, model } = await getAnthropic();

      const response = await client.messages.create({
        model,
        max_tokens: 1500,
        system: `You are a financial scenario analyst for Zeus Group, an East African marketing consortium. Analyze a what-if cash flow scenario and provide insights. All amounts are in minor units of the group presentation currency.
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
      if (error && error.code === 'NOT_CONFIGURED') {
        throw new HttpsError('failed-precondition', error.message);
      }
      logger.error('[Scenario] Error:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

async function getBaselineData(companyId) {
  const [queueSnap, cashPos] = await Promise.all([
    db.collection('companies').doc(companyId)
      .collection('expenditure_queue')
      .where('status', '==', 'pending')
      .limit(50)
      .get(),
    native.getCashPosition({ orgId: companyId }).catch(() => null),
  ]);

  const items = queueSnap.docs
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        description: data.description,
        amount: data.amountUGX ?? data.amountMinor,
        category: data.category,
        priorityTier: data.priorityTier,
        compositeScore: data.compositeScore ?? (data.scores && data.scores.composite) ?? 0,
        vendor: data.vendor,
        dueDate: data.latestDate?.toDate?.()?.toISOString?.() || null,
      };
    })
    .sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0))
    .slice(0, 30);

  const today = new Date().toISOString().split('T')[0];
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

  return {
    // GL cash balance is the source of truth; fall back to spend-plan opening.
    cashPosition: cashPos?.balanceMinor ?? plan?.openingBankBalance ?? 0,
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
