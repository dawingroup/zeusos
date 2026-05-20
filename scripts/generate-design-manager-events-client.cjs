/**
 * Generate Business Events for Existing Design Manager Projects
 * Using Firebase Client SDK (no service account needed)
 *
 * Usage: node scripts/generate-design-manager-events-client.cjs [--dry-run]
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, query, where, limit, Timestamp } = require('firebase/firestore');
require('dotenv').config();

// Initialize Firebase Client SDK
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('✓ Firebase Client initialized');

// Command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

/**
 * Event type mapping for Design Manager project stages
 */
const EVENT_TYPES = {
  'brief': 'project_brief_received',
  'scoping': 'project_scoping_started',
  'design': 'design_phase_started',
  'review': 'design_review_scheduled',
  'approval': 'client_approval_pending',
  'production': 'production_started',
  'delivery': 'project_delivery_scheduled',
  'completed': 'project_completed',
};

/**
 * Get appropriate event type based on project stage and status
 */
function getEventType(project) {
  const stage = project.currentStage || 'brief';
  const status = project.status || 'active';

  if (status === 'completed') {
    return 'project_completed';
  }

  return EVENT_TYPES[stage] || 'project_created';
}

/**
 * Generate business event for a Design Manager project
 */
function generateEventForProject(project, projectId) {
  const eventType = getEventType(project);

  const businessEvent = {
    eventType,
    sourceModule: 'design_manager',
    subsidiary: 'finishes',
    entityType: 'project',
    entityId: projectId,

    // Event metadata
    timestamp: Timestamp.now(),
    createdAt: Timestamp.now(),
    processedAt: null,
    status: 'pending',

    // Project context
    context: {
      projectId,
      projectName: project.name || 'Unnamed Project',
      customerId: project.customerId || null,
      customerName: project.customerName || null,
      currentStage: project.currentStage || 'brief',
      status: project.status || 'active',
      priority: project.priority || 'medium',

      // Team information
      assignedDesigner: project.assignedTo || null,
      projectManager: project.createdBy || null,

      // Dates
      createdDate: project.createdAt || null,
      dueDate: project.dueDate || null,
      updatedDate: project.updatedAt || null,

      // Additional context
      scope: project.scope || null,
      budget: project.budget || null,
      deliverables: project.deliverables || [],
    },

    // Processing metadata
    taskGenerationAttempts: 0,
    lastProcessingError: null,
    retryCount: 0,
  };

  return businessEvent;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Business Event Generation for Design Manager Projects\n');

  try {
    // Fetch all Design Manager projects
    console.log('📊 Fetching Design Manager projects...');
    const projectsRef = collection(db, 'designProjects');
    const projectsSnapshot = await getDocs(projectsRef);

    if (projectsSnapshot.empty) {
      console.log('⚠️  No Design Manager projects found');
      return;
    }

    console.log(`✓ Found ${projectsSnapshot.size} projects\n`);

    // Statistics
    const stats = {
      total: projectsSnapshot.size,
      processed: 0,
      skipped: 0,
      errors: 0,
      byEventType: {},
      byStage: {},
    };

    // Process each project
    for (const doc of projectsSnapshot.docs) {
      const projectId = doc.id;
      const project = doc.data();

      try {
        // Check if event already exists
        const eventsRef = collection(db, 'businessEvents');
        const existingEventQuery = query(
          eventsRef,
          where('entityType', '==', 'project'),
          where('entityId', '==', projectId),
          where('sourceModule', '==', 'design_manager'),
          limit(1)
        );
        const existingEventSnapshot = await getDocs(existingEventQuery);

        if (!existingEventSnapshot.empty) {
          console.log(`⏭️  Skipping ${projectId} - Event already exists`);
          stats.skipped++;
          continue;
        }

        // Generate event
        const event = generateEventForProject(project, projectId);
        const eventType = event.eventType;
        const stage = project.currentStage || 'unknown';

        // Update statistics
        stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;
        stats.byStage[stage] = (stats.byStage[stage] || 0) + 1;

        if (!dryRun) {
          // Create the business event
          const eventsRef = collection(db, 'businessEvents');
          await addDoc(eventsRef, event);
          console.log(`✓ Created event for project: ${project.name || projectId}`);
          console.log(`  Event Type: ${eventType}`);
          console.log(`  Stage: ${stage}`);
          console.log('');
        } else {
          console.log(`[DRY RUN] Would create event for: ${project.name || projectId}`);
          console.log(`  Event Type: ${eventType}`);
          console.log(`  Stage: ${stage}`);
          console.log('');
        }

        stats.processed++;

      } catch (error) {
        console.error(`❌ Error processing project ${projectId}:`, error.message);
        stats.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Projects:     ${stats.total}`);
    console.log(`Events Created:     ${stats.processed}`);
    console.log(`Skipped (existing): ${stats.skipped}`);
    console.log(`Errors:             ${stats.errors}`);
    console.log('');

    if (Object.keys(stats.byEventType).length > 0) {
      console.log('Events by Type:');
      Object.entries(stats.byEventType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type.padEnd(30)} ${count}`);
        });
      console.log('');
    }

    if (Object.keys(stats.byStage).length > 0) {
      console.log('Projects by Stage:');
      Object.entries(stats.byStage)
        .sort((a, b) => b[1] - a[1])
        .forEach(([stage, count]) => {
          console.log(`  ${stage.padEnd(30)} ${count}`);
        });
      console.log('');
    }

    if (dryRun) {
      console.log('💡 This was a dry run. Run without --dry-run to create events.');
    } else {
      console.log('✅ Business events created successfully!');
      console.log('💡 The Intelligence Layer will now process these events and generate tasks.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✓ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
