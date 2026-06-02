/**
 * enrichTaskOnCreate — Phase F (task-engine hardening, domain-agnostic slice).
 *
 * Fires on every new `generated_tasks/{taskId}` (from the event-task engine OR
 * an agent draft) and asks Claude to turn the terse title/description into an
 * actionable brief: a "why this matters + what to do" aiDescription, a short
 * aiChecklist, and an urgency score. Writes them back onto the task; the
 * EmployeeTaskInbox + TaskDetailDialog already render these fields.
 *
 * Dark until ANTHROPIC_API_KEY is set (Settings → API Keys): when no key is
 * configured the trigger logs + no-ops, so task creation is never blocked.
 * The DawinOS construction-specific `computeImpact`/`recomputeImpact` chain is
 * intentionally NOT ported (no supply-chain analog in the marketing domain).
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const { getAnthropic } = require('../ai/_anthropic');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

function safeJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

async function enrich(taskId, task) {
  let client; let model;
  try {
    ({ client, model } = await getAnthropic());
  } catch (err) {
    if (err && err.code === 'NOT_CONFIGURED') {
      logger.info(`[enrichTask] ${taskId}: ANTHROPIC_API_KEY not set — skipping enrichment.`);
      return;
    }
    throw err;
  }

  const context = [
    `Title: ${task.title || ''}`,
    `Description: ${task.description || ''}`,
    `Priority: ${task.priority || 'P2'}`,
    task.sourceModule ? `Module: ${task.sourceModule}` : '',
    task.masterJobId ? `Master job: ${task.masterJobId}` : '',
    task.iwoId ? `IWO: ${task.iwoId}` : '',
    task.brandId ? `Brand: ${task.brandId}` : '',
    task.sourceAgentId ? `Raised by agent: ${task.sourceAgentId}` : '',
  ].filter(Boolean).join('\n');

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system:
      'You turn a terse internal task for Zeus Group (an East African marketing consortium) into an actionable brief. ' +
      'Respond ONLY with JSON: {"aiDescription": "1-2 sentences: why this matters and the outcome", ' +
      '"aiChecklist": [{"title": "...", "description": "...", "isRequired": true}], ' +
      '"aiUrgencyScore": 0-100, "aiUrgencyReason": "short"}. Keep the checklist to 3-5 concrete steps.',
    messages: [{ role: 'user', content: context }],
  });

  const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const parsed = safeJson(text);
  if (!parsed) {
    logger.warn(`[enrichTask] ${taskId}: could not parse model output`);
    await db.collection('generated_tasks').doc(taskId).set(
      { aiEnrichmentError: 'unparseable model output', aiEnrichedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
    return;
  }

  const aiChecklist = Array.isArray(parsed.aiChecklist)
    ? parsed.aiChecklist.slice(0, 6).map((it, i) => ({
        id: `ai-${i}`,
        title: String(it.title || it.text || '').slice(0, 200),
        description: String(it.description || '').slice(0, 400),
        isRequired: it.isRequired !== false,
        order: i + 1,
        completed: false,
      }))
    : [];

  await db.collection('generated_tasks').doc(taskId).set(
    {
      aiDescription: typeof parsed.aiDescription === 'string' ? parsed.aiDescription.slice(0, 600) : null,
      aiChecklist,
      aiUrgencyScore: Number.isFinite(parsed.aiUrgencyScore) ? Math.max(0, Math.min(100, parsed.aiUrgencyScore)) : null,
      aiUrgencyReason: typeof parsed.aiUrgencyReason === 'string' ? parsed.aiUrgencyReason.slice(0, 200) : null,
      aiEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
      aiEnrichmentError: null,
    },
    { merge: true },
  );
  logger.info(`[enrichTask] ${taskId}: enriched (${aiChecklist.length} step(s))`);
}

const enrichTaskOnCreate = onDocumentCreated(
  {
    document: 'generated_tasks/{taskId}',
    region: 'europe-west1',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const task = event.data && event.data.data();
    if (!task) return;
    // Skip if already enriched (idempotent re-fires).
    if (task.aiEnrichedAt) return;
    try {
      await enrich(event.params.taskId, task);
    } catch (err) {
      logger.error(`[enrichTask] ${event.params.taskId} failed:`, err.message);
    }
  },
);

module.exports = { enrichTaskOnCreate };
