/**
 * Agent tool dispatcher (ported from DawinOS, re-pointed at ZeusOS).
 *
 * Central entry point any caller (HTTPS callable, scheduled watcher, future
 * Claude tool-use loop) uses to invoke a tool on behalf of an agent.
 *
 *   await dispatch({ agentId, toolId, input }, { userId })
 *     1. Load the agent doc from Firestore — fall back to the seed list at
 *        functions/data/defaultAgents.json if the collection is empty.
 *     2. Refuse if paused.
 *     3. Refuse if the tool is not in enabledTools.
 *     4. Validate input against the tool catalog schema.
 *     5. Refuse a write/notify scope when autoActMode === 'draft_only'
 *        (drafts only allow read + search + notify + write.draft_message
 *        + write.create_task).
 *     6. Route to the handler.
 *     7. Write an immutable agentAuditEntries record (even on denial/error).
 *     8. Return { ok, result, auditId, summary }.
 */

const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const { HANDLERS } = require('./handlers');
const { getToolSchema, validateAgainstSchema } = require('./toolCatalog');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Tools a draft_only agent may call. Reads/searches/notifications are fine;
// any mutation landing data in a REAL business collection (invoices, IWOs,
// jobs, KPIs) requires gated/autonomous. The exceptions below are all
// agent-owned, observational outputs — drafts, tasks, and findings/alerts —
// so a watcher can do its whole job (observe → raise finding → draft task)
// without ever touching business data.
const DRAFT_ONLY_ALLOWED_SCOPES = new Set(['read', 'search', 'notify']);
const DRAFT_ONLY_ALLOWED_TOOLS = new Set([
  'write.draft_message',
  'write.create_task',
  'write.create_alert',
  'write.acknowledge_alert',
]);

function scopeFromToolId(toolId) {
  const [scope] = toolId.split('.');
  return scope;
}

async function loadAgent(agentId) {
  try {
    const snap = await db.collection('agents').doc(agentId).get();
    if (snap.exists) return snap.data();
  } catch (err) {
    console.warn(`[agentDispatcher] agents/${agentId} read failed:`, err.message);
  }
  try {
    // eslint-disable-next-line global-require
    const seed = require('../../data/defaultAgents.json');
    return seed.find((a) => a.id === agentId) || null;
  } catch {
    return null;
  }
}

