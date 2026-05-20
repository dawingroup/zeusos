/**
 * Tests for the project-folder-name builder.
 * Run with:
 *    cd functions && node --test __tests__/folderBuilder.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { kebab, titleKebab, buildProjectFolderName } = require('../src/drive/folderBuilder');

test('kebab lowercases and hyphenates', () => {
  assert.equal(kebab('Hello World'), 'hello-world');
});

test('kebab strips diacritics and specials', () => {
  assert.equal(kebab('Café Résumé  @#!'), 'cafe-resume');
});

test('kebab collapses multiple hyphens and trims leading/trailing', () => {
  assert.equal(kebab('---hello---world---'), 'hello-world');
});

test('kebab falls back on empty input', () => {
  assert.equal(kebab(''), 'unknown');
  assert.equal(kebab(null, 'x'), 'x');
});

test('titleKebab preserves Title-Case', () => {
  assert.equal(titleKebab('Smith Residence'), 'Smith-Residence');
});

test('buildProjectFolderName — canonical shape', () => {
  assert.equal(
    buildProjectFolderName({
      code: 'DF-2025-001',
      customerName: 'Smith Residence',
      name: 'Kitchen Remodel',
    }),
    'DF-2025-001_Smith-Residence_Kitchen-Remodel',
  );
});

test('buildProjectFolderName — missing fields fall back deterministically', () => {
  const name = buildProjectFolderName({ code: 'DA-2025-003' });
  assert.match(name, /^DA-2025-003_Unknown-Client_Project$/);
});

test('buildProjectFolderName — missing code yields UNKNOWN-CODE', () => {
  const name = buildProjectFolderName({ customerName: 'A', name: 'B' });
  assert.equal(name.startsWith('UNKNOWN-CODE_'), true);
});
