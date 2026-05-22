/**
 * Node-test twin of src/modules/pricing/services/__tests__/computePricing.test.ts.
 * Run with:
 *   cd functions && node --test __tests__/pricing/computePricing.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { computePricedQuote, PricingError } = require('../../src/pricing/lib/computePricing');

function stubRate({ subsidiaryOrgId, roleCode, unit }) {
  const table = {
    'zeus-the-agency:ACCOUNT_DIRECTOR:HOUR': 10_000_00,
    'zeus-the-agency:STRATEGIST:HOUR':       12_000_00,
    'zeus-digital:DIGITAL_PRODUCER:HOUR':     8_000_00,
    'zeus-digital:DIGITAL_PRODUCER:DAY':     64_000_00,
    'labyrinth:SR_DESIGNER:HOUR':             9_500_00,
  };
  const key = `${subsidiaryOrgId}:${roleCode}:${unit}`;
  if (!(key in table)) throw new Error(`No stub rate for ${key}`);
  return {
    rateCardId: `rc_${subsidiaryOrgId}_v1`,
    rateCardLineId: `rcl_${key}`,
    costMinor: table[key],
    currency: 'UGX',
  };
}

const markup35 = () => 35;

test('single-subsidiary correctness', () => {
  const result = computePricedQuote({
    sowId: 'sow_abc', clientId: 'c',
    lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'ACCOUNT_DIRECTOR', unit: 'HOUR', qty: 10 }],
    lookupRate: stubRate, lookupMarkup: markup35,
  });
  assert.equal(result.totalCostMinor, 100_000_00);
  assert.equal(result.totalClientMinor, 135_000_00);
  assert.ok(result.meetsFloor);
});

test('multi-subsidiary applies per-subsidiary markup independently', () => {
  const result = computePricedQuote({
    sowId: 'sow_multi', clientId: 'c',
    lines: [
      { subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST',       unit: 'HOUR', qty: 8 },
      { subsidiaryOrgId: 'zeus-digital',    roleCode: 'DIGITAL_PRODUCER', unit: 'DAY',  qty: 3 },
      { subsidiaryOrgId: 'labyrinth',       roleCode: 'SR_DESIGNER',      unit: 'HOUR', qty: 16 },
    ],
    lookupRate: stubRate,
    lookupMarkup: ({ subsidiaryOrgId }) => ({
      'zeus-the-agency': 35, 'zeus-digital': 40, 'labyrinth': 45,
    }[subsidiaryOrgId]),
  });
  assert.equal(result.totalCostMinor, 96_000_00 + 192_000_00 + 152_000_00);
  assert.equal(result.totalClientMinor, 129_600_00 + 268_800_00 + 220_400_00);
  assert.equal(new Set(result.lines.map(l => l.rateCardId)).size, 3);
});

test('rejects empty quote', () => {
  assert.throws(
    () => computePricedQuote({ sowId: 's', clientId: 'c', lines: [], lookupRate: stubRate, lookupMarkup: markup35 }),
    /EMPTY_QUOTE/,
  );
});

test('rejects non-positive qty', () => {
  assert.throws(
    () => computePricedQuote({
      sowId: 's', clientId: 'c',
      lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'ACCOUNT_DIRECTOR', unit: 'HOUR', qty: 0 }],
      lookupRate: stubRate, lookupMarkup: markup35,
    }),
    /INVALID_QTY/,
  );
});

test('flags meetsFloor=false when margin below floor', () => {
  const result = computePricedQuote({
    sowId: 's', clientId: 'c',
    lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST', unit: 'HOUR', qty: 4 }],
    lookupRate: stubRate, lookupMarkup: () => 10,
  });
  assert.equal(result.meetsFloor, false);
  assert.ok(result.marginPct < result.marginFloorPct);
});

test('per-quote marginFloorPct override (30%) rejects 35% markup', () => {
  const result = computePricedQuote({
    sowId: 's', clientId: 'c',
    lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST', unit: 'HOUR', qty: 4 }],
    lookupRate: stubRate, lookupMarkup: markup35,
    marginFloorPct: 30,
  });
  assert.equal(result.meetsFloor, false);
  assert.equal(result.marginFloorPct, 30);
});

test('rejects mixed currency (3.F scope)', () => {
  const mixedRate = (args) => {
    const base = stubRate(args);
    return args.subsidiaryOrgId === 'zeus-digital' ? { ...base, currency: 'USD' } : base;
  };
  assert.throws(
    () => computePricedQuote({
      sowId: 's', clientId: 'c',
      lines: [
        { subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST',       unit: 'HOUR', qty: 1 },
        { subsidiaryOrgId: 'zeus-digital',    roleCode: 'DIGITAL_PRODUCER', unit: 'HOUR', qty: 1 },
      ],
      lookupRate: mixedRate, lookupMarkup: markup35,
    }),
    /MIXED_CURRENCY/,
  );
});

test('PricingError exposes a stable code property for handler mapping', () => {
  try {
    computePricedQuote({ sowId: 's', clientId: 'c', lines: [], lookupRate: stubRate, lookupMarkup: markup35 });
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof PricingError);
    assert.equal(err.code, 'EMPTY_QUOTE');
  }
});
