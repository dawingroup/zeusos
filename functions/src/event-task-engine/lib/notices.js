/**
 * In-app notices: the ONE shape the task engine writes to `notifications/`.
 *
 * Matches the client reader (src/core/services/notificationService.ts):
 * a notice names ONE person in `userId`, is unread while `isRead` is false,
 * and goes where `actionUrl` says. `organizationId: 'default'` and
 * `module: 'intelligence'` are what the client's listeners expect.
 *
 * `notifyUser` is best-effort: a notice is never the record of what happened,
 * so a failed write logs and returns and never fails the caller's business
 * write. With a `dedupeKey` the doc id is deterministic and a second write for
 * the same key and person does nothing — a daily alert re-evaluated on every
 * run never flips a notice the person already read back to unread.
 */

const NOTICES_COLLECTION = 'notifications';
const NOTICE_ORG_ID = 'default';
const NOTICE_MODULE = 'intelligence';
const TITLE_MAX = 200;
const MESSAGE_MAX = 2000;

const PRIORITY_OF = Object.freeze({
  critical: 'critical', urgent: 'critical', P0: 'critical',
  error: 'high', warning: 'high', high: 'high', P1: 'high',
  medium: 'medium', P2: 'medium',
  info: 'low', success: 'low', low: 'low', P3: 'low',
});

function noticePriority(value) {
  return PRIORITY_OF[String(value || '')] || PRIORITY_OF[String(value || '').toLowerCase()] || 'medium';
}

function clamp(value, max) {
  if (value == null) return '';
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** An in-app path the router can open, or null — never an external URL. */
function inAppPath(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s.startsWith('/') && !s.startsWith('//') ? s : null;
}

/** The document fields for one notice to one person. PURE. */
function buildNotice(input) {
  const { userId, type, title } = input || {};
  if (!userId || typeof userId !== 'string') throw new Error('A notice needs the userId of the person it is for');
  if (!type || typeof type !== 'string') throw new Error('A notice needs a type');
  if (!title || typeof title !== 'string') throw new Error('A notice needs a title');
  const fields = {
    userId,
    organizationId: NOTICE_ORG_ID,
    type,
    title: clamp(title, TITLE_MAX),
    message: clamp(input.message, MESSAGE_MAX),
    module: input.module || NOTICE_MODULE,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    actionUrl: inAppPath(input.actionUrl),
    priority: noticePriority(input.priority),
    isRead: false,
    isArchived: false,
  };
  if (input.metadata && typeof input.metadata === 'object') fields.metadata = input.metadata;
  if (input.expiresAt) fields.expiresAt = input.expiresAt;
  return fields;
}

/** A deterministic id for a notice that must land at most once per person. */
function noticeDocId(dedupeKey, userId) {
  return `${String(dedupeKey).replace(/\//g, '_')}_${userId}`;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} notice - buildNotice input, plus an optional `dedupeKey`.
 * @param {{ nowIso?: string, logger?: {warn: Function} }} [deps]
 * @returns {Promise<boolean>} whether a notice was written
 */
async function notifyUser(db, notice, deps = {}) {
  const log = deps.logger || console;
  const { dedupeKey, ...input } = notice || {};
  let fields;
  try {
    fields = { ...buildNotice(input), createdAt: deps.nowIso || new Date().toISOString() };
  } catch (err) {
    log.warn('[notice] not written: invalid notice', { type: input.type || null, error: err.message });
    return false;
  }
  const col = db.collection(NOTICES_COLLECTION);
  try {
    if (dedupeKey) {
      const ref = col.doc(noticeDocId(dedupeKey, fields.userId));
      const existing = await ref.get();
      if (existing.exists) return false;
      await ref.set(fields);
    } else {
      await col.add(fields);
    }
    return true;
  } catch (err) {
    log.warn('[notice] write failed', { type: fields.type, userId: fields.userId, error: err.message });
    return false;
  }
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
