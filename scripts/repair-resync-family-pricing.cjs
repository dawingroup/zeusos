/**
 * Repair + resync family pricing across all inventory families.
 *
 * Recomputes each family parent `pricing.costPerUnit` as the simple average
 * of active child SKUs with positive prices, then writes parent pricing fields.
 *
 * Usage:
 *   node scripts/repair-resync-family-pricing.cjs
 */

const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'dawinos' });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const SYSTEM_USER = 'SYSTEM_FAMILY_PRICING_REPAIR';
const EPSILON = 0.0001;

function almostEqual(a, b) {
  return Math.abs((a || 0) - (b || 0)) < EPSILON;
}

async function main() {
  console.log('============================================================');
  console.log(' Family Pricing Repair + Resync');
  console.log(' Project: dawinos');
  console.log('============================================================\n');

  const familiesSnap = await db.collection('inventoryItems').where('isFamily', '==', true).get();
  console.log(`Found ${familiesSnap.size} family item(s)\n`);

  let scanned = 0;
  let updated = 0;
  let unchanged = 0;
  let zeroed = 0;

  for (const familyDoc of familiesSnap.docs) {
    scanned++;
    const family = familyDoc.data();
    const familyId = familyDoc.id;
    const familyName = family.displayName || family.name || family.sku || familyId;
    const familySku = family.sku || 'NO-SKU';

    const childrenSnap = await db.collection('inventoryItems').where('familyId', '==', familyId).get();
    const children = childrenSnap.docs.map((d) => d.data());

    const activePricedChildren = children
      .filter((child) => child?.status === 'active')
      .filter((child) => (child?.pricing?.costPerUnit || 0) > 0);

    const nextCost = activePricedChildren.length > 0
      ? activePricedChildren.reduce((sum, child) => sum + (child?.pricing?.costPerUnit || 0), 0) / activePricedChildren.length
      : 0;

    const nextCurrency =
      activePricedChildren[0]?.pricing?.currency ||
      family?.pricing?.currency ||
      'UGX';

    const nextUnit =
      activePricedChildren[0]?.pricing?.unit ||
      family?.pricing?.unit ||
      'ea';

    const currentCost = family?.pricing?.costPerUnit || 0;
    const currentCurrency = family?.pricing?.currency || 'UGX';
    const currentUnit = family?.pricing?.unit || 'ea';

    const needsUpdate =
      !almostEqual(currentCost, nextCost) ||
      currentCurrency !== nextCurrency ||
      currentUnit !== nextUnit;

    if (!needsUpdate) {
      unchanged++;
      continue;
    }

    await familyDoc.ref.update({
      pricing: {
        ...(family?.pricing || {}),
        costPerUnit: nextCost,
        currency: nextCurrency,
        unit: nextUnit,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: SYSTEM_USER,
    });

    updated++;
    if (nextCost === 0) zeroed++;

    console.log(
      `UPDATED ${familySku} | ${familyName} | ${currentCost.toLocaleString()} -> ${nextCost.toLocaleString()} ${nextCurrency}/${nextUnit} | children priced: ${activePricedChildren.length}`,
    );
  }

  console.log('\n============================================================');
  console.log(`Scanned:   ${scanned}`);
  console.log(`Updated:   ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Zeroed:    ${zeroed}`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Family pricing repair failed:', err);
  process.exit(1);
});

