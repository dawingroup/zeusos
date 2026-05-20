/**
 * Tests for the `classifyFileUpdate` diff classifier.
 * Run with:
 *    cd functions && node --test __tests__/classifyFileUpdate.test.js
 *
 * The classifier decides what the onUpdate mirror trigger should do
 * given a before/after pair:
 *   - 'remirror'  — bytes changed (`storagePath` swap from `overwriteFile`)
 *   - 'rename'    — policy name changed but bytes didn't
 *   - 'noop'      — everything else (status, portal, archive, no-op)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// Load the function directly; it doesn't import Firebase Admin at
// top-level so this is safe under node --test.
const { classifyFileUpdate } = require('../src/drive/updateProjectFileMirror');

function f(overrides = {}) {
  return {
    storagePath: 'project-files/p1/deliverable/t_ab_kitchen.pdf',
    name: 'DF-2025-001-DWG-kitchen-v01-20260419.pdf',
    driveFileId: 'drive-abc',
    status: 'draft',
    ...overrides,
  };
}

test('noop when before is undefined', () => {
  assert.equal(classifyFileUpdate(undefined, f()), 'noop');
});

test('noop when after is undefined', () => {
  assert.equal(classifyFileUpdate(f(), undefined), 'noop');
});

test('noop when nothing material changed', () => {
  assert.equal(classifyFileUpdate(f(), f()), 'noop');
});

test('noop on status-only change (portal share / approval)', () => {
  assert.equal(
    classifyFileUpdate(f({ status: 'draft' }), f({ status: 'approved' })),
    'noop',
  );
});

test('remirror when storagePath changed (overwriteFile)', () => {
  assert.equal(
    classifyFileUpdate(
      f({ storagePath: 'project-files/p1/deliverable/OLD' }),
      f({ storagePath: 'project-files/p1/deliverable/NEW' }),
    ),
    'remirror',
  );
});

test('rename when only name changed AND Drive mirror exists', () => {
  assert.equal(
    classifyFileUpdate(
      f({ name: 'OLD.pdf' }),
      f({ name: 'NEW.pdf' }),
    ),
    'rename',
  );
});

test('noop when name changed BUT no Drive mirror yet', () => {
  // `driveFileId` absent means the onCreate mirror hasn't run yet; the
  // rename would have nothing to target. The next onCreate fixes it.
  assert.equal(
    classifyFileUpdate(
      f({ name: 'OLD.pdf', driveFileId: undefined }),
      f({ name: 'NEW.pdf', driveFileId: undefined }),
    ),
    'noop',
  );
});

test('remirror wins when both storage and name change', () => {
  // The re-mirror already produces a correctly-named Drive file, so
  // there's no point also issuing a rename.
  assert.equal(
    classifyFileUpdate(
      f({ storagePath: 'A', name: 'OLD.pdf' }),
      f({ storagePath: 'B', name: 'NEW.pdf' }),
    ),
    'remirror',
  );
});

test('archived files noop even on storage/name change', () => {
  // An archived file's Drive copy is under `02_Archive/{YYYY}/` —
  // re-mirroring would duplicate it under `01_Active-Projects/`.
  assert.equal(
    classifyFileUpdate(
      f({ storagePath: 'A', archived: true }),
      f({ storagePath: 'B', archived: true }),
    ),
    'noop',
  );
  assert.equal(
    classifyFileUpdate(
      f({ name: 'OLD.pdf', archived: true }),
      f({ name: 'NEW.pdf', archived: true }),
    ),
    'noop',
  );
});
