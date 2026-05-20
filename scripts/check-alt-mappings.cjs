const admin = require('firebase-admin');
if (admin.apps.length === 0) admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projectId = 'yk1FWKjCGA6g9OYkPQ5l';
  const projDoc = await db.collection('designProjects').doc(projectId).get();
  const data = projDoc.data();

  const palette = data.materialPalette;
  if (palette && palette.entries) {
    console.log('=== Palette Entries with Alternatives ===');
    let hasAny = false;
    for (const e of palette.entries) {
      if (e.alternatives && e.alternatives.length > 0) {
        hasAny = true;
        console.log(e.designName, '| alternatives:', JSON.stringify(e.alternatives, null, 2));
      }
    }
    if (hasAny === false) {
      console.log('NO alternatives mapped on any palette entry.');
    }
  }

  // Check consolidatedEstimate
  if (data.consolidatedEstimate) {
    console.log('\n=== Consolidated Estimate ===');
    const est = data.consolidatedEstimate;
    console.log('hasAlternatives:', est.hasAlternatives);
    console.log('lineItems count:', est.lineItems?.length || 0);
    console.log('total:', est.total);
    console.log('subtotal:', est.subtotal);
    if (est.lineItems) {
      for (const li of est.lineItems) {
        console.log('  ', li.name, '| cat:', li.category, '| total:', li.totalPrice, '| linkedItemId:', li.linkedDesignItemId);
      }
    }
  } else {
    console.log('\nNo consolidatedEstimate on project doc');
  }

  // Check alternativeEstimates
  if (data.alternativeEstimates) {
    console.log('\n=== Alternative Estimates ===');
    console.log(JSON.stringify(data.alternativeEstimates, null, 2));
  } else {
    console.log('\nNo alternativeEstimates on project doc');
  }

  process.exit(0);
})();
