/**
 * Write handlers (ZeusOS) — the small, draftable + alert + KPI surface the
 * first wave of agents needs. Each returns { result, summary }; the dispatcher
 * owns the audit + the autoActMode gate (so create_task / draft_message are
 * the only writes a draft_only agent reaches).
 */
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRATEGY_COMPANY_ID = 'zeus-group';

function nowIso() {
  return new Date().toISOString();
}

/** Deterministic id from a dedupeKey so re-runs don't duplicate. */
function idFrom(prefix, agentId, dedupeKey) {
  const key = String(dedupeKey || Date.now());
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return `${prefix}_${agentId}_${safe}`;
}

// ── write.create_task → generated_tasks ──────────────────────────────────────
async function handleCreateTask(input, context) {
  const { agentId } = context;
  const id = idFrom('agent', agentId, input.dedupeKey || input.title);
  const ref = db.collection('generated_tasks').doc(id);
  const doc = {
    id,
    title: input.title,
    description: input.description,
    priority: input.priority || 'P2',
    status: 'pending',
    dueAt: input.dueAt || null,
    assignedToUserId: input.assignedToUserId || null,
    masterJobId: input.masterJobId || null,
    iwoId: input.iwoId || null,
    brandId: input.brandId || null,
    sourceModule: input.sourceModule || 'agents',
    source: 'agent',
    sourceAgentId: agentId,
    history: [{ fromStatus: null, toStatus: 'pending', actorUserId: `agent:${agentId}`, notes: 'drafted by agent', occurredAt: nowIso() }],
    idempotencyKey: id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc, { merge: true });
  return { result: { id }, summary: `Drafted task "${input.title}" (${id})` };
}

// ── write.draft_message → messageDrafts ──────────────────────────────────────
async function handleDraftMessage(input, context) {
  const { agentId } = context;
  const id = idFrom('agentmsg', agentId, input.dedupeKey || input.body.slice(0, 40));
  const ref = db.collection('messageDrafts').doc(id);
  const doc = {
    id,
    channel: input.channel,
    to: input.to || null,
    subject: input.subject || null,
    body: input.body,
    clientId: input.clientId || null,
    masterJobId: input.masterJobId || null,
    status: 'draft',
    source: 'agent',
    sourceAgentId: agentId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(doc, { merge: true });
  return { result: { id }, summary: `Drafted ${input.channel} message (${id})` };
}

// ── write.create_alert → agent_alerts ────────────────────────────────────────
async function handleCreateAlert(input, context) {
  const { agentId } = context;
  const id = idFrom('alert', agentId, input.dedupeKey || `${input.entityType}:${input.entityId}`);
  const ref = db.collection('agent_alerts').doc(id);
  const doc = {
    id,
    agentId,
    severity: input.severity,
    message: input.message,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    brandId: input.brandId || null,
    value: typeof input.value === 'number' ? input.value : null,
    threshold: typeof input.threshold === 'number' ? input.threshold : null,
    acknowledged: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(doc, { merge: true });
  return { result: { id }, summary: `Raised ${input.severity} alert (${id})` };
}

async function handleAcknowledgeAlert(input, context) {
  const ref = db.collection('agent_alerts').doc(input.alertId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Alert ${input.alertId} not found`);
  await ref.update({
    acknowledged: true,
    acknowledgedBy: `agent:${context.agentId}`,
    acknowledgedNote: input.note || null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { result: { id: input.alertId }, summary: `Acknowledged alert ${input.alertId}` };
}

// ── write.create_kpi_measurement → companies/{cid}/kpis/{id}/dataPoints ───────
async function handleCreateKpiMeasurement(input, context) {
  const companyId = input.companyId || STRATEGY_COMPANY_ID;
  const kpiRef = db.collection('companies').doc(companyId).collection('kpis').doc(input.kpiId);
  const kpiSnap = await kpiRef.get();
  if (!kpiSnap.exists) throw new Error(`KPI ${input.kpiId} not found under ${companyId}`);
  const dpRef = kpiRef.collection('dataPoints').doc();
  await dpRef.set({
    id: dpRef.id,
    value: input.value,
    note: input.note || null,
    date: input.date || nowIso(),
    source: 'agent',
    sourceAgentId: context.agentId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await kpiRef.update({ currentValue: input.value, updatedAt: FieldValue.serverTimestamp() });
  return { result: { id: dpRef.id, kpiId: input.kpiId }, summary: `Logged KPI ${input.kpiId} = ${input.value}` };
}

module.exports = {
  handleCreateTask,
  handleDraftMessage,
  handleCreateAlert,
  handleAcknowledgeAlert,
  handleCreateKpiMeasurement,
};
