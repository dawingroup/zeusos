/**
 * Social Intelligence Cloud Functions
 * DawinOS v2.0 - Market Intelligence Module
 * Tracks competitor social media metrics via scraper API (Apify),
 * stores in Firestore + BigQuery, and enriches with Gemini AI analysis.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { parseGeminiJSON } = require('./intelligenceUtils');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const SOCIAL_SCRAPER_API_KEY = defineSecret('SOCIAL_SCRAPER_API_KEY');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ============================================================================
// CONSTANTS
// ============================================================================

const SOCIAL_POSTS_COLLECTION = 'social_posts';
const SOCIAL_METRICS_COLLECTION = 'social_metrics';
const DIGITAL_PROFILES_COLLECTION = 'digital_profiles';
const SOCIAL_ACCOUNTS_COLLECTION = 'socialMediaAccounts';

const SOCIAL_PLATFORMS = ['instagram', 'twitter', 'tiktok', 'facebook', 'linkedin', 'youtube'];

/**
 * Extract a profile handle/username from a social media URL.
 * E.g. "https://instagram.com/nike" → "nike"
 */
function extractHandleFromUrl(url, platform) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const p = platform || 'other';
    switch (p) {
      case 'instagram':
      case 'twitter':
      case 'pinterest':
      case 'github':
      case 'medium':
        return (segments[0] || '').replace(/^@/, '') || null;
      case 'tiktok':
        return (segments[0] || '').replace(/^@/, '') || null;
      case 'facebook':
        return segments[0] || null;
      case 'linkedin':
        if (segments[0] === 'company' && segments[1]) return segments[1];
        if (segments[0] === 'in' && segments[1]) return segments[1];
        return segments[0] || null;
      case 'youtube': {
        const last = segments[segments.length - 1];
        return (last || '').replace(/^@/, '') || null;
      }
      default:
        return segments[segments.length - 1] || null;
    }
  } catch (_) {
    return null;
  }
}

// Apify actor IDs for each platform (Updated 2026-02-16)
// Using verified working actors with correct IDs
const APIFY_ACTORS = {
  instagram: 'apify/instagram-scraper',              // Official Apify – returns 'caption'
  twitter:   'apidojo/tweet-scraper',                // apify/twitter-scraper is deprecated; apidojo returns full_text
  tiktok:    'clockworks/tiktok-scraper',            // 'free-tiktok-scraper' does not exist; returns 'desc'
  facebook:  'apify/facebook-posts-scraper',         // Official Apify – returns 'text'/'message'
  youtube:   null,                                   // Disabled – paid actors failing
  linkedin:  null,                                   // Disabled – requires rental
};

// ============================================================================
// HELPERS
// ============================================================================

// parseGeminiJSON is now imported from intelligenceUtils.js

/**
 * Strip undefined values from an object (Firestore rejects undefined)
 */
