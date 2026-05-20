/**
 * Fix PO-FIN-2026-0006 — Create missing inventory items, link to PO,
 * update stock quantities, and add supplier pricing for Project Works (AED).
 *
 * All 7 line items on this PO were imported from PDF but the auto-create
 * step did not fire, leaving inventoryItemId empty on every line.
 *
 * Pricing convention:
 *   pricing.costPerUnit        = effectiveUnitCost (landed: unit cost + prorated freight/duties)
 *   supplierPricing.unitPrice  = raw unitCost (what the supplier quotes before landed costs)
 *
 * What this script does:
 *   1. Fetches PO-FIN-2026-0006
 *   2. For each line item missing an inventoryItemId:
 *      a. Checks if an item with that SKU already exists (prevents duplicates)
 *      b. Creates a new inventoryItem if not found
 *      c. Sets pricing.costPerUnit = effectiveUnitCost (landed)
 *      d. Adds Project Works supplier pricing with raw unitCost
 *      e. Credits the received quantity to stock
 *      f. Patches the PO line item with the new inventoryItemId
 *   3. Saves an audit log entry on the PO
 *
 * Run: NODE_PATH=functions/node_modules node scripts/fix-po-fin-2026-0006-inventory.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const PO_NUMBER = 'PO-FIN-2026-0006';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

// Supplier info from the PO
const SUPPLIER_ID   = 'sup-1771665972310-cf4zl3r2c';
const SUPPLIER_NAME = 'Project Works';
const PO_CURRENCY   = 'AED';

// 1 AED → UGX (mirrors currency.constants.ts)
const AED_TO_UGX = 1000;

// ─── Helper: derive a clean internal SKU from the supplier SKU ───────────────
function sanitiseSku(raw) {
  return (raw || '')
    .replace(/\s+/g, '')   // collapse any whitespace / newlines
    .toUpperCase()
    .trim();
}

// ─── Helper: infer category from description ──────────────────────────────────
function inferCategory(description) {
  const d = description.toLowerCase();
  if (d.includes('hinge'))                          return 'hardware';
  if (d.includes('slide') || d.includes('drawer'))  return 'hardware';
  if (d.includes('leg') || d.includes('rebounder')) return 'hardware';
  return 'hardware'; // Everything on this PO is hardware
}

// ─── Helper: infer subcategory ────────────────────────────────────────────────
function inferSubcategory(description) {
  const d = description.toLowerCase();
  if (d.includes('hinge'))      return 'Hinge';
  if (d.includes('slide'))      return 'Drawer Slide';
  if (d.includes('rebounder'))  return 'Soft Close';
  if (d.includes('leg'))        return 'Cabinet Leg';
  return undefined;
}

// ─── Helper: check for existing item by SKU ───────────────────────────────────
async function findBySku(sku) {
  const snap = await db.collection('inventoryItems')
    .where('sku', '==', sku)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ─── Helper: build the supplier pricing sub-document ─────────────────────────
// unitPrice here is the RAW supplier price (before landed costs)
function buildSupplierPricing(rawUnitPrice, sku) {
  return {
    supplierId:   SUPPLIER_ID,
    supplierName: SUPPLIER_NAME,
    supplierCode: sku,
    unitPrice:    rawUnitPrice,   // what Project Works quotes (excl. freight/duties)
    currency:     PO_CURRENCY,
    unit:         'pcs',
    isPreferred:  true,
    addedAt:      Timestamp.now(),
    addedBy:      SYSTEM_USER,
    lastQuotedAt: Timestamp.now(),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== Fixing ' + PO_NUMBER + ' — creating missing inventory items ===\n');

  // 1. Fetch the PO
  const poSnap = await db.collection('purchaseOrders')
    .where('poNumber', '==', PO_NUMBER)
    .limit(1).get();

  if (poSnap.empty) {
    console.error('ERROR: ' + PO_NUMBER + ' not found in purchaseOrders collection');
    process.exit(1);
  }

  const poRef = poSnap.docs[0].ref;
  const po    = { id: poSnap.docs[0].id, ...poSnap.docs[0].data() };

  const landedCosts = po.landedCosts || {};
  const totalLanded = landedCosts.totalLandedCost || 0;
  const subtotal    = po.totals?.subtotal || 0;

  console.log('PO Doc ID     : ' + po.id);
  console.log('Supplier      : ' + po.supplierName + ' (' + (po.supplierId || '-') + ')');
  console.log('Currency      : ' + PO_CURRENCY + '  (1 AED = ' + AED_TO_UGX + ' UGX)');
  console.log('Status        : ' + po.status);
  console.log('Subtotal      : ' + subtotal + ' AED');
  console.log('Landed costs  : ' + totalLanded + ' AED  (shipping: ' + (landedCosts.shipping || 0) + ', duties: ' + (landedCosts.duties || 0) + ')');
  console.log('Grand total   : ' + (po.totals?.grandTotal || 0) + ' AED');
  console.log('Distribution  : ' + (landedCosts.distributionMethod || 'proportional_value'));
  console.log('Line items    : ' + (po.lineItems || []).length + '\n');

  // Received date
  let receivedDate = new Date().toISOString().split('T')[0];
  if (po.receivingHistory && po.receivingHistory.length > 0) {
    const rcpt = po.receivingHistory[0];
    const ts   = rcpt.receivedAt && rcpt.receivedAt._seconds
      ? new Date(rcpt.receivedAt._seconds * 1000)
      : (rcpt.receivedAt && rcpt.receivedAt.toDate ? rcpt.receivedAt.toDate() : new Date());
    receivedDate = ts.toISOString().split('T')[0];
  }
  console.log('Received date : ' + receivedDate + '\n');

  // 2. Process each line item
  const updatedLineItems = [].concat(po.lineItems || []);
  let created = 0;
  let reused  = 0;
  let skipped = 0;

  for (let i = 0; i < updatedLineItems.length; i++) {
    const li = updatedLineItems[i];

    // Landed cost per unit — already computed by the PO service during receipt
    const landedUnitCost = li.effectiveUnitCost != null ? li.effectiveUnitCost : li.unitCost;
    const rawUnitCost    = li.unitCost;

    const landedUGX = Math.round(landedUnitCost * AED_TO_UGX);
    const rawUGX    = Math.round(rawUnitCost * AED_TO_UGX);

    console.log('--- Line ' + (i + 1) + ': ' + li.description);
    console.log('    SKU: ' + (li.sku || '(none)') + ' | Qty: ' + li.quantity + ' ' + li.unit);
    console.log('    Supplier price  : ' + rawUnitCost + ' AED  (' + rawUGX.toLocaleString() + ' UGX)');
    console.log('    Landed cost/unit: ' + landedUnitCost + ' AED  (' + landedUGX.toLocaleString() + ' UGX)');

    // Already linked — still correct the price in case this is a re-run
    if (li.inventoryItemId) {
      console.log('    [ALREADY LINKED] ' + li.inventoryItemId + ' — correcting prices...');
      const supplierPricingEntry = buildSupplierPricing(rawUnitCost, sanitiseSku(li.sku));
      const existingSnap = await db.collection('inventoryItems').doc(li.inventoryItemId).get();
      if (existingSnap.exists) {
        const existingData  = existingSnap.data();
        const otherPricing  = (existingData.supplierPricing || []).filter((sp) => sp.supplierId !== SUPPLIER_ID);
        await db.collection('inventoryItems').doc(li.inventoryItemId).update({
          'pricing.costPerUnit':            landedUnitCost,
          'pricing.currency':               PO_CURRENCY,
          'pricing.functionalCurrencyCost': landedUGX,
          'pricing.exchangeRate':           AED_TO_UGX,
          supplierPricing:                  [...otherPricing, supplierPricingEntry],
          updatedAt:                        FieldValue.serverTimestamp(),
          updatedBy:                        SYSTEM_USER,
        });
        console.log('    [OK] Prices corrected\n');
      }
      skipped++;
      continue;
    }

    const internalSku = sanitiseSku(li.sku) || ('PW-' + Date.now() + '-' + i);
    const category    = inferCategory(li.description);
    const subcategory = inferSubcategory(li.description);
    const supplierPricingEntry = buildSupplierPricing(rawUnitCost, internalSku);

    // a. Check if inventory item already exists with this SKU
    const existing = await findBySku(internalSku);
    let inventoryItemId;

    if (existing) {
      // ── Item exists: update prices + supplier pricing + stock ───────────
      inventoryItemId = existing.id;
      console.log('    [FOUND] Existing item ' + inventoryItemId);

      const otherPricing  = (existing.supplierPricing || []).filter((sp) => sp.supplierId !== SUPPLIER_ID);

      await db.collection('inventoryItems').doc(inventoryItemId).update({
        'pricing.costPerUnit':            landedUnitCost,
        'pricing.currency':               PO_CURRENCY,
        'pricing.functionalCurrencyCost': landedUGX,
        'pricing.exchangeRate':           AED_TO_UGX,
        'inventory.inStock':              FieldValue.increment(li.quantity),
        supplierPricing:                  [...otherPricing, supplierPricingEntry],
        preferredSupplierId:              SUPPLIER_ID,
        preferredSupplierName:            SUPPLIER_NAME,
        updatedAt:                        FieldValue.serverTimestamp(),
        updatedBy:                        SYSTEM_USER,
      });

      console.log('    [OK] Updated landed price + stock (+' + li.quantity + ' ' + li.unit + ') + supplier pricing');
      reused++;

    } else {
      // ── Item does not exist: create it ───────────────────────────────────
      const newItem = {
        sku:          internalSku,
        name:         li.description,
        displayName:  li.description,
        category,
        subcategory,
        brand:        'Starke',
        tags:         ['starke', 'project-works', po.poNumber],
        aliases:      li.sku ? [li.sku] : [],
        tier:         'global',
        source:       'manual',
        status:       'active',
        itemType:     'standard',
        pricing: {
          // Landed cost is the true cost per unit (what it costs us to have this in stock)
          costPerUnit:            landedUnitCost,
          currency:               PO_CURRENCY,
          unit:                   'pcs',
          functionalCurrencyCost: landedUGX,
          exchangeRate:           AED_TO_UGX,
        },
        inventory: {
          inStock:      li.quantity,
          reorderLevel: 0,
        },
        supplierPricing:       [supplierPricingEntry],
        preferredSupplierId:   SUPPLIER_ID,
        preferredSupplierName: SUPPLIER_NAME,
        createdAt:             FieldValue.serverTimestamp(),
        createdBy:             SYSTEM_USER,
        updatedAt:             FieldValue.serverTimestamp(),
        updatedBy:             SYSTEM_USER,
      };

      const docRef    = await db.collection('inventoryItems').add(newItem);
      inventoryItemId = docRef.id;

      console.log('    [CREATED] inventoryItems/' + inventoryItemId);
      console.log('    Category: ' + category + ' | Subcategory: ' + (subcategory || '-'));
      console.log('    Landed cost: ' + landedUnitCost + ' AED = ' + landedUGX.toLocaleString() + ' UGX  (supplier: ' + rawUnitCost + ' AED)');
      console.log('    Stock: ' + li.quantity + ' pcs');
      created++;
    }

    // Patch the line item entry with the resolved inventoryItemId + clean SKU
    updatedLineItems[i] = Object.assign({}, li, {
      inventoryItemId,
      sku: internalSku,
    });

    console.log();
  }

  // 3. Write the patched lineItems array back to the PO
  const auditNote = '[SYSTEM] Fixed ' + created + ' created + ' + reused + ' reused inventory items from ' + PO_NUMBER + ' (landed costs applied). Ran ' + new Date().toISOString() + '.';

  await poRef.update({
    lineItems: updatedLineItems,
    notes:     (po.notes ? po.notes + '\n' : '') + auditNote,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: SYSTEM_USER,
  });

  console.log('\n=== Summary ===');
  console.log('  Created  : ' + created + ' new inventory items');
  console.log('  Reused   : ' + reused + ' existing items (updated)');
  console.log('  Corrected: ' + skipped + ' already-linked items (prices fixed)');
  console.log('  PO patched: ' + PO_NUMBER + ' lineItems updated\n');
  console.log('Done.\n');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
