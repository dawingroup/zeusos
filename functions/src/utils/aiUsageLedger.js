/**
 * AI usage ledger — one row per model call, priced when it is written
 * (DawinOS stream D port, 2026-10-29).
 *
 * WHY: ZeusOS ran ~40 AI callables, 5 agents and 3 scheduled AI jobs with no
 * cost ledger — the only tokens recorded anywhere were the ones `agentReason`
 * wrote into `agent_audit_entries`. The platform could not answer "where did
 * the money go".
 *
 * The recorder is called from the CLIENT BOUNDARIES (`claudeClient.
 * wrapClientForApiSafety`, which `ai/_anthropic.getAnthropic` and
 * `claudeClient.getClient` both apply, and `geminiClient.getModel`) rather than
 * from every call site. Every path flows through one of those, so instrumenting
 * there covers paths nobody remembered to instrument.
 *
 * Attribution rides an AsyncLocalStorage context (`withAiContext`) that the
 * entry-point wrappers set — `aiCallable.onAiCall` (trigger 'user' + uid),
 * `aiScheduled.onAiSchedule` ('scheduled'), `aiFirestore.onAiDocument*`
 * ('event'). A call with no context still records, labelled with the deployed
 * function's name, so an unattributed row is a smaller failure than a missing
 * one.
 *
 * Writes NEVER throw. A dropped ledger row must not break a working feature.
 * Rows carry `createdAt` as an ISO string (the ZeusOS convention) and
 * `expiresAt` as a Firestore Timestamp for the TTL policy; the daily rollups
 * (`ai-usage/rollupCore.js`) are the long record.
 */

'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { priceUsage, toUgx, providerForModel, DEFAULT_UGX_PER_USD } = require('../config/aiPricing');

const COLLECTION = 'ai_usage_events';

/** Ledger rows expire after this long; the daily rollups keep the history. */
const RETENTION_DAYS = 120;

const storage = new AsyncLocalStorage();

/** Run `fn` with attribution attached to every model call inside it. */
function withAiContext(context, fn) {
  const parent = storage.getStore() || {};
  return storage.run({ ...parent, ...(context || {}) }, fn);
}

/** The active attribution, or an empty object. */
function currentAiContext() {
  return storage.getStore() || {};
}

/**
 * The deployed function's name, in the casing the source declares it:
 * `FUNCTION_TARGET` keeps the exported name's case where `K_SERVICE` (the
 * Cloud Run service) is lowercased; the two are only swapped when they are the
 * same name differing by case.
 */
function deployedFunctionName() {
  const service = process.env.K_SERVICE;
  const target = process.env.FUNCTION_TARGET;
  if (!service) return target || undefined;
  if (target && target !== service && target.toLowerCase() === service.toLowerCase()) return target;
  return service;
}

/** Best-effort feature label: explicit → context → deployed function → 'unattributed'. */
function resolveFeature(explicit) {
  return explicit || currentAiContext().feature || deployedFunctionName() || 'unattributed';
}

/**
 * Classify a thrown provider error into a ledger outcome. Distinguishing a
 * billing block from a prompt-level 400 is what tells the dashboard whether a
 * spike is our fault or the provider's.
 */
function classifyError(err) {
  if (!err) return 'error';
  const status = Number(err.status || err.statusCode || 0);
  const message = String(err.message || err).toLowerCase();
  if (message.includes('credit balance') || message.includes('quota') || message.includes('dunning') || message.includes('permission_denied') || status === 429) return 'billing_blocked';
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 400) return 'bad_request';
  if (status >= 500 || message.includes('overloaded')) return 'provider_unavailable';
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
  return 'error';
}

/** Outcomes that produced no usable answer — the dashboard's "wasted spend". */
const WASTE_OUTCOMES = new Set(['empty', 'parse_failed', 'error', 'refused', 'timeout', 'billing_blocked', 'auth_failed', 'bad_request', 'provider_unavailable']);

function isWasteOutcome(outcome) {
  return WASTE_OUTCOMES.has(outcome);
}

/** Drop undefined / null values — Firestore rejects undefined and null adds nothing. */
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}

