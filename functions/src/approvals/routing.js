/**
 * Approval routing v2 — purpose × value band × signatures → who signs, in
 * what order. Port of DawinOS `poApprovalRouting.js` + the Phase-2 design
 * (`APPROVAL_ROUTING_PHASE2.md`), reshaped for Zeus Group's supplier spend.
 *
 * WHAT IS ROUTED. One module, `supplier_spend`: money leaving the group to
 * a third party — freelancer (talent) invoices, media-house invoices, and
 * manual vendor purchase orders. Each carries a PURPOSE
 * (`media | production | talent | overhead`) and an amount; the decision is
 * the ordered list of SIGNATURES the record needs before it is approved.
 *
 * THE LADDER (defaults; editable in Settings → Approval routing, stored at
 * `systemSettings/approvalRouting`; amounts in KES minor units):
 *
 *   ≤ KES 100k   delivery lead        — 1 signature (the purpose decides which lead)
 *   ≤ KES 1M     brand MD             — 1 signature
 *   ≤ KES 5M     brand MD + Group CEO — 2 signatures
 *   above        + Group Finance       — 3 signatures
 *
 * A Tier-1 engagement raises the band one step (`tierBandRaise`): the
 * biggest clients' spend gets one more pair of eyes at the same amount.
 *
 * THE INVARIANTS, AND WHY THEY CANNOT BE MISCONFIGURED
 *   1. A band stores only MINIMUM approver roles; the escalation chain is
 *      derived upward from `ROLE_SENIORITY`, so a downward chain is not a
 *      state this module can represent.
 *   2. Authority never decreases as value rises: validateBands refuses a
 *      config where a higher band's level-1 role is more junior, or where
 *      a higher band needs fewer signatures. A purpose rule can make
 *      level 1 MORE senior than the band says, never less.
 *   3. The raiser is never a signer, and no person signs two levels
 *      (`planSignature`). Admins are not exempt — ADR-2026-10-25.
 *   4. A stored config that fails validation is NOT partially applied:
 *      routing falls back to the defaults wholesale.
 *
 * Pure functions only, except `loadApprovalRouting`, which requires
 * `firebase-admin` lazily so the client-side lockstep test can import this
 * file without it. The TypeScript twin is `src/modules/approvals/routing/
 * engine.ts`; `routingLockstep.test.ts` pins the two together.
 */

'use strict';

// GlobalRole, most senior first. The single ordering every seniority
// question in this module is answered from.
const ROLE_SENIORITY = ['owner', 'admin', 'manager', 'member', 'viewer'];

const APPROVAL_ROUTING_DOC = { collection: 'systemSettings', doc: 'approvalRouting' };

const PURPOSES = ['media', 'production', 'talent', 'overhead'];
const SUPPLIER_SPEND = 'supplier_spend';
const AGGREGATE_KINDS = ['supplier_rolling', 'master_job_budget_pct', 'weekly_cash'];

/** KES → minor units (cents). Thresholds below are authored in whole shillings. */
const kesMinor = (amount) => Math.round(amount * 100);

const SIG = (level, label, approverRole) => ({ level, label, approverRole });

const DEFAULT_SUPPLIER_SPEND_BANDS = [
  {
    id: 'lead',
    label: 'Delivery lead',
    maxAmountMinor: kesMinor(100_000),
    signatures: [SIG(1, 'Delivery lead', 'manager')],
  },
  {
    id: 'brand_md',
    label: 'Brand MD',
    maxAmountMinor: kesMinor(1_000_000),
    signatures: [SIG(1, 'Brand MD', 'admin')],
  },
  {
    id: 'group',
    label: 'Brand MD + Group CEO',
    maxAmountMinor: kesMinor(5_000_000),
    signatures: [SIG(1, 'Brand MD', 'admin'), SIG(2, 'Zeus Group CEO', 'owner')],
  },
  {
    id: 'board',
    label: 'Brand MD + Group CEO + Group Finance',
    maxAmountMinor: null,
    signatures: [SIG(1, 'Brand MD', 'admin'), SIG(2, 'Zeus Group CEO', 'owner'), SIG(3, 'Group Finance', 'owner')],
  },
];

