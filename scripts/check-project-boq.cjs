const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });

const db = admin.firestore();
const projectId = process.argv[2] || '1SYtiViKF4T98wbUEiHo';

async function checkProject() {
  console.log('Checking project:', projectId);
  console.log('');

  // Check if project exists
  const projectDoc = await db.collection('projects').doc(projectId).get();

  if (!projectDoc.exists) {
    console.log('❌ Project document does not exist!');
    console.log('');
    console.log('Let me list all projects:');
    const allProjects = await db.collection('projects').limit(10).get();
    console.log('');
    console.log('Available projects:');
    allProjects.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.name || 'Unnamed'}`);
    });
  } else {
    const projectData = projectDoc.data();
    console.log('✅ Project found:', projectData.name);
    console.log('');

    // Check BOQ items
    const boqSnapshot = await db.collection('control_boq')
      .where('projectId', '==', projectId)
      .get();

    console.log('BOQ items in control_boq collection:', boqSnapshot.size);

    if (boqSnapshot.size === 0) {
      console.log('');
      console.log('⚠️  No BOQ items found for this project!');
      console.log('');
      console.log('You need to upload a BOQ file first at:');
      console.log(`https://dawinos.web.app/advisory/delivery/projects/${projectId}/boq`);
    } else {
      console.log('');
      console.log('BOQ items found. First 5:');
      boqSnapshot.docs.slice(0, 5).forEach((doc, i) => {
        const data = doc.data();
        console.log(`  ${i + 1}. ${data.description || 'No description'}`);
        console.log(`     - Qty Contract: ${data.quantityContract}`);
        console.log(`     - Qty Requisitioned: ${data.quantityRequisitioned || 0}`);
        console.log(`     - Qty Remaining: ${data.quantityRemaining || data.quantityContract}`);
        console.log(`     - Rate: ${data.rate}`);
      });
    }
  }

  process.exit(0);
}

checkProject().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
