const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PROJECT_ID = '99TwyG3M2GKkUlyfw0Gw';
const ITEM_ID = '5hIkirvKk4EyTU7g98Xt';
const CORRECT_CBM_PRICE = 2700000;

(async () => {
  console.log('=== Recalculating Timber Costs for DF-2026-940-001 ===\n');

  const itemRef = db.collection('designProjects').doc(PROJECT_ID)
    .collection('designItems').doc(ITEM_ID);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const mfg = item.manufacturing;

  if (!mfg || !mfg.timberMaterials) {
    console.log('No manufacturing/timber data found');
    process.exit(1);
  }

  console.log('Current timber cost: UGX', mfg.timberMaterialsCost.toLocaleString());
  console.log('Timber entries:', mfg.timberMaterials.length, '\n');

  let newTimberTotal = 0;
  const updatedTimber = mfg.timberMaterials.map((tm) => {
    const vol = tm.totalVolumeCubicMeters;
    const oldCost = tm.totalCost;
    const oldUnitCost = tm.unitCost;

    // Recalculate with correct price
    const newTotalCost = Math.round(vol * CORRECT_CBM_PRICE);
    newTimberTotal += newTotalCost;

    console.log(tm.materialName, '(' + tm.crossSection.thickness + 'x' + tm.crossSection.width + ')');
    console.log('  Volume:', vol, 'm³ |', tm.totalLinearMeters, 'lm | qty:', tm.partsCount, 'parts');
    console.log('  Old: ' + oldUnitCost.toLocaleString() + '/m³ → UGX', oldCost.toLocaleString());
    console.log('  New: ' + CORRECT_CBM_PRICE.toLocaleString() + '/m³ → UGX', newTotalCost.toLocaleString());
    console.log();

    return {
      ...tm,
      unitCost: CORRECT_CBM_PRICE,
      totalCost: newTotalCost,
    };
  });

  // Recalculate total manufacturing cost
  const oldTotal = mfg.costPerUnit;
  const timberDelta = newTimberTotal - mfg.timberMaterialsCost;
  const newMfgTotal = oldTotal + timberDelta;

  console.log('--- Summary ---');
  console.log('Timber cost: UGX', mfg.timberMaterialsCost.toLocaleString(), '→ UGX', newTimberTotal.toLocaleString(), '(+' + timberDelta.toLocaleString() + ')');
  console.log('Material cost:', mfg.materialCost.toLocaleString(), '→', (mfg.materialCost + timberDelta).toLocaleString());
  console.log('Total mfg cost: UGX', oldTotal.toLocaleString(), '→ UGX', newMfgTotal.toLocaleString());
  console.log();

  // Update design item
  await itemRef.update({
    'manufacturing.timberMaterials': updatedTimber,
    'manufacturing.timberMaterialsCost': newTimberTotal,
    'manufacturing.materialCost': mfg.materialCost + timberDelta,
    'manufacturing.costPerUnit': newMfgTotal,
    'manufacturing.totalCost': newMfgTotal * (mfg.quantity || 1),
    'manufacturing.lastAutoCalcAt': FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log('✓ Design item manufacturing costs updated\n');

  // Also update the consolidated estimate line item
  const projRef = db.collection('designProjects').doc(PROJECT_ID);
  const projSnap = await projRef.get();
  const proj = projSnap.data();

  if (proj.consolidatedEstimate && proj.consolidatedEstimate.lineItems) {
    const lineItems = proj.consolidatedEstimate.lineItems.map((li) => {
      if (li.linkedDesignItemId === ITEM_ID) {
        const newUnitPrice = newMfgTotal;
        console.log('Updating consolidated estimate line:');
        console.log('  Old unitPrice:', li.unitPrice.toLocaleString());
        console.log('  New unitPrice:', newUnitPrice.toLocaleString());
        return {
          ...li,
          unitPrice: newUnitPrice,
          totalPrice: newUnitPrice * li.quantity,
          notes: 'Sheets: ' + mfg.sheetMaterialsCost.toLocaleString() +
            ' | Timber: ' + newTimberTotal.toLocaleString() +
            ' | Edging: ' + mfg.edgingMaterialsCost.toLocaleString() +
            ' | Std Parts: ' + mfg.standardPartsCost.toLocaleString() +
            ' | Spc Parts: ' + (mfg.specialPartsCost || 0).toLocaleString() +
            ' | Processing: ' + mfg.processingCost.toLocaleString() +
            ' | Labor: ' + mfg.laborCost.toLocaleString(),
        };
      }
      return li;
    });

    const subtotal = lineItems.reduce((s, li) => s + li.totalPrice, 0);
    const overheadPercent = proj.consolidatedEstimate.overheadPercent || 0.1;
    const marginPercent = proj.consolidatedEstimate.marginPercent || 0.45;
    const overheadAmount = Math.round(subtotal * overheadPercent);
    const marginAmount = Math.round(subtotal * marginPercent);
    const taxRate = proj.consolidatedEstimate.taxRate || 0.18;
    const preTax = subtotal + overheadAmount + marginAmount;
    const taxAmount = Math.round(preTax * taxRate);
    const total = preTax + taxAmount;

    await projRef.update({
      'consolidatedEstimate.lineItems': lineItems,
      'consolidatedEstimate.subtotal': subtotal,
      'consolidatedEstimate.overheadAmount': overheadAmount,
      'consolidatedEstimate.marginAmount': marginAmount,
      'consolidatedEstimate.taxAmount': taxAmount,
      'consolidatedEstimate.total': total,
      'consolidatedEstimate.generatedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('\n✓ Consolidated estimate updated');
    console.log('  New subtotal: UGX', subtotal.toLocaleString());
    console.log('  + Overhead (10%):', overheadAmount.toLocaleString());
    console.log('  + Margin (45%):', marginAmount.toLocaleString());
    console.log('  + VAT (18%):', taxAmount.toLocaleString());
    console.log('  = Total: UGX', total.toLocaleString());
  }

  console.log('\n=== Done ===');
  process.exit(0);
})();
