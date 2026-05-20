const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });

const db = admin.firestore();

async function checkBOQStatus() {
  console.log('=== Checking BOQ Status Across All Projects ===\n');

  // Get all projects
  const projectsSnapshot = await db.collection('projects').limit(5).get();

  for (const projectDoc of projectsSnapshot.docs) {
    const projectId = projectDoc.id;
    const projectData = projectDoc.data();

    console.log(`\nProject: ${projectData.name} (${projectId})`);
    console.log('─'.repeat(60));

    // Check control_boq items
    const boqSnapshot = await db.collection('control_boq')
      .where('projectId', '==', projectId)
      .limit(10)
      .get();

    console.log(`Total BOQ items: ${boqSnapshot.size}`);

    if (boqSnapshot.size > 0) {
      // Group by status
      const statusGroups = {};
      boqSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'unknown';
        if (!statusGroups[status]) {
          statusGroups[status] = [];
        }
        statusGroups[status].push(data);
      });

      console.log('\nBOQ Items by Status:');
      Object.keys(statusGroups).forEach(status => {
        console.log(`  ${status}: ${statusGroups[status].length} items`);
      });

      // Check Control BOQ document (metadata)
      const controlBoqDoc = await db.collection('projects')
        .doc(projectId)
        .collection('control_boq')
        .doc('main')
        .get();

      if (controlBoqDoc.exists) {
        const boqMeta = controlBoqDoc.data();
        console.log('\nControl BOQ Metadata:');
        console.log(`  Status: ${boqMeta.status || 'N/A'}`);
        console.log(`  Approval Status: ${boqMeta.approvalStatus || 'N/A'}`);
        console.log(`  Total Items: ${boqMeta.totalItems || 'N/A'}`);
        console.log(`  Approved By: ${boqMeta.approvedBy || 'N/A'}`);
        console.log(`  Approved At: ${boqMeta.approvedAt ? new Date(boqMeta.approvedAt._seconds * 1000).toISOString() : 'N/A'}`);
      } else {
        console.log('\n⚠️  No Control BOQ metadata document found');
        console.log('   Path: projects/{projectId}/control_boq/main');
      }

      // Show sample items
      console.log('\nSample BOQ Items (first 3):');
      boqSnapshot.docs.slice(0, 3).forEach((doc, i) => {
        const data = doc.data();
        console.log(`\n  ${i + 1}. ${data.description || 'No description'}`);
        console.log(`     - Status: ${data.status}`);
        console.log(`     - Item Code: ${data.itemCode || data.itemNumber}`);
        console.log(`     - Qty Contract: ${data.quantityContract}`);
        console.log(`     - Qty Remaining: ${data.quantityRemaining || data.quantityContract}`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\nNOTE: For BOQ items to be available for requisitioning:');
  console.log('1. Control BOQ metadata status should be "approved"');
  console.log('2. Individual BOQ items status can be "pending" or higher');
  console.log('3. Items with quantityRemaining > 0 are available');

  process.exit(0);
}

checkBOQStatus().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
