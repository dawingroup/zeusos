/**
 * Memo approval tier — who must decide a memo. Three inputs, the MOST SENIOR wins:
 *
 *   band    the amount ladder for `memo_<category>` in systemSettings/
 *           approvalRouting (the same document stream F's supplier-spend
 *           routing reads; a memo module is an ApprovalModuleRoutingV2 whose
 *           bands carry `maxAmountMinor` and `signatures[].approverRole`).
 *           Contributes nothing until an admin adds the module — which is
 *           how it ships.
 *   impact  low → none, medium → manager, high → admin
 *   type    decision / request → manager; directive → admin; information
 *           and record → nobody
 *
 * "Impact can only raise the tier" is structural: the effective role is the
 * most senior of the three. `required: false` is reachable only when every
 * input is null — an information memo with low impact and no amount.
 *
 * The tier sets the seniority the DECIDER should hold; it does not pick the
 * decider — the header does (lib/memoRoute.js). An addressee below the tier
 * is warned about and recorded (`approval.tierMet`), not blocked.
 *
 * PURE (no firebase-admin at module scope). Mirror:
 * src/modules/memos/utils/memoApproval.ts, pinned by memoLockstep.test.ts.
 */

/** GlobalRole, most senior first. */
const ROLE_SENIORITY = Object.freeze(['owner', 'admin', 'manager', 'member', 'viewer']);

function isAtLeastAsSenior(role, minimum) {
  const r = ROLE_SENIORITY.indexOf(role);
  const m = ROLE_SENIORITY.indexOf(minimum);
  if (r < 0 || m < 0) return false;
  return r <= m;
}

/** From `role` up to owner: manager → [manager, admin, owner]. */
function escalationChainFor(role) {
  const i = ROLE_SENIORITY.indexOf(role);
  if (i < 0) return ['manager', 'admin', 'owner'];
  return ROLE_SENIORITY.slice(0, i + 1).reverse();
}

const IMPACT_MINIMUM_ROLE = Object.freeze({ low: null, medium: 'manager', high: 'admin' });
const TYPE_MINIMUM_ROLE = Object.freeze({
  decision: 'manager',
  request: 'manager',
  information: null,
  directive: 'admin',
  record: null,
});
const MEMO_CATEGORIES = Object.freeze(['finance', 'admin', 'operations']);

function memoRoutingEntityType(category) {
  const c = MEMO_CATEGORIES.includes(category) ? category : 'operations';
  return `memo_${c}`;
}

function mostSeniorRole(roles) {
  let best = null;
  let bestIndex = Infinity;
  for (const role of roles) {
    if (!role) continue;
    const index = ROLE_SENIORITY.indexOf(role);
    if (index < 0) continue;
    if (index < bestIndex) {
      bestIndex = index;
      best = role;
    }
  }
  return best;
}

const EMPTY_CONFIG = Object.freeze({ version: 0, modules: {} });

/**
 * The band an amount falls in, from a v2-shaped module. `maxAmountMinor` is an
 * INCLUSIVE upper bound; null = unbounded. The band's role is the most senior
 * signature it asks for. Returns `{ enabled, band, approverRole, currency }`.
 */
function memoBandFor(entityType, amountMinor, config) {
  const mod = config && config.modules && config.modules[entityType];
  if (!mod || mod.enabled !== true || !Array.isArray(mod.bands) || !mod.bands.length) {
    return { enabled: false, band: null, approverRole: null, currency: null };
  }
  const amount = Number(amountMinor) || 0;
  const sorted = [...mod.bands].sort((a, b) => {
    const am = a.maxAmountMinor == null ? Infinity : Number(a.maxAmountMinor);
    const bm = b.maxAmountMinor == null ? Infinity : Number(b.maxAmountMinor);
    return am - bm;
  });
  const band = sorted.find((b) => b.maxAmountMinor == null || amount <= Number(b.maxAmountMinor)) || sorted[sorted.length - 1];
  const roles = Array.isArray(band.signatures) ? band.signatures.map((s) => s && s.approverRole) : [band.approverRole];
  return { enabled: true, band, approverRole: mostSeniorRole(roles), currency: mod.currency || null };
}

/**
 * @param {{type?: string, category?: string, impact?: string, amountMinor?: number, currency?: string}} memo
 * @param {object} [config] `systemSettings/approvalRouting` as loaded; empty = defaults
 */
function resolveMemoApproval(memo, config = EMPTY_CONFIG) {
  const m = memo || {};
  const entityType = memoRoutingEntityType(m.category);
  const amount = Number(m.amountMinor) || 0;
  const band = memoBandFor(entityType, amount, config || EMPTY_CONFIG);
  // The ladder bands the memo's STATED amount; a memo that states none is
  // not a zero-shilling request.
  const hasAmount = amount > 0;
  const bandRole = hasAmount && band.enabled ? band.approverRole : null;
  const impactRole = Object.prototype.hasOwnProperty.call(IMPACT_MINIMUM_ROLE, m.impact) ? IMPACT_MINIMUM_ROLE[m.impact] : null;
  const typeRole = Object.prototype.hasOwnProperty.call(TYPE_MINIMUM_ROLE, m.type) ? TYPE_MINIMUM_ROLE[m.type] : null;

  const effectiveRole = mostSeniorRole([bandRole, impactRole, typeRole]);
  const required = effectiveRole != null;

  let raisedBy = null;
  if (required) {
    if (bandRole === effectiveRole) raisedBy = 'band';
    else if (impactRole === effectiveRole) raisedBy = 'impact';
    else raisedBy = 'type';
  }

  return {
    required,
    entityType,
    bandEnabled: band.enabled === true,
    bandId: hasAmount && band.band ? band.band.id || null : null,
    bandLabel: hasAmount && band.band ? band.band.label || null : null,
    bandRole,
    impactMinimumRole: impactRole,
    typeMinimumRole: typeRole,
    effectiveRole,
    roleChain: required ? escalationChainFor(effectiveRole) : null,
    raisedBy,
    currencyMismatch: Boolean(hasAmount && band.enabled && band.currency && m.currency && band.currency !== m.currency),
  };
}

/** `systemSettings/approvalRouting`, or the empty config. Never throws. */
async function loadMemoRoutingConfig(db) {
  try {
    const snap = await db.doc('systemSettings/approvalRouting').get();
    if (!snap.exists) return EMPTY_CONFIG;
    const data = snap.data() || {};
    return { version: Number(data.version) || 0, modules: data.modules && typeof data.modules === 'object' ? data.modules : {} };
  } catch {
    return EMPTY_CONFIG;
  }
}

module.exports = {
  ROLE_SENIORITY,
  IMPACT_MINIMUM_ROLE,
  TYPE_MINIMUM_ROLE,
  EMPTY_CONFIG,
  isAtLeastAsSenior,
  escalationChainFor,
  mostSeniorRole,
  memoRoutingEntityType,
  memoBandFor,
  resolveMemoApproval,
  loadMemoRoutingConfig,
};
