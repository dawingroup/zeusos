# Drive Bridge — Phase 2 Operator Guide

Phase 2 of the Unified File Manager Drive bridge mirrors every
`projectFiles` and `designProjects` write into the Shared-Drive tree
defined by **Dawin-Shared-Drive-Architecture v3 + v3.1** and
**Dawin-File-Management-Naming-Policy v4**. This doc is the ops
checklist for turning it on.

See `/Users/danielonzimai/.claude/plans/users-danielonzimai-library-cloudstorag-piped-hollerith.md`
for the full audit + rationale.

## What ships in Phase 2

| Component | File | Role |
|---|---|---|
| Feature flag + env | `functions/src/drive/config.js` | Short-circuits everything when unset |
| JWT auth | `functions/src/drive/driveAuth.js` | Caches tokens 55 min |
| REST helpers | `functions/src/drive/driveClient.js` | `ensureFolder`, `uploadFile`, `moveItem`, `deleteFile` (all `supportsAllDrives=true`) |
| Folder mapping | `functions/src/drive/folderMapping.js` | `category → 01..07` resolver |
| Folder name | `functions/src/drive/folderBuilder.js` | `{Code}_{Client}_{Type}` |
| Bootstrap | `functions/src/drive/createProjectFolders.js` | Creates `01_Active-Projects/{name}/{01..07}/` |
| File mirror | `functions/src/drive/mirrorProjectFile.js` | Firebase Storage → Drive + writeback |
| Triggers | `functions/src/triggers/driveTriggers.js` | `onCreate` for both collections |
| UI | `UnifiedFileManager.tsx` | "Open in Drive" row action + mirror badge |
| Backfill | `scripts/backfill-drive-mirror.cjs` | Sync pre-Phase-2 data after cutover |
| Governance | `policy/drive-writers.yaml` + `scripts/check-drive-writers.cjs` | v3.1 §7 enforcement |

## Phase 0 admin checklist — DO FIRST

The code deploys safely without these — it just logs "mirror disabled"
and returns. Complete these to turn mirroring on:

1. **Create the `01_Active-Projects` Shared Drive** (or confirm existing).
   Capture the folder ID.
2. **Create the `02_Archive` Shared Drive** (Phase 4 lifecycle).
3. **Provision a service account** with `drive` + `drive.file` scopes
   and Content Manager rights on the Shared Drive root. Capture email +
   PEM private key.
4. **Amend v3.1 §4** to add:
   - `projectfiles-mirror → 01_Active-Projects/{code}_{client}_{type}/{01..07}/`
   - `projectfiles-bootstrap → 01_Active-Projects/{code}_{client}_{type}/`
5. **Set secrets + params** on the functions deployment:
   ```bash
   firebase functions:secrets:set GOOGLE_DRIVE_PRIVATE_KEY
   firebase functions:secrets:set GOOGLE_DRIVE_CLIENT_EMAIL
   firebase deploy --only functions:onDesignProjectCreatedForDrive,functions:onProjectFileCreatedForDrive \
     --set-env-vars DRIVE_ACTIVE_PROJECTS_FOLDER_ID=<folderId>,DRIVE_ARCHIVE_FOLDER_ID=<archiveId>
   ```
6. **Backfill** existing projects + files:
   ```bash
   DRIVE_ACTIVE_PROJECTS_FOLDER_ID=<id> \
   GOOGLE_DRIVE_CLIENT_EMAIL=<svc@...> \
   GOOGLE_DRIVE_PRIVATE_KEY="$(cat key.pem)" \
   GOOGLE_APPLICATION_CREDENTIALS=./path/to/admin-sa.json \
   NODE_PATH=functions/node_modules \
   node scripts/backfill-drive-mirror.cjs --dry-run
   ```
   Review the dry-run output, then re-run without `--dry-run`.

## What the subfolder mapping looks like

`functions/src/drive/folderMapping.js` encodes the audit's Phase 2
proposal:

