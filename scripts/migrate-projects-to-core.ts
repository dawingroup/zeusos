/**
 * DATA MIGRATION SCRIPT
 * =================================================================
 * Migrates projects from the legacy `delivery_projects` and `matflow_projects`
 * collections to the new canonical `advisory_projects` collection.
 *
 * HOW TO RUN:
 * 1. Ensure you have a Firebase service account key file (e.g., serviceAccount.json)
 *    in the project root or a secure location.
 * 2. Update the `SERVICE_ACCOUNT_PATH` and `ORG_ID` constants below.
 * 3. Run from the terminal:
 *    npx ts-node --esm ./scripts/migrate-projects-to-core.ts
 *
 * NOTE: This script makes assumptions about matching projects based on their name.
 * REVIEW THE MATCHING LOGIC and test in a staging environment before running on production.
 */

import admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// =================================================================
// CONFIGURATION
// =================================================================
const SERVICE_ACCOUNT_PATH = './serviceAccount.json'; // IMPORTANT: Update this path
const ORG_ID = 'YOUR_ORGANIZATION_ID'; // IMPORTANT: Update with your actual Org ID

// =================================================================
// INITIALIZE FIREBASE ADMIN
// =================================================================
try {
  const serviceAccount = await import(SERVICE_ACCOUNT_PATH, { assert: { type: 'json' } });
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.default),
  });
} catch (error) {
  console.error('Error initializing Firebase Admin SDK.');
  console.error('Please ensure serviceAccount.json exists and the path is correct.');
  process.exit(1);
}

const db = getFirestore();

// =================================================================
// COLLECTION REFERENCES
// =================================================================
const legacyDeliveryProjectsRef = db.collection('delivery_projects');
const legacyMatflowProjectsRef = db.collection(`organizations/${ORG_ID}/matflow_projects`);
const newAdvisoryProjectsRef = db.collection(`organizations/${ORG_ID}/advisory_projects`);

// =================================================================
// HELPER FUNCTIONS
// =================================================================

// Helper to convert Firebase Timestamps
const toDate = (ts: any): Date | undefined => {
    if (ts instanceof Timestamp) {
        return ts.toDate();
    }
    if (ts && ts._seconds) { // Handle older format
        return new Timestamp(ts._seconds, ts._nanoseconds).toDate();
    }
    return undefined;
};

// =================================================================
// MIGRATION LOGIC
// =================================================================

