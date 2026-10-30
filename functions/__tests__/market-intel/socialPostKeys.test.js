/**
 * Social rows carry information or they are not written (audit 2026-10,
 * B5 / D-4): natural ids only, deterministic document ids, zero metrics refused.
 *
 *    cd functions && node --test __tests__/market-intel/socialPostKeys.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const k = require('../../src/lib/socialPostKeys');

test('naturalPostId: first non-empty platform id, numbers allowed, synthetic ids and blanks refused', () => {
  assert.equal(k.naturalPostId(undefined, '', 'C1a2b3'), 'C1a2b3');
  assert.equal(k.naturalPostId(1234567890123), '1234567890123');
  assert.equal(k.naturalPostId('  '), null);
  assert.equal(k.naturalPostId(), null);
  assert.equal(k.naturalPostId('tw_1700000000000_0.123456', 'abc'), 'abc', 'a synthetic id is skipped, not kept');
});

test('isSyntheticPostId recognises every prefix the tracker used to mint', () => {
  for (const p of ['ig', 'tw', 'tt', 'fb', 'yt', 'post']) {
    assert.equal(k.isSyntheticPostId(`${p}_1761728400000_0.5312`), true, p);
  }
  assert.equal(k.isSyntheticPostId('post_1'), false);
  assert.equal(k.isSyntheticPostId(42), false);
});

test('socialPostDocId is {platform}_{postId}, lower-cased platform, path-safe id', () => {
  assert.equal(k.socialPostDocId('Instagram', 'C1a2b3'), 'instagram_C1a2b3');
  assert.equal(k.socialPostDocId('tiktok', 'a/b c'), 'tiktok_a_b_c');
  assert.equal(k.socialPostDocId(undefined, '7'), 'unknown_7');
  assert.equal(k.socialPostDocId('X (Twitter)', '9'), 'x_twitter__9');
});

test('a post without a natural id is a shell; a metrics row with every count zero is a shell', () => {
  assert.equal(k.isInformationFreePost({ postId: null }), true);
  assert.equal(k.isInformationFreePost({ postId: 'tw_1700000000000_0.5' }), true);
  assert.equal(k.isInformationFreePost({ postId: 'abc' }), false);
  assert.equal(k.isInformationFreeMetrics({ followers: 0, following: 0, totalPosts: 0 }), true);
  assert.equal(k.isInformationFreeMetrics({}), true);
  assert.equal(k.isInformationFreeMetrics({ followers: 12 }), false);
  assert.equal(k.isInformationFreeMetrics({ totalPosts: '3' }), false);
});

test('the tracker no longer mints synthetic ids and keys posts by platform + id', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'intelligence', 'socialTrackerFunctions.js'), 'utf8');
  assert.doesNotMatch(src, /\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\}/, 'no synthetic post id fallback');
  assert.equal((src.match(/naturalPostId\(/g) || []).length, 6, 'all six platform mappers use naturalPostId');
  assert.match(src, /\.doc\(socialPostDocId\(post\.platform, post\.postId\)\)/);
  assert.match(src, /isInformationFreeMetrics\(metrics\)/);
});
