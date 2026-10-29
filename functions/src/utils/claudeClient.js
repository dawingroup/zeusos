/**
 * Claude AI client utilities — the ONE boundary every Claude request passes
 * (DawinOS stream D port, 2026-10-29).
 *
 * `getClient(apiKey)` and `ai/_anthropic.getAnthropic()` both hand out a
 * client whose `messages.create` is wrapped (`wrapClientForApiSafety`):
 *   - the request is sanitised (lone UTF-16 surrogates from a `slice()` through
 *     an emoji make the API reject the whole body as invalid JSON);
 *   - the AI policy is checked BEFORE the call, so a paused feature costs
 *     nothing and the avoided spend is recorded;
 *   - the call is RECORDED to the usage ledger (tokens, cost, outcome,
 *     latency) — fire-and-forget, never failing the model call;
 *   - a PROVIDER failure is translated into a sentence the caller can act on
 *     (out of credit, bad key, rate-limited, down); a prompt-level failure is
 *     returned untouched because its detail is the debugging signal.
 *
 * The preset helpers bound a request by what is LEFT of the caller's deadline
 * (`overrides.deadlineMs`) and scale the timeout with `max_tokens`; the retry
 * helper is the one retry policy (the SDK's own retries are switched off
 * under it) and never retries a 400/401 or past the deadline.
 */

const { mapAnthropicError } = require('./aiProviderErrors');

/**
 * Create a fresh, wrapped Anthropic client.
 * @param {string} apiKey - Anthropic API key from Firebase secrets
 */
function getClient(apiKey) {
  if (!apiKey) throw new Error('Anthropic API key not provided');
  // Required here, not at module scope: the SDK is a functions-only dependency
  // and the lockstep tests load this module without it.
  const AnthropicModule = require('@anthropic-ai/sdk');
  const Anthropic = AnthropicModule.default || AnthropicModule;
  return wrapClientForApiSafety(new Anthropic({ apiKey }));
}

// ── the boundary ─────────────────────────────────────────────────────────────

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Strip lone UTF-16 surrogates from every string in a request. */
function sanitizeForApi(value) {
  if (typeof value === 'string') return value.replace(LONE_SURROGATE, '');
  if (Array.isArray(value)) return value.map(sanitizeForApi);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeForApi(v);
    return out;
  }
  return value;
}

/**
 * Refuse the call when an admin has paused this feature or agent. Records a
 * zero-cost `paused` row before throwing: a pause is avoided spend, and the
 * operator who threw the switch should see it working.
 */
async function assertAiCallAllowed(params, deps = {}) {
  const { assertAiFeatureEnabled } = require('./aiPolicy');
  const ledger = require('./aiUsageLedger');
  const ctx = ledger.currentAiContext();
  const feature = ledger.resolveFeature();
  try {
    await assertAiFeatureEnabled(feature, { agentId: ctx.agentId, deps });
  } catch (err) {
    void ledger.recordAiUsage({ provider: 'anthropic', model: (params && params.model) || 'unknown', outcome: 'paused', errorMessage: err.message, usage: {} }, deps);
    throw err;
  }
}

/** One request/response pair → a ledger row. A refusal is recorded as such, not as a success. */
function recordClaudeCall(params, response, error, latencyMs, deps = {}) {
  try {
    const ledger = require('./aiUsageLedger');
    const model = (response && response.model) || (params && params.model) || 'unknown';
    const outcome = error ? ledger.classifyError(error) : response && response.stop_reason === 'refusal' ? 'refused' : 'ok';
    const toolCount = Array.isArray(params && params.tools) ? params.tools.length : null;
    // Not awaited: a slow Firestore write must not add latency to a model call.
    void ledger.recordAiUsage({
      provider: 'anthropic',
      model,
      outcome,
      latencyMs,
      toolCount,
      errorMessage: error ? error.message : null,
      usage: response ? ledger.usageFromAnthropic(response) : {},
    }, deps);
  } catch {
    // A missing ledger must never break a model call.
  }
}

