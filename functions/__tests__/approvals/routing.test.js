/**
 * Approval routing v2 — pure engine tests.
 *   cd functions && node --test __tests__/approvals/routing.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../../src/approvals/routing');

const KES = R.kesMinor;
const decide = (over, config) =>
  R.routingDecisionFor({ purpose: 'talent', amountMinor: KES(50_000), currency: 'KES', ...over }, config);

// ── bands ───────────────────────────────────────────────────────────────

test('bandForAmount: inclusive upper bounds; above every bound lands on the unbounded band', () => {
  const bands = R.DEFAULT_SUPPLIER_SPEND_BANDS;
  assert.equal(R.bandForAmount(bands, 0).id, 'lead');
  assert.equal(R.bandForAmount(bands, KES(100_000)).id, 'lead');
  assert.equal(R.bandForAmount(bands, KES(100_000) + 1).id, 'brand_md');
  assert.equal(R.bandForAmount(bands, KES(1_000_000)).id, 'brand_md');
  assert.equal(R.bandForAmount(bands, KES(5_000_000)).id, 'group');
  assert.equal(R.bandForAmount(bands, KES(50_000_000)).id, 'board');
  assert.equal(R.bandForAmount(bands, Number.NaN).id, 'lead', 'garbage amount routes as zero');
});

test('defaults: the Zeus ladder — 1 / 1 / 2 / 3 signatures with authority rising', () => {
  const d1 = decide({ amountMinor: KES(80_000) });
  assert.deepEqual(d1.signatures.map((s) => [s.level, s.approverRole, s.label]), [[1, 'manager', 'Talent lead']]);
  const d2 = decide({ amountMinor: KES(800_000) });
  assert.deepEqual(d2.signatures.map((s) => [s.level, s.approverRole]), [[1, 'admin']]);
  const d3 = decide({ amountMinor: KES(3_000_000) });
  assert.deepEqual(d3.signatures.map((s) => [s.level, s.approverRole]), [[1, 'admin'], [2, 'owner']]);
  const d4 = decide({ amountMinor: KES(9_000_000) });
  assert.deepEqual(d4.signatures.map((s) => [s.level, s.approverRole, s.label]), [
    [1, 'admin', 'Brand MD'],
    [2, 'owner', 'Zeus Group CEO'],
    [3, 'owner', 'Group Finance'],
  ]);
  assert.deepEqual(d4.signatures[0].roleChain, ['admin', 'owner']);
  assert.equal(d4.forbidSelfApproval, true);
  assert.equal(d4.planVersion, 2);
});

// ── purpose rules ───────────────────────────────────────────────────────

test('purpose decides WHICH lead signs in the lead band, and never lowers a higher band', () => {
  assert.equal(decide({ purpose: 'media' }).signatures[0].label, 'Media lead');
  assert.equal(decide({ purpose: 'production' }).signatures[0].label, 'Production lead');
  // Overheads skip the lead — the brand MD signs from the first shilling.
  const oh = decide({ purpose: 'overhead' });
  assert.deepEqual([oh.signatures[0].approverRole, oh.signatures[0].label], ['admin', 'Brand MD']);
  // In the brand_md band the band's admin beats a manager purpose primary.
  const md = decide({ purpose: 'media', amountMinor: KES(500_000) });
  assert.equal(md.signatures[0].approverRole, 'admin');
  assert.equal(md.purposeRuleId, 'media');
});

test('requirePurpose refuses a record with no purpose; an unknown purpose counts as none', () => {
  assert.equal(decide({ purpose: null }).refusal, 'purpose_required');
  assert.equal(decide({ purpose: 'snacks' }).refusal, 'purpose_required');
  const relaxed = structuredClone(R.DEFAULT_APPROVAL_ROUTING);
  relaxed.modules.supplier_spend.requirePurpose = false;
  const d = decide({ purpose: null }, relaxed);
  assert.equal(d.refusal, undefined);
  assert.equal(d.purposeRuleId, null);
});

test('purpose escalation: escalateAbove and requireAnyLink hand level 1 to escalateTo', () => {
  const cfg = structuredClone(R.DEFAULT_APPROVAL_ROUTING);
  cfg.modules.supplier_spend.purposeRules = [
    {
      id: 'media', purpose: 'media', label: 'Media',
      primary: { label: 'Media lead', approverRole: 'manager' },
      escalateAboveMinor: KES(50_000),
      requireAnyLink: true,
      escalateTo: { label: 'Brand MD', approverRole: 'admin' },
    },
  ];
  const linked = decide({ purpose: 'media', amountMinor: KES(20_000), links: { masterJobId: 'mj1' } }, cfg);
  assert.equal(linked.signatures[0].label, 'Media lead');
  const unlinked = decide({ purpose: 'media', amountMinor: KES(20_000) }, cfg);
  assert.equal(unlinked.signatures[0].label, 'Brand MD');
  const big = decide({ purpose: 'media', amountMinor: KES(90_000), links: { masterJobId: 'mj1' } }, cfg);
  assert.equal(big.signatures[0].label, 'Brand MD');
});

// ── tier ────────────────────────────────────────────────────────────────

test('a Tier-1 engagement climbs one band at the same amount; the top band saturates', () => {
  const base = decide({ amountMinor: KES(80_000) });
  const t1 = decide({ amountMinor: KES(80_000), tier: 'TIER_1' });
  assert.equal(base.band.id, 'lead');
  assert.equal(t1.band.id, 'brand_md');
  assert.equal(t1.raisedByTier, 1);
  assert.equal(decide({ amountMinor: KES(80_000), tier: 'TIER_3' }).band.id, 'lead');
  const top = decide({ amountMinor: KES(9_000_000), tier: 'TIER_1' });
  assert.equal(top.band.id, 'board');
  assert.equal(top.raisedByTier, 0);
});

// ── aggregates ──────────────────────────────────────────────────────────

test('aggregate rules add a signer when tripped, dedupe against existing signers, and renumber', () => {
  const cfg = structuredClone(R.DEFAULT_APPROVAL_ROUTING);
  cfg.modules.supplier_spend.aggregateRules = [
    { id: 'supplier30', kind: 'supplier_rolling', thresholdMinor: KES(1_000_000), windowDays: 30, adds: { level: 2, label: 'Group Finance', approverRole: 'admin', approverEmail: 'finance@zeus.test' } },
    { id: 'budget', kind: 'master_job_budget_pct', thresholdPct: 80, adds: { level: 2, label: 'Zeus Group CEO', approverRole: 'owner' } },
  ];
  // Not tripped: nothing added.
  const quiet = decide({ amountMinor: KES(50_000), aggregates: { supplierRollingMinor: KES(100_000), masterJobBudgetPct: 20 } }, cfg);
  assert.deepEqual(quiet.aggregateRuleIds, []);
  assert.equal(quiet.signatures.length, 1);
  // Supplier rolling trips (existing + this > threshold): Finance added at level 2.
  const tripped = decide({ amountMinor: KES(50_000), aggregates: { supplierRollingMinor: KES(960_000), masterJobBudgetPct: 20 } }, cfg);
  assert.deepEqual(tripped.aggregateRuleIds, ['supplier30']);
  assert.deepEqual(tripped.signatures.map((s) => [s.level, s.label, s.approverEmail]), [
    [1, 'Talent lead', null],
    [2, 'Group Finance', 'finance@zeus.test'],
  ]);
  // An unbudgeted engagement (null pct) trips budget oversight; an unevaluated one (undefined) does not.
  assert.deepEqual(decide({ aggregates: { masterJobBudgetPct: null } }, cfg).aggregateRuleIds, ['budget']);
  assert.deepEqual(decide({ aggregates: {} }, cfg).aggregateRuleIds, []);
  // In the group band the CEO already signs at level 2 → budget rule adds nothing new.
  const group = decide({ amountMinor: KES(3_000_000), aggregates: { masterJobBudgetPct: 95 } }, cfg);
  assert.deepEqual(group.aggregateRuleIds, ['budget']);
  assert.deepEqual(group.signatures.map((s) => [s.level, s.label]), [[1, 'Brand MD'], [2, 'Zeus Group CEO']]);
});

// ── currency ────────────────────────────────────────────────────────────

test('amounts are compared as-is; a different currency is flagged, not converted', () => {
  const ugx = decide({ currency: 'UGX', amountMinor: KES(50_000) });
  assert.equal(ugx.currencyMismatch, true);
  assert.equal(ugx.band.id, 'lead');
  assert.equal(decide({ currency: 'kes' }).currencyMismatch, false);
});

// ── validation ──────────────────────────────────────────────────────────

test('validateBands: defaults are valid; authority may not decrease, signature count may not shrink', () => {
  assert.deepEqual(R.validateBands(R.DEFAULT_SUPPLIER_SPEND_BANDS), []);
  const junior = structuredClone(R.DEFAULT_SUPPLIER_SPEND_BANDS);
  junior[1].signatures[0].approverRole = 'member';
  assert.match(R.validateBands(junior).join('\n'), /more junior/);
  const fewer = structuredClone(R.DEFAULT_SUPPLIER_SPEND_BANDS);
  fewer[3].signatures = [fewer[3].signatures[0]];
  assert.match(R.validateBands(fewer).join('\n'), /at least as many signatures/);
  const gap = structuredClone(R.DEFAULT_SUPPLIER_SPEND_BANDS);
  gap[2].signatures[1].level = 3;
  assert.match(R.validateBands(gap).join('\n'), /levels must be 1\.\.2/);
  const bounded = structuredClone(R.DEFAULT_SUPPLIER_SPEND_BANDS);
  bounded[3].maxAmountMinor = 1;
  assert.match(R.validateBands(bounded).join('\n'), /unbounded/);
  const unordered = structuredClone(R.DEFAULT_SUPPLIER_SPEND_BANDS);
  unordered[1].maxAmountMinor = KES(10);
  assert.match(R.validateBands(unordered).join('\n'), /greater than the band below/);
  assert.deepEqual(R.validateBands([]), ['At least one approval band is required.']);
});

test('validateApprovalRouting: purpose / aggregate / tier problems are reported per module', () => {
  const cfg = structuredClone(R.DEFAULT_APPROVAL_ROUTING);
  cfg.modules.supplier_spend.purposeRules.push({ id: 'dup', purpose: 'media', label: 'Dup', primary: { approverRole: 'manager' } });
  cfg.modules.supplier_spend.purposeRules.push({ id: 'bad', purpose: 'snacks', label: 'Bad', primary: { approverRole: 'manager' }, escalateAboveMinor: 5 });
  cfg.modules.supplier_spend.aggregateRules = [{ id: 'x', kind: 'nope', thresholdMinor: -1, adds: { approverRole: 'ceo' } }];
  cfg.modules.supplier_spend.tierBandRaise = { TIER_1: -1 };
  const problems = R.validateApprovalRouting(cfg).supplier_spend.join('\n');
  assert.match(problems, /more than one rule/);
  assert.match(problems, /not a purpose/);
  assert.match(problems, /escalation needs an 'escalateTo'/);
  assert.match(problems, /not an aggregate kind/);
  assert.match(problems, /tierBandRaise\.TIER_1/);
  assert.deepEqual(R.validateApprovalRouting(R.DEFAULT_APPROVAL_ROUTING), {});
});

// ── loader ──────────────────────────────────────────────────────────────

function fakeDb(doc) {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: doc !== undefined, data: () => doc }),
      }),
    }),
  };
}

test('loadApprovalRouting: missing doc → defaults; invalid doc → defaults wholesale; valid doc → stored; cached', async () => {
  R.clearApprovalRoutingCache();
  assert.equal(await R.loadApprovalRouting({ db: fakeDb(undefined), now: 1 }), R.DEFAULT_APPROVAL_ROUTING);

  R.clearApprovalRoutingCache();
  const broken = structuredClone(R.DEFAULT_APPROVAL_ROUTING);
  broken.modules.supplier_spend.bands[0].signatures = [];
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await R.loadApprovalRouting({ db: fakeDb(broken), now: 1 }), R.DEFAULT_APPROVAL_ROUTING);
  } finally {
    console.warn = origWarn;
  }

  R.clearApprovalRoutingCache();
  const custom = structuredClone(R.DEFAULT_APPROVAL_ROUTING);
  custom.modules.supplier_spend.bands[0].maxAmountMinor = KES(200_000);
  const loaded = await R.loadApprovalRouting({ db: fakeDb(custom), now: 1 });
  assert.equal(loaded.modules.supplier_spend.bands[0].maxAmountMinor, KES(200_000));
  // Cached within the TTL even if the doc changes underneath.
  const again = await R.loadApprovalRouting({ db: fakeDb(undefined), now: 2 });
  assert.equal(again, loaded);
  R.clearApprovalRoutingCache();
});

// ── purpose resolution ──────────────────────────────────────────────────

test('resolvePurpose: explicit purpose wins; PO kind and record links imply one; nothing → null', () => {
  assert.equal(R.resolvePurpose({ purpose: 'overhead', kind: 'TALENT_FREELANCER' }), 'overhead');
  assert.equal(R.resolvePurpose({ kind: 'TALENT_FREELANCER' }), 'talent');
  assert.equal(R.resolvePurpose({ kind: 'MEDIA_SUPPLIER' }), 'media');
  assert.equal(R.resolvePurpose({ kind: 'VENDOR_OTHER' }), 'overhead');
  assert.equal(R.resolvePurpose({ kind: 'VENDOR_OTHER', productionJobId: 'pj1' }), 'production');
  assert.equal(R.resolvePurpose({ mediaPlanId: 'mp1' }), 'media');
  assert.equal(R.resolvePurpose({ talentProfileId: 'tp1' }), 'talent');
  assert.equal(R.resolvePurpose({}), null);
});

// ── planSignature ───────────────────────────────────────────────────────

function plan(amount, over) {
  return R.planFromDecision(decide({ amountMinor: amount, ...over }), '2026-10-25T00:00:00Z');
}

test('planFromDecision freezes the decision with every signature pending', () => {
  const p = plan(KES(3_000_000));
  assert.equal(p.bandId, 'group');
  assert.equal(p.pendingLevel, 1);
  assert.deepEqual(p.signatures.map((s) => [s.level, s.approvedBy]), [[1, null], [2, null]]);
});

test('planSignature: the raiser never signs (admins and owners included)', () => {
  const p = plan(KES(50_000));
  const r = R.planSignature({ plan: p, caller: { uid: 'u_raiser', role: 'owner' }, raiserUid: 'u_raiser' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'self_approval');
});

test('planSignature: seniority gates each level; a pinned email or role-profile holder signs regardless', () => {
  const p = plan(KES(3_000_000)); // L1 admin, L2 owner
  assert.equal(R.planSignature({ plan: p, caller: { uid: 'u_mgr', role: 'manager' }, raiserUid: 'u_x' }).code, 'under_tier');
  const l1 = R.planSignature({ plan: p, caller: { uid: 'u_md', role: 'admin' }, raiserUid: 'u_x' });
  assert.deepEqual(l1, { ok: true, level: 1, complete: false, via: 'role' });

  p.signatures[0].approvedBy = 'u_md';
  // Level 2 needs an owner — an admin is under tier...
  assert.equal(R.planSignature({ plan: p, caller: { uid: 'u_md2', role: 'admin' }, raiserUid: 'u_x' }).code, 'under_tier');
  // ...unless pinned by email or by role profile.
  p.signatures[1].approverEmail = 'CEO@zeus.test';
  assert.deepEqual(
    R.planSignature({ plan: p, caller: { uid: 'u_pinned', role: 'member', email: 'ceo@zeus.test' }, raiserUid: 'u_x' }),
    { ok: true, level: 2, complete: true, via: 'pinned' },
  );
  assert.deepEqual(
    R.planSignature({ plan: p, caller: { uid: 'u_holder', role: 'member' }, raiserUid: 'u_x', pinnedUids: ['u_holder'] }),
    { ok: true, level: 2, complete: true, via: 'pinned' },
  );
  const owner = R.planSignature({ plan: p, caller: { uid: 'u_ceo', role: 'owner' }, raiserUid: 'u_x' });
  assert.deepEqual(owner, { ok: true, level: 2, complete: true, via: 'role' });
});

test('planSignature: distinct signers — one person cannot sign two levels; a complete plan refuses', () => {
  const p = plan(KES(3_000_000));
  p.signatures[0].approvedBy = 'u_owner';
  assert.equal(R.planSignature({ plan: p, caller: { uid: 'u_owner', role: 'owner' }, raiserUid: 'u_x' }).code, 'already_signed');
  p.signatures[1].approvedBy = 'u_ceo';
  assert.equal(R.planSignature({ plan: p, caller: { uid: 'u_other', role: 'owner' }, raiserUid: 'u_x' }).code, 'already_complete');
  assert.equal(R.planSignature({ plan: p, caller: null }).code, 'unauthenticated');
});
