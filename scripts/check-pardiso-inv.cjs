const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  // Check Pardiso inventory item
  const invDoc = await db.collection('inventoryItems').doc('bm8xh6L4wuNtGetybqCG').get();
  if (invDoc.exists) {
    const d = invDoc.data();
    console.log('=== Pardiso Inventory Item ===');
    console.log('Name:', d.name);
    console.log('SKU:', d.sku);
    console.log('Pricing:', JSON.stringify(d.pricing, null, 2));
    console.log('Category:', d.category);
    console.log('Dimensions:', d.dimensions);

    // Check product variants
    const variants = await db.collection('productVariants')
      .where('inventoryItemId', '==', 'bm8xh6L4wuNtGetybqCG')
      .get();
    console.log('\nVariants:');
    for (const v of variants.docs) {
      const vd = v.data();
      console.log('  ', v.id, '| name:', vd.name, '| averageCost:', vd.averageCost, '| dimensions:', JSON.stringify(vd.dimensions));
    }
  }

  // Also check original Quartz
  const quartzDoc = await db.collection('inventoryItems').doc('3SBXOC6u8IiZqMpK4YTT').get();
  if (quartzDoc.exists) {
    const d = quartzDoc.data();
    console.log('\n=== Quartz Inventory Item ===');
    console.log('Name:', d.name);
    console.log('SKU:', d.sku);
    console.log('Pricing:', JSON.stringify(d.pricing, null, 2));
  }

  process.exit(0);
})();
