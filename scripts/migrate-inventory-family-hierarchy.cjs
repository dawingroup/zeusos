/**
 * Migrate Inventory to Family/SKU Hierarchy
 *
 * This script backfills new family/SKU hierarchy fields on existing
 * inventoryItems documents:
 *
 * 1. Items with isVariantParent=true → isFamily=true, isOrderable=false
 * 2. Items with parentItemId set → familyId=parentItemId
 * 3. Items with itemType='engineering-parent' → isFamily=true, isOrderable=false
 * 4. Items with itemType='purchasing-tier' → familyId=engineeringParentId
 * 5. All other items → isFamily=false, isOrderable=true, familyId=null
 *
 * Run: NODE_PATH=functions/node_modules node scripts/migrate-inventory-family-hierarchy.cjs
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

async function main() {
  console.log('\n=== Inventory Family/SKU Hierarchy Migration ===\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE (writing changes)'}\n`);

  // ============================================
  // Phase 1: Audit
  // ============================================
  console.log('--- Phase 1: Audit ---\n');

  const snapshot = await db.collection('inventoryItems').get();
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  console.log(`Total inventory items: ${items.length}`);

  const variantParents = items.filter((i) => i.isVariantParent === true);
  const variantChildren = items.filter((i) => !!i.parentItemId);
  const engineeringParents = items.filter((i) => i.itemType === 'engineering-parent');
  const purchasingTiers = items.filter((i) => i.itemType === 'purchasing-tier');
  const kits = items.filter((i) => i.itemType === 'kit');
  const flatItems = items.filter(
    (i) =>
      !i.isVariantParent &&
      !i.parentItemId &&
      i.itemType !== 'engineering-parent' &&
      i.itemType !== 'purchasing-tier',
  );

  // Items already migrated (have isFamily field set)
  const alreadyMigrated = items.filter((i) => i.isFamily !== undefined);

  console.log(`  Variant parents (isVariantParent=true): ${variantParents.length}`);
  console.log(`  Variant children (parentItemId set): ${variantChildren.length}`);
  console.log(`  Engineering parents: ${engineeringParents.length}`);
  console.log(`  Purchasing tiers: ${purchasingTiers.length}`);
  console.log(`  Kits: ${kits.length}`);
  console.log(`  Flat items (no hierarchy): ${flatItems.length}`);
  console.log(`  Already migrated (isFamily defined): ${alreadyMigrated.length}`);

  if (variantParents.length > 0) {
    console.log('\n  Variant parent items:');
    variantParents.forEach((p) => {
      console.log(`    - ${p.name} (${p.sku}) → ${(p.variantIds || []).length} variants`);
    });
  }

  if (engineeringParents.length > 0) {
    console.log('\n  Engineering parent items:');
    engineeringParents.forEach((p) => {
      console.log(`    - ${p.name} (${p.sku}) → ${(p.purchasingTierIds || []).length} tiers`);
    });
  }

  // ============================================
  // Phase 2: Validate stock on parent items
  // ============================================
  console.log('\n--- Phase 2: Validate stock on parent items ---\n');

  const parentIds = [
    ...variantParents.map((p) => p.id),
    ...engineeringParents.map((p) => p.id),
  ];

  let stockWarnings = 0;
  for (const parentId of parentIds) {
    const stockSnap = await db
      .collection('stockLevels')
      .where('inventoryItemId', '==', parentId)
      .get();

    if (!stockSnap.empty) {
      const totalStock = stockSnap.docs.reduce(
        (sum, d) => sum + (d.data().quantityOnHand || 0),
        0,
      );
      if (totalStock > 0) {
        const item = items.find((i) => i.id === parentId);
        console.log(
          `  [WARNING] Parent item "${item?.name}" (${parentId}) has ${totalStock} stock on hand!`,
        );
        console.log(
          `    This stock should be on SKU/child items, not the parent.`,
        );
        stockWarnings++;
      }
    }
  }

  if (stockWarnings === 0) {
    console.log('  No parent items have stock on hand. [OK]');
  } else {
    console.log(`\n  ${stockWarnings} parent item(s) have stock — review before executing.`);
  }

  // ============================================
  // Phase 3: Apply updates
  // ============================================
  console.log('\n--- Phase 3: Apply updates ---\n');

  let updated = 0;
  let skipped = 0;
  const batch = db.batch();
  const MAX_BATCH_SIZE = 500;
  let batchCount = 0;

  for (const item of items) {
    // Skip if already migrated
    if (item.isFamily !== undefined) {
      skipped++;
      continue;
    }

    const ref = db.collection('inventoryItems').doc(item.id);
    const updates = {};

    if (item.isVariantParent === true || item.itemType === 'engineering-parent') {
      // Convert to family
      updates.isFamily = true;
      updates.isOrderable = false;
      updates.isBomSelectable = false;
      updates.familyId = null;
      updates.skuIds = item.variantIds || item.purchasingTierIds || [];

      if (item.isVariantParent && item.variantIds) {
        updates.variantAttributeDefinitions = [];
      }
    } else if (item.parentItemId || item.itemType === 'purchasing-tier') {
      // Convert to SKU child
      updates.isFamily = false;
      updates.isOrderable = true;
      updates.isBomSelectable = item.classification === 'material' ? true : false;
      updates.familyId = item.parentItemId || item.engineeringParentId || null;
    } else {
      // Flat item
      updates.isFamily = false;
      updates.isOrderable = item.itemType === 'kit' ? false : true;
      updates.isBomSelectable =
        item.classification === 'material' ||
        (item.itemType !== 'kit' && !item.classification)
          ? true
          : false;
      updates.familyId = null;
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    updates.updatedBy = 'MIGRATION_FAMILY_HIERARCHY';

    if (!DRY_RUN) {
      batch.update(ref, updates);
      batchCount++;

      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }

    updated++;

    if (updated <= 10 || item.isVariantParent || item.parentItemId) {
      const action = updates.isFamily ? 'FAMILY' : updates.familyId ? 'SKU_CHILD' : 'FLAT';
      console.log(`  [${action}] ${item.name} (${item.sku}) → isFamily=${updates.isFamily}, isOrderable=${updates.isOrderable}`);
    }
  }

  // Commit remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  // ============================================
  // Phase 4: Post-migration report
  // ============================================
  console.log('\n--- Post-Migration Report ---\n');
  console.log(`  Items updated: ${updated}`);
  console.log(`  Items skipped (already migrated): ${skipped}`);
  console.log(`  Stock warnings: ${stockWarnings}`);

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
