/**
 * Marketing -> BigQuery sync
 *
 * Streams Firestore snapshots for marketing-module entities into BigQuery so the
 * analytics dashboards and benchmark queries can run without scanning Firestore.
 *
 * Modeled on functions/src/intelligence/operationalBigQuerySync.js.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

const DATASET = process.env.BIGQUERY_OPERATIONAL_DATASET || 'dawinos_operational';

function timestampToIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function toJSONString(value) {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (err) {
    logger.warn('Failed to JSON stringify value for BigQuery', err);
    return null;
  }
}

function getBigQueryTable(tableName) {
  const { BigQuery } = require('@google-cloud/bigquery');
  const bigquery = new BigQuery();
  return bigquery.dataset(DATASET).table(tableName);
}

async function insertRows(tableName, rows) {
  if (!rows.length) return;
  try {
    const table = getBigQueryTable(tableName);
    await table.insert(rows, { ignoreUnknownValues: true, skipInvalidRows: true });
  } catch (err) {
    logger.warn(`[BigQuery] Insert warning (${tableName})`, err?.message || err);
  }
}

function operationFromEvent(event) {
  const before = event.data?.before?.exists;
  const after = event.data?.after?.exists;
  if (after && !before) return 'CREATE';
  if (after && before) return 'UPDATE';
  return 'DELETE';
}

function mapSocialPostRow(docId, data, operation, eventId) {
  const capturedAtIso = new Date().toISOString();
  return {
    snapshot_id: `${docId}_${capturedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    post_id: docId,
    company_id: data?.companyId || null,
    subsidiary_id: data?.subsidiaryId || null,
    campaign_id: data?.campaignId || null,
    title: data?.title || null,
    status: data?.status || null,
    platforms_json: toJSONString(data?.platforms),
    social_account_ids_json: toJSONString(data?.socialAccountIds),
    media_type: data?.mediaType || null,
    scheduled_for: timestampToIso(data?.scheduledFor),
    published_at: timestampToIso(data?.publishedAt),
    created_by: data?.createdBy || null,
    created_at: timestampToIso(data?.createdAt),
    updated_at: timestampToIso(data?.updatedAt),
    captured_at: capturedAtIso,
  };
}

function mapSocialAccountRow(docId, data, operation, eventId) {
  const capturedAtIso = new Date().toISOString();
  return {
    snapshot_id: `${docId}_${capturedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    account_id: docId,
    subsidiary_id: data?.subsidiaryId || null,
    platform: data?.platform || null,
    display_name: data?.displayName || null,
    handle: data?.handle || null,
    profile_url: data?.profileUrl || null,
    status: data?.status || null,
    tracking_enabled: data?.trackingEnabled ?? null,
    oauth_enabled: data?.oauthEnabled ?? null,
    last_synced_at: timestampToIso(data?.lastSyncedAt),
    created_at: timestampToIso(data?.createdAt),
    updated_at: timestampToIso(data?.updatedAt),
    captured_at: capturedAtIso,
  };
}

const onSocialMediaPostWritten = onDocumentWritten(
  'socialMediaPosts/{postId}',
  async (event) => {
    const operation = operationFromEvent(event);
    const docId = event.params.postId;
    const data = (operation === 'DELETE' ? event.data?.before?.data() : event.data?.after?.data()) || {};
    await insertRows('social_media_posts_snapshots', [
      mapSocialPostRow(docId, data, operation, event.id),
    ]);
  }
);

const onSocialMediaAccountWrittenBQ = onDocumentWritten(
  'socialMediaAccounts/{accountId}',
  async (event) => {
    const operation = operationFromEvent(event);
    const docId = event.params.accountId;
    const data = (operation === 'DELETE' ? event.data?.before?.data() : event.data?.after?.data()) || {};
    await insertRows('social_media_accounts_snapshots', [
      mapSocialAccountRow(docId, data, operation, event.id),
    ]);
  }
);

module.exports = {
  onSocialMediaPostWritten,
  onSocialMediaAccountWrittenBQ,
};
