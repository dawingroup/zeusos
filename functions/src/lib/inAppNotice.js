/**
 * In-app notices: the ONE shape every server writer of `notifications/` uses
 * (DawinOS stream C port, 2026-10-29).
 *
 * PURE: no Firebase imports, so node tests and the client lockstep test
 * (src/core/services/__tests__/inAppNotice.test.ts) can require it. The I/O
 * half — the write, the dedupe, the audience fan-out — is lib/noticeDelivery.js.
 *
 * Why this exists: ZeusOS had four writers of `notifications/` that disagreed
 * on every field the bell reads — the task engine (`userId` / `isRead` /
 * `actionUrl`), the agents (`targetUserId` / `body`, no `userId`, no
 * `organizationId` — invisible to everyone), the deadline monitor
 * (`recipientRole` / `subject` / `read` — readable by nobody below admin), and
 * the legacy finance optimiser (a different collection altogether). The client
 * listener filters on `userId == me` and `organizationId == 'default'`, so a
 * notice that misses either is written and never seen.
 *
 * The rule now: a notice names ONE person in `userId`, is unread while `isRead`
 * is false, and goes where `actionUrl` says. "Tell the brand lead" is resolved
 * to people at write time (noticeDelivery.notifyAudience), never stored as a
 * role for a reader to puzzle out.
 */

const NOTICES_COLLECTION = 'notifications';
// The client listener (GlobalContext) filters on organizationId, so a notice
// without it is invisible even to its own recipient.
const NOTICE_ORG_ID = 'default';

const TITLE_MAX = 200;
const MESSAGE_MAX = 2000;

/**
 * Producers speak in severities ('warning', 'info', 'success'…) and in task
 * priorities ('urgent', 'P0'…). The bell ranks by one ladder.
 */
const PRIORITY_OF = Object.freeze({
  critical: 'critical',
  urgent: 'critical',
  p0: 'critical',
  error: 'high',
  warning: 'high',
  high: 'high',
  p1: 'high',
  medium: 'medium',
  p2: 'medium',
  info: 'low',
  success: 'low',
  low: 'low',
  p3: 'low',
});

function noticePriority(value) {
  return PRIORITY_OF[String(value || '').toLowerCase()] || 'medium';
}

function clamp(value, max) {
  if (value == null) return '';
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * An in-app path the router can open, or null. A notice never carries an
 * external URL: the bell navigates in place, and a stray absolute URL there
 * would be a phishing-shaped link inside the app's own chrome.
 */
function inAppPath(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s.startsWith('/') && !s.startsWith('//') ? s : null;
}

/**
 * The document fields for one notice to one person. `createdAt` is left to
 * the writer (a server timestamp is not pure).
 *
 * @param {{
 *   userId: string, type: string, title: string, message?: string,
 *   actionUrl?: string|null, module?: string|null,
 *   entityType?: string|null, entityId?: string|null,
 *   priority?: string, metadata?: object|null,
 *   expiresAt?: unknown, recipientRole?: string|null, source?: string|null,
 * }} input
 */
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
    module: input.module || null,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    actionUrl: inAppPath(input.actionUrl),
    priority: noticePriority(input.priority),
    isRead: false,
    isArchived: false,
  };
  if (input.metadata && typeof input.metadata === 'object') fields.metadata = input.metadata;
  if (input.expiresAt) fields.expiresAt = input.expiresAt;
  // Kept for the audit trail: which audience a fanned-out notice was meant for.
  if (input.recipientRole) fields.recipientRole = input.recipientRole;
  // Which system wrote it ('task-engine', 'memos', 'agent:ZA-001', 'deadline-monitor').
  if (input.source) fields.source = String(input.source).slice(0, 80);
  return fields;
}

/**
 * A deterministic id for a notice that must land at most once per person,
 * such as a daily alert re-evaluated on every run. Firestore ids cannot
 * contain '/'.
 */
function noticeDocId(dedupeKey, userId) {
  return `${String(dedupeKey).replace(/\//g, '_')}_${userId}`;
}

/** The fields a reader may change on their own notice. */
const READER_WRITABLE_FIELDS = Object.freeze(['isRead', 'isArchived', 'readAt', 'archivedAt', 'updatedAt']);

module.exports = {
  NOTICES_COLLECTION,
  NOTICE_ORG_ID,
  PRIORITY_OF,
  READER_WRITABLE_FIELDS,
  buildNotice,
  inAppPath,
  noticePriority,
  noticeDocId,
};
