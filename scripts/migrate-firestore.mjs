/**
 * Migrate Firestore data from dawin-cutlist-processor to dawinos
 * 
 * Run: node scripts/migrate-firestore.mjs
 * 
 * This script exports data from the source project and imports to destination.
 * Requires gcloud auth application-default login
 */

import { initializeApp as initSourceApp } from 'firebase/app';
import { initializeApp as initDestApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  query,
  limit
} from 'firebase/firestore';

// Source: dawin-cutlist-processor
const sourceConfig = {
  apiKey: "AIzaSyCVgMvkUsiDHDczPsrWT9YeL4n7i58bsb0",
  authDomain: "dawin-cutlist-processor.firebaseapp.com",
  projectId: "dawin-cutlist-processor",
  storageBucket: "dawin-cutlist-processor.firebasestorage.app",
  messagingSenderId: "834402569566",
  appId: "1:834402569566:web:418c09472582d7bea553cf",
};

// Destination: dawinos
const destConfig = {
  apiKey: "AIzaSyCfSYtxRoHxp9bEUkVbCFTnMmq58QzUsg8",
  authDomain: "dawinos.firebaseapp.com",
  projectId: "dawinos",
  storageBucket: "dawinos.firebasestorage.app",
  messagingSenderId: "820903406446",
  appId: "1:820903406446:web:94a874a2b7625932f5ef7f",
};

// Collections to migrate
const COLLECTIONS_TO_MIGRATE = [
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
];

// Initialize apps
const sourceApp = initSourceApp(sourceConfig, 'source');
const destApp = initDestApp(destConfig, 'dest');

const sourceDb = getFirestore(sourceApp);
const destDb = getFirestore(destApp);

async function migrateCollection(collectionName) {
  console.log(`\n📦 Migrating: ${collectionName}`);
  
  try {
    const sourceRef = collection(sourceDb, collectionName);
    const snapshot = await getDocs(sourceRef);
    
    if (snapshot.empty) {
      console.log(`   ⏭️  Empty collection, skipping`);
      return { name: collectionName, count: 0, status: 'empty' };
    }
    
    let count = 0;
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const destRef = doc(destDb, collectionName, docSnap.id);
      
      try {
        await setDoc(destRef, data);
        count++;
        process.stdout.write(`\r   ✓ ${count}/${snapshot.size} documents`);
      } catch (err) {
        console.log(`\n   ❌ Error writing ${docSnap.id}: ${err.message}`);
      }
    }
    
    console.log(`\n   ✅ Migrated ${count} documents`);
    return { name: collectionName, count, status: 'success' };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { name: collectionName, count: 0, status: 'error', error: err.message };
  }
}

async function migrateSubcollections(parentCollection, subcollectionName) {
  console.log(`\n📦 Migrating subcollection: ${parentCollection}/*/${subcollectionName}`);
  
  try {
    const parentRef = collection(sourceDb, parentCollection);
    const parentSnap = await getDocs(parentRef);
    
    let totalCount = 0;
    
    for (const parentDoc of parentSnap.docs) {
      const subRef = collection(sourceDb, parentCollection, parentDoc.id, subcollectionName);
      const subSnap = await getDocs(subRef);
      
      for (const subDoc of subSnap.docs) {
        const data = subDoc.data();
        const destRef = doc(destDb, parentCollection, parentDoc.id, subcollectionName, subDoc.id);
        
        try {
          await setDoc(destRef, data);
          totalCount++;
        } catch (err) {
          console.log(`   ❌ Error: ${err.message}`);
        }
      }
    }
    
    console.log(`   ✅ Migrated ${totalCount} documents`);
    return { name: `${parentCollection}/*/${subcollectionName}`, count: totalCount, status: 'success' };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { name: `${parentCollection}/*/${subcollectionName}`, count: 0, status: 'error' };
  }
}

async function main() {
  console.log('🚀 Firestore Migration: dawin-cutlist-processor → dawinos\n');
  console.log('Source:', sourceConfig.projectId);
  console.log('Destination:', destConfig.projectId);
  console.log('─'.repeat(50));
  
  const results = [];
  
  // Migrate top-level collections
  for (const collName of COLLECTIONS_TO_MIGRATE) {
    const result = await migrateCollection(collName);
    results.push(result);
  }
  
  // Migrate important subcollections
  const subcollections = [
    ['designProjects', 'designItems'],
    ['designProjects', 'materials'],
    ['customers', 'materials'],
    ['customers', 'projects'],
  ];
  
  for (const [parent, sub] of subcollections) {
    const result = await migrateSubcollections(parent, sub);
    results.push(result);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Migration Summary');
  console.log('═'.repeat(50));
  
  let totalDocs = 0;
  for (const r of results) {
    const icon = r.status === 'success' ? '✅' : r.status === 'empty' ? '⏭️' : '❌';
    console.log(`${icon} ${r.name}: ${r.count} docs`);
    totalDocs += r.count;
  }
  
  console.log('─'.repeat(50));
  console.log(`Total: ${totalDocs} documents migrated`);
  console.log('\n✨ Migration complete!');
  
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
