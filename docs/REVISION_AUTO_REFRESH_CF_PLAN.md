# Cloud Function follow-up: Auto-refresh parts on revision upload

Design note, not implemented. Captures the scope for the last piece of
the Revision → Parts Refresh loop — triggering the refresh automatically
when a new `DesignRevision` lands, rather than waiting for a user to
click "Apply revision".

## Why this is a separate round

The in-app path (user-triggered) covers the common case safely: preview
+ granular accept/reject + lock preservation + audit-ready issue auto-
resolution. A Cloud Function adds genuinely different operational
surface:

- **Idempotency under retries.** Pub/Sub / Firestore triggers can
  deliver the same event more than once; the function must recognise
  "already applied" and skip cleanly.
- **Cost.** Every revision upload running AI grouping on every bound
  cabinet is multiplicative. A 12-cabinet kitchen scene with a
  nightly Shapr3D round-trip = 12× AI calls per revision, unprompted.
- **Failure recovery.** Nothing in the app asks to rerun a failed
  auto-refresh; the function needs its own retry + DLQ story.
- **User surprise.** In-flight scene edits can get out-paced by the
  function, producing stale locks or orphan part overrides.

These are tractable but each warrants deliberate choices, so this work
stays behind a gate.

## Trigger surface

Three reasonable triggers, pick one:

1. **Firestore `onCreate` for `designRevisions/{id}`** — closest to the
   app; fires as soon as the revision doc lands. Downside: the GLB
   often isn't in Storage yet (CAD→GLB regeneration lags the doc
   create). Need to defer with a retry-until-glbUrl-populated loop, or
   gate on a status field.

2. **Storage `onFinalize` for `workshop-viewer/revisions/**.glb`** —
   fires exactly when the GLB is ready. Cleaner causality. Downside:
   requires mapping the Storage path back to its DesignRevision doc
   (embed revisionId in the path, or maintain a `storagePath → docId`
   index).

3. **Pub/Sub topic** emitted from the existing `uploadRevisedModel`
   flow once Cloud Function A (CAD→GLB) finishes. Most explicit, adds
   one hop.

Recommendation: **(2)** — Storage finalize is the least racy and keeps
the client dumb about the server pipeline.

## Function responsibilities

```
on-revision-glb-ready(storageEvent):
  revision = findRevisionForStoragePath(storageEvent.name)
  if !revision or revision.source === 'parametric': return

  cabinets = queryCabinetsForProject(revision.projectId) where designItemId != null
  for cab in cabinets (in parallel, capped concurrency):
    if cab.lastAppliedRevisionNumber >= revision.revisionNumber: continue
    if cab.isLocked: continue                        // production-locked
    if cab.hasPendingUserEdits: continue             // see "User-edit safeguard" below

    try:
      preview = previewRevisionApply(...)            // dry-run, same code as UI
      if preview.diff.summary.{added+changed+removed} === 0:
        stampLastAppliedRevision(cab, revision)      // cheap — no AI re-run
        continue

      applyRevisionToCabinet(..., preview.defaultDecisions, serviceAccountUser)
      // Auto-resolves the revision-detector issue by default.
    catch err:
      raiseIssue(kind='revision', severity='major',
                 title='Auto-refresh failed', body=err.stack,
                 source='cf-auto-refresh')
```

## User-edit safeguard

The biggest risk: the function overwrites a user's in-flight part
edits. Guard with a `cabinet.pendingUserEditsUntil` timestamp:

- Any interactive mutation that touches `assemblies[].parts` bumps
  this to `serverTimestamp() + 30 min`.
- The function skips cabinets where `pendingUserEditsUntil > now`,
  queuing a deferred retry via its own scheduled task.
- User can override with an explicit "Apply now" in the UI (already
  built — the manual RevisionDiffModal path).

Alternative: require a per-project `autoRefreshOnRevision` boolean
on `DesignProject`, defaulting to OFF. Admins opt in per project.
Cheaper than the timestamp dance, loses some convenience.

## Reusable from the app code

Everything in `revisionPartsRefresh.ts` is intentionally pure-client-
logic:

- `previewRevisionApply` — needs `fetch(glbUrl)` in a Node runtime
  (use `node-fetch` or Firebase Admin Storage SDK).
- `applyRevisionToCabinet` — talks to Firestore via the modular SDK;
  swap for `firebase-admin/firestore` on the function side. Rest of
  the code is plain TS.
- `mergeDiff`, `diffCabinetParts`, `defaultDecisionFor` — zero I/O,
  works as-is.

Estimated 60 LOC of Firebase Admin plumbing to wrap the existing
orchestrator. The heavy lifting is the operational work (trigger
choice, retries, DLQ, user-edit safeguard, cost monitoring), not the
code.

## Billing + cost

AI grouping call ~= one LLM completion per cabinet per auto-run.
Rough upper bound on a busy team:

- 20 active projects × avg 8 cabinets × 2 revisions/day = 320 AI calls/day
- At $0.01–0.05 per grouping call → **$3–16/day**, $100–500/month

Likely fine, but worth monitoring. Add a daily rollup in
`functions/metrics/` that counts CF invocations + tokens used.

## Out of scope for this follow-up

- Batch "apply one revision to N projects" (admin tool).
- Scheduled re-runs (e.g. "re-check all stale cabinets every Monday").
- Webhook out to Slack / email when auto-refresh raises an issue.

## Acceptance checklist when implemented

- [ ] Storage finalize trigger wired + region-pinned.
- [ ] Maps storage path → revision doc (either embed revisionId in
      path or index collection).
- [ ] Skips locked / pending-edit cabinets; queues deferred retry.
- [ ] Uses service-account credentials; `createdBy` on auto-raised
      issues = the function's service account uid with a clear
      `createdByName` like "CF auto-refresh".
- [ ] Raises `revision`-kind issues on any cabinet-level failure with
      full stack in body.
- [ ] Idempotent: seeing the same Storage event twice produces one
      modelPackage bump, not two.
- [ ] Metrics: per-invocation duration, per-cabinet outcome, AI token
      usage logged to a collection or Cloud Monitoring.
- [ ] Feature-flagged per project via `DesignProject.autoRefreshOnRevision`
      (default OFF).
