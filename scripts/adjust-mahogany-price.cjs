/**
 * Mahogany Price Correction Script
 *
 * Corrects the price per CBM for Mahogany inventory item(s) to UGX 2,700,000.
 * Also updates any product variant costs and stock transaction records that
 * used the old incorrect price.
 *
 * What it does:
 *   1. Finds Mahogany inventory item(s) by name search
 *   2. Updates pricing.costPerUnit to 2,700,000 UGX
 *   3. Records the change in costHistory
 *   4. Finds associated product variants and corrects averageCost / lastPurchaseCost
 *   5. Corrects unitCost and totalCost on stock transactions that used the old price
 *
 * Run:  node scripts/adjust-mahogany-price.js
 *   (from project root — uses firebase-admin from functions/node_modules)
 *
 * DRY RUN: Set DRY_RUN=true below to preview changes without writing.
 */

const admin = require('firebase-admin');

// Initialize using Application Default Credentials (gcloud auth)
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Configuration ────────────────────────────────
const CORRECT_PRICE_PER_CBM = 2700000; // UGX
const SEARCH_TERM = 'mahogany';        // case-insensitive search in item name
const SYSTEM_USER = 'SYSTEM_PRICE_CORRECTION';
const DRY_RUN = false;                 // Set to true to preview only

// Collections
const INVENTORY_ITEMS = 'inventoryItems';
const STOCK_LEVELS = 'stockLevels';
const COST_HISTORY = 'costHistory';
const PRODUCT_VARIANTS = 'productVariants';
const MOVEMENTS = 'movements';

// ── Helpers ──────────────────────────────────────

function log(msg) {
  console.log(DRY_RUN ? `[DRY RUN] ${msg}` : msg);
}

