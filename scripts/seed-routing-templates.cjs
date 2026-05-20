/**
 * Seed Routing Templates
 * Populates default routing templates for common manufacturing product categories.
 *
 * Usage: node scripts/seed-routing-templates.cjs
 */

const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const TEMPLATES = [
  {
    name: 'Standard Cabinet',
    description: 'Standard routing for cabinet and casework manufacturing',
    productType: 'cabinet',
    isDefault: true,
    version: 1,
    isActive: true,
    estimatedTotalMinutes: 420,
    steps: [
      {
        stepIndex: 0,
        name: 'Panel Cutting',
        workstationType: 'cutting_panel_saw',
        estimatedDurationMinutes: 60,
        qcRequired: false,
        dependsOnStepIndices: [],
        isOptional: false,
      },
      {
        stepIndex: 1,
        name: 'CNC Machining',
        workstationType: 'cutting_cnc',
        estimatedDurationMinutes: 45,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: true,
        triggerFeatures: ['cnc_drilling', 'cnc_routing'],
      },
      {
        stepIndex: 2,
        name: 'Edge Banding',
        workstationType: 'edgebanding',
        estimatedDurationMinutes: 40,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: false,
      },
      {
        stepIndex: 3,
        name: 'Drilling',
        workstationType: 'drilling',
        estimatedDurationMinutes: 30,
        qcRequired: false,
        dependsOnStepIndices: [2],
        isOptional: false,
      },
      {
        stepIndex: 4,
        name: 'Assembly',
        workstationType: 'assembly',
        estimatedDurationMinutes: 90,
        qcRequired: false,
        dependsOnStepIndices: [3],
        isOptional: false,
      },
      {
        stepIndex: 5,
        name: 'Hardware Installation',
        workstationType: 'hardware_installation',
        estimatedDurationMinutes: 45,
        qcRequired: false,
        dependsOnStepIndices: [4],
        isOptional: false,
      },
      {
        stepIndex: 6,
        name: 'Finishing',
        workstationType: 'finishing_spray',
        estimatedDurationMinutes: 60,
        qcRequired: false,
        dependsOnStepIndices: [5],
        isOptional: true,
        triggerFeatures: ['spray_finish', 'lacquer'],
      },
      {
        stepIndex: 7,
        name: 'Quality Inspection',
        workstationType: 'quality_control',
        estimatedDurationMinutes: 20,
        qcRequired: true,
        dependsOnStepIndices: [5, 6],
        isOptional: false,
      },
      {
        stepIndex: 8,
        name: 'Packing',
        workstationType: 'packing',
        estimatedDurationMinutes: 30,
        qcRequired: false,
        dependsOnStepIndices: [7],
        isOptional: false,
      },
    ],
  },
  {
    name: 'Timber Frame',
    description: 'Routing for solid timber frame construction (doors, windows, furniture frames)',
    productType: 'timber_frame',
    isDefault: true,
    version: 1,
    isActive: true,
    estimatedTotalMinutes: 330,
    steps: [
      {
        stepIndex: 0,
        name: 'Timber Cutting',
        workstationType: 'cutting_manual',
        estimatedDurationMinutes: 45,
        qcRequired: false,
        dependsOnStepIndices: [],
        isOptional: false,
      },
      {
        stepIndex: 1,
        name: 'CNC Joinery',
        workstationType: 'cutting_cnc',
        estimatedDurationMinutes: 60,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: true,
        triggerFeatures: ['mortise_tenon', 'dovetail', 'cnc_joinery'],
      },
      {
        stepIndex: 2,
        name: 'Sanding',
        workstationType: 'sanding',
        estimatedDurationMinutes: 40,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: false,
      },
      {
        stepIndex: 3,
        name: 'Assembly',
        workstationType: 'assembly',
        estimatedDurationMinutes: 75,
        qcRequired: false,
        dependsOnStepIndices: [2],
        isOptional: false,
      },
      {
        stepIndex: 4,
        name: 'Hand Finishing',
        workstationType: 'finishing_hand',
        estimatedDurationMinutes: 60,
        qcRequired: false,
        dependsOnStepIndices: [3],
        isOptional: false,
      },
      {
        stepIndex: 5,
        name: 'Quality Inspection',
        workstationType: 'quality_control',
        estimatedDurationMinutes: 20,
        qcRequired: true,
        dependsOnStepIndices: [4],
        isOptional: false,
      },
      {
        stepIndex: 6,
        name: 'Packing',
        workstationType: 'packing',
        estimatedDurationMinutes: 30,
        qcRequired: false,
        dependsOnStepIndices: [5],
        isOptional: false,
      },
    ],
  },
  {
    name: 'Glass Panel',
    description: 'Routing for glass cutting, tempering, and installation preparation',
    productType: 'glass',
    isDefault: true,
    version: 1,
    isActive: true,
    estimatedTotalMinutes: 180,
    steps: [
      {
        stepIndex: 0,
        name: 'Glass Cutting',
        workstationType: 'glass_cutting',
        estimatedDurationMinutes: 30,
        qcRequired: false,
        dependsOnStepIndices: [],
        isOptional: false,
      },
      {
        stepIndex: 1,
        name: 'Edge Polishing',
        workstationType: 'sanding',
        estimatedDurationMinutes: 25,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: false,
      },
      {
        stepIndex: 2,
        name: 'Drilling (Holes/Cutouts)',
        workstationType: 'drilling',
        estimatedDurationMinutes: 20,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: true,
        triggerFeatures: ['glass_holes', 'glass_cutouts'],
      },
      {
        stepIndex: 3,
        name: 'Quality Inspection',
        workstationType: 'quality_control',
        estimatedDurationMinutes: 15,
        qcRequired: true,
        dependsOnStepIndices: [1, 2],
        isOptional: false,
      },
      {
        stepIndex: 4,
        name: 'Packing',
        workstationType: 'packing',
        estimatedDurationMinutes: 20,
        qcRequired: false,
        dependsOnStepIndices: [3],
        isOptional: false,
      },
    ],
  },
  {
    name: 'Upholstered Item',
    description: 'Routing for furniture with upholstery (sofas, chairs, headboards)',
    productType: 'upholstery',
    isDefault: true,
    version: 1,
    isActive: true,
    estimatedTotalMinutes: 390,
    steps: [
      {
        stepIndex: 0,
        name: 'Frame Cutting',
        workstationType: 'cutting_manual',
        estimatedDurationMinutes: 45,
        qcRequired: false,
        dependsOnStepIndices: [],
        isOptional: false,
      },
      {
        stepIndex: 1,
        name: 'Frame Assembly',
        workstationType: 'assembly',
        estimatedDurationMinutes: 60,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: false,
      },
      {
        stepIndex: 2,
        name: 'Sanding',
        workstationType: 'sanding',
        estimatedDurationMinutes: 30,
        qcRequired: false,
        dependsOnStepIndices: [1],
        isOptional: false,
      },
      {
        stepIndex: 3,
        name: 'Upholstery',
        workstationType: 'upholstery',
        estimatedDurationMinutes: 120,
        qcRequired: false,
        dependsOnStepIndices: [2],
        isOptional: false,
      },
      {
        stepIndex: 4,
        name: 'Finishing',
        workstationType: 'finishing_hand',
        estimatedDurationMinutes: 45,
        qcRequired: false,
        dependsOnStepIndices: [3],
        isOptional: true,
        triggerFeatures: ['wood_finish', 'stain'],
      },
      {
        stepIndex: 5,
        name: 'Quality Inspection',
        workstationType: 'quality_control',
        estimatedDurationMinutes: 20,
        qcRequired: true,
        dependsOnStepIndices: [3, 4],
        isOptional: false,
      },
      {
        stepIndex: 6,
        name: 'Packing',
        workstationType: 'packing',
        estimatedDurationMinutes: 30,
        qcRequired: false,
        dependsOnStepIndices: [5],
        isOptional: false,
      },
    ],
  },
  {
    name: 'Simple Assembly',
    description: 'Minimal routing for items requiring only assembly and packing (e.g., shelf units, flat-pack)',
    productType: 'assembly_only',
    isDefault: false,
    version: 1,
    isActive: true,
    estimatedTotalMinutes: 120,
    steps: [
      {
        stepIndex: 0,
        name: 'Assembly',
        workstationType: 'assembly',
        estimatedDurationMinutes: 60,
        qcRequired: false,
        dependsOnStepIndices: [],
        isOptional: false,
      },
      {
        stepIndex: 1,
        name: 'Hardware Installation',
        workstationType: 'hardware_installation',
        estimatedDurationMinutes: 20,
        qcRequired: false,
        dependsOnStepIndices: [0],
        isOptional: true,
      },
      {
        stepIndex: 2,
        name: 'Quality Inspection',
        workstationType: 'quality_control',
        estimatedDurationMinutes: 15,
        qcRequired: true,
        dependsOnStepIndices: [0, 1],
        isOptional: false,
      },
      {
        stepIndex: 3,
        name: 'Packing',
        workstationType: 'packing',
        estimatedDurationMinutes: 25,
        qcRequired: false,
        dependsOnStepIndices: [2],
        isOptional: false,
      },
    ],
  },
];

async function seed() {
  console.log('Seeding routing templates...\n');

  const batch = db.batch();
  let created = 0;
  let skipped = 0;

  for (const template of TEMPLATES) {
    // Check if a template with this name already exists
    const existing = await db
      .collection('routing_templates')
      .where('name', '==', template.name)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`  SKIP: "${template.name}" already exists`);
      skipped++;
      continue;
    }

    const ref = db.collection('routing_templates').doc();
    batch.set(ref, {
      ...template,
      organizationId: 'default',
      subsidiaryId: 'finishes',
      createdBy: 'system:seed',
      updatedBy: 'system:seed',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  CREATE: "${template.name}" (${template.steps.length} steps)`);
    created++;
  }

  if (created > 0) {
    await batch.commit();
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
