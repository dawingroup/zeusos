/**
 * Meta WhatsApp - Template Sync Cloud Functions
 * Syncs WhatsApp message templates from Meta Cloud API to Firestore
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const {
  META_WHATSAPP_ACCESS_TOKEN,
  META_WHATSAPP_BUSINESS_ACCOUNT_ID,
  getTemplates,
} = require('./metaCloudApiClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  TEMPLATES: 'whatsappTemplates',
  CONFIG: 'systemConfig',
};

/**
 * Map Meta template status to internal status
 */
function mapTemplateStatus(metaStatus) {
  const statusMap = {
    APPROVED: 'approved',
    PENDING: 'pending',
    REJECTED: 'rejected',
    DISABLED: 'removed',
    IN_APPEAL: 'pending',
    PENDING_DELETION: 'removed',
    DELETED: 'removed',
    LIMIT_EXCEEDED: 'rejected',
  };
  return statusMap[metaStatus] || 'pending';
}

/**
 * Extract body text from Meta template components
 * @param {Array} components - Meta template components array
 * @returns {string} Body text with {{1}}, {{2}} placeholders
 */
function extractBodyText(components) {
  if (!components || !Array.isArray(components)) return '';

  const bodyComponent = components.find((c) => c.type === 'BODY');
  return bodyComponent?.text || '';
}

/**
 * Extract header info from Meta template components
 */
function extractHeader(components) {
  if (!components || !Array.isArray(components)) return { headerType: null, headerText: null };

  const headerComponent = components.find((c) => c.type === 'HEADER');
  if (!headerComponent) return { headerType: null, headerText: null };

  return {
    headerType: (headerComponent.format || 'text').toLowerCase(),
    headerText: headerComponent.text || null,
  };
}

/**
 * Extract footer text from Meta template components
 */
function extractFooter(components) {
  if (!components || !Array.isArray(components)) return null;

  const footerComponent = components.find((c) => c.type === 'FOOTER');
  return footerComponent?.text || null;
}

/**
 * Extract buttons from Meta template components
 */
function extractButtons(components) {
  if (!components || !Array.isArray(components)) return [];

  const buttonsComponent = components.find((c) => c.type === 'BUTTONS');
  if (!buttonsComponent?.buttons) return [];

  return buttonsComponent.buttons.map((btn) => ({
    type: btn.type,
    text: btn.text,
    url: btn.url || null,
    phoneNumber: btn.phone_number || null,
  }));
}

/**
 * Sync templates from Meta to Firestore
 * @returns {Promise<{synced: number, removed: number}>}
 */
async function performTemplateSync() {
  logger.info('Starting WhatsApp template sync from Meta Cloud API');

  const metaTemplates = await getTemplates();
  const batch = db.batch();
  const seenIds = new Set();
  let synced = 0;

  for (const template of metaTemplates) {
    const templateId = template.name;
    if (!templateId) continue;

    // Use name as doc ID for consistency
    const docId = `${templateId}_${template.language || 'en'}`;
    seenIds.add(docId);

    const docRef = db.collection(COLLECTIONS.TEMPLATES).doc(docId);
    const bodyText = extractBodyText(template.components);
    const { headerType, headerText } = extractHeader(template.components);
    const footerText = extractFooter(template.components);
    const buttons = extractButtons(template.components);

    const templateDoc = {
      metaTemplateId: template.id,
      metaTemplateName: template.name,
      name: template.name,
      language: template.language || 'en',
      category: (template.category || 'utility').toLowerCase(),
      bodyText,
      headerType,
      headerText,
      footerText,
      buttons: buttons.length > 0 ? buttons : null,
      componentsJson: JSON.stringify(template.components || []),
      parameterCount: (bodyText.match(/\{\{(\d+)\}\}/g) || []).length,
      status: mapTemplateStatus(template.status),
      provider: 'meta',
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, templateDoc, { merge: true });
    synced++;
  }

  // Mark templates not returned by Meta as removed (only Meta-sourced ones)
  const existingTemplates = await db
    .collection(COLLECTIONS.TEMPLATES)
    .where('provider', '==', 'meta')
    .get();

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

  logger.info('WhatsApp template sync completed (Meta)', { synced, removed });
  return { synced, removed };
}

/**
 * HTTP endpoint: Manually trigger template sync (admin only)
 */
const syncWhatsAppTemplatesMeta = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
    cors: ALLOWED_ORIGINS,
    secrets: [META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_BUSINESS_ACCOUNT_ID],
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
      logger.error('Meta template sync failed', { error: err.message });
      return res.status(500).json({ error: 'Template sync failed', details: err.message });
    }
  }
);

/**
 * Scheduled: Daily template sync (runs at 6 AM UTC)
 */
const scheduledTemplateSyncMeta = onSchedule(
  {
    schedule: 'every day 06:00',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_BUSINESS_ACCOUNT_ID],
  },
  async () => {
    try {
      await performTemplateSync();
    } catch (err) {
      logger.error('Scheduled Meta template sync failed', { error: err.message });
    }
  }
);

module.exports = {
  syncWhatsAppTemplatesMeta,
  scheduledTemplateSyncMeta,
};
