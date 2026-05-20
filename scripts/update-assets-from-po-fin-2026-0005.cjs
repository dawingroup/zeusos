/**
 * Update Asset Registry with pricing from PO-FIN-2026-0005
 *
 * Populates the `financials` field on assets created from PO receipt,
 * including purchase price (converted to UGX), purchase date, supplier,
 * invoice reference, and depreciation profile.
 *
 * Run: NODE_PATH=functions/node_modules node scripts/update-assets-from-po-fin-2026-0005.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PO_NUMBER = 'PO-FIN-2026-0005';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

// Exchange rates (mirrors currency.constants.ts)
const EXCHANGE_RATES_TO_UGX = {
  UGX: 1, USD: 3700, EUR: 4000, GBP: 4600,
  AED: 1000, CNY: 510, KES: 29, ZAR: 205,
};

// Default useful life by asset category (years)
const DEFAULT_USEFUL_LIFE = {
  STATIONARY_MACHINE: 10,
  POWER_TOOL: 5,
  HAND_TOOL: 7,
  JIG: 5,
  CNC: 10,
  DUST_COLLECTION: 8,
  SPRAY_EQUIPMENT: 7,
  SEWING_MACHINE: 8,
};

async function main() {
  console.log(`\n--- Updating assets from ${PO_NUMBER} ---\n`);

  // 1. Fetch the PO
  const poSnap = await db.collection('purchaseOrders')
    .where('poNumber', '==', PO_NUMBER)
    .limit(1).get();

  if (poSnap.empty) { console.error('PO not found'); process.exit(1); }

  const po = { id: poSnap.docs[0].id, ...poSnap.docs[0].data() };
  const poCurrency = po.totals?.currency || 'UGX';
  const exchangeRate = po.exchangeRateOverride || EXCHANGE_RATES_TO_UGX[poCurrency] || 1;

  console.log(`  PO: ${po.poNumber} (${poCurrency})`);
  console.log(`  Supplier: ${po.supplierName || po.supplierId || 'Unknown'}`);
  console.log(`  Exchange rate: 1 ${poCurrency} = ${exchangeRate} UGX`);
  console.log();

  // 2. Find asset line items and their receipt data
  const assetLines = po.lineItems.filter((li) => {
    const cat = li.category || 'inventory';
    return cat === 'asset';
  });

  if (assetLines.length === 0) {
    console.log('No asset line items found on this PO.');
    process.exit(0);
  }

  console.log(`  Found ${assetLines.length} asset line item(s):\n`);

  // Collect asset IDs from receipt history
  const receiptAssetMap = {}; // lineItemId -> { assetId, serialNumber, receivedAt }
  if (po.receivingHistory) {
    for (const receipt of po.receivingHistory) {
      for (const line of receipt.lines) {
        if (line.assetId) {
          receiptAssetMap[line.lineItemId] = {
            assetId: line.assetId,
            serialNumber: line.serialNumber || null,
            receivedAt: receipt.receivedAt,
          };
        }
      }
    }
  }

  // Also check if assetId is on the PO line item itself
  for (const li of assetLines) {
    if (li.assetId && !receiptAssetMap[li.id]) {
      receiptAssetMap[li.id] = { assetId: li.assetId, serialNumber: null, receivedAt: null };
    }
  }

  let updated = 0;
  let notFound = 0;

  for (const li of assetLines) {
    const effectiveCost = li.effectiveUnitCost ?? li.unitCost;
    const totalInSource = effectiveCost * li.quantity;

    // Convert to UGX
    const lineRate = li.exchangeRateToUGX ?? exchangeRate;
    const unitCostUGX = poCurrency === 'UGX'
      ? effectiveCost
      : Math.round(effectiveCost * lineRate * 100) / 100;
    const totalCostUGX = poCurrency === 'UGX'
      ? totalInSource
      : Math.round(totalInSource * lineRate * 100) / 100;

    console.log(`  ${li.description}`);
    console.log(`    Qty: ${li.quantity}, Unit cost: ${effectiveCost} ${poCurrency}`);
    console.log(`    Unit cost (UGX): ${unitCostUGX.toLocaleString()}`);
    console.log(`    Total (UGX): ${totalCostUGX.toLocaleString()}`);

    const receiptInfo = receiptAssetMap[li.id];

    if (!receiptInfo?.assetId) {
      // No asset linked — try to find by description match
      console.log(`    No asset ID on receipt. Searching by description...`);

      const assetsSnap = await db.collection('assets').get();
      const allAssets = assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Try to find matching assets created around receipt time
      const descWords = li.description.toLowerCase().split(/\s+/);
      const matches = allAssets.filter((a) => {
        const fullName = `${a.brand} ${a.model}`.toLowerCase();
        // At least 2 words from the description must match
        const matchCount = descWords.filter((w) => w.length > 2 && fullName.includes(w)).length;
        return matchCount >= 2;
      });

      if (matches.length === 0) {
        console.log(`    [SKIP] No matching asset found in registry`);
        notFound++;
        continue;
      }

      // If multiple matches, prefer ones without financials already set
      const target = matches.find((a) => !a.financials) || matches[0];
      console.log(`    Found match: ${target.brand} ${target.model} (${target.id})`);

      await updateAssetFinancials(target.id, li, unitCostUGX, poCurrency, lineRate, po);
      updated++;
      continue;
    }

    // Asset ID exists from receipt
    const assetId = receiptInfo.assetId;
    console.log(`    Asset ID: ${assetId}`);

    // Check if asset exists
    const assetSnap = await db.collection('assets').doc(assetId).get();
    if (!assetSnap.exists) {
      console.log(`    [SKIP] Asset ${assetId} not found in registry`);
      notFound++;
      continue;
    }

    const asset = assetSnap.data();
    console.log(`    Asset: ${asset.brand} ${asset.model}`);

    // For multi-quantity lines, each unit gets its own asset
    // The first asset ID is stored on the receipt line
    // We update it with per-unit cost
    await updateAssetFinancials(assetId, li, unitCostUGX, poCurrency, lineRate, po);
    updated++;

    // If quantity > 1, find and update subsequent assets too
    if (li.quantity > 1) {
      console.log(`    (${li.quantity} units — searching for additional assets...)`);

      // Find all assets with same brand/model created by the receipt
      const brand = asset.brand;
      const model = asset.model;

      const siblingSnap = await db.collection('assets')
        .where('brand', '==', brand)
        .where('model', '==', model)
        .get();

      const siblings = siblingSnap.docs
        .filter((d) => d.id !== assetId)
        .map((d) => ({ id: d.id, ...d.data() }));

      for (const sibling of siblings) {
        if (sibling.financials) {
          console.log(`    Sibling ${sibling.id} already has financials, skipping`);
          continue;
        }
        await updateAssetFinancials(sibling.id, li, unitCostUGX, poCurrency, lineRate, po);
        updated++;
        console.log(`    [OK] Updated sibling asset ${sibling.id}`);
      }
    }
  }

  console.log(`\n--- Results: ${updated} asset(s) updated, ${notFound} not found ---\n`);
}

async function updateAssetFinancials(assetId, lineItem, unitCostUGX, poCurrency, exchangeRate, po) {
  // Determine purchase date from receipt
  let purchaseDate;
  if (po.receivingHistory && po.receivingHistory.length > 0) {
    const rcpt = po.receivingHistory[0];
    if (rcpt.receivedAt) {
      // Could be a Firestore timestamp or a Date
      const ts = rcpt.receivedAt._seconds
        ? new Date(rcpt.receivedAt._seconds * 1000)
        : rcpt.receivedAt.toDate
          ? rcpt.receivedAt.toDate()
          : new Date(rcpt.receivedAt);
      purchaseDate = ts.toISOString().split('T')[0];
    }
  }
  if (!purchaseDate) {
    purchaseDate = new Date().toISOString().split('T')[0];
  }

  const assetCategory = lineItem.assetCategory || 'POWER_TOOL';
  const usefulLife = DEFAULT_USEFUL_LIFE[assetCategory] || 5;

  const financials = {
    purchasePrice: unitCostUGX,
    purchaseDate,
    currency: 'UGX',
    supplier: po.supplierName || po.supplierId || '',
    invoiceReference: po.poNumber,
    depreciationMethod: 'STRAIGHT_LINE',
    usefulLifeYears: usefulLife,
    salvageValue: 0,
  };

  // Add source currency info if not UGX
  if (poCurrency !== 'UGX') {
    financials.originalCurrency = poCurrency;
    financials.originalPrice = lineItem.effectiveUnitCost ?? lineItem.unitCost;
    financials.exchangeRateUsed = exchangeRate;
  }

  await db.collection('assets').doc(assetId).update({
    financials,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: SYSTEM_USER,
  });

  console.log(`    [OK] ${assetId}: ${unitCostUGX.toLocaleString()} UGX (${purchaseDate}, ${usefulLife}yr ${financials.depreciationMethod})`);
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
