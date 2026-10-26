/**
 * Memo reference numbers: `MEMO-<SUB>-<YYYY>-<NNN>`, minted at SUBMIT inside
 * the submit transaction from a forward-only counter —
 * `memo_counters/memos_{subsidiaryId}_{year}` — never by counting, never max+1.
 * A resubmit after a return keeps the number and bumps `version`.
 *
 * PURE apart from the transaction it is handed.
 */
const { MEMO_SUBSIDIARY_CODES } = require('./memoModel');

const MEMO_NUMBER_PAD = 3;

function memoSubsidiaryCode(subsidiaryId) {
  return MEMO_SUBSIDIARY_CODES[subsidiaryId] || String(subsidiaryId || 'GRP').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase();
}

/** 'MEMO-ZTA-2026' — everything before the sequence, no trailing dash. */
function memoNumberPrefix(subsidiaryId, year) {
  return `MEMO-${memoSubsidiaryCode(subsidiaryId)}-${year}`;
}

function memoCounterId(subsidiaryId, year) {
  return `memos_${subsidiaryId}_${year}`;
}

function parseMemoNumber(value) {
  const m = String(value || '').match(/^MEMO-([A-Z]{2,4})-(\d{4})-(\d+)$/);
  if (!m) return null;
  return { code: m[1], year: Number(m[2]), sequence: Number(m[3]) };
}

/**
 * Allocate the next number inside `tx`. Reads must precede writes in a
 * Firestore transaction, so call this before any tx.set/update.
 */
async function allocateMemoNumber(tx, db, subsidiaryId, year, nowIso) {
  const ref = db.doc(`memo_counters/${memoCounterId(subsidiaryId, year)}`);
  const snap = await tx.get(ref);
  const current = snap.exists ? Number((snap.data() || {}).next) || 1 : 1;
  const sequence = current;
  tx.set(ref, { next: sequence + 1, prefix: memoNumberPrefix(subsidiaryId, year), updatedAt: nowIso });
  return `${memoNumberPrefix(subsidiaryId, year)}-${String(sequence).padStart(MEMO_NUMBER_PAD, '0')}`;
}

module.exports = { MEMO_NUMBER_PAD, memoSubsidiaryCode, memoNumberPrefix, memoCounterId, parseMemoNumber, allocateMemoNumber };
