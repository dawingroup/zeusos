/**
 * Social rows carry information or they are not written
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, finding B5 / D-4).
 *
 * The social tracker used to fall back to `` `tw_${Date.now()}_${Math.random()}` ``
 * (and `ig_`, `fb_`, `tt_`, `yt_`, `post_`) when the scraper returned no
 * post id. In DawinOS that produced 2,685 synthetic ids in a 3,000-row
 * sample — no natural key, no dedupe, and the rows were mirrored to
 * BigQuery. ZeusOS has never written a social row, so the rule is set
 * before the first one lands:
 *
 *   - a post needs a NATURAL id from the platform, or it is refused;
 *   - the document id is `{platform}_{postId}`, so a re-sighting is an
 *     update of the same document, never a second row;
 *   - a metrics row whose every count is zero carries no information and
 *     is refused.
 *
 * Pure, so functions/__tests__/market-intel/socialPostKeys.test.js pins it.
 */
'use strict';

const SYNTHETIC_POST_ID = /^(ig|tw|tt|fb|yt|post)_\d{10,}_0\.\d+$/;

/** The first non-empty candidate as a trimmed string, else null. */
function naturalPostId(...candidates) {
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const s = String(c).trim();
    if (s !== '' && !isSyntheticPostId(s)) return s;
  }
  return null;
}

function isSyntheticPostId(value) {
  return typeof value === 'string' && SYNTHETIC_POST_ID.test(value);
}

/** Deterministic document id: `{platform}_{postId}` with path-unsafe characters folded. */
function socialPostDocId(platform, postId) {
  const p = String(platform || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const id = String(postId).trim().replace(/[\/\s]+/g, '_');
  return `${p}_${id}`;
}

/** A post without a natural id is a shell: refuse it. */
function isInformationFreePost(post) {
  return !post || typeof post !== 'object' || !naturalPostId(post.postId);
}

const METRIC_COUNT_FIELDS = Object.freeze(['followers', 'following', 'totalPosts']);

/** Every account count is zero or missing → nothing was measured. */
function isInformationFreeMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') return true;
  return METRIC_COUNT_FIELDS.every((f) => !(Number(metrics[f]) > 0));
}

module.exports = {
  SYNTHETIC_POST_ID,
  METRIC_COUNT_FIELDS,
  naturalPostId,
  isSyntheticPostId,
  socialPostDocId,
  isInformationFreePost,
  isInformationFreeMetrics,
};