| `projectFiles.category` / `deliverableType` | Subfolder |
|---|---|
| `client-document` | `01_Brief-&-Scope` |
| `deliverable` / `mood-board`, `concept-sketch`, `3d-model`, `rendering`, `client-presentation`, `shop-drawing` | `02_Design` |
| `cad-model` (any) | `02_Design` |
| `deliverable` / `cut-list`, `bom`, `specification-sheet`, `assembly-instructions` | `03_Engineering` |
| `deliverable` / `shop-drawing` **with** `manufacturingOrderId` | `05_Production` |
| `deliverable` / `handoff-bundle` (Phase 3) | `05_Production` |
| `production-doc` | `05_Production` |
| `report` | `07_Client-Communications` |
| unknown (fallback) | `02_Design` |

Change mapping? Update `folderMapping.js` + its tests in
`functions/__tests__/folderMapping.test.js` + the table above.

## Observability

Every Drive-mirror run logs under `[Drive]` with structured fields.
Failures write to Firestore on the source doc:

- `designProjects.{id}.driveFolderError` — bootstrap failed
- `projectFiles.{id}.driveSyncError` — mirror failed

An operator can `firestore.query('projectFiles').where('driveSyncError', '!=', null)`
to triage errors without reading logs.

The UI surfaces sync state on every file row:

- ✅ **green Drive icon** = `driveWebViewLink` present (mirror succeeded).
- ❌ **red Drive! icon** = `driveSyncError` present (hover for message).
- *no icon* = not yet processed OR mirror disabled.

## Tests

```bash
# Unit tests (pure helpers)
cd functions && node --test __tests__/folderMapping.test.js __tests__/folderBuilder.test.js

# Governance lint (v3.1 §7)
node scripts/check-drive-writers.cjs
```

## What Phase 2 does NOT do (Phase 3+ follow-ups)

- **Update mirroring.** Only `onCreate` triggers exist. Replacing a file
  via `replaceFile` creates a new `projectFiles` doc (new version) which
  fires the trigger — so replacements ARE mirrored. But silent-overwrite
  via `overwriteFile` changes `storageUrl` on the same doc without firing
  `onCreate`; the Drive mirror goes stale. Phase 3 will add an
  `onUpdate` branch.
- **Delete mirroring.** Deleting a `projectFiles` doc does NOT delete
  the Drive file. Intentional for MVP — avoids cross-system delete
  cascades until we're confident. Phase 3 adds this.
- **DawinOS export writer** (F-B6) — needs `04_Templates-Resources`
  drive, which is Phase 0.
- **Finish Library Drive binding** (F-B7) — ditto.
- **Template resolver shim** (F-B8) — ditto.
- **Archive lifecycle** (Phase 4) — `status='completed'` → move to
  `02_Archive/{year}/`. Scaffolding (env var, moveItem helper) is in
  place; the trigger isn't.

## Rolling back

Unset `DRIVE_ACTIVE_PROJECTS_FOLDER_ID`. Triggers short-circuit on the
next invocation. No code changes, no deploy required.

---

## Phase 4 — Archive lifecycle

**What it does**

When a `designProjects` doc transitions to `status: 'completed'`:

1. The `onDesignProjectCompletedForDrive` trigger fires.
2. `archiveProject()` ensures `02_Archive/{YYYY}/` exists on the
   archive Shared Drive (uses `completedDate.getUTCFullYear()` if set,
   else current UTC year).
3. The project's Drive folder is moved from `01_Active-Projects/` into
   `02_Archive/{YYYY}/` via `files.update` with
   `addParents`/`removeParents` — children move with the parent, no
   recursion.
4. Every `projectFiles` doc for the project is batch-flagged
   `archived: true` in chunks of 400 (below Firestore's 500-op batch
   limit).
5. The `designProjects` doc is stamped `archived: true`,
   `archivedAt`, `archivedBy`, and a fresh `driveFolderUrl` pointing at
   the new archive location.

**Idempotent by construction.** Re-running on an already-archived
project is a no-op; `addParents`/`removeParents` is a set operation;
the file batch is safe to re-apply.

