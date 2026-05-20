const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';
  const itemId = '0nrekt6PLubsPrNAQwSc'; // Granite item

  const doc = await db.collection('designProjects').doc(projectId)
    .collection('designItems').doc(itemId).get();
  const data = doc.data();

  console.log('=== Inline Parts Detail ===');
  if (data.parts) {
    for (const p of data.parts) {
      console.log(JSON.stringify({
        name: p.name,
        materialName: p.materialName,
        partType: p.partType,
        length: p.length,
        width: p.width,
        thickness: p.thickness,
        quantity: p.quantity,
      }));
    }
  }

  // Also check cutlist
  if (data.cutlist) {
    console.log('\n=== Cutlist Detail ===');
    for (const c of data.cutlist) {
      console.log(JSON.stringify({
        name: c.name,
        materialName: c.materialName,
        partType: c.partType,
        length: c.length,
        width: c.width,
        thickness: c.thickness,
        quantity: c.quantity,
      }));
    }
  }

  // Also check how the palette entry matches
  const projDoc = await db.collection('designProjects').doc(projectId).get();
  const palette = projDoc.data().materialPalette;
  if (palette && palette.entries) {
    for (const e of palette.entries) {
      if (e.designName === 'White Quartz') {
        console.log('\n=== Palette Match ===');
        console.log('designName:', e.designName);
        console.log('thickness:', e.thickness);
        console.log('materialType:', e.materialType);
        console.log('unitCost:', e.unitCost);
        console.log('stockSheets:', JSON.stringify(e.stockSheets));
      }
    }
  }

  process.exit(0);
})();
