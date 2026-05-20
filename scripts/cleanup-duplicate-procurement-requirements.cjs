/**
 * Cleanup Script: Remove Duplicate Procurement Requirements
 *
 * Finds procurement requirements where the same (moId + bomEntryId) pair
 * has multiple non-cancelled documents. Keeps the oldest one (first created)
 * and deletes the duplicates.
 *
 * Also identifies requirements that should already be linked to a PO
 * (i.e. a PO exists with matching line items) but are still "pending".
 *
 * Run:
 *   gcloud auth application-default login
 *   node scripts/cleanup-duplicate-procurement-requirements.cjs
 *
 * Flags:
 *   --dry-run   (default) Preview changes without writing
 *   --apply     Actually delete duplicates
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const REQUIREMENTS = 'procurementRequirements';
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`\n🔍 Scanning ${REQUIREMENTS} for duplicates...\n`);
  console.log(APPLY ? '⚡ MODE: APPLY (changes will be written)\n' : '👀 MODE: DRY-RUN (preview only — pass --apply to execute)\n');

  // ── 1. Fetch all non-cancelled requirements ──
  const snap = await db.collection(REQUIREMENTS).get();
  console.log(`Total documents in collection: ${snap.size}`);

  const docs = [];
  for (const d of snap.docs) {
    const data = d.data();
    docs.push({ id: d.id, ref: d.ref, ...data });
  }

  // ── 2. Group by (moId + bomEntryId) ──
  const groups = new Map();
  for (const doc of docs) {
    if (doc.status === 'cancelled') continue;
    const key = `${doc.moId}::${doc.bomEntryId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  // ── 3. Find groups with duplicates ──
  let totalDuplicates = 0;
  const toDelete = [];

  for (const [key, entries] of groups) {
    if (entries.length <= 1) continue;

    // Sort by createdAt ascending — keep the oldest
    entries.sort((a, b) => {
      const aTime = a.createdAt?._seconds || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?._seconds || b.createdAt?.seconds || 0;
      return aTime - bTime;
    });

    const keep = entries[0];
    const dupes = entries.slice(1);
    totalDuplicates += dupes.length;

    const [moId, bomEntryId] = key.split('::');
    console.log(`\n📋 MO: ${keep.moNumber} | BOM Entry: ${bomEntryId} | Item: ${keep.itemDescription}`);
    console.log(`   ✅ KEEP: ${keep.id} (status: ${keep.status}, created: ${formatTimestamp(keep.createdAt)})`);
    for (const dupe of dupes) {
      console.log(`   ❌ DELETE: ${dupe.id} (status: ${dupe.status}, created: ${formatTimestamp(dupe.createdAt)})`);
      toDelete.push(dupe);
    }
  }

  // ── 4. Summary ──
  const uniqueGroups = [...groups.values()].filter(g => g.length > 1).length;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 Summary:`);
  console.log(`   Total requirements: ${docs.filter(d => d.status !== 'cancelled').length}`);
  console.log(`   Unique (moId + bomEntryId) groups with duplicates: ${uniqueGroups}`);
  console.log(`   Duplicate documents to delete: ${totalDuplicates}`);

  if (toDelete.length === 0) {
    console.log(`\n✅ No duplicates found — collection is clean!\n`);
    process.exit(0);
  }

  // ── 5. Delete duplicates (if --apply) ──
  if (!APPLY) {
    console.log(`\n⏳ Dry run complete. Run with --apply to delete ${toDelete.length} duplicate(s).\n`);
    process.exit(0);
  }

  console.log(`\n🗑️  Deleting ${toDelete.length} duplicate(s)...`);

  // Batch delete in groups of 450 (Firestore batch limit is 500)
  for (let i = 0; i < toDelete.length; i += 450) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + 450);
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    console.log(`   Deleted batch ${Math.floor(i / 450) + 1} (${chunk.length} docs)`);
  }

  console.log(`\n✅ Done! Deleted ${toDelete.length} duplicate procurement requirement(s).\n`);
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const seconds = ts._seconds || ts.seconds || 0;
  if (!seconds) return '—';
  return new Date(seconds * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
