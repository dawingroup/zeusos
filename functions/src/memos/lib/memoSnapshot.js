/**
 * The issued snapshot and its content hash.
 *
 * The snapshot is what was issued — header, sections, links, attachments,
 * distribution, amount — frozen on the head document so one read renders the
 * memo as issued; the rules refuse every later change to it. The hash is a
 * SHA-256 of the canonical (key-sorted, null-free) JSON so a reader can check
 * that the PDF on file matches the record.
 */
const { createHash } = require('node:crypto');

function canonicalJson(value) {
  const norm = (v) => {
    if (v === undefined) return null;
    if (v === null || typeof v !== 'object') return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v.toMillis === 'function') return new Date(v.toMillis()).toISOString();
    if (Array.isArray(v)) return v.map(norm);
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const inner = norm(v[k]);
      if (inner !== null) out[k] = inner;
    }
    return out;
  };
  return JSON.stringify(norm(value));
}

function memoContentHash(content) {
  return createHash('sha256').update(canonicalJson({
    memoNumber: content.memoNumber,
    version: content.version,
    header: content.header,
    sections: (content.sections || []).filter((s) => s && s.enabled !== false),
    links: content.links || [],
    attachments: (content.attachments || []).map((a) => ({ id: a.id, name: a.name, storagePath: a.storagePath || a.url })),
    distribution: content.distribution || [],
    amountMinor: content.amountMinor == null ? null : Number(content.amountMinor),
    currency: content.currency || null,
  })).digest('hex');
}

function buildIssuedSnapshot(memo, { issuedAt, issuedBy }) {
  if (!memo.memoNumber) throw new Error('A memo cannot be issued without a memo number');
  const snapshot = {
    memoNumber: memo.memoNumber,
    version: memo.version || 1,
    header: memo.header,
    sections: memo.sections || [],
    links: memo.links || [],
    attachments: memo.attachments || [],
    distribution: memo.distribution || [],
    contentHash: memoContentHash(memo),
    issuedAt,
    issuedBy,
  };
  if (memo.amountMinor != null) snapshot.amountMinor = Number(memo.amountMinor);
  if (memo.currency) snapshot.currency = memo.currency;
  return snapshot;
}

module.exports = { canonicalJson, memoContentHash, buildIssuedSnapshot };
