/**
 * Memory TTL Cleanup — Scheduled Cloud Function
 * Archives low-importance memories that have exceeded their TTL.
 * Runs daily at 2:00 AM UTC.
 *
 * TTL rules (days since last access):
 *   low importance     → 90 days
 *   medium importance  → 180 days
 *   high importance    → 365 days
 *   critical importance → never expires
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

const MEMORY_COLLECTION = 'ai_memory';

const TTL_DAYS = {
  low: 90,
  medium: 180,
  high: 365,
  // critical: never expires
};

/**
 * Scheduled function — runs daily at 02:00 UTC
 */
const memoryTTLCleanup = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'UTC',
    memory: '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    let totalArchived = 0;

    for (const [importance, ttlDays] of Object.entries(TTL_DAYS)) {
      const cutoff = new Date(now.toDate().getTime() - ttlDays * 24 * 60 * 60 * 1000);
      const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

      try {
        const snap = await db
          .collection(MEMORY_COLLECTION)
          .where('importance', '==', importance)
          .where('isArchived', '==', false)
          .where('lastAccessedAt', '<', cutoffTs)
          .limit(100)
          .get();

        if (snap.empty) continue;

        const batch = db.batch();
        snap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            isArchived: true,
            archivedAt: now,
            archiveReason: 'ttl_expired',
            updatedAt: now,
          });
        });

        await batch.commit();
        totalArchived += snap.size;
        console.log(`TTL cleanup: archived ${snap.size} ${importance}-importance memories (cutoff: ${cutoff.toISOString()})`);
      } catch (err) {
        console.error(`TTL cleanup error for importance=${importance}:`, err.message);
      }
    }

    console.log(`TTL cleanup complete: ${totalArchived} memories archived`);
  }
);

module.exports = { memoryTTLCleanup };
