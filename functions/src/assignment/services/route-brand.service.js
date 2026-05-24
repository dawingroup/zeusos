/**
 * routeBrand — Addendum v1.1 §8 + v1.2 §6.1.
 *
 * Picks a serving brand from candidates with (a) the required
 * capability, (b) no conflict for the account's category, (c)
 * capacity within the tier-derived SLA. Geography preference biases
 * KE-region accounts toward HOUSE_OF_ZEUS.
 *
 * Routing is a **recommendation**, not a commit. Traffic confirms or
 * overrides before `issueWorkOrder` runs. The override path is logged
 * via the `RoutingBrandProposed` outbox event so cycle-time + override
 * analytics can roll up later.
 *
 * Symmetry with EmployeeAssignmentService (v1.2 §2.3 unification box):
 * brand routing and person routing are the same algorithm at two
 * scopes — capability + conflict + capacity + fallback. Once
 * `routeBrand` picks a brand, `resolveAssignment({ type: 'role', ... })`
 * picks a person inside it.
 *
 * Phase 6.B (this PR) substrate:
 *   - Brand-capability registry is hardcoded from the v1.1 profile
 *     (5 sibling brands × their documented capabilities). When the
 *     `brand_capability` collection ships, swap the lookup for a
 *     Firestore read.
 *   - `excludeConflicted` is a no-op stub — the Conflict Sentinel
 *     (ZA-004) + `conflict_wall` collection ship in Phase 6.C.
 *   - `capacityWithin` uses count of open IWOs per brand vs a soft
 *     ceiling from engine_config. Replaced with a richer signal once
 *     the unified inbox lands in 6.E.
 *   - `marginFit` ranking deferred — for now we pick the first
 *     candidate after capacity ranking (most slack first).
 */

const { HttpsError } = require('firebase-functions/v2/https');

/**
 * Brand → declared capabilities, from Addendum v1.1 §2.1.
 *
 *   Zeus The Agency  — Flagship 360°: Creative, BTL, Digital, PR, Media, Production
 *   Zeus Digital     — Digital-led; also full service: Content, SEM/SEO, Influencer, MediaBuy, Innovation
 *   Labyrinth        — Audio & visual content studio: Sound, Photography, Podcast, Film, Documentary
 *   Odd Gorilla      — Conflict agency, full 360° (mirrors Zeus The Agency)
 *   House of Zeus    — Kenya-market 360°
 *
 * Capability tags are lowercase + snake-case; consumers should
 * normalise to the same convention.
 */
const BRAND_CAPABILITIES = {
  'zeus-the-agency': new Set([
    'creative', 'btl', 'digital', 'pr', 'media', 'production',
  ]),
  'zeus-digital': new Set([
    'content', 'sem_seo', 'influencer', 'media_buy', 'innovation',
    'digital', 'creative',
  ]),
  'labyrinth': new Set([
    'sound', 'photography', 'podcast', 'film', 'documentary',
    'production',
  ]),
  'odd-gorilla': new Set([
    'creative', 'btl', 'digital', 'pr', 'media', 'production',
  ]),
  'house-of-zeus': new Set([
    'creative', 'btl', 'digital', 'pr', 'media', 'production',
  ]),
};

const ALL_DELIVERY_BRANDS = Object.keys(BRAND_CAPABILITIES);

/** Soft default; engine_config can override. */
const DEFAULT_BRAND_CAPACITY_THRESHOLD = 20;

/**
 * @typedef {Object} RouteBrandInput
 * @property {string} masterJobId
 * @property {string} requiredCapability   // one of the BRAND_CAPABILITIES tags
 * @property {string} [tier]               // BriefTier (read from masterJob if not passed)
 * @property {string} [accountRegion]      // 'UG' | 'KE' | etc. (drives geography preference)
 * @property {string} [accountCategory]    // for conflict-firewall check (6.C)
 * @property {string} [accountId]
 *
 * @typedef {Object} BrandCandidate
 * @property {string} brandId
 * @property {boolean} hasCapability
 * @property {boolean} conflicted
 * @property {number} openIwoCount
 * @property {number} availability
 * @property {string|null} rejectionReason
 *
 * @typedef {Object} RouteBrandResult
 * @property {string|null} proposedBrandId
 * @property {string|null} reasonNoCandidate     // 'NO_ELIGIBLE_BRAND' if none
 * @property {BrandCandidate[]} candidates
 * @property {string|null} geographyPreferenceApplied
 */

/**
 * Pure-ish runner — accepts an injectable db so unit tests can use the
 * in-memory stub. The onCall wrapper lives next door in routeBrand.js.
 *
 * @param {{ db: FirebaseFirestore.Firestore|Object, input: RouteBrandInput, now?: Date }} args
 * @returns {Promise<RouteBrandResult>}
 */
