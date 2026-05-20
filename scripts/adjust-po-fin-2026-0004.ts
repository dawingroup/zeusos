/**
 * Adjustment Script for PO-FIN-2026-0004
 *
 * Corrects stock levels and inventory costs that were recorded before
 * the packaging-unit-conversion and currency-translation fixes.
 *
 * What it does:
 *   1. Fetches PO-FIN-2026-0004 from Firestore
 *   2. For each goods receipt line that touched inventory:
 *      a. Calculates what SHOULD have been recorded (base-unit qty, UGX cost)
 *      b. Determines what WAS recorded (raw qty, raw foreign-currency cost)
 *      c. Applies a correction adjustment to stock levels and inventory item costs
 *   3. Stamps the PO's receivingHistory with the correct audit fields
 *
 * Run:  node scripts/adjust-po-fin-2026-0004.ts
 *   (from project root — uses firebase-admin from functions/node_modules)
 */

const admin = require('firebase-admin');

// Initialize using Application Default Credentials (gcloud auth)
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Constants ────────────────────────────────────
const PO_NUMBER = 'PO-FIN-2026-0004';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';
const PURCHASE_ORDERS = 'purchaseOrders';
const INVENTORY_ITEMS = 'inventoryItems';
const STOCK_LEVELS = 'stockLevels';
const COST_HISTORY = 'costHistory';
const MOVEMENTS = 'movements';

// Exchange rates (mirrors currency.constants.ts)
const EXCHANGE_RATES_TO_UGX = {
  UGX: 1,
  USD: 3700,
  EUR: 4000,
  GBP: 4600,
  AED: 1000,
  CNY: 510,
  KES: 29,
  ZAR: 205,
};

// ── Helpers ──────────────────────────────────────

function resolveCategory(li) {
  if (li.category) return li.category;
  return 'inventory';
}

async function findSupplierPackaging(inventoryItemId, supplierId) {
  const itemSnap = await db.collection(INVENTORY_ITEMS).doc(inventoryItemId).get();
  if (!itemSnap.exists) return null;

  const data = itemSnap.data();
  const lists = [data?.supplierPricing, data?.vendorSources];

  for (const list of lists) {
    if (!Array.isArray(list) || list.length === 0) continue;

    if (supplierId) {
      const match = list.find((s) => s.supplierId === supplierId);
      if (match?.packagingQty && match.packagingQty > 0) return match;
    }

    const preferred = list.find((s) => s.isPreferred);
    if (preferred?.packagingQty && preferred.packagingQty > 0) return preferred;

    const first = list.find((s) => s.packagingQty && s.packagingQty > 0);
    if (first) return first;
  }

  return null;
}

