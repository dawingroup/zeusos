/**
 * draftTasksWithAi — "Draft with AI" behind the plan editor (Phase 6.E PR 3).
 *
 * The manager writes the INTENT ("get the Safaricom deck to the ECD by
 * Thursday, the invoice out, and brief the photographer") and Claude turns it
 * into 1–5 editable task drafts for the person, aware of what is already on
 * their plate. Drafts go back to the form for human review — this function
 * never writes a task; `createTask` does that after the manager confirms.
 *
 * Dark until ANTHROPIC_API_KEY is set (Settings → API Keys): the callable
 * then refuses with `failed-precondition` and a sentence the UI can show, so
 * the form still works by hand.
 *
 * `draftTasks(db, input, deps)` is the pure-ish core (model injected) so the
 * node tests never touch the network.
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const { TASKS_COLLECTION, ACTIVE_STATUSES, normalisePriority, TASK_KINDS } = require('../lib/taskModel');
const { loadDirectory, resolvePersonUid } = require('../lib/peopleDirectory');
const { requireSignedIn, isPrivileged } = require('../lib/callerAuth');

const REGION = 'europe-west1';
const AGENT_ID = 'ZA-010';
const MAX_DRAFTS = 5;
const MAX_CONTEXT_TASKS = 12;

function str(v, max = 2000) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

function safeJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

/** PURE: the model's answer → clean drafts, or none. */
function normaliseDrafts(parsed, { planDate, maxTasks = MAX_DRAFTS } = {}) {
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const d of parsed) {
    if (!d || typeof d !== 'object') continue;
    const title = str(d.title, 200);
    if (!title) continue;
    const est = Number(d.estimateMinutes);
    out.push({
      title,
      description: str(d.description, 1200) || '',
      priority: normalisePriority(d.priority),
      kind: TASK_KINDS.includes(d.kind) ? d.kind : 'action',
      estimateMinutes: Number.isFinite(est) && est > 0 ? Math.min(480, Math.round(est / 15) * 15 || 15) : 60,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(d.dueDate || '')) ? d.dueDate : planDate || null,
      why: str(d.why, 300) || '',
    });
    if (out.length >= Math.min(maxTasks, MAX_DRAFTS)) break;
  }
  return out;
}

function buildPrompt({ intent, person, planDate, openTasks }) {
  const open = openTasks.slice(0, MAX_CONTEXT_TASKS).map((t) => `- [${t.priority}] ${t.title}${t.dueAt ? ` (due ${String(t.dueAt).slice(0, 10)})` : ''}`).join('\n') || '- (nothing open)';
  return [
    `You draft tasks for ${person.name || 'a colleague'}${person.jobTitle ? `, ${person.jobTitle}` : ''} at Zeus Group, an East African marketing consortium (ZeusOS).`,
    `The manager's intent for ${planDate || 'the next working day'}:`,
    `"""${intent}"""`,
    '',
    'Already on their plate:',
    open,
    '',
    `Return a JSON array of 1 to ${MAX_DRAFTS} tasks, nothing else. Each: {"title": imperative, ≤ 80 chars; "description": 1–3 sentences of what done looks like; "priority": "P0"|"P1"|"P2"|"P3"; "kind": "action"|"review"|"approval"|"followup"; "estimateMinutes": 15–480 in steps of 15; "dueDate": "YYYY-MM-DD" or null; "why": one sentence on what it unblocks}.`,
    'Do not repeat work already on their plate; split the intent into tasks a person can finish in one sitting; never invent clients, amounts or dates the intent did not give.',
  ].join('\n');
}

async function openTasksFor(db, uid) {
  const seen = new Map();
  for (const status of ACTIVE_STATUSES) {
    const snap = await db.collection(TASKS_COLLECTION).where('assignedToUserId', '==', uid).where('status', '==', status).limit(50).get();
    for (const d of snap.docs) seen.set(d.id, { id: d.id, ...d.data() });
  }
  return [...seen.values()];
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ intent: string, assigneeUid?: string, planDate?: string, maxTasks?: number }} input
 * @param {{ auth: {uid:string}, getAnthropic: Function, nowIso?: string, directory?: Map }} deps
 */
async function draftTasks(db, input, deps) {
  const intent = str(input && input.intent, 2000);
  if (!intent) throw new HttpsError('invalid-argument', 'Say what needs to happen — the intent is what the drafts are made from.');
  const planDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.planDate || '')) ? input.planDate : null;
  const uid = deps.auth.uid;

  let assigneeUid = uid;
  if (input.assigneeUid && input.assigneeUid !== uid) {
    const person = await resolvePersonUid(db, str(input.assigneeUid, 200));
    if (!person || !person.uid) throw new HttpsError('invalid-argument', 'assigneeUid must name a person with a ZeusOS login.');
    assigneeUid = person.uid;
  }
  if (assigneeUid !== uid && !(await isPrivileged(deps.auth, deps))) {
    const directory = deps.directory || (await loadDirectory(db, { includeExStaff: true }));
    const rec = directory.get(assigneeUid);
    if (!rec || rec.managerUid !== uid) throw new HttpsError('permission-denied', 'You can draft tasks for yourself or for people who report to you.');
  }

  let client; let model;
  try {
    ({ client, model } = await deps.getAnthropic());
  } catch (err) {
    if (err && err.code === 'NOT_CONFIGURED') {
      throw new HttpsError('failed-precondition', 'AI drafting needs an Anthropic key — set ANTHROPIC_API_KEY in Settings → API Keys. You can still draft the task by hand.');
    }
    throw err;
  }

  const directory = deps.directory || (await loadDirectory(db, { includeExStaff: true }));
  const person = directory.get(assigneeUid) || { name: null };
  const openTasks = await openTasksFor(db, assigneeUid);
  const prompt = buildPrompt({ intent, person, planDate, openTasks });

  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const drafts = normaliseDrafts(safeJson(text), { planDate, maxTasks: input.maxTasks });

  try {
    await db.collection('agent_audit_entries').add({
      agentId: AGENT_ID,
      toolId: 'task.draft_with_ai',
      trigger: 'callable',
      outputSummary: `Drafted ${drafts.length} task(s) for ${person.name || assigneeUid} from the manager's intent`,
      outcome: drafts.length ? 'ok' : 'empty',
      inputSnapshot: { byUid: uid, forUid: assigneeUid, planDate, intentChars: intent.length },
      outputSnapshot: { titles: drafts.map((d) => d.title) },
      errorMessage: null,
      createdAt: deps.nowIso || new Date().toISOString(),
    });
  } catch (_) { /* the audit row is best-effort */ }

  return { drafts, assigneeUid, model };
}

const draftTasksWithAi = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  const auth = requireSignedIn(request, 'draft tasks with AI');
  if (!admin.apps.length) admin.initializeApp();
  const { getAnthropic } = require('../../ai/_anthropic');
  try {
    return await draftTasks(admin.firestore(), request.data, { auth, getAnthropic });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('[draftTasksWithAi] failed', err);
    throw new HttpsError('internal', (err && err.message) || 'draftTasksWithAi failed');
  }
});

module.exports = { draftTasksWithAi, draftTasks, normaliseDrafts, buildPrompt, safeJson, MAX_DRAFTS };
