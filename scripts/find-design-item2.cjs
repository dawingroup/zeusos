const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  // Check possible collections for design items
  const collections = ['designItems', 'designProducts', 'products', 'projectItems'];
  
  for (const coll of collections) {
    try {
      const snap = await db.collection(coll).limit(1).get();
      if (snap.size > 0) {
        console.log('Collection', coll, 'exists, size sample:', snap.size);
      }
    } catch(e) {}
  }

  // Search all design projects for item numbering patterns
  const projSnap = await db.collection('designProjects').get();
  console.log('\nTotal design projects:', projSnap.size);
  
  // Check first project structure to understand schema
  if (projSnap.size > 0) {
    const first = projSnap.docs[0];
    const data = first.data();
    console.log('\nSample project keys:', Object.keys(data).join(', '));
    
    // List subcollections
    const subcolls = await first.ref.listCollections();
    console.log('Subcollections:', subcolls.map(c => c.id).join(', '));
  }

  // Check all projects for any subcollection that might have design items
  for (const d of projSnap.docs) {
    const subcolls = await d.ref.listCollections();
    for (const sc of subcolls) {
      if (sc.id !== 'estimates' && sc.id !== 'versions') {
        const items = await sc.get();
        if (items.size > 0) {
          console.log('\nProject', d.id, '(' + (d.data().projectName || 'unnamed') + ') has subcollection:', sc.id, 'with', items.size, 'docs');
          // Check for DF-2026-940
          for (const item of items.docs) {
            const iStr = JSON.stringify(item.data());
            if (iStr.includes('DF-2026-940') || iStr.includes('940-001')) {
              console.log('  MATCH:', item.id, iStr.substring(0, 500));
            }
          }
        }
      }
    }
  }

  // Also search within project doc fields for itemNumber patterns like DF-
  for (const d of projSnap.docs) {
    const data = d.data();
    // Check items array
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      console.log('\nProject', d.id, 'has items[] array with', data.items.length, 'entries');
      console.log('  Sample item keys:', Object.keys(data.items[0]).join(', '));
      // Check for numbering
      for (const item of data.items) {
        if (item.itemNumber || item.designItemNumber || item.sku) {
          console.log('  Item:', item.itemNumber || item.designItemNumber || item.sku, '|', item.name || item.description);
        }
      }
    }
  }

  process.exit(0);
})();