function cleanUndefined(obj) {
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Exponential backoff wrapper for API calls with 429 handling
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`Rate limited (429). Waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries}): ${err.message}. Retrying in ${waitMs}ms`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

/**
 * Fetch social data from Apify actor
 */
async function fetchFromApify(apiKey, platform, profileHandle) {
  const actorId = APIFY_ACTORS[platform];
  if (!actorId) {
    console.warn(`Apify scraping disabled for ${platform} (paid actor required or not configured)`);
    return null;
  }

  // Apify API v2 requires tilde separator (username~actor-name)
  // Store format uses slash (username/actor-name), so we transform it
  const apiActorId = actorId.replace('/', '~');
  const actorUrl = `https://api.apify.com/v2/acts/${apiActorId}/run-sync-get-dataset-items`;

  // Build platform-specific input (each actor has its own input schema)
  let input = {};
  switch (platform) {
    case 'instagram':
      // apify/instagram-scraper expects directUrls and resultsType
      input = {
        directUrls: [`https://www.instagram.com/${profileHandle}/`],
        resultsType: 'posts',
        resultsLimit: 20,
      };
      break;
    case 'twitter':
      // apidojo/tweet-scraper expects startUrls array with url objects
      input = {
        startUrls: [{ url: `https://twitter.com/${profileHandle}` }],
        maxItems: 20,
      };
      break;
    case 'tiktok':
      // clockworks/tiktok-scraper expects full profile URLs in profiles array
      input = {
        profiles: [`https://www.tiktok.com/@${profileHandle}`],
        resultsPerPage: 20,
      };
      break;
    case 'facebook':
      // apify/facebook-posts-scraper expects startUrls and resultsLimit (not maxPosts)
      input = {
        startUrls: [{ url: `https://www.facebook.com/${profileHandle}` }],
        resultsLimit: 20,
      };
      break;
    default:
      return null;
  }

  try {
    const data = await fetchWithRetry(
      `${actorUrl}?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    );

    return data;
  } catch (err) {
    console.error(`Apify fetch failed for ${platform}/${profileHandle}:`, err.message);
    return null;
  }
}

/**
 * Normalize scraped data into a standard post format
 */
function normalizePosts(platform, rawData, competitorId, profileId, ownership = null) {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  return rawData.map(item => {
    const base = {
      competitorId,
      profileId,
      platform,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'apify',
      // Own/competitor bridge fields (null for legacy competitor profiles)
      accountType: ownership?.accountType || 'competitor',
      subsidiaryId: ownership?.subsidiaryId || null,
      dawinosAccountId: ownership?.dawinosAccountId || null,
    };

    switch (platform) {
      case 'instagram':
        return {
          ...base,
          postId: item.id || item.shortCode || `ig_${Date.now()}_${Math.random()}`,
          contentText: item.caption || '',
          contentType: item.type || 'image',
          mediaUrls: item.displayUrl ? [item.displayUrl] : [],
          hashtags: (item.caption || '').match(/#\w+/g) || [],
          mentions: (item.caption || '').match(/@\w+/g) || [],
          likes: item.likesCount || 0,
          comments: item.commentsCount || 0,
          shares: 0,
          views: item.videoViewCount || 0,
          saves: 0,
          publishedAt: item.timestamp ? new Date(item.timestamp) : new Date(),
        };

      case 'twitter':
        // apidojo/tweet-scraper returns: full_text, favorite_count, retweet_count, reply_count,
        // view_count, bookmark_count, created_at, extended_entities.media, entities.hashtags/user_mentions
        return {
          ...base,
          postId:      item.id || item.tweetId || `tw_${Date.now()}_${Math.random()}`,
          contentText: item.full_text || item.text || '',
          contentType: 'text',
          mediaUrls:   (item.extended_entities?.media || item.entities?.media || [])
                         .map(m => m.media_url_https || m.media_url)
                         .filter(Boolean),
          hashtags:    (item.entities?.hashtags || []).map(h => `#${h.text || h.tag}`),
          mentions:    (item.entities?.user_mentions || []).map(m => `@${m.screen_name}`),
          likes:       item.favorite_count  || item.likeCount    || 0,
          comments:    item.reply_count     || item.replyCount   || 0,
          shares:      item.retweet_count   || item.retweetCount || 0,
          views:       item.viewCount       || 0,
          saves:       item.bookmarkCount   || 0,
          publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
        };

      case 'tiktok':
        // clockworks/tiktok-scraper returns: desc (primary text), textExtra (hashtags),
        // diggCount/commentCount/shareCount/playCount in stats or top-level,
        // video.downloadAddr for video URL, createTime (unix seconds)
        return {
          ...base,
          postId:      item.id || `tt_${Date.now()}_${Math.random()}`,
          contentText: item.desc || item.text || '',
          contentType: 'video',
          mediaUrls:   item.video?.downloadAddr
                         ? [item.video.downloadAddr]
                         : (item.videoUrl ? [item.videoUrl] : []),
          hashtags:    (item.textExtra || [])
                         .filter(t => t.hashtagName)
                         .map(t => `#${t.hashtagName}`),
          mentions:    (item.desc || '').match(/@\w+/g) || [],
          likes:       item.diggCount    || item.stats?.diggCount    || 0,
          comments:    item.commentCount || item.stats?.commentCount || 0,
          shares:      item.shareCount   || item.stats?.shareCount   || 0,
          views:       item.playCount    || item.stats?.playCount    || 0,
          saves:       item.collectCount || 0,
          publishedAt: item.createTime ? new Date(item.createTime * 1000) : new Date(),
        };

      case 'facebook':
        // apify/facebook-posts-scraper returns: text or message (post body), likesCount,
        // commentsCount, sharesCount, viewsCount, postId, media array, time (unix seconds)
        return {
          ...base,
          postId:      item.postId || item.id || `fb_${Date.now()}_${Math.random()}`,
          contentText: item.text || item.message || item.caption || '',
          contentType: item.media?.length ? 'image' : 'text',
          mediaUrls:   (item.media || []).map(m => m.url || m.thumbnail).filter(Boolean),
          hashtags:    (item.text || item.message || '').match(/#\w+/g) || [],
          mentions:    (item.text || item.message || '').match(/@\w+/g) || [],
          likes:       item.likesCount    || item.reactionsCount || item.likes    || 0,
          comments:    item.commentsCount || item.comments       || 0,
          shares:      item.sharesCount   || item.shares         || 0,
          views:       item.viewsCount    || item.views          || 0,
          saves:       0,
          publishedAt: item.time ? new Date(item.time * 1000)
                        : (item.date ? new Date(item.date) : new Date()),
        };

      case 'youtube':
        return {
          ...base,
          postId: item.id || item.videoId || `yt_${Date.now()}_${Math.random()}`,
          contentText: item.title || '',
          contentType: 'video',
          mediaUrls: item.thumbnailUrl ? [item.thumbnailUrl] : [],
          hashtags: (item.tags || []).map(t => `#${t}`),
          mentions: [],
          likes: item.likes || 0,
          comments: item.commentCount || 0,
          shares: 0,
          views: item.viewCount || 0,
          saves: 0,
          publishedAt: item.date ? new Date(item.date) : new Date(),
        };

      default:
        return {
          ...base,
          postId: item.id || `post_${Date.now()}_${Math.random()}`,
          contentText: item.text || item.content || item.caption || '',
          contentType: item.type || 'text',
          mediaUrls: [],
          hashtags: [],
          mentions: [],
          likes: item.likes || item.reactions || 0,
          comments: item.comments || 0,
          shares: item.shares || 0,
          views: item.views || 0,
          saves: 0,
          publishedAt: new Date(),
        };
    }
  }).filter(Boolean);
}