async function migrateProjects() {
  console.log('Starting project data migration...');

  // 1. Fetch all legacy projects
  console.log('Fetching legacy projects...');
  const deliverySnapshot = await legacyDeliveryProjectsRef.get();
  const matflowSnapshot = await legacyMatflowProjectsRef.where('isDeleted', '!=', true).get();

  const deliveryProjects = deliverySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const matflowProjects = matflowSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  console.log(`Found ${deliveryProjects.length} delivery projects.`);
  console.log(`Found ${matflowProjects.length} matflow projects.`);

  const migratedProjectCodes: Set<string> = new Set();
  const batch = db.batch();
  let operations = 0;

  // 2. Iterate through Delivery projects as the primary source
  for (const dp of deliveryProjects) {
    if (!dp.name) continue;

    console.log(`
Processing Delivery project: "${dp.name}" (${dp.id})`);

    // Find a matching MatFlow project (assuming name is a reasonable key)
    const mp = matflowProjects.find(p => p.name === dp.name);
    if (mp) {
      console.log(`  Found matching MatFlow project: "${mp.name}" (${mp.id})`);
      // Remove from matflowProjects array so we don't process it again
      const index = matflowProjects.indexOf(mp);
      matflowProjects.splice(index, 1);
    } else {
      console.log(`  No matching MatFlow project found for "${dp.name}".`);
    }

    // 3. Construct the new canonical project object
    const newProject = {
      // Core Identification (from Delivery)
      name: dp.name,
      projectCode: dp.projectCode,
      description: dp.description,

      // Relationships (from Delivery)
      programId: dp.programId,
      engagementId: dp.engagementId,
      customerId: dp.customerId,
      customerName: dp.customerName,
      linkedDealId: dp.linkedDealId,

      // Classification (from Delivery)
      status: dp.status || 'planning',
      projectType: dp.projectType || 'new_construction',

      // Core Data Structures (merged)
      location: {
        siteName: dp.location?.siteName || mp?.location?.address || dp.name,
        address: mp?.location?.address || dp.location?.address || '',
        district: mp?.location?.district || dp.location?.district || '',
        region: dp.location?.region || '',
        country: dp.location?.country || 'Uganda',
        coordinates: dp.location?.coordinates || mp?.location?.coordinates || null,
      },
      budget: {
        currency: dp.budget?.currency || mp?.settings?.currency || 'UGX',
        totalBudget: dp.budget?.totalBudget || 0,
        spent: dp.budget?.spent || 0,
        remaining: dp.budget?.remaining || 0,
        variance: dp.budget?.variance || 0,
        varianceStatus: dp.budget?.varianceStatus || 'on_track',
        contingencyPercent: mp?.settings?.contingencyPercent || 10,
      },
      progress: {
        physicalProgress: dp.progress?.physicalProgress || 0,
        financialProgress: dp.progress?.financialProgress || 0,
        completionPercent: mp?.stages?.reduce((acc: number, s: any) => acc + (s.completionPercent || 0), 0) / (mp?.stages?.length || 1) || 0,
      },
      timeline: {
        plannedStartDate: toDate(dp.timeline?.plannedStartDate) || toDate(mp?.stages?.[0]?.plannedStart) || toDate(dp.createdAt),
        plannedEndDate: toDate(dp.timeline?.plannedEndDate) || toDate(mp?.stages?.[mp?.stages?.length - 1]?.plannedEnd) || toDate(dp.createdAt),
        currentStartDate: toDate(dp.timeline?.currentStartDate) || toDate(dp.createdAt),
        currentEndDate: toDate(dp.timeline?.currentEndDate) || toDate(dp.createdAt),
      },
      settings: {
        taxEnabled: mp?.settings?.taxEnabled || false,
        taxRate: mp?.settings?.taxRate || 18,
        defaultWastagePercent: mp?.settings?.defaultWastagePercent || 10,
      },
      stages: mp?.stages || [],
      members: mp?.members || [],
      boqIds: dp.matflowBoqIds || (dp.matflowBoqId ? [dp.matflowBoqId] : []),

      // Metadata
      tags: dp.tags || [],
      createdAt: toDate(dp.createdAt) || new Date(),
      createdBy: dp.createdBy,
      updatedAt: toDate(dp.updatedAt) || new Date(),
      updatedBy: dp.updatedBy,
      version: (dp.version || 0) + (mp?.version || 0) + 1,
      isDeleted: dp.isDeleted || mp?.isDeleted || false,
      // Carry over original IDs for reference
      _legacyDeliveryId: dp.id,
      _legacyMatflowId: mp?.id || null,
    };

    // 4. Add to batch
    if (!migratedProjectCodes.has(newProject.projectCode)) {
        const docRef = newAdvisoryProjectsRef.doc(dp.id); // Use delivery ID for consistency
        batch.set(docRef, newProject);
        operations++;
        migratedProjectCodes.add(newProject.projectCode);
        console.log(`  ✅ Queued migration for "${newProject.name}" with ID ${dp.id}.`);
    } else {
        console.log(`  ⚠️ Skipped duplicate project code: ${newProject.projectCode}`);
    }
  }
  
  // 5. Process any remaining MatFlow projects that didn't have a match
  console.log(`
Processing ${matflowProjects.length} remaining MatFlow-only projects...`);
  for (const mp of matflowProjects) {
     console.log(`Processing MatFlow-only project: "${mp.name}" (${mp.id})`);
     // Create a new project with available data
      const newProject = {
          name: mp.name,
          projectCode: mp.code,
          //... map other fields from matflow project to new project schema
          _legacyMatflowId: mp.id,
          _legacyDeliveryId: null,
          //... set defaults for required fields
      };
      if (!migratedProjectCodes.has(newProject.projectCode)) {
        const docRef = newAdvisoryProjectsRef.doc(mp.id);
        batch.set(docRef, newProject);
        operations++;
        migratedProjectCodes.add(newProject.projectCode);
        console.log(`  ✅ Queued migration for MatFlow-only project "${newProject.name}" with ID ${mp.id}.`);
    } else {
        console.log(`  ⚠️ Skipped duplicate project code: ${newProject.projectCode}`);
    }
  }


  // 6. Commit batch
  if (operations > 0) {
    console.log(`
Committing ${operations} operations to the database...`);
    await batch.commit();
    console.log('🎉 Migration batch committed successfully!');
  } else {
    console.log('No new operations to commit.');
  }
}

// =================================================================
// RUN SCRIPT
// =================================================================
migrateProjects().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
