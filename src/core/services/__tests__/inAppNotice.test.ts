/**
 * The bell reads what the server writes. functions/src/lib/inAppNotice.js
 * builds every notice; `toInAppNotice` is how the client listener reads one.
 * Feed the first into the second so the field names cannot drift apart.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { toInAppNotice, bellNotices, inAppPath, noticePriority, BELL_EXCLUDED_TYPES, PRIORITY_OF, NOTICE_MODULE_CATALOG } from '../inAppNotice';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const server = require('../../../../functions/src/lib/inAppNotice');

describe('server notice → bell', () => {
  it('reads every field the server builder writes, under the same name', () => {
    const built = server.buildNotice({
      userId: 'uid-1',
      type: 'memo.issued',
      title: 'Memo issued MEMO-ZTA-2026-001',
      message: 'Amina issued a request memo addressed to you.',
      module: 'memos',
      entityType: 'memo',
      entityId: 'm1',
      actionUrl: '/memos/m1',
      priority: 'P1',
      source: 'memos',
    });
    const n = toInAppNotice('n1', { ...built, createdAt: Timestamp.fromMillis(1000) });
    expect(n).toMatchObject({
      id: 'n1',
      type: built.type,
      title: built.title,
      message: built.message,
      module: built.module,
      priority: built.priority,
      isRead: built.isRead,
      isArchived: built.isArchived,
      actionUrl: built.actionUrl,
      entityType: 'memo',
      entityId: 'm1',
      severity: 'warning',
    });
    expect(n.isRead).toBe(false);
    expect(n.priority).toBe('high');
  });

  it('agrees with the server on the priority ladder and on what counts as an in-app path', () => {
    expect(PRIORITY_OF).toEqual(server.PRIORITY_OF);
    for (const [word, priority] of Object.entries(server.PRIORITY_OF as Record<string, string>)) {
      expect(noticePriority(word), word).toBe(priority);
      expect(toInAppNotice('x', { priority: word }).priority, word).toBe(priority);
    }
    for (const url of ['/a', '/memos/m1?x=1', 'https://x.example', '//x.example', '', 'a/b']) {
      expect(inAppPath(url), url).toBe(server.inAppPath(url));
    }
  });
});

describe('legacy docs still read correctly', () => {
  it('maps read → isRead, link → actionUrl, body/subject → message/title, severity → priority', () => {
    const n = toInAppNotice('d1', { userId: 'u', type: 'system_alert', subject: 'High number of overdue items', body: 'Review urgently', link: '/finance/overview', read: false, severity: 'warning' });
    expect(n).toMatchObject({ isRead: false, isArchived: false, actionUrl: '/finance/overview', message: 'Review urgently', title: 'High number of overdue items', priority: 'high' });
    expect(toInAppNotice('d2', { read: true }).isRead).toBe(true);
    expect(toInAppNotice('d3', { sourceModule: 'agents' }).module).toBe('agents');
  });

  it('prefers isRead to read when a doc carries both, and never turns an external link into a target', () => {
    expect(toInAppNotice('d', { isRead: true, read: false }).isRead).toBe(true);
    expect(toInAppNotice('d', { isRead: false, read: true }).isRead).toBe(false);
    expect(toInAppNotice('d', { actionUrl: 'https://evil.example' }).actionUrl).toBeUndefined();
  });
});

describe('what the bell lists', () => {
  const now = Date.parse('2026-10-29T09:00:00Z');
  const base = (over: Record<string, unknown>) => toInAppNotice(String(over.id), { title: 't', type: 'task.assigned', module: 'intelligence', ...over });

  it('drops message notices, archived, expired and muted ones, and keeps the rest in order', () => {
    const items = [
      base({ id: 'a' }),
      base({ id: 'msg', type: 'message' }),
      base({ id: 'arch', isArchived: true }),
      base({ id: 'old', expiresAt: Timestamp.fromMillis(now - 1) }),
      base({ id: 'live', expiresAt: new Date(now + 60_000).toISOString() }),
      base({ id: 'memo', module: 'memos' }),
      base({ id: 'b', module: 'agents' }),
    ];
    expect(bellNotices(items, now).map((n) => n.id)).toEqual(['a', 'live', 'memo', 'b']);
    expect(bellNotices(items, now, ['memos', 'agents']).map((n) => n.id)).toEqual(['a', 'live']);
  });

  it('leaves exactly the message type to the Messages launcher; every mutable module has a label', () => {
    expect([...BELL_EXCLUDED_TYPES]).toEqual(['message']);
    expect(NOTICE_MODULE_CATALOG.map((m) => m.module)).toContain('intelligence');
    expect(NOTICE_MODULE_CATALOG.every((m) => m.label && m.description)).toBe(true);
  });
});
