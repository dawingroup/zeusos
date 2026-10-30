#!/usr/bin/env node
/**
 * Audit Market Intelligence — data-model integrity (WP0)
 *
 * READ-ONLY. Reproduces every count in
 * docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md: documents per
 * collection (owned and retired), subsidiary vocabulary on every scoped
 * field, orphaned competitor references, social shells, report-shape drift,
 * archive stamps. The checks themselves live in
 * scripts/lib/marketIntelIntegrity.cjs (pure, unit-tested); this file only
 * reads Firestore and prints.
 *
 * Run (Admin SDK over application-default credentials, like every other
 * scripts/audit-*.cjs):
 *   NODE_PATH=<a functions node_modules> node scripts/audit-market-intel-integrity.cjs [--json] [--strict] [--sample N]
 *
 *   --json      print the report as JSON instead of text
 *   --strict    exit 1 when any defect count is above zero (post-change gate)
 *   --sample N  read at most N documents from the three social collections
 *               (they are the only ones that can grow large)
 */
'use strict';

const admin = require('firebase-admin');
const { AUDITED_COLLECTION_IDS, auditMarketIntel, hasDefects, renderReport } = require('./lib/marketIntelIntegrity.cjs');

const PROJECT_ID = process.env.FIREBASE_PROJECT || 'zeusos';
const SAMPLED_COLLECTIONS = new Set(['social_posts', 'social_metrics', 'topic_mentions']);

function flag(name) {
  return process.argv.includes(name);
}

function option(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const asJson = flag('--json');
  const strict = flag('--strict');
  const sample = Number(option('--sample', '3000'));

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  const snapshots = {};
  const sampled = {};
  for (const id of AUDITED_COLLECTION_IDS) {
    let q = db.collection(id);
    if (SAMPLED_COLLECTIONS.has(id) && Number.isFinite(sample) && sample > 0) {
      q = q.limit(sample);
      sampled[id] = true;
    }
    const snap = await q.get();
    snapshots[id] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    if (!asJson) process.stderr.write(`read ${id}: ${snap.size}\n`);
  }

  const report = auditMarketIntel(snapshots, { sampled, measuredAt: new Date().toISOString() });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderReport(report)}\n`);
  }
  if (strict && hasDefects(report)) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`audit failed: ${err.stack || err.message}\n`);
  process.exitCode = 2;
});
