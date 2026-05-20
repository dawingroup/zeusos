/**
 * Generate Business Events for Existing Design Manager Projects
 *
 * This script creates business events for existing projects in Design Manager
 * to trigger the Intelligence Layer task generation system.
 *
 * Usage: node scripts/generate-design-manager-events.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Try to use service account key if available
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(__dirname, '../service-account-key.json');

    try {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✓ Firebase Admin initialized with service account');
    } catch (serviceAccountError) {
      // Fall back to application default credentials (uses firebase login)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'dawinos-v2'
      });
      console.log('✓ Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
    console.log('\nPlease authenticate with one of these methods:');
    console.log('1. Download service account key from Firebase Console > Project Settings > Service Accounts');
    console.log('   Save as service-account-key.json in project root');
    console.log('2. Or set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.log('3. Or run: gcloud auth application-default login');
    process.exit(1);
  }
}

const db = admin.firestore();

// Command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

/**
 * Event type mapping for Design Manager project stages
 * Maps to actual events defined in event-catalog.ts
 */
const EVENT_TYPES = {
  'brief': 'finishes.client_consultation_scheduled',
  'scoping': 'finishes.space_planning_requested',
  'design': 'finishes.design_concepts_created',
  'review': 'finishes.design_approval_requested',
  'approval': 'finishes.client_feedback_received',
  'production': 'finishes.design_production_ready',
  'delivery': 'finishes.installation_scheduled',
  'completed': 'finishes.installation_complete',
};

/**
 * Get appropriate event type based on project stage and status
 */
function getEventType(project) {
  const stage = project.currentStage || 'brief';
  const status = project.status || 'active';

  if (status === 'completed') {
    return 'finishes.installation_complete';
  }

  return EVENT_TYPES[stage] || 'finishes.client_consultation_scheduled';
}

/**
 * Generate business event for a Design Manager project
 */
async function generateEventForProject(project, projectId) {
  const eventType = getEventType(project);

  const businessEvent = {
    eventType,
    sourceModule: 'design_manager',
    subsidiary: 'finishes',
    entityType: 'project',
    entityId: projectId,

    // Event metadata
    timestamp: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
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
    const projectsSnapshot = await db.collection('designProjects').get();

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
        const existingEventQuery = await db.collection('businessEvents')
          .where('entityType', '==', 'project')
          .where('entityId', '==', projectId)
          .where('sourceModule', '==', 'design_manager')
          .limit(1)
          .get();

        if (!existingEventQuery.empty) {
          console.log(`⏭️  Skipping ${projectId} - Event already exists`);
          stats.skipped++;
          continue;
        }

        // Generate event
        const event = await generateEventForProject(project, projectId);
        const eventType = event.eventType;
        const stage = project.currentStage || 'unknown';

        // Update statistics
        stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;
        stats.byStage[stage] = (stats.byStage[stage] || 0) + 1;

        if (!dryRun) {
          // Create the business event
          await db.collection('businessEvents').add(event);
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
