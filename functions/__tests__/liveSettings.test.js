/**
 * Tests for the Firestore-backed live settings cache.
 *
 * Exercises the resolveFolderId() precedence contract:
 *   Firestore (fresh) → env fallback → empty
 * Run with:
 *    cd functions && node --test __tests__/liveSettings.test.js
 *
 * We stub out `firebase-admin` so the module's Firestore read is
 * deterministic and fast.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// ── Stub firebase-admin BEFORE requiring the module under test ──────
let currentDoc = null;
let fetchCalls = 0;
const stubFirestore = () => ({
  doc: () => ({
    get: async () => {
      fetchCalls++;
      return {
        exists: currentDoc !== null,
        data: () => currentDoc,
      };
    },
  }),
});

require.cache[require.resolve('firebase-admin')] = {
  exports: {
    firestore: () => stubFirestore(),
  },
};

// firebase-functions/logger is imported for warn/info — stub minimal.
require.cache[require.resolve('firebase-functions')] = {
  exports: {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  },
};

const {
  resolveFolderId,
  invalidateSettingsCache,
} = require('../src/drive/liveSettings');

function reset(doc) {
  currentDoc = doc;
  fetchCalls = 0;
  invalidateSettingsCache();
}

test('Firestore value wins over env fallback when present', async () => {
  reset({ bindings: { activeProjects: { folderId: 'from-firestore' } } });
  const id = await resolveFolderId('activeProjects', () => 'from-env');
  assert.equal(id, 'from-firestore');
});

test('falls back to env when the slot is unset in Firestore', async () => {
  reset({ bindings: { archive: { folderId: 'archive-id' } } });
  const id = await resolveFolderId('activeProjects', () => 'from-env');
  assert.equal(id, 'from-env');
});

test('falls back to env when the whole doc is missing', async () => {
  reset(null);
  const id = await resolveFolderId('activeProjects', () => 'from-env');
  assert.equal(id, 'from-env');
});

test('empty Firestore string yields env fallback (not empty)', async () => {
  reset({ bindings: { activeProjects: { folderId: '   ' } } });
  const id = await resolveFolderId('activeProjects', () => 'from-env');
  assert.equal(id, 'from-env');
});

test('trims whitespace from Firestore-sourced IDs', async () => {
  reset({ bindings: { activeProjects: { folderId: '  id-with-spaces  ' } } });
  const id = await resolveFolderId('activeProjects', () => 'from-env');
  assert.equal(id, 'id-with-spaces');
});

test('cache is used within TTL — second call does not re-fetch', async () => {
  reset({ bindings: { activeProjects: { folderId: 'cached' } } });
  await resolveFolderId('activeProjects', () => '');
  await resolveFolderId('activeProjects', () => '');
  await resolveFolderId('archive', () => ''); // different slot, same doc read
  assert.equal(fetchCalls, 1, 'exactly one Firestore read for 3 calls within TTL');
});

test('invalidateSettingsCache forces a re-fetch', async () => {
  reset({ bindings: { activeProjects: { folderId: 'v1' } } });
  await resolveFolderId('activeProjects', () => '');
  invalidateSettingsCache();
  currentDoc = { bindings: { activeProjects: { folderId: 'v2' } } };
  const id = await resolveFolderId('activeProjects', () => '');
  assert.equal(id, 'v2');
  assert.equal(fetchCalls, 2);
});

test('env fallback thunk that throws is treated as empty', async () => {
  reset(null);
  const id = await resolveFolderId('activeProjects', () => {
    throw new Error('defineString not bound');
  });
  assert.equal(id, '');
});
