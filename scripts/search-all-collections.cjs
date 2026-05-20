const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });

const db = admin.firestore();

async function searchAllCollections() {
  console.log('=== Searching All Collections for BOQ Data ===\n');

  const collectionsToCheck = [
    'control_boq',
    'boq_items',
    'matflow_boq_items',
    'parsed_boq_items',
    'boq_drafts',
    'parsing_jobs'
  ];

  for (const collectionName of collectionsToCheck) {
    try {
      const snapshot = await db.collection(collectionName).limit(5).get();
      console.log(`${collectionName}: ${snapshot.size} documents`);

      if (snapshot.size > 0) {
        const firstDoc = snapshot.docs[0];
        const data = firstDoc.data();
        console.log(`  Sample keys: ${Object.keys(data).join(', ')}`);
        if (data.status) console.log(`  Sample status: ${data.status}`);
        if (data.projectId) console.log(`  Sample projectId: ${data.projectId}`);
        console.log('');
      }
    } catch (err) {
      console.log(`${collectionName}: Collection not found or error`);
    }
  }

  // Check matflow module
  console.log('\n--- MatFlow Module ---');
  const matflowProjects = await db.collection('matflow_projects').limit(3).get();
  console.log(`matflow_projects: ${matflowProjects.size} documents`);

  if (matflowProjects.size > 0) {
    for (const projDoc of matflowProjects.docs) {
      const projData = projDoc.data();
      console.log(`\n  Project: ${projData.name || projDoc.id}`);

      // Check for BOQ subcollection
      const boqItems = await db.collection('matflow_projects')
        .doc(projDoc.id)
        .collection('boq_items')
        .limit(5)
        .get();

      console.log(`    boq_items subcollection: ${boqItems.size} items`);

      if (boqItems.size > 0) {
        const sample = boqItems.docs[0].data();
        console.log(`    Sample status: ${sample.status || 'N/A'}`);
        console.log(`    Sample description: ${(sample.description || '').substring(0, 50)}...`);
      }
    }
  }

  process.exit(0);
}

searchAllCollections().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
