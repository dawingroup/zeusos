/**
 * Cleanup Script for PO-FIN-2026-0002
 *
 * Reverses all goods receipt entries for this PO:
 *   1. Fetches the PO and its receiving history
 *   2. For each receipt line that touched inventory:
 *      a. Decrements stockLevels quantityOnHand/quantityAvailable
 *      b. Records a reversal movement in stockLevels/{id}/movements
 *      c. Decrements inventoryItems/{id}.inventory.inStock
 *   3. Resets PO line items quantityReceived to 0
 *   4. Clears receivingHistory array
 *   5. Sets PO status back to 'sent' (or 'approved' if never sent)
 *
 * Run:  node scripts/clear-po-fin-2026-0002.cjs
 *   (from project root — uses firebase-admin)
 *
 * DRY RUN by default — set DRY_RUN=false to apply changes.
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Config ──────────────────────────────────────
const PO_NUMBER = 'PO-FIN-2026-0002';
const SYSTEM_USER = 'SYSTEM_CLEANUP';
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: true (safe)

const PURCHASE_ORDERS = 'purchaseOrders';
const INVENTORY_ITEMS = 'inventoryItems';
const STOCK_LEVELS = 'stockLevels';
const MOVEMENTS = 'movements';

// ── Helpers ──────────────────────────────────────

function log(msg) {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}${msg}`);
}

async function findPO() {
  // Try by poNumber field first
  const snap = await db.collection(PURCHASE_ORDERS)
    .where('poNumber', '==', PO_NUMBER)
    .limit(1)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // Try as document ID
  const directSnap = await db.collection(PURCHASE_ORDERS).doc(PO_NUMBER).get();
  if (directSnap.exists) {
    return { id: directSnap.id, ...directSnap.data() };
  }

  return null;
}

async function findStockLevel(inventoryItemId, warehouseId) {
  const snap = await db.collection(STOCK_LEVELS)
    .where('inventoryItemId', '==', inventoryItemId)
    .where('warehouseId', '==', warehouseId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── Main ─────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log(`PO Cleanup: ${PO_NUMBER}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE — changes will be applied!'}`);
  console.log('='.repeat(60));
  console.log();

  // 1. Fetch the PO
  const po = await findPO();
  if (!po) {
    console.error(`PO "${PO_NUMBER}" not found!`);
    process.exit(1);
  }

  log(`Found PO: ${po.poNumber} (id: ${po.id})`);
  log(`Status: ${po.status}`);
  log(`Line items: ${po.lineItems?.length ?? 0}`);
  log(`Receipts: ${po.receivingHistory?.length ?? 0}`);
  console.log();

  if (!po.receivingHistory || po.receivingHistory.length === 0) {
    log('No receiving history — nothing to reverse.');
    console.log();
    log('Resetting line item quantityReceived to 0...');
    if (!DRY_RUN) {
      const updatedLineItems = po.lineItems.map(li => ({
        ...li,
        quantityReceived: 0,
      }));
      await db.collection(PURCHASE_ORDERS).doc(po.id).update({
        lineItems: updatedLineItems,
        status: 'sent',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: SYSTEM_USER,
      });
    }
    log('Done.');
    return;
  }

  // 2. Collect all receipt lines to reverse
  const reversals = []; // { inventoryItemId, warehouseId, quantity, receiptId }

  for (const receipt of po.receivingHistory) {
    for (const line of receipt.lines || []) {
      if (!line.inventoryItemId || !line.quantityReceived) continue;
      reversals.push({
        inventoryItemId: line.inventoryItemId,
        warehouseId: line.warehouseId,
        quantity: line.quantityReceived,
        receiptId: receipt.id,
        lineItemId: line.lineItemId,
      });
    }
  }

  log(`Found ${reversals.length} receipt line(s) to reverse:`);
  for (const r of reversals) {
    log(`  - Item ${r.inventoryItemId} @ warehouse ${r.warehouseId}: -${r.quantity} (receipt: ${r.receiptId})`);
  }
  console.log();

  // 3. Reverse stock levels and inventory counts
  for (const r of reversals) {
    // 3a. Find the stock level document
    const stockLevel = await findStockLevel(r.inventoryItemId, r.warehouseId);

    if (stockLevel) {
      log(`Reversing stock level ${stockLevel.id}: quantityOnHand -${r.quantity}`);

      if (!DRY_RUN) {
        // Record reversal movement
        const movementRef = db.collection(STOCK_LEVELS).doc(stockLevel.id)
          .collection(MOVEMENTS).doc();
        await movementRef.set({
          type: 'adjustment',
          quantity: -r.quantity,
          referenceType: 'po',
          referenceId: po.id,
          notes: `Reversal of receipt ${r.receiptId} from ${po.poNumber} (cleanup script)`,
          performedBy: SYSTEM_USER,
          performedAt: FieldValue.serverTimestamp(),
        });

        // Decrement stock level
        await db.collection(STOCK_LEVELS).doc(stockLevel.id).update({
          quantityOnHand: FieldValue.increment(-r.quantity),
          quantityAvailable: FieldValue.increment(-r.quantity),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      log(`WARNING: No stock level found for item ${r.inventoryItemId} @ warehouse ${r.warehouseId}`);
    }

    // 3b. Decrement inventory item aggregate inStock
    log(`Decrementing inventoryItem ${r.inventoryItemId} inStock by ${r.quantity}`);
    if (!DRY_RUN) {
      await db.collection(INVENTORY_ITEMS).doc(r.inventoryItemId).update({
        'inventory.inStock': FieldValue.increment(-r.quantity),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
  console.log();

  // 4. Reset PO: clear receiving history, reset line item quantities, revert status
  log('Resetting PO line items (quantityReceived → 0)...');
  log('Clearing receivingHistory...');

  const resetStatus = ['sent', 'partially-received', 'received'].includes(po.status) ? 'sent' : po.status;
  log(`Setting status: ${po.status} → ${resetStatus}`);

  if (!DRY_RUN) {
    const updatedLineItems = po.lineItems.map(li => ({
      ...li,
      quantityReceived: 0,
    }));

    await db.collection(PURCHASE_ORDERS).doc(po.id).update({
      lineItems: updatedLineItems,
      receivingHistory: [],
      status: resetStatus,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: SYSTEM_USER,
    });
  }

  console.log();
  console.log('='.repeat(60));
  log('Cleanup complete!');
  if (DRY_RUN) {
    console.log();
    console.log('This was a DRY RUN. To apply changes, run:');
    console.log('  DRY_RUN=false node scripts/clear-po-fin-2026-0002.cjs');
  }
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