async function getStockLevelDoc(inventoryItemId, warehouseId) {
  const snap = await db
    .collection(STOCK_LEVELS)
    .where('inventoryItemId', '==', inventoryItemId)
    .where('warehouseId', '==', warehouseId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { id: snap.docs[0].id, data: snap.docs[0].data() };
}

// ── Main ─────────────────────────────────────────

async function main() {
  console.log(`\n--- Fetching PO ${PO_NUMBER} ---\n`);

  // Find the PO by poNumber
  const poSnap = await db
    .collection(PURCHASE_ORDERS)
    .where('poNumber', '==', PO_NUMBER)
    .limit(1)
    .get();

  if (poSnap.empty) {
    console.error(`PO ${PO_NUMBER} not found in Firestore.`);
    process.exit(1);
  }

  const poDoc = poSnap.docs[0];
  const po = { id: poDoc.id, ...poDoc.data() };
  const poCurrency = po.totals?.currency || 'UGX';

  console.log(`  PO ID:       ${po.id}`);
  console.log(`  Status:      ${po.status}`);
  console.log(`  Currency:    ${poCurrency}`);
  console.log(`  Line items:  ${po.lineItems?.length ?? 0}`);
  console.log(`  Receipts:    ${po.receivingHistory?.length ?? 0}`);
  console.log();

  if (!po.receivingHistory || po.receivingHistory.length === 0) {
    console.log('No receipts to adjust.');
    process.exit(0);
  }

  // Build adjustment actions
  const actions = [];

  for (const receipt of po.receivingHistory) {
    console.log(`Receipt ${receipt.id}:`);

    for (const line of receipt.lines) {
      const poLine = po.lineItems.find((li) => li.id === line.lineItemId);
      if (!poLine) {
        console.log(`   Line ${line.lineItemId} - PO line not found, skipping`);
        continue;
      }

      const cat = resolveCategory(poLine);
      if (cat !== 'inventory') {
        console.log(`   ${poLine.description} - category=${cat}, skipping`);
        continue;
      }

      const inventoryItemId = line.inventoryItemId || poLine.inventoryItemId;
      if (!inventoryItemId) {
        console.log(`   ${poLine.description} - no inventory item linked, skipping`);
        continue;
      }

      if (!line.warehouseId) {
        console.log(`   ${poLine.description} - no warehouse, skipping`);
        continue;
      }

      // ── Determine CORRECT values ──
      let packagingMultiplier = poLine.packagingQty ?? 0;
      if (packagingMultiplier <= 0) {
        const supplierPkg = await findSupplierPackaging(inventoryItemId, po.supplierId);
        if (supplierPkg) {
          packagingMultiplier = supplierPkg.packagingQty;
        }
      }
      if (packagingMultiplier <= 0) packagingMultiplier = 1;

      const correctQty = line.quantityReceived * packagingMultiplier;

      // Currency conversion
      const effectiveCost = poLine.effectiveUnitCost ?? poLine.unitCost;
      const baseUnitCostInSource = effectiveCost / packagingMultiplier;
      const sourceCurrency = poLine.currency || poCurrency;

      let correctCostPerUnit;
      let exchangeRateUsed;

      if (sourceCurrency === 'UGX') {
        correctCostPerUnit = baseUnitCostInSource;
        exchangeRateUsed = 1;
      } else {
        const explicitRate = poLine.exchangeRateToUGX ?? po.exchangeRateOverride;
        if (explicitRate && explicitRate > 0) {
          correctCostPerUnit = Math.round(baseUnitCostInSource * explicitRate * 100) / 100;
          exchangeRateUsed = explicitRate;
        } else {
          exchangeRateUsed = EXCHANGE_RATES_TO_UGX[sourceCurrency] ?? 1;
          correctCostPerUnit = Math.round(baseUnitCostInSource * exchangeRateUsed * 100) / 100;
        }
      }

      // ── Determine what WAS recorded ──
      // Before the fix: receiveStock got raw quantityReceived (no packaging)
      // and updateInventoryItemCostFromReceipt got raw foreign cost (no FX)
      const oldQty = line.baseUnitQuantityReceived ?? line.quantityReceived;
      const oldCostPerUnit = line.functionalCurrencyUnitCost ?? effectiveCost;

      // If audit fields are present and match, no adjustment needed
      if (oldQty === correctQty && Math.abs(oldCostPerUnit - correctCostPerUnit) < 0.01) {
        console.log(`   [OK] ${poLine.description} - already correct (${correctQty} units @ ${correctCostPerUnit} UGX)`);
        continue;
      }

      const qtyDelta = correctQty - oldQty;

      console.log(`   [FIX] ${poLine.description}:`);
      console.log(`      Qty:  ${oldQty} -> ${correctQty} (delta: ${qtyDelta > 0 ? '+' : ''}${qtyDelta})`);
      console.log(`      Cost: ${oldCostPerUnit} -> ${correctCostPerUnit} UGX/unit`);
      if (packagingMultiplier > 1) {
        console.log(`      Packaging: ${line.quantityReceived} ${poLine.unit} x ${packagingMultiplier} = ${correctQty} ${poLine.baseUnit ?? 'pcs'}`);
      }
      if (sourceCurrency !== 'UGX') {
        console.log(`      FX: ${sourceCurrency} -> UGX @ ${exchangeRateUsed}`);
      }

      actions.push({
        inventoryItemId,
        warehouseId: line.warehouseId,
        lineDescription: poLine.description,
        lineItemId: line.lineItemId,
        oldQty,
        correctQty,
        qtyDelta,
        oldCostPerUnit,
        correctCostPerUnit,
        sourceCurrency,
        exchangeRateUsed,
        packagingMultiplier,
      });
    }
  }

  console.log(`\n--- Summary: ${actions.length} adjustment(s) needed ---\n`);

  if (actions.length === 0) {
    console.log('All receipt entries are already correct. No adjustments needed.');
    process.exit(0);
  }

  // ── Apply adjustments ──
  console.log('Applying adjustments...\n');

  for (const action of actions) {
    console.log(`  > ${action.lineDescription}:`);

    // 1. Adjust stock level quantity
    if (action.qtyDelta !== 0) {
      const stockLevel = await getStockLevelDoc(action.inventoryItemId, action.warehouseId);
      if (stockLevel) {
        const batch = db.batch();

        // Update stock level quantities
        const stockRef = db.collection(STOCK_LEVELS).doc(stockLevel.id);
        batch.update(stockRef, {
          quantityOnHand: FieldValue.increment(action.qtyDelta),
          quantityAvailable: FieldValue.increment(action.qtyDelta),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Record adjustment movement
        const movementRef = stockRef.collection(MOVEMENTS).doc();
        batch.set(movementRef, {
          type: 'adjustment',
          quantity: action.qtyDelta,
          referenceType: 'po',
          referenceId: po.id,
          notes: `Correction for ${PO_NUMBER}: packaging conversion ${action.oldQty} -> ${action.correctQty} (x${action.packagingMultiplier})`,
          performedBy: SYSTEM_USER,
          performedAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        // Update inventory item aggregate inStock
        await db.collection(INVENTORY_ITEMS).doc(action.inventoryItemId).update({
          'inventory.inStock': FieldValue.increment(action.qtyDelta),
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`    [OK] Stock adjusted by ${action.qtyDelta > 0 ? '+' : ''}${action.qtyDelta} units`);
      } else {
        console.log(`    [WARN] Stock level not found for warehouse ${action.warehouseId}`);
      }
    }

    // 2. Correct inventory item cost (recalculate weighted average)
    const itemSnap = await db.collection(INVENTORY_ITEMS).doc(action.inventoryItemId).get();

    if (itemSnap.exists) {
      const itemData = itemSnap.data();
      const currentCost = itemData?.pricing?.costPerUnit ?? 0;
      const currentQty = itemData?.inventory?.inStock ?? 0;

      // Reverse old weighted-average contribution and apply correct one
      // Current total value = currentQty * currentCost
      // Remove old contribution: - (oldQty * oldCostPerUnit)
      // Add correct contribution: + (correctQty * correctCostPerUnit)
      const currentTotalValue = currentQty * currentCost;
      const correctedTotalValue =
        currentTotalValue -
        (action.oldQty * action.oldCostPerUnit) +
        (action.correctQty * action.correctCostPerUnit);

      const newCost = currentQty > 0
        ? Math.round((correctedTotalValue / currentQty) * 100) / 100
        : action.correctCostPerUnit;

      // Record cost change in history
      await db.collection(COST_HISTORY).add({
        inventoryItemId: action.inventoryItemId,
        previousCost: currentCost,
        newCost,
        currency: 'UGX',
        source: 'po_receipt',
        referenceId: po.id,
        poNumber: PO_NUMBER,
        notes: `CORRECTION: Reversed old cost (${action.oldQty}x${action.oldCostPerUnit}) and applied correct (${action.correctQty}x${action.correctCostPerUnit} UGX) [${action.sourceCurrency} -> UGX @ ${action.exchangeRateUsed}]`,
        recordedAt: FieldValue.serverTimestamp(),
        recordedBy: SYSTEM_USER,
      });

      // Update the item pricing
      await db.collection(INVENTORY_ITEMS).doc(action.inventoryItemId).update({
        'pricing.costPerUnit': newCost,
        'pricing.functionalCurrencyCost': newCost,
        'pricing.exchangeRate': action.exchangeRateUsed,
        'pricing.lastUpdatedAt': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`    [OK] Cost corrected: ${currentCost} -> ${newCost} UGX/unit`);
    } else {
      console.log(`    [WARN] Inventory item ${action.inventoryItemId} not found`);
    }
  }

  // 3. Stamp the PO's receivingHistory with correct audit fields
  console.log('\nUpdating PO receipt audit fields...');

  const updatedHistory = po.receivingHistory.map((receipt) => ({
    ...receipt,
    lines: receipt.lines.map((line) => {
      const poLine = po.lineItems.find((li) => li.id === line.lineItemId);
      if (!poLine) return line;

      const cat = resolveCategory(poLine);
      if (cat !== 'inventory') return line;

      const action = actions.find((a) => a.lineItemId === line.lineItemId);
      if (!action) return line;

      return {
        ...line,
        baseUnitQuantityReceived: action.correctQty,
        packagingMultiplier: action.packagingMultiplier,
        functionalCurrencyUnitCost: action.correctCostPerUnit,
        exchangeRateUsed: action.exchangeRateUsed,
        sourceCurrency: action.sourceCurrency,
      };
    }),
  }));

  await db.collection(PURCHASE_ORDERS).doc(po.id).update({
    receivingHistory: updatedHistory,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: SYSTEM_USER,
  });

  console.log('  [OK] PO receipt history updated with audit fields');

  console.log('\n--- All adjustments applied successfully! ---\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
