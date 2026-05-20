/**
 * Diagnostic script for PO-FIN-2026-0007
 * Reads the PO and its receipt data, checks packaging conversions and costs.
 *
 * Run: NODE_PATH=functions/node_modules node scripts/diagnose-po-fin-2026-0007.cjs
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const PO_NUMBER = 'PO-FIN-2026-0007';

const EXCHANGE_RATES_TO_UGX = {
  UGX: 1, USD: 3700, EUR: 4000, GBP: 4600, AED: 1000, CNY: 510, KES: 29, ZAR: 205,
};

async function main() {
  console.log(`\n=== Diagnosing ${PO_NUMBER} ===\n`);

  const poSnap = await db.collection('purchaseOrders')
    .where('poNumber', '==', PO_NUMBER).limit(1).get();

  if (poSnap.empty) { console.error('PO not found'); process.exit(1); }

  const poDoc = poSnap.docs[0];
  const po = { id: poDoc.id, ...poDoc.data() };
  const poCurrency = po.totals?.currency || 'UGX';

  console.log(`PO ID:       ${po.id}`);
  console.log(`Status:      ${po.status}`);
  console.log(`Currency:    ${poCurrency}`);
  console.log(`Supplier:    ${po.supplierName || po.supplierId || 'N/A'}`);
  console.log(`Line items:  ${po.lineItems?.length ?? 0}`);
  console.log(`Receipts:    ${po.receivingHistory?.length ?? 0}`);
  if (po.exchangeRateOverride) console.log(`FX Override: ${po.exchangeRateOverride}`);
  console.log();

  // Show all line items
  console.log('--- LINE ITEMS ---\n');
  for (const li of (po.lineItems || [])) {
    const cat = li.category || 'inventory';
    console.log(`  [${li.id}] ${li.description}`);
    console.log(`    Category:        ${cat}`);
    console.log(`    Unit:            ${li.unit || 'N/A'}`);
    console.log(`    Base unit:       ${li.baseUnit || 'N/A'}`);
    console.log(`    Qty ordered:     ${li.quantity}`);
    console.log(`    Unit cost:       ${li.unitCost} ${li.currency || poCurrency}`);
    if (li.effectiveUnitCost && li.effectiveUnitCost !== li.unitCost) {
      console.log(`    Effective cost:  ${li.effectiveUnitCost}`);
    }
    console.log(`    Total cost:      ${li.totalCost}`);
    console.log(`    packagingQty:    ${li.packagingQty ?? 'NOT SET'}`);
    console.log(`    packagingUnit:   ${li.packagingUnit ?? 'NOT SET'}`);
    console.log(`    packagingMult:   ${li.packagingMultiplier ?? 'NOT SET'}`);
    if (li.exchangeRateToUGX) console.log(`    FX rate:         ${li.exchangeRateToUGX}`);
    console.log(`    Inventory item:  ${li.inventoryItemId || 'NOT LINKED'}`);
    if (li.assetId) console.log(`    Asset ID:        ${li.assetId}`);
    console.log();
  }

  // Show receipts
  if (!po.receivingHistory?.length) {
    console.log('No receipts.\n');
    process.exit(0);
  }

  console.log('--- RECEIPTS ---\n');
  for (const receipt of po.receivingHistory) {
    console.log(`Receipt ${receipt.id} (${receipt.receivedAt?._seconds ? new Date(receipt.receivedAt._seconds * 1000).toISOString() : 'N/A'}):`);

    for (const line of receipt.lines) {
      const poLine = po.lineItems.find((li) => li.id === line.lineItemId);
      const desc = poLine?.description || line.lineItemId;
      const cat = poLine?.category || 'inventory';

      console.log(`\n  ${desc} (${cat}):`);
      console.log(`    quantityReceived:          ${line.quantityReceived}`);
      console.log(`    warehouseId:               ${line.warehouseId || 'N/A'}`);
      console.log(`    inventoryItemId:           ${line.inventoryItemId || poLine?.inventoryItemId || 'N/A'}`);

      // Audit fields (stamped by receiptRoutingService)
      console.log(`    baseUnitQuantityReceived:   ${line.baseUnitQuantityReceived ?? 'NOT SET'}`);
      console.log(`    packagingMultiplier:         ${line.packagingMultiplier ?? 'NOT SET'}`);
      console.log(`    functionalCurrencyUnitCost:  ${line.functionalCurrencyUnitCost ?? 'NOT SET'}`);
      console.log(`    exchangeRateUsed:            ${line.exchangeRateUsed ?? 'NOT SET'}`);
      console.log(`    sourceCurrency:              ${line.sourceCurrency ?? 'NOT SET'}`);

      // Check inventory item state if applicable
      const invId = line.inventoryItemId || poLine?.inventoryItemId;
      if (cat === 'inventory' && invId) {
        const itemSnap = await db.collection('inventoryItems').doc(invId).get();
        if (itemSnap.exists) {
          const item = itemSnap.data();
          console.log(`    --- Inventory Item State ---`);
          console.log(`    Name:            ${item.name}`);
          console.log(`    inStock:         ${item.inventory?.inStock ?? 0}`);
          console.log(`    costPerUnit:     ${item.pricing?.costPerUnit ?? 0} ${item.pricing?.currency || 'UGX'}`);
          console.log(`    funcCurrCost:    ${item.pricing?.functionalCurrencyCost ?? 'NOT SET'}`);
          console.log(`    purchaseUom:     ${item.purchaseUom ?? 'NOT SET'}`);
          console.log(`    stockUom:        ${item.stockUom ?? 'NOT SET'}`);
          console.log(`    uomConversion:   ${item.uomConversion ?? 'NOT SET'}`);

          // Check supplier pricing
          const lists = [item.supplierPricing, item.vendorSources];
          for (const list of lists) {
            if (!Array.isArray(list) || !list.length) continue;
            for (const sp of list) {
              if (sp.packagingQty) {
                console.log(`    supplierPkg:     ${sp.packagingQty} ${sp.packagingUnit || ''} @ ${sp.pricePerPackage ?? 'N/A'}/pkg (supplier: ${sp.supplierId})`);
              }
            }
          }

          // Check stock level
          if (line.warehouseId) {
            const slSnap = await db.collection('stockLevels')
              .where('inventoryItemId', '==', invId)
              .where('warehouseId', '==', line.warehouseId)
              .limit(1).get();
            if (!slSnap.empty) {
              const sl = slSnap.docs[0].data();
              console.log(`    stockLevel QOH:  ${sl.quantityOnHand}`);
              console.log(`    stockLevel Avl:  ${sl.quantityAvailable}`);
            }
          }
        }
      }

      // Calculate what SHOULD be recorded
      if (cat === 'inventory' && poLine) {
        let multiplier = poLine.packagingQty ?? 0;
        let multiplierSource = 'PO line';

        if (multiplier <= 0 && invId) {
          const itemSnap2 = await db.collection('inventoryItems').doc(invId).get();
          if (itemSnap2.exists) {
            const item2 = itemSnap2.data();
            // Check supplier pricing
            for (const list of [item2.supplierPricing, item2.vendorSources]) {
              if (!Array.isArray(list) || !list.length) continue;
              const match = po.supplierId
                ? list.find((s) => s.supplierId === po.supplierId && s.packagingQty > 0)
                : null;
              if (match) { multiplier = match.packagingQty; multiplierSource = 'supplier pricing'; break; }
              const pref = list.find((s) => s.isPreferred && s.packagingQty > 0);
              if (pref) { multiplier = pref.packagingQty; multiplierSource = 'preferred supplier'; break; }
              const first = list.find((s) => s.packagingQty > 0);
              if (first) { multiplier = first.packagingQty; multiplierSource = 'first supplier'; break; }
            }
            // Fall back to UoM conversion
            if (multiplier <= 0 && item2.uomConversion > 0) {
              multiplier = item2.uomConversion;
              multiplierSource = 'item uomConversion';
            }
          }
        }
        if (multiplier <= 0) { multiplier = 1; multiplierSource = 'default'; }

        const correctQty = line.quantityReceived * multiplier;
        const effectiveCost = poLine.effectiveUnitCost ?? poLine.unitCost;
        const baseUnitCostSource = effectiveCost / multiplier;
        const sourceCurrency = poLine.currency || poCurrency;

        let correctCostUGX, rate;
        if (sourceCurrency === 'UGX') {
          correctCostUGX = baseUnitCostSource;
          rate = 1;
        } else {
          rate = poLine.exchangeRateToUGX ?? po.exchangeRateOverride ?? EXCHANGE_RATES_TO_UGX[sourceCurrency] ?? 1;
          correctCostUGX = Math.round(baseUnitCostSource * rate * 100) / 100;
        }

        console.log(`    --- Expected Values ---`);
        console.log(`    multiplier:      ${multiplier} (from ${multiplierSource})`);
        console.log(`    correctQty:      ${correctQty} (${line.quantityReceived} x ${multiplier})`);
        console.log(`    correctCost:     ${correctCostUGX} UGX/unit (${baseUnitCostSource.toFixed(4)} ${sourceCurrency} x ${rate})`);

        const actualQty = line.baseUnitQuantityReceived ?? line.quantityReceived;
        const actualCost = line.functionalCurrencyUnitCost ?? effectiveCost;
        const qtyMatch = actualQty === correctQty;
        const costMatch = Math.abs(actualCost - correctCostUGX) < 0.01;

        if (qtyMatch && costMatch) {
          console.log(`    STATUS:          ✅ CORRECT`);
        } else {
          console.log(`    STATUS:          ❌ NEEDS FIX`);
          if (!qtyMatch) console.log(`      Qty: ${actualQty} -> ${correctQty} (delta: ${correctQty - actualQty})`);
          if (!costMatch) console.log(`      Cost: ${actualCost} -> ${correctCostUGX} UGX/unit`);
        }
      }
    }
    console.log();
  }

  console.log('=== Diagnosis complete ===\n');
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