**Monthly sweep** — `archiveSweep` fires on the 1st of each month at
03:00 Africa/Kampala. It picks up any project that is
`status='completed'` but not `archived`, passes the 7-day quiet
period (updatedAt ≥ 7 days old), and applies the same archive
flow. Caps at 100 projects per run; run it multiple months in a row
to drain a backlog, or trigger manually via the Firebase Console.

### Phase 4 env / config

One additional env var beyond Phase 2:

```bash
DRIVE_ARCHIVE_FOLDER_ID=<02_Archive-drive-folder-id>
```

If this is unset, `isArchiveEnabled()` returns false and BOTH the
trigger AND the monthly sweep short-circuit with a log line.
`GOOGLE_DRIVE_PRIVATE_KEY` + `GOOGLE_DRIVE_CLIENT_EMAIL` are already
required by Phase 2 — no new secrets.

### UI behaviour

The UnifiedFileManager hides archived files by default. When at least
one archived file exists in scope, a **"Show archived (N)"** checkbox
appears next to the auto-gen filter. Flipping it on shows archived
files with a slight opacity reduction so they visually separate from
active work. Approval lock + ownership rules still apply — archiving
is a read-only *convention*, not a write-blocking rule.

### What Phase 4 does NOT do

- **No TTL / hard delete.** Archived projects stay in
  `02_Archive/{YYYY}/` indefinitely. Retention policy is a Phase 5
  open question.
- **No reactivation.** Projects that flip back from `completed` to
  something else don't auto-move back to `01_Active-Projects/`. Rare
  enough in practice that we handle it manually; can be automated if
  we see friction.
- **No legacy-project drive-folder backfill.** Projects that completed
  before Phase 2 shipped have no `driveFolderId`, so archiving flags
  the Firestore state without moving anything on Drive. The monthly
  sweep picks them up and clears the flag; the folders themselves
  stay wherever they were.

### Testing Phase 4

```bash
# Unit tests for the eligibility predicate
cd functions && node --test __tests__/archiveSweep.test.js

# Full test suite (also exercises the Phase 4 rules interactions)
npx vitest run tests/firestore.rules.test.ts
```

End-to-end:
1. Pick a test project with `status='completed'` + `updatedAt` ≥ 7 days ago.
2. Emulator: `firebase emulators:start --only functions,firestore`.
3. Trigger `archiveSweep` from the Firebase Functions Emulator UI.
4. Assert project's Drive folder is now under `02_Archive/{YYYY}/`,
   `designProjects.{id}.archived === true`, and every linked
   `projectFiles` doc has `archived === true`.

### Rolling back Phase 4

Unset `DRIVE_ARCHIVE_FOLDER_ID`. Trigger + sweep short-circuit. Already
-archived projects remain flagged — but the flag is purely
informational (not a write-block), so no rollback script is needed.


---

## Universal Drive Folder Mapping — full slot catalog

The Drive Folder Settings admin page (`/admin/drive-folders`) covers
every DawinOS module that produces or consumes Drive artefacts, not
just the Unified File Manager. Slots are grouped to match the v3/v3.1
taxonomy:

### Group — Projects & Archive (live today, Phase 2/4)

| Slot | Policy path | Consumer |
|---|---|---|
| `activeProjects` | `01_Active-Projects/` | Drive bridge `onCreate` for `designProjects` |
| `archive` | `02_Archive/` | `archiveProject` + `archiveSweep` |

### Group — Templates-Resources (Phase 5 prep, v3.1 §3)

| Slot | Policy path | Future consumer |
|---|---|---|
| `templatesResources` | `04_Templates-Resources/` | parent of the four below |
| `documentTemplates` | `04_Templates-Resources/02_Document-Templates/` | template resolver shim (F-B8) |
| `brandAssets` | `04_Templates-Resources/03_Brand-Assets/` | brand-assets reader |
| `finishLibrary` | `04_Templates-Resources/04_Design-Library/Finishes-Library/` | `dawinos_get_finish_library` (F-B7) |
| `dawinosExports` | `04_Templates-Resources/06_DawinOS-Assets/Exports/` | scheduled CFO briefing / production summary exports (F-B6) |