// The purpose decides WHICH lead signs at level 1 in the lead band. Above
// it, the band's own level-1 role (admin) is more senior and wins — see
// moreSeniorSignature. Overheads skip the lead: the brand MD signs from
// the first shilling.
const DEFAULT_PURPOSE_RULES = [
  { id: 'media', purpose: 'media', label: 'Media buys', primary: { label: 'Media lead', approverRole: 'manager' } },
  { id: 'production', purpose: 'production', label: 'Production', primary: { label: 'Production lead', approverRole: 'manager' } },
  { id: 'talent', purpose: 'talent', label: 'Talent & freelancers', primary: { label: 'Talent lead', approverRole: 'manager' } },
  { id: 'overhead', purpose: 'overhead', label: 'Overheads & services', primary: { label: 'Brand MD', approverRole: 'admin' } },
];

const DEFAULT_APPROVAL_ROUTING = {
  version: 2,
  modules: {
    [SUPPLIER_SPEND]: {
      entityType: SUPPLIER_SPEND,
      label: 'Supplier spend (talent, media, vendor POs)',
      // Thresholds are compared against the record's own amount with NO FX
      // conversion; this is the currency they were authored in. A record in
      // another currency is routed as-is and flagged `currencyMismatch`.
      currency: 'KES',
      enabled: true,
      bands: DEFAULT_SUPPLIER_SPEND_BANDS,
      purposeRules: DEFAULT_PURPOSE_RULES,
      // Aggregate oversight ships EMPTY: it is data an admin turns on.
      aggregateRules: [],
      // Tier-1 engagements climb one band at the same amount.
      tierBandRaise: { TIER_1: 1, TIER_2: 0, TIER_3: 0 },
      requirePurpose: true,
      forbidSelfApproval: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Seniority
// ---------------------------------------------------------------------------

/**
 * Roles to try, most-specific first, for an approver role: the role itself
 * followed by every more-senior role. Upward-only by construction.
 * Returns null if `role` is not a GlobalRole.
 */
function escalationChainFor(role) {
  const index = ROLE_SENIORITY.indexOf(role);
  if (index < 0) return null;
  return ROLE_SENIORITY.slice(0, index + 1).reverse();
}

/** True when `role` is at least as senior as `minimumRole`. */
function isAtLeastAsSenior(role, minimumRole) {
  const roleIndex = ROLE_SENIORITY.indexOf(role);
  const minIndex = ROLE_SENIORITY.indexOf(minimumRole);
  if (roleIndex < 0 || minIndex < 0) return false;
  return roleIndex <= minIndex; // lower index = more senior
}

/**
 * Level 1 when a band (`a`) and a purpose rule (`b`) both have a say: the
 * purpose names the signer unless the band's floor is STRICTLY more senior.
 * So "Media lead" (manager) beats the lead band's generic "Delivery lead"
 * (manager), and the brand-MD band's admin beats any manager-level purpose.
 */
function moreSeniorSignature(a, b) {
  if (!a) return b;
  if (!b) return a;
  return isAtLeastAsSenior(b.approverRole, a.approverRole) ? b : a;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateSignature(sig, where) {
  const errors = [];
  if (!sig || typeof sig !== 'object') return [`${where}: not an object.`];
  if (!Number.isInteger(sig.level) || sig.level < 1) errors.push(`${where}: level must be a positive integer.`);
  if (!sig.approverRole || ROLE_SENIORITY.indexOf(sig.approverRole) < 0) {
    errors.push(`${where}: '${sig.approverRole}' is not a valid role.`);
  }
  if (sig.approverEmail != null && typeof sig.approverEmail !== 'string') errors.push(`${where}: approverEmail must be a string.`);
  if (sig.roleProfileId != null && typeof sig.roleProfileId !== 'string') errors.push(`${where}: roleProfileId must be a string.`);
  return errors;
}

/**
 * Validate a module's band list. Returns human-readable problems; empty
 * means usable. The admin UI blocks saving on any of these, and the loader
 * rejects a stored config that trips one rather than routing through a
 * broken ladder.
 */
function validateBands(bands) {
  const errors = [];
  if (!Array.isArray(bands) || bands.length === 0) return ['At least one approval band is required.'];

  bands.forEach((band, i) => {
    const where = `Band ${i + 1}${band && band.label ? ` (${band.label})` : ''}`;
    if (!band || typeof band !== 'object') {
      errors.push(`${where}: not an object.`);
      return;
    }
    const isLast = i === bands.length - 1;
    if (isLast) {
      if (band.maxAmountMinor !== null && band.maxAmountMinor !== undefined) {
        errors.push(`${where}: the highest band must be unbounded (no upper limit).`);
      }
    } else if (typeof band.maxAmountMinor !== 'number' || !Number.isFinite(band.maxAmountMinor) || band.maxAmountMinor < 0) {
      errors.push(`${where}: needs a non-negative upper limit.`);
    }
    if (!Array.isArray(band.signatures) || band.signatures.length === 0) {
      errors.push(`${where}: needs at least one signature.`);
      return;
    }
    const levels = band.signatures.map((s) => s && s.level);
    band.signatures.forEach((s, j) => errors.push(...validateSignature(s, `${where}, signature ${j + 1}`)));
    const sorted = [...levels].sort((a, b) => a - b);
    if (sorted.some((l, j) => l !== j + 1)) {
      errors.push(`${where}: signature levels must be 1..${band.signatures.length} with no gaps.`);
    }
  });

  // Thresholds must strictly increase, or a band would be unreachable.
  for (let i = 1; i < bands.length; i += 1) {
    const prev = bands[i - 1];
    const curr = bands[i];
    if (typeof prev.maxAmountMinor === 'number' && typeof curr.maxAmountMinor === 'number' && curr.maxAmountMinor <= prev.maxAmountMinor) {
      errors.push(`Band ${i + 1} (${curr.label || curr.id}): upper limit must be greater than the band below it.`);
    }
  }

  // THE INVARIANT: a more valuable band may never ask less. Level 1 may not
  // get more junior, and the count of signatures may not shrink.
  for (let i = 1; i < bands.length; i += 1) {
    const prev = bands[i - 1];
    const curr = bands[i];
    const prevL1 = level1Of(prev);
    const currL1 = level1Of(curr);
    if (prevL1 && currL1 && !isAtLeastAsSenior(currL1.approverRole, prevL1.approverRole)) {
      errors.push(
        `Band ${i + 1} (${curr.label || curr.id}): level-1 role '${currL1.approverRole}' is more junior than ` +
          `'${prevL1.approverRole}' on the band below it — approval authority cannot decrease as value rises.`,
      );
    }
    if (Array.isArray(prev.signatures) && Array.isArray(curr.signatures) && curr.signatures.length < prev.signatures.length) {
      errors.push(`Band ${i + 1} (${curr.label || curr.id}): needs at least as many signatures as the band below it.`);
    }
  }

  return errors;
}

function level1Of(band) {
  if (!band || !Array.isArray(band.signatures)) return null;
  return band.signatures.find((s) => s && s.level === 1) || null;
}

function validatePurposeRules(rules) {
  if (rules == null) return [];
  if (!Array.isArray(rules)) return ['purposeRules must be a list.'];
  const errors = [];
  const seen = new Set();
  rules.forEach((r, i) => {
    const where = `Purpose rule ${i + 1}${r && r.label ? ` (${r.label})` : ''}`;
    if (!r || typeof r !== 'object') {
      errors.push(`${where}: not an object.`);
      return;
    }
    if (PURPOSES.indexOf(r.purpose) < 0) errors.push(`${where}: '${r.purpose}' is not a purpose (${PURPOSES.join(', ')}).`);
    if (seen.has(r.purpose)) errors.push(`${where}: purpose '${r.purpose}' has more than one rule.`);
    seen.add(r.purpose);
    if (!r.primary || ROLE_SENIORITY.indexOf(r.primary.approverRole) < 0) {
      errors.push(`${where}: primary signer needs a valid role.`);
    }
    if (r.escalateAboveMinor != null && (typeof r.escalateAboveMinor !== 'number' || r.escalateAboveMinor < 0)) {
      errors.push(`${where}: escalateAboveMinor must be a non-negative amount.`);
    }
    if ((r.escalateAboveMinor != null || r.requireAnyLink) && (!r.escalateTo || ROLE_SENIORITY.indexOf(r.escalateTo.approverRole) < 0)) {
      errors.push(`${where}: escalation needs an 'escalateTo' signer with a valid role.`);
    }
    if (r.escalateTo && r.primary && !isAtLeastAsSenior(r.escalateTo.approverRole, r.primary.approverRole)) {
      errors.push(`${where}: 'escalateTo' must be at least as senior as the primary signer.`);
    }
  });
  return errors;
}

function validateAggregateRules(rules) {
  if (rules == null) return [];
  if (!Array.isArray(rules)) return ['aggregateRules must be a list.'];
  const errors = [];
  rules.forEach((r, i) => {
    const where = `Aggregate rule ${i + 1}${r && r.label ? ` (${r.label})` : ''}`;
    if (!r || typeof r !== 'object') {
      errors.push(`${where}: not an object.`);
      return;
    }
    if (AGGREGATE_KINDS.indexOf(r.kind) < 0) errors.push(`${where}: '${r.kind}' is not an aggregate kind.`);
    if (r.kind === 'master_job_budget_pct') {
      if (typeof r.thresholdPct !== 'number' || r.thresholdPct <= 0 || r.thresholdPct > 100) errors.push(`${where}: thresholdPct must be 1–100.`);
    } else if (typeof r.thresholdMinor !== 'number' || r.thresholdMinor < 0) {
      errors.push(`${where}: thresholdMinor must be a non-negative amount.`);
    }
    if (r.kind === 'supplier_rolling' && (!Number.isInteger(r.windowDays) || r.windowDays < 1)) {
      errors.push(`${where}: windowDays must be a positive whole number.`);
    }
    if (!r.adds || ROLE_SENIORITY.indexOf(r.adds.approverRole) < 0) errors.push(`${where}: 'adds' needs a signer with a valid role.`);
  });
  return errors;
}

function validateTierBandRaise(raise) {
  if (raise == null) return [];
  if (typeof raise !== 'object') return ['tierBandRaise must be a map of tier → steps.'];
  return Object.entries(raise)
    .filter(([, steps]) => !Number.isInteger(steps) || steps < 0)
    .map(([tier]) => `tierBandRaise.${tier}: must be a whole number of bands (0 or more).`);
}

function validateModule(module) {
  if (!module || typeof module !== 'object') return ['Module is not an object.'];
  return [
    ...validateBands(module.bands),
    ...validatePurposeRules(module.purposeRules),
    ...validateAggregateRules(module.aggregateRules),
    ...validateTierBandRaise(module.tierBandRaise),
  ];
}

/** Validate a whole config document. Returns { [entityType]: string[] }. */
function validateApprovalRouting(config) {
  const byModule = {};
  const modules = (config && config.modules) || {};
  for (const [entityType, module] of Object.entries(modules)) {
    const errors = validateModule(module);
    if (errors.length) byModule[entityType] = errors;
  }
  return byModule;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

// Cached per warm instance, briefly: approvals route on every signature, so
// re-reading per call is wasteful; an admin who edits the ladder still sees
// it take effect within a minute, without a redeploy.
const CONFIG_TTL_MS = 60_000;
let _configCache = null;
let _configCachedAt = 0;

/** Drop the cached config. Exported for tests. */
function clearApprovalRoutingCache() {
  _configCache = null;
  _configCachedAt = 0;
}

function logConfigProblem(message, context) {
  try {
    const { logger } = require('firebase-functions');
    logger.warn(message, context);
  } catch (_) {
    console.warn(message, context);
  }
}

/**
 * Load the routing config, falling back to DEFAULT_APPROVAL_ROUTING when the
 * document is missing, unreadable, or fails validation. A stored config that
 * fails validation is NOT partially applied.
 *
 * @param {{ now?: number, db?: FirebaseFirestore.Firestore }} [options]
 */
async function loadApprovalRouting(options = {}) {
  const now = options.now || Date.now();
  if (_configCache && now - _configCachedAt < CONFIG_TTL_MS) return _configCache;

  let resolved = DEFAULT_APPROVAL_ROUTING;
  try {
    const db = options.db || require('firebase-admin').firestore();
    const snap = await db.collection(APPROVAL_ROUTING_DOC.collection).doc(APPROVAL_ROUTING_DOC.doc).get();
    if (snap.exists) {
      const stored = snap.data();
      const problems = validateApprovalRouting(stored);
      if (Object.keys(problems).length > 0) {
        logConfigProblem('Stored approval-routing config is invalid; using defaults', { problems });
      } else if (!stored || !stored.modules || Object.keys(stored.modules).length === 0) {
        logConfigProblem('Stored approval-routing config has no modules; using defaults', {});
      } else {
        resolved = stored;
      }
    }
  } catch (err) {
    logConfigProblem('Could not read approval-routing config; using defaults', { error: err && err.message });
  }

  _configCache = resolved;
  _configCachedAt = now;
  return resolved;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** The effective module config: the stored one when enabled, else the default. */
function moduleFor(config, entityType = SUPPLIER_SPEND) {
  const stored = config && config.modules && config.modules[entityType];
  const fallback = DEFAULT_APPROVAL_ROUTING.modules[entityType];
  if (stored && stored.enabled !== false && Array.isArray(stored.bands) && stored.bands.length > 0) return stored;
  return fallback || null;
}

/**
 * The band a value falls into: the first band whose INCLUSIVE maxAmountMinor
 * the amount does not exceed. Returns the index.
 */
function bandIndexForAmount(bands, amountMinor) {
  const value = typeof amountMinor === 'number' && Number.isFinite(amountMinor) ? amountMinor : 0;
  const idx = bands.findIndex((b) => b.maxAmountMinor === null || b.maxAmountMinor === undefined || value <= b.maxAmountMinor);
  return idx < 0 ? bands.length - 1 : idx;
}

function bandForAmount(bands, amountMinor) {
  return bands[bandIndexForAmount(bands, amountMinor)];
}

/** Which purpose a supplier record is for, from what it carries. */
function resolvePurpose(record) {
  const r = record || {};
  if (PURPOSES.indexOf(r.purpose) >= 0) return r.purpose;
  if (PURPOSES.indexOf(r.approvalPurpose) >= 0) return r.approvalPurpose;
  if (r.kind === 'TALENT_FREELANCER') return 'talent';
  if (r.kind === 'MEDIA_SUPPLIER') return 'media';
  if (r.kind === 'VENDOR_OTHER') return r.productionJobId ? 'production' : 'overhead';
  if (r.productionJobId) return 'production';
  if (r.mediaPlanId) return 'media';
  if (r.talentProfileId) return 'talent';
  return null;
}

/** Does an aggregate rule trip for this record, given precomputed aggregates? */
function aggregateTrips(rule, amountMinor, aggregates) {
  const agg = aggregates || {};
  const amount = Number.isFinite(amountMinor) ? amountMinor : 0;
  switch (rule.kind) {
    case 'supplier_rolling':
      return agg.supplierRollingMinor != null && agg.supplierRollingMinor + amount > rule.thresholdMinor;
    case 'weekly_cash':
      return agg.weeklyCashMinor != null && agg.weeklyCashMinor + amount > rule.thresholdMinor;
    case 'master_job_budget_pct':
      // An unbudgeted engagement is exactly the case oversight should see.
      if (agg.masterJobBudgetPct === undefined) return false; // caller did not evaluate
      if (agg.masterJobBudgetPct === null) return true;
      return agg.masterJobBudgetPct >= rule.thresholdPct;
    default:
      return false;
  }
}

const signerKey = (s) => (s.approverEmail ? `email:${String(s.approverEmail).toLowerCase()}` : s.roleProfileId ? `profile:${s.roleProfileId}` : `role:${s.approverRole}:${s.label || ''}`);

/**
 * The full routing decision for one supplier-spend record.
 *
 * @param {{ purpose?: string|null, amountMinor: number, currency?: string, tier?: string,
 *           links?: { masterJobId?: string|null },
 *           aggregates?: { supplierRollingMinor?: number, weeklyCashMinor?: number, masterJobBudgetPct?: number|null } }} input
 * @param {object} [config] from loadApprovalRouting(); defaults apply if omitted
 * @returns {{ enabled: boolean, refusal?: string, band?: object, bandIndex?: number, raisedByTier?: number,
 *             purpose?: string|null, purposeRuleId?: string|null, aggregateRuleIds?: string[],
 *             signatures?: Array<{level:number,label:string,approverRole:string,approverEmail?:string|null,roleProfileId?:string|null,roleChain:string[]}>,
 *             currency?: string, currencyMismatch?: boolean, forbidSelfApproval?: boolean, planVersion?: number }}
 */
function routingDecisionFor(input, config = DEFAULT_APPROVAL_ROUTING) {
  const module = moduleFor(config, SUPPLIER_SPEND);
  if (!module) return { enabled: false };
  const { amountMinor } = input || {};
  const purpose = PURPOSES.indexOf(input && input.purpose) >= 0 ? input.purpose : null;
  if (!purpose && module.requirePurpose) {
    return { enabled: true, refusal: 'purpose_required', purpose: null };
  }

  const bands = module.bands;
  let bandIndex = bandIndexForAmount(bands, amountMinor);
  const raise = (module.tierBandRaise && input && input.tier && Number.isInteger(module.tierBandRaise[input.tier])) ? module.tierBandRaise[input.tier] : 0;
  const raisedByTier = Math.min(bandIndex + raise, bands.length - 1) - bandIndex;
  bandIndex += raisedByTier;
  const band = bands[bandIndex];

  let sigs = band.signatures.map((s) => ({ ...s })).sort((a, b) => a.level - b.level);

  // Purpose rule: who signs level 1 — but only ever MORE senior than the band asks.
  const rule = purpose ? (module.purposeRules || []).find((r) => r.purpose === purpose) : null;
  let purposeRuleId = null;
  if (rule) {
    purposeRuleId = rule.id || rule.purpose;
    let primary = rule.primary;
    const links = (input && input.links) || {};
    if (rule.requireAnyLink && !links.masterJobId) primary = rule.escalateTo || primary;
    if (rule.escalateAboveMinor != null && amountMinor > rule.escalateAboveMinor) primary = rule.escalateTo || primary;
    const bandL1 = sigs[0];
    const winner = moreSeniorSignature({ ...bandL1 }, { level: 1, ...primary });
    sigs[0] = { ...winner, level: 1 };
  }

  // Aggregate oversight: each tripped rule adds a signer (default level 2)
  // unless someone equivalent already signs at or below that level.
  const aggregateRuleIds = [];
  for (const agg of module.aggregateRules || []) {
    if (!aggregateTrips(agg, amountMinor, input && input.aggregates)) continue;
    aggregateRuleIds.push(agg.id || agg.kind);
    const level = (agg.adds && Number.isInteger(agg.adds.level)) ? agg.adds.level : 2;
    const candidate = { level, ...agg.adds };
    const covered = sigs.some((s) => signerKey(s) === signerKey(candidate) && s.level <= level);
    if (!covered) sigs.push(candidate);
  }

  // Dedupe by signer (keep the lowest level), order, renumber 1..n.
  const byKey = new Map();
  for (const s of sigs) {
    const k = signerKey(s);
    const prev = byKey.get(k);
    if (!prev || s.level < prev.level) byKey.set(k, s);
  }
  sigs = [...byKey.values()].sort((a, b) => a.level - b.level).map((s, i) => ({
    level: i + 1,
    label: s.label,
    approverRole: s.approverRole,
    approverEmail: s.approverEmail || null,
    roleProfileId: s.roleProfileId || null,
    roleChain: escalationChainFor(s.approverRole) || escalationChainFor('owner'),
  }));

  const currency = module.currency || null;
  const recordCurrency = input && input.currency ? String(input.currency).toUpperCase() : null;
  return {
    enabled: true,
    band,
    bandIndex,
    raisedByTier,
    purpose,
    purposeRuleId,
    aggregateRuleIds,
    signatures: sigs,
    currency,
    currencyMismatch: !!(currency && recordCurrency && recordCurrency !== String(currency).toUpperCase()),
    forbidSelfApproval: module.forbidSelfApproval !== false,
    planVersion: (config && config.version) || DEFAULT_APPROVAL_ROUTING.version,
  };
}

/**
 * Freeze a decision onto a record as its approval PLAN. A plan is a
 * snapshot: a record submitted under one config keeps its signatures if
 * the config later changes.
 */
function planFromDecision(decision, now) {
  return {
    planVersion: decision.planVersion,
    bandId: decision.band.id,
    purpose: decision.purpose,
    purposeRuleId: decision.purposeRuleId,
    aggregateRuleIds: decision.aggregateRuleIds,
    raisedByTier: decision.raisedByTier,
    currency: decision.currency,
    currencyMismatch: decision.currencyMismatch,
    forbidSelfApproval: decision.forbidSelfApproval,
    pendingLevel: 1,
    signatures: decision.signatures.map((s) => ({
      level: s.level,
      label: s.label,
      approverRole: s.approverRole,
      approverEmail: s.approverEmail || null,
      roleProfileId: s.roleProfileId || null,
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      via: null,
    })),
    plannedAt: now,
  };
}

/**
 * May this caller sign the plan's next pending level? Pure.
 *
 * @param {{ plan: object, caller: { uid: string, role?: string, email?: string|null },
 *           raiserUid?: string|null, pinnedUids?: string[] }} args
 * @returns {{ ok: true, level: number, complete: boolean, via: 'pinned'|'role' }
 *        | { ok: false, code: string, reason: string, requiredRole?: string, level?: number }}
 */
function planSignature({ plan, caller, raiserUid, pinnedUids }) {
  const signatures = (plan && Array.isArray(plan.signatures) ? plan.signatures : []).slice().sort((a, b) => a.level - b.level);
  if (!caller || !caller.uid) return { ok: false, code: 'unauthenticated', reason: 'Sign in first.' };
  const pending = signatures.filter((s) => !s.approvedBy);
  if (pending.length === 0) return { ok: false, code: 'already_complete', reason: 'This record already has every signature it needs.' };
  const next = pending[0];

  if (plan.forbidSelfApproval !== false && raiserUid && caller.uid === raiserUid) {
    return { ok: false, code: 'self_approval', reason: 'You raised this — someone else has to approve it.', level: next.level };
  }
  if (signatures.some((s) => s.approvedBy === caller.uid)) {
    return { ok: false, code: 'already_signed', reason: 'You have already signed this at another level; a different person signs the next one.', level: next.level };
  }

  const email = caller.email ? String(caller.email).toLowerCase() : null;
  const pinnedByEmail = !!(next.approverEmail && email && String(next.approverEmail).toLowerCase() === email);
  const pinnedByProfile = Array.isArray(pinnedUids) && pinnedUids.includes(caller.uid);
  if (pinnedByEmail || pinnedByProfile) {
    return { ok: true, level: next.level, complete: pending.length === 1, via: 'pinned' };
  }
  if (isAtLeastAsSenior(caller.role, next.approverRole)) {
    return { ok: true, level: next.level, complete: pending.length === 1, via: 'role' };
  }
  return {
    ok: false,
    code: 'under_tier',
    reason: `Level ${next.level} (${next.label}) needs ${next.approverRole} approval.`,
    requiredRole: next.approverRole,
    level: next.level,
  };
}

/** The inclusive lower bound of a band, for display. */
function lowerBoundOf(bands, index) {
  if (index === 0) return 0;
  const prev = bands[index - 1] && bands[index - 1].maxAmountMinor;
  return typeof prev === 'number' ? prev : 0;
}

module.exports = {
  ROLE_SENIORITY,
  PURPOSES,
  AGGREGATE_KINDS,
  SUPPLIER_SPEND,
  APPROVAL_ROUTING_DOC,
  DEFAULT_SUPPLIER_SPEND_BANDS,
  DEFAULT_PURPOSE_RULES,
  DEFAULT_APPROVAL_ROUTING,
  kesMinor,
  escalationChainFor,
  isAtLeastAsSenior,
  moreSeniorSignature,
  validateBands,
  validatePurposeRules,
  validateAggregateRules,
  validateTierBandRaise,
  validateModule,
  validateApprovalRouting,
  loadApprovalRouting,
  clearApprovalRoutingCache,
  moduleFor,
  bandIndexForAmount,
  bandForAmount,
  resolvePurpose,
  aggregateTrips,
  routingDecisionFor,
  planFromDecision,
  planSignature,
  lowerBoundOf,
};
