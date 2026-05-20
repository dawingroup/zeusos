/**
 * socialPublisher — scheduled cron that publishes due posts to connected social platforms.
 *
 * Runs every 5 minutes. For each post with status='scheduled' and scheduledFor<=now:
 *   1. Acquire a Firestore transaction-based lock (publishLockUntil) so two runs can't double-post.
 *   2. For each selected platform, find the matching SocialMediaAccount via post.socialAccountIds,
 *      decrypt its OAuth token, and call the right publish adapter.
 *   3. Update PlatformPost per-platform with result; roll up to top-level status.
 *   4. Release the lock.
 *
 * Errors surface via the existing pushNotifications path.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const {
  getDecryptedTokenForAccount,
  META_APP_ID,
  META_APP_SECRET,
  SOCIAL_TOKEN_ENCRYPTION_KEY,
} = require('../integrations/social/meta/auth');
const { publishToFacebook, publishToInstagram } = require('../integrations/social/meta/publish');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const LOCK_DURATION_MS = 4 * 60 * 1000; // 4 min — less than the 5min cron interval

async function tryAcquireLock(postRef) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists) return false;
    const data = snap.data() || {};
    const now = Date.now();
    if (data.publishLockUntil && data.publishLockUntil.toMillis() > now) {
      return false;
    }
    if (data.status !== 'scheduled') return false;
    tx.update(postRef, {
      publishLockUntil: admin.firestore.Timestamp.fromMillis(now + LOCK_DURATION_MS),
    });
    return true;
  });
}

async function releaseLock(postRef) {
  await postRef
    .update({ publishLockUntil: admin.firestore.FieldValue.delete() })
    .catch(() => {});
}

async function publishOnePlatform({ platform, account, post, encKey }) {
  const tokens = await getDecryptedTokenForAccount(account.id, encKey);

  if (platform === 'facebook') {
    if (!tokens.pageId || !tokens.pageAccessToken) {
      throw new Error('Facebook page token missing — reconnect required');
    }
    return publishToFacebook({
      pageId: tokens.pageId,
      pageAccessToken: tokens.pageAccessToken,
      post,
      media: post.mediaUrls || [],
    });
  }

  if (platform === 'instagram') {
    if (!tokens.platformAccountId || !tokens.pageAccessToken) {
      throw new Error('Instagram credentials incomplete — reconnect required');
    }
    return publishToInstagram({
      igUserId: tokens.platformAccountId,
      pageAccessToken: tokens.pageAccessToken,
      post,
      media: post.mediaUrls || [],
    });
  }

  throw new Error(`Platform ${platform} not yet supported by socialPublisher`);
}

async function processPost(postDoc, encKey) {
  const post = { id: postDoc.id, ...postDoc.data() };
  const platformResults = {};
  const updatedPlatformPosts = [...(post.platformPosts || [])];

  for (const platform of post.platforms || []) {
    const accountId = post.socialAccountIds?.[platform];
    if (!accountId) {
      platformResults[platform] = {
        status: 'failed',
        failureReason: 'No target account selected for this platform',
      };
      continue;
    }
    const accountSnap = await db.collection('socialMediaAccounts').doc(accountId).get();
    if (!accountSnap.exists) {
      platformResults[platform] = {
        status: 'failed',
        failureReason: `Account ${accountId} not found`,
      };
      continue;
    }
    const account = { id: accountSnap.id, ...accountSnap.data() };
    if (!account.oauthEnabled) {
      platformResults[platform] = {
        status: 'failed',
        failureReason: 'Account is not OAuth-connected for publishing',
      };
      continue;
    }

    try {
      const { platformPostId, permalink } = await publishOnePlatform({
        platform,
        account,
        post,
        encKey,
      });
      platformResults[platform] = { status: 'published', platformPostId, permalink };
    } catch (err) {
      logger.error(`[socialPublisher] ${post.id}/${platform} failed`, err);
      const reason =
        (err && err.message ? String(err.message) : 'Unknown error').slice(0, 500);
      platformResults[platform] = { status: 'failed', failureReason: reason };

      // If auth-related, mark the account as oauth_expired.
      if (
        err?.code === 190 || // OAuthException invalid token
        err?.code === 102 ||
        /access token|expired|session/i.test(err?.message || '')
      ) {
        await db
          .collection('socialMediaAccounts')
          .doc(account.id)
          .update({
            status: 'oauth_expired',
            lastSyncError: reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      }
    }
  }

  // Merge per-platform results into the platformPosts array
  for (let i = 0; i < updatedPlatformPosts.length; i++) {
    const entry = updatedPlatformPosts[i];
    const result = platformResults[entry.platform];
    if (!result) continue;
    updatedPlatformPosts[i] = {
      ...entry,
      ...result,
      publishedAt:
        result.status === 'published' ? admin.firestore.Timestamp.now() : entry.publishedAt,
    };
  }
  // Add entries for platforms we tried but weren't in platformPosts (defensive)
  for (const platform of post.platforms || []) {
    if (!updatedPlatformPosts.find((p) => p.platform === platform)) {
      updatedPlatformPosts.push({ platform, ...platformResults[platform] });
    }
  }

  const allFailed = (post.platforms || []).every(
    (p) => platformResults[p]?.status === 'failed'
  );
  const anyPublished = (post.platforms || []).some(
    (p) => platformResults[p]?.status === 'published'
  );

  let topStatus = 'scheduled';
  let publishedAt = post.publishedAt || null;
  if (allFailed) topStatus = 'failed';
  else if (anyPublished) {
    topStatus = 'published';
    publishedAt = admin.firestore.Timestamp.now();
  }

  await postDoc.ref.update({
    status: topStatus,
    platformPosts: updatedPlatformPosts,
    publishedAt,
    publishLockUntil: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Best-effort failure notification (reuses any existing pushNotifications path).
  if (allFailed) {
    try {
      const { sendOpsNotification } =
        // optional import — module may not exist or may rename
        require('../notifications/pushNotifications');
      if (typeof sendOpsNotification === 'function') {
        await sendOpsNotification({
          severity: 'warning',
          subject: `Scheduled social post failed: ${post.title}`,
          body: Object.entries(platformResults)
            .map(([p, r]) => `${p}: ${r.failureReason}`)
            .join('\n'),
        });
      }
    } catch (_) {
      // notification module is best-effort; ignore
    }
  }
}

const socialPublisher = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Africa/Nairobi',
    secrets: [META_APP_ID, META_APP_SECRET, SOCIAL_TOKEN_ENCRYPTION_KEY],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const dueSnap = await db
      .collection('socialMediaPosts')
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', now)
      .limit(50)
      .get();

    if (dueSnap.empty) {
      logger.info('[socialPublisher] no due posts');
      return;
    }
    logger.info(`[socialPublisher] processing ${dueSnap.size} due posts`);

    const encKey = SOCIAL_TOKEN_ENCRYPTION_KEY.value();

    for (const doc of dueSnap.docs) {
      const acquired = await tryAcquireLock(doc.ref);
      if (!acquired) {
        logger.info(`[socialPublisher] skip ${doc.id} (locked or not scheduled)`);
        continue;
      }
      try {
        const fresh = await doc.ref.get();
        if (!fresh.exists) continue;
        await processPost(fresh, encKey);
      } catch (err) {
        logger.error(`[socialPublisher] ${doc.id} unhandled error`, err);
        await releaseLock(doc.ref);
      }
    }
  }
);

module.exports = { socialPublisher };
