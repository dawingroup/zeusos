const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';

  // List ALL design items with their pricing
  const items = await db.collection('designProjects').doc(projectId).collection('designItems').get();
  console.log('=== All Design Items ===\n');
  for (const i of items.docs) {
    const d = i.data();
    const mfg = d.manufacturing;
    const proc = d.procurement;
    console.log(d.itemCode, '|', d.name, '|', d.sourcingType || 'NO-TYPE');
    if (mfg) {
      console.log('  MFG: totalCost=' + mfg.totalCost + ' materialCost=' + mfg.materialCost + ' laborCost=' + mfg.laborCost);
      if (mfg.sheetMaterials) {
        for (const sm of mfg.sheetMaterials) {
          console.log('    sheet:', sm.materialName, 'unitCost=' + sm.unitCost, 'total=' + sm.totalCost);
        }
      }
      if (mfg.timberMaterials) {
        for (const tm of mfg.timberMaterials) {
          console.log('    timber:', tm.materialName, 'unitCost=' + tm.unitCost, 'total=' + tm.totalCost, 'method=' + tm.pricingMethod);
        }
      }
    }
    if (proc) {
      console.log('  PROC: unitCost=' + proc.unitCost, 'qty=' + proc.quantity, 'landed=' + proc.totalLandedCost);
    }
    if (mfg === undefined && proc === undefined) {
      console.log('  NO PRICING DATA');
    }
    console.log();
  }

  // Check the latest estimate
  const estSnap = await db.collection('designProjects').doc(projectId)
    .collection('estimates').orderBy('createdAt', 'desc').limit(1).get();

  if (estSnap.empty) {
    console.log('No estimates found');
    process.exit(0);
  }

  const est = estSnap.docs[0].data();
  console.log('=== Latest Estimate ===');
  console.log('Created:', est.createdAt ? new Date(est.createdAt._seconds * 1000).toISOString() : 'N/A');
  console.log('Total:', est.totalCost || est.grandTotal);
  if (est.lineItems) {
    console.log('\n--- Line Items ---');
    for (const li of est.lineItems) {
      console.log('  ', li.name || li.itemName, '| qty:', li.quantity, '| unitCost:', li.unitCost, '| total:', li.totalCost || li.extendedCost);
      console.log('    category:', li.category, '| sourcingType:', li.sourcingType);
    }
  }
  if (est.errorChecks && est.errorChecks.length) {
    console.log('\n--- Error Checks ---');
    for (const ec of est.errorChecks) {
      console.log('  ', ec.itemName, ':', ec.issue);
    }
  }

  process.exit(0);
})();
