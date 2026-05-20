/**
 * Bridge: socialMediaAccounts (marketing) -> digital_profiles (intelligence)
 *
 * When a marketing-module SocialMediaAccount is created/updated we upsert a matching
 * digital_profiles doc with accountType='own' so the existing intelligence scraper
 * (functions/src/intelligence/socialTrackerFunctions.js) picks it up on its next run
 * — no duplicate registration needed.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const SOCIAL_ACCOUNTS_COLLECTION = 'socialMediaAccounts';
const DIGITAL_PROFILES_COLLECTION = 'digital_profiles';

function extractHandle(url, platform) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const segments = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (segments.length === 0) return null;
    switch (platform) {
      case 'instagram':
      case 'twitter':
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

const onSocialMediaAccountWritten = onDocumentWritten(
  `${SOCIAL_ACCOUNTS_COLLECTION}/{accountId}`,
  async (event) => {
    const accountId = event.params.accountId;
    const afterSnap = event.data?.after;

    // Account deleted -> mark the linked digital profile as not tracking
    if (!afterSnap || !afterSnap.exists) {
      const linkedSnap = await db
        .collection(DIGITAL_PROFILES_COLLECTION)
        .where('dawinosAccountId', '==', accountId)
        .limit(1)
        .get();
      if (!linkedSnap.empty) {
        await linkedSnap.docs[0].ref.update({
          isTracking: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return;
    }

    const account = afterSnap.data() || {};

    const handle =
      (account.handle && String(account.handle).replace(/^@/, '')) ||
      extractHandle(account.profileUrl, account.platform);
    if (!handle) {
      logger.warn(`[registerOwnDigitalProfile] No handle for account ${accountId}`);
      return;
    }

    // Find an existing linked digital_profiles doc, else create one
    const linkedSnap = await db
      .collection(DIGITAL_PROFILES_COLLECTION)
      .where('dawinosAccountId', '==', accountId)
      .limit(1)
      .get();

    const isTracking = account.trackingEnabled !== false && account.status !== 'paused';

    const payload = {
      // Bridge identifiers (so the intelligence pipeline can JOIN back to marketing docs)
      dawinosAccountId: accountId,
      accountType: 'own',
      ownerSubsidiaryId: account.subsidiaryId || null,
      // Sentinel competitorId so the existing scraper code (which requires it) keeps working.
      // Format: OWN_<subsidiaryId>_<accountId> guarantees uniqueness per own profile.
      competitorId: `OWN_${account.subsidiaryId || 'unknown'}_${accountId}`,
      // Profile fields the scraper reads
      platform: account.platform,
      profileUrl: account.profileUrl || null,
      profileHandle: handle,
      isTracking,
      displayName: account.displayName || null,
      // Audit
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (linkedSnap.empty) {
      const docRef = await db.collection(DIGITAL_PROFILES_COLLECTION).add({
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(
        `[registerOwnDigitalProfile] Created digital_profile ${docRef.id} for own account ${accountId}`
      );
    } else {
      await linkedSnap.docs[0].ref.update(payload);
      logger.info(
        `[registerOwnDigitalProfile] Updated digital_profile ${linkedSnap.docs[0].id} for own account ${accountId}`
      );
    }
  }
);

module.exports = { onSocialMediaAccountWritten };
