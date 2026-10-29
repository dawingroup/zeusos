/**
 * draftMemoSection — "Draft with AI" behind a memo section (Phase 6.G).
 *
 * Drafts ONE section of a DRAFT memo from the memo's own context: its
 * header, what the author has already written in the other sections, the
 * records it links to, and the section's guidance. Returns the text; never
 * saves it. The author reads it in the editor and keeps, edits or drops it.
 *
 * Grounding: the model may only use facts present in the context it is
 * handed and is told to leave a bracketed placeholder for anything it would
 * otherwise have to invent (a figure, a date, a name). A memo is the written
 * basis for a decision; invented facts in it are worse than gaps.
 *
 * Dark until ANTHROPIC_API_KEY is set (Settings → API Keys): the callable
 * then refuses with `failed-precondition` and a sentence the editor can show.
 * `draftSection(db, input, deps)` is the core with the model injected, so the
 * node tests never touch the network.
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const { requireSignedIn, isAdminCaller } = require('../../event-task-engine/lib/callerAuth');
const { MEMOS_COLLECTION } = require('../lib/memoModel');

const REGION = 'europe-west1';
const AGENT_ID = 'ZA-011';
const MAX_LINKS = 8;

const SYSTEM =
  'You draft one section of an internal business memorandum for Zeus Group, an East African marketing consortium ' +
  '(five agency brands: creative, digital, strategy, production, talent). You write plainly and specifically, in the ' +
  'first person plural where the memo speaks for a team. You state only facts that appear in the context you are given. ' +
  'Where the section needs a fact you were not given — a figure, a date, a client, a name — write a bracketed ' +
  'placeholder such as [amount] or [date] rather than inventing one. Respond with the section text only: plain prose, ' +
  'blank lines between paragraphs, "- " for bullets where a list is clearer. No headings, no markdown emphasis, no preamble.';

/** RecordEntityType → collection and the scalar fields worth quoting. */
const LINKED_RECORD_SOURCES = {
  masterJob: { collection: 'master_jobs', fields: ['code', 'title', 'clientName', 'status', 'tier', 'budgetMinor', 'currency'] },
  iwo: { collection: 'internal_work_orders', fields: ['code', 'title', 'state', 'subsidiaryOrgId', 'budgetMinor', 'currency', 'slaDueAt'] },
  client: { collection: 'clients', fields: ['name', 'code', 'primaryBrandId', 'industry'] },
  msa: { collection: 'msas', fields: ['code', 'title', 'status', 'startDate', 'endDate'] },
  sow: { collection: 'sows', fields: ['code', 'title', 'status', 'ceilingMinor', 'currency'] },
  changeOrder: { collection: 'change_orders', fields: ['code', 'title', 'status', 'deltaMinor', 'currency'] },
  quote: { collection: 'quotes', fields: ['code', 'status', 'totalMinor', 'currency'] },
  clientInvoice: { collection: 'client_invoices', fields: ['invoiceNumber', 'status', 'totalMinor', 'currency', 'clientName'] },
  purchaseOrder: { collection: 'purchase_orders', fields: ['poNumber', 'supplierName', 'status', 'amountMinor', 'currency'] },
  supplier: { collection: 'suppliers', fields: ['name', 'category', 'paymentTerms'] },
  employee: { collection: 'employees', fields: ['firstName', 'lastName', 'jobTitle', 'employmentStatus'] },
  mediaPlan: { collection: 'media_plans', fields: ['title', 'code', 'status', 'budgetMinor', 'currency'] },
  productionJob: { collection: 'production_jobs', fields: ['title', 'code', 'status'] },
  talentProfile: { collection: 'talent_profiles', fields: ['name', 'stageName', 'category'] },
  memo: { collection: 'memos', fields: ['memoNumber', 'subject', 'type', 'status', 'amountMinor', 'currency'] },
};

function str(v, max = 2000) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '';
}

// ── pure helpers (unit-tested) ─────────────────────────────────────────────

