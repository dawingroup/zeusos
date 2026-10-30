/**
 * In-app notices as the bell reads them. Pure.
 *
 * The server writes ONE shape through functions/src/lib/inAppNotice.js:
 * `userId`, `isRead`, `isArchived`, `actionUrl`, `message`, `priority`.
 * `src/core/services/__tests__/inAppNotice.test.ts` feeds that builder's
 * output through `toInAppNotice` so the two cannot drift.
 *
 * The legacy spellings (`read`, `link`, `body`, `subject`, `severity`) are
 * still read: the deadline monitor and the agents wrote them until stream C
 * landed, and whatever is in the collection must still show.
 */
import type { Timestamp } from 'firebase/firestore';
import type { GlobalNotification, NotificationPriority } from '@/integration/types';

type Raw = Record<string, unknown>;

/**
 * Notice types the bell leaves to another surface. Message notices have their
 * own launcher and unread count in the header (the Messages button), and
 * opening the thread clears them. Listing them here as well would count every
 * message twice.
 */
export const BELL_EXCLUDED_TYPES: ReadonlySet<string> = new Set(['message']);

/** Mirror of the server ladder (functions/src/lib/inAppNotice.js PRIORITY_OF). */
export const PRIORITY_OF: Record<string, NotificationPriority> = {
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
};

/** The legacy `severity` word a priority reads as, for consumers that still rank by it. */
export const SEVERITY_OF: Record<NotificationPriority, GlobalNotification['severity']> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'info',
};

/** Modules a person can mute in the bell, with the words the settings page shows. */
export const NOTICE_MODULE_CATALOG: ReadonlyArray<{ module: string; label: string; description: string }> = [
  { module: 'intelligence', label: 'Tasks & daily plans', description: 'Work landing on you, your plan for the day, escalations, the evening review.' },
  { module: 'memos', label: 'Memos', description: 'Memos through you, addressed to you, issued to you or sent back.' },
  { module: 'agents', label: 'Agents', description: 'What the AI agents flag: overruns, risks, things to look at.' },
  { module: 'finance', label: 'Finance', description: 'Deadline summaries and overdue accountabilities.' },
  { module: 'delivery', label: 'Delivery', description: 'Work orders, SLA and burn alerts.' },
  { module: 'comms', label: 'Comms', description: 'Mentions and threads (not the Messages button itself).' },
];

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** An in-app path the router can open, or null. Never an external URL. */
export function inAppPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s.startsWith('/') && !s.startsWith('//') ? s : null;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (value instanceof Date) return value.getTime();
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

export function noticePriority(value: unknown): NotificationPriority {
  return PRIORITY_OF[String(value ?? '').toLowerCase()] ?? 'medium';
}

/** One `notifications` doc in the shape the bell reads. */
export function toInAppNotice(id: string, raw: Raw): GlobalNotification {
  const isRead = typeof raw.isRead === 'boolean' ? raw.isRead : raw.read === true;
  const priority = noticePriority(raw.priority ?? raw.severity);
  return {
    id,
    type: text(raw.type) ?? 'notice',
    title: text(raw.title) ?? text(raw.subject) ?? 'Notification',
    message: text(raw.message) ?? text(raw.body) ?? '',
    module: text(raw.module) ?? text(raw.sourceModule) ?? '',
    priority,
    severity: SEVERITY_OF[priority],
    isRead,
    isArchived: raw.isArchived === true,
    entityType: text(raw.entityType) ?? undefined,
    entityId: text(raw.entityId) ?? undefined,
    actionUrl: inAppPath(raw.actionUrl) ?? inAppPath(raw.link) ?? undefined,
    actionLabel: text(raw.actionLabel) ?? undefined,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>) : undefined,
    createdAt: (raw.createdAt as Timestamp | string | null | undefined) ?? null,
    expiresAt: (raw.expiresAt as Timestamp | string | null | undefined) ?? null,
  };
}

/**
 * What the bell lists: the person's own notices, newest first (the listener's
 * order), minus types another surface owns, anything archived, anything whose
 * moment has passed (yesterday's "Your focus today") and anything from a
 * module the person muted.
 */
export function bellNotices(items: GlobalNotification[], nowMs: number, mutedModules: readonly string[] = []): GlobalNotification[] {
  const muted = new Set(mutedModules);
  return items.filter((n) => {
    if (BELL_EXCLUDED_TYPES.has(n.type) || n.isArchived) return false;
    if (n.module && muted.has(n.module)) return false;
    const expires = toMillis(n.expiresAt);
    return expires == null || expires > nowMs;
  });
}

export function noticeCreatedMs(n: GlobalNotification): number | null {
  return toMillis(n.createdAt);
}
