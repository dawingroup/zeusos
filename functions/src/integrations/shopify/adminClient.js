/**
 * Shared Shopify Admin API client.
 *
 * - Reads config from systemConfig/shopifyConfig (shopDomain, accessToken).
 * - Wraps REST + GraphQL with jittered backoff retry on 429/5xx.
 * - Tracks GraphQL cost-bucket headers and pauses when the bucket dips below
 *   a safe threshold (Shopify Admin: 1000-point bucket, 50/sec refill).
 * - Emits structured logs: { entity, dawin_id, shopify_gid, action, duration_ms }.
 *
 * Cost reference (from Shopify docs):
 *   - simple query: 1 pt
 *   - metaobjectCreate/Update: 10 pts
 *   - metaobjectDefinitionCreate/Update: 10 pts
 *   - fileCreate: 10 pts
 *
 * Single-source-of-truth helpers exported:
 *   - getShopifyConfig()
 *   - shopifyRest(config, path, init)
 *   - shopifyGraphQL(config, query, variables)
 *   - pingIndexNow(url) -> best-effort, no throw
 */

const { logger } = require('firebase-functions');
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const SHOPIFY_API_VERSION = '2024-01';
const SHOPIFY_CONFIG_DOC = 'systemConfig/shopifyConfig';
const COST_FLOOR = 200; // pause when bucket dips below this
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 250;

let cachedConfig = null;
let cachedConfigFetchedAt = 0;
const CONFIG_CACHE_TTL_MS = 60_000;

async function getShopifyConfig({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedConfig && now - cachedConfigFetchedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }
  const snap = await getFirestore().doc(SHOPIFY_CONFIG_DOC).get();
  if (!snap.exists) {
    throw new HttpsError(
      'failed-precondition',
      `Shopify not configured. Set ${SHOPIFY_CONFIG_DOC} with { shopDomain, accessToken }.`
    );
  }
  const config = snap.data();
  if (!config.shopDomain || !config.accessToken) {
    throw new HttpsError(
      'failed-precondition',
      `${SHOPIFY_CONFIG_DOC} is missing shopDomain or accessToken`
    );
  }
  cachedConfig = config;
  cachedConfigFetchedAt = now;
  return config;
}

function jitteredBackoff(attempt) {
  const base = BASE_BACKOFF_MS * Math.pow(2, attempt);
  return base + Math.floor(Math.random() * base);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetry(status) {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * REST call. Path begins with /, e.g. "/blogs.json".
 */
async function shopifyRest(config, path, init = {}) {
  const url = `https://${config.shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  const headers = {
    'X-Shopify-Access-Token': config.accessToken,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { ...init, headers });
    const body = await res.text();
    if (res.ok) {
      logger.debug('shopify.rest', {
        method: init.method || 'GET',
        path,
        status: res.status,
        duration_ms: Date.now() - startedAt,
        attempt,
      });
      return body ? JSON.parse(body) : {};
    }
    if (shouldRetry(res.status) && attempt < MAX_RETRIES) {
      const delay = jitteredBackoff(attempt);
      logger.warn('shopify.rest.retry', { path, status: res.status, attempt, delay });
      await sleep(delay);
      continue;
    }
    throw new HttpsError(
      'internal',
      `Shopify REST ${init.method || 'GET'} ${path} failed: ${res.status} ${body}`
    );
  }
  // unreachable
  throw new HttpsError('internal', `Shopify REST ${path} exhausted retries`);
}

/**
 * GraphQL call. Throws on user errors via the caller's `userErrors` field
 * inspection — this helper only throws for transport / top-level `errors`.
 *
 * `context` is an optional object for structured logging:
 *   { entity, dawin_id, action, shopify_gid }
 */
async function shopifyGraphQL(config, query, variables = {}, context = {}) {
  const url = `https://${config.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const headers = {
    'X-Shopify-Access-Token': config.accessToken,
    'Content-Type': 'application/json',
  };
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.text();

    if (res.ok) {
      const json = JSON.parse(body);
      if (json.errors) {
        throw new HttpsError(
          'internal',
          `Shopify GraphQL errors: ${JSON.stringify(json.errors)} (context=${JSON.stringify(context)})`
        );
      }
      const cost = json.extensions?.cost;
      if (cost?.throttleStatus?.currentlyAvailable != null) {
        if (cost.throttleStatus.currentlyAvailable < COST_FLOOR) {
          const restoreMs = Math.ceil(
            (COST_FLOOR - cost.throttleStatus.currentlyAvailable) /
              (cost.throttleStatus.restoreRate || 50) *
              1000
          );
          logger.warn('shopify.graphql.cost-throttle-pause', {
            available: cost.throttleStatus.currentlyAvailable,
            restoreRate: cost.throttleStatus.restoreRate,
            pause_ms: restoreMs,
            ...context,
          });
          await sleep(restoreMs);
        }
      }
      logger.debug('shopify.graphql', {
        ...context,
        duration_ms: Date.now() - startedAt,
        attempt,
        requested_cost: cost?.requestedQueryCost,
        actual_cost: cost?.actualQueryCost,
      });
      return json.data;
    }
    if (shouldRetry(res.status) && attempt < MAX_RETRIES) {
      const delay = jitteredBackoff(attempt);
      logger.warn('shopify.graphql.retry', { ...context, status: res.status, attempt, delay });
      await sleep(delay);
      continue;
    }
    throw new HttpsError('internal', `Shopify GraphQL failed: ${res.status} ${body}`);
  }
  throw new HttpsError('internal', 'Shopify GraphQL exhausted retries');
}

/**
 * Best-effort IndexNow ping for a freshly-published URL.
 * Reads `indexNowKey` and `indexNowKeyHost` from systemConfig/shopifyConfig.
 * Silently no-ops if not configured. Never throws.
 */
async function pingIndexNow(publishedUrl) {
  try {
    const config = await getShopifyConfig();
    if (!config.indexNowKey) return;
    const host = config.indexNowKeyHost || `${config.shopDomain}`;
    const url = new URL('https://api.indexnow.org/indexnow');
    url.searchParams.set('url', publishedUrl);
    url.searchParams.set('key', config.indexNowKey);
    url.searchParams.set('host', host);
    const res = await fetch(url.toString(), { method: 'GET' });
    logger.debug('shopify.indexnow', { url: publishedUrl, status: res.status });
  } catch (err) {
    logger.warn('shopify.indexnow.failed', { error: err.message || String(err) });
  }
}

module.exports = {
  SHOPIFY_API_VERSION,
  SHOPIFY_CONFIG_DOC,
  getShopifyConfig,
  shopifyRest,
  shopifyGraphQL,
  pingIndexNow,
};
