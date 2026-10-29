# Phase 6.E — Daily Plan + task hardening

Ported from DawinOS's Sept–Oct 2026 task-engine wave (stream E of the port
triage) onto ZeusOS's `generated_tasks` engine. Everything lives under
`functions/src/event-task-engine/` and `src/modules/intelligence-layer/daily-plan/`.

## The loop

| When (Africa/Nairobi) | Function | What |
|---|---|---|
| 17:00 | `dailyPlanDraftRun` | Draft each person's plan for their **next working day** (≤ 7 items; carry-overs first, then overdue, manager picks, due today, ranked). File one "Review tomorrow's plan for your team" task per manager, close yesterday's, **pin** it first on the manager's own plan for today, ring the bell. |
| 17:00–20:00 | `/tasks/review` | The manager shapes each plan: day goal, note, reorder, timebox, add from open work, draft a task, **Mark reviewed**. The Coverage banner shows who has no plan and what work has nobody. Marking the last plan reviewed closes the review task. |
| 20:00 | `dailyPlanCloseRun` | Close the day. Blank items resolve from the live task (closed → done, open → carried, blocked → blocked); a person's own wrap-up stands. Non-working-day plans close empty. Then tomorrow's untouched system drafts are re-drafted from the carry-overs just finalised. |
| 06:00 | `dailyPlanPublishRun` | Publish today's drafts — reviewed or not, the gap stays visible — backfill anyone with open work but no plan, and send "Your focus today". |
| 02:30 | `staleTaskSweep` | Cancel the dead tail: never approvals, never anything a person engaged with, never a person's own task. |
| every 30 min | `taskHygieneRun` | Owners for `pending_assignment` work (role → department → manager of actor → owner), auto-close on resolved records, overdue escalation in **working hours** (P3→P2→P1→P0, once per threshold, stops at P0), due-soon reminders at 24/4/1 h. |

`taskEngineRunNow { run }` (admin) runs any of them on demand.

## Collections

- `generated_tasks/{taskId}` — the one task collection. Statuses
  `pending_assignment | assigned | in_progress | pending_review | blocked | completed | cancelled`
  (legacy `pending` reads as `assigned`); priorities `P0`–`P3` (legacy words mapped on read);
  `kind` approval / review / action / followup / notify decides the buttons. Every transition is a
  `history[]` row. Rules: staff read, admin write — people act through the callables.
- `daily_plans/{date}_{assigneeUid}` — the day's contract. `status draft | published | closed`,
  `reviewed`, `source system | manager` (a manager-shaped plan is never recomposed), `items[]`
  (denormalised title/priority/dueAt/kind/entity + `focusReason` + `timeboxMinutes` + `outcome`),
  `acknowledgedAt`, `wrapUp { at, summary, blockers, carriedTaskIds, closedBy }`, `nonWorkingDay`.
  Readable by the assignee, the named manager and parent-org principals; written only by `dailyPlanAction`.
- `notifications/` — the bell. `type` `daily_plan`, `daily_plan_review`, `task_assigned`,
  `task_escalated`, `task_blocked`, `task_due_soon`; deterministic ids so nothing lands twice.

## Callables (all `europe-west1`)

- `taskAction { taskId, action, note?, reason?, assigneeId?, outcome?, itemId?, completed? }` —
  `start · complete · block · unblock · cancel · reopen · claim · assign · submit_review · checklist`.
  The assignee, their manager, the creator or a parent-org principal may act; `claim` needs only a
  staff login. **Mark blocked asks why.** Mark done follows the required checklist.
- `createTask { title, description?, priority?, dueAt?|dueDate?, assigneeId?, kind?, estimateMinutes?, … }` —
  your own task (`source: personal`), or one for someone who reports to you.
- `dailyPlanAction { action, date, assigneeUid?, … }` — assignee: `acknowledge · setItemOutcome ·
  clearItemOutcome · wrapUp`; manager: `createEmptyPlan · saveItems · saveNotes · markReviewed`.
  Done closes the task **first** and refuses silently-done items (approval decided on its record,
  required checks open); Blocked puts the task on hold with the reason so the manager hears.

## Libraries (`functions/src/event-task-engine/lib/`)

`taskModel` (vocabulary) · `taskRanking` (the one score) · `workingTime` (08:00–17:00 Mon–Fri) ·
`dailyPlan` (pure composition, working days, pinned review, outcome resolution) · `peopleDirectory`
(employees + users → one record per person, keyed by employee id, uid and email; manager uid
through `position.reportingTo`) · `dailyPlanData` / `dailyPlanDraft` · `notices` / `taskNotice` ·
`taskReopenPolicy` (a person's close stands 14 days) · `taskPriority` · `taskKind` ·
`entityResolution` (which record states mean "dealt with", per aggregate and per rule) ·
`staleTaskPolicy` · `taskAutoClose` · `assigneeResolution` · `callerAuth`.

## Tests

`cd functions && npm test` — `__tests__/event-task-engine/` holds 82 tests (composition, policies,
the three plan runs end to end on the Firestore stub, hygiene, callables, generator hardening).

> The committed `functions/node_modules` symlink is self-referencing, so locally the suite needs
> real dependencies on the require path: `npm ci` into a scratch folder from `functions/package.json`
> and run with `NODE_PATH=<that>/node_modules`.

## AI (PR 3 — dark without `ANTHROPIC_API_KEY`)

- `draftTasksWithAi { intent, assigneeUid?, planDate?, maxTasks? }` — "Draft with AI" in the plan
  editor. Claude sees the person's open work and returns 1–5 editable drafts
  (`title · description · priority · kind · estimateMinutes · dueDate · why`); nothing is written until
  the manager confirms through `createTask`. Without a key it refuses with `failed-precondition` and a
  sentence the form shows; the form still works by hand. One `agent_audit_entries` row per run (ZA-010).
- The morning brief — `functions/src/event-task-engine/ai/dailyBrief.js`, called inside the 06:00
  publish for every published plan with work on it: two or three sentences built only from the plan
  (first thing and why, what is carried or overdue, what to protect time for), stored as
  `plan.brief` / `briefAt` / `briefDate` / `briefModel` and shown on My Day. Best-effort, once per day,
  capped per run; without a key the publish is unchanged.

## Not ported (deliberately)

Google Chat nudges, the DawinOS `dailyDigests` derived doc, entity write-back propagation
(ZeusOS records are decided on-record through their own callables), orientation sessions,
`personalTaskMirror` (ZeusOS has `createTask` instead), the DawinOS CEO-lens manager reviews.
