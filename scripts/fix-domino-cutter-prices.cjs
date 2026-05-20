/**
 * Fix Domino Dowel Cutter prices from PO-FIN-2026-0004
 * - 8mm: restore to 290,720 UGX (63.20 GBP x 4600)
 * - 10mm: set to 317,768 UGX (69.08 GBP x 4600) on manually created asset
 *
 * Run: NODE_PATH=functions/node_modules node scripts/fix-domino-cutter-prices.cjs
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PO_NUMBER = 'PO-FIN-2026-0004';
const SYSTEM_USER = 'SYSTEM_ADJUSTMENT';

const ASSET_8MM_ID = '5XLyjZ1rQnfuFEtppT7U';

async function main() {
  console.log('\n--- Fixing Domino Dowel Cutter prices ---\n');

  // 1. Fix the 8mm cutter
  const snap8 = await db.collection('assets').doc(ASSET_8MM_ID).get();
  if (snap8.exists) {
    const data = snap8.data();
    console.log(`8mm cutter (${ASSET_8MM_ID}):`);
    console.log(`  Current price: ${data.financials?.purchasePrice?.toLocaleString()} UGX`);

    await db.collection('assets').doc(ASSET_8MM_ID).update({
      'financials.purchasePrice': 290720,
      'financials.originalPrice': 63.20,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: SYSTEM_USER,
    });
    console.log(`  [OK] Corrected to 290,720 UGX (63.20 GBP x 4600)\n`);
  } else {
    console.log(`  [WARN] 8mm cutter ${ASSET_8MM_ID} not found\n`);
  }

  // 2. Find the 10mm cutter (manually added)
  const allSnap = await db.collection('assets').get();
  const allAssets = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const cutter10 = allAssets.find((a) => {
    const name = `${a.brand} ${a.model}`.toLowerCase();
    return name.includes('10') && name.includes('domino') && a.id !== ASSET_8MM_ID;
  });

  if (cutter10) {
    console.log(`10mm cutter (${cutter10.id}):`);
    console.log(`  Current: ${cutter10.brand} ${cutter10.model}`);
    console.log(`  Has financials: ${!!cutter10.financials}`);

    await db.collection('assets').doc(cutter10.id).update({
      financials: {
        purchasePrice: 317768,
        purchaseDate: '2026-03-01',
        currency: 'UGX',
        supplier: 'D&M Tools',
        invoiceReference: PO_NUMBER,
        depreciationMethod: 'STRAIGHT_LINE',
        usefulLifeYears: 5,
        salvageValue: 0,
        originalCurrency: 'GBP',
        originalPrice: 69.08,
        exchangeRateUsed: 4600,
      },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: SYSTEM_USER,
    });
    console.log(`  [OK] Set to 317,768 UGX (69.08 GBP x 4600)\n`);
  } else {
    console.log('  [WARN] 10mm cutter not found in registry\n');
  }

  console.log('--- Done ---\n');
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
