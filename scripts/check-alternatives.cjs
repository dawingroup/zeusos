const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l'; // DF-2026-550

  const projDoc = await db.collection('designProjects').doc(projectId).get();
  const data = projDoc.data();
  const palette = data.materialPalette;

  console.log('=== Palette Entries with Alternatives ===\n');
  for (const e of (palette.entries || [])) {
    console.log(e.designName, '| type:', e.materialType, '| thickness:', e.thickness);
    console.log('  unitCost:', e.unitCost, '| inventoryName:', e.inventoryName);
    if (e.stockSheets && e.stockSheets.length) {
      for (const ss of e.stockSheets) {
        console.log('  stockSheet:', ss.length, 'x', ss.width, 'x', ss.thickness, '| costPerSheet:', ss.costPerSheet);
      }
    }
    if (e.alternatives && e.alternatives.length) {
      console.log('  ALTERNATIVES:');
      for (const alt of e.alternatives) {
        console.log('    tier:', alt.qualityTier, '| inventoryName:', alt.inventoryName, '| unitCost:', alt.unitCost, '| inventoryId:', alt.inventoryId);
      }
    }
    console.log();
  }

  // Check existing alternative estimates
  const altEst = data.alternativeEstimates;
  if (altEst) {
    console.log('=== Alternative Estimates ===');
    console.log('isStale:', altEst.isStale);
    console.log('Generated:', altEst.generatedAt);
    for (const alt of (altEst.alternatives || [])) {
      console.log('\n--- Tier:', alt.qualityTier, '(' + alt.tierLabel + ') ---');
      console.log('total:', alt.total, '| subtotal:', alt.subtotal);
      console.log('deltaFromStandard:', alt.deltaFromStandard, '| deltaPercent:', alt.deltaPercent + '%');
      console.log('substitutions:');
      for (const s of (alt.substitutions || [])) {
        console.log('  ', s.originalMaterialName, '->', s.alternativeMaterialName);
        console.log('    origCost:', s.originalUnitCost, '| altCost:', s.alternativeUnitCost, '| delta:', s.costDelta);
        console.log('    affected items:', s.affectedDesignItemIds.length);
      }
      console.log('line items:');
      for (const li of (alt.lineItems || [])) {
        console.log('  ', li.description, '| unitPrice:', li.unitPrice, '| qty:', li.quantity, '| totalPrice:', li.totalPrice);
        console.log('    category:', li.category, '| linkedDesignItemId:', li.linkedDesignItemId);
      }
    }
  } else {
    console.log('No alternative estimates generated yet');
  }

  // Standard estimate
  const est = data.consolidatedEstimate;
  if (est) {
    console.log('\n=== Standard Estimate ===');
    console.log('total:', est.total, '| subtotal:', est.subtotal, '| isStale:', est.isStale);
    for (const li of (est.lineItems || [])) {
      console.log('  ', li.description, '| unitPrice:', li.unitPrice, '| qty:', li.quantity, '| totalPrice:', li.totalPrice);
      console.log('    category:', li.category);
    }
  }

  // Check the manufacturing data for each design item
  const items = await db.collection('designProjects').doc(projectId).collection('designItems').get();
  console.log('\n=== Design Items Manufacturing ===');
  for (const i of items.docs) {
    const d = i.data();
    const mfg = d.manufacturing;
    if (mfg) {
      console.log('\n' + d.itemCode, d.name);
      console.log('  materialCost:', mfg.materialCost);
      console.log('  laborCost:', mfg.laborCost);
      console.log('  standardPartsCost:', mfg.standardPartsCost);
      console.log('  specialPartsCost:', mfg.specialPartsCost);
      console.log('  processingCost:', mfg.processingCost);
      console.log('  totalCost:', mfg.totalCost);
      console.log('  sheetMaterialsCost:', mfg.sheetMaterialsCost);
      console.log('  timberMaterialsCost:', mfg.timberMaterialsCost);
      console.log('  linearMaterialsCost:', mfg.linearMaterialsCost);
      if (mfg.sheetMaterials) {
        for (const sm of mfg.sheetMaterials) {
          console.log('    sheet:', sm.materialName, '| unitCost:', sm.unitCost, '| total:', sm.totalCost, '| area:', sm.totalArea, 'm2 | sheets:', sm.sheetsRequired);
        }
      }
      if (mfg.linearMaterials) {
        for (const lm of mfg.linearMaterials) {
          console.log('    linear:', lm.materialName, '| unitCost:', lm.unitCost, '| total:', lm.totalCost, '| meters:', lm.totalLinearMeters);
        }
      }
    }
  }

  process.exit(0);
})();