/**
 * Extract account-level metrics from scraped data
 */
function extractAccountMetrics(platform, rawData, competitorId, profileId, profileHandle, ownership = null) {
  if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) return null;

  // Some platforms return profile info in the first item or separately
  const profileData = Array.isArray(rawData) ? rawData[0] : rawData;

  const base = {
    metricId: `${competitorId}_${platform}_${Date.now()}`,
    competitorId,
    profileId,
    platform,
    profileHandle,
    capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'apify',
    accountType: ownership?.accountType || 'competitor',
    subsidiaryId: ownership?.subsidiaryId || null,
    dawinosAccountId: ownership?.dawinosAccountId || null,
  };

  switch (platform) {
    case 'instagram':
      return {
        ...base,
        followers: profileData.followersCount || 0,
        following: profileData.followsCount || 0,
        totalPosts: profileData.postsCount || 0,
        engagementRate: profileData.engagementRate || 0,
        avgLikesPerPost: 0,
        avgCommentsPerPost: 0,
        avgSharesPerPost: 0,
        avgViewsPerPost: 0,
      };

    case 'twitter':
      return {
        ...base,
        followers: profileData.followersCount || profileData.followers_count || 0,
        following: profileData.followingCount || profileData.friends_count || 0,
        totalPosts: profileData.statusesCount || profileData.statuses_count || 0,
        engagementRate: 0,
        avgLikesPerPost: 0,
        avgCommentsPerPost: 0,
        avgSharesPerPost: 0,
        avgViewsPerPost: 0,
      };

    case 'tiktok':
      return {
        ...base,
        followers: profileData.authorMeta?.fans || profileData.fans || 0,
        following: profileData.authorMeta?.following || 0,
        totalPosts: profileData.authorMeta?.video || 0,
        engagementRate: 0,
        avgLikesPerPost: 0,
        avgCommentsPerPost: 0,
        avgSharesPerPost: 0,
        avgViewsPerPost: 0,
      };

    case 'youtube':
      return {
        ...base,
        followers: profileData.subscriberCount || 0,
        following: 0,
        totalPosts: profileData.videoCount || 0,
        engagementRate: 0,
        avgLikesPerPost: 0,
        avgCommentsPerPost: 0,
        avgSharesPerPost: 0,
        avgViewsPerPost: profileData.averageViewCount || 0,
      };

    default:
      return {
        ...base,
        followers: profileData.followersCount || profileData.fans || 0,
        following: profileData.followingCount || 0,
        totalPosts: profileData.postsCount || 0,
        engagementRate: 0,
        avgLikesPerPost: 0,
        avgCommentsPerPost: 0,
        avgSharesPerPost: 0,
        avgViewsPerPost: 0,
      };
  }
}

/**
 * Insert data into BigQuery (best-effort — logs errors but does not fail)
 */
