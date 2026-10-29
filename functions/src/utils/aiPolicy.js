/**
 * AI spend policy — budgets that alert, and a switch that pauses a feature.
 *
 * Deliberately NOT hard caps: a cap that refuses calls mid-month turns a cost
 * problem into an outage. An operator gets a number to watch (the AI usage
 * page), an alert when it crosses a threshold, and a switch they can throw at
 * a named feature or agent.
 *
 * Policy lives in ONE document, `ai_policy/global`, read through a 60-second
 * cache. FAIL-OPEN: a missing or unreadable policy means everything is enabled.
 */

'use strict';

const POLICY_COLLECTION = 'ai_policy';
const POLICY_DOC = 'global';
const POLICY_TTL_MS = 60_000;
const DEFAULT_ALERT_THRESHOLDS = [0.5, 0.8, 1.0];

let cache = { policy: null, expiresAt: 0 };

function resetAiPolicyCache() {
  cache = { policy: null, expiresAt: 0 };
}

/** `HttpsError` when the SDK is present (a callable renders failed-precondition), else a plain Error with the same code. */
function pausedError(message, reason, feature) {
  let err;
  try {
    const { HttpsError } = require('firebase-functions/v2/https');
    err = new HttpsError('failed-precondition', message);
  } catch {
    err = new Error(message);
    err.code = 'failed-precondition';
  }
  err.aiPolicyReason = reason;
  err.aiPolicyFeature = feature;
  return err;
}

function normalizePolicy(data) {
  const d = data && typeof data === 'object' ? data : {};
  const thresholds = Array.isArray(d.alertThresholds) && d.alertThresholds.length
    ? d.alertThresholds.filter((t) => Number.isFinite(Number(t)) && Number(t) > 0).map(Number).sort((a, b) => a - b)
    : DEFAULT_ALERT_THRESHOLDS;
  return {
    monthlyBudgetUsd: Number.isFinite(Number(d.monthlyBudgetUsd)) && d.monthlyBudgetUsd !== null && d.monthlyBudgetUsd !== '' ? Number(d.monthlyBudgetUsd) : null,
    dailyBudgetUsd: Number.isFinite(Number(d.dailyBudgetUsd)) && d.dailyBudgetUsd !== null && d.dailyBudgetUsd !== '' ? Number(d.dailyBudgetUsd) : null,
    alertThresholds: thresholds,
    ugxPerUsd: Number.isFinite(Number(d.ugxPerUsd)) && Number(d.ugxPerUsd) > 0 ? Number(d.ugxPerUsd) : null,
    features: d.features && typeof d.features === 'object' ? d.features : {},
    agents: d.agents && typeof d.agents === 'object' ? d.agents : {},
  };
}

/** The policy in force at most POLICY_TTL_MS ago. Never throws. */
async function getAiPolicy(deps = {}) {
  const now = Date.now();
  if (cache.policy && cache.expiresAt > now) return cache.policy;
  let policy;
  try {
    const db = deps.db || require('firebase-admin').firestore();
    const snap = await db.collection(POLICY_COLLECTION).doc(POLICY_DOC).get();
    policy = normalizePolicy(snap.exists ? snap.data() : {});
  } catch (err) {
    console.warn('[aiPolicy] read failed, treating everything as enabled', err && err.message);
    policy = normalizePolicy({});
  }
  cache = { policy, expiresAt: now + POLICY_TTL_MS };
  return policy;
}

/** A feature is enabled unless explicitly listed with `enabled: false`; likewise an agent. */
async function checkAiFeatureAllowed(feature, { agentId, deps } = {}) {
  const policy = await getAiPolicy(deps);
  const f = policy.features[feature];
  if (f && f.enabled === false) return { allowed: false, reason: 'feature_paused', note: f.note || null };
  if (agentId) {
    const a = policy.agents[agentId];
    if (a && a.enabled === false) return { allowed: false, reason: 'agent_paused', note: a.note || null };
  }
  return { allowed: true, reason: null, note: null };
}

/** Throw (failed-precondition) when a feature or agent is paused. */
async function assertAiFeatureEnabled(feature, { agentId, deps } = {}) {
  const { allowed, reason, note } = await checkAiFeatureAllowed(feature, { agentId, deps });
  if (allowed) return;
  const what = reason === 'agent_paused' ? `Agent ${agentId}` : `The "${feature}" AI feature`;
  throw pausedError(`${what} is paused by an administrator to control AI spend.${note ? ` ${note}` : ''}`, reason, feature);
}

function isAiPausedError(err) {
  return Boolean(err && (err.aiPolicyReason === 'feature_paused' || err.aiPolicyReason === 'agent_paused'));
}

/** Which alert thresholds a spend figure has newly crossed, ascending. */
function thresholdsCrossed(spendUsd, budgetUsd, thresholds, alreadyFired = []) {
  if (!Number.isFinite(Number(budgetUsd)) || Number(budgetUsd) <= 0) return [];
  const fraction = Number(spendUsd) / Number(budgetUsd);
  const fired = new Set((alreadyFired || []).map(Number));
  return (thresholds || DEFAULT_ALERT_THRESHOLDS).filter((t) => fraction >= t && !fired.has(t)).sort((a, b) => a - b);
}

/** `critical` at or over budget, `warning` on the way there. */
function severityForThreshold(threshold) {
  return Number(threshold) >= 1 ? 'critical' : 'warning';
}

module.exports = {
  POLICY_COLLECTION,
  POLICY_DOC,
  POLICY_TTL_MS,
  DEFAULT_ALERT_THRESHOLDS,
  getAiPolicy,
  checkAiFeatureAllowed,
  assertAiFeatureEnabled,
  isAiPausedError,
  thresholdsCrossed,
  severityForThreshold,
  resetAiPolicyCache,
  normalizePolicy,
};
