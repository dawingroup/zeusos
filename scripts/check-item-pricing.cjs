const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  // Find project DF-2026-550
  let projDoc = null;
  let projSnap = await db.collection('designProjects')
    .where('projectNumber', '==', 'DF-2026-550')
    .limit(1)
    .get();

  if (projSnap.empty) {
    projSnap = await db.collection('designProjects')
      .where('code', '==', 'DF-2026-550')
      .limit(1)
      .get();
  }

  if (projSnap.empty) {
    console.log('Project not found. Listing all projects:');
    const all = await db.collection('designProjects').get();
    for (const d of all.docs) {
      const data = d.data();
      console.log(d.id, '|', data.projectNumber || data.code || 'no-code', '|', data.projectName || data.name);
    }
    process.exit(0);
  }

  projDoc = projSnap.docs[0];
  const projectId = projDoc.id;
  const projData = projDoc.data();
  console.log('=== Project ===');
  console.log('ID:', projectId);
  console.log('Name:', projData.projectName || projData.name);
  console.log('Number:', projData.projectNumber || projData.code);
  console.log();

  // Find the design item DF-2026-550-004
  const itemSnap = await db.collection('designProjects').doc(projectId)
    .collection('designItems')
    .where('itemCode', '==', 'DF-2026-550-004')
    .limit(1)
    .get();

  if (itemSnap.empty) {
    console.log('Item DF-2026-550-004 not found. Listing items:');
    const items = await db.collection('designProjects').doc(projectId)
      .collection('designItems').get();
    for (const i of items.docs) {
      const d = i.data();
      console.log(i.id, '|', d.itemCode, '|', d.name, '|', d.sourcingType);
    }
    process.exit(0);
  }

  const item = itemSnap.docs[0];
  const data = item.data();
  console.log('=== Design Item ===');
  console.log('ID:', item.id);
  console.log('Code:', data.itemCode);
  console.log('Name:', data.name);
  console.log('Category:', data.category);
  console.log('SourcingType:', data.sourcingType);
  console.log('CurrentStage:', data.currentStage);
  console.log();

  // Manufacturing costs
  if (data.manufacturing) {
    const mfg = data.manufacturing;
    console.log('=== Manufacturing Costs ===');
    console.log('totalCost:', mfg.totalCost);
    console.log('materialCost:', mfg.materialCost);
    console.log('laborCost:', mfg.laborCost);
    console.log('processingCost:', mfg.processingCost);
    console.log('costPerUnit:', mfg.costPerUnit);
    console.log('quantity:', mfg.quantity);
    console.log('autoCalculated:', mfg.autoCalculated);
    console.log();

    if (mfg.sheetMaterials && mfg.sheetMaterials.length) {
      console.log('--- Sheet Materials ---');
      for (const sm of mfg.sheetMaterials) {
        console.log('  ', sm.materialName, '| thickness:', sm.thickness, '| sheets:', sm.sheetsRequired);
        console.log('    unitCost:', sm.unitCost, '| totalCost:', sm.totalCost, '| area:', sm.totalArea);
      }
    }
    if (mfg.timberMaterials && mfg.timberMaterials.length) {
      console.log('--- Timber Materials ---');
      for (const tm of mfg.timberMaterials) {
        console.log('  ', tm.materialName, '| method:', tm.pricingMethod);
        console.log('    crossSection:', JSON.stringify(tm.crossSection));
        console.log('    vol:', tm.totalVolumeCubicMeters, 'm3 | linear:', tm.totalLinearMeters, 'm');
        console.log('    unitCost:', tm.unitCost, '| totalCost:', tm.totalCost, '| parts:', tm.partsCount);
        console.log('    costUnit:', tm.costUnit);
      }
    }
    if (mfg.linearMaterials && mfg.linearMaterials.length) {
      console.log('--- Linear Materials ---');
      for (const lm of mfg.linearMaterials) {
        console.log('  ', lm.materialName, '| linear:', lm.totalLinearMeters, 'm | unitCost:', lm.unitCost, '| total:', lm.totalCost);
      }
    }
    if (mfg.specialParts && mfg.specialParts.length) {
      console.log('--- Special Parts ---');
      for (const sp of mfg.specialParts) {
        console.log('  ', sp.name, '| qty:', sp.quantity, '| unitCost:', sp.unitCost, '| total:', sp.totalCost);
      }
    }
    if (mfg.standardParts && mfg.standardParts.length) {
      console.log('--- Standard Parts ---');
      for (const sp of mfg.standardParts) {
        console.log('  ', sp.name, '| qty:', sp.quantity, '| unitCost:', sp.unitCost, '| total:', sp.totalCost);
      }
    }
  }

  // Procurement
  if (data.procurement) {
    console.log('=== Procurement Pricing ===');
    console.log(JSON.stringify(data.procurement, null, 2));
  }

  // Now check the project's material palette for comparison
  console.log('\n=== Material Palette (relevant entries) ===');
  const palette = projData.materialPalette;
  if (palette && palette.entries) {
    for (const e of palette.entries) {
      // Show all entries with costs
      if (e.unitCost > 0 || e.inventoryId) {
        console.log('  ', e.designName, '| type:', e.materialType, '| thickness:', e.thickness);
        console.log('    unitCost:', e.unitCost, e.currency || 'UGX', '| inventoryId:', e.inventoryId || 'UNMAPPED');
        console.log('    inventoryName:', e.inventoryName || 'N/A');
        if (e.stockSheets && e.stockSheets.length) {
          for (const ss of e.stockSheets) {
            console.log('    stockSheet:', ss.length, 'x', ss.width, 'x', ss.thickness, '| costPerSheet:', ss.costPerSheet);
          }
        }
        if (e.timberStock && e.timberStock.length) {
          for (const ts of e.timberStock) {
            console.log('    timberStock:', ts.thickness, 'x', ts.width, '| costPerCubicMeter:', ts.costPerCubicMeter, '| costPerLinearMeter:', ts.costPerLinearMeter);
          }
        }
        console.log();
      }
    }
    // Also show unmapped entries
    const unmapped = palette.entries.filter(e => !e.inventoryId && !e.unitCost);
    if (unmapped.length) {
      console.log('--- Unmapped entries (no cost) ---');
      for (const e of unmapped) {
        console.log('  ', e.designName, '| type:', e.materialType, '| thickness:', e.thickness, '| unitCost:', e.unitCost);
      }
    }
  } else {
    console.log('No material palette found on project');
  }

  process.exit(0);
})();
