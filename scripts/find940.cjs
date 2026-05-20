const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

(async () => {
  // Check quotes
  const qSnap = await db.collection('clientQuotes').where('quoteNumber', '==', 'DF-2026-940-001').limit(1).get();
  if (qSnap.size > 0) {
    const q = qSnap.docs[0].data();
    console.log('Found as quote:', qSnap.docs[0].id);
    console.log('Project:', q.projectName, '| projectId:', q.projectId);
  }

  // Search across collections
  for (const coll of ['clientQuotes', 'deals', 'salesOrders']) {
    const allSnap = await db.collection(coll).get();
    for (const d of allSnap.docs) {
      const data = d.data();
      const str = JSON.stringify(data);
      if (str.includes('940-001') || str.includes('DF-2026-940')) {
        console.log('Found in', coll, ':', d.id);
        console.log('  Ref:', data.quoteNumber || data.orderNumber || data.dealNumber || data.projectNumber || 'N/A');
        console.log('  Name:', data.projectName || data.name || data.title || 'N/A');
        console.log('  projectId:', data.projectId || data.designProjectId || 'N/A');
      }
    }
  }

  // Check within project names/refs for 940
  const projSnap = await db.collection('designProjects').get();
  for (const d of projSnap.docs) {
    const data = d.data();
    const str = JSON.stringify(data).substring(0, 5000);
    if (str.includes('940')) {
      console.log('\nProject with 940:', d.id, '|', data.projectName);
    }
  }

  process.exit(0);
})();
