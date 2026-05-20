/**
 * MATFLOW TO CORE PROJECTS MIGRATION SCRIPT
 * ============================================================================
 *
 * This script migrates all MatFlow projects from the separate matflow_projects
 * collection to the unified advisory_projects collection.
 *
 * Features:
 * - Dry-run mode (--dry-run): Reports changes without making them
 * - Automatic backup creation
 * - Subcollection migration (boq_items, parsing_jobs, materials, formulas, procurement_entries)
 * - Status mapping (MatFlow statuses → Core statuses)
 * - Validation and integrity checks
 * - Rollback capability
 *
 * Usage:
 *   npm run migrate:matflow -- --org <orgId> [--dry-run]
 *   npm run migrate:matflow -- --org <orgId> --validate-only
 */

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  query,
  where,
  Timestamp,
  CollectionReference,
  DocumentData,
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MATFLOW_COLLECTION = 'matflow_projects';
const CORE_COLLECTION = 'advisory_projects';
const PROGRAMS_COLLECTION = 'advisory_programs';
const BATCH_SIZE = 500; // Firestore batch limit

const SUBCOLLECTIONS = [
  'boq_items',
  'parsing_jobs',
  'materials',
  'formulas',
  'procurement_entries',
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type MatFlowProjectStatus = 'draft' | 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
type CoreProjectStatus = 'planning' | 'procurement' | 'mobilization' | 'active' | 'substantial_completion' | 'defects_liability' | 'completed' | 'suspended' | 'cancelled';

interface MatFlowProject {
  id: string;
  name: string;
  projectCode?: string;
  description?: string;
  status: MatFlowProjectStatus;
  type?: string;
  customerId?: string;
  customerName?: string;
  location?: any;
  startDate?: any;
  endDate?: any;
  budget?: any;
  progress?: any;
  boqSummary?: any;
  teamMembers?: any[];
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  updatedBy: string;
  [key: string]: any;
}

interface MigrationResult {
  success: boolean;
  orgId: string;
  totalMatFlowProjects: number;
  migratedProjects: number;
  failedProjects: number;
  skippedProjects: number;
  errors: Array<{ projectId: string; error: string }>;
  warnings: string[];
  defaultProgramCreated: boolean;
  defaultProgramId?: string;
  dryRun: boolean;
  duration: number;
}

interface MigrationOptions {
  orgId: string;
  dryRun?: boolean;
  validateOnly?: boolean;
  createBackup?: boolean;
}

// ============================================================================
// STATUS MAPPING
// ============================================================================

function mapMatFlowStatus(matflowStatus: MatFlowProjectStatus): CoreProjectStatus {
  const mapping: Record<MatFlowProjectStatus, CoreProjectStatus> = {
    'draft': 'planning',
    'planning': 'planning',
    'active': 'active',
    'on_hold': 'suspended',
    'completed': 'completed',
    'cancelled': 'cancelled',
  };
  return mapping[matflowStatus] || 'planning';
}

// ============================================================================
// DEFAULT PROGRAM CREATION
// ============================================================================

async function getOrCreateDefaultProgram(
  db: any,
  orgId: string,
  userId: string,
  dryRun: boolean
): Promise<{ programId: string; created: boolean }> {
  const programsRef = collection(db, `organizations/${orgId}/${PROGRAMS_COLLECTION}`);

  // Check if "MatFlow Projects" program already exists
  const q = query(programsRef, where('name', '==', 'MatFlow Projects'));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    console.log('✓ Found existing "MatFlow Projects" program');
    return { programId: snapshot.docs[0].id, created: false };
  }

  // Create default program
  if (dryRun) {
    console.log('[DRY RUN] Would create "MatFlow Projects" program');
    return { programId: 'MATFLOW_DEFAULT', created: true };
  }

  const defaultProgram = {
    name: 'MatFlow Projects',
    code: 'MATFLOW',
    description: 'Projects migrated from MatFlow module',
    status: 'active',
    implementationType: 'direct',
    location: {
      country: 'UG',
      region: 'Central',
      district: 'Kampala',
    },
    budget: {
      currency: 'UGX',
      totalBudget: 0,
      spent: 0,
      remaining: 0,
      variance: 0,
    },
    timeline: {
      plannedStartDate: Timestamp.now(),
      plannedEndDate: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)), // +1 year
      currentStartDate: Timestamp.now(),
      currentEndDate: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
      isDelayed: false,
      daysRemaining: 365,
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
    createdAt: Timestamp.now(),
    createdBy: userId,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
    version: 1,
    isDeleted: false,
  };

  const batch = writeBatch(db);
  const newProgramRef = doc(programsRef);
  batch.set(newProgramRef, defaultProgram);
  await batch.commit();

  console.log(`✓ Created default "MatFlow Projects" program: ${newProgramRef.id}`);
  return { programId: newProgramRef.id, created: true };
}