async function writeAudit({
  agentId, toolId, trigger, outputSummary, outcome,
  inputSnapshot, outputSnapshot, errorMessage, confidence, userId,
}) {
  const ref = await db.collection('agentAuditEntries').add({
    agentId,
    toolId: toolId || null,
    trigger,
    outputSummary,
    outcome, // 'ok' | 'error' | 'denied' | 'drafted'
    confidence: typeof confidence === 'number' ? confidence : null,
    inputSnapshot: inputSnapshot || null,
    outputSnapshot: outputSnapshot || null,
    errorMessage: errorMessage || null,
    invokedByUserId: userId || null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

class DispatcherError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'not-found' | 'permission-denied' | 'failed-precondition' | 'internal'
  }
}

async function dispatch({ agentId, toolId, input }, context = {}) {
  if (!agentId || typeof agentId !== 'string') {
    throw new DispatcherError('failed-precondition', 'agentId is required');
  }
  if (!toolId || typeof toolId !== 'string') {
    throw new DispatcherError('failed-precondition', 'toolId is required');
  }

  const agent = await loadAgent(agentId);
  if (!agent) {
    throw new DispatcherError('not-found', `Agent ${agentId} not found in registry`);
  }
  if (agent.status === 'paused') {
    await writeAudit({
      agentId, toolId, trigger: 'dispatcher.denied',
      outputSummary: 'Refused: agent is paused', outcome: 'denied',
      inputSnapshot: { agentStatus: agent.status }, errorMessage: 'agent paused',
      userId: context.userId,
    });
    throw new DispatcherError('permission-denied', `Agent ${agentId} is paused`);
  }

  const allowedTools = Array.isArray(agent.enabledTools) ? agent.enabledTools : [];
  if (!allowedTools.includes(toolId)) {
    await writeAudit({
      agentId, toolId, trigger: 'dispatcher.denied',
      outputSummary: `Refused: ${toolId} not in agent's enabledTools`, outcome: 'denied',
      inputSnapshot: { allowedToolsSample: allowedTools.slice(0, 6) },
      errorMessage: 'tool not enabled for agent', userId: context.userId,
    });
    throw new DispatcherError(
      'permission-denied',
      `Tool ${toolId} is not in agent ${agentId}'s enabledTools`,
    );
  }

  const catalogEntry = getToolSchema(toolId);
  if (catalogEntry) {
    try {
      validateAgainstSchema(input || {}, catalogEntry.input_schema);
    } catch (validationErr) {
      await writeAudit({
        agentId, toolId, trigger: 'dispatcher.denied',
        outputSummary: `Refused: input failed schema validation — ${validationErr.message}`,
        outcome: 'denied', inputSnapshot: input || null,
        errorMessage: validationErr.message, userId: context.userId,
      });
      throw new DispatcherError(
        'failed-precondition',
        `Invalid input for ${toolId}: ${validationErr.message}`,
      );
    }
  }

  const scope = scopeFromToolId(toolId);
  if (
    agent.autoActMode === 'draft_only' &&
    !DRAFT_ONLY_ALLOWED_SCOPES.has(scope) &&
    !DRAFT_ONLY_ALLOWED_TOOLS.has(toolId)
  ) {
    await writeAudit({
      agentId, toolId, trigger: 'dispatcher.denied',
      outputSummary: `Refused: agent autoActMode=draft_only cannot execute ${toolId}`,
      outcome: 'denied', inputSnapshot: { autoActMode: agent.autoActMode, scope },
      errorMessage: 'draft_only agent cannot mutate', userId: context.userId,
    });
    throw new DispatcherError(
      'permission-denied',
      `Agent ${agentId} is in draft_only mode; ${toolId} is not draftable`,
    );
  }

  const handler = HANDLERS[toolId];
  if (!handler) {
    await writeAudit({
      agentId, toolId, trigger: 'dispatcher.no_handler',
      outputSummary: `Refused: no server-side handler for ${toolId}`,
      outcome: 'error', errorMessage: 'no handler registered', userId: context.userId,
    });
    throw new DispatcherError(
      'failed-precondition',
      `Tool ${toolId} has no server-side handler yet`,
    );
  }

  let result;
  let summary;
  try {
    const handlerOutput = await handler(input, {
      agentId,
      userId: context.userId || null,
      agent,
    });
    result = handlerOutput.result ?? handlerOutput;
    summary = handlerOutput.summary || `Executed ${toolId}`;
  } catch (err) {
    const auditId = await writeAudit({
      agentId, toolId, trigger: 'handler.error',
      outputSummary: `Handler failed: ${err.message}`, outcome: 'error',
      inputSnapshot: input || null, errorMessage: err.message, userId: context.userId,
    });
    const wrapped = new DispatcherError('internal', `Handler ${toolId} threw: ${err.message}`);
    wrapped.auditId = auditId;
    throw wrapped;
  }

  const isDraftWrite = scope === 'write' && DRAFT_ONLY_ALLOWED_TOOLS.has(toolId);
  const auditId = await writeAudit({
    agentId, toolId, trigger: 'handler.ok',
    outputSummary: summary, outcome: isDraftWrite ? 'drafted' : 'ok',
    inputSnapshot: input || null,
    outputSnapshot:
      result && typeof result === 'object' ? { id: result.id ?? null, summary } : null,
    userId: context.userId,
  });

  return { ok: true, result, auditId, summary };
}

module.exports = { dispatch, DispatcherError, HANDLERS };
