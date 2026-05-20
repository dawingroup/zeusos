const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';

  // Get the Granite item
  const items = await db.collection('designProjects').doc(projectId).collection('designItems').get();

  for (const i of items.docs) {
    const d = i.data();
    if (d.itemCode === 'DF-2026-550-002' || d.name === 'Granite') {
      console.log('=== Granite Design Item ===');
      console.log('ID:', i.id);
      console.log('Code:', d.itemCode);
      console.log('Name:', d.name);
      console.log('SourcingType:', d.sourcingType);
      console.log('Category:', d.category);

      const mfg = d.manufacturing;
      if (mfg) {
        console.log('\n=== Manufacturing ===');
        console.log(JSON.stringify(mfg, null, 2));
      }

      // Check parts
      const partsSnap = await db.collection('designProjects').doc(projectId)
        .collection('designItems').doc(i.id)
        .collection('parts').get();

      console.log('\n=== Parts (' + partsSnap.size + ') ===');
      for (const p of partsSnap.docs) {
        const pd = p.data();
        console.log(pd.name || pd.label, '| material:', pd.materialName, '| L:', pd.length, 'W:', pd.width, 'T:', pd.thickness, '| qty:', pd.quantity);
      }

      // Check if there are cutlist/parts on item directly
      if (d.parts && d.parts.length) {
        console.log('\n=== Inline Parts ===');
        for (const p of d.parts) {
          console.log(p.name || p.label, '| material:', p.materialName, '| L:', p.length, 'W:', p.width, 'T:', p.thickness, '| qty:', p.quantity);
        }
      }

      if (d.cutlist && d.cutlist.length) {
        console.log('\n=== Cutlist ===');
        for (const c of d.cutlist) {
          console.log(c.name || c.label, '| material:', c.materialName, '| L:', c.length, 'W:', c.width, 'T:', c.thickness, '| qty:', c.quantity);
        }
      }
    }
  }

  // Also check the White Quartz palette entry more closely
  const projDoc = await db.collection('designProjects').doc(projectId).get();
  const projData = projDoc.data();
  const palette = projData.materialPalette;
  if (palette && palette.entries) {
    console.log('\n=== Quartz/Granite Palette Entries ===');
    for (const e of palette.entries) {
      const name = (e.designName || '').toLowerCase();
      if (name.includes('quartz') || name.includes('granite') || name.includes('stone')) {
        console.log(JSON.stringify(e, null, 2));
      }
    }
  }

  // Check inventory item for Quartz
  const invId = '3SBXOC6u8IiZqMpK4YTT';
  const invDoc = await db.collection('inventoryItems').doc(invId).get();
  if (invDoc.exists) {
    const inv = invDoc.data();
    console.log('\n=== Inventory Item: Quartz ===');
    console.log('Name:', inv.name);
    console.log('SKU:', inv.sku);
    console.log('Pricing:', JSON.stringify(inv.pricing, null, 2));
  }

  process.exit(0);
})();
