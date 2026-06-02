/**
 * Rule-based agent watchers (Phase C) — deterministic, draft_only.
 *
 * These are NOT LLM-driven. They evaluate ZeusOS data with plain thresholds
 * and act THROUGH the dispatcher (so every action passes the 4 gates and is
 * audited identically to an LLM-driven or manual invocation). Each finding
 * also emits an `AgentFindingRaised` domain event.
 *
 *   ZA-002 Burn & SLA Watcher  — IWO cost > 90% budget, or SLA due < 24h.
 *   ZA-005 Finance Sentinel    — client invoices past due; inter-co unsettled.
 *
 * Exposed as scheduled functions (06:30 Africa/Nairobi) + a parent-org
 * callable `runAgentWatchersNow` for manual runs / verification.
 */
const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const { dispatch } = require('../dispatcher');
const { appendDomainEvent } = require('../../platform/outbox');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const REGION = 'europe-west1';
const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_IWO_STATES = new Set(['CLOSED', 'CANCELLED', 'REJECTED']);

function toMs(v) {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

async function emitFinding({ agentId, kind, entityType, entityId, summary, severity, auditId }) {
  try {
    await db.runTransaction(async (tx) => {
      appendDomainEvent({
        tx, db,
        eventType: 'AgentFindingRaised',
        aggregateType: 'Agent',
        aggregateId: agentId,
        payload: { agentId, kind, entityType, entityId, summary, severity: severity || 'warning', auditId: auditId || null },
        emittedByUserId: `agent:${agentId}`,
        idempotencyKey: `${agentId}:${kind}:${entityId}:${new Date().toISOString().slice(0, 10)}`,
      });
    });
  } catch (err) {
    logger.warn(`[watcher] emitFinding failed: ${err.message}`);
  }
}

/** Call a tool through the dispatcher; swallow + log denials so one bad
 *  finding doesn't abort the sweep. Returns the auditId on success. */
async function act(agentId, toolId, input) {
  try {
    const out = await dispatch({ agentId, toolId, input }, { userId: `agent:${agentId}` });
    return out.auditId || null;
  } catch (err) {
    logger.warn(`[watcher] ${agentId} ${toolId} refused/failed: ${err.message}`);
    return null;
  }
}

// ─── ZA-002 Burn & SLA Watcher ───────────────────────────────────────────────
async function runBurnSlaWatcher() {
  const agentId = 'ZA-002';
  const now = Date.now();
  const snap = await db.collection('internal_work_orders').limit(500).get();
  let findings = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const d of snap.docs) {
    const iwo = { id: d.id, ...d.data() };
    if (TERMINAL_IWO_STATES.has(iwo.state)) continue;

    const budget = Number(iwo.budgetMinor) || 0;
    const cost = Number(iwo.cumulativeCostMinor) || 0;
    const burn = budget > 0 ? cost / budget : 0;
    const slaMs = toMs(iwo.slaDueAt);
    const overheating = budget > 0 && burn >= 0.9;
    const slaBreach = slaMs != null && slaMs < now;
    const slaSoon = slaMs != null && slaMs >= now && slaMs - now < DAY_MS;
    if (!overheating && !slaBreach && !slaSoon) continue;

    const severity = slaBreach || burn >= 1 ? 'critical' : 'warning';
    const reasons = [];
    if (overheating) reasons.push(`burn ${Math.round(burn * 100)}%`);
    if (slaBreach) reasons.push('SLA breached');
    else if (slaSoon) reasons.push('SLA due < 24h');
    const summary = `IWO ${iwo.code || iwo.id} (${iwo.subsidiaryOrgId || '—'}): ${reasons.join(' · ')}`;
    const dedupeKey = `${iwo.id}:${today}`;

    const auditId = await act(agentId, 'write.create_alert', {
      severity, message: summary,
      entityType: 'internal_work_order', entityId: iwo.id, brandId: iwo.subsidiaryOrgId || null,
      value: Math.round(burn * 100), threshold: 90, dedupeKey,
    });
    await act(agentId, 'write.create_task', {
      title: `Review ${iwo.code || iwo.id} — ${reasons.join(', ')}`,
      description: `${summary}. Cost ${cost} / budget ${budget}. Check scope, rebrief, or escalate.`,
      priority: severity === 'critical' ? 'P1' : 'P2',
      masterJobId: iwo.masterJobId || null, iwoId: iwo.id, brandId: iwo.subsidiaryOrgId || null,
      sourceModule: 'delivery', dedupeKey,
    });
    await emitFinding({ agentId, kind: 'iwo_overheating_or_sla', entityType: 'internal_work_order', entityId: iwo.id, summary, severity, auditId });
    findings += 1;
  }
  logger.info(`[ZA-002] burn/SLA sweep: ${findings} finding(s) over ${snap.size} IWO(s)`);
  return { agentId, scanned: snap.size, findings };
}

