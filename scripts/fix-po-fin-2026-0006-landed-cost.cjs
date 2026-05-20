/**
 * Fix PO-FIN-2026-0006 — Correct landed cost values from AED to UGX
 *
 * Problem:
 *   The initial inventory-creation script stored pricing.costPerUnit in AED
 *   (the supplier's foreign currency) instead of translating it to UGX
 *   (the functional currency). All downstream valuations are therefore wrong.
 *
 * What this script does:
 *   1. Fetches PO-FIN-2026-0006 and each linked inventory item
 *   2. For each item:
 *      a. Reads current AED costPerUnit
 *      b. Converts to UGX using the PO exchange rate (1 AED = 1,000 UGX)
 *      c. Updates pricing.costPerUnit to the UGX landed cost
 *      d. Ensures pricing.functionalCurrencyCost matches
 *      e. Records the change in costHistory for audit
 *   3. Stamps the PO receivingHistory with correct audit fields
 *   4. Adds an audit note to the PO
 *
 * Run: NODE_PATH=functions/node_modules node scripts/fix-po-fin-2026-0006-landed-cost.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Constants ────────────────────────────────────
const PO_NUMBER = 'PO-FIN-2026-0006';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

const PO_CURRENCY = 'AED';
const FUNCTIONAL_CURRENCY = 'UGX';

// 1 AED = 1,000 UGX (mirrors currency.constants.ts)
const AED_TO_UGX = 1000;

// ── Main ─────────────────────────────────────────

async function main() {
  console.log('\n=== Correcting landed costs for ' + PO_NUMBER + ' (AED → UGX) ===\n');

  // 1. Fetch the PO
  const poSnap = await db.collection('purchaseOrders')
    .where('poNumber', '==', PO_NUMBER)
    .limit(1)
    .get();

  if (poSnap.empty) {
    console.error('ERROR: ' + PO_NUMBER + ' not found');
    process.exit(1);
  }

  const poRef = poSnap.docs[0].ref;
  const po = { id: poSnap.docs[0].id, ...poSnap.docs[0].data() };

  console.log('PO Doc ID  : ' + po.id);
  console.log('Supplier   : ' + po.supplierName);
  console.log('Currency   : ' + PO_CURRENCY + '  →  ' + FUNCTIONAL_CURRENCY + ' @ ' + AED_TO_UGX);
  console.log('Line items : ' + (po.lineItems || []).length + '\n');

  // 2. Process each line item
  let corrected = 0;
  let skipped = 0;

  for (let i = 0; i < (po.lineItems || []).length; i++) {
    const li = po.lineItems[i];

    console.log('--- Line ' + (i + 1) + ': ' + li.description);

    if (!li.inventoryItemId) {
      console.log('    [SKIP] No inventoryItemId\n');
      skipped++;
      continue;
    }

    // Fetch the current inventory item
    const itemSnap = await db.collection('inventoryItems').doc(li.inventoryItemId).get();

    if (!itemSnap.exists) {
      console.log('    [SKIP] Inventory item ' + li.inventoryItemId + ' not found\n');
      skipped++;
      continue;
    }

    const item = itemSnap.data();
    const currentCostPerUnit = item.pricing?.costPerUnit ?? 0;
    const currentCurrency = item.pricing?.currency ?? '';
    const currentFunctionalCost = item.pricing?.functionalCurrencyCost ?? 0;

    // The landed cost per unit in AED (what was originally computed)
    const landedAED = li.effectiveUnitCost != null ? li.effectiveUnitCost : li.unitCost;
    const rawAED = li.unitCost;

    // The correct values in UGX
    const landedUGX = Math.round(landedAED * AED_TO_UGX * 100) / 100;
    const rawUGX = Math.round(rawAED * AED_TO_UGX * 100) / 100;

    console.log('    inventoryItemId   : ' + li.inventoryItemId);
    console.log('    SKU               : ' + (li.sku || '-'));
    console.log('    Current costPerUnit: ' + currentCostPerUnit + ' ' + currentCurrency);
    console.log('    Current functional : ' + currentFunctionalCost + ' UGX');
    console.log('    Supplier price     : ' + rawAED + ' AED  →  ' + rawUGX.toLocaleString() + ' UGX');
    console.log('    Landed cost        : ' + landedAED + ' AED  →  ' + landedUGX.toLocaleString() + ' UGX');

    // Check if already corrected (costPerUnit is already in UGX range)
    // AED values are typically small (< 100), UGX values are typically large (> 1000)
    if (currentCostPerUnit === landedUGX && currentFunctionalCost === landedUGX) {
      console.log('    [OK] Already correct — no change needed\n');
      skipped++;
      continue;
    }

    // 2a. Record cost change in costHistory
    await db.collection('costHistory').add({
      inventoryItemId: li.inventoryItemId,
      previousCost: currentCostPerUnit,
      newCost: landedUGX,
      currency: FUNCTIONAL_CURRENCY,
      source: 'po_receipt',
      referenceId: po.id,
      poNumber: PO_NUMBER,
      notes: 'CORRECTION: Landed cost was recorded in ' + PO_CURRENCY + ' (' +
        currentCostPerUnit + ') instead of ' + FUNCTIONAL_CURRENCY + ' (' +
        landedUGX + '). Applied FX rate ' + AED_TO_UGX + '.',
      recordedAt: FieldValue.serverTimestamp(),
      recordedBy: SYSTEM_USER,
    });

    // 2b. Update inventory item pricing
    // costPerUnit should be in functional currency (UGX) for all calculations
    // Keep the original AED value accessible via supplierPricing
    await db.collection('inventoryItems').doc(li.inventoryItemId).update({
      'pricing.costPerUnit': landedUGX,
      'pricing.currency': FUNCTIONAL_CURRENCY,
      'pricing.functionalCurrencyCost': landedUGX,
      'pricing.exchangeRate': AED_TO_UGX,
      'pricing.sourceCurrencyCost': landedAED,
      'pricing.sourceCurrency': PO_CURRENCY,
      'pricing.lastUpdatedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: SYSTEM_USER,
    });

    console.log('    [FIXED] costPerUnit: ' + currentCostPerUnit + ' ' + currentCurrency +
      '  →  ' + landedUGX + ' ' + FUNCTIONAL_CURRENCY);
    corrected++;
    console.log();
  }

  // 3. Stamp PO receivingHistory with correct audit fields
  if (po.receivingHistory && po.receivingHistory.length > 0) {
    console.log('Updating PO receipt audit fields...');

    const updatedHistory = po.receivingHistory.map((receipt) => ({
      ...receipt,
      lines: (receipt.lines || []).map((line) => {
        const poLine = po.lineItems.find((li) => li.id === line.lineItemId);
        if (!poLine) return line;

        const effectiveCost = poLine.effectiveUnitCost ?? poLine.unitCost;
        const landedInUGX = Math.round(effectiveCost * AED_TO_UGX * 100) / 100;

        return {
          ...line,
          functionalCurrencyUnitCost: landedInUGX,
          exchangeRateUsed: AED_TO_UGX,
          sourceCurrency: PO_CURRENCY,
        };
      }),
    }));

    const auditNote = '[SYSTEM] Corrected landed costs from ' + PO_CURRENCY + ' to ' +
      FUNCTIONAL_CURRENCY + ' for ' + corrected + ' items (FX rate: 1 AED = ' +
      AED_TO_UGX + ' UGX). Ran ' + new Date().toISOString() + '.';

    await poRef.update({
      receivingHistory: updatedHistory,
      notes: (po.notes ? po.notes + '\n' : '') + auditNote,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: SYSTEM_USER,
    });

    console.log('  [OK] PO receipt history updated\n');
  }

  // 4. Summary
  console.log('=== Summary ===');
  console.log('  Corrected: ' + corrected + ' inventory items (AED → UGX)');
  console.log('  Skipped  : ' + skipped + ' (already correct or not linked)');
  console.log('  FX rate  : 1 AED = ' + AED_TO_UGX + ' UGX');
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
