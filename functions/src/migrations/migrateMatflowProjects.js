/**
 * MatFlow to Advisory Projects Migration Function
 *
 * Migrates projects from root-level matflow_projects collection
 * to organizations/{orgId}/advisory_projects
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Status mapping from MatFlow to Core
const STATUS_MAP = {
  'draft': 'planning',
  'planning': 'planning',
  'active': 'active',
  'on_hold': 'suspended',
  'completed': 'completed',
  'cancelled': 'cancelled',
};

const SUBCOLLECTIONS = ['boq_items', 'parsing_jobs', 'materials', 'formulas', 'procurement_entries'];

/**
 * Get or create default program for migrated projects
 */
async function getOrCreateDefaultProgram(orgId) {
  const programsRef = db.collection(`organizations/${orgId}/advisory_programs`);

  // Check if MatFlow program already exists
  const snapshot = await programsRef.where('code', '==', 'MATFLOW').get();

  if (!snapshot.empty) {
    console.log(`Found existing MatFlow program: ${snapshot.docs[0].id}`);
    return snapshot.docs[0].id;
  }

  // Create default program
  const newProgram = await programsRef.add({
    name: 'MatFlow Projects',
    code: 'MATFLOW',
    description: 'Projects migrated from MatFlow module',
    status: 'active',
    implementationType: 'direct',
    location: {
      country: 'UG',
      region: 'Central',
    },
    budget: {
      currency: 'UGX',
      totalBudget: 0,
      spent: 0,
      remaining: 0,
    },
    projectStats: {
      total: 0,
      byStatus: {
        planning: 0,
        procurement: 0,
        mobilization: 0,
        active: 0,
        substantial_completion: 0,
        defects_liability: 0,
        completed: 0,
        suspended: 0,
        cancelled: 0,
      },
    },
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: 'migration-script',
    updatedAt: admin.firestore.Timestamp.now(),
    updatedBy: 'migration-script',
    isDeleted: false,
  });

  console.log(`Created MatFlow default program: ${newProgram.id}`);
  return newProgram.id;
}

/**
 * Migrate subcollections from source to target project
 */
async function migrateSubcollections(sourceProjectId, targetProjectId, orgId, dryRun) {
  const results = {};

  for (const subcollection of SUBCOLLECTIONS) {
    const sourceRef = db.collection(`matflow_projects/${sourceProjectId}/${subcollection}`);
    const snapshot = await sourceRef.get();

    results[subcollection] = snapshot.size;

    if (snapshot.empty) continue;

    if (dryRun) {
      console.log(`  [DRY RUN] Would copy ${snapshot.size} ${subcollection} documents`);
      continue;
    }

    // Copy each document
    const targetRef = db.collection(`organizations/${orgId}/advisory_projects/${targetProjectId}/${subcollection}`);
    const batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.set(targetRef.doc(doc.id), {
        ...doc.data(),
        migratedAt: admin.firestore.Timestamp.now(),
      });
      count++;

      // Commit every 400 docs (Firestore batch limit is 500)
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`    Committed ${count} ${subcollection} documents...`);
      }
    }

    await batch.commit();
    console.log(`  Migrated ${snapshot.size} ${subcollection} documents`);
  }

  return results;
}

/**
 * Main migration callable function
 */
