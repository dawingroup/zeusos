/**
 * Backfill PO line/receipt conversion metadata from linked inventory item UoM.
 *
 * Adds (when missing):
 * - lineItems[].baseUnit
 * - lineItems[].packagingUnit
 * - lineItems[].packagingQty
 * - lineItems[].packagingMultiplier
 * - lineItems[].derivedUnitCost
 * - receivingHistory[].lines[].packagingMultiplier
 * - receivingHistory[].lines[].baseUnitQuantityReceived
 *
 * Usage:
 *   node scripts/backfill-po-uom-conversion-fields.cjs
 */

const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'dawinos' });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const SYSTEM_USER = 'SYSTEM_PO_UOM_BACKFILL';

function round(value, precision = 6) {
  const p = 10 ** precision;
  return Math.round(value * p) / p;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateWithRetry(docRef, payload, maxRetries = 4) {
  let attempt = 0;
  let delayMs = 1000;

  while (attempt <= maxRetries) {
    try {
      await docRef.update(payload);
      return;
    } catch (err) {
      const code = err?.code;
      const details = String(err?.details || err?.message || '');
      const isRetryable =
        code === 4 ||
        code === 10 ||
        code === 14 ||
        details.includes('DEADLINE_EXCEEDED') ||
        details.includes('UNAVAILABLE');

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      await sleep(delayMs);
      delayMs *= 2;
      attempt += 1;
    }
  }
}

async function main() {
  console.log('============================================================');
  console.log(' PO UoM Conversion Backfill');
  console.log(' Project: dawinos');
  console.log('============================================================\n');

  const poSnap = await db.collection('purchaseOrders').get();
  console.log(`Found ${poSnap.size} purchase order(s)\n`);

  const inventoryCache = new Map();
  let scanned = 0;
  let updated = 0;
  let updatedLines = 0;
  let updatedReceipts = 0;

  for (const poDoc of poSnap.docs) {
    scanned++;
    const po = poDoc.data();
    const originalLineItems = Array.isArray(po.lineItems) ? po.lineItems : [];
    const originalReceivingHistory = Array.isArray(po.receivingHistory) ? po.receivingHistory : [];

    let changed = false;
    let poUpdatedLines = 0;
    let poUpdatedReceipts = 0;

    const lineItems = await Promise.all(
      originalLineItems.map(async (line) => {
        if (!line?.inventoryItemId) return line;

        let item = inventoryCache.get(line.inventoryItemId);
        if (!inventoryCache.has(line.inventoryItemId)) {
          const itemSnap = await db.collection('inventoryItems').doc(line.inventoryItemId).get();
          item = itemSnap.exists ? itemSnap.data() : null;
          inventoryCache.set(line.inventoryItemId, item);
        }
        if (!item) return line;

        const stockUnit = item.stockUom || item.pricing?.unit || line.baseUnit || line.unit || 'pcs';
        const purchaseUnit = item.purchaseUom || line.packagingUnit || line.unit || stockUnit;
        const multiplier =
          purchaseUnit !== stockUnit && (item.uomConversion || 0) > 0
            ? Number(item.uomConversion)
            : (line.packagingQty || line.packagingMultiplier || 1);

        const safeMultiplier = multiplier > 0 ? multiplier : 1;
        const derivedUnitCost =
          line.derivedUnitCost && line.derivedUnitCost > 0
            ? line.derivedUnitCost
            : round((line.unitCost || 0) / safeMultiplier);

        const next = { ...line };
        let lineChanged = false;

        if (!next.baseUnit) {
          next.baseUnit = stockUnit;
          lineChanged = true;
        }
        if (!next.packagingUnit) {
          next.packagingUnit = purchaseUnit;
          lineChanged = true;
        }
        if (!next.packagingQty || next.packagingQty <= 0) {
          next.packagingQty = safeMultiplier;
          lineChanged = true;
        }
        if (!next.packagingMultiplier || next.packagingMultiplier <= 0) {
          next.packagingMultiplier = safeMultiplier;
          lineChanged = true;
        }
        if (!next.derivedUnitCost || next.derivedUnitCost <= 0) {
          next.derivedUnitCost = derivedUnitCost;
          lineChanged = true;
        }

        if (lineChanged) {
          changed = true;
          poUpdatedLines++;
        }

        return next;
      }),
    );

    const multiplierByLineId = new Map();
    for (const line of lineItems) {
      multiplierByLineId.set(line.id, line.packagingMultiplier || line.packagingQty || 1);
    }

    const receivingHistory = originalReceivingHistory.map((receipt) => {
      if (!Array.isArray(receipt?.lines)) return receipt;

      const nextLines = receipt.lines.map((line) => {
        const multiplier = multiplierByLineId.get(line.lineItemId) || 1;
        const nextLine = { ...line };
        let receiptLineChanged = false;

        if (!nextLine.packagingMultiplier || nextLine.packagingMultiplier <= 0) {
          nextLine.packagingMultiplier = multiplier;
          receiptLineChanged = true;
        }
        if (
          nextLine.baseUnitQuantityReceived === undefined ||
          nextLine.baseUnitQuantityReceived === null
        ) {
          nextLine.baseUnitQuantityReceived = round((nextLine.quantityReceived || 0) * multiplier);
          receiptLineChanged = true;
        }

        if (receiptLineChanged) {
          changed = true;
          poUpdatedReceipts++;
        }
        return nextLine;
      });

      return { ...receipt, lines: nextLines };
    });

    if (!changed) continue;

    await updateWithRetry(poDoc.ref, {
      lineItems,
      receivingHistory,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: SYSTEM_USER,
    });

    updated++;
    updatedLines += poUpdatedLines;
    updatedReceipts += poUpdatedReceipts;

    console.log(
      `UPDATED ${po.poNumber || poDoc.id} | lines: ${poUpdatedLines} | receipt lines: ${poUpdatedReceipts}`,
    );
  }

  console.log('\n============================================================');
  console.log(`Scanned POs:            ${scanned}`);
  console.log(`Updated POs:            ${updated}`);
  console.log(`Updated line items:     ${updatedLines}`);
  console.log(`Updated receipt lines:  ${updatedReceipts}`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('PO UoM conversion backfill failed:', err);
  process.exit(1);
});

