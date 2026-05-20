/**
 * Zoko WhatsApp - Template Sync Cloud Functions
 * Syncs WhatsApp message templates from Zoko to Firestore
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const { ZOKO_API_KEY, getTemplates } = require('./zokoClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  TEMPLATES: 'whatsappTemplates',
  CONFIG: 'systemConfig',
};

/**
 * Sync templates from Zoko to Firestore
 * @returns {Promise<{synced: number, removed: number}>}
 */
async function performTemplateSync() {
  logger.info('Starting WhatsApp template sync from Zoko');

  const zokoTemplates = await getTemplates();
  const templates = Array.isArray(zokoTemplates) ? zokoTemplates : zokoTemplates?.templates || [];

  const batch = db.batch();
  const seenIds = new Set();
  let synced = 0;

  for (const template of templates) {
    const templateId = template.id || template.name;
    if (!templateId) continue;

    seenIds.add(templateId);

    const docRef = db.collection(COLLECTIONS.TEMPLATES).doc(templateId);
    const templateDoc = {
      zokoTemplateId: templateId,
      name: template.name || templateId,
      language: template.language || 'en',
      category: template.category || 'utility',
      bodyText: template.body || template.text || '',
      headerType: template.headerType || null,
      headerText: template.headerText || null,
      footerText: template.footerText || null,
      parameterCount: (template.body || '').match(/\{\{(\d+)\}\}/g)?.length || 0,
      status: template.status || 'approved',
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, templateDoc, { merge: true });
    synced++;
  }

  // Mark templates not returned by Zoko as removed
  const existingTemplates = await db.collection(COLLECTIONS.TEMPLATES).get();
  let removed = 0;
  for (const doc of existingTemplates.docs) {
    if (!seenIds.has(doc.id) && doc.data().status !== 'removed') {
      batch.update(doc.ref, {
        status: 'removed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      removed++;
    }
  }

  await batch.commit();

  // Update config
  await db.collection(COLLECTIONS.CONFIG).doc('whatsappConfig').set(
    {
      lastTemplateSyncAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info('WhatsApp template sync completed', { synced, removed });
  return { synced, removed };
}

/**
 * HTTP endpoint: Manually trigger template sync (admin only)
 * POST /whatsapp/sync-templates
 */
const syncWhatsAppTemplates = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
    cors: ALLOWED_ORIGINS,
    secrets: [ZOKO_API_KEY],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Verify auth - admin only
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const idToken = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      const userRecord = await admin.auth().getUser(decoded.uid);
      const claims = userRecord.customClaims || {};
      let isAdmin = claims.admin === true || ['admin', 'owner'].includes(claims.role);

      // Fallback: check Firestore user document globalRole
      if (!isAdmin) {
        const userSnap = await db
          .collection('organizations/default/users')
          .where('uid', '==', decoded.uid)
          .limit(1)
          .get();
        if (!userSnap.empty) {
          const globalRole = userSnap.docs[0].data().globalRole || '';
          isAdmin = ['admin', 'owner'].includes(globalRole);
        }
      }

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await performTemplateSync();
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      logger.error('Template sync failed', { error: err.message });
      return res.status(500).json({ error: 'Template sync failed', details: err.message });
    }
  }
);

/**
 * Scheduled: Daily template sync (runs at 6 AM UTC)
 */
const scheduledTemplateSync = onSchedule(
  {
    schedule: 'every day 06:00',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [ZOKO_API_KEY],
  },
  async () => {
    try {
      await performTemplateSync();
    } catch (err) {
      logger.error('Scheduled template sync failed', { error: err.message });
    }
  }
);

module.exports = {
  syncWhatsAppTemplates,
  scheduledTemplateSync,
};
