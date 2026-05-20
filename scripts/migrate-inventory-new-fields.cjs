/**
 * Migrate Inventory: Add tier rename, restockable, linkedProjectIds fields
 *
 * This script updates all inventoryItems documents:
 *
 * 1. Change tier from 'global' to 'catalogue' (leave 'project' items unchanged)
 * 2. Set restockable: true (default for all existing items)
 * 3. Set linkedProjectIds: [] if not already present
 * 4. Set updatedAt to server timestamp
 * 5. Set updatedBy to 'migration-tier-restockable'
 * 6. Does NOT change status — all remain as-is
 *
 * Run: NODE_PATH=functions/node_modules node scripts/migrate-inventory-new-fields.cjs --dry-run
 *
 * Options:
 *   --dry-run   Preview changes without writing (default)
 *   --execute   Actually write changes to Firestore
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_SIZE = 500;

async function main() {
  console.log('\n=== Inventory New Fields Migration (tier, restockable, linkedProjectIds) ===\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE (writing changes)'}\n`);

  // ============================================
  // Phase 1: Audit
  // ============================================
  console.log('--- Phase 1: Audit ---\n');

  const snapshot = await db.collection('inventoryItems').get();
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  console.log(`Total inventory items: ${items.length}`);

  // Count by current tier value
  const tierCounts = {};
  items.forEach((item) => {
    const tier = item.tier || '(undefined)';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  });

  console.log('\n  Current tier distribution:');
  Object.entries(tierCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([tier, count]) => {
      console.log(`    ${tier}: ${count}`);
    });

  // Count items that already have restockable field
  const hasRestockable = items.filter((i) => i.restockable !== undefined).length;
  const hasLinkedProjectIds = items.filter((i) => i.linkedProjectIds !== undefined).length;

  console.log(`\n  Already have restockable field: ${hasRestockable}`);
  console.log(`  Already have linkedProjectIds field: ${hasLinkedProjectIds}`);

  // Determine what will change
  const tierRenameCount = items.filter((i) => i.tier === 'global').length;
  const tierUnchangedCount = items.filter((i) => i.tier === 'project').length;
  const needsRestockable = items.filter((i) => i.restockable === undefined).length;
  const needsLinkedProjectIds = items.filter((i) => i.linkedProjectIds === undefined).length;

  console.log('\n  Planned changes:');
  console.log(`    tier 'global' -> 'catalogue': ${tierRenameCount}`);
  console.log(`    tier 'project' (unchanged): ${tierUnchangedCount}`);
  console.log(`    restockable to set: ${needsRestockable}`);
  console.log(`    linkedProjectIds to set: ${needsLinkedProjectIds}`);

  // ============================================
  // Phase 2: Migrate
  // ============================================
  console.log('\n--- Phase 2: Migrate ---\n');

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const item of items) {
    const ref = db.collection('inventoryItems').doc(item.id);
    const updates = {};

    // Tier rename: global -> catalogue, leave project unchanged
    if (item.tier === 'global') {
      updates.tier = 'catalogue';
    }
    // If tier is something else or undefined, we don't change it

    // Set restockable: true for all existing items
    updates.restockable = true;

    // Set linkedProjectIds only if not already present
    if (item.linkedProjectIds === undefined) {
      updates.linkedProjectIds = [];
    }

    // Metadata
    updates.updatedAt = FieldValue.serverTimestamp();
    updates.updatedBy = 'migration-tier-restockable';

    if (!DRY_RUN) {
      batch.update(ref, updates);
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} updates`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    updated++;

    // Log first 10 items and any tier renames for visibility
    if (updated <= 10 || item.tier === 'global') {
      const tierChange = item.tier === 'global' ? 'global->catalogue' : `${item.tier || '(undefined)'} (unchanged)`;
      console.log(`  [UPDATE] ${item.name || item.id} (${item.sku || 'no-sku'}) tier=${tierChange}, restockable=true`);
    }
  }

  // Commit remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} updates`);
  }

  if (updated > 10) {
    console.log(`  ... and ${updated - 10} more items`);
  }

  // ============================================
  // Phase 3: Verify
  // ============================================
  console.log('\n--- Phase 3: Verify ---\n');

  if (DRY_RUN) {
    console.log('  [SKIPPED] Verification skipped in dry-run mode.\n');
  } else {
    const verifySnapshot = await db.collection('inventoryItems').get();
    const verifyItems = verifySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    const postTierCounts = {};
    verifyItems.forEach((item) => {
      const tier = item.tier || '(undefined)';
      postTierCounts[tier] = (postTierCounts[tier] || 0) + 1;
    });

    console.log('  Post-migration tier distribution:');
    Object.entries(postTierCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([tier, count]) => {
        console.log(`    ${tier}: ${count}`);
      });

    const postHasRestockable = verifyItems.filter((i) => i.restockable !== undefined).length;
    const postHasLinkedProjectIds = verifyItems.filter((i) => i.linkedProjectIds !== undefined).length;
    const postHasUpdatedBy = verifyItems.filter((i) => i.updatedBy === 'migration-tier-restockable').length;

    console.log(`\n  Items with restockable field: ${postHasRestockable} / ${verifyItems.length}`);
    console.log(`  Items with linkedProjectIds field: ${postHasLinkedProjectIds} / ${verifyItems.length}`);
    console.log(`  Items with updatedBy='migration-tier-restockable': ${postHasUpdatedBy} / ${verifyItems.length}`);

    // Check no 'global' tier remains
    const remainingGlobal = verifyItems.filter((i) => i.tier === 'global').length;
    if (remainingGlobal > 0) {
      console.log(`\n  [WARNING] ${remainingGlobal} items still have tier='global'!`);
    } else {
      console.log(`\n  [OK] No items with tier='global' remain.`);
    }
  }

  // ============================================
  // Summary
  // ============================================
  console.log('\n--- Summary ---\n');
  console.log(`  Total items processed: ${updated}`);
  console.log(`  Tier renames (global -> catalogue): ${tierRenameCount}`);
  console.log(`  Tier unchanged (project): ${tierUnchangedCount}`);
  console.log(`  restockable set to true: ${updated}`);
  console.log(`  linkedProjectIds initialized: ${needsLinkedProjectIds}`);

  if (DRY_RUN) {
    console.log(
      '\n  [DRY RUN] No changes were written. Run with --execute to apply.\n',
    );
  } else {
    console.log('\n  [DONE] Migration completed successfully.\n');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
