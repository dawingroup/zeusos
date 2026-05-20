/**
 * Correction script for PO-FIN-2026-0007
 *
 * Issues:
 *   1. PO currency was recorded as USD but is actually UGX
 *   2. UoM conversion (1 ea = 0.39 cbm) was not applied during receipt
 *   3. Cost was double-counted due to the weighted-average bug
 *
 * What it does:
 *   1. Corrects stock levels from 32 pcs → 12.48 cbm
 *   2. Recalculates cost per cbm in UGX
 *   3. Stamps audit fields on the receipt
 *   4. Fixes PO currency from USD → UGX
 *
 * Run: NODE_PATH=functions/node_modules node scripts/adjust-po-fin-2026-0007.cjs
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PO_NUMBER = 'PO-FIN-2026-0007';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

async function main() {
  console.log(`\n--- Correcting ${PO_NUMBER} ---\n`);

  const poSnap = await db.collection('purchaseOrders')
    .where('poNumber', '==', PO_NUMBER).limit(1).get();
  if (poSnap.empty) { console.error('PO not found'); process.exit(1); }

  const poDoc = poSnap.docs[0];
  const po = { id: poDoc.id, ...poDoc.data() };
  const li = po.lineItems[0];
  const receipt = po.receivingHistory[0];
  const line = receipt.lines[0];

  const inventoryItemId = line.inventoryItemId || li.inventoryItemId;
  const warehouseId = line.warehouseId;

  console.log(`  PO ID:          ${po.id}`);
  console.log(`  Line:           ${li.description}`);
  console.log(`  Inventory item: ${inventoryItemId}`);
  console.log(`  Warehouse:      ${warehouseId}`);

  // --- Correct values ---
  const UOM_CONVERSION = 0.39;       // 1 ea = 0.39 cbm
  const RAW_QTY_RECEIVED = line.quantityReceived; // 32 pcs
  const CORRECT_QTY = RAW_QTY_RECEIVED * UOM_CONVERSION; // 12.48 cbm
  const EFFECTIVE_COST_UGX = li.effectiveUnitCost ?? li.unitCost; // 102,812.5 UGX per piece
  const CORRECT_COST_PER_CBM = Math.round((EFFECTIVE_COST_UGX / UOM_CONVERSION) * 100) / 100;

  // What was recorded (no conversion applied)
  const OLD_QTY = line.baseUnitQuantityReceived ?? line.quantityReceived; // 32
  const OLD_COST = line.functionalCurrencyUnitCost ?? EFFECTIVE_COST_UGX;

  const QTY_DELTA = CORRECT_QTY - OLD_QTY;

  console.log(`\n  Old qty:        ${OLD_QTY} pcs`);
  console.log(`  Correct qty:    ${CORRECT_QTY} cbm (${RAW_QTY_RECEIVED} x ${UOM_CONVERSION})`);
  console.log(`  Qty delta:      ${QTY_DELTA}`);
  console.log(`  Old cost/unit:  ${OLD_COST}`);
  console.log(`  Correct cost:   ${CORRECT_COST_PER_CBM} UGX/cbm\n`);

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
      referenceId: po.id,
      notes: `Correction for ${PO_NUMBER}: UoM conversion 1 ea = ${UOM_CONVERSION} cbm applied. ${OLD_QTY} pcs -> ${CORRECT_QTY} cbm. Currency fixed USD -> UGX.`,
      performedBy: SYSTEM_USER,
      performedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Update inventory item aggregate inStock
    await db.collection('inventoryItems').doc(inventoryItemId).update({
      'inventory.inStock': FieldValue.increment(QTY_DELTA),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  [OK] Stock adjusted by ${QTY_DELTA} (${OLD_QTY} -> ${CORRECT_QTY})`);
  } else {
    console.log('  [WARN] Stock level not found');
  }

  // 2. Correct inventory item cost
  const itemSnap = await db.collection('inventoryItems').doc(inventoryItemId).get();
  if (itemSnap.exists) {
    const itemData = itemSnap.data();
    const currentCost = itemData?.pricing?.costPerUnit ?? 0;
    const currentQty = itemData?.inventory?.inStock ?? 0; // already adjusted above

    // Since this is the only receipt, set cost directly to correct value
    await db.collection('costHistory').add({
      inventoryItemId,
      previousCost: currentCost,
      newCost: CORRECT_COST_PER_CBM,
      currency: 'UGX',
      source: 'po_receipt',
      referenceId: po.id,
      poNumber: PO_NUMBER,
      notes: `CORRECTION: UoM conversion applied (1 ea = ${UOM_CONVERSION} cbm). Currency fixed USD -> UGX. Cost per cbm = ${EFFECTIVE_COST_UGX} / ${UOM_CONVERSION} = ${CORRECT_COST_PER_CBM} UGX`,
      recordedAt: FieldValue.serverTimestamp(),
      recordedBy: SYSTEM_USER,
    });

    await db.collection('inventoryItems').doc(inventoryItemId).update({
      'pricing.costPerUnit': CORRECT_COST_PER_CBM,
      'pricing.functionalCurrencyCost': CORRECT_COST_PER_CBM,
      'pricing.currency': 'UGX',
      'pricing.lastUpdatedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  [OK] Cost corrected: ${currentCost} -> ${CORRECT_COST_PER_CBM} UGX/cbm`);
  }

  // 3. Stamp audit fields on receipt
  const updatedHistory = po.receivingHistory.map((r) => ({
    ...r,
    lines: r.lines.map((l) => {
      if (l.lineItemId !== li.id) return l;
      return {
        ...l,
        baseUnitQuantityReceived: CORRECT_QTY,
        packagingMultiplier: UOM_CONVERSION,
        functionalCurrencyUnitCost: CORRECT_COST_PER_CBM,
        exchangeRateUsed: 1,
        sourceCurrency: 'UGX',
      };
    }),
  }));

  // 4. Fix PO currency and update receipt audit
  await db.collection('purchaseOrders').doc(po.id).update({
    receivingHistory: updatedHistory,
    'totals.currency': 'UGX',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: SYSTEM_USER,
  });

  console.log('  [OK] PO receipt audit fields updated');
  console.log('  [OK] PO currency fixed: USD -> UGX');

  console.log('\n--- Done ---\n');
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