// ── Main ─────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Mahogany Price Correction — Target: UGX ${CORRECT_PRICE_PER_CBM.toLocaleString()}/CBM`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // ── Step 1: Find Mahogany inventory items ──
  console.log('Step 1: Searching for Mahogany inventory items...\n');

  const allItemsSnap = await db.collection(INVENTORY_ITEMS).get();
  const mahoganyItems = [];

  allItemsSnap.forEach((doc) => {
    const data = doc.data();
    const name = (data.name || '').toLowerCase();
    if (name.includes(SEARCH_TERM)) {
      mahoganyItems.push({ id: doc.id, ...data });
    }
  });

  if (mahoganyItems.length === 0) {
    console.log(`  No inventory items found matching "${SEARCH_TERM}".`);
    console.log('  Checking product variants instead...\n');
  } else {
    console.log(`  Found ${mahoganyItems.length} inventory item(s):\n`);
    for (const item of mahoganyItems) {
      const currentCost = item.pricing?.costPerUnit ?? 0;
      const unit = item.pricing?.unit || item.unit || 'unknown';
      const currency = item.pricing?.currency || 'UGX';
      const inStock = item.inventory?.inStock ?? 0;

      console.log(`  • ${item.name} (${item.id})`);
      console.log(`    Current price: ${currency} ${currentCost.toLocaleString()} / ${unit}`);
      console.log(`    In stock: ${inStock} ${unit}`);
      console.log(`    Category: ${item.category || '-'}`);

      if (Math.abs(currentCost - CORRECT_PRICE_PER_CBM) < 1) {
        console.log(`    ✓ Already at correct price — skipping\n`);
        continue;
      }

      console.log(`    → Will change to: UGX ${CORRECT_PRICE_PER_CBM.toLocaleString()} / ${unit}\n`);

      if (!DRY_RUN) {
        // Update inventory item pricing
        await db.collection(INVENTORY_ITEMS).doc(item.id).update({
          'pricing.costPerUnit': CORRECT_PRICE_PER_CBM,
          'pricing.functionalCurrencyCost': CORRECT_PRICE_PER_CBM,
          'pricing.lastUpdatedAt': FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Record cost change
        await db.collection(COST_HISTORY).add({
          inventoryItemId: item.id,
          previousCost: currentCost,
          newCost: CORRECT_PRICE_PER_CBM,
          currency: 'UGX',
          source: 'manual_adjustment',
          notes: `Price correction: Mahogany ${unit} price updated from ${currentCost.toLocaleString()} to ${CORRECT_PRICE_PER_CBM.toLocaleString()} UGX`,
          recordedAt: FieldValue.serverTimestamp(),
          recordedBy: SYSTEM_USER,
        });

        // Add to price history array
        await db.collection(INVENTORY_ITEMS).doc(item.id).update({
          'pricing.priceHistory': FieldValue.arrayUnion({
            costPerUnit: CORRECT_PRICE_PER_CBM,
            currency: 'UGX',
            recordedAt: admin.firestore.Timestamp.now(),
            source: 'manual-update',
          }),
        });

        log(`    ✓ Inventory item price updated`);
        log(`    ✓ Cost history recorded`);
      }

      // ── Step 2: Correct stock level movements (if they have cost) ──
      console.log(`\n  Checking stock movements for ${item.name}...`);
      const stockSnap = await db.collection(STOCK_LEVELS)
        .where('inventoryItemId', '==', item.id)
        .get();

      if (!stockSnap.empty) {
        for (const stockDoc of stockSnap.docs) {
          const movementsSnap = await stockDoc.ref.collection(MOVEMENTS).get();
          let movementFixCount = 0;

          for (const mvDoc of movementsSnap.docs) {
            const mv = mvDoc.data();
            // Stock movements in this system don't have unitCost, but check just in case
            if (mv.unitCost && Math.abs(mv.unitCost - CORRECT_PRICE_PER_CBM) > 1) {
              const oldCost = mv.unitCost;
              const newTotal = mv.quantity * CORRECT_PRICE_PER_CBM;

              if (!DRY_RUN) {
                await mvDoc.ref.update({
                  unitCost: CORRECT_PRICE_PER_CBM,
                  totalCost: newTotal,
                });
              }
              log(`    Movement ${mvDoc.id}: unitCost ${oldCost.toLocaleString()} → ${CORRECT_PRICE_PER_CBM.toLocaleString()}`);
              movementFixCount++;
            }
          }
          if (movementFixCount === 0) {
            console.log(`    Stock level ${stockDoc.id}: no cost-bearing movements to fix`);
          } else {
            log(`    ✓ Fixed ${movementFixCount} movement(s) in stock level ${stockDoc.id}`);
          }
        }
      } else {
        console.log(`    No stock levels found for this item`);
      }
    }
  }

  // ── Step 3: Find and fix product variants ──
  console.log('\nStep 3: Searching for Mahogany product variants...\n');

  const allVariantsSnap = await db.collection(PRODUCT_VARIANTS).get();
  const mahoganyVariants = [];

  allVariantsSnap.forEach((doc) => {
    const data = doc.data();
    const name = (data.productName || data.displayName || '').toLowerCase();
    if (name.includes(SEARCH_TERM)) {
      mahoganyVariants.push({ id: doc.id, ...data });
    }
  });

  if (mahoganyVariants.length === 0) {
    console.log(`  No product variants found matching "${SEARCH_TERM}".\n`);
  } else {
    console.log(`  Found ${mahoganyVariants.length} product variant(s):\n`);

    for (const variant of mahoganyVariants) {
      const currentAvgCost = variant.averageCost ?? 0;
      const currentLastCost = variant.lastPurchaseCost ?? 0;
      const uom = variant.unitOfMeasure || 'unknown';

      console.log(`  • ${variant.displayName || variant.productName} (${variant.id})`);
      console.log(`    SKU: ${variant.sku || '-'}`);
      console.log(`    Average cost: UGX ${currentAvgCost.toLocaleString()}`);
      console.log(`    Last purchase cost: UGX ${currentLastCost.toLocaleString()}`);
      console.log(`    On hand: ${variant.quantityOnHand ?? 0} ${uom}`);

      const needsCostUpdate =
        Math.abs(currentAvgCost - CORRECT_PRICE_PER_CBM) > 1 ||
        Math.abs(currentLastCost - CORRECT_PRICE_PER_CBM) > 1;

      if (!needsCostUpdate) {
        console.log(`    ✓ Already at correct cost — checking transactions only\n`);
      } else {
        console.log(`    → Will update costs to: UGX ${CORRECT_PRICE_PER_CBM.toLocaleString()}\n`);

        if (!DRY_RUN) {
          await db.collection(PRODUCT_VARIANTS).doc(variant.id).update({
            averageCost: CORRECT_PRICE_PER_CBM,
            lastPurchaseCost: CORRECT_PRICE_PER_CBM,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: SYSTEM_USER,
          });
          log(`    ✓ Variant costs updated`);
        }
      }

      // Fix stock transactions
      console.log(`    Checking stock transactions...`);
      const txSnap = await db
        .collection(PRODUCT_VARIANTS)
        .doc(variant.id)
        .collection('stockTransactions')
        .get();

      let txFixCount = 0;
      for (const txDoc of txSnap.docs) {
        const tx = txDoc.data();
        if (tx.unitCost && Math.abs(tx.unitCost - CORRECT_PRICE_PER_CBM) > 1) {
          const oldUnitCost = tx.unitCost;
          const oldTotalCost = tx.totalCost ?? 0;
          const qty = Math.abs(tx.quantity || 0);
          const newTotalCost = qty * CORRECT_PRICE_PER_CBM;

          log(`      TX ${txDoc.id} (${tx.type}): unitCost ${oldUnitCost.toLocaleString()} → ${CORRECT_PRICE_PER_CBM.toLocaleString()}, totalCost ${oldTotalCost.toLocaleString()} → ${newTotalCost.toLocaleString()}`);

          if (!DRY_RUN) {
            await txDoc.ref.update({
              unitCost: CORRECT_PRICE_PER_CBM,
              totalCost: newTotalCost,
            });
          }
          txFixCount++;
        }
      }

      if (txFixCount === 0) {
        console.log(`      No transactions needed fixing`);
      } else {
        log(`    ✓ Fixed ${txFixCount} stock transaction(s)`);
      }
      console.log();
    }
  }

  console.log(`${'='.repeat(60)}`);
  console.log(`  ${DRY_RUN ? 'DRY RUN complete — no changes written' : 'All corrections applied successfully!'}`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
