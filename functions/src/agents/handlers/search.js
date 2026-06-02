/**
 * Search handlers (ZeusOS) — lightweight substring scans, no external index.
 * Bounded reads + in-memory filtering. RAG over skill docs / memory embeddings
 * is a later phase; knowledge_base currently scans skill-doc names + recent
 * business-memory rows.
 */
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SCAN_LIMIT = 200;

function clampHits(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 10;
  return Math.min(Math.floor(n), 50);
}

function matches(needle, ...fields) {
  const q = String(needle || '').toLowerCase();
  if (q.length < 2) return false;
  return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(q));
}

async function scan(collection, query, hits, pick) {
  const snap = await db.collection(collection).limit(SCAN_LIMIT).get();
  const out = [];
  for (const d of snap.docs) {
    const data = { id: d.id, ...d.data() };
    if (pick(data, query)) out.push(data);
    if (out.length >= hits) break;
  }
  return out;
}

async function handleSearchKnowledgeBase(input, context) {
  const hits = clampHits(input.limit);
  const docs = await db.collection('agentSkillDocs').limit(SCAN_LIMIT).get();
  const skill = docs.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => (context.agent?.skillDocIds || []).includes(d.id) || d.agentId === context.agentId)
    .filter((d) => matches(input.query, d.name))
    .slice(0, hits);
  let memory = [];
  try {
    memory = await scan('ai_memory', input.query, hits, (d, q) => matches(q, d.content, d.summary, d.title));
  } catch { /* ai_memory may be empty / unindexed */ }
  return { result: { skillDocs: skill, memory }, summary: `KB search "${input.query}": ${skill.length} doc(s), ${memory.length} memory hit(s)` };
}

async function handleSearchCrossModule(input, context) {
  const hits = clampHits(input.limit);
  const [jobs, iwos, clients, deals] = await Promise.all([
    scan('master_jobs', input.query, hits, (d, q) => matches(q, d.title, d.name, d.code, d.id)),
    scan('internal_work_orders', input.query, hits, (d, q) => matches(q, d.code, d.id, d.masterJobId)),
    scan('clients', input.query, hits, (d, q) => matches(q, d.name, d.legalName, d.id)),
    scan('crm_deals', input.query, hits, (d, q) => matches(q, d.name, d.title, d.id)),
  ]);
  return { result: { master_jobs: jobs, internal_work_orders: iwos, clients, crm_deals: deals }, summary: `Cross-module "${input.query}": ${jobs.length + iwos.length + clients.length + deals.length} hit(s)` };
}

async function handleSearchDocuments(input) {
  const hits = clampHits(input.limit);
  let reg = [];
  try { reg = await scan('regulatory_changes', input.query, hits, (d, q) => matches(q, d.title, d.summary)); } catch { /* */ }
  return { result: { regulatory_changes: reg }, summary: `Docs "${input.query}": ${reg.length} hit(s)` };
}

async function handleSearchContacts(input) {
  const hits = clampHits(input.limit);
  const employees = await scan('employees', input.query, hits, (d, q) => matches(q, d.name, d.displayName, d.email, d.role));
  return { result: { employees }, summary: `Contacts "${input.query}": ${employees.length} hit(s)` };
}

module.exports = {
  handleSearchKnowledgeBase,
  handleSearchCrossModule,
  handleSearchDocuments,
  handleSearchContacts,
};