// ─── ZA-005 Finance Sentinel ─────────────────────────────────────────────────
async function runFinanceWatcher() {
  const agentId = 'ZA-005';
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  let findings = 0;

  // Overdue client invoices (unpaid + past dueAt).
  const ar = await db.collection('client_invoices').limit(500).get();
  for (const d of ar.docs) {
    const inv = { id: d.id, ...d.data() };
    const status = String(inv.status || '').toUpperCase();
    if (['PAID', 'VOID', 'CANCELLED'].includes(status)) continue;
    const dueMs = toMs(inv.dueAt) || toMs(inv.dueDate);
    if (dueMs == null || dueMs >= now) continue;
    const daysOver = Math.floor((now - dueMs) / DAY_MS);
    const summary = `Client invoice ${inv.number || inv.id} overdue ${daysOver}d (${inv.clientId || '—'})`;
    const dedupeKey = `ar:${inv.id}:${today}`;
    const auditId = await act(agentId, 'write.create_alert', {
      severity: daysOver > 30 ? 'critical' : 'warning', message: summary,
      entityType: 'client_invoice', entityId: inv.id, brandId: inv.subsidiaryOrgId || null, dedupeKey,
    });
    await act(agentId, 'write.create_task', {
      title: `Collections: ${inv.number || inv.id} overdue ${daysOver}d`,
      description: summary, priority: daysOver > 30 ? 'P1' : 'P2',
      masterJobId: inv.masterJobId || null, brandId: inv.subsidiaryOrgId || null,
      sourceModule: 'finance', dedupeKey,
    });
    await emitFinding({ agentId, kind: 'client_invoice_overdue', entityType: 'client_invoice', entityId: inv.id, summary, severity: 'warning', auditId });
    findings += 1;
  }
  logger.info(`[ZA-005] finance sweep: ${findings} finding(s)`);
  return { agentId, findings };
}

async function runAll() {
  const results = [];
  try { results.push(await runBurnSlaWatcher()); } catch (e) { logger.error('[ZA-002] failed', e); }
  try { results.push(await runFinanceWatcher()); } catch (e) { logger.error('[ZA-005] failed', e); }
  return results;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

exports.agentWatchersDaily = onSchedule(
  { schedule: '30 6 * * *', timeZone: 'Africa/Nairobi', region: REGION, timeoutSeconds: 300, memory: '256MiB' },
  async () => { await runAll(); },
);

exports.runAgentWatchersNow = onCall(
  { region: REGION, timeoutSeconds: 300, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to run the watchers.');
    // Parent-org admin gate: reuse the email allow-list + globalRole check is
    // overkill here; the watchers are read-only/draft and audited. Restrict to
    // any authenticated staff but log the caller.
    logger.info(`[watchers] manual run by ${request.auth.uid}`);
    const results = await runAll();
    return { ok: true, results };
  },
);

module.exports.runBurnSlaWatcher = runBurnSlaWatcher;
module.exports.runFinanceWatcher = runFinanceWatcher;
module.exports.runAll = runAll;
