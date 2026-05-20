/**
 * Migrate Firestore data using Firebase Admin SDK
 * Run from functions folder: node migrate-data.js
 * 
 * Requires: Export GOOGLE_APPLICATION_CREDENTIALS or run gcloud auth application-default login
 */

const admin = require('firebase-admin');

// Initialize source project
const sourceApp = admin.initializeApp({
  projectId: 'dawin-cutlist-processor',
}, 'source');

// Initialize destination project  
const destApp = admin.initializeApp({
  projectId: 'dawinos',
}, 'dest');

const sourceDb = sourceApp.firestore();
const destDb = destApp.firestore();

const COLLECTIONS = [
  'customers',
  'designProjects', 
  'materials',
  'stockMaterials',
  'materialMappings',
  'workInstances',
  'assets',
  'features',
  'featureLibrary',
  'katanaCatalogItems',
  'launchProducts',
  'roadmapProducts',
  'productSyncMappings',
  'users',
  'rateLimits',
  'systemConfig',
];

async function migrateCollection(name) {
  console.log(`\n📦 ${name}`);
  try {
    const snap = await sourceDb.collection(name).get();
    if (snap.empty) {
      console.log('   ⏭️  Empty');
      return 0;
    }
    
    const batch = destDb.batch();
    let count = 0;
    
    for (const doc of snap.docs) {
      batch.set(destDb.collection(name).doc(doc.id), doc.data());
      count++;
      if (count % 500 === 0) {
        await batch.commit();
      }
    }
    
    if (count % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`   ✅ ${count} docs`);
    return count;
  } catch (err) {
    console.log(`   ❌ ${err.message}`);
    return 0;
  }
}

async function migrateSubcollection(parent, sub) {
  console.log(`\n📦 ${parent}/*/${sub}`);
  try {
    const parentSnap = await sourceDb.collection(parent).get();
    let total = 0;
    
    for (const parentDoc of parentSnap.docs) {
      const subSnap = await sourceDb.collection(parent).doc(parentDoc.id).collection(sub).get();
      
      for (const subDoc of subSnap.docs) {
        await destDb.collection(parent).doc(parentDoc.id).collection(sub).doc(subDoc.id).set(subDoc.data());
        total++;
      }
    }
    
    console.log(`   ✅ ${total} docs`);
    return total;
  } catch (err) {
    console.log(`   ❌ ${err.message}`);
    return 0;
  }
}

async function main() {
  console.log('🚀 Migration: dawin-cutlist-processor → dawinos\n');
  
  let total = 0;
  
  for (const c of COLLECTIONS) {
    total += await migrateCollection(c);
  }
  
  // Subcollections
  total += await migrateSubcollection('designProjects', 'designItems');
  total += await migrateSubcollection('designProjects', 'materials');
  total += await migrateSubcollection('customers', 'materials');
  
  console.log(`\n✨ Done! ${total} documents migrated.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