const migrateMatflowProjects = onCall({
  cors: ALLOWED_ORIGINS,
  timeoutSeconds: 540, // 9 minutes max
  memory: '1GiB',
}, async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to run migration');
  }

  const { orgId = 'default', dryRun = true } = request.data || {};

  console.log('='.repeat(60));
  console.log('MatFlow to Advisory Projects Migration');
  console.log('='.repeat(60));
  console.log(`Organization: ${orgId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
  console.log(`Called by: ${request.auth.token.email}`);
  console.log('='.repeat(60));

  const results = {
    totalFound: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    subcollections: {},
  };

  try {
    // 1. Get or create default program
    console.log('\nStep 1: Setting up default program...');
    const programId = await getOrCreateDefaultProgram(orgId);

    // 2. Get all MatFlow projects from root collection
    console.log('\nStep 2: Fetching MatFlow projects from root collection...');
    const matflowRef = db.collection('matflow_projects');
    const matflowSnapshot = await matflowRef.get();

    results.totalFound = matflowSnapshot.size;
    console.log(`Found ${matflowSnapshot.size} projects in matflow_projects collection`);

    if (matflowSnapshot.empty) {
      console.log('\nNo MatFlow projects found to migrate.');

      // Check if there are projects in advisory_projects already
      const advisoryRef = db.collection(`organizations/${orgId}/advisory_projects`);
      const advisorySnapshot = await advisoryRef.limit(5).get();
      if (!advisorySnapshot.empty) {
        console.log(`Found ${advisorySnapshot.size}+ projects already in advisory_projects`);
        results.existingCount = advisorySnapshot.size;
      }

      return results;
    }

    // 3. Migrate each project
    console.log('\nStep 3: Migrating projects...\n');
    const targetRef = db.collection(`organizations/${orgId}/advisory_projects`);

    for (const docSnap of matflowSnapshot.docs) {
      const projectId = docSnap.id;
      const data = docSnap.data();

      console.log(`\nProject: ${data.name || projectId}`);
      console.log(`  ID: ${projectId}`);
      console.log(`  Status: ${data.status} → ${STATUS_MAP[data.status] || 'planning'}`);

      // Check if already migrated
      const existing = await targetRef.doc(projectId).get();
      if (existing.exists) {
        console.log(`  Already exists in advisory_projects, skipping`);
        results.skipped++;
        continue;
      }

      // Transform project data
      const transformedProject = {
        ...data,
        programId: programId,
        status: STATUS_MAP[data.status] || 'planning',
        // Ensure required fields
        projectType: data.projectType || data.type || 'new_construction',
        location: data.location || { country: 'UG', region: '' },
        budget: data.budget || {
          currency: 'UGX',
          totalBudget: 0,
          spent: 0,
          remaining: 0,
          variance: 0,
          varianceStatus: 'on_track',
        },
        progress: data.progress || {
          physicalProgress: 0,
          financialProgress: 0,
          completionPercent: 0,
        },
        timeline: data.timeline || {
          plannedStartDate: data.startDate || admin.firestore.Timestamp.now(),
          plannedEndDate: data.endDate || admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
          isDelayed: false,
        },
        // Migration metadata
        migratedFrom: 'matflow_projects',
        migratedAt: admin.firestore.Timestamp.now(),
        originalId: projectId,
        isDeleted: data.isDeleted || false,
        version: data.version || 1,
      };

      if (dryRun) {
        console.log(`  [DRY RUN] Would migrate project with transformed data`);
        // Still check subcollections in dry run
        const subResults = await migrateSubcollections(projectId, projectId, orgId, true);
        results.subcollections[projectId] = subResults;
        results.migrated++;
      } else {
        try {
          // Write project to new location
          await targetRef.doc(projectId).set(transformedProject);
          console.log(`  Migrated project data`);

          // Migrate subcollections
          const subResults = await migrateSubcollections(projectId, projectId, orgId, false);
          results.subcollections[projectId] = subResults;

          results.migrated++;
        } catch (err) {
          console.log(`  Error: ${err.message}`);
          results.failed++;
          results.errors.push({ projectId, error: err.message });
        }
      }
    }

    // 4. Update program stats
    if (!dryRun && results.migrated > 0) {
      console.log('\nStep 4: Updating program stats...');
      await db.doc(`organizations/${orgId}/advisory_programs/${programId}`).update({
        'projectStats.total': results.migrated,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log(`  Updated program with ${results.migrated} projects`);
    }

  } catch (error) {
    console.error('\nMigration failed:', error);
    results.errors.push({ projectId: 'global', error: error.message });
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total projects found: ${results.totalFound}`);
  console.log(`Migrated: ${results.migrated}`);
  console.log(`Skipped (already exists): ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  - ${e.projectId}: ${e.error}`));
  }

  console.log('='.repeat(60));

  return results;
});

module.exports = { migrateMatflowProjects };
