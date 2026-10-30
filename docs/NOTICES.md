# In-app notices — one shape, a bell, muted modules (DawinOS stream C port)

Ported 2026-10-29. A notice is the bell's unit: one person, one line, one place to go. Everything that wants to tell someone something in ZeusOS writes a notice through one library and the bell reads every notice through one reader, so the two cannot disagree on a field name again.

## Why

Before this, four server writers of `notifications/` disagreed on every field the bell reads. The task engine wrote `userId` / `isRead` / `actionUrl`; the agents wrote `targetUserId` / `body` with no `userId` and no `organizationId`; the deadline monitor wrote `recipientRole: 'ADMIN'` / `subject` / `read`; the finance optimiser wrote to a different collection. The client listener filters on `userId == me` and `organizationId == 'default'`, so an agent or deadline notice was written and never seen by anyone — and the rules let only its `userId` read it, so a role-shaped notice was readable by nobody below admin. The `notifications` rules also let any signed-in user create a notice for anybody.

## The shape

`functions/src/lib/inAppNotice.js` (pure) builds every notice:

| field | meaning |
|---|---|
| `userId` | the ONE person it is for — audiences are resolved to people at write time, never stored |
| `organizationId` | `'default'` (what the listener filters on) |
| `type` | the event (`task.assigned`, `memo.issued`, `agent.escalate`, `system_alert`, …) |
| `title`, `message` | ≤ 200 / ≤ 2000 chars |
| `module` | the writing module (`intelligence`, `memos`, `agents`, `finance`, …) — what a person can mute |
| `entityType`, `entityId` | the record it is about |
| `actionUrl` | an in-app path, or null — never an external URL (the bell navigates in place) |
| `priority` | `critical` · `high` · `medium` · `low`; producers may say `urgent`, `warning`, `info`, `P0`–`P3` and land on the one ladder |
| `isRead`, `isArchived` | the only fields a reader may change (`readAt`, `archivedAt`, `updatedAt` ride along) |
| `source` | which system wrote it (`task-engine`, `memos`, `agent:ZA-003`, `deadline-monitor`) |
| `recipientRole` | the audience a fanned-out notice was meant for, for the audit trail |
| `expiresAt` | optional; an expired notice drops out of the bell on its own |

Timestamps are ISO strings (the task-engine convention).

## Writing one

`functions/src/lib/noticeDelivery.js`:

```js
const { notifyUser, notifyAudience } = require('../lib/noticeDelivery');

await notifyUser(db, { userId, type: 'memo.returned', title, message, actionUrl: `/memos/${id}`, module: 'memos', priority: 'high', source: 'memos', dedupeKey: `memo_returned:${id}:${version}` });
await notifyAudience(db, { audience: { kind: 'brand_leads', subsidiaryId }, type: 'agent.escalate', title, module: 'agents', priority: 'high' });
```

- Best-effort: a notice is never the record of what happened, so a failed or invalid write logs and returns `false`; it never throws into the caller's business write.
- `dedupeKey` → doc id `${key}_${userId}` (Firestore `create()`, so a repeat never flips a read notice back to unread). Use it for anything re-evaluated on every run.
- Audiences resolve to uids, in a stable order (by email), active users only, across `users` and `organizations/default/users`: `{ kind: 'user', uid | personKey }` (a uid, an employee id or an email through the people directory), `{ kind: 'role', role }` (that globalRole and the tiers above it), `{ kind: 'parent_org' }` (Zeus Group principals), `{ kind: 'brand_leads', subsidiaryId }` (the brand's `deliveryLeadFor` users, else its MDs), `{ kind: 'brand_staff', subsidiaryId }`, `{ kind: 'role_profile', roleProfileId }` (active `role_assignments`). An audience that names nobody falls back to the owners, then the admins (`fellBack: true`); nobody at all → nothing written, logged.
- The task engine's `event-task-engine/lib/notices.js` is now an alias of this (module defaults to `intelligence`); `agents/handlers/notify.js` resolves its four audiences (`user` · `team` → brand staff · `subsidiary_lead` → brand leads · `escalate` → parent org) through it; `scheduled/deadline-monitoring.js` writes its alert to the admins and its summary to the parent org, deduped per slot.

Rules: `notifications` are created by the server only (`isAdmin()` from a client); a reader may update only `isRead` / `isArchived` / `readAt` / `archivedAt` / `updatedAt` on their own notice.

## Reading one

`src/core/services/inAppNotice.ts` — `toInAppNotice(id, doc)` normalises every doc (legacy `read` / `link` / `body` / `subject` / `severity` still read); `bellNotices(items, nowMs, mutedModules)` is what the bell lists: the person's own, minus `message` types (the Messages button owns those), archived, expired and muted. `src/core/services/__tests__/inAppNotice.test.ts` feeds the server builder's output through the reader so the two stay in lockstep. GlobalContext's one listener maps every snapshot through it; `GlobalNotification` carries `priority` (and a derived `severity` for older consumers), `isArchived`, `entityType` / `entityId`.

The bell (`TopNavBar`) shows the unread count; `NotificationCenter` lists bell notices, marks one read and navigates to its `actionUrl` on click, and links to the settings.

## Preferences

`/notification-settings` — which modules to mute in the bell (`NOTICE_MODULE_CATALOG`). Saved through GlobalContext's preferences store at `users/{uid}/settings/preferences.notificationSettings.mutedModules` — and, as of this port, loaded back at sign-in (they were only ever saved). Email and push are not channels yet (they arrive with the Google Workspace stream, N), so the page shows no switch that would do nothing. The rule `users/{uid}/settings/{id}` is the person's own.

## Tests

- `functions/__tests__/notifications/inAppNotice.test.js` — shape, ladder, paths, dedupe, failure isolation, every audience kind and its fallback, the task-engine alias, the agents' handlers.
- `src/core/services/__tests__/inAppNotice.test.ts` — reader ↔ builder lockstep, legacy docs, what the bell lists.
- `src/core/components/notifications/__tests__/NotificationCenter.test.tsx`, `src/pages/profile/__tests__/NotificationSettingsPage.test.tsx`.

## Not ported / follow-ups

- Email digest, the approvals roll-up and the email policy (`digest.js`, `approvalsBatch.js`, `emailPolicy.js`, quiet hours) — they need an email transport; port with stream N (Google Workspace / Gmail outbox) and plug the pure policy in then.
- The legacy `finance/optimizerNotifications.js` (writes `companies/{id}/notifications`) is not exported from `index.js`; retire with the DawinOS finance optimiser.
- A backfill of the pre-port `notifications` docs (`recipientRole`-only, `targetUserId`-only) — they are unreadable by their intended readers today; delete or re-point once the writers above have been deployed.
