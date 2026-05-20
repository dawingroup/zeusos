#!/usr/bin/env node
/**
 * Recompute inventoryCategories.itemCount from actual inventoryItems data.
 *
 * Why: the inventoryCategorySync trigger (functions/src/triggers/inventoryCategorySync.js)
 * only fires on create/update/delete events going forward. Items that existed
 * before the trigger was deployed never had their creates counted, so deletes
 * and archive transitions can drive itemCount negative — and the steady-state
 * is also under-counted by the size of the pre-trigger population.
 *
 * This script is the safety-net counterweight: walk the entire inventoryItems
 * collection, count non-archived items per category, and overwrite each
 * inventoryCategories.itemCount with the truth.
 *
 * Idempotent. Safe to run any time. The trigger keeps counts accurate
 * between runs; this exists for backfill + periodic reconciliation.
 *
 * Usage:
 *   node recompute-category-counts.js               # write changes
 *   node recompute-category-counts.js --dry-run     # report only, no writes
 *
 * Auth:
 *   Uses Application Default Credentials. Either:
 *     gcloud auth application-default login
 *   or set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON with
 *   datastore.user (read+write on Firestore) on project `dawinos`.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const PAGE = 500;

const dryRun = process.argv.includes('--dry-run');

function isCounted(data) {
  return data && data.category && data.status !== 'archived';
}

async function fetchAllItems() {
  const out = [];
  let last = null;
  while (true) {
    let q = db.collection('inventoryItems').orderBy('__name__').limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    out.push(...snap.docs);
    if (snap.docs.length < PAGE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return out;
}

async function main() {
  console.log(`recompute-category-counts — ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const [catSnap, itemDocs] = await Promise.all([
    db.collection('inventoryCategories').get(),
    fetchAllItems(),
  ]);

  const knownSlugs = new Set(catSnap.docs.map(d => d.id));
  const counts = new Map(); // slug -> count
  let archived = 0, missingCategory = 0, unknownCategory = 0;

  for (const doc of itemDocs) {
    const data = doc.data();
    if (!isCounted(data)) { archived++; continue; }
    if (!data.category) { missingCategory++; continue; }
    if (!knownSlugs.has(data.category)) {
      unknownCategory++;
      console.warn(`  item ${doc.id} points at unknown category "${data.category}"`);
      continue;
    }
    counts.set(data.category, (counts.get(data.category) || 0) + 1);
  }

  console.log(`\nScanned ${itemDocs.length} items: ${archived} archived (excluded), ${missingCategory} missing category, ${unknownCategory} unknown category.\n`);

  // Compare and stage updates
  const updates = [];
  console.log('| Category                 | Stored | Actual | Drift |');
  console.log('|--------------------------|--------|--------|-------|');
  for (const doc of catSnap.docs) {
    const stored = doc.data().itemCount ?? 0;
    const actual = counts.get(doc.id) || 0;
    const drift = stored - actual;
    const name = (doc.data().name || doc.id).padEnd(24);
    console.log(`| ${name} | ${String(stored).padStart(6)} | ${String(actual).padStart(6)} | ${String(drift).padStart(5)} |`);
    if (drift !== 0) {
      updates.push({ ref: doc.ref, slug: doc.id, oldValue: stored, newValue: actual });
    }
  }

  if (updates.length === 0) {
    console.log('\n✅ No drift detected. Nothing to write.');
    process.exit(0);
  }

  console.log(`\n${updates.length} categor${updates.length === 1 ? 'y' : 'ies'} will be updated.`);

  if (dryRun) {
    console.log('Dry run — exiting without writing.');
    process.exit(0);
  }

  // Batch the writes (max 500 per batch — we'll never hit that here).
  const batch = db.batch();
  for (const u of updates) {
    batch.update(u.ref, { itemCount: u.newValue });
  }
  await batch.commit();
  console.log(`\n✅ Updated ${updates.length} categories.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
