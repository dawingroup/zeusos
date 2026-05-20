/**
 * Follow-up correction for PO-FIN-2026-0004
 * Fixes Domino D5 x 30 pack size: 780 -> 1800 pcs/pack
 *
 * Run: NODE_PATH=functions/node_modules node scripts/adjust-po-fin-2026-0004-d5fix.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PO_ID = 'AALf2xOC5mDo8LWnQGL3';
const PO_NUMBER = 'PO-FIN-2026-0004';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

// Previous (wrong) values applied by first script
const OLD_MULTIPLIER = 780;
const OLD_QTY = 780;           // 1 pack x 780
const OLD_COST_UGX = 814.91;   // 138.18 / 780 * 4600

// Correct values
const CORRECT_MULTIPLIER = 1800;
const CORRECT_QTY = 1800;      // 1 pack x 1800
const UNIT_COST_GBP = 138.18;
const EXCHANGE_RATE = 4600;
const CORRECT_COST_UGX = Math.round((UNIT_COST_GBP / CORRECT_MULTIPLIER) * EXCHANGE_RATE * 100) / 100;
// = 138.18 / 1800 * 4600 = 353.13 UGX/pc

const QTY_DELTA = CORRECT_QTY - OLD_QTY; // +1020

async function main() {
  console.log(`\n--- Correcting Domino D5 x 30 pack size: ${OLD_MULTIPLIER} -> ${CORRECT_MULTIPLIER} pcs ---`);
  console.log(`  Qty delta: +${QTY_DELTA} (${OLD_QTY} -> ${CORRECT_QTY})`);
  console.log(`  Cost: ${OLD_COST_UGX} -> ${CORRECT_COST_UGX} UGX/pc\n`);

  // 1. Find the PO and identify the line item
  const poSnap = await db.collection('purchaseOrders').doc(PO_ID).get();
  if (!poSnap.exists) { console.error('PO not found'); process.exit(1); }

  const po = { id: PO_ID, ...poSnap.data() };
  const d5Line = po.lineItems.find((li) => li.description.includes('D5'));
  if (!d5Line) { console.error('D5 line item not found'); process.exit(1); }

  const inventoryItemId = d5Line.inventoryItemId;
  const receiptLine = po.receivingHistory[0]?.lines.find((l) => l.lineItemId === d5Line.id);
  const warehouseId = receiptLine?.warehouseId;

  if (!inventoryItemId || !warehouseId) {
    console.error('Missing inventoryItemId or warehouseId');
    process.exit(1);
  }

  console.log(`  Inventory item: ${inventoryItemId}`);
  console.log(`  Warehouse: ${warehouseId}\n`);

  // 2. Adjust stock level
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
      notes: `Correction for ${PO_NUMBER} D5x30: pack size ${OLD_MULTIPLIER} -> ${CORRECT_MULTIPLIER} pcs`,
      performedBy: SYSTEM_USER,
      performedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    await db.collection('inventoryItems').doc(inventoryItemId).update({
      'inventory.inStock': FieldValue.increment(QTY_DELTA),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  [OK] Stock adjusted by +${QTY_DELTA} units`);
  } else {
    console.log('  [WARN] Stock level not found');
  }

  // 3. Correct inventory item cost
  const itemSnap = await db.collection('inventoryItems').doc(inventoryItemId).get();
  if (itemSnap.exists) {
    const itemData = itemSnap.data();
    const currentCost = itemData?.pricing?.costPerUnit ?? 0;
    const currentQty = itemData?.inventory?.inStock ?? 0;

    // Reverse old contribution, apply correct
    const currentTotalValue = currentQty * currentCost;
    const correctedTotalValue =
      currentTotalValue -
      (OLD_QTY * OLD_COST_UGX) +
      (CORRECT_QTY * CORRECT_COST_UGX);

    const newCost = currentQty > 0
      ? Math.round((correctedTotalValue / currentQty) * 100) / 100
      : CORRECT_COST_UGX;

    await db.collection('costHistory').add({
      inventoryItemId,
      previousCost: currentCost,
      newCost,
      currency: 'UGX',
      source: 'po_receipt',
      referenceId: PO_ID,
      poNumber: PO_NUMBER,
      notes: `CORRECTION: D5x30 pack size ${OLD_MULTIPLIER} -> ${CORRECT_MULTIPLIER}. Reversed (${OLD_QTY}x${OLD_COST_UGX}) applied (${CORRECT_QTY}x${CORRECT_COST_UGX} UGX) [GBP -> UGX @ ${EXCHANGE_RATE}]`,
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

  // 4. Update PO receipt audit fields for D5 line
  const updatedHistory = po.receivingHistory.map((receipt) => ({
    ...receipt,
    lines: receipt.lines.map((line) => {
      if (line.lineItemId !== d5Line.id) return line;
      return {
        ...line,
        baseUnitQuantityReceived: CORRECT_QTY,
        packagingMultiplier: CORRECT_MULTIPLIER,
        functionalCurrencyUnitCost: CORRECT_COST_UGX,
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
