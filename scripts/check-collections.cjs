const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

async function checkCollections() {
  console.log('\n=== Checking Firestore Collections ===\n');
  
  // Check common collections
  const collections = ['organizations', 'organization', 'org', 'projects', 'users'];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(1).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        console.log(`✅ Found collection: ${collectionName}`);
        console.log(`   Sample doc ID: ${doc.id}`);
        console.log(`   Sample data:`, Object.keys(doc.data()).slice(0, 5).join(', '));
      } else {
        console.log(`⚠️  Collection exists but empty: ${collectionName}`);
      }
    } catch (error) {
      console.log(`❌ No collection: ${collectionName}`);
    }
  }
  
  process.exit(0);
}

checkCollections();
