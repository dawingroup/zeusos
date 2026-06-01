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
 * Auth: application-default credentials (firebase login / gcloud ADC).
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({ projectId: 'zeusos' });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const DRY_RUN = process.argv.slice(2).includes('--dry-run');

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