/** PURE: the row for one call (no timestamps). Exported so the maths is testable. */
function buildUsageRow(event = {}, ctx = currentAiContext()) {
  const model = event.model || 'unknown';
  const usage = event.usage || {};
  const priced = priceUsage(model, usage);
  const outcome = event.outcome || 'ok';
  return compact({
    provider: event.provider || providerForModel(model),
    model: priced.model || model,
    modelRequested: model,
    feature: resolveFeature(event.feature),
    callSite: event.callSite || ctx.callSite,
    // 'unknown', never 'user': an unset trigger means nobody set a context, and
    // calling that "a user did it" files the platform's own spend under people.
    trigger: event.trigger || ctx.trigger || 'unknown',
    userId: event.userId || ctx.userId || null,
    subsidiaryId: event.subsidiaryId || ctx.subsidiaryId || null,
    agentId: event.agentId || ctx.agentId || null,
    attempt: Number.isFinite(event.attempt) ? event.attempt : 1,
    outcome,
    isWaste: isWasteOutcome(outcome),
    fallbackFrom: event.fallbackFrom || ctx.fallbackFrom || null,
    errorMessage: event.errorMessage ? String(event.errorMessage).slice(0, 300) : null,
    latencyMs: Number.isFinite(event.latencyMs) ? Math.round(event.latencyMs) : null,
    toolCount: Number.isFinite(event.toolCount) ? event.toolCount : null,
    usage: {
      input: Number(usage.input) || 0,
      output: Number(usage.output) || 0,
      cacheRead: Number(usage.cacheRead) || 0,
      cacheWrite: Number(usage.cacheWrite) || 0,
      thoughts: Number(usage.thoughts) || 0,
      searches: Number(usage.searches) || 0,
    },
    costUsd: priced.costUsd,
    costUgx: toUgx(priced.costUsd, event.ugxPerUsd || DEFAULT_UGX_PER_USD),
    priced: priced.priced,
    pricingVersion: priced.pricingVersion,
    promptHash: event.promptHash || null,
  });
}

/**
 * Record one model call.
 *
 * @param {object} event - { model, provider?, feature?, trigger?, outcome?, usage?, latencyMs?, attempt?, errorMessage?, toolCount? }
 * @param {{ db?: object, now?: number, timestampFromMillis?: Function }} [deps] - injected by tests
 * @returns {Promise<object|null>} the written row (without timestamps), or null
 */
async function recordAiUsage(event = {}, deps = {}) {
  try {
    const row = buildUsageRow(event);
    const now = Number.isFinite(deps.now) ? deps.now : Date.now();
    let db = deps.db;
    let expiresAt;
    if (!db) {
      const admin = require('firebase-admin');
      db = admin.firestore();
      expiresAt = admin.firestore.Timestamp.fromMillis(now + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    } else {
      expiresAt = (deps.timestampFromMillis || ((ms) => new Date(ms).toISOString()))(now + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    }
    await db.collection(COLLECTION).add({ ...row, createdAt: new Date(now).toISOString(), expiresAt });
    return row;
  } catch (err) {
    // Never break a working call because bookkeeping failed.
    console.warn('[aiUsageLedger] failed to record usage', err && err.message);
    return null;
  }
}

/** Anthropic reports `input_tokens` EXCLUSIVE of cached tokens — do not sum them into `input`. */
function usageFromAnthropic(response) {
  const u = (response && response.usage) || {};
  const server = u.server_tool_use || {};
  return {
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
    thoughts: 0,
    searches: server.web_search_requests || 0,
  };
}

/** Gemini's `candidatesTokenCount` excludes thinking, billed at the output rate and reported in `thoughtsTokenCount`. */
function usageFromGemini(response) {
  const u = (response && (response.usageMetadata || response.usage_metadata)) || {};
  return {
    input: u.promptTokenCount || 0,
    output: u.candidatesTokenCount || 0,
    cacheRead: u.cachedContentTokenCount || 0,
    cacheWrite: 0,
    thoughts: u.thoughtsTokenCount || 0,
    searches: 0,
  };
}

module.exports = {
  COLLECTION,
  RETENTION_DAYS,
  withAiContext,
  currentAiContext,
  recordAiUsage,
  buildUsageRow,
  resolveFeature,
  classifyError,
  isWasteOutcome,
  WASTE_OUTCOMES,
  usageFromAnthropic,
  usageFromGemini,
};
