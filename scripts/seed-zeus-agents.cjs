/**
 * Seed the ZeusOS agent registry into `agents/{id}`.
 *
 * Reads the canonical agent list from functions/data/defaultAgents.json (the
 * same file the Cloud-Function dispatcher uses as its seed fallback) and
 * writes each with merge:true so admin edits made in the UI are preserved on
 * re-run. Zeroed `metrics` + server timestamps are added.
 *
 * Run:
 *   node scripts/seed-zeus-agents.cjs --dry-run
 *   node scripts/seed-zeus-agents.cjs
 *
 * Auth (resolved in this order — always against project `zeusos`):
 *   1. `--key=/path/to/zeusos-sa.json` flag or `ZEUSOS_SA_KEY` env — an
 *      explicit ZeusOS service-account key (cert credential).
 *   2. `GOOGLE_APPLICATION_CREDENTIALS` ONLY if it looks like a zeusos key.
 *      A stray DawinOS key (the common case on this machine) is ignored so
 *      it can't silently authenticate as the wrong project.
 *   3. gcloud Application Default Credentials — `gcloud auth application-
 *      default login` with an account that has access to zeusos.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'zeusos';
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function resolveCredential() {
  // 1. Explicit ZeusOS service-account key.
  const keyArg = args.find((a) => a.startsWith('--key='));
  const explicitKey = (keyArg && keyArg.slice('--key='.length)) || process.env.ZEUSOS_SA_KEY;
  if (explicitKey) {
    const abs = path.resolve(explicitKey);
    const sa = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (sa.project_id && sa.project_id !== PROJECT_ID) {
      throw new Error(`Service account key is for project "${sa.project_id}", not ${PROJECT_ID}. Refusing to seed.`);
    }
    return { source: `service-account key (${abs})`, options: { projectId: PROJECT_ID, credential: admin.credential.cert(sa) } };
  }

  // 2. GOOGLE_APPLICATION_CREDENTIALS — only honour a zeusos key.
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac) {
    let belongsToZeus = false;
    try {
      const sa = JSON.parse(fs.readFileSync(gac, 'utf8'));
      belongsToZeus = sa.project_id === PROJECT_ID;
    } catch { /* unreadable — treat as foreign */ }
    if (belongsToZeus) {
      return { source: `GOOGLE_APPLICATION_CREDENTIALS (${gac})`, options: { projectId: PROJECT_ID, credential: admin.credential.applicationDefault() } };
    }
    // Foreign (e.g. dawinos) key — strip it so it can't shadow gcloud ADC.
    console.warn(`⚠  Ignoring GOOGLE_APPLICATION_CREDENTIALS (${gac}) — not a ${PROJECT_ID} key. Using gcloud ADC instead.`);
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  // 3. gcloud Application Default Credentials.
  return { source: 'gcloud ADC (application-default login)', options: { projectId: PROJECT_ID, credential: admin.credential.applicationDefault() } };
}

const cred = resolveCredential();
console.log(`Auth: ${cred.source} → project ${PROJECT_ID}`);
admin.initializeApp(cred.options);
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const ZERO_METRICS = {
  tasks30d: 0,
  acceptanceRate: 0,
  latencyMsP50: 0,
  latencyMsP95: 0,
  estMonthlyCostMinor: 0,
  falsePositiveRate: 0,
  lastActedAt: null,
};

async function main() {
  const seedPath = path.join(__dirname, '..', 'functions', 'data', 'defaultAgents.json');
  const agents = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  console.log(`Seeding ${agents.length} agents into agents/{id} (dryRun=${DRY_RUN})`);

  for (const a of agents) {
    const doc = {
      ...a,
      metrics: { ...ZERO_METRICS },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'seed-script',
    };
    console.log(`  ${a.id}  ${a.name}  [${a.status} · ${a.autoActMode} · ${a.enabledTools.length} tools]`);
    if (!DRY_RUN) {
      await db.collection('agents').doc(a.id).set(doc, { merge: true });
    }
  }

  console.log(DRY_RUN ? 'Dry run — no writes.' : 'Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
