/**
 * Clean Procurement Parts Script
 *
 * One-off cleanup for DesignItem.parts on a project. Audits + optionally
 * deletes procurement-namespace rows (everything whose `source` isn't
 * 'design-studio'). Scene-origin rows are NEVER touched — the
 * namespace-enforced sync owns those.
 *
 * Typical use: DF-2026-694 has ~365 untagged legacy rows that got
 * migrated to the procurement namespace as the safe default. This
 * script drains them so procurement's count matches reality.
 *
 * Run:
 *   gcloud auth application-default login
 *   # Dry run first — always safe
 *   node scripts/clean-procurement-parts.cjs --project=DF-2026-694
 *   # Drain only untagged legacy rows
 *   node scripts/clean-procurement-parts.cjs --project=DF-2026-694 --source=untagged --apply
 *   # Drain a specific source (polyboard, csv-import, manual, etc.)
 *   node scripts/clean-procurement-parts.cjs --project=DF-2026-694 --source=polyboard --apply
 *   # Drain everything except scene-origin
 *   node scripts/clean-procurement-parts.cjs --project=DF-2026-694 --source=all-procurement --apply
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const args = process.argv.slice(2);
function arg(name, def) {
  const m = args.find(a => a.startsWith(`--${name}=`));
  return m ? m.split('=')[1] : def;
}
const PROJECT_CODE = arg('project');
const SOURCE_FILTER = arg('source', null);  // 'untagged' | 'polyboard' | 'csv-import' | 'manual' | 'sketchup' | 'all-procurement'
const APPLY = args.includes('--apply');

if (!PROJECT_CODE) {
  console.error('❌ --project=<code> required (e.g. --project=DF-2026-694)');
  process.exit(1);
}

function bucketFor(part) {
  const src = part.source;
  if (src === 'design-studio') return '__scene-origin__';  // never drain
  if (!src) return 'untagged';
  return src;
}

function matchesFilter(bucket) {
  if (bucket === '__scene-origin__') return false;  // invariant: never touched
  if (!SOURCE_FILTER) return false;                 // no filter → dry-run report only
  if (SOURCE_FILTER === 'all-procurement') return true;
  return bucket === SOURCE_FILTER;
}

async function main() {
  console.log(`\n🔍 Scanning project ${PROJECT_CODE}\n`);
  console.log(APPLY ? '⚡ MODE: APPLY' : '👀 MODE: DRY-RUN (add --apply to execute)');
  if (SOURCE_FILTER) {
    console.log(`   filter: source === '${SOURCE_FILTER}'`);
  } else {
    console.log('   filter: (none — audit only, no deletion)');
  }
  console.log('');

  // 1. Find the project by code.
  const projSnap = await db.collection('designProjects').where('code', '==', PROJECT_CODE).limit(1).get();
  if (projSnap.empty) {
    console.error(`❌ No project found with code "${PROJECT_CODE}"`);
    process.exit(1);
  }
  const project = projSnap.docs[0];
  console.log(`✓ Found project ${project.id} — "${project.data().name || '(unnamed)'}"\n`);

  // 2. Enumerate DesignItems.
  const itemsSnap = await db.collection('designProjects').doc(project.id).collection('designItems').get();
  console.log(`Found ${itemsSnap.size} DesignItem(s)\n`);

  let totalDeleted = 0;
  let totalItemsChanged = 0;
  const globalBuckets = new Map();

  for (const itemDoc of itemsSnap.docs) {
    const data = itemDoc.data();
    const parts = data.parts || [];
    const partsVersion = typeof data.partsVersion === 'number' ? data.partsVersion : 0;
    if (parts.length === 0) continue;

    // Tally by bucket for this item.
    const itemBuckets = new Map();
    for (const p of parts) {
      const b = bucketFor(p);
      itemBuckets.set(b, (itemBuckets.get(b) || 0) + 1);
      globalBuckets.set(b, (globalBuckets.get(b) || 0) + 1);
    }

    // Does this item have anything to drain?
    let wouldDelete = 0;
    for (const [b, n] of itemBuckets) {
      if (matchesFilter(b)) wouldDelete += n;
    }

    const summary = Array.from(itemBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([b, n]) => `${n} ${b === '__scene-origin__' ? 'design-studio' : b}`)
      .join(' · ');

    console.log(`  ${itemDoc.id.slice(0, 8)}… ${data.name || '(unnamed)'}  [${parts.length} parts · ${summary}]`);

    if (wouldDelete > 0) {
      console.log(`    → would delete ${wouldDelete} matching row(s)`);
      totalItemsChanged++;
    }

    if (APPLY && wouldDelete > 0) {
      const kept = parts.filter(p => !matchesFilter(bucketFor(p)));
      await db.collection('designProjects').doc(project.id).collection('designItems').doc(itemDoc.id).update({
        parts: kept,
        partsVersion: partsVersion + 1,
        partsLastSyncedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'cleanup-script',
      });
      totalDeleted += wouldDelete;
      console.log(`    ✓ deleted, item now has ${kept.length} rows (partsVersion: ${partsVersion + 1})`);
    }
  }

  // 3. Summary
  console.log(`\n─── Summary ─────────────────────────────────────\n`);
  console.log(`Project:   ${PROJECT_CODE}`);
  console.log(`DesignItems scanned:  ${itemsSnap.size}`);
  console.log(`DesignItems affected: ${totalItemsChanged}`);
  console.log('');
  console.log('Global row count by source:');
  for (const [b, n] of Array.from(globalBuckets.entries()).sort((a, b) => b[1] - a[1])) {
    const label = b === '__scene-origin__' ? 'design-studio (scene-origin, SAFE)' : b;
    console.log(`  ${String(n).padStart(6)} ${label}`);
  }
  console.log('');

  if (APPLY) {
    console.log(`✓ Applied — ${totalDeleted} row(s) deleted across ${totalItemsChanged} item(s).`);
    console.log(`Don't forget to regenerate the consolidated cutlist in DM.`);
  } else {
    if (!SOURCE_FILTER) {
      console.log('⬆ Audit complete. To drain a bucket:');
      console.log(`   node scripts/clean-procurement-parts.cjs --project=${PROJECT_CODE} --source=<bucket-name> --apply`);
      console.log('   (e.g. --source=untagged, --source=polyboard, --source=all-procurement)');
    } else {
      console.log(`⬆ Dry-run complete. Re-run with --apply to delete.`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
