const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';
  const projDoc = await db.collection('designProjects').doc(projectId).get();
  if (!projDoc.exists) { console.log('Project not found'); process.exit(1); }
  const projData = projDoc.data();

  // 1. Palette entries with alternatives
  const palette = projData.materialPalette;
  if (palette && palette.entries) {
    console.log('=== PALETTE ENTRIES WITH ALTERNATIVES ===\n');
    for (const e of palette.entries) {
      if (e.alternatives && e.alternatives.length > 0) {
        console.log('Entry:', e.designName, '| type:', e.materialType, '| thickness:', e.thickness);
        console.log('  unitCost:', e.unitCost, '| costUnit:', e.costUnit || 'MISSING');
        console.log('  inventoryId:', e.inventoryId);
        if (e.stockSheets) {
          for (const ss of e.stockSheets) {
            console.log('  stockSheet:', ss.length, 'x', ss.width, '| costPerSheet:', ss.costPerSheet);
          }
        }
        for (const alt of e.alternatives) {
          console.log('  ALT:', alt.qualityTier, '|', alt.inventoryName, '| unitCost:', alt.unitCost, '| costUnit:', alt.costUnit || 'MISSING', '| inventoryId:', alt.inventoryId);
        }
        console.log();
      }
    }
  }

  // 2. Standard estimate material line items
  const est = projData.consolidatedEstimate;
  if (est && est.lineItems) {
    console.log('=== STANDARD ESTIMATE MATERIAL LINE ITEMS ===\n');
    for (const li of est.lineItems) {
      if (li.category === 'material') {
        console.log(li.description || li.name, '| unitPrice:', li.unitPrice, '| totalPrice:', li.totalPrice, '| linkedId:', li.linkedDesignItemId);
      }
    }
    console.log('\nStandard total:', est.total, '| subtotal:', est.subtotal);
    console.log();
  }

  // 3. Alternative estimates
  const altEst = projData.alternativeEstimates;
  if (altEst && altEst.alternatives) {
    console.log('=== ALTERNATIVE ESTIMATES ===\n');
    for (const alt of altEst.alternatives) {
      console.log('Tier:', alt.qualityTier, '|', alt.tierLabel, '| total:', alt.total, '| delta:', alt.deltaFromStandard, '(', alt.deltaPercent, '%)');
      if (alt.substitutions) {
        for (const sub of alt.substitutions) {
          console.log('  SUB:', sub.originalMaterialName, '→', sub.alternativeMaterialName);
          console.log('    origUnitCost:', sub.originalUnitCost, '| altUnitCost:', sub.alternativeUnitCost, '| costDelta:', sub.costDelta);
        }
      }
      if (alt.lineItems) {
        for (const li of alt.lineItems) {
          if (li.category === 'material') {
            console.log('  LINE:', li.description || li.name, '| unitPrice:', li.unitPrice, '| totalPrice:', li.totalPrice);
          }
        }
      }
      console.log();
    }
  }

  // 4. Look up the inventory items
  const inventoryIds = new Set();
  if (palette && palette.entries) {
    for (const e of palette.entries) {
      if (e.inventoryId) inventoryIds.add(e.inventoryId);
      if (e.alternatives) {
        for (const alt of e.alternatives) {
          if (alt.inventoryId) inventoryIds.add(alt.inventoryId);
        }
      }
    }
  }

  console.log('=== INVENTORY ITEMS ===\n');
  for (const invId of inventoryIds) {
    const invDoc = await db.collection('inventoryItems').doc(invId).get();
    if (invDoc.exists) {
      const inv = invDoc.data();
      console.log('ID:', invId, '| Name:', inv.name);
      console.log('  pricing.costPerUnit:', inv.pricing?.costPerUnit, '| pricing.unit:', inv.pricing?.unit);
      console.log();
    }
  }

  // 5. Check the granite design item manufacturing data
  const itemsSnap = await db.collection('designProjects').doc(projectId).collection('designItems').get();
  console.log('=== GRANITE ITEM MANUFACTURING ===\n');
  for (const i of itemsSnap.docs) {
    const d = i.data();
    if (d.itemCode === 'DF-2026-550-002' || (d.name && d.name.toLowerCase().includes('granit'))) {
      console.log('Item:', d.itemCode, '|', d.name);
      const mfg = d.manufacturing;
      if (mfg) {
        console.log('  totalCost:', mfg.totalCost, '| materialCost:', mfg.materialCost);
        if (mfg.sheetMaterials) {
          for (const sm of mfg.sheetMaterials) {
            console.log('  SHEET:', sm.materialName, '| thickness:', sm.thickness);
            console.log('    unitCost:', sm.unitCost, '| totalCost:', sm.totalCost);
            console.log('    totalArea:', sm.totalArea, 'm² | sheetsRequired:', sm.sheetsRequired, '| partsCount:', sm.partsCount);
          }
        }
      }
    }
  }

  process.exit(0);
})();
