/**
 * Migration: Set partType on all untyped parts in Firestore design items.
 *
 * Bar parts imported from the Polyboard timber/section CSV already have
 * partType:'bar' and barProfile set correctly. But parts imported before the
 * partType field was added have partType === undefined. This script sets
 * partType:'sheet' on all untyped parts so they appear correctly in the
 * cutlist sheet section, estimation engine, and nesting studio.
 *
 * Usage (dry run — prints changes without writing):
 *   node migrate-bar-parts.js
 *
 * Usage (apply changes):
 *   node migrate-bar-parts.js --apply
 */

const admin = require('firebase-admin');

const DRY_RUN = !process.argv.includes('--apply');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY RUN — no changes will be written. Run with --apply to commit.\n'
    : '✏️  APPLY MODE — changes will be written to Firestore.\n'
  );

  let totalProjects = 0;
  let totalItems = 0;
  let totalPartsInspected = 0;
  let totalPartsFixed = 0;
  let totalItemsUpdated = 0;
  let totalBarPartsOk = 0;
  let totalSheetPartsOk = 0;

  const projectsSnap = await db.collection('designProjects').get();
  totalProjects = projectsSnap.size;
  console.log(`Found ${totalProjects} design project(s).\n`);

  let batch = db.batch();
  let batchCount = 0;

  for (const projectDoc of projectsSnap.docs) {
    const projectId = projectDoc.id;
    const projectName = projectDoc.data()?.name || projectDoc.data()?.projectCode || projectId;
    const itemsSnap = await db
      .collection('designProjects')
      .doc(projectId)
      .collection('designItems')
      .get();

    totalItems += itemsSnap.size;

    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data();
      const parts = data.parts || [];
      if (parts.length === 0) continue;
      totalPartsInspected += parts.length;

      let itemNeedsUpdate = false;
      let fixedInItem = 0;

      const updatedParts = parts.map(part => {
        // Already typed — leave as-is
        if (part.partType === 'bar') {
          totalBarPartsOk++;
          return part;
        }
        if (part.partType === 'sheet') {
          totalSheetPartsOk++;
          return part;
        }

        // Untyped → classify as sheet (bar parts were already typed on import)
        itemNeedsUpdate = true;
        totalPartsFixed++;
        fixedInItem++;

        return {
          ...part,
          partType: 'sheet',
        };
      });

      if (itemNeedsUpdate) {
        totalItemsUpdated++;
        console.log(`  📋 [${projectName}] / "${data.name || data.itemCode || itemDoc.id}" — ${fixedInItem} untyped → sheet`);

        if (!DRY_RUN) {
          batch.update(
            db.collection('designProjects').doc(projectId)
              .collection('designItems').doc(itemDoc.id),
            { parts: updatedParts, updatedAt: admin.firestore.FieldValue.serverTimestamp() }
          );
          batchCount++;

          // Firestore batches max out at 500 operations
          if (batchCount >= 490) {
            await batch.commit();
            console.log(`\n  ✅ Committed batch of ${batchCount} updates.`);
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`\n✅ Committed final batch of ${batchCount} updates.`);
  }

  console.log('\n── Summary ─────────────────────────────────────');
  console.log(`Projects scanned:       ${totalProjects}`);
  console.log(`Design items scanned:   ${totalItems}`);
  console.log(`Parts inspected:        ${totalPartsInspected}`);
  console.log(`  Already bar:          ${totalBarPartsOk} ✓`);
  console.log(`  Already sheet:        ${totalSheetPartsOk} ✓`);
  console.log(`  Untyped → sheet:      ${totalPartsFixed}`);
  console.log(`Items updated:          ${totalItemsUpdated}`);
  if (DRY_RUN && totalPartsFixed > 0) {
    console.log('\nRe-run with --apply to commit these changes.');
  } else if (!DRY_RUN) {
    console.log('\n✅ Migration complete.');
  } else {
    console.log('\nNothing to migrate — all parts already typed.');
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
