/**
 * Monthly archive sweep (Phase 4).
 *
 * Runs on the 1st of each month and picks up any project that is
 * `status='completed'` but hasn't been archived — whether because:
 *   - the `onDesignProjectCompletedForDrive` trigger missed the update
 *     (e.g. the project was completed before Phase 4 rolled out);
 *   - a previous archive attempt failed (in which case the project
 *     will carry an `archiveError` field);
 *   - the project was pre-Phase-2 and has no `driveFolderId`.
 *
 * We also apply a quiet-period: only archive projects whose
 * `updatedAt` is at least 7 days old, so a same-day accidental flip to
 * 'completed' followed by a reversion doesn't immediately archive
 * folders operators are still touching.
 *
 * The sweep is conservative: any per-project error records to the
 * `archiveError` field and continues with the next project. The log
 * line at the end gives operators a triage summary.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions');

const { DRIVE_SECRETS, isDriveMirrorEnabled } = require('../drive/config');
const {
  archiveProject,
  recordArchiveError,
  isArchiveEnabled,
} = require('../drive/archiveProject');

const QUIET_PERIOD_DAYS = 7;
const SWEEP_BATCH_LIMIT = 100; // cap per run so a backlog doesn't blow the function timeout

/**
 * Pure predicate — given a project document and a "now" timestamp, is
 * it eligible for archiving by the monthly sweep? Factored out of the
 * scheduler callback so it can be unit-tested without Firebase stubs.
 *
 * @param {object} doc — project doc (post-update state)
 * @param {number} nowMs — current time in ms since epoch
 * @param {number} [quietPeriodDays=QUIET_PERIOD_DAYS]
 * @returns {{eligible: boolean, reason: string}}
 */
function shouldSweepArchive(doc, nowMs, quietPeriodDays = QUIET_PERIOD_DAYS) {
  if (!doc) return { eligible: false, reason: 'no doc' };
  if (doc.status !== 'completed') return { eligible: false, reason: 'status not completed' };
  if (doc.archived === true) return { eligible: false, reason: 'already archived' };
  const cutoffMs = nowMs - quietPeriodDays * 24 * 60 * 60 * 1000;
  const updatedAtMs =
    doc.updatedAt && typeof doc.updatedAt.toMillis === 'function'
      ? doc.updatedAt.toMillis()
      : typeof doc.updatedAt === 'number'
        ? doc.updatedAt
        : 0;
  if (updatedAtMs && updatedAtMs > cutoffMs) {
    return { eligible: false, reason: 'inside quiet period' };
  }
  return { eligible: true, reason: 'ok' };
}

const archiveSweep = onSchedule(
  {
    // 1st day of every month at 03:00 EAT (Kampala). v2 cron format.
    schedule: '0 3 1 * *',
    timeZone: 'Africa/Kampala',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: DRIVE_SECRETS,
  },
  async () => {
    const [mirrorOn, archiveOn] = await Promise.all([
      isDriveMirrorEnabled(),
      isArchiveEnabled(),
    ]);
    if (!mirrorOn || !archiveOn) {
      logger.info('[Drive] archiveSweep — mirror or archive disabled, skipping');
      return;
    }

    const db = admin.firestore();
    const nowMs = Date.now();

    // Firestore doesn't support "archived != true" directly (inequality
    // + field-absence is messy) so we filter on status+updatedAt and
    // skip already-archived in the loop. Scoping by status keeps the
    // read cheap.
    const snap = await db
      .collection('designProjects')
      .where('status', '==', 'completed')
      .orderBy('updatedAt', 'asc')
      .limit(SWEEP_BATCH_LIMIT)
      .get();

    let examined = 0;
    let archived = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      examined++;
      const data = doc.data();
      const decision = shouldSweepArchive(data, nowMs);
      if (!decision.eligible) {
        skipped++;
        continue;
      }

      try {
        const res = await archiveProject(doc.id, data, 'system-sweep');
        if (res) archived++;
      } catch (err) {
        failed++;
        logger.error('[Drive] archiveSweep — per-project failure', { projectId: doc.id, err });
        await recordArchiveError(doc.id, err);
      }
    }

    logger.info('[Drive] archiveSweep done', { examined, archived, skipped, failed });
  },
);

module.exports = { archiveSweep, shouldSweepArchive };