/**
 * `client.messages.create(params, opts)` with `params` sanitised, the policy
 * checked, the call RECORDED and provider failures TRANSLATED; everything
 * else on the client passes through.
 */
function wrapClientForApiSafety(client, deps = {}) {
  const messages = client.messages;
  const create = messages.create.bind(messages);
  const wrapped = Object.create(messages);
  wrapped.create = async (params, ...rest) => {
    const safeParams = sanitizeForApi(params);
    await assertAiCallAllowed(safeParams, deps);
    const started = Date.now();
    try {
      const response = await create(safeParams, ...rest);
      recordClaudeCall(safeParams, response, null, Date.now() - started, deps);
      return response;
    } catch (err) {
      // Book the ORIGINAL error (the provider's own wording); only what leaves here is translated.
      recordClaudeCall(safeParams, null, err, Date.now() - started, deps);
      throw mapAnthropicError(err);
    }
  };
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'messages') return wrapped;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

// ── presets ──────────────────────────────────────────────────────────────────

const MODEL_CONFIGS = {
  // Fast responses, lower cost
  fast: { model: 'claude-sonnet-4-6', max_tokens: 4096, temperature: 0.3 },
  // Balanced for most tasks
  standard: { model: 'claude-sonnet-4-6', max_tokens: 8192, temperature: 0.4 },
  // Complex analysis, longer output
  detailed: { model: 'claude-sonnet-4-6', max_tokens: 16384, temperature: 0.3 },
};

/**
 * How long to wait for ONE non-streaming answer: up to the 4096 default keeps
 * 120 s; larger answers get 40 ms/token, capped at 10 min; a caller's
 * remaining function budget caps that again.
 */
const MIN_REQUEST_TIMEOUT_MS = 30_000;
function answerTimeoutMs(maxTokens) {
  const n = Number(maxTokens) || 4096;
  return n <= 4096 ? 120_000 : Math.min(600_000, n * 40);
}
function requestTimeoutMs(maxTokens, remainingMs = null) {
  const want = answerTimeoutMs(maxTokens);
  if (remainingMs == null) return want;
  return Math.max(MIN_REQUEST_TIMEOUT_MS, Math.min(want, remainingMs));
}

/** What ONE attempt may spend given an absolute deadline (epoch ms, or null). Pure. */
function attemptBudget(deadlineMs, maxTokens, now = Date.now()) {
  if (deadlineMs == null) {
    return { timeoutMs: requestTimeoutMs(maxTokens), remainingMs: null, exhausted: false, canRetry: true };
  }
  const remainingMs = deadlineMs - now;
  const timeoutMs = requestTimeoutMs(maxTokens, remainingMs);
  return { timeoutMs, remainingMs, exhausted: remainingMs < MIN_REQUEST_TIMEOUT_MS, canRetry: remainingMs >= 2 * timeoutMs };
}

/**
 * Create a Claude message with a preset configuration.
 * @param {object} overrides - { model, max_tokens, temperature, deadlineMs, sdkMaxRetries }
 * @returns {Promise<string>} Response text
 */
async function createMessage(apiKey, preset, systemPrompt, userMessage, overrides = {}) {
  const client = getClient(apiKey);
  const config = MODEL_CONFIGS[preset] || MODEL_CONFIGS.fast;

  const budget = attemptBudget(overrides.deadlineMs, overrides.max_tokens || config.max_tokens);
  if (budget.exhausted) {
    const err = new Error(`AI budget exhausted: ${Math.round(budget.remainingMs / 1000)} s left, the answer needs more`);
    err.code = 'deadline-exceeded';
    throw err;
  }
  const requestOptions = { timeout: budget.timeoutMs };
  if (Number.isInteger(overrides.sdkMaxRetries) && overrides.sdkMaxRetries >= 0) requestOptions.maxRetries = overrides.sdkMaxRetries;

  const message = await client.messages.create({
    model: overrides.model || config.model,
    max_tokens: overrides.max_tokens || config.max_tokens,
    temperature: overrides.temperature ?? config.temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  }, requestOptions);

  return message.content[0] && message.content[0].type === 'text' ? message.content[0].text : '';
}

