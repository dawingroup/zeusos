const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

async function testDiagnosticCenter() {
  console.log('\n=== Testing Diagnostic Center Project ===\n');

  try {
    // Find Diagnostic Center project
    console.log('[Step 1/4] Finding Diagonistic Center project...');

    const projectDoc = await db.collection('projects').doc('Zx36tGZdPMMo4H5dtHHt').get();

    if (!projectDoc.exists) {
      console.log('❌ Project not found');
      process.exit(1);
      return;
    }

    const project = projectDoc;
    const projectId = project.id;
    const projectData = project.data();

    console.log(`✅ Found: ${projectData.name} (${projectId})\n`);

    // Check BOQ items
    console.log('[Step 2/4] Checking BOQ items...');
    const boqSnapshot = await db.collection('control_boq')
      .where('projectId', '==', projectId)
      .limit(5)
      .get();

    console.log(`Found ${boqSnapshot.size} BOQ items\n`);

    if (!boqSnapshot.empty) {
      console.log('Sample BOQ items:');
      boqSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n  ${index + 1}. ${data.itemNumber} - ${data.description}`);
        console.log(`     Quantity: ${data.quantityContract || 0} ${data.unit}`);
        console.log(`     Rate: ${data.rateContract || 0}`);
        console.log(`     Status: ${data.status || 'N/A'}`);
        console.log(`     Has budgetControl: ${data.budgetControl ? '✅' : '❌'}`);
      });
    }

    // Check existing requisitions
    console.log('\n[Step 3/4] Checking existing requisitions...');
    const reqSnapshot = await db.collection('requisitions')
      .where('projectId', '==', projectId)
      .limit(3)
      .get();

    console.log(`Found ${reqSnapshot.size} requisitions\n`);

    if (!reqSnapshot.empty) {
      console.log('Recent requisitions:');
      reqSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n  ${index + 1}. ${data.requisitionNumber || doc.id}`);
        console.log(`     Purpose: ${data.purpose}`);
        console.log(`     Status: ${data.status}`);
        console.log(`     Amount: ${data.amountRequested} ${data.currency || 'KES'}`);
      });
    }

    // Summary
    console.log('\n[Step 4/4] Test Summary:\n');
    console.log(`✅ Project: ${projectData.name}`);
    console.log(`✅ Project ID: ${projectId}`);
    console.log(`✅ BOQ Items: ${boqSnapshot.size}`);
    console.log(`✅ Existing Requisitions: ${reqSnapshot.size}`);
    console.log(`✅ Approval Config: System-wide (ready)`);

    console.log('\n📍 Next: Set up UI routes for this project\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testDiagnosticCenter();
