/**
 * Setup Default Approval Configuration
 *
 * This script:
 * 1. Finds your organization ID
 * 2. Creates the default ADD-FIN-001 approval configuration
 * 3. Verifies the setup
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with project ID
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'dawinos',
  });
}

const db = admin.firestore();

async function setupApprovalConfig() {
  console.log('\n=== ADD-FIN-001 Approval Configuration Setup ===\n');

  try {
    // Step 1: Use system-wide configuration (no organization needed)
    console.log('[Step 1/3] Configuring system-wide approval...');

    // Since there's no organizations collection, we'll create the config at the root level
    // This makes it available to all projects
    const orgId = 'system';  // System-wide configuration

    console.log(`\n✅ Creating system-wide configuration\n`);

    // Step 2: Create approval configuration
    console.log('[Step 2/3] Creating default approval configuration...');

    const config = {
      id: 'requisition_default',
      name: 'ADD-FIN-001 Default Requisition Workflow',
      description: 'Dual-approval workflow: Technical Review → Financial Approval',
      type: 'requisition',
      level: 'organization',
      entityId: orgId,
      isDefault: true,
      isActive: true,
      overridesDefault: false,

      stages: [
        {
          id: 'technical-review',
          sequence: 1,
          name: 'Technical Review',
          description: 'ICE Manager reviews technical feasibility and BOQ alignment',
          requiredRole: 'ICE_MANAGER',
          alternativeRoles: ['PROJECT_MANAGER'],
          slaHours: 48,
          isRequired: true,
          canSkip: false,
          skipConditions: [],
          canRunInParallel: false,
          parallelGroupId: null,
          isExternalApproval: false,
          externalApproverEmail: null,
          externalApproverName: null,
          notifyOnAssignment: true,
          notifyOnOverdue: true,
          escalationRules: [],
        },
        {
          id: 'financial-approval',
          sequence: 2,
          name: 'Financial Approval',
          description: 'Finance reviews budget availability and compliance',
          requiredRole: 'FINANCE',
          alternativeRoles: [],
          slaHours: 72,
          isRequired: true,
          canSkip: false,
          skipConditions: [],
          canRunInParallel: false,
          parallelGroupId: null,
          isExternalApproval: false,
          externalApproverEmail: null,
          externalApproverName: null,
          notifyOnAssignment: true,
          notifyOnOverdue: true,
          escalationRules: [],
        },
      ],

      version: 1,
      previousVersionId: null,
      createdBy: 'system',
      createdAt: admin.firestore.Timestamp.now(),
      updatedBy: 'system',
      updatedAt: admin.firestore.Timestamp.now(),
      reason: 'Initial ADD-FIN-001 system setup',
    };

    // Store at root level since there's no organizations collection
    const configRef = db
      .collection('approval_config').doc('requisition_default');

    await configRef.set(config);

    console.log('✅ Default approval configuration created');

    // Create version history
    await db
      .collection('approval_config_versions').add({
        configId: 'requisition_default',
        version: 1,
        configuration: config,
        changedBy: 'system',
        changedAt: admin.firestore.Timestamp.now(),
        changeReason: 'Initial configuration',
        changes: [],
      });

    console.log('✅ Version history created');

    // Step 3: Verify
    console.log('\n[Step 3/3] Verifying setup...');

    const verifyDoc = await configRef.get();
    if (!verifyDoc.exists) {
      throw new Error('Configuration was not created properly');
    }

    const verifiedData = verifyDoc.data();
    console.log('\n✅ Configuration verified:');
    console.log(`   - Name: ${verifiedData.name}`);
    console.log(`   - Type: ${verifiedData.type}`);
    console.log(`   - Stages: ${verifiedData.stages.length}`);
    console.log(`   - Active: ${verifiedData.isActive}`);

    console.log('\n✅ Setup Complete!\n');
    console.log('Next steps:');
    console.log('1. Test creating a requisition with an existing project');
    console.log('2. Verify dual-approval workflow (Technical → Financial)');
    console.log('3. Check deadline monitoring in 1 hour\n');

    console.log('Firestore path:');
    console.log(`approval_config/requisition_default\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run setup
setupApprovalConfig();
