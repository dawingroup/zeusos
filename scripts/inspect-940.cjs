const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const PROJECT_ID = '99TwyG3M2GKkUlyfw0Gw';
const ITEM_ID = '5hIkirvKk4EyTU7g98Xt';

(async () => {
  // 1. Get design item
  const itemSnap = await db.collection('designProjects').doc(PROJECT_ID)
    .collection('designItems').doc(ITEM_ID).get();
  const item = itemSnap.data();
  console.log('=== Design Item DF-2026-940-001 ===');
  console.log(JSON.stringify(item, null, 2));

  // 2. Get project with palette
  const projSnap = await db.collection('designProjects').doc(PROJECT_ID).get();
  const proj = projSnap.data();
  
  console.log('\n=== Project Material Palette ===');
  const entries = proj.materialPalette?.entries || [];
  for (const e of entries) {
    console.log('\nEntry:', e.designName || e.normalizedName);
    console.log('  materialType:', e.materialType);
    console.log('  unitCost:', e.unitCost);
    console.log('  currency:', e.currency);
    console.log('  thickness:', e.thickness);
    if (e.timberStock) console.log('  timberStock:', JSON.stringify(e.timberStock));
    if (e.linearStock) console.log('  linearStock:', JSON.stringify(e.linearStock));
    if (e.stockSheets) console.log('  stockSheets:', JSON.stringify(e.stockSheets));
  }

  // 3. Get consolidated estimate
  console.log('\n=== Consolidated Estimate ===');
  if (proj.consolidatedEstimate) {
    const est = proj.consolidatedEstimate;
    console.log(JSON.stringify(est, null, 2).substring(0, 5000));
  } else {
    console.log('No consolidatedEstimate on project doc');
  }

  // 4. Check estimates subcollection
  const estSnap = await db.collection('designProjects').doc(PROJECT_ID)
    .collection('estimates').get();
  console.log('\nEstimates subcollection:', estSnap.size, 'docs');

  // 5. Check item-level estimate data
  if (item.estimate || item.latestEstimate || item.costEstimate) {
    console.log('\n=== Item-Level Estimate ===');
    console.log(JSON.stringify(item.estimate || item.latestEstimate || item.costEstimate, null, 2));
  }

  // 6. Check consolidated cutlist for timber parts
  if (proj.consolidatedCutlist) {
    const cl = proj.consolidatedCutlist;
    console.log('\n=== Consolidated Cutlist (timber parts) ===');
    const timberParts = (cl.parts || cl.timberParts || []).filter(p => 
      (p.materialType || '').toUpperCase() === 'TIMBER' || (p.material || '').toLowerCase().includes('mahogany')
    );
    if (timberParts.length > 0) {
      console.log(JSON.stringify(timberParts, null, 2).substring(0, 3000));
    } else {
      console.log('No timber parts in cutlist. Checking all parts...');
      const allParts = cl.parts || [];
      console.log('Total parts:', allParts.length);
      // Show material types
      const types = {};
      for (const p of allParts) {
        const mt = p.materialType || p.material || 'unknown';
        types[mt] = (types[mt] || 0) + 1;
      }
      console.log('Material types:', JSON.stringify(types));
      // Show timber/mahogany parts
      for (const p of allParts) {
        if ((p.material || '').toLowerCase().includes('mahogany') || 
            (p.material || '').toLowerCase().includes('timber') ||
            (p.materialType || '').toUpperCase() === 'TIMBER') {
          console.log('  Part:', p.name || p.partName, '| material:', p.material, '| dims:', p.length, 'x', p.width, 'x', p.thickness);
        }
      }
    }
  }

  process.exit(0);
})();