async function syncToBigQuery(posts, metrics) {
  try {
    const { BigQuery } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery();
    const dataset = bigquery.dataset('social_intelligence');

    // Insert posts
    if (posts.length > 0) {
      const postsTable = dataset.table('raw_posts');
      const postRows = posts.map(p => ({
        post_id: p.postId,
        competitor_id: p.competitorId,
        profile_id: p.profileId,
        platform: p.platform,
        content_text: p.contentText || null,
        content_type: p.contentType || null,
        media_urls: p.mediaUrls || [],
        hashtags: p.hashtags || [],
        mentions: p.mentions || [],
        external_url: null,
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: p.shares || 0,
        views: p.views || 0,
        saves: p.saves || 0,
        engagement_rate: p.engagementRate || null,
        ai_strategy: p.aiAnalysis?.strategy || null,
        ai_tone: p.aiAnalysis?.tone || null,
        ai_target_audience: p.aiAnalysis?.targetAudience || null,
        ai_sentiment: p.aiAnalysis?.sentiment || null,
        ai_summary: p.aiAnalysis?.summary || null,
        ai_strategic_pillars: p.aiAnalysis?.strategicPillars || [],
        ai_analyzed_at: p.aiAnalysis?.analyzedAt || null,
        published_at: p.publishedAt instanceof Date ? p.publishedAt.toISOString() : p.publishedAt,
        captured_at: new Date().toISOString(),
        source: p.source || 'apify',
        // Bridge to marketing module (NULL for competitor rows)
        account_type: p.accountType || 'competitor',
        subsidiary_id: p.subsidiaryId || null,
        dawinos_post_id: p.dawinosPostId || null,
        dawinos_account_id: p.dawinosAccountId || null,
      }));

      try {
        await postsTable.insert(postRows, { ignoreUnknownValues: true, skipInvalidRows: true });
        console.log(`BigQuery: Inserted ${postRows.length} posts`);
      } catch (bqErr) {
        console.warn('BigQuery posts insert warning:', bqErr.message);
      }
    }

    // Insert metrics
    if (metrics.length > 0) {
      const metricsTable = dataset.table('account_metrics');
      const metricRows = metrics.map(m => ({
        metric_id: m.metricId,
        competitor_id: m.competitorId,
        profile_id: m.profileId,
        platform: m.platform,
        profile_handle: m.profileHandle || null,
        followers: m.followers || 0,
        following: m.following || 0,
        total_posts: m.totalPosts || 0,
        engagement_rate: m.engagementRate || 0,
        avg_likes_per_post: m.avgLikesPerPost || 0,
        avg_comments_per_post: m.avgCommentsPerPost || 0,
        avg_shares_per_post: m.avgSharesPerPost || 0,
        avg_views_per_post: m.avgViewsPerPost || 0,
        followers_delta: m.followersDelta || 0,
        following_delta: m.followingDelta || 0,
        posts_delta: m.postsDelta || 0,
        captured_at: new Date().toISOString(),
        source: m.source || 'apify',
        // Bridge to marketing module (NULL for competitor rows)
        account_type: m.accountType || 'competitor',
        subsidiary_id: m.subsidiaryId || null,
        dawinos_account_id: m.dawinosAccountId || null,
      }));

      try {
        await metricsTable.insert(metricRows, { ignoreUnknownValues: true, skipInvalidRows: true });
        console.log(`BigQuery: Inserted ${metricRows.length} metrics`);
      } catch (bqErr) {
        console.warn('BigQuery metrics insert warning:', bqErr.message);
      }
    }
  } catch (err) {
    // BigQuery is best-effort — Firestore is the primary source of truth
    console.warn('BigQuery sync skipped (not configured or error):', err.message);
  }
}

/**
 * Save or update posts in Firestore with deduplication and batch optimization
 * @param {Array} posts - Array of normalized posts
 * @returns {Object} - { created: number, updated: number, failed: Array }
 */
async function savePostsWithDeduplication(posts) {
  if (posts.length === 0) return { created: 0, updated: 0, failed: [] };

  let created = 0;
  let updated = 0;
  const failed = [];

  // OPTIMIZATION: Batch query all postIds at once instead of N+1 queries
  const postIds = posts.map(p => p.postId).filter(Boolean);

  if (postIds.length === 0) {
    return {
      created: 0,
      updated: 0,
      failed: posts.map(p => ({
        post: 'unknown',
        reason: 'Missing postId',
      })),
    };
  }

  // Query in batches of 10 (Firestore 'in' limit)
  const existingPosts = new Map();
  for (let i = 0; i < postIds.length; i += 10) {
    const batch = postIds.slice(i, i + 10);
    const snapshot = await db.collection(SOCIAL_POSTS_COLLECTION)
      .where('postId', 'in', batch)
      .get();

    snapshot.docs.forEach(doc => {
      existingPosts.set(doc.data().postId, doc.ref);
    });
  }

  // Now process posts with existing data in memory
  const batch = db.batch();
  let batchCount = 0;

  for (const post of posts) {
    // Validate post has required fields
    if (!post.postId || !post.competitorId || !post.profileId) {
      failed.push({
        post: post.postId || 'unknown',
        reason: 'Missing required fields (postId, competitorId, or profileId)',
      });
      continue;
    }

    try {
      const existingRef = existingPosts.get(post.postId);

      if (!existingRef) {
        const newRef = db.collection(SOCIAL_POSTS_COLLECTION).doc();
        batch.set(newRef, cleanUndefined(post));
        created++;
      } else {
        batch.update(existingRef, cleanUndefined({
          ...post,
          updatedAt: admin.firestore.Timestamp.now(),
        }));
        updated++;
      }

      batchCount++;

      // Commit batch every 500 operations (Firestore limit)
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    } catch (error) {
      failed.push({
        post: post.postId,
        reason: error.message,
      });
    }
  }

  // Commit remaining operations
  if (batchCount > 0) {
    await batch.commit();
  }

  return { created, updated, failed };
}

