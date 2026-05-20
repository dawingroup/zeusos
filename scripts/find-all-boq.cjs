const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });

const db = admin.firestore();

async function findAllBOQ() {
  console.log('=== Finding ALL BOQ Items in Database ===\n');

  // Search control_boq collection (root level)
  console.log('Searching root collection: control_boq');
  const rootBOQ = await db.collection('control_boq').limit(50).get();

  console.log(`Found ${rootBOQ.size} items in root control_boq collection\n`);

  if (rootBOQ.size > 0) {
    // Group by projectId
    const byProject = {};
    rootBOQ.docs.forEach(doc => {
      const data = doc.data();
      const projId = data.projectId || 'NO_PROJECT_ID';
      if (!byProject[projId]) {
        byProject[projId] = {
          items: [],
          statuses: {}
        };
      }
      byProject[projId].items.push(data);

      const status = data.status || 'unknown';
      byProject[projId].statuses[status] = (byProject[projId].statuses[status] || 0) + 1;
    });

    console.log('BOQ Items grouped by Project:');
    console.log('─'.repeat(60));

    for (const [projId, info] of Object.entries(byProject)) {
      console.log(`\nProject ID: ${projId}`);
      console.log(`  Total Items: ${info.items.length}`);
      console.log(`  Status breakdown:`);
      Object.entries(info.statuses).forEach(([status, count]) => {
        console.log(`    - ${status}: ${count} items`);
      });

      // Show first item details
      const firstItem = info.items[0];
      console.log(`\n  Sample item:`);
      console.log(`    - Description: ${firstItem.description || 'N/A'}`);
      console.log(`    - Item Code: ${firstItem.itemCode || firstItem.itemNumber || 'N/A'}`);
      console.log(`    - Qty Contract: ${firstItem.quantityContract || 0}`);
      console.log(`    - Qty Remaining: ${firstItem.quantityRemaining || firstItem.quantityContract || 0}`);
      console.log(`    - Status: ${firstItem.status || 'unknown'}`);
    }
  }

  // Also check for BOQ items in subcollections
  console.log('\n' + '='.repeat(60));
  console.log('\nSearching for BOQ subcollections under projects...');

  const projects = await db.collection('projects').limit(5).get();

  for (const projectDoc of projects.docs) {
    const boqSubcol = await db.collection('projects')
      .doc(projectDoc.id)
      .collection('boq_items')
      .limit(5)
      .get();

    if (boqSubcol.size > 0) {
      console.log(`\nFound ${boqSubcol.size} items in projects/${projectDoc.id}/boq_items`);
    }
  }

  process.exit(0);
}

findAllBOQ().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
