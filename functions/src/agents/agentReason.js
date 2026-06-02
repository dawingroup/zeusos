/**
 * agentReason — Phase D: the live Claude tool-use loop for an agent.
 *
 * Claude drives; every tool call is executed through the SAME dispatcher the
 * callable + watchers use, so the 4 gates + audit + autoActMode boundary apply
 * uniformly. The agent's systemPrompt + model + temperature + maxOutputTokens +
 * enabledTools shape the loop; draft_only agents simply can't reach mutating
 * tools (the dispatcher refuses + audits the attempt).
 *
 * The Anthropic key resolves at runtime via the integration-secrets resolver
 * (Settings → API Keys), so enabling AI needs no redeploy.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const { getAnthropic } = require('../ai/_anthropic');
const { dispatch, DispatcherError } = require('./dispatcher');
const { getCatalogForAgent } = require('./toolCatalog');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const MAX_ITERATIONS = 8;
// Map our `<scope>.<noun>` tool ids onto Anthropic's tool-name charset
// (`^[a-zA-Z0-9_-]{1,64}$` — no dots).
const toAnthropicName = (toolId) => toolId.replace(/\./g, '__');

async function loadAgent(agentId) {
  try {
    const snap = await db.collection('agents').doc(agentId).get();
    if (snap.exists) return snap.data();
  } catch (_) { /* fall through */ }
  try {
    const seed = require('../../data/defaultAgents.json');
    return seed.find((a) => a.id === agentId) || null;
  } catch { return null; }
}

/**
 * Run the reasoning loop for an agent.
 * @param {{agentId:string, prompt:string, userId?:string, maxIterations?:number}} args
 */
async function reason({ agentId, prompt, userId, maxIterations = MAX_ITERATIONS }) {
  const agent = await loadAgent(agentId);
  if (!agent) throw new DispatcherError('not-found', `Agent ${agentId} not found`);
  if (agent.status === 'paused') throw new DispatcherError('permission-denied', `Agent ${agentId} is paused`);

  const { client, model } = await getAnthropic(agent.model);

  // Build the Anthropic tools array from the agent's (mode-filtered) catalog.
  const catalog = getCatalogForAgent(agent.enabledTools, agent.autoActMode);
  const nameToToolId = {};
  const tools = catalog.map((t) => {
    const name = toAnthropicName(t.tool_id);
    nameToToolId[name] = t.tool_id;
    return { name, description: t.description, input_schema: t.input_schema };
  });

  const system =
    `${agent.systemPrompt || ''}\n\n` +
    `You are agent ${agent.id} ("${agent.name}") for Zeus Group. Operate strictly within your enabled tools. ` +
    (agent.autoActMode === 'draft_only'
      ? 'You are in DRAFT-ONLY mode: you may read, search, notify, draft messages/tasks, and raise findings, but you cannot mutate live business data. '
      : '') +
    'Use tools to ground every claim in real data. When done, give a concise summary of what you found and what you drafted/raised.';

  const messages = [{ role: 'user', content: prompt || `Run your routine check and report findings.` }];
  const toolCalls = [];
  let iterations = 0;
  let finalText = '';

  while (iterations < maxIterations) {
    iterations += 1;
    const response = await client.messages.create({
      model,
      max_tokens: Math.min(agent.maxOutputTokens || 2048, 4096),
      temperature: typeof agent.temperature === 'number' ? agent.temperature : 0.2,
      system,
      tools,
      messages,
    });

    const toolUseBlocks = (response.content || []).filter((b) => b.type === 'tool_use');
    const textBlocks = (response.content || []).filter((b) => b.type === 'text');
    if (textBlocks.length) finalText = textBlocks.map((b) => b.text).join('\n').trim();

    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) break;

    // Record the assistant turn, then execute each tool call via the dispatcher.
    messages.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of toolUseBlocks) {
      const toolId = nameToToolId[block.name] || block.name.replace(/__/g, '.');
      let resultBlock;
      try {
        const out = await dispatch({ agentId, toolId, input: block.input || {} }, { userId: userId || `agent:${agentId}` });
        toolCalls.push({ toolId, ok: true, auditId: out.auditId, summary: out.summary });
        resultBlock = { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out.result).slice(0, 12000) };
      } catch (err) {
        const msg = err instanceof DispatcherError ? `${err.code}: ${err.message}` : err.message;
        toolCalls.push({ toolId, ok: false, error: msg });
        resultBlock = { type: 'tool_result', tool_use_id: block.id, content: `ERROR: ${msg}`, is_error: true };
      }
      toolResults.push(resultBlock);
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { agentId, model, iterations, finalText, toolCalls };
}

exports.agentReason = onCall(
  { region: 'europe-west1', timeoutSeconds: 300, memory: '512MiB', secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to run an agent.');
    const { agentId, prompt, maxIterations } = request.data || {};
    if (!agentId) throw new HttpsError('invalid-argument', 'agentId is required');
    try {
      return await reason({ agentId, prompt, userId: request.auth.uid, maxIterations });
    } catch (err) {
      if (err && err.code === 'NOT_CONFIGURED') {
        throw new HttpsError('failed-precondition', err.message);
      }
      if (err instanceof DispatcherError) {
        const map = { 'not-found': 'not-found', 'permission-denied': 'permission-denied', 'failed-precondition': 'failed-precondition' };
        throw new HttpsError(map[err.code] || 'internal', err.message);
      }
      logger.error('[agentReason] error', err);
      throw new HttpsError('internal', err.message || 'Agent reasoning failed');
    }
  },
);

module.exports.reason = reason;
