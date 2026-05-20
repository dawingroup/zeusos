const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';
  const items = await db.collection('designProjects').doc(projectId).collection('designItems').get();
  for (const i of items.docs) {
    const d = i.data();
    if (d.sourcingType === 'PROCURED' || (d.procurement && d.procurement.totalLandedCost > 0)) {
      console.log('=== PROCURED ITEM ===');
      console.log('ID:', i.id);
      console.log('Code:', d.itemCode);
      console.log('Name:', d.name);
      console.log('sourcingType:', d.sourcingType);
      console.log('requiredQuantity:', d.requiredQuantity);
      if (d.procurement) {
        const p = d.procurement;
        console.log('--- Procurement ---');
        console.log('  unitCost:', p.unitCost);
        console.log('  quantity:', p.quantity);
        console.log('  currency:', p.currency);
        console.log('  exchangeRate:', p.exchangeRate);
        console.log('  targetCurrency:', p.targetCurrency);
        console.log('  totalItemCost:', p.totalItemCost);
        console.log('  totalLogistics:', p.totalLogistics);
        console.log('  totalCustoms:', p.totalCustoms);
        console.log('  grandTotal:', p.grandTotal);
        console.log('  landedCostPerUnit:', p.landedCostPerUnit);
        console.log('  totalLandedCost:', p.totalLandedCost);
        console.log('  vendor:', p.vendor);
      }
      console.log();
    }
  }
  // Also check estimate line items
  const proj = await db.collection('designProjects').doc(projectId).get();
  const est = proj.data().consolidatedEstimate;
  if (est && est.lineItems) {
    console.log('=== ESTIMATE PROCUREMENT LINES ===');
    for (const li of est.lineItems) {
      if (li.category === 'procurement' || li.description?.includes('Procured')) {
        console.log(li.description, '| qty:', li.quantity, '| unitPrice:', li.unitPrice, '| totalPrice:', li.totalPrice);
        if (li.notes) console.log('  notes:', li.notes);
      }
    }
  }
  process.exit(0);
})();
