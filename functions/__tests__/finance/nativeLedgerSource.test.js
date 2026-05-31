/**
 * nativeLedgerSource.js — GL → statement-bases reconstruction (Phase 1.1).
 *
 * Verifies that getStatementBases() rebuilds P&L (period flow) and Balance
 * Sheet (cumulative balances) from raw gl_postings, and that cash opening/
 * closing for the cash-flow base is derived correctly across periods.
 *
 * Run: cd functions && node --test __tests__/finance/nativeLedgerSource.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const stub = require('../assignment/_firestore-stub');

let _adminDb;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin/firestore') {
    return { getFirestore: () => _adminDb, FieldValue: stub.FieldValueStub };
  }
  return origLoad.call(this, request, ...rest);
};

const native = require('../../src/finance/ledger/nativeLedgerSource');

function freshDb() {
  const { db } = stub.makeFirestore();
  _adminDb = db;
  native._internals._clearCache();
  return db;
}

/** Seed a balanced GL posting for an org in a given month. */
function seedPosting(db, id, orgId, dateYYYYMMDD, lines, currency = 'UGX') {
  db._seed(`gl_postings/${id}`, { entityOrgId: orgId, currency, date: dateYYYYMMDD, lines });
}

test('rebuilds P&L period flow + cumulative balance sheet from GL', async () => {
  const db = freshDb();
  db._seed('organizations/zeus-the-agency', { kind: 'SUBSIDIARY', base_currency: 'UGX' });

  // April: recognise 1,000,000 revenue against AR.
  seedPosting(db, 'p_apr_rev', 'zeus-the-agency', '2026-04-15', [
    { accountCode: '1200', debitMinor: 1_000_000 },
    { accountCode: '4000', creditMinor: 1_000_000 },
  ]);
  // May: client pays 600,000 (cash up, AR down).
  seedPosting(db, 'p_may_pay', 'zeus-the-agency', '2026-05-10', [
    { accountCode: '1000', debitMinor: 600_000 },
    { accountCode: '1200', creditMinor: 600_000 },
  ]);
  // May: recognise 400,000 cost of sales against AP.
  seedPosting(db, 'p_may_cost', 'zeus-the-agency', '2026-05-20', [
    { accountCode: '5000', debitMinor: 400_000 },
    { accountCode: '2000', creditMinor: 400_000 },
  ]);

  const may = await native.getStatementBases({ orgId: 'zeus-the-agency', periodKey: '2026-05' });

  // P&L = MAY movements only: no revenue in May, 400k cost of sales.
  assert.equal(may.pnlBase.revenue, 0);
  assert.equal(may.pnlBase.costOfSales, 400_000);

  // Balance sheet = cumulative through end of May.
  assert.equal(may.bsBase.cash, 600_000);          // 600k in
  assert.equal(may.bsBase.ar, 400_000);            // 1,000k − 600k
  assert.equal(may.bsBase.ap, 400_000);            // credit-normal liability
  assert.equal(may.currency, 'UGX');

  // Cash flow base: opening cash (end Apr) = 0, closing (end May) = 600k.
  assert.equal(may.cfBase.openingCash, 0);
  assert.equal(may.cfBase.closingCash, 600_000);
  assert.equal(may.cfBase.measuredCashChange, 600_000);
  assert.equal(may.cfBase.operatingCashFlow, 600_000);
});

test('April view sees revenue flow but no cash yet', async () => {
  const db = freshDb();
  db._seed('organizations/zeus-the-agency', { kind: 'SUBSIDIARY', base_currency: 'UGX' });
  seedPosting(db, 'p_apr_rev', 'zeus-the-agency', '2026-04-15', [
    { accountCode: '1200', debitMinor: 1_000_000 },
    { accountCode: '4000', creditMinor: 1_000_000 },
  ]);
  seedPosting(db, 'p_may_pay', 'zeus-the-agency', '2026-05-10', [
    { accountCode: '1000', debitMinor: 600_000 },
    { accountCode: '1200', creditMinor: 600_000 },
  ]);

  const apr = await native.getStatementBases({ orgId: 'zeus-the-agency', periodKey: '2026-04' });
  assert.equal(apr.pnlBase.revenue, 1_000_000); // April flow
  assert.equal(apr.bsBase.ar, 1_000_000);       // cumulative through April (no May payment)
  assert.equal(apr.bsBase.cash, 0);
});

test('getCashPosition sums all cash-account movement', async () => {
  const db = freshDb();
  db._seed('organizations/labyrinth', { kind: 'SUBSIDIARY', base_currency: 'KES' });
  seedPosting(db, 'c1', 'labyrinth', '2026-05-01', [
    { accountCode: '1000', debitMinor: 500_000 },
    { accountCode: '4000', creditMinor: 500_000 },
  ], 'KES');
  seedPosting(db, 'c2', 'labyrinth', '2026-05-15', [
    { accountCode: '5000', debitMinor: 200_000 },
    { accountCode: '1000', creditMinor: 200_000 },
  ], 'KES');

  const pos = await native.getCashPosition({ orgId: 'labyrinth' });
  assert.equal(pos.balanceMinor, 300_000); // 500k − 200k
  assert.equal(pos.currency, 'KES');
});

test('only the org\'s own postings are counted', async () => {
  const db = freshDb();
  db._seed('organizations/zeus-digital', { kind: 'SUBSIDIARY', base_currency: 'UGX' });
  seedPosting(db, 'mine', 'zeus-digital', '2026-05-01', [
    { accountCode: '1000', debitMinor: 100_000 },
    { accountCode: '4000', creditMinor: 100_000 },
  ]);
  seedPosting(db, 'theirs', 'labyrinth', '2026-05-01', [
    { accountCode: '1000', debitMinor: 999_000 },
    { accountCode: '4000', creditMinor: 999_000 },
  ]);
  const pos = await native.getCashPosition({ orgId: 'zeus-digital' });
  assert.equal(pos.balanceMinor, 100_000);
});
