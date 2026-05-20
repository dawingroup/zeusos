/**
 * Meta publish adapters — Facebook Page feed + Instagram Business publishing.
 *
 * Both adapters take a decrypted token bundle (from auth.getDecryptedTokenForAccount)
 * plus the SocialMediaPost data, and return { platformPostId, permalink } on success.
 *
 * Reuses the fetchWithTimeout + retry pattern style from
 * functions/src/integrations/meta/metaCloudApiClient.js for consistency.
 */

const fetch = require('node-fetch');
const { logger } = require('firebase-functions');
const { META_BASE_URL } = require('./auth');

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function metaCall(url, options = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        const msg =
          json.error?.message ||
          json.error_description ||
          `${res.status} ${res.statusText}`;
        const code = json.error?.code;
        const subcode = json.error?.error_subcode;
        // Retry on transient (rate limit 4 / 17, internal 1, 2)
        if ([1, 2, 4, 17, 32, 613].includes(code) && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        const error = new Error(msg);
        error.code = code;
        error.subcode = subcode;
        error.status = res.status;
        throw error;
      }
      return json;
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError' && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Facebook Page feed ────────────────────────────────────────────────────

async function publishToFacebook({ pageId, pageAccessToken, post, media }) {
  const message = post.content || post.title || '';
  const url = `${META_BASE_URL}/${pageId}/${media.length > 0 ? 'photos' : 'feed'}`;
  const body = new URLSearchParams();
  body.set('access_token', pageAccessToken);

  if (media.length === 0) {
    // Text-only post → /feed
    body.set('message', message);
  } else if (media.length === 1) {
    // Single image → /photos with url
    body.set('url', media[0]);
    body.set('caption', message);
    body.set('published', 'true');
  } else {
    // Multi-image: upload each as unpublished, then create a feed post linking them.
    const photoIds = [];
    for (const mediaUrl of media.slice(0, 10)) {
      const photoRes = await metaCall(`${META_BASE_URL}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          url: mediaUrl,
          published: 'false',
          access_token: pageAccessToken,
        }).toString(),
      });
      if (photoRes.id) photoIds.push(photoRes.id);
    }
    const feedUrl = `${META_BASE_URL}/${pageId}/feed`;
    const feedBody = new URLSearchParams();
    feedBody.set('access_token', pageAccessToken);
    feedBody.set('message', message);
    photoIds.forEach((id, i) => {
      feedBody.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }));
    });
    const feedRes = await metaCall(feedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: feedBody.toString(),
    });
    const permalink = await getFacebookPermalink(feedRes.id, pageAccessToken);
    return { platformPostId: feedRes.id, permalink };
  }

  const res = await metaCall(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const platformPostId = res.post_id || res.id;
  const permalink = await getFacebookPermalink(platformPostId, pageAccessToken);
  return { platformPostId, permalink };
}

async function getFacebookPermalink(postId, accessToken) {
  if (!postId) return null;
  try {
    const url = `${META_BASE_URL}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    return json.permalink_url || null;
  } catch {
    return null;
  }
}

// ─── Instagram Business ────────────────────────────────────────────────────

async function publishToInstagram({ igUserId, pageAccessToken, post, media }) {
  if (media.length === 0) {
    throw new Error('Instagram requires at least one image or video URL');
  }
  const caption = post.content || post.title || '';
  const mediaType = post.mediaType || 'image';

  let creationId;
  if (media.length === 1) {
    // Single media container
    const params = new URLSearchParams();
    params.set('access_token', pageAccessToken);
    if (mediaType === 'reel' || mediaType === 'video') {
      params.set('media_type', 'REELS');
      params.set('video_url', media[0]);
    } else if (mediaType === 'story') {
      params.set('media_type', 'STORIES');
      params.set('image_url', media[0]);
    } else {
      params.set('image_url', media[0]);
    }
    params.set('caption', caption);
    const containerRes = await metaCall(`${META_BASE_URL}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    creationId = containerRes.id;
  } else {
    // Carousel: create per-item containers, then a parent container
    const childIds = [];
    for (const mediaUrl of media.slice(0, 10)) {
      const itemParams = new URLSearchParams();
      itemParams.set('access_token', pageAccessToken);
      itemParams.set('image_url', mediaUrl);
      itemParams.set('is_carousel_item', 'true');
      const itemRes = await metaCall(`${META_BASE_URL}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: itemParams.toString(),
      });
      if (itemRes.id) childIds.push(itemRes.id);
    }
    if (childIds.length < 2) {
      throw new Error('Carousel requires at least 2 valid items');
    }
    const parentParams = new URLSearchParams();
    parentParams.set('access_token', pageAccessToken);
    parentParams.set('media_type', 'CAROUSEL');
    parentParams.set('caption', caption);
    parentParams.set('children', childIds.join(','));
    const parentRes = await metaCall(`${META_BASE_URL}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: parentParams.toString(),
    });
    creationId = parentRes.id;
  }

  // Reels need polling — wait up to 30s for FINISHED before publish
  if (mediaType === 'reel' || mediaType === 'video') {
    await waitForIgContainer(creationId, pageAccessToken);
  }

  // Publish the container
  const publishRes = await metaCall(`${META_BASE_URL}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: pageAccessToken,
    }).toString(),
  });

  const platformPostId = publishRes.id;
  const permalink = await getInstagramPermalink(platformPostId, pageAccessToken);
  return { platformPostId, permalink };
}

async function waitForIgContainer(creationId, accessToken, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const url = `${META_BASE_URL}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    const code = json.status_code;
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`Container ${creationId} ${code}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  logger.warn(`[publishToInstagram] container ${creationId} did not finish within ${timeoutMs}ms; publishing anyway`);
}

async function getInstagramPermalink(mediaId, accessToken) {
  if (!mediaId) return null;
  try {
    const url = `${META_BASE_URL}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    return json.permalink || null;
  } catch {
    return null;
  }
}

module.exports = {
  publishToFacebook,
  publishToInstagram,
};