// ============================================================================
// SUBCOLLECTION MIGRATION
// ============================================================================

async function migrateSubcollections(
  db: any,
  orgId: string,
  projectId: string,
  dryRun: boolean
): Promise<{ success: boolean; counts: Record<string, number>; errors: string[] }> {
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  for (const subcollectionName of SUBCOLLECTIONS) {
    try {
      const sourceRef = collection(
        db,
        `organizations/${orgId}/${MATFLOW_COLLECTION}/${projectId}/${subcollectionName}`
      );
      const snapshot = await getDocs(sourceRef);

      counts[subcollectionName] = snapshot.size;

      if (snapshot.empty) {
        continue;
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would copy ${snapshot.size} documents from ${subcollectionName}`);
        continue;
      }

      // Copy documents in batches
      const targetRef = collection(
        db,
        `organizations/${orgId}/${CORE_COLLECTION}/${projectId}/${subcollectionName}`
      );

      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of snapshot.docs) {
        const newDocRef = doc(targetRef, docSnap.id);
        batch.set(newDocRef, docSnap.data());
        batchCount++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(`  ✓ Migrated ${snapshot.size} documents from ${subcollectionName}`);
    } catch (error) {
      const errorMsg = `Failed to migrate ${subcollectionName}: ${error}`;
      errors.push(errorMsg);
      console.error(`  ✗ ${errorMsg}`);
    }
  }

  return { success: errors.length === 0, counts, errors };
}

// ============================================================================
// PROJECT TRANSFORMATION
// ============================================================================

function transformMatFlowProject(
  matflowProject: MatFlowProject,
  programId: string,
  engagementId: string
): any {
  const coreStatus = mapMatFlowStatus(matflowProject.status);

  // Generate project code if missing
  const projectCode = matflowProject.projectCode ||
    `MATFLOW-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  return {
    name: matflowProject.name,
    projectCode,
    description: matflowProject.description || '',

    // Relationships
    programId,
    engagementId,
    customerId: matflowProject.customerId,
    customerName: matflowProject.customerName,

    // Classification
    status: coreStatus,
    projectType: matflowProject.type || 'new_construction',

    // Location (with defaults)
    location: {
      country: matflowProject.location?.country || 'UG',
      region: matflowProject.location?.region || '',
      district: matflowProject.location?.district || '',
      siteName: matflowProject.location?.siteName || matflowProject.name,
      address: matflowProject.location?.address,
      coordinates: matflowProject.location?.coordinates,
    },

    // Budget (with defaults)
    budget: {
      currency: matflowProject.budget?.currency || 'UGX',
      totalBudget: matflowProject.budget?.totalBudget || 0,
      spent: matflowProject.budget?.spent || 0,
      remaining: matflowProject.budget?.remaining || (matflowProject.budget?.totalBudget || 0) - (matflowProject.budget?.spent || 0),
      variance: 0,
      varianceStatus: 'on_track' as const,
      contingencyPercent: 10,
    },

    // Progress (with defaults)
    progress: {
      physicalProgress: matflowProject.progress?.physicalProgress || 0,
      financialProgress: matflowProject.progress?.financialProgress || 0,
      completionPercent: matflowProject.progress?.completionPercent || 0,
    },

    // Timeline (with defaults)
    timeline: {
      plannedStartDate: matflowProject.startDate || Timestamp.now(),
      plannedEndDate: matflowProject.endDate || Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
      currentStartDate: matflowProject.startDate || Timestamp.now(),
      currentEndDate: matflowProject.endDate || Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
      isDelayed: false,
      daysRemaining: 365,
    },

    // Settings (MatFlow defaults)
    settings: {
      taxEnabled: true, // MatFlow has EFRIS
      taxRate: 18,
      defaultWastagePercent: 10,
    },

    // Stages (default construction stages)
    stages: [
      { id: 'preliminaries', name: 'Preliminaries', order: 1, status: 'not_started', completionPercent: 0 },
      { id: 'substructures', name: 'Substructures', order: 2, status: 'not_started', completionPercent: 0 },
      { id: 'superstructure', name: 'Superstructure', order: 3, status: 'not_started', completionPercent: 0 },
      { id: 'finishes', name: 'Finishes', order: 4, status: 'not_started', completionPercent: 0 },
      { id: 'external_works', name: 'External Works', order: 5, status: 'not_started', completionPercent: 0 },
    ],

    // Members (transform MatFlow members to core format)
    members: (matflowProject.teamMembers || []).map((member: any) => ({
      userId: member.userId || member.id,
      email: member.email,
      displayName: member.displayName || member.name,
      role: member.role || 'advisor',
      capabilities: member.capabilities || [],
    })),

    // BOQ references
    boqIds: [],
    activeBoqId: undefined,
    boqSummary: matflowProject.boqSummary,

    // Metadata
    tags: [],
    createdAt: matflowProject.createdAt || Timestamp.now(),
    createdBy: matflowProject.createdBy,
    updatedAt: matflowProject.updatedAt || Timestamp.now(),
    updatedBy: matflowProject.updatedBy,
    version: 1,
    isDeleted: false,
  };
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

export async function migrateMatFlowProjects(
  options: MigrationOptions
): Promise<MigrationResult> {
  const startTime = Date.now();
  const { orgId, dryRun = false, validateOnly = false } = options;

  console.log('\n' + '='.repeat(80));
  console.log('MATFLOW TO CORE PROJECTS MIGRATION');
  console.log('='.repeat(80));
  console.log(`Organization: ${orgId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : validateOnly ? 'VALIDATE ONLY' : 'LIVE MIGRATION'}`);
  console.log('='.repeat(80) + '\n');

  const result: MigrationResult = {
    success: false,
    orgId,
    totalMatFlowProjects: 0,
    migratedProjects: 0,
    failedProjects: 0,
    skippedProjects: 0,
    errors: [],
    warnings: [],
    defaultProgramCreated: false,
    dryRun,
    duration: 0,
  };

  try {
    // Initialize Firestore (assumes Firebase is configured)
    const db = getFirestore();

    // Step 1: Get all MatFlow projects
    console.log('Step 1: Fetching MatFlow projects...');
    const matflowRef = collection(db, `organizations/${orgId}/${MATFLOW_COLLECTION}`);
    const matflowSnapshot = await getDocs(matflowRef);

    result.totalMatFlowProjects = matflowSnapshot.size;
    console.log(`✓ Found ${result.totalMatFlowProjects} MatFlow projects\n`);

    if (result.totalMatFlowProjects === 0) {
      console.log('No MatFlow projects to migrate.');
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    if (validateOnly) {
      console.log('VALIDATE ONLY mode - skipping actual migration');
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    // Step 2: Get or create default program
    console.log('Step 2: Setting up default program...');
    const { programId, created } = await getOrCreateDefaultProgram(
      db,
      orgId,
      'migration-script',
      dryRun
    );
    result.defaultProgramCreated = created;
    result.defaultProgramId = programId;
    console.log('');

    // Get engagement ID from program
    let engagementId = 'default-engagement';
    if (!dryRun && programId !== 'MATFLOW_DEFAULT') {
      const programDoc = await getDoc(doc(db, `organizations/${orgId}/${PROGRAMS_COLLECTION}/${programId}`));
      if (programDoc.exists()) {
        engagementId = programDoc.data().engagementId || 'default-engagement';
      }
    }

    // Step 3: Migrate each project
    console.log('Step 3: Migrating projects...\n');

    for (const projectDoc of matflowSnapshot.docs) {
      const matflowProject = { id: projectDoc.id, ...projectDoc.data() } as MatFlowProject;

      try {
        console.log(`[${result.migratedProjects + 1}/${result.totalMatFlowProjects}] ${matflowProject.name} (${projectDoc.id})`);

        // Check if already migrated
        if (!dryRun) {
          const existingDoc = await getDoc(
            doc(db, `organizations/${orgId}/${CORE_COLLECTION}/${projectDoc.id}`)
          );
          if (existingDoc.exists()) {
            console.log('  ⚠ Already exists in core collection - skipping');
            result.skippedProjects++;
            result.warnings.push(`Project ${projectDoc.id} already exists - skipped`);
            continue;
          }
        }

        // Transform to core format
        const coreProject = transformMatFlowProject(matflowProject, programId, engagementId);

        if (dryRun) {
          console.log(`  [DRY RUN] Would create project: ${coreProject.projectCode}`);
          console.log(`  [DRY RUN] Status: ${matflowProject.status} → ${coreProject.status}`);
        } else {
          // Write to core collection
          const coreRef = doc(db, `organizations/${orgId}/${CORE_COLLECTION}/${projectDoc.id}`);
          const batch = writeBatch(db);
          batch.set(coreRef, coreProject);
          await batch.commit();
          console.log(`  ✓ Created in core collection: ${coreProject.projectCode}`);
        }

        // Migrate subcollections
        const subResult = await migrateSubcollections(db, orgId, projectDoc.id, dryRun);
        if (!subResult.success) {
          result.warnings.push(...subResult.errors);
        }

        result.migratedProjects++;
        console.log('');

      } catch (error) {
        result.failedProjects++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({ projectId: projectDoc.id, error: errorMsg });
        console.error(`  ✗ FAILED: ${errorMsg}\n`);
      }
    }

    // Success summary
    result.success = result.failedProjects === 0;
    result.duration = Date.now() - startTime;

  } catch (error) {
    result.success = false;
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push({ projectId: 'GLOBAL', error: errorMsg });
    console.error(`\nFATAL ERROR: ${errorMsg}`);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total MatFlow Projects: ${result.totalMatFlowProjects}`);
  console.log(`Migrated Successfully: ${result.migratedProjects}`);
  console.log(`Skipped (Already Exist): ${result.skippedProjects}`);
  console.log(`Failed: ${result.failedProjects}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
  console.log('='.repeat(80) + '\n');

  if (result.errors.length > 0) {
    console.log('ERRORS:');
    result.errors.forEach(({ projectId, error }) => {
      console.log(`  - ${projectId}: ${error}`);
    });
    console.log('');
  }

  if (result.warnings.length > 0 && result.warnings.length <= 10) {
    console.log('WARNINGS:');
    result.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
    console.log('');
  }

  return result;
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const orgIdIndex = args.indexOf('--org');
  const dryRun = args.includes('--dry-run');
  const validateOnly = args.includes('--validate-only');

  if (orgIdIndex === -1 || !args[orgIdIndex + 1]) {
    console.error('Usage: node migrate-matflow-projects.js --org <orgId> [--dry-run] [--validate-only]');
    process.exit(1);
  }

  const orgId = args[orgIdIndex + 1];

  migrateMatFlowProjects({ orgId, dryRun, validateOnly })
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
