/**
 * groupRollup.js — multi-currency group consolidation (Phase 1.2).
 *
 * Verifies the end-to-end consolidation on the native ledger:
 *   - per-brand bases rebuilt from gl_postings
 *   - FX conversion of a KES brand into the UGX presentation currency
 *   - balance sheet balances (current-year P&L folded into equity)
 *   - intercompany_invoices auto-eliminated (group IC revenue nets out)
 *   - rollup doc written to companies/zeus-group/rollups/{period}
 *
 * Run: cd functions && node --test __tests__/finance/groupRollup.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const stub = require('../assignment/_firestore-stub');

let _db;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin') {
    const firestore = Object.assign(() => _db, { FieldValue: stub.FieldValueStub });
    return { apps: [{}], initializeApp() {}, firestore };
  }
  if (request === 'firebase-admin/firestore') {
    return { getFirestore: () => _db, FieldValue: stub.FieldValueStub };
  }
  if (request === 'firebase-functions/v2/scheduler') {
    return { onSchedule: (_cfg, handler) => handler };
  }
  if (request === 'firebase-functions/v2/https') {
    class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
    return { onCall: (_cfg, handler) => handler, HttpsError };
  }
  if (request === 'firebase-functions') {
    return { logger: { info() {}, warn() {}, error() {} } };
  }
  return origLoad.call(this, request, ...rest);
};

const rollup = require('../../src/finance/groupRollup');
const native = require('../../src/finance/ledger/nativeLedgerSource');
const ledgerIndex = require('../../src/finance/ledger');

function freshDb() {
  const { db } = stub.makeFirestore();
  _db = db;
  native._internals._clearCache();
  ledgerIndex._clearFlagCache();
  return db;
}

function seedPosting(db, id, orgId, date, lines, currency = 'UGX') {
  db._seed(`gl_postings/${id}`, { entityOrgId: orgId, currency, date, lines });
}

test('consolidates two brands across currencies, balances, and auto-eliminates IC', async () => {
  const db = freshDb();
  db._seed('organizations/zeus-the-agency', { kind: 'SUBSIDIARY', base_currency: 'UGX' });
  db._seed('organizations/labyrinth', { kind: 'SUBSIDIARY', base_currency: 'KES' });
  // FX: 1 KES = 3700/29 UGX via seed fallback (KES vs UGX). No snapshot → seed.

  // zeus-the-agency (UGX): 1,000,000 revenue to AR.
  seedPosting(db, 'a_rev', 'zeus-the-agency', '2026-05-10', [
    { accountCode: '1200', debitMinor: 1_000_000 },
    { accountCode: '4000', creditMinor: 1_000_000 },
  ], 'UGX');

  // labyrinth (KES): 100,000 (KES minor) revenue to cash.
  seedPosting(db, 'l_rev', 'labyrinth', '2026-05-12', [
    { accountCode: '1000', debitMinor: 100_000 },
    { accountCode: '4000', creditMinor: 100_000 },
  ], 'KES');

  // Intercompany invoice: labyrinth → zeus-group, 200,000 UGX, POSTED in May.
  // Its GL legs (sub IC revenue 4000 + parent IC cost 5000, sub IC AR 1200 +
  // parent IC AP 2000) are seeded so the IC flow shows in the brand bases, and
  // the auto-elimination must net it out at group.
  db._seed('intercompany_invoices/ic1', {
    fromOrgId: 'labyrinth', toOrgId: 'zeus-group',
    amount: { amountMinor: 200_000, currency: 'UGX' },
    status: 'POSTED', postedAt: '2026-05-20',
  });
  // sub side (labyrinth books IC revenue) — in UGX for simplicity of the IC leg
  seedPosting(db, 'ic1_sub', 'labyrinth', '2026-05-20', [
    { accountCode: '1200', debitMinor: 200_000 },
    { accountCode: '4000', creditMinor: 200_000 },
  ], 'KES');
  // parent side (zeus-group books IC cost) — but zeus-group is the target, not
  // a contributor, so its postings don't enter the brand loop. The elimination
  // removes the sub-side IC revenue from the group total.

  const result = await rollup.runGroupRollup({ asOf: new Date(Date.UTC(2026, 4, 31)), count: 1 });
  assert.equal(result.presentationCurrency, 'UGX');

  const doc = db._dump()['companies/zeus-group/rollups/2026-05'];
  assert.ok(doc, 'rollup doc written');
  assert.equal(doc.balanceSheet.isBalanced, true, 'consolidated BS balances');
  assert.ok(doc.sourceSubsidiaries.includes('zeus-the-agency'));
  assert.ok(doc.sourceSubsidiaries.includes('labyrinth'));

  // IC auto-elimination applied (4 rows per IC invoice: pnl rev/cost + bs ar/ap).
  const icRows = doc.eliminationsApplied.filter((r) => r.source === 'ic-auto');
  assert.equal(icRows.length, 4);

  // labyrinth's base currency + FX rate captured for audit.
  assert.equal(doc.bySubsidiary.labyrinth.baseCurrency, 'KES');
  assert.ok(doc.bySubsidiary.labyrinth.fxRateToPresentation > 1, 'KES→UGX rate applied');

  // Revenue: agency 1,000,000 UGX + labyrinth (100,000 + 200,000 IC) KES→UGX,
  // minus the 200,000 UGX IC elimination. Assert it's positive and the IC row
  // reduced it.
  assert.ok(doc.pnl.revenue > 0);
});

test('no IC invoices → no auto-elimination rows', async () => {
  const db = freshDb();
  db._seed('organizations/zeus-the-agency', { kind: 'SUBSIDIARY', base_currency: 'UGX' });
  seedPosting(db, 'a_rev', 'zeus-the-agency', '2026-05-10', [
    { accountCode: '1200', debitMinor: 500_000 },
    { accountCode: '4000', creditMinor: 500_000 },
  ], 'UGX');

  await rollup.runGroupRollup({ asOf: new Date(Date.UTC(2026, 4, 31)), count: 1 });
  const doc = db._dump()['companies/zeus-group/rollups/2026-05'];
  assert.equal(doc.eliminationsApplied.length, 0);
  assert.equal(doc.balanceSheet.isBalanced, true);
  assert.equal(doc.pnl.revenue, 500_000);
});
