/**
 * accountRanges.js — GL account-code classifier (Phase 1.1).
 *
 * Run: cd functions && node --test __tests__/finance/accountRanges.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyAccount, STATEMENT } = require('../../src/finance/accountRanges');

test('classifies the live ZeusOS account codes correctly', () => {
  // Cash & AR — balance sheet, debit-normal.
  assert.deepEqual(classifyAccount('1000'), { statement: STATEMENT.BS, line: 'cash', creditNormal: false });
  assert.deepEqual(classifyAccount('1200'), { statement: STATEMENT.BS, line: 'ar', creditNormal: false });

  // AP variants — balance sheet, credit-normal.
  assert.deepEqual(classifyAccount('2000'), { statement: STATEMENT.BS, line: 'ap', creditNormal: true });
  assert.deepEqual(classifyAccount('2050'), { statement: STATEMENT.BS, line: 'ap', creditNormal: true });
  assert.deepEqual(classifyAccount('2051'), { statement: STATEMENT.BS, line: 'ap', creditNormal: true });

  // Revenue — P&L, credit-normal.
  assert.deepEqual(classifyAccount('4000'), { statement: STATEMENT.PNL, line: 'revenue', creditNormal: true });

  // Cost of sales (IC cost / talent / media) — P&L, debit-normal.
  assert.deepEqual(classifyAccount('5000'), { statement: STATEMENT.PNL, line: 'costOfSales', creditNormal: false });
  assert.deepEqual(classifyAccount('5010'), { statement: STATEMENT.PNL, line: 'costOfSales', creditNormal: false });
  assert.deepEqual(classifyAccount('5020'), { statement: STATEMENT.PNL, line: 'costOfSales', creditNormal: false });
});

test('classifies opex and equity ranges', () => {
  assert.equal(classifyAccount('5100').line, 'operatingExpenses');
  assert.equal(classifyAccount('6500').line, 'operatingExpenses');
  assert.equal(classifyAccount('3000').line, 'shareCapital');
  assert.equal(classifyAccount('3900').line, 'retainedEarnings');
  assert.equal(classifyAccount('7900').line, 'taxExpense');
});

test('accepts numeric or string codes', () => {
  assert.deepEqual(classifyAccount(1000), classifyAccount('1000'));
});

test('returns null for unmapped / invalid codes', () => {
  assert.equal(classifyAccount('9999'), null);
  assert.equal(classifyAccount('abc'), null);
  assert.equal(classifyAccount(undefined), null);
});
