/**
 * getSocialBenchmark — callable that returns an Own-vs-Market series for the
 * analytics page. Reads from BigQuery `social_intelligence.account_metrics`,
 * caches results for 1h in Firestore (socialBenchmarkCache) to avoid repeat scans.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const CACHE_COLLECTION = 'socialBenchmarkCache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const ALLOWED_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube'];
const ALLOWED_METRICS = ['followers', 'engagementRate', 'avgLikesPerPost'];

const METRIC_COL = {
  followers: 'followers',
  engagementRate: 'engagement_rate',
  avgLikesPerPost: 'avg_likes_per_post',
};

function cacheKey({ subsidiaryId, platform, metric, rangeDays }) {
  return `${subsidiaryId}__${platform}__${metric}__${rangeDays}`;
}

const getSocialBenchmark = onCall(
  { cors: true, timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { subsidiaryId, platform, metric, rangeDays } = request.data || {};
    if (!subsidiaryId || !platform || !metric || !rangeDays) {
      throw new HttpsError(
        'invalid-argument',
        'subsidiaryId, platform, metric, rangeDays are required'
      );
    }
    if (!ALLOWED_PLATFORMS.includes(platform)) {
      throw new HttpsError('invalid-argument', `Unsupported platform: ${platform}`);
    }
    if (!ALLOWED_METRICS.includes(metric)) {
      throw new HttpsError('invalid-argument', `Unsupported metric: ${metric}`);
    }
    const range = Math.min(Math.max(parseInt(rangeDays, 10) || 30, 7), 365);

    const key = cacheKey({ subsidiaryId, platform, metric, rangeDays: range });
    const cacheRef = db.collection(CACHE_COLLECTION).doc(key);

    const cached = await cacheRef.get();
    if (cached.exists) {
      const c = cached.data();
      if (c?.generatedAt && Date.now() - c.generatedAt < CACHE_TTL_MS) {
        return { ...c.payload, cached: true };
      }
    }

    let series = [];
    try {
      const { BigQuery } = require('@google-cloud/bigquery');
      const bigquery = new BigQuery();
      const col = METRIC_COL[metric];
      const sql = `
        SELECT
          DATE(captured_at) AS day,
          account_type,
          AVG(${col}) AS value
        FROM \`social_intelligence.account_metrics\`
        WHERE platform = @platform
          AND captured_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
          AND (
            (account_type = 'own' AND subsidiary_id = @subsidiaryId)
            OR account_type = 'competitor'
          )
        GROUP BY day, account_type
        ORDER BY day ASC
      `;
      const [rows] = await bigquery.query({
        query: sql,
        params: { platform, days: range, subsidiaryId },
      });

      const byDay = new Map();
      rows.forEach((r) => {
        const day = typeof r.day === 'string' ? r.day : r.day?.value;
        if (!day) return;
        const entry = byDay.get(day) || { date: day, ownValue: 0, marketAvg: 0 };
        if (r.account_type === 'own') entry.ownValue = Number(r.value) || 0;
        else entry.marketAvg = Number(r.value) || 0;
        byDay.set(day, entry);
      });
      series = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      logger.warn('[getSocialBenchmark] BQ query failed, returning empty series', err?.message || err);
    }

    const payload = {
      metric,
      platform,
      subsidiaryId,
      series,
      generatedAt: Date.now(),
      cached: false,
    };

    await cacheRef
      .set({ payload, generatedAt: payload.generatedAt }, { merge: true })
      .catch((err) => logger.warn('[getSocialBenchmark] cache write failed', err));

    return payload;
  }
);

module.exports = { getSocialBenchmark };
