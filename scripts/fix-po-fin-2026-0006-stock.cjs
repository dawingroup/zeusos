/**
 * Fix PO-FIN-2026-0006 — Create stockLevels docs and receipt movements
 *
 * The 7 inventory items were created by fix-po-fin-2026-0006-inventory.cjs
 * but no stockLevels documents or movements subcollection entries were written.
 * This script back-fills both so the stock register matches the PO receipt.
 *
 * Schema (from inspection of existing stockLevels docs):
 *
 *   stockLevels/{id}
 *     inventoryItemId  string
 *     warehouseId      string
 *     sku              string
 *     itemName         string
 *     quantityOnHand   number
 *     quantityAvailable number
 *     quantityReserved  number
 *     lastReceivedAt   Timestamp
 *     updatedAt        Timestamp
 *
 *   stockLevels/{id}/movements/{movId}
 *     type           'receipt'
 *     quantity       number
 *     referenceType  'po'
 *     referenceId    string   (PO Firestore doc ID)
 *     notes          string
 *     performedBy    string
 *     performedAt    Timestamp
 *
 * Run: NODE_PATH=functions/node_modules node scripts/fix-po-fin-2026-0006-stock.cjs
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db        = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp  = admin.firestore.Timestamp;

const PO_NUMBER   = 'PO-FIN-2026-0006';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

async function main() {
  console.log('\n=== Creating stockLevels + movements for ' + PO_NUMBER + ' ===\n');

  // 1. Fetch the PO
  const poSnap = await db.collection('purchaseOrders')
    .where('poNumber', '==', PO_NUMBER).limit(1).get();

  if (poSnap.empty) {
    console.error('PO not found'); process.exit(1);
  }

  const poDocId = poSnap.docs[0].id;
  const po      = poSnap.docs[0].data();

  console.log('PO doc ID : ' + poDocId);
  console.log('Supplier  : ' + po.supplierName);
  console.log('Line items: ' + po.lineItems.length);

  // Pull receipt metadata from receivingHistory[0]
  const receipt    = (po.receivingHistory || [])[0];
  const warehouseId  = (receipt && receipt.lines[0] && receipt.lines[0].warehouseId) || '4RBC4sz0zVjP6CiXnCvd';
  const receivedBy   = (receipt && receipt.receivedBy) || SYSTEM_USER;
  const receivedAt   = receipt && receipt.receivedAt
    ? (receipt.receivedAt._seconds
        ? Timestamp.fromMillis(receipt.receivedAt._seconds * 1000)
        : Timestamp.fromDate(receipt.receivedAt.toDate()))
    : Timestamp.now();

  // Build a map from lineItemId → quantityReceived from receiving history
  const receiptQtyMap = {};
  if (receipt && receipt.lines) {
    for (const line of receipt.lines) {
      receiptQtyMap[line.lineItemId] = line.quantityReceived;
    }
  }

  console.log('Warehouse : ' + warehouseId);
  console.log('Received by: ' + receivedBy);
  console.log('Received at: ' + new Date(receivedAt.toMillis()).toISOString() + '\n');

  let created  = 0;
  let skipped  = 0;

  for (const li of po.lineItems) {
    if (!li.inventoryItemId) {
      console.log('[SKIP] ' + li.description.substring(0, 60) + ' — no inventoryItemId, run inventory script first');
      skipped++;
      continue;
    }

    const qtyReceived = receiptQtyMap[li.id] || li.quantityReceived || li.quantity;

    console.log('--- ' + li.sku + ' | ' + li.description.substring(0, 55));
    console.log('    inventoryItemId: ' + li.inventoryItemId);
    console.log('    qty received   : ' + qtyReceived);

    // 2a. Check if a stockLevels doc already exists for this item + warehouse
    const existingSnap = await db.collection('stockLevels')
      .where('inventoryItemId', '==', li.inventoryItemId)
      .where('warehouseId', '==', warehouseId)
      .limit(1).get();

    let stockLevelRef;

    if (!existingSnap.empty) {
      // Update the existing doc
      stockLevelRef = existingSnap.docs[0].ref;
      console.log('    [UPDATE] existing stockLevels/' + existingSnap.docs[0].id);

      await stockLevelRef.update({
        quantityOnHand:   FieldValue.increment(qtyReceived),
        quantityAvailable: FieldValue.increment(qtyReceived),
        lastReceivedAt:   receivedAt,
        updatedAt:        FieldValue.serverTimestamp(),
      });
    } else {
      // Create a new stockLevels doc
      const newLevel = {
        inventoryItemId:   li.inventoryItemId,
        warehouseId,
        sku:               li.sku,
        itemName:          li.description,
        quantityOnHand:    qtyReceived,
        quantityAvailable: qtyReceived,
        quantityReserved:  0,
        lastReceivedAt:    receivedAt,
        updatedAt:         FieldValue.serverTimestamp(),
      };

      stockLevelRef = await db.collection('stockLevels').add(newLevel);
      console.log('    [CREATED] stockLevels/' + stockLevelRef.id);
    }

    // 2b. Write the receipt movement into the subcollection
    // Check if a movement for this PO already exists to avoid duplicates
    const existingMovSnap = await stockLevelRef.collection('movements')
      .where('referenceId', '==', poDocId)
      .where('type', '==', 'receipt')
      .limit(1).get();

    if (!existingMovSnap.empty) {
      console.log('    [SKIP MOVEMENT] receipt movement already exists');
    } else {
      const movRef = await stockLevelRef.collection('movements').add({
        type:          'receipt',
        quantity:      qtyReceived,
        referenceType: 'po',
        referenceId:   poDocId,
        notes:         'From PO ' + PO_NUMBER,
        performedBy:   receivedBy,
        performedAt:   receivedAt,
      });
      console.log('    [MOVEMENT] movements/' + movRef.id + ' (receipt, qty ' + qtyReceived + ')');
    }

    created++;
    console.log();
  }

  console.log('=== Summary ===');
  console.log('  stockLevels created/updated: ' + created);
  console.log('  Skipped (no inventoryItemId): ' + skipped);
  console.log('\nDone.\n');
}

main().catch(err => { console.error('\nFATAL:', err.message || err); process.exit(1); });
