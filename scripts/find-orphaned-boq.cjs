const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });

const db = admin.firestore();

async function findOrphanedBOQ() {
  console.log('=== Finding BOQ Data (Including Orphaned) ===\n');

  // Check all possible collections
  const collections = [
    'control_boq',
    'boq_items',
    'matflow_boq_items',
    'delivery_boq_items',
    'parsed_boq_items'
  ];

  console.log('Searching all BOQ-related collections...\n');

  for (const collName of collections) {
    try {
      const snapshot = await db.collection(collName).get();

      if (snapshot.size > 0) {
        console.log(`✅ Found ${snapshot.size} documents in: ${collName}`);

        // Group by projectId
        const byProject = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const pid = data.projectId || 'NO_PROJECT_ID';
          if (!byProject[pid]) byProject[pid] = [];
          byProject[pid].push(doc.id);
        });

        console.log('   Project IDs found:');
        Object.keys(byProject).forEach(pid => {
          console.log(`   - ${pid}: ${byProject[pid].length} items`);
        });

        // Show sample
        const firstDoc = snapshot.docs[0];
        const data = firstDoc.data();
        console.log('   Sample data keys:', Object.keys(data).slice(0, 10).join(', '));
        console.log('');
      }
    } catch (err) {
      // Collection doesn't exist
    }
  }

  // Check delivery projects
  console.log('\n--- Checking Delivery Projects ---');
  const deliveryProjects = await db.collection('projects').get();
  console.log(`Found ${deliveryProjects.size} projects in 'projects' collection\n`);

  deliveryProjects.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.name || 'Unnamed'}`);
  });

  // Check if project 1SYtiViKF4T98wbUEiHo exists anywhere
  console.log('\n--- Searching for project: 1SYtiViKF4T98wbUEiHo ---');
  const targetProject = await db.collection('projects').doc('1SYtiViKF4T98wbUEiHo').get();

  if (targetProject.exists) {
    console.log('✅ Project exists!');
    console.log('   Name:', targetProject.data().name);
  } else {
    console.log('❌ Project does NOT exist in projects collection');

    // Check if it exists in other collections
    const otherCollections = ['matflow_projects', 'delivery_projects', 'archived_projects'];
    for (const coll of otherCollections) {
      try {
        const doc = await db.collection(coll).doc('1SYtiViKF4T98wbUEiHo').get();
        if (doc.exists) {
          console.log(`✅ Found in ${coll} collection!`);
          console.log('   Name:', doc.data().name);
        }
      } catch (err) {
        // Collection doesn't exist
      }
    }
  }

  // Check subcollections under the project
  console.log('\n--- Checking subcollections for 1SYtiViKF4T98wbUEiHo ---');
  const subcollections = ['boq_items', 'control_boq', 'requisitions'];

  for (const subcoll of subcollections) {
    try {
      const snapshot = await db.collection('projects')
        .doc('1SYtiViKF4T98wbUEiHo')
        .collection(subcoll)
        .limit(5)
        .get();

      if (snapshot.size > 0) {
        console.log(`✅ Found ${snapshot.size} items in projects/1SYtiViKF4T98wbUEiHo/${subcoll}`);
      }
    } catch (err) {
      // Subcollection doesn't exist
    }
  }

  process.exit(0);
}

findOrphanedBOQ().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
