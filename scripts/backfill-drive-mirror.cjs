/**
 * Backfill: mirror existing `projectFiles` + `designProjects` into the
 * Shared-Drive tree created by Phase 2 triggers.
 *
 * Use this ONCE after the Phase 0 admin actions complete:
 *   1. `04_Templates-Resources` / `01_Active-Projects` shared drives exist.
 *   2. `GOOGLE_DRIVE_PRIVATE_KEY` + `GOOGLE_DRIVE_CLIENT_EMAIL` secrets are set.
 *   3. `DRIVE_ACTIVE_PROJECTS_FOLDER_ID` env var is populated.
 *
 * What it does, in order:
 *   A. For every `designProjects` doc WITHOUT `driveFolderId`, invokes the
 *      bootstrap logic (idempotent — safe to re-run).
 *   B. For every `projectFiles` doc where `isLatest == true` AND
 *      `driveFileId` is missing AND `driveSyncError` is missing, invokes
 *      the mirror logic.
 *
 * Options:
 *   --dry-run        Log actions but don't write to Drive or Firestore.
 *   --limit=N        Process at most N project-files (default: unlimited).
 *   --project=ID     Restrict to a single designProjects doc (debugging).
 *
 * Run:
 *   GOOGLE_APPLICATION_CREDENTIALS=./path/to/admin-sa.json \
 *   DRIVE_ACTIVE_PROJECTS_FOLDER_ID=<folderId> \
 *   GOOGLE_DRIVE_CLIENT_EMAIL=<svc@...> \
 *   GOOGLE_DRIVE_PRIVATE_KEY="$(cat key.pem)" \
 *   NODE_PATH=functions/node_modules \
 *   node scripts/backfill-drive-mirror.cjs [--dry-run] [--limit=100]
 */

const admin = require('firebase-admin');
const path = require('path');

// ─── CLI args ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const PROJECT_FILTER = (argv.find((a) => a.startsWith('--project=')) || '').split('=')[1] || null;
const LIMIT = Number((argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;

// ─── Env check ─────────────────────────────────────────────────────────
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`\n[backfill] Missing required env var: ${name}`);
    console.error('[backfill] Refusing to run — set Phase 0 config first.\n');
    process.exit(1);
  }
  return v;
}
if (!DRY_RUN) {
  requireEnv('DRIVE_ACTIVE_PROJECTS_FOLDER_ID');
  requireEnv('GOOGLE_DRIVE_CLIENT_EMAIL');
  requireEnv('GOOGLE_DRIVE_PRIVATE_KEY');
}

// ─── Firebase admin init ───────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'dawinos',
  });
}

// ─── Load Phase 2 modules (wire env → params) ──────────────────────────
// The Cloud Function code reads config via `defineString(...).value()`
// which transparently reads from `process.env.X` in Node, so we don't
// need to do anything extra here — the env vars above make the
// feature-flag check return true.
const functionsRoot = path.resolve(__dirname, '../functions');
const {
  createProjectDriveFolders,
} = require(path.join(functionsRoot, 'src/drive/createProjectFolders'));
const {
  mirrorProjectFileToDrive,
} = require(path.join(functionsRoot, 'src/drive/mirrorProjectFile'));

const db = admin.firestore();

// ─── Phase A: backfill project folders ─────────────────────────────────
async function backfillProjects() {
  let q = db.collection('designProjects');
  if (PROJECT_FILTER) q = q.where(admin.firestore.FieldPath.documentId(), '==', PROJECT_FILTER);
  const snap = await q.get();
  let processed = 0;
  let created = 0;
  let failed = 0;
  console.log(`[backfill] Phase A — ${snap.size} designProjects docs to inspect`);
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.driveFolderId) continue; // already done
    processed++;
    if (DRY_RUN) {
      console.log(`  [dry] would bootstrap project ${doc.id} (${data.code})`);
      continue;
    }
    try {
      const res = await createProjectDriveFolders(doc.id, data);
      if (res && res.driveFolderId) {
        created++;
        console.log(`  ✓ ${doc.id} → ${res.driveFolderId}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${doc.id} — ${err.message || err}`);
    }
  }
  console.log(`[backfill] Phase A done — processed=${processed} created=${created} failed=${failed}`);
}

// ─── Phase B: backfill file mirrors ────────────────────────────────────
async function backfillFiles() {
  let q = db.collection('projectFiles').where('isLatest', '==', true);
  if (PROJECT_FILTER) q = q.where('projectId', '==', PROJECT_FILTER);
  const snap = await q.get();
  let processed = 0;
  let mirrored = 0;
  let failed = 0;
  console.log(`[backfill] Phase B — ${snap.size} latest projectFiles docs to inspect`);
  for (const doc of snap.docs) {
    if (processed >= LIMIT) {
      console.log(`[backfill] hit --limit=${LIMIT}, stopping early`);
      break;
    }
    const data = doc.data();
    if (data.driveFileId) continue; // already mirrored
    processed++;
    if (DRY_RUN) {
      console.log(`  [dry] would mirror ${doc.id} (${data.name || data.fileName})`);
      continue;
    }
    try {
      const res = await mirrorProjectFileToDrive(doc.id, data);
      if (res && res.driveFileId) {
        mirrored++;
        console.log(`  ✓ ${doc.id} → ${res.driveFileId}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${doc.id} — ${err.message || err}`);
      // Record the error so operators can triage without re-running.
      try {
        await db.collection('projectFiles').doc(doc.id).update({
          driveSyncError: String(err.message || err).slice(0, 500),
        });
      } catch { /* best effort */ }
    }
  }
  console.log(`[backfill] Phase B done — processed=${processed} mirrored=${mirrored} failed=${failed}`);
}

// ─── Main ──────────────────────────────────────────────────────────────
(async () => {
  console.log(`[backfill] mode=${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'} projectFilter=${PROJECT_FILTER || 'none'} limit=${LIMIT}`);
  await backfillProjects();
  await backfillFiles();
  console.log('[backfill] complete.');
  process.exit(0);
})().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
