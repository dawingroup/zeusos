/**
 * aging.js — AR/AP aging on the native ledger (Phase 1.3).
 *
 * Run: cd functions && node --test __tests__/finance/aging.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const stub = require('../assignment/_firestore-stub');

let _db;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin/firestore') {
    return { getFirestore: () => _db, FieldValue: stub.FieldValueStub };
  }
  return origLoad.call(this, request, ...rest);
};

const aging = require('../../src/finance/aging');
const native = require('../../src/finance/ledger/nativeLedgerSource');

function freshDb() {
  const { db } = stub.makeFirestore();
  _db = db;
  native._internals._clearCache();
  return db;
}

const NOW = new Date('2026-05-31T00:00:00Z');

test('ageBucketKey maps days-overdue to buckets', () => {
  assert.equal(aging.ageBucketKey(-5), 'current');
  assert.equal(aging.ageBucketKey(0), 'current');
  assert.equal(aging.ageBucketKey(15), 'd0_30');
  assert.equal(aging.ageBucketKey(45), 'd31_60');
  assert.equal(aging.ageBucketKey(75), 'd61_90');
  assert.equal(aging.ageBucketKey(120), 'd90_plus');
});

test('computeAging buckets + topOverdue + per-brand split (pure)', () => {
  const items = [
    { amountMinor: 100, dueDate: '2026-06-15', party: 'Acme', brandId: 'zeus-digital' },   // future → current
    { amountMinor: 200, dueDate: '2026-05-20', party: 'Acme', brandId: 'zeus-digital' },   // 11d → d0_30
    { amountMinor: 500, dueDate: '2026-02-01', party: 'Globex', brandId: 'labyrinth' },    // ~119d → d90_plus
  ];
  const r = aging.computeAging(items, NOW, { partyKey: 'customer' });
  assert.equal(r.totalOutstanding, 800);
  assert.equal(r.buckets.current, 100);
  assert.equal(r.buckets.d0_30, 200);
  assert.equal(r.buckets.d90_plus, 500);
  assert.equal(r.byBrand['zeus-digital'], 300);
  assert.equal(r.byBrand['labyrinth'], 500);
  assert.equal(r.overdueCount, 2);
  // Top overdue sorted by outstanding: Globex (500) before Acme (200).
  assert.equal(r.topOverdue[0].customer, 'Globex');
  assert.equal(r.topOverdue[0].outstanding, 500);
});

test('getArAging derives dueDate from terms + FX-normalises to presentation', async () => {
  const db = freshDb();
  db._seed('finance_config/group', { presentationCurrency: 'UGX' });
  db._seed('finance_config/payment_terms', { defaultPaymentTermsDays: 30 });

  // UGX invoice issued 2026-03-01, no dueDate → due 2026-03-31 → ~61d overdue.
  db._seed('client_invoices/inv1', {
    clientId: 'acme', status: 'ISSUED', issuedAt: '2026-03-01',
    total: { amountMinor: 1_000_000, currency: 'UGX' }, paidMinor: 0,
    lines: [{ sourceSubsidiaryId: 'zeus-digital' }],
  });
  // KES invoice, balance 100,000 KES → FX to UGX (~3700/29 ≈ 127.6x). Future due.
  db._seed('client_invoices/inv2', {
    clientId: 'globex', status: 'PART_PAID', issuedAt: '2026-05-15',
    total: { amountMinor: 100_000, currency: 'KES' }, paidMinor: 0,
    lines: [{ sourceSubsidiaryId: 'labyrinth' }],
  });

  const r = await aging.getArAging({ now: NOW });
  assert.equal(r.presentationCurrency, 'UGX');
  // inv1: 1,000,000 UGX in the 61-90 bucket (due 3/31, now 5/31 = 61 days).
  assert.equal(r.buckets.d61_90, 1_000_000);
  // inv2: 100,000 KES → UGX at seed rate (1 KES = 29 UGX); future due → 'current'.
  const kesInUgx = 100_000 * 29;
  assert.equal(r.buckets.current, kesInUgx);
  assert.equal(r.totalOutstanding, 1_000_000 + kesInUgx);
  assert.equal(r.byBrand['zeus-digital'], 1_000_000);
});

test('getApAging buckets intercompany payables', async () => {
  const db = freshDb();
  db._seed('finance_config/group', { presentationCurrency: 'UGX' });
  db._seed('finance_config/payment_terms', { defaultPaymentTermsDays: 30 });
  db._seed('intercompany_invoices/ic1', {
    fromOrgId: 'labyrinth', toOrgId: 'zeus-group', status: 'POSTED',
    raisedAt: '2026-03-01', amount: { amountMinor: 400_000, currency: 'UGX' },
  });
  const r = await aging.getApAging({ now: NOW });
  assert.equal(r.totalOutstanding, 400_000);
  assert.equal(r.buckets.d61_90, 400_000); // due 3/31, 61d overdue
  assert.equal(r.topOverdue[0].vendor, 'labyrinth');
});
