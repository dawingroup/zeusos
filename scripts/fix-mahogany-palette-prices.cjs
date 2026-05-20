/**
 * Fix Mahogany Pricing Across All Sources
 *
 * The design manager estimating tool reads prices from multiple tiers:
 *   1. designProjects/{id}.materialPalette.entries[].unitCost / timberStock[].costPerCubicMeter
 *   2. inventoryItems/{id}.pricing.costPerUnit  (already correct at 2,700,000)
 *   3. materials collection
 *
 * This script:
 *   a. Adds a cost history correction record for the inventory item
 *   b. Updates all design project palette entries with "mahogany" to use 2,700,000/CBM
 *   c. Updates any materials collection entries
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const CORRECT_PRICE = 2700000;
const INVENTORY_ITEM_ID = 'hwowknYepe1vxD3uvEnX';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

async function main() {
  console.log('============================================================');
  console.log('  Mahogany Price Correction — All Sources');
  console.log('  Target: UGX 2,700,000 / CBM');
  console.log('============================================================\n');

  // ── Step 1: Cost history correction record ──
  console.log('Step 1: Adding cost history correction record...\n');

  await db.collection('costHistory').add({
    inventoryItemId: INVENTORY_ITEM_ID,
    previousCost: 263621.79,
    newCost: CORRECT_PRICE,
    currency: 'UGX',
    source: 'manual_adjustment',
    notes: 'Price correction: Mahogany unit cost corrected to UGX 2,700,000/CBM. Previous weighted-average calculations used incorrect base price.',
    recordedAt: FieldValue.serverTimestamp(),
    recordedBy: SYSTEM_USER,
  });

  // Also update the pricing.priceHistory on the item
  await db.collection('inventoryItems').doc(INVENTORY_ITEM_ID).update({
    'pricing.priceHistory': FieldValue.arrayUnion({
      costPerUnit: CORRECT_PRICE,
      currency: 'UGX',
      recordedAt: admin.firestore.Timestamp.now(),
      source: 'manual_adjustment',
      notes: 'Corrected to actual market rate UGX 2,700,000/CBM',
    }),
    'pricing.lastUpdatedAt': FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log('  ✓ Cost history record added');
  console.log('  ✓ Price history updated on inventory item\n');

  // ── Step 2: Fix design project palette entries ──
  console.log('Step 2: Updating design project material palettes...\n');

  const projSnap = await db.collection('designProjects').get();
  let projectsUpdated = 0;
  let entriesFixed = 0;

  for (const projDoc of projSnap.docs) {
    const data = projDoc.data();
    const entries = data.materialPalette?.entries;
    if (!Array.isArray(entries) || entries.length === 0) continue;

    let changed = false;
    const updatedEntries = entries.map((entry) => {
      const name = (entry.designName || entry.normalizedName || '').toLowerCase();

      // Match mahogany entries specifically (not other timber types)
      if (!name.includes('mahogany')) return entry;

      const currentUnitCost = entry.unitCost;
      const currentTimberCBM = entry.timberStock?.[0]?.costPerCubicMeter;

      // Skip if already correct
      if (
        (!currentUnitCost || Math.abs(currentUnitCost - CORRECT_PRICE) < 1) &&
        (!currentTimberCBM || Math.abs(currentTimberCBM - CORRECT_PRICE) < 1)
      ) {
        return entry;
      }

      changed = true;
      entriesFixed++;

      const updated = {
        ...entry,
        unitCost: CORRECT_PRICE,
      };

      // Update timberStock if present
      if (Array.isArray(entry.timberStock) && entry.timberStock.length > 0) {
        updated.timberStock = entry.timberStock.map((ts, i) =>
          i === 0 ? { ...ts, costPerCubicMeter: CORRECT_PRICE } : ts
        );
      }

      console.log(`  ❌→✅ Project: ${data.projectName || projDoc.id}`);
      console.log(`         Entry: ${entry.designName || entry.normalizedName}`);
      console.log(`         unitCost: ${currentUnitCost?.toLocaleString()} → ${CORRECT_PRICE.toLocaleString()}`);
      if (currentTimberCBM) {
        console.log(`         costPerCBM: ${currentTimberCBM.toLocaleString()} → ${CORRECT_PRICE.toLocaleString()}`);
      }

      return updated;
    });

    if (changed) {
      await db.collection('designProjects').doc(projDoc.id).update({
        'materialPalette.entries': updatedEntries,
        updatedAt: FieldValue.serverTimestamp(),
      });
      projectsUpdated++;
    }
  }

  console.log(`\n  ✓ Updated ${entriesFixed} palette entry/entries across ${projectsUpdated} project(s)\n`);

  // ── Step 3: Fix materials collection ──
  console.log('Step 3: Checking materials collection...\n');

  const matSnap = await db.collection('materials').get();
  let materialsFixed = 0;

  for (const matDoc of matSnap.docs) {
    const data = matDoc.data();
    const name = (data.name || data.materialName || '').toLowerCase();
    if (!name.includes('mahogany')) continue;

    const currentPrice = data.pricePerSqM || data.pricing?.unitCost;
    if (currentPrice && Math.abs(currentPrice - CORRECT_PRICE) > 1) {
      const updates = { updatedAt: FieldValue.serverTimestamp() };
      if (data.pricePerSqM) updates.pricePerSqM = CORRECT_PRICE;
      if (data.pricing?.unitCost) updates['pricing.unitCost'] = CORRECT_PRICE;

      await db.collection('materials').doc(matDoc.id).update(updates);
      console.log(`  ✅ ${data.name || data.materialName}: ${currentPrice.toLocaleString()} → ${CORRECT_PRICE.toLocaleString()}`);
      materialsFixed++;
    }
  }

  if (materialsFixed === 0) {
    console.log('  No mahogany entries found in materials collection\n');
  }

  console.log('============================================================');
  console.log('  All corrections applied!');
  console.log(`  • 1 cost history record added`);
  console.log(`  • ${entriesFixed} palette entries fixed across ${projectsUpdated} projects`);
  console.log(`  • ${materialsFixed} materials collection entries fixed`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