async function runRouteBrand({ db, input, now = new Date() }) {
  if (!input || typeof input !== 'object') {
    throw new HttpsError('invalid-argument', 'input is required.');
  }
  const {
    masterJobId,
    requiredCapability,
    tier: inputTier,
    accountRegion,
    accountCategory,
    accountId,
  } = input;

  if (!masterJobId || typeof masterJobId !== 'string') {
    throw new HttpsError('invalid-argument', 'input.masterJobId is required.');
  }
  if (!requiredCapability || typeof requiredCapability !== 'string') {
    throw new HttpsError('invalid-argument', 'input.requiredCapability is required.');
  }

  // Resolve tier (input wins; otherwise read from master_job).
  let tier = inputTier;
  if (!tier) {
    const mjSnap = await db.doc(`master_jobs/${masterJobId}`).get();
    if (mjSnap.exists) tier = mjSnap.data().tier;
  }

  // Step 1: candidates = brands that declare the required capability.
  const candidates = ALL_DELIVERY_BRANDS.map((brandId) => ({
    brandId,
    hasCapability: (BRAND_CAPABILITIES[brandId] || new Set()).has(requiredCapability),
    conflicted: false,
    openIwoCount: 0,
    availability: 0,
    rejectionReason: null,
  }));

  for (const c of candidates) {
    if (!c.hasCapability) c.rejectionReason = 'NO_CAPABILITY';
  }

  // Step 2: conflict firewall — Phase 6.C real impl. Queries
  // conflict_walls; mutates candidates in place; emits
  // ConflictExclusivityRisk when any brand is walled.
  await excludeConflicted({ db, candidates, accountId, accountCategory, masterJobId });

  // Step 3: capacity check per brand. Soft signal — counts open IWOs
  // assigned to the brand vs DEFAULT_BRAND_CAPACITY_THRESHOLD (or an
  // engine_config override). Brands over the threshold are not
  // *excluded* — they're ranked lower.
  const threshold = await loadBrandCapacityThreshold({ db });
  for (const c of candidates) {
    if (c.rejectionReason) continue; // already rejected by capability/conflict
    const count = await countOpenIwosForBrand({ db, brandId: c.brandId });
    c.openIwoCount = count;
    c.availability = Math.max(0, threshold - count);
    if (c.availability === 0) c.rejectionReason = 'AT_CAPACITY';
  }

  // Step 4: filter to eligible.
  const eligible = candidates.filter((c) => c.rejectionReason === null);
  if (eligible.length === 0) {
    return {
      proposedBrandId: null,
      reasonNoCandidate: 'NO_ELIGIBLE_BRAND',
      candidates,
      geographyPreferenceApplied: null,
    };
  }

  // Step 5: geography preference (KE → HOUSE_OF_ZEUS).
  let geographyPreferenceApplied = null;
  if (accountRegion === 'KE') {
    const ke = eligible.find((c) => c.brandId === 'house-of-zeus');
    if (ke) {
      geographyPreferenceApplied = 'house-of-zeus';
      // Move HoZ to the front; if it's at capacity it was already
      // filtered out above.
      eligible.sort((a, b) => (b.brandId === 'house-of-zeus' ? 1 : 0) -
                              (a.brandId === 'house-of-zeus' ? 1 : 0));
    }
  }

  // Step 6: rank by availability (most slack first). marginFit ranking
  // deferred — would consume per-brand rate-card markup numbers.
  eligible.sort((a, b) => b.availability - a.availability);

  // Stable: if geography preference was applied, keep HoZ first.
  if (geographyPreferenceApplied === 'house-of-zeus') {
    const hoz = eligible.find((c) => c.brandId === 'house-of-zeus');
    if (hoz) {
      eligible.sort((a, b) => (b.brandId === 'house-of-zeus' ? 1 : 0) -
                              (a.brandId === 'house-of-zeus' ? 1 : 0));
    }
  }

  return {
    proposedBrandId: eligible[0].brandId,
    reasonNoCandidate: null,
    candidates,
    geographyPreferenceApplied,
    tierApplied: tier ?? null,
    nowIso: now.toISOString(),
  };
}

/**
 * Phase 6.C implementation — delegates to functions/src/conflict-firewall/.
 *
 * The real check queries `conflict_walls` for rows where:
 *   servingOrgId == candidate.brandId
 *   categoryId   == accountCategory
 *   clientId     != accountId
 *
 * Mutates the candidates array in place (sets `conflicted: true` and
 * `rejectionReason: 'CONFLICTED'` on each walled candidate). Also
 * emits `ConflictExclusivityRisk` via the outbox when 1+ brands are
 * excluded, so Conflict Sentinel (ZA-004) + reporting see the breach
 * risk live. See excludeConflicted.js for the signature.
 *
 * No-op when `accountCategory` isn't passed — the firewall can only
 * be evaluated when the request declares which category to check.
 */
const { excludeConflicted: realExcludeConflicted } = require('../../conflict-firewall/excludeConflicted');

async function excludeConflicted({ db, candidates, accountId, accountCategory, masterJobId }) {
  await realExcludeConflicted({ db, candidates, accountId, accountCategory, masterJobId });
}

/**
 * Soft capacity ceiling per brand. Reads engine_config.brandCapacityThreshold
 * if present; otherwise falls back to a safe default.
 */
async function loadBrandCapacityThreshold({ db }) {
  const snap = await db.doc('engine_config/global').get();
  if (!snap.exists) return DEFAULT_BRAND_CAPACITY_THRESHOLD;
  const cfg = snap.data();
  return cfg.brandCapacityThreshold || DEFAULT_BRAND_CAPACITY_THRESHOLD;
}

async function countOpenIwosForBrand({ db, brandId }) {
  const OPEN_STATES = ['ISSUED', 'ACCEPTED', 'IN_PROGRESS', 'REVISION_REQUESTED', 'DELIVERED'];
  let count = 0;
  const snap = await db
    .collection('internal_work_orders')
    .where('subsidiaryOrgId', '==', brandId)
    .where('state', 'in', OPEN_STATES)
    .get();
  snap.forEach(() => { count += 1; });
  return count;
}

module.exports = {
  runRouteBrand,
  BRAND_CAPABILITIES,
  ALL_DELIVERY_BRANDS,
  DEFAULT_BRAND_CAPACITY_THRESHOLD,
  _internals: {
    excludeConflicted,
    loadBrandCapacityThreshold,
    countOpenIwosForBrand,
  },
};
