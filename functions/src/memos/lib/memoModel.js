/**
 * Memo vocabulary — ONE copy for the callable, the task sync and the tests.
 * Mirror: src/modules/memos/constants/memoTemplates.ts + memoStatus.ts
 * (pinned by src/modules/memos/__tests__/memoLockstep.test.ts).
 *
 * A memo is a written decision record (DawinOS stream G, ported 2026-10-26):
 *
 *   decision     ask a named authority to decide → signed APPROVE / DECLINE / MODIFY
 *   request      justify a spend, exception or hire → tier from amount × impact × type
 *   information  brief; no decision → distribution only
 *   directive    policy / notice → admin tier, recipients acknowledge
 *   record       memo for record → numbered and filed, no approval
 *
 * PURE: no Firebase imports.
 */

const MEMOS_COLLECTION = 'memos';
const MEMO_TYPES = Object.freeze(['decision', 'request', 'information', 'directive', 'record']);
const MEMO_CATEGORIES = Object.freeze(['finance', 'admin', 'operations']);
const MEMO_IMPACTS = Object.freeze(['low', 'medium', 'high']);
const MEMO_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'rejected', 'modified', 'issued', 'superseded', 'withdrawn']);
const DECISION_OUTCOMES = Object.freeze(['approved', 'rejected', 'modified']);
const LINK_RELATIONS = Object.freeze(['authorises', 'context', 'supersedes']);

/**
 *   draft      → submitted | issued (nothing to clear, nobody to decide) | withdrawn
 *   submitted  → approved | rejected | modified | withdrawn   (rejected also = sent back)
 *   rejected   → draft (version++ on the next submit)
 *   approved   → issued
 *   modified   → issued
 *   issued     → superseded | withdrawn (admin)
 *   superseded, withdrawn: terminal
 *
 * One edge sits outside the table on purpose: a memo that needs NO decision
 * but has Through parties is `submitted` while they clear it and is issued
 * straight from `submitted` once `approval.stage === 'cleared'`.
 */
const MEMO_STATUS_TRANSITIONS = Object.freeze({
  draft: ['submitted', 'issued', 'withdrawn'],
  submitted: ['approved', 'rejected', 'modified', 'withdrawn'],
  rejected: ['draft'],
  approved: ['issued'],
  modified: ['issued'],
  issued: ['superseded', 'withdrawn'],
  superseded: [],
  withdrawn: [],
});

function canTransition(from, to) {
  return Array.isArray(MEMO_STATUS_TRANSITIONS[from]) && MEMO_STATUS_TRANSITIONS[from].includes(to);
}

/** Subsidiary code in the memo number, keyed by the canonical SubsidiaryId. */
const MEMO_SUBSIDIARY_CODES = Object.freeze({
  'zeus-group': 'GRP',
  'zeus-the-agency': 'ZTA',
  'zeus-digital': 'ZDG',
  labyrinth: 'LAB',
  'odd-gorilla': 'OGR',
  'house-of-zeus': 'HOZ',
});

/** Section keys that must carry content before a memo can leave draft, per type. */
const REQUIRED_SECTION_KEYS = Object.freeze({
  decision: ['purpose', 'recommendation'],
  request: ['purpose', 'recommendation'],
  information: ['purpose', 'details'],
  directive: ['purpose', 'policy', 'effective_date'],
  record: ['purpose', 'record'],
});

/** Headings of the required sections still empty or switched off. */
function missingRequiredSections(type, sections) {
  const required = REQUIRED_SECTION_KEYS[type] || [];
  const list = Array.isArray(sections) ? sections : [];
  return required
    .filter((key) => {
      const s = list.find((x) => x && x.key === key);
      return !s || s.enabled === false || !String(s.content || '').trim();
    })
    .map((key) => {
      const s = list.find((x) => x && x.key === key);
      return (s && s.heading) || key;
    });
}

function distributionUidsOf(distribution) {
  const out = [];
  for (const r of Array.isArray(distribution) ? distribution : []) {
    if (r && typeof r.uid === 'string' && r.uid && !out.includes(r.uid)) out.push(r.uid);
  }
  return out;
}

/** A draft that was never submitted: no number, version 0. Deleted, never withdrawn. */
function isUnsubmittedDraft(memo) {
  return Boolean(memo) && memo.status === 'draft' && !memo.memoNumber && !(Number(memo.version) > 0);
}

/** The distribution list plus everyone named in the header — never the author. */
function issueRecipients(memo) {
  const byUid = new Map();
  for (const r of Array.isArray(memo.distribution) ? memo.distribution : []) {
    if (r && r.uid) byUid.set(r.uid, { uid: r.uid, name: r.name || '', requiresAck: r.requiresAck === true, role: r.role || null });
  }
  const header = memo.header || {};
  for (const [list, role] of [['to', 'to'], ['through', 'through'], ['cc', 'cc']]) {
    for (const p of header[list] || []) {
      if (p && p.uid && !byUid.has(p.uid)) byUid.set(p.uid, { uid: p.uid, name: p.name || '', requiresAck: false, role });
    }
  }
  byUid.delete(memo.createdBy);
  return [...byUid.values()];
}

/** `MEMO-ZTA-2026-004: Subject` for task titles. */
function memoLabel(memo) {
  return `${memo.memoNumber || ''}: ${memo.subject || ''}`.replace(/\s+/g, ' ').replace(/^:\s*/, '').trim();
}

module.exports = {
  MEMOS_COLLECTION,
  MEMO_TYPES,
  MEMO_CATEGORIES,
  MEMO_IMPACTS,
  MEMO_STATUSES,
  MEMO_STATUS_TRANSITIONS,
  DECISION_OUTCOMES,
  LINK_RELATIONS,
  MEMO_SUBSIDIARY_CODES,
  REQUIRED_SECTION_KEYS,
  canTransition,
  missingRequiredSections,
  distributionUidsOf,
  isUnsubmittedDraft,
  issueRecipients,
  memoLabel,
};
