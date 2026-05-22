/**
 * Handoff-packet validator — spec §7.3.
 *
 * A work order MAY NOT transition DRAFT → ISSUED unless the attached
 * handoff packet is complete and valid against the parent SOW window.
 *
 * Required fields:
 *   - brief_md            non-empty string
 *   - milestones          ≥1 milestone, each with `dueDate` inside the SOW window
 *   - acceptance_criteria ≥1 entry with `required: true`
 *   - comms_owner_user_id resolves to a PARENT-org user (spec §7.4 — the
 *                         subsidiary can NEVER become client's comms owner)
 *
 * Validation is non-throwing in the pure module — it returns an
 * `{ ok, errors[] }` object. The Cloud Function turns a non-empty
 * `errors[]` into HttpsError('failed-precondition', 'HANDOFF_PACKET_INCOMPLETE').
 *
 * Spec hard rule (§9.1): HANDOFF_PACKET_INCOMPLETE is a 422 — bring back
 * mapped to `failed-precondition` for Firebase Callable.
 */

// Lazy-loaded to keep the synchronous validator importable without
// firebase-functions (and therefore unit-testable from node:test).
let _isParentOrgUserImpl = null;
function isParentOrgUser(userId) {
  if (!_isParentOrgUserImpl) {
    _isParentOrgUserImpl = require('../lib/auth').isParentOrgUser;
  }
  return _isParentOrgUserImpl(userId);
}
/** Test seam — swap the parent-org lookup. Tests pass an in-memory map. */
function __setParentOrgUserResolver(impl) {
  _isParentOrgUserImpl = impl;
}

/**
 * Pure synchronous validator — input shape:
 *   packet: { briefMd, milestones[], acceptanceCriteria[], commsOwnerUserId, clientContextMd? }
 *   iwo: { budgetMinor }
 *   sow: { startDate?, endDate? } — both as Date | Timestamp | ISO string
 *
 * The async wrapper `validateHandoffPacket` adds the Firestore lookup for
 * `commsOwnerUserId` ∈ parent-org.
 */
function validateHandoffPacketSync({ packet, iwo, sow }) {
  const errors = [];
  if (!packet || typeof packet !== 'object') {
    return { ok: false, errors: ['packet is missing.'] };
  }

  // brief_md
  if (!packet.briefMd || typeof packet.briefMd !== 'string' || packet.briefMd.trim().length === 0) {
    errors.push('briefMd is required and must be a non-empty string.');
  }

  // milestones
  if (!Array.isArray(packet.milestones) || packet.milestones.length === 0) {
    errors.push('milestones[] must contain ≥1 entry.');
  } else {
    const sowStart = toEpochMs(sow && sow.startDate);
    const sowEnd = toEpochMs(sow && sow.endDate);
    packet.milestones.forEach((m, idx) => {
      if (!m || typeof m !== 'object') {
        errors.push(`milestones[${idx}] must be an object.`);
        return;
      }
      if (!m.name || typeof m.name !== 'string') {
        errors.push(`milestones[${idx}].name is required.`);
      }
      const dueMs = toEpochMs(m.dueDate);
      if (dueMs === null) {
        errors.push(`milestones[${idx}].dueDate is required and must be a parseable date.`);
        return;
      }
      // SOW window is optional in input — only enforce if both bounds present.
      if (sowStart !== null && dueMs < sowStart) {
        errors.push(`milestones[${idx}].dueDate (${m.dueDate}) precedes SOW start.`);
      }
      if (sowEnd !== null && dueMs > sowEnd) {
        errors.push(`milestones[${idx}].dueDate (${m.dueDate}) is after SOW end.`);
      }
    });
  }

  // acceptance_criteria — ≥1 required = true
  if (!Array.isArray(packet.acceptanceCriteria) || packet.acceptanceCriteria.length === 0) {
    errors.push('acceptanceCriteria[] must contain ≥1 entry.');
  } else {
    const hasRequired = packet.acceptanceCriteria.some((c) => c && c.required === true);
    if (!hasRequired) {
      errors.push('acceptanceCriteria[] must include at least one criterion with required:true.');
    }
  }

  // comms_owner_user_id — presence; parent-org check is async (see below)
  if (!packet.commsOwnerUserId || typeof packet.commsOwnerUserId !== 'string') {
    errors.push('commsOwnerUserId is required.');
  }

  // client_context_md — must be scrubbed of price/contract terms
  if (packet.clientContextMd && /\b(USD|UGX|KES|EUR|GBP)\s*[\d,.]+|\$[\d,.]+|price|invoice|markup|rate card/i.test(packet.clientContextMd)) {
    errors.push('clientContextMd appears to contain price/contract terms — scrub before issuing.');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Full async validator — runs `validateHandoffPacketSync` then verifies
 * `commsOwnerUserId` ∈ parent-org. Returns the same `{ ok, errors[] }`.
 */
async function validateHandoffPacket({ packet, iwo, sow }) {
  const result = validateHandoffPacketSync({ packet, iwo, sow });
  if (!result.ok) return result;
  // Parent-org check on comms owner.
  if (packet.commsOwnerUserId) {
    const isAm = await isParentOrgUser(packet.commsOwnerUserId);
    if (!isAm) {
      return {
        ok: false,
        errors: [
          `commsOwnerUserId ${packet.commsOwnerUserId} is not a parent-org (Account-Management) user.`,
        ],
      };
    }
  }
  return { ok: true, errors: [] };
}

/** Convert HandoffPacketIncomplete result into a thrown structured error. */
function assertHandoffPacketValid(result) {
  if (!result.ok) {
    const err = new Error(`HANDOFF_PACKET_INCOMPLETE: ${result.errors.join('; ')}`);
    err.code = 'HANDOFF_PACKET_INCOMPLETE';
    err.errors = result.errors;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────

function toEpochMs(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v;
  // Firestore Timestamp
  if (typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? null : parsed;
}

module.exports = {
  validateHandoffPacket,
  validateHandoffPacketSync,
  assertHandoffPacketValid,
  __setParentOrgUserResolver,
};