// ============================================================================
// 1. SCHEDULED: Sync Social Metrics (every 6 hours)
// ============================================================================
const syncSocialMetrics = onSchedule({
  schedule: 'every 6 hours',
  timeZone: 'Africa/Nairobi',
  secrets: [SOCIAL_SCRAPER_API_KEY, GEMINI_API_KEY],
  timeoutSeconds: 540,
  memory: '512MiB',
}, async () => {
  console.log('Starting scheduled social metrics sync...');

  const scraperKey = SOCIAL_SCRAPER_API_KEY.value();
  if (!scraperKey) {
    console.error('SOCIAL_SCRAPER_API_KEY not configured. Skipping sync.');
    return;
  }

  // Get all tracked social profiles
  const profilesSnap = await db.collection(DIGITAL_PROFILES_COLLECTION)
    .where('isTracking', '==', true)
    .get();

  const socialProfiles = profilesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => {
      // Validate required fields
      if (!p.competitorId || typeof p.competitorId !== 'string') {
        console.warn(`Profile ${p.id} missing valid competitorId`);
        return false;
      }
      if (!p.id || typeof p.id !== 'string') {
        console.warn(`Profile missing valid id`);
        return false;
      }
      if (!SOCIAL_PLATFORMS.includes(p.platform)) {
        console.warn(`Profile ${p.id} has invalid platform: ${p.platform}`);
        return false;
      }
      return true;
    })
    .map(p => ({
      ...p,
      profileHandle: p.profileHandle || extractHandleFromUrl(p.profileUrl, p.platform),
    }))
    .filter(p => p.profileHandle);

  console.log(`Found ${socialProfiles.length} tracked social profiles`);

  const allPosts = [];
  const allMetrics = [];
  let successCount = 0;
  let errorCount = 0;

  for (const profile of socialProfiles) {
    try {
      console.log(`Fetching ${profile.platform} data for ${profile.profileHandle}...`);

      const rawData = await fetchFromApify(scraperKey, profile.platform, profile.profileHandle);
      if (!rawData) {
        console.warn(`No data returned for ${profile.platform}/${profile.profileHandle}`);
        errorCount++;
        continue;
      }

      // Build ownership context (own profile = bridges back to socialMediaAccounts/{accountId})
      const ownership = profile.accountType === 'own'
        ? {
            accountType: 'own',
            subsidiaryId: profile.ownerSubsidiaryId || null,
            dawinosAccountId: profile.dawinosAccountId || null,
          }
        : null;

      // Normalize posts
      const posts = normalizePosts(profile.platform, rawData, profile.competitorId, profile.id, ownership);

      // Save posts with optimized batch deduplication
      const saveResult = await savePostsWithDeduplication(posts);

      // Track newly created posts for BigQuery sync
      const createdPosts = posts.filter(p =>
        !saveResult.failed.some(f => f.post === p.postId)
      ).slice(0, saveResult.created);
      allPosts.push(...createdPosts);

      if (saveResult.failed.length > 0) {
        console.warn(`Failed to save ${saveResult.failed.length} posts for ${profile.competitorId}`);
      }

      // Extract and save account metrics
      const metrics = extractAccountMetrics(
        profile.platform, rawData, profile.competitorId, profile.id, profile.profileHandle, ownership
      );

      if (metrics) {
        // Calculate deltas from previous metrics
        const prevSnap = await db.collection(SOCIAL_METRICS_COLLECTION)
          .where('profileId', '==', profile.id)
          .orderBy('capturedAt', 'desc')
          .limit(1)
          .get();

        if (!prevSnap.empty) {
          const prev = prevSnap.docs[0].data();
          metrics.followersDelta = (metrics.followers || 0) - (prev.followers || 0);
          metrics.followingDelta = (metrics.following || 0) - (prev.following || 0);
          metrics.postsDelta = (metrics.totalPosts || 0) - (prev.totalPosts || 0);
        }

        // Calculate avg engagement from posts
        if (posts.length > 0) {
          const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
          const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
          const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);
          const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
          metrics.avgLikesPerPost = Math.round(totalLikes / posts.length);
          metrics.avgCommentsPerPost = Math.round(totalComments / posts.length);
          metrics.avgSharesPerPost = Math.round(totalShares / posts.length);
          metrics.avgViewsPerPost = Math.round(totalViews / posts.length);

          if (metrics.followers > 0) {
            metrics.engagementRate = parseFloat(
              (((totalLikes + totalComments + totalShares) / posts.length) / metrics.followers * 100).toFixed(2)
            );
          }
        }

        await db.collection(SOCIAL_METRICS_COLLECTION).add(cleanUndefined(metrics));
        allMetrics.push(metrics);

        // Update the digital_profiles doc with latest metrics
        await db.collection(DIGITAL_PROFILES_COLLECTION).doc(profile.id).update({
          followers: metrics.followers,
          following: metrics.following,
          totalPosts: metrics.totalPosts,
          engagement: metrics.engagementRate,
          lastScannedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // For own profiles, mirror the latest snapshot into socialAccountInsights so the
        // marketing analytics UI can render KPI cards without scanning BigQuery.
        if (ownership && ownership.dawinosAccountId) {
          await db.collection('socialAccountInsights').doc(ownership.dawinosAccountId).set(
            cleanUndefined({
              accountId: ownership.dawinosAccountId,
              subsidiaryId: ownership.subsidiaryId,
              platform: profile.platform,
              followers: metrics.followers || 0,
              following: metrics.following || 0,
              totalPosts: metrics.totalPosts || 0,
              engagementRate: (metrics.engagementRate || 0) / 100, // store as 0..1
              avgLikesPerPost: metrics.avgLikesPerPost || 0,
              avgCommentsPerPost: metrics.avgCommentsPerPost || 0,
              avgSharesPerPost: metrics.avgSharesPerPost || 0,
              avgViewsPerPost: metrics.avgViewsPerPost || 0,
              followersDelta: metrics.followersDelta || 0,
              capturedAt: admin.firestore.FieldValue.serverTimestamp(),
            }),
            { merge: true }
          );
          // Stamp the source SocialMediaAccount with sync metadata
          await db.collection(SOCIAL_ACCOUNTS_COLLECTION).doc(ownership.dawinosAccountId).update({
            lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSyncError: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => { /* doc may have been deleted */ });
        }
      }

      successCount++;
      console.log(`✓ ${profile.platform}/${profile.profileHandle}: ${posts.length} posts, metrics saved`);
    } catch (err) {
      console.error(`Error syncing ${profile.platform}/${profile.profileHandle}:`, err.message);
      errorCount++;
    }
  }

  // Best-effort BigQuery sync
  await syncToBigQuery(allPosts, allMetrics);

  console.log(`Social sync complete: ${successCount} success, ${errorCount} errors, ${allPosts.length} posts, ${allMetrics.length} metrics`);
});

// ============================================================================
// 2. ON-DEMAND: Fetch Social Posts for a specific competitor profile
// ============================================================================
const fetchSocialPosts = onCall({
  secrets: [SOCIAL_SCRAPER_API_KEY],
  cors: true,
  timeoutSeconds: 120,
  memory: '256MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { profileId } = request.data;
  if (!profileId) {
    throw new HttpsError('invalid-argument', 'profileId is required');
  }

  const scraperKey = SOCIAL_SCRAPER_API_KEY.value();
  if (!scraperKey) {
    throw new HttpsError('failed-precondition', 'SOCIAL_SCRAPER_API_KEY not configured');
  }

  // Get profile
  const profileDoc = await db.collection(DIGITAL_PROFILES_COLLECTION).doc(profileId).get();
  if (!profileDoc.exists) {
    throw new HttpsError('not-found', 'Profile not found');
  }
  const profile = { id: profileDoc.id, ...profileDoc.data() };

  if (!SOCIAL_PLATFORMS.includes(profile.platform)) {
    throw new HttpsError('invalid-argument', `Platform ${profile.platform} is not a supported social platform`);
  }

  // Fallback: extract handle from URL if not explicitly set
  if (!profile.profileHandle) {
    profile.profileHandle = extractHandleFromUrl(profile.profileUrl, profile.platform);
  }
  if (!profile.profileHandle) {
    throw new HttpsError('invalid-argument', 'Profile does not have a handle/username set. Update the profile with a valid social media URL.');
  }

  try {
    const rawData = await fetchFromApify(scraperKey, profile.platform, profile.profileHandle);
    if (!rawData) {
      throw new HttpsError('internal', 'No data returned from scraper');
    }

    const posts = normalizePosts(profile.platform, rawData, profile.competitorId, profile.id);

    // Save posts with optimized batch deduplication
    const saveResult = await savePostsWithDeduplication(posts);
    const newCount = saveResult.created;
    const updatedCount = saveResult.updated;

    if (saveResult.failed.length > 0) {
      console.warn(`Failed to save ${saveResult.failed.length} posts`);
    }

    // Extract and save metrics
    const metrics = extractAccountMetrics(
      profile.platform, rawData, profile.competitorId, profile.id, profile.profileHandle
    );
    if (metrics) {
      await db.collection(SOCIAL_METRICS_COLLECTION).add(cleanUndefined(metrics));
      await db.collection(DIGITAL_PROFILES_COLLECTION).doc(profileId).update({
        followers: metrics.followers,
        following: metrics.following,
        totalPosts: metrics.totalPosts,
        engagement: metrics.engagementRate,
        lastScannedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Best-effort BigQuery
    await syncToBigQuery(posts, metrics ? [metrics] : []);

    return {
      success: true,
      newPosts: newCount,
      updatedPosts: updatedCount,
      totalPosts: posts.length,
      metrics: metrics ? {
        followers: metrics.followers,
        engagementRate: metrics.engagementRate,
      } : null,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('fetchSocialPosts error:', err);
    throw new HttpsError('internal', `Failed to fetch social posts: ${err.message}`);
  }
});

// ============================================================================
// 3. AI: Analyze Social Strategy (Gemini 2.0 Flash)
// ============================================================================
const analyzeSocialStrategy = onCall({
  secrets: [GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 120,
  memory: '256MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { postIds, competitorId, competitorName } = request.data;

  if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
    throw new HttpsError('invalid-argument', 'postIds array is required');
  }

  if (postIds.length > 25) {
    throw new HttpsError('invalid-argument', 'Maximum 25 posts per analysis batch');
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
  }

  try {
    // Fetch posts
    const posts = [];
    for (const postId of postIds) {
      const doc = await db.collection(SOCIAL_POSTS_COLLECTION).doc(postId).get();
      if (doc.exists) {
        posts.push({ id: doc.id, ...doc.data() });
      }
    }

    if (posts.length === 0) {
      throw new HttpsError('not-found', 'No valid posts found');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { temperature: 0.3 },
        tools: [{ googleSearch: {} }],
      });
    } catch (err) {
      console.warn('Google Search grounding not available:', err.message);
      model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { temperature: 0.3 },
      });
    }

    const postTexts = posts.map((p, i) =>
      `POST ${i + 1} [${p.platform}] (${p.likes || 0} likes, ${p.comments || 0} comments, ${p.views || 0} views):\n"${(p.contentText || '').substring(0, 500)}"`
    ).join('\n\n');

    const prompt = `You are a competitive social media intelligence analyst for the Dawinos market intelligence system.

Analyze these ${posts.length} social media posts from competitor "${competitorName || 'Unknown'}":

${postTexts}

For EACH post, provide:
1. "strategy": The content strategy (one of: Educational, Promotional, FOMO, Brand-Building, Community, Thought-Leadership, Entertainment, Product-Launch, Recruitment, CSR)
2. "tone": The brand tone (one of: Professional, Casual, Aggressive, Inspirational, Sarcastic, Humorous, Authoritative, Empathetic)
3. "targetAudience": Who they are trying to reach (brief description)
4. "sentiment": Sentiment score from -1.0 (very negative) to 1.0 (very positive)
5. "summary": One-sentence summary of the post's purpose
6. "strategicPillars": Array of 1-3 strategic pillars this post supports

Also provide an overall "competitorInsight" summarizing this competitor's social media strategy.

RESPOND WITH ONLY THIS JSON:
{
  "analyses": [
    {
      "postIndex": 0,
      "strategy": "...",
      "tone": "...",
      "targetAudience": "...",
      "sentiment": 0.5,
      "summary": "...",
      "strategicPillars": ["...", "..."]
    }
  ],
  "competitorInsight": "Overall strategy summary...",
  "dominantStrategy": "Most common strategy type",
  "dominantTone": "Most common tone",
  "avgSentiment": 0.5
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJSON(responseText);

    if (!parsed || !parsed.analyses) {
      console.error('Failed to parse Gemini response for social post analysis', {
        competitorId,
        competitorName,
        postCount: posts.length,
        responsePreview: responseText.substring(0, 200),
      });
      throw new HttpsError('internal', 'Failed to parse AI analysis response');
    }

    // Save analysis results back to each post
    const now = new Date();
    for (const analysis of parsed.analyses) {
      const postIndex = analysis.postIndex;
      if (postIndex >= 0 && postIndex < posts.length) {
        const postRef = db.collection(SOCIAL_POSTS_COLLECTION).doc(posts[postIndex].id);
        await postRef.update({
          aiAnalysis: cleanUndefined({
            strategy: analysis.strategy,
            tone: analysis.tone,
            targetAudience: analysis.targetAudience,
            sentiment: analysis.sentiment,
            summary: analysis.summary,
            strategicPillars: analysis.strategicPillars || [],
            analyzedAt: now,
          }),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      success: true,
      analyzedCount: parsed.analyses.length,
      competitorInsight: parsed.competitorInsight || '',
      dominantStrategy: parsed.dominantStrategy || '',
      dominantTone: parsed.dominantTone || '',
      avgSentiment: parsed.avgSentiment || 0,
      analyses: parsed.analyses,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('analyzeSocialStrategy error:', err);
    throw new HttpsError('internal', `AI analysis failed: ${err.message}`);
  }
});

// ============================================================================
// 4. ON-DEMAND: Trigger manual sync (same as scheduled, but callable)
// ============================================================================
const triggerSocialSync = onCall({
  secrets: [SOCIAL_SCRAPER_API_KEY, GEMINI_API_KEY],
  cors: true,
  timeoutSeconds: 300,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { competitorId } = request.data;

  const scraperKey = SOCIAL_SCRAPER_API_KEY.value();
  if (!scraperKey) {
    throw new HttpsError('failed-precondition', 'SOCIAL_SCRAPER_API_KEY not configured');
  }

  // Get social profiles for this competitor (or all if no competitorId)
  let profileQuery = db.collection(DIGITAL_PROFILES_COLLECTION)
    .where('isTracking', '==', true);

  if (competitorId) {
    profileQuery = profileQuery.where('competitorId', '==', competitorId);
  }

  const profilesSnap = await profileQuery.get();
  const socialProfiles = profilesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => {
      // Validate required fields
      if (!p.competitorId || typeof p.competitorId !== 'string') {
        console.warn(`Profile ${p.id} missing valid competitorId`);
        return false;
      }
      if (!p.id || typeof p.id !== 'string') {
        console.warn(`Profile missing valid id`);
        return false;
      }
      if (!SOCIAL_PLATFORMS.includes(p.platform)) {
        console.warn(`Profile ${p.id} has invalid platform: ${p.platform}`);
        return false;
      }
      return true;
    })
    .map(p => ({
      ...p,
      profileHandle: p.profileHandle || extractHandleFromUrl(p.profileUrl, p.platform),
    }))
    .filter(p => p.profileHandle);

  if (socialProfiles.length === 0) {
    return { success: true, message: 'No tracked social profiles found. Add social media profiles via Digital Profiles first.', synced: 0 };
  }

  let synced = 0;
  let errors = 0;

  for (const profile of socialProfiles) {
    try {
      const rawData = await fetchFromApify(scraperKey, profile.platform, profile.profileHandle);
      if (!rawData) { errors++; continue; }

      const posts = normalizePosts(profile.platform, rawData, profile.competitorId, profile.id);

      // Save posts with optimized batch deduplication
      const saveResult = await savePostsWithDeduplication(posts);

      if (saveResult.failed.length > 0) {
        console.warn(`Failed to save ${saveResult.failed.length} posts for ${profile.competitorId}`);
      }

      const metrics = extractAccountMetrics(
        profile.platform, rawData, profile.competitorId, profile.id, profile.profileHandle
      );
      if (metrics) {
        await db.collection(SOCIAL_METRICS_COLLECTION).add(cleanUndefined(metrics));
        await db.collection(DIGITAL_PROFILES_COLLECTION).doc(profile.id).update({
          followers: metrics.followers,
          following: metrics.following,
          totalPosts: metrics.totalPosts,
          engagement: metrics.engagementRate,
          lastScannedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      synced++;
    } catch (err) {
      console.error(`Sync error for ${profile.platform}/${profile.profileHandle}:`, err.message);
      errors++;
    }
  }

  return {
    success: true,
    synced,
    errors,
    totalProfiles: socialProfiles.length,
  };
});

module.exports = {
  syncSocialMetrics,
  fetchSocialPosts,
  analyzeSocialStrategy,
  triggerSocialSync,
};
