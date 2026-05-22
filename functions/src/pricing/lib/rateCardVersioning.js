/**
 * CommonJS twin of `src/modules/pricing/services/rateCardVersioning.ts`.
 * Behaviour must stay identical; both sides have unit tests.
 */

class RateCardError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = 'RateCardError';
    this.code = code;
  }
}

function nextVersion(existing) {
  if (!existing || !existing.length) return 1;
  return Math.max(...existing.map(c => c.version)) + 1;
}

function assertCanActivate(card) {
  if (card.status !== 'DRAFT') {
    throw new RateCardError('NOT_DRAFT', `Only DRAFT rate cards can be activated (got ${card.status}).`);
  }
}

function assertCanRetire(card) {
  if (card.status !== 'ACTIVE') {
    throw new RateCardError('NOT_ACTIVE', `Only ACTIVE rate cards can be retired (got ${card.status}).`);
  }
}

function autoRetireEffectiveTo(nextEffectiveFrom) {
  const out = new Date(nextEffectiveFrom);
  out.setUTCDate(out.getUTCDate() - 1);
  return out;
}

function planActivation({ candidate, currentActive, effectiveFrom }) {
  assertCanActivate(candidate);
  const plan = {
    toActivate: { id: candidate.id, nextStatus: 'ACTIVE', effectiveFrom },
  };
  if (currentActive) {
    plan.toRetire = {
      id: currentActive.id,
      nextStatus: 'RETIRED',
      effectiveTo: autoRetireEffectiveTo(effectiveFrom),
    };
  }
  return plan;
}

module.exports = {
  RateCardError,
  nextVersion,
  assertCanActivate,
  assertCanRetire,
  autoRetireEffectiveTo,
  planActivation,
};
