/**
 * Human-friendly code generation for Contracts artefacts (MSA, SOW, CO,
 * MasterJob). Codes are not security-critical — they're for the
 * Account-Management UI and emails. Format is `<KIND>-<SLUG>-<YEAR>-<SEQ>`
 * with a 4-char ULID-derived suffix in lieu of a per-year counter (the
 * spec doesn't mandate strict monotonicity).
 */

const { ulid } = require('../../platform/ulid');

function slug(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16) || 'ZEUS';
}

function generateCode(kind, ...segments) {
  const year = new Date().getUTCFullYear();
  const suffix = ulid().slice(-4).toUpperCase();
  const middle = segments.filter(Boolean).map(slug).join('-');
  return middle
    ? `${kind}-${middle}-${year}-${suffix}`
    : `${kind}-${year}-${suffix}`;
}

module.exports = { generateCode, slug };
