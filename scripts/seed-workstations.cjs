/**
 * Seed Workstations
 * Populates default workstations for the Dawin Finishes shop floor.
 *
 * Usage: node scripts/seed-workstations.cjs
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

// Default org/subsidiary — matches existing MO data
const ORGANIZATION_ID = 'dawinos';
const SUBSIDIARY_ID = 'finishes';

const WORKSTATIONS = [
  {
    name: 'CNC Router',
    code: 'CNC-01',
    type: 'cutting_cnc',
    location: 'Workshop A',
    maxConcurrentJobs: 1,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Panel Saw',
    code: 'SAW-01',
    type: 'cutting_panel_saw',
    location: 'Workshop A',
    maxConcurrentJobs: 1,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Edge Banding Machine',
    code: 'EB-01',
    type: 'edgebanding',
    location: 'Workshop A',
    maxConcurrentJobs: 1,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Assembly Bay 1',
    code: 'ASM-01',
    type: 'assembly',
    location: 'Workshop B',
    maxConcurrentJobs: 3,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Assembly Bay 2',
    code: 'ASM-02',
    type: 'assembly',
    location: 'Workshop B',
    maxConcurrentJobs: 3,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Hardware Installation',
    code: 'HW-01',
    type: 'hardware_installation',
    location: 'Workshop B',
    maxConcurrentJobs: 2,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Sanding Station',
    code: 'SND-01',
    type: 'sanding',
    location: 'Workshop C',
    maxConcurrentJobs: 2,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Spray Booth',
    code: 'FIN-01',
    type: 'finishing_spray',
    location: 'Workshop C',
    maxConcurrentJobs: 2,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Hand Finishing Station',
    code: 'FIN-02',
    type: 'finishing_hand',
    location: 'Workshop C',
    maxConcurrentJobs: 2,
    operatingHoursPerDay: 8,
  },
  {
    name: 'QC Inspection',
    code: 'QC-01',
    type: 'quality_control',
    location: 'Workshop B',
    maxConcurrentJobs: 2,
    operatingHoursPerDay: 8,
  },
  {
    name: 'Packing Station',
    code: 'PKG-01',
    type: 'packing',
    location: 'Dispatch',
    maxConcurrentJobs: 2,
    operatingHoursPerDay: 8,
  },
];

async function seedWorkstations() {
  console.log('🏭 Seeding workstations...\n');

  // Check for existing workstations
  const existing = await db.collection('workstations')
    .where('organizationId', '==', ORGANIZATION_ID)
    .where('subsidiaryId', '==', SUBSIDIARY_ID)
    .get();

  if (!existing.empty) {
    console.log(`⚠️  Found ${existing.size} existing workstations. Skipping seed to avoid duplicates.`);
    console.log('   Delete existing workstations first if you want to re-seed.');
    return;
  }

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();

  for (const ws of WORKSTATIONS) {
    const ref = db.collection('workstations').doc();
    batch.set(ref, {
      ...ws,
      organizationId: ORGANIZATION_ID,
      subsidiaryId: SUBSIDIARY_ID,
      status: 'operational',
      isActive: true,
      currentActiveJobs: 0,
      currentStepIds: [],
      queuedStepCount: 0,
      assignedOperatorIds: [],
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
    });
    console.log(`  ✅ ${ws.name} (${ws.code}) — ${ws.type} @ ${ws.location}`);
  }

  await batch.commit();
  console.log(`\n🎉 Created ${WORKSTATIONS.length} workstations successfully!`);
}

seedWorkstations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
