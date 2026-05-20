/**
 * Tests for the Drive subfolder resolver.
 * Run with:
 *    cd functions && node --test __tests__/folderMapping.test.js
 *
 * Uses Node's built-in test runner (no Vitest — the repo-level Vitest
 * config explicitly excludes `functions/`).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SUBFOLDERS,
  ALL_SUBFOLDERS,
  resolveDriveSubfolder,
} = require('../src/drive/folderMapping');

test('client-document → 01_Brief-&-Scope', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'client-document' }),
    SUBFOLDERS.BRIEF,
  );
});

test('cad-model → 02_Design', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'cad-model' }),
    SUBFOLDERS.DESIGN,
  );
});

test('deliverable/mood-board → 02_Design', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'deliverable', deliverableType: 'mood-board' }),
    SUBFOLDERS.DESIGN,
  );
});

test('deliverable/rendering → 02_Design', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'deliverable', deliverableType: 'rendering' }),
    SUBFOLDERS.DESIGN,
  );
});

test('deliverable/cut-list → 03_Engineering', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'deliverable', deliverableType: 'cut-list' }),
    SUBFOLDERS.ENGINEERING,
  );
});

test('deliverable/bom → 03_Engineering', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'deliverable', deliverableType: 'bom' }),
    SUBFOLDERS.ENGINEERING,
  );
});

test('deliverable/specification-sheet → 03_Engineering', () => {
  assert.equal(
    resolveDriveSubfolder({
      category: 'deliverable',
      deliverableType: 'specification-sheet',
    }),
    SUBFOLDERS.ENGINEERING,
  );
});

test('deliverable/assembly-instructions → 03_Engineering', () => {
  assert.equal(
    resolveDriveSubfolder({
      category: 'deliverable',
      deliverableType: 'assembly-instructions',
    }),
    SUBFOLDERS.ENGINEERING,
  );
});

test('production-doc → 05_Production', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'production-doc' }),
    SUBFOLDERS.PRODUCTION,
  );
});

test('deliverable/handoff-bundle → 05_Production', () => {
  assert.equal(
    resolveDriveSubfolder({
      category: 'deliverable',
      deliverableType: 'handoff-bundle',
    }),
    SUBFOLDERS.PRODUCTION,
  );
});

test('report → 07_Client-Communications', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'report' }),
    SUBFOLDERS.CLIENT_COMMS,
  );
});

test('shop-drawing WITHOUT MO → 02_Design (design iteration phase)', () => {
  assert.equal(
    resolveDriveSubfolder({
      category: 'deliverable',
      deliverableType: 'shop-drawing',
    }),
    SUBFOLDERS.DESIGN,
  );
});

test('shop-drawing WITH MO → 05_Production (handoff phase override)', () => {
  assert.equal(
    resolveDriveSubfolder({
      category: 'deliverable',
      deliverableType: 'shop-drawing',
      manufacturingOrderId: 'mo-123',
    }),
    SUBFOLDERS.PRODUCTION,
  );
});

test('unknown category → 02_Design (safe default)', () => {
  assert.equal(
    resolveDriveSubfolder({ category: 'something-unseen' }),
    SUBFOLDERS.DESIGN,
  );
});

test('empty/null input → 02_Design (safe default, no throw)', () => {
  assert.equal(resolveDriveSubfolder(null), SUBFOLDERS.DESIGN);
  assert.equal(resolveDriveSubfolder({}), SUBFOLDERS.DESIGN);
});

test('ALL_SUBFOLDERS has 7 entries in policy-defined order', () => {
  assert.equal(ALL_SUBFOLDERS.length, 7);
  assert.deepEqual([...ALL_SUBFOLDERS], [
    '01_Brief-&-Scope',
    '02_Design',
    '03_Engineering',
    '04_Procurement',
    '05_Production',
    '06_Delivery',
    '07_Client-Communications',
  ]);
});