/** Scalars only, in the declared order; nothing nested, nothing invented. */
function summariseRecord(type, data) {
  const src = LINKED_RECORD_SOURCES[type];
  if (!src || !data) return null;
  const lines = [];
  for (const f of src.fields) {
    const v = data[f];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;
    lines.push(`${f}: ${String(v).slice(0, 200)}`);
  }
  return lines.length ? lines.join('\n') : null;
}

function partyLine(parties) {
  return (Array.isArray(parties) ? parties : [])
    .map((p) => (p && p.name ? (p.title ? `${p.name}, ${p.title}` : p.name) : ''))
    .filter(Boolean)
    .join('; ') || '—';
}

/** The prompt for one section. Pure: memo fields in, string out. */
function buildMemoDraftPrompt({ memo, section, hint, typeHint, instruction, linkedSummaries }) {
  const header = memo.header || {};
  const others = (Array.isArray(memo.sections) ? memo.sections : [])
    .filter((s) => s && s.enabled !== false && s.key !== section.key && String(s.content || '').trim())
    .map((s) => `## ${s.heading}\n${String(s.content).trim()}`)
    .join('\n\n');
  const amountLine = Number(memo.amountMinor) > 0
    ? `${memo.currency || ''} ${Number(memo.amountMinor).toLocaleString('en-US')} (minor units)`
    : 'not stated';
  const links = (linkedSummaries || [])
    .map((l) => `- ${l.label} (${l.relation})${l.summary ? `\n${l.summary.split('\n').map((x) => `    ${x}`).join('\n')}` : ''}`)
    .join('\n');
  const attachments = (Array.isArray(memo.attachments) ? memo.attachments : []).map((a) => `- ${a.name}`).join('\n');
  const current = String(section.content || '').trim();

  return `Draft the "${section.heading}" section of an internal memo.

MEMO
  Type: ${memo.type}${typeHint ? ` — ${typeHint}` : ''}
  Category: ${memo.category}    Impact: ${memo.impact}    Amount: ${amountLine}
  Subject: ${memo.subject}
  To: ${partyLine(header.to)}
  From: ${partyLine([header.from])}
  Through: ${partyLine(header.through)}
  Date: ${header.date || ''}

THIS SECTION IS FOR
  ${hint || 'See the heading.'}

WHAT THE AUTHOR HAS ALREADY WRITTEN IN THE OTHER SECTIONS
${others || '  (nothing yet)'}

RECORDS THIS MEMO LINKS TO — the only external facts you may use
${links || '  (none linked)'}

ATTACHMENTS (names only — you cannot read them)
${attachments || '  (none)'}
${current ? `\nCURRENT TEXT OF THIS SECTION (improve it; keep what is right)\n${current}\n` : ''}${instruction ? `\nINSTRUCTION FROM THE AUTHOR\n${instruction}\n` : ''}
Rules:
- Use only facts in this context. For anything else write a bracketed placeholder, e.g. [client], [KES amount], [date].
- Do not repeat what another section already says; refer to it in a few words if needed.
- Lead with the point. Short paragraphs. A list only where the reader compares things.
- Length: ${section.key === 'purpose' ? 'one or two sentences' : 'between 60 and 220 words'}.`;
}

// ── core ───────────────────────────────────────────────────────────────────

async function loadLinkedSummaries(db, links) {
  const out = [];
  for (const l of (Array.isArray(links) ? links : []).slice(0, MAX_LINKS)) {
    if (!l || !l.type || !l.id || l.type === 'other') {
      if (l && l.label) out.push({ label: l.label, relation: l.relation || 'context', summary: null });
      continue;
    }
    const src = LINKED_RECORD_SOURCES[l.type];
    let summary = null;
    if (src) {
      try {
        const snap = await db.collection(src.collection).doc(l.id).get();
        if (snap.exists) summary = summariseRecord(l.type, snap.data());
      } catch {
        summary = null;
      }
    }
    out.push({ label: l.label || l.id, relation: l.relation || 'context', summary });
  }
  return out;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ memoId: string, sectionKey: string, hint?: string, typeHint?: string, instruction?: string }} input
 * @param {{ auth: {uid:string}, getAnthropic: Function, nowIso?: string, loadUserDoc?: Function }} deps
 */
