/**
 * Transfer Pricing Policy — unit tests (ADR-0001 Q3).
 *
 * Run with:
 *   cd functions && node --test __tests__/pricing/transferPricingPolicy.test.js
 *
 * Covers:
 *   lookupMarkupPct
 *     - parent doc missing → null
 *     - parent doc present, no versions, has defaultMarkupPct → defaultMarkupPct
 *     - parent doc present, no versions, has currentMarkupPct → currentMarkupPct
 *     - version active at atDate → version markupPct
 *     - version not yet started (effectiveFrom > atDate) → falls through
 *     - version expired (effectiveUntil ≤ atDate) → falls through
 *     - multiple versions → picks the latest effectiveFrom that is ≤ atDate
 *
 *   computeEffectiveTransferPrice
 *     - zero cumulativeCostMinor → issue-time price, source='zero-cost-fallback'
 *     - policy missing → issue-time price, source='issue-time-fallback'
 *     - policy found → cost-plus applied, source='policy'
 *     - markup 0% → cost-plus = cumulativeCostMinor (no markup, no rounding error)
 *
 *   applyMarkup (pure)
 *     - standard 10% → rounds correctly
 *     - 0% → identity
 *     - zero cost → 0
 *     - negative cost → 0
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  lookupMarkupPct,
  computeEffectiveTransferPrice,
  applyMarkup,
  policyId,
  TRANSFER_PRICING_POLICY_COLLECTION,
} = require('../../src/pricing/transferPricingPolicy');

// ─── Firestore stub ────────────────────────────────────────────────────────
// A simple in-memory map keyed by path.  Supports:
//   db.doc(path).get() — returns snap with { exists, data() }
//   db.doc(path).collection(sub).get() — returns snapArr with { empty, docs[] }
//   db.doc(path).collection(sub).doc(id) (for write path tests — not needed here)

function makeDb(store) {
  function snapOf(path) {
    const data = store.get(path);
    return { exists: data !== undefined, data: () => data };
  }

  return {
    doc(path) {
      return {
        async get() { return snapOf(path); },
        collection(sub) {
          // Return all child docs whose paths start with `${path}/${sub}/`.
          const prefix = `${path}/${sub}/`;
          return {
            async get() {
              const docs = [];
              for (const [k, v] of store.entries()) {
                if (k.startsWith(prefix)) {
                  const id = k.slice(prefix.length);
                  if (!id.includes('/')) docs.push({ id, data: () => v });
                }
              }
              return { empty: docs.length === 0, docs };
            },
          };
        },
      };
    },
  };
}

function seedPolicy(store, fromOrgId, toOrgId, parentData, versions = {}) {
  const id = policyId(fromOrgId, toOrgId);
  const parentPath = `${TRANSFER_PRICING_POLICY_COLLECTION}/${id}`;
  store.set(parentPath, { fromOrgId, toOrgId, ...parentData });
  for (const [vId, vData] of Object.entries(versions)) {
    store.set(`${parentPath}/versions/${vId}`, vData);
  }
}

// ─── lookupMarkupPct ──────────────────────────────────────────────────────

test('lookupMarkupPct: parent doc missing → null', async () => {
  const db = makeDb(new Map());
  const result = await lookupMarkupPct(db, 'zeus-the-agency', 'zeus-group', null);
  assert.equal(result, null);
});

test('lookupMarkupPct: parent present, no versions, defaultMarkupPct → uses default', async () => {
  const store = new Map();
  seedPolicy(store, 'zeus-the-agency', 'zeus-group', { defaultMarkupPct: 10 });
  const db = makeDb(store);
  const result = await lookupMarkupPct(db, 'zeus-the-agency', 'zeus-group', null);
  assert.equal(result, 10);
});

test('lookupMarkupPct: currentMarkupPct takes priority over defaultMarkupPct when no versions', async () => {
  const store = new Map();
  seedPolicy(store, 'zeus-the-agency', 'zeus-group', {
    currentMarkupPct: 12,
    defaultMarkupPct: 10,
  });
  const db = makeDb(store);
  const result = await lookupMarkupPct(db, 'zeus-the-agency', 'zeus-group', null);
  assert.equal(result, 12);
});

test('lookupMarkupPct: active version in range → version markupPct', async () => {
  const store = new Map();
  seedPolicy(
    store, 'zeus-digital', 'zeus-group',
    { defaultMarkupPct: 10, currentMarkupPct: 10 },
    {
      v1: {
        markupPct: 15,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        effectiveUntil: null,
      },
    },
  );
  const db = makeDb(store);
  // Query at 2025-06-01 — v1 is active (started Jan 2025, no end).
  const result = await lookupMarkupPct(db, 'zeus-digital', 'zeus-group', '2025-06-01T00:00:00.000Z');
  assert.equal(result, 15);
});

test('lookupMarkupPct: version not yet started → falls through to currentMarkupPct', async () => {
  const store = new Map();
  seedPolicy(
    store, 'zeus-digital', 'zeus-group',
    { defaultMarkupPct: 10, currentMarkupPct: 10 },
    {
      v1: {
        markupPct: 20,
        effectiveFrom: '2026-12-01T00:00:00.000Z', // future
        effectiveUntil: null,
      },
    },
  );
  const db = makeDb(store);
  // Query at 2025-06-01 — v1 hasn't started yet.
  const result = await lookupMarkupPct(db, 'zeus-digital', 'zeus-group', '2025-06-01T00:00:00.000Z');
  assert.equal(result, 10); // currentMarkupPct fallback
});

test('lookupMarkupPct: expired version → falls through to currentMarkupPct', async () => {
  const store = new Map();
  seedPolicy(
    store, 'labyrinth', 'zeus-group',
    { defaultMarkupPct: 10, currentMarkupPct: 10 },
    {
      v1: {
        markupPct: 8,
        effectiveFrom: '2024-01-01T00:00:00.000Z',
        effectiveUntil: '2024-12-31T23:59:59.999Z', // expired
      },
    },
  );
  const db = makeDb(store);
  // Query at 2025-06-01 — v1 has expired.
  const result = await lookupMarkupPct(db, 'labyrinth', 'zeus-group', '2025-06-01T00:00:00.000Z');
  assert.equal(result, 10);
});

test('lookupMarkupPct: multiple versions → picks most recent effectiveFrom ≤ atDate', async () => {
  const store = new Map();
  seedPolicy(
    store, 'odd-gorilla', 'zeus-group',
    { defaultMarkupPct: 10 },
    {
      v1: { markupPct: 10, effectiveFrom: '2024-01-01T00:00:00.000Z', effectiveUntil: '2025-01-01T00:00:00.000Z' },
      v2: { markupPct: 12, effectiveFrom: '2025-01-01T00:00:00.000Z', effectiveUntil: '2026-01-01T00:00:00.000Z' },
      v3: { markupPct: 14, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null },
    },
  );
  const db = makeDb(store);

  // At 2025-06-01 → v2 should win.
  assert.equal(
    await lookupMarkupPct(db, 'odd-gorilla', 'zeus-group', '2025-06-01T00:00:00.000Z'),
    12,
  );
  // At 2026-06-01 → v3 should win.
  assert.equal(
    await lookupMarkupPct(db, 'odd-gorilla', 'zeus-group', '2026-06-01T00:00:00.000Z'),
    14,
  );
  // At 2024-06-01 → v1 should win.
  assert.equal(
    await lookupMarkupPct(db, 'odd-gorilla', 'zeus-group', '2024-06-01T00:00:00.000Z'),
    10,
  );
});

test('lookupMarkupPct: missing fromOrgId → null (no lookup)', async () => {
  const db = makeDb(new Map());
  const result = await lookupMarkupPct(db, '', 'zeus-group', null);
  assert.equal(result, null);
});

// ─── computeEffectiveTransferPrice ────────────────────────────────────────

test('computeEffectiveTransferPrice: zero cumulativeCostMinor → zero-cost-fallback', async () => {
  const store = new Map();
  seedPolicy(store, 'zeus-the-agency', 'zeus-group', { defaultMarkupPct: 10 });
  const db = makeDb(store);

  const iwo = {
    subsidiaryOrgId: 'zeus-the-agency',
    cumulativeCostMinor: 0,
    transferPriceMinor: 50000,
    currency: 'UGX',
  };
  const result = await computeEffectiveTransferPrice({ db, iwo, toOrgId: 'zeus-group' });
  assert.equal(result.source, 'zero-cost-fallback');
  assert.equal(result.amountMinor, 50000);
  assert.equal(result.markupPct, null);
  assert.equal(result.cumulativeCostMinor, 0);
});

test('computeEffectiveTransferPrice: no policy → issue-time-fallback', async () => {
  const db = makeDb(new Map()); // no policy docs
  const iwo = {
    subsidiaryOrgId: 'house-of-zeus',
    cumulativeCostMinor: 200000,
    transferPriceMinor: 180000,
    currency: 'UGX',
  };
  const result = await computeEffectiveTransferPrice({ db, iwo, toOrgId: 'zeus-group' });
  assert.equal(result.source, 'issue-time-fallback');
  assert.equal(result.amountMinor, 180000);
  assert.equal(result.markupPct, null);
  assert.equal(result.cumulativeCostMinor, 200000);
});

test('computeEffectiveTransferPrice: policy found → cost-plus applied', async () => {
  const store = new Map();
  seedPolicy(
    store, 'zeus-the-agency', 'zeus-group',
    { defaultMarkupPct: 10, currentMarkupPct: 10 },
    {
      v1: { markupPct: 10, effectiveFrom: '2024-01-01T00:00:00.000Z', effectiveUntil: null },
    },
  );
  const db = makeDb(store);

  const iwo = {
    subsidiaryOrgId: 'zeus-the-agency',
    cumulativeCostMinor: 1_000_000, // 1,000,000 minor units
    transferPriceMinor: 900_000,    // issue-time (stale, will be ignored)
    currency: 'UGX',
  };
  const result = await computeEffectiveTransferPrice({ db, iwo, toOrgId: 'zeus-group' });
  assert.equal(result.source, 'policy');
  assert.equal(result.markupPct, 10);
  // 1,000,000 × 1.10 = 1,100,000
  assert.equal(result.amountMinor, 1_100_000);
  assert.equal(result.cumulativeCostMinor, 1_000_000);
});

test('computeEffectiveTransferPrice: 0% markup → cost-plus = cumulativeCostMinor', async () => {
  const store = new Map();
  seedPolicy(
    store, 'zeus-digital', 'zeus-group',
    { defaultMarkupPct: 0 },
  );
  const db = makeDb(store);

  const iwo = {
    subsidiaryOrgId: 'zeus-digital',
    cumulativeCostMinor: 750_000,
    transferPriceMinor: 700_000,
    currency: 'UGX',
  };
  const result = await computeEffectiveTransferPrice({ db, iwo, toOrgId: 'zeus-group' });
  assert.equal(result.source, 'policy');
  assert.equal(result.markupPct, 0);
  assert.equal(result.amountMinor, 750_000);
});

test('computeEffectiveTransferPrice: undefined cumulativeCostMinor → zero-cost-fallback', async () => {
  const db = makeDb(new Map());
  const iwo = {
    subsidiaryOrgId: 'zeus-the-agency',
    cumulativeCostMinor: undefined,
    transferPriceMinor: 50000,
    currency: 'UGX',
  };
  const result = await computeEffectiveTransferPrice({ db, iwo, toOrgId: 'zeus-group' });
  assert.equal(result.source, 'zero-cost-fallback');
});

// ─── applyMarkup (pure) ───────────────────────────────────────────────────

test('applyMarkup: 10% on 1,000,000 → 1,100,000', () => {
  assert.equal(applyMarkup(1_000_000, 10), 1_100_000);
});

test('applyMarkup: 0% → identity', () => {
  assert.equal(applyMarkup(500_000, 0), 500_000);
});

test('applyMarkup: zero cost → 0', () => {
  assert.equal(applyMarkup(0, 10), 0);
});

test('applyMarkup: negative cost → 0 (defensive clamp)', () => {
  assert.equal(applyMarkup(-1000, 10), 0);
});

test('applyMarkup: rounds half-up correctly', () => {
  // 100 × 1.10 = 110.0 → no rounding needed.
  assert.equal(applyMarkup(100, 10), 110);
  // 101 × 1.10 = 111.1 → rounds to 111.
  assert.equal(applyMarkup(101, 10), 111);
  // 105 × 1.10 = 115.5 → rounds to 116 (Math.round rounds .5 up).
  assert.equal(applyMarkup(105, 10), 116);
});

test('applyMarkup: NaN markupPct treated as 0', () => {
  assert.equal(applyMarkup(500_000, NaN), 500_000);
});
