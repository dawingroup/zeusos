const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  const projSnap = await db.collection('designProjects').get();
  
  for (const d of projSnap.docs) {
    const data = d.data();
    const str = JSON.stringify(data);
    if (str.includes('DF-2026-940-001')) {
      console.log('=== Found in project:', d.id, '===');
      console.log('Name:', data.projectName || data.name);
      
      // Check design items / line items
      const items = data.designItems || data.items || data.lineItems || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (JSON.stringify(item).includes('DF-2026-940-001')) {
            console.log('\nMatching item:', JSON.stringify(item, null, 2).substring(0, 3000));
          }
        }
      }
      
      // Check all top-level keys for the reference
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === 'string' && val.includes('DF-2026-940-001')) {
          console.log('\nFound in field:', key, '=', val.substring(0, 200));
        }
        if (Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            if (JSON.stringify(val[i]).includes('DF-2026-940-001')) {
              console.log('\nFound in', key + '[' + i + ']');
            }
          }
        }
      }
    }
  }

  // Also check subcollections: designItems
  for (const d of projSnap.docs) {
    const itemsSnap = await d.ref.collection('designItems').get();
    for (const item of itemsSnap.docs) {
      const iData = item.data();
      if (item.id.includes('DF-2026-940') || (iData.itemNumber || '').includes('DF-2026-940') || (iData.designItemNumber || '').includes('DF-2026-940')) {
        console.log('\n=== Found as subcollection designItem ===');
        console.log('Project:', d.id, d.data().projectName);
        console.log('Item ID:', item.id);
        console.log('Item data:', JSON.stringify(iData, null, 2).substring(0, 5000));
      }
    }
  }

  process.exit(0);
})();