async function draftSection(db, input, deps) {
  const memoId = str(input && input.memoId, 200);
  const sectionKey = str(input && input.sectionKey, 80);
  if (!memoId || !sectionKey) throw new HttpsError('invalid-argument', 'memoId and sectionKey are required.');

  const snap = await db.collection(MEMOS_COLLECTION).doc(memoId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Memo not found.');
  const memo = snap.data();

  const uid = deps.auth.uid;
  const isAdmin = await isAdminCaller(deps.auth, { loadUserDoc: deps.loadUserDoc || (async (id) => {
    for (const col of ['users', 'organizations/default/users']) {
      const u = await db.collection(col).doc(id).get();
      if (u.exists) return u.data() || {};
    }
    return null;
  }) });
  if (memo.createdBy !== uid && !isAdmin) throw new HttpsError('permission-denied', 'Only the author drafts a memo.');
  if (memo.status !== 'draft') {
    throw new HttpsError('failed-precondition', `A ${memo.status} memo is no longer editable; its content froze when it left draft.`);
  }
  const section = (Array.isArray(memo.sections) ? memo.sections : []).find((s) => s && s.key === sectionKey);
  if (!section) throw new HttpsError('invalid-argument', `Section "${sectionKey}" is not on this memo.`);

  let client; let model;
  try {
    ({ client, model } = await deps.getAnthropic());
  } catch (err) {
    if (err && err.code === 'NOT_CONFIGURED') {
      throw new HttpsError('failed-precondition', 'AI drafting needs an Anthropic key — set ANTHROPIC_API_KEY in Settings → API Keys. You can still write the section by hand.');
    }
    throw err;
  }

  const linkedSummaries = await loadLinkedSummaries(db, memo.links);
  const prompt = buildMemoDraftPrompt({
    memo,
    section,
    hint: str(input.hint, 400),
    typeHint: str(input.typeHint, 300),
    instruction: str(input.instruction, 1000),
    linkedSummaries,
  });

  const response = await client.messages.create({
    model,
    max_tokens: 900,
    temperature: 0.3,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  const content = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!content) throw new HttpsError('internal', 'The model returned an empty draft.');

  try {
    await db.collection('agent_audit_entries').add({
      agentId: AGENT_ID,
      toolId: 'memo.draft_section',
      trigger: 'callable',
      outputSummary: `Drafted the "${section.heading}" section of memo ${memo.memoNumber || memoId}`,
      outcome: 'ok',
      inputSnapshot: { byUid: uid, memoId, sectionKey, instructionChars: str(input.instruction, 1000).length },
      outputSnapshot: { characters: content.length, linkedRecordsUsed: linkedSummaries.filter((l) => l.summary).length },
      errorMessage: null,
      createdAt: deps.nowIso || new Date().toISOString(),
    });
  } catch (_) { /* the audit row is best-effort */ }

  // Returned, never written: the author lands it in the editor and decides.
  return { sectionKey, content, characters: content.length, linkedRecordsUsed: linkedSummaries.filter((l) => l.summary).length, model };
}

const draftMemoSection = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  const auth = requireSignedIn(request, 'draft a memo section with AI');
  if (!admin.apps.length) admin.initializeApp();
  const { getAnthropic } = require('../../ai/_anthropic');
  try {
    return await draftSection(admin.firestore(), request.data, { auth, getAnthropic });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('[draftMemoSection] failed', err);
    throw new HttpsError('internal', (err && err.message) || 'draftMemoSection failed');
  }
});

module.exports = { draftMemoSection, draftSection, buildMemoDraftPrompt, summariseRecord, LINKED_RECORD_SOURCES, SYSTEM };
