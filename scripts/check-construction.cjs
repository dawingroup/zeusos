const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';

  // 1. Fetch all design items
  const items = await db.collection('designProjects').doc(projectId).collection('designItems').get();
  console.log(`=== ALL DESIGN ITEMS (${items.size}) ===\n`);

  for (const doc of items.docs) {
    const d = doc.data();
    const st = d.sourcingType || 'UNKNOWN';
    console.log(`--- ${d.itemCode || doc.id} | ${d.name} | sourcingType=${st} | requiredQuantity=${d.requiredQuantity ?? 'N/A'} ---`);

    if (st === 'CONSTRUCTION') {
      console.log('  [CONSTRUCTION ITEM] Dumping all pricing-related fields:');
      if (d.construction !== undefined) {
        console.log('  construction:', JSON.stringify(d.construction, null, 4));
      } else {
        console.log('  construction: MISSING');
      }
      if (d.constructionPricing !== undefined) {
        console.log('  constructionPricing:', JSON.stringify(d.constructionPricing, null, 4));
      }
      // Dump any other pricing-looking fields
      for (const key of Object.keys(d)) {
        if (/pric|cost|budget|rate|amount|fee|total/i.test(key) && !['construction', 'constructionPricing'].includes(key)) {
          console.log(`  ${key}:`, JSON.stringify(d[key], null, 4));
        }
      }
    }

    if (st === 'MANUFACTURED') {
      const mfg = d.manufacturing;
      if (mfg) {
        console.log('  [MANUFACTURED ITEM]');
        console.log('    manufacturing.totalCost =', mfg.totalCost);
        console.log('    manufacturing.costPerUnit =', mfg.costPerUnit);
        console.log('    manufacturing.quantity =', mfg.quantity);
        console.log('    requiredQuantity =', d.requiredQuantity);
        console.log('    materialCost =', mfg.materialCost, '| laborCost =', mfg.laborCost);
        // Show how these map to estimate line
        const unitCost = mfg.totalCost || mfg.costPerUnit || 0;
        const qty = d.requiredQuantity || 1;
        console.log('    -> Estimate line would be: qty=' + qty + ' x unitPrice=' + unitCost + ' = totalPrice=' + (qty * unitCost));
      } else {
        console.log('  [MANUFACTURED] manufacturing field: MISSING');
      }
    }

    if (st === 'PROCURED') {
      const proc = d.procurement;
      if (proc) {
        console.log('  [PROCURED] unitCost=' + proc.unitCost + ' qty=' + proc.quantity + ' landed=' + proc.totalLandedCost);
      } else {
        console.log('  [PROCURED] procurement field: MISSING');
      }
    }

    if (st === 'DESIGN_DOCUMENT' || st === 'ARCHITECTURAL') {
      const arch = d.architectural;
      if (arch) {
        console.log('  [DESIGN_DOCUMENT] architectural:', JSON.stringify(arch, null, 4));
      } else {
        console.log('  [DESIGN_DOCUMENT] architectural field: MISSING');
      }
    }

    console.log();
  }

  // 2. Fetch the latest estimate
  const estSnap = await db.collection('designProjects').doc(projectId)
    .collection('estimates').orderBy('createdAt', 'desc').limit(1).get();

  if (estSnap.empty) {
    console.log('No estimates found');
    process.exit(0);
  }

  const est = estSnap.docs[0].data();
  console.log('=== LATEST ESTIMATE ===');
  console.log('ID:', estSnap.docs[0].id);
  console.log('Created:', est.createdAt ? new Date(est.createdAt._seconds * 1000).toISOString() : 'N/A');
  console.log('Grand Total:', est.grandTotal ?? est.totalCost ?? 'N/A');
  console.log('Budget Tier:', est.budgetTier ?? 'N/A');
  console.log('Tier Multiplier:', est.tierMultiplier ?? 'N/A');

  if (est.lineItems && est.lineItems.length) {
    console.log(`\n--- ALL ESTIMATE LINE ITEMS (${est.lineItems.length}) ---`);
    for (const li of est.lineItems) {
      console.log(`  ${li.description || li.name || li.itemName}`);
      console.log(`    category=${li.category} | quantity=${li.quantity} | unitPrice=${li.unitPrice} | totalPrice=${li.totalPrice ?? li.extendedCost ?? li.totalCost}`);
      if (li.unit) console.log(`    unit=${li.unit}`);
      if (li.linkedDesignItemId) console.log(`    linkedDesignItemId=${li.linkedDesignItemId}`);
      if (li.notes) console.log(`    notes=${li.notes}`);
      if (li.sourcingType) console.log(`    sourcingType=${li.sourcingType}`);
      console.log();
    }
  } else {
    console.log('\nNo lineItems array on estimate');
    // Dump top-level keys in case structure differs
    console.log('Estimate top-level keys:', Object.keys(est));
  }

  if (est.summary) {
    console.log('--- ESTIMATE SUMMARY ---');
    console.log(JSON.stringify(est.summary, null, 2));
  }

  if (est.errorChecks && est.errorChecks.length) {
    console.log('\n--- ERROR CHECKS ---');
    for (const ec of est.errorChecks) {
      console.log('  ', ec.itemName || ec.itemId, ':', ec.issue);
    }
  }

  process.exit(0);
})();