/** Parse JSON from a Claude response (handles markdown code blocks). */
function parseJsonFromResponse(text) {
  let jsonStr = text.trim();
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    const objectMatch = text.match(/\{[\s\S]*\}/);
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (objectMatch) { try { return JSON.parse(objectMatch[0]); } catch { /* fall through */ } }
    if (arrayMatch) { try { return JSON.parse(arrayMatch[0]); } catch { /* fall through */ } }
    throw new Error(`Failed to parse JSON from Claude response: ${error.message}`);
  }
}

/**
 * Create a message with retry on transient failures. This loop IS the retry
 * policy: the SDK's own retries are switched off under it (one transient
 * failure used to cost up to 9 requests). Never retries a 400/401, a
 * deadline, or when another full attempt could not finish inside it.
 */
async function createMessageWithRetry(apiKey, preset, systemPrompt, userMessage, maxRetries = 2, overrides = {}) {
  let lastError;
  const config = MODEL_CONFIGS[preset] || MODEL_CONFIGS.fast;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await createMessage(apiKey, preset, systemPrompt, userMessage, { ...overrides, sdkMaxRetries: 0 });
    } catch (error) {
      lastError = error;
      if (error.status === 401 || error.status === 400 || error.code === 'deadline-exceeded') throw error;
      if (overrides.deadlineMs != null && !attemptBudget(overrides.deadlineMs, overrides.max_tokens || config.max_tokens).canRetry) throw error;
      if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw lastError;
}

// ── tool use ─────────────────────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

/**
 * Run a multi-turn Claude conversation with tool use: send → handle tool_use
 * blocks → feed results → repeat. Every round goes through the wrapped client,
 * so each is recorded.
 */
async function createMessageWithTools(apiKey, options) {
  const { systemPrompt, tools, messages, executeToolCalls, preset = 'standard', onToolUse } = options;
  const client = getClient(apiKey);
  const config = MODEL_CONFIGS[preset] || MODEL_CONFIGS.standard;

  const currentMessages = [...messages];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let toolCallCount = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools,
      messages: currentMessages,
    }, { timeout: answerTimeoutMs(config.max_tokens) });

    if (response.usage) {
      totalInputTokens += response.usage.input_tokens || 0;
      totalOutputTokens += response.usage.output_tokens || 0;
    }
    const textBlock = response.content.find((b) => b.type === 'text');
    if (response.stop_reason === 'end_turn') {
      return { text: textBlock ? textBlock.text : '', usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, toolCallCount };
    }
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) {
      return { text: textBlock ? textBlock.text : '', usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, toolCallCount };
    }
    if (onToolUse) onToolUse(round, toolUseBlocks.map((b) => b.name));
    toolCallCount += toolUseBlocks.length;
    const toolResults = await executeToolCalls(toolUseBlocks);
    currentMessages.push({ role: 'assistant', content: response.content });
    currentMessages.push({ role: 'user', content: toolResults });
  }

  return {
    text: 'I was unable to complete the analysis within the allowed number of tool calls. Please try a more specific question.',
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    toolCallCount,
  };
}

module.exports = {
  getClient,
  wrapClientForApiSafety,
  sanitizeForApi,
  createMessage,
  createMessageWithRetry,
  createMessageWithTools,
  parseJsonFromResponse,
  answerTimeoutMs,
  requestTimeoutMs,
  attemptBudget,
  MODEL_CONFIGS,
  MAX_TOOL_ROUNDS,
  MIN_REQUEST_TIMEOUT_MS,
};