### Group — Subsidiary operations (v3 §03)

| Slot | Policy path | Consumer |
|---|---|---|
| `opsFinishes` | `03_Group-Operations/01_Dawin-Finishes/` | Finishes-scoped reports + docs |
| `opsAdvisory` | `03_Group-Operations/02_Dawin-Advisory/` | advisory reports (`google-docs.service.ts`), strategy docs (`strategyGoogleDocs.service.ts`) |
| `opsCapital` | `03_Group-Operations/03_Dawin-Capital/` | investment memos, portfolio tracking |
| `opsTechnology` | `03_Group-Operations/04_Dawin-Technology/` | Tech/DawinOS engineering artefacts |

### Group — Group HQ departments (v3 §03 + v3.1 amendments)

| Slot | Policy path | Consumer | Policy status |
|---|---|---|---|
| `hqRoot` | `03_Group-Operations/05_Group-HQ/` | parent of below | ✅ v3 |
| `hqFinance` | `…/Finance/` | finance module outputs (CFO briefings, spend plans, month-end packs) | ✅ v3 |
| `hqHR` | `…/HR/` | HR module outputs (contracts, reviews, offer letters) | ✅ v3 |
| `hqLegal` | `…/Legal/` | legal docs (entity filings, IP, contracts, NDAs) | ✅ v3 |
| `hqIT` | `…/IT-&-Systems/` | infra docs (access runbooks, DR plans, licences) | ✅ v3 |
| `hqStrategy` | `…/CEO-&-Strategy/` | CEO OKRs, quarterly reviews, board packs, strategy-canvas exports | ⚠ **v3.1 amendment pending** |
| `hqCompliance` | `…/Compliance/` | compliance filings, audit trails, DPIAs, statutory returns | ⚠ **v3.1 amendment pending** |
| `hqMarketIntel` | `…/Market-Intelligence/` | market-intelligence module (competitor briefs, brand radar) | ⚠ **v3.1 amendment pending** |

### Group — Client Hub (v3 §03)

| Slot | Policy path | Consumer |
|---|---|---|
| `clientsRoot` | `03_Group-Operations/06_Clients/` | customer-hub module — creates per-customer `{CODE} - {NAME}/Projects/Documents/` subfolders |

### Group — Programs (v3 §05)

| Slot | Policy path | Consumer |
|---|---|---|
| `programsAMH` | `05_AMH-Uganda/` (separate shared drive) | AMH program module — governance, finance, partner hospitals |

## v3.1 §3 amendment — pending HQ folders

Three HQ subfolders are not enumerated in v3 §03 and need a formal
v3.1 §3 amendment before they're created:

1. `03_Group-Operations/05_Group-HQ/CEO-&-Strategy/`
2. `03_Group-Operations/05_Group-HQ/Compliance/`
3. `03_Group-Operations/05_Group-HQ/Market-Intelligence/`

The settings page surfaces a **"Policy pending"** badge on each of
these slots so admins don't silently create unauthorised folders.
Binding is permitted today — the governance lint in
`scripts/check-drive-writers.cjs` only fires when a Cloud Function
actually writes to one of these paths, which won't happen until the
consuming modules ship.

## Forward-looking consumers — how new slots get wired

When a new DawinOS module starts writing to one of these slots:

1. Update `policy/drive-writers.yaml` with a new `writers[]` entry
   (the `scripts/check-drive-writers.cjs` lint enforces this).
2. Amend v3.1 §4 to record the new binding (governance rule v3.1 §7).
3. In the Cloud Function, call `getFolderIdForSlot('<slotName>')` from
   `functions/src/drive/config.js`. That returns the admin-set folder
   ID from Firestore with a 60 s cache.
4. Add an env-var fallback if you want a pre-Phase-0 default — most
   new consumers don't need this.

No changes to the settings page code are required for new consumers —
the admin has already mapped the slot.
