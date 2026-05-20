/**
 * Follow-up correction for PO-FIN-2026-0004
 * Fixes Domino D8 x 40 pack size: 1800 -> 780 pcs/pack
 *
 * Run: NODE_PATH=functions/node_modules node scripts/adjust-po-fin-2026-0004-d8fix.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PO_ID = 'AALf2xOC5mDo8LWnQGL3';
const PO_NUMBER = 'PO-FIN-2026-0004';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

// Previous (wrong) values applied by main script
const OLD_MULTIPLIER = 1800;
const OLD_QTY = 1800;           // 1 pack x 1800
const OLD_COST_UGX = 352.9;     // from main script output

// Correct values
const CORRECT_MULTIPLIER = 780;
const CORRECT_QTY = 780;        // 1 pack x 780
const UNIT_COST_GBP = 138.18;   // same line cost as D5 line (check PO)
const EXCHANGE_RATE = 4600;
const CORRECT_COST_UGX = Math.round((UNIT_COST_GBP / CORRECT_MULTIPLIER) * EXCHANGE_RATE * 100) / 100;

const QTY_DELTA = CORRECT_QTY - OLD_QTY; // -1020

async function main() {
  // First read the PO to get the actual D8 line cost
  const poSnap = await db.collection('purchaseOrders').doc(PO_ID).get();
  if (!poSnap.exists) { console.error('PO not found'); process.exit(1); }

  const po = { id: PO_ID, ...poSnap.data() };
  const d8Line = po.lineItems.find((li) => li.description.includes('D8'));
  if (!d8Line) { console.error('D8 line item not found'); process.exit(1); }

  // Use the actual PO line cost for D8
  const effectiveCost = d8Line.effectiveUnitCost ?? d8Line.unitCost;
  const actualCostUGX = Math.round((effectiveCost / CORRECT_MULTIPLIER) * EXCHANGE_RATE * 100) / 100;

  console.log(`\n--- Correcting Domino D8 x 40 pack size: ${OLD_MULTIPLIER} -> ${CORRECT_MULTIPLIER} pcs ---`);
  console.log(`  D8 line unit cost (GBP): ${effectiveCost}`);
  console.log(`  Qty delta: ${QTY_DELTA} (${OLD_QTY} -> ${CORRECT_QTY})`);
  console.log(`  Cost: ${OLD_COST_UGX} -> ${actualCostUGX} UGX/pc\n`);

  const inventoryItemId = d8Line.inventoryItemId;
  const receiptLine = po.receivingHistory[0]?.lines.find((l) => l.lineItemId === d8Line.id);
  const warehouseId = receiptLine?.warehouseId;

  if (!inventoryItemId || !warehouseId) {
    console.error('Missing inventoryItemId or warehouseId');
    process.exit(1);
  }

  console.log(`  Inventory item: ${inventoryItemId}`);
  console.log(`  Warehouse: ${warehouseId}\n`);

  // 1. Adjust stock level
  const stockSnap = await db.collection('stockLevels')
    .where('inventoryItemId', '==', inventoryItemId)
    .where('warehouseId', '==', warehouseId)
    .limit(1).get();

  if (!stockSnap.empty) {
    const stockId = stockSnap.docs[0].id;
    const batch = db.batch();

    batch.update(db.collection('stockLevels').doc(stockId), {
      quantityOnHand: FieldValue.increment(QTY_DELTA),
      quantityAvailable: FieldValue.increment(QTY_DELTA),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const movRef = db.collection('stockLevels').doc(stockId).collection('movements').doc();
    batch.set(movRef, {
      type: 'adjustment',
      quantity: QTY_DELTA,
      referenceType: 'po',
      referenceId: PO_ID,
      notes: `Correction for ${PO_NUMBER} D8x40: pack size ${OLD_MULTIPLIER} -> ${CORRECT_MULTIPLIER} pcs`,
      performedBy: SYSTEM_USER,
      performedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    await db.collection('inventoryItems').doc(inventoryItemId).update({
      'inventory.inStock': FieldValue.increment(QTY_DELTA),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  [OK] Stock adjusted by ${QTY_DELTA} units`);
  } else {
    console.log('  [WARN] Stock level not found');
  }

  // 2. Correct inventory item cost
  const itemSnap = await db.collection('inventoryItems').doc(inventoryItemId).get();
  if (itemSnap.exists) {
    const itemData = itemSnap.data();
    const currentCost = itemData?.pricing?.costPerUnit ?? 0;
    const currentQty = itemData?.inventory?.inStock ?? 0;

    const currentTotalValue = currentQty * currentCost;
    const correctedTotalValue =
      currentTotalValue -
      (OLD_QTY * OLD_COST_UGX) +
      (CORRECT_QTY * actualCostUGX);

    const newCost = currentQty > 0
      ? Math.round((correctedTotalValue / currentQty) * 100) / 100
      : actualCostUGX;

    await db.collection('costHistory').add({
      inventoryItemId,
      previousCost: currentCost,
      newCost,
      currency: 'UGX',
      source: 'po_receipt',
      referenceId: PO_ID,
      poNumber: PO_NUMBER,
      notes: `CORRECTION: D8x40 pack size ${OLD_MULTIPLIER} -> ${CORRECT_MULTIPLIER}. Reversed (${OLD_QTY}x${OLD_COST_UGX}) applied (${CORRECT_QTY}x${actualCostUGX} UGX) [GBP -> UGX @ ${EXCHANGE_RATE}]`,
      recordedAt: FieldValue.serverTimestamp(),
      recordedBy: SYSTEM_USER,
    });

    await db.collection('inventoryItems').doc(inventoryItemId).update({
      'pricing.costPerUnit': newCost,
      'pricing.functionalCurrencyCost': newCost,
      'pricing.exchangeRate': EXCHANGE_RATE,
      'pricing.lastUpdatedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  [OK] Cost corrected: ${currentCost} -> ${newCost} UGX/unit`);
  }

  // 3. Update PO receipt audit fields for D8 line
  const updatedHistory = po.receivingHistory.map((receipt) => ({
    ...receipt,
    lines: receipt.lines.map((line) => {
      if (line.lineItemId !== d8Line.id) return line;
      return {
        ...line,
        baseUnitQuantityReceived: CORRECT_QTY,
        packagingMultiplier: CORRECT_MULTIPLIER,
        functionalCurrencyUnitCost: actualCostUGX,
        exchangeRateUsed: EXCHANGE_RATE,
        sourceCurrency: 'GBP',
      };
    }),
  }));

  await db.collection('purchaseOrders').doc(PO_ID).update({
    receivingHistory: updatedHistory,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: SYSTEM_USER,
  });

  console.log('  [OK] PO receipt audit fields updated');
  console.log('\n--- Done ---\n');
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
