/**
 * syncDKBToMemory — Scheduled Cloud Function
 *
 * Reads the `designKnowledgeBase` collection and syncs entries
 * to the DawinOS memory system for AI agent access.
 *
 * Runs daily via Cloud Scheduler.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();
const COLLECTION = 'designKnowledgeBase';

/**
 * Scheduled sync — runs daily at 2 AM UTC.
 */
const syncDKBToMemoryScheduled = onSchedule(
  {
    schedule: '0 2 * * *',
    region: 'us-central1',
    timeoutSeconds: 300,
  },
  async () => {
    const result = await performSync();
    logger.info('Scheduled DKB sync complete', result);
  },
);

/**
 * Manual sync — HTTPS callable for admin trigger.
 */
const syncDKBToMemory = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    logger.info('syncDKBToMemory called manually', { uid: request.auth.uid });
    const result = await performSync();
    return result;
  },
);

/**
 * Core sync logic — reads DKB entries and writes to memory collection.
 */
async function performSync() {
  const snap = await db.collection(COLLECTION)
    .where('isActive', '==', true)
    .get();

  let synced = 0;
  const errors = [];
  const batch = db.batch();

  for (const doc of snap.docs) {
    const entry = doc.data();
    try {
      // Write a memory-formatted document for AI agent access
      const memoryRef = db.collection('memories').doc(`dkb-${doc.id}`);
      batch.set(memoryRef, {
        type: 'dkb',
        key: `dkb:${entry.entryType}:${doc.id}`,
        content: formatMemoryContent(entry),
        tags: ['dkb', entry.entryType, ...(entry.tags || [])],
        source: 'design-knowledge-base',
        sourceId: doc.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      synced++;
    } catch (err) {
      errors.push({ entryId: doc.id, error: err.message });
    }
  }

  if (synced > 0) {
    await batch.commit();
  }

  return { synced, errors };
}

function formatMemoryContent(entry) {
  const parts = [`${entry.entryType}: ${entry.name}`];
  if (entry.description) parts.push(entry.description);
  if (entry.tags?.length) parts.push(`Tags: ${entry.tags.join(', ')}`);

  // Type-specific content
  if (entry.entryType === 'product_archetype' && entry.aiPromptContext) {
    parts.push(`AI Context: ${entry.aiPromptContext}`);
  }
  if (entry.entryType === 'component' && entry.dimensions) {
    const d = entry.dimensions;
    parts.push(`Dimensions: ${d.width?.default || '?'}×${d.depth?.default || '?'}×${d.height?.default || '?'}mm`);
  }

  return parts.join('\n');
}

module.exports = { syncDKBToMemory, syncDKBToMemoryScheduled };
