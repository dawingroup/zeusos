/**
 * The task engine's notice writer — now a thin alias of the ONE shape every
 * server writer uses (functions/src/lib/inAppNotice.js) and its delivery
 * (functions/src/lib/noticeDelivery.js), stream C. Kept so the engine's
 * callers and tests keep their import; `module` defaults to 'intelligence'
 * as before.
 */

const { NOTICES_COLLECTION, NOTICE_ORG_ID, buildNotice: buildCanonical, inAppPath, noticePriority, noticeDocId } = require('../../lib/inAppNotice');
const delivery = require('../../lib/noticeDelivery');

const NOTICE_MODULE = 'intelligence';

function buildNotice(input) {
  return buildCanonical({ ...(input || {}), module: (input && input.module) || NOTICE_MODULE, source: (input && input.source) || 'task-engine' });
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} notice - buildNotice input, plus an optional `dedupeKey`.
 * @param {{ nowIso?: string, logger?: {warn: Function} }} [deps]
 * @returns {Promise<boolean>} whether a notice was written
 */
function notifyUser(db, notice, deps = {}) {
  return delivery.notifyUser(db, { ...(notice || {}), module: (notice && notice.module) || NOTICE_MODULE, source: (notice && notice.source) || 'task-engine' }, deps);
}

module.exports = {
  NOTICES_COLLECTION,
  NOTICE_ORG_ID,
  NOTICE_MODULE,
  buildNotice,
  inAppPath,
  noticePriority,
  noticeDocId,
  notifyUser,
};
