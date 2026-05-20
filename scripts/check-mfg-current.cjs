const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';
  const itemId = '0nrekt6PLubsPrNAQwSc'; // Granite

  const doc = await db.collection('designProjects').doc(projectId)
    .collection('designItems').doc(itemId).get();
  const data = doc.data();
  const mfg = data.manufacturing;

  console.log('=== Manufacturing on Design Item ===');
  console.log('sheetMaterials:', JSON.stringify(mfg.sheetMaterials, null, 2));
  console.log('sheetMaterialsCost:', mfg.sheetMaterialsCost);
  console.log();
  console.log('linearMaterials:', JSON.stringify(mfg.linearMaterials, null, 2));
  console.log('linearMaterialsCost:', mfg.linearMaterialsCost);
  console.log();
  console.log('timberMaterials:', JSON.stringify(mfg.timberMaterials, null, 2));
  console.log('timberMaterialsCost:', mfg.timberMaterialsCost);
  console.log();
  console.log('materialCost:', mfg.materialCost);
  console.log('totalCost:', mfg.totalCost);
  console.log('lastAutoCalcAt:', mfg.lastAutoCalcAt);

  process.exit(0);
})();
