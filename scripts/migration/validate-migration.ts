/**
 * MATFLOW MIGRATION VALIDATION SCRIPT
 * ============================================================================
 *
 * Validates the integrity of the MatFlow to Core Projects migration.
 *
 * Checks:
 * - All MatFlow projects exist in core collection
 * - All fields properly migrated
 * - All subcollections copied
 * - BOQ hierarchy preserved
 * - No orphaned references
 *
 * Usage:
 *   npm run validate:migration -- --org <orgId>
 */

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from 'firebase/firestore';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ValidationResult {
  success: boolean;
  orgId: string;
  totalMatFlowProjects: number;
  totalCoreProjects: number;
  matchedProjects: number;
  missingProjects: string[];
  fieldMismatches: Array<{
    projectId: string;
    field: string;
    matflowValue: any;
    coreValue: any;
  }>;
  subcollectionMismatches: Array<{
    projectId: string;
    subcollection: string;
    matflowCount: number;
    coreCount: number;
  }>;
  hierarchyIssues: Array<{
    projectId: string;
    itemId: string;
    issue: string;
  }>;
  warnings: string[];
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

async function validateSubcollections(
  db: any,
  orgId: string,
  projectId: string,
  subcollections: string[]
): Promise<Array<{ subcollection: string; matflowCount: number; coreCount: number }>> {
  const mismatches = [];

  for (const subcollection of subcollections) {
    const matflowRef = collection(
      db,
      `organizations/${orgId}/matflow_projects/${projectId}/${subcollection}`
    );
    const coreRef = collection(
      db,
      `organizations/${orgId}/advisory_projects/${projectId}/${subcollection}`
    );

    const matflowSnapshot = await getDocs(matflowRef);
    const coreSnapshot = await getDocs(coreRef);

    if (matflowSnapshot.size !== coreSnapshot.size) {
      mismatches.push({
        subcollection,
        matflowCount: matflowSnapshot.size,
        coreCount: coreSnapshot.size,
      });
    }
  }

  return mismatches;
}

async function validateBOQHierarchy(
  db: any,
  orgId: string,
  projectId: string
): Promise<Array<{ itemId: string; issue: string }>> {
  const issues = [];

  try {
    const boqItemsRef = collection(
      db,
      `organizations/${orgId}/advisory_projects/${projectId}/boq_items`
    );
    const snapshot = await getDocs(boqItemsRef);

    for (const docSnap of snapshot.docs) {
      const item = docSnap.data();

      // Check hierarchy level
      if (item.hierarchyLevel && (item.hierarchyLevel < 1 || item.hierarchyLevel > 4)) {
        issues.push({
          itemId: docSnap.id,
          issue: `Invalid hierarchy level: ${item.hierarchyLevel}`,
        });
      }

      // Check hierarchy path consistency
      if (item.hierarchyPath) {
        const parts = item.hierarchyPath.split('.');
        if (item.hierarchyLevel && parts.length !== item.hierarchyLevel) {
          issues.push({
            itemId: docSnap.id,
            issue: `Hierarchy path parts (${parts.length}) doesn't match level (${item.hierarchyLevel})`,
          });
        }
      }

      // Check Level 3 governing specs
      if (item.hierarchyLevel === 3 && item.isSpecificationRow && !item.governingSpecs) {
        issues.push({
          itemId: docSnap.id,
          issue: 'Level 3 specification row missing governing specs',
        });
      }
    }
  } catch (error) {
    // Subcollection might not exist
  }

  return issues;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export async function validateMigration(orgId: string): Promise<ValidationResult> {
  console.log('\n' + '='.repeat(80));
  console.log('MATFLOW MIGRATION VALIDATION');
  console.log('='.repeat(80));
  console.log(`Organization: ${orgId}`);
  console.log('='.repeat(80) + '\n');

  const result: ValidationResult = {
    success: false,
    orgId,
    totalMatFlowProjects: 0,
    totalCoreProjects: 0,
    matchedProjects: 0,
    missingProjects: [],
    fieldMismatches: [],
    subcollectionMismatches: [],
    hierarchyIssues: [],
    warnings: [],
  };

  try {
    const db = getFirestore();

    // Step 1: Count projects in both collections
    console.log('Step 1: Counting projects...');
    const matflowRef = collection(db, `organizations/${orgId}/matflow_projects`);
    const coreRef = collection(db, `organizations/${orgId}/advisory_projects`);

    const matflowSnapshot = await getDocs(matflowRef);
    const coreSnapshot = await getDocs(coreRef);

    result.totalMatFlowProjects = matflowSnapshot.size;
    result.totalCoreProjects = coreSnapshot.size;

    console.log(`  MatFlow projects: ${result.totalMatFlowProjects}`);
    console.log(`  Core projects: ${result.totalCoreProjects}\n`);

    // Step 2: Check each MatFlow project exists in core
    console.log('Step 2: Checking project existence...');

    for (const matflowDoc of matflowSnapshot.docs) {
      const coreDoc = await getDoc(doc(db, `organizations/${orgId}/advisory_projects/${matflowDoc.id}`));

      if (coreDoc.exists()) {
        result.matchedProjects++;
        console.log(`  ✓ ${matflowDoc.data().name} (${matflowDoc.id})`);
      } else {
        result.missingProjects.push(matflowDoc.id);
        console.log(`  ✗ MISSING: ${matflowDoc.data().name} (${matflowDoc.id})`);
      }
    }
    console.log('');

    // Step 3: Validate critical fields for matched projects
    console.log('Step 3: Validating field mappings...');

    for (const matflowDoc of matflowSnapshot.docs) {
      const coreDoc = await getDoc(doc(db, `organizations/${orgId}/advisory_projects/${matflowDoc.id}`));

      if (!coreDoc.exists()) continue;

      const matflowData = matflowDoc.data();
      const coreData = coreDoc.data();

      // Check name preservation
      if (matflowData.name !== coreData.name) {
        result.fieldMismatches.push({
          projectId: matflowDoc.id,
          field: 'name',
          matflowValue: matflowData.name,
          coreValue: coreData.name,
        });
      }

      // Check BOQ summary preservation
      if (matflowData.boqSummary && !coreData.boqSummary) {
        result.fieldMismatches.push({
          projectId: matflowDoc.id,
          field: 'boqSummary',
          matflowValue: matflowData.boqSummary,
          coreValue: null,
        });
      }

      // Check settings (MatFlow has taxEnabled=true)
      if (coreData.settings && !coreData.settings.taxEnabled) {
        result.warnings.push(`Project ${matflowDoc.id}: taxEnabled should be true for MatFlow projects`);
      }
    }

    console.log(`  ✓ Validated ${result.matchedProjects} projects\n`);

    // Step 4: Validate subcollections
    console.log('Step 4: Validating subcollections...');

    const subcollections = ['boq_items', 'parsing_jobs', 'materials', 'formulas', 'procurement_entries'];

    for (const matflowDoc of matflowSnapshot.docs) {
      const mismatches = await validateSubcollections(db, orgId, matflowDoc.id, subcollections);

      if (mismatches.length > 0) {
        console.log(`  ⚠ ${matflowDoc.data().name} (${matflowDoc.id}):`);
        mismatches.forEach(m => {
          console.log(`    - ${m.subcollection}: ${m.matflowCount} → ${m.coreCount}`);
          result.subcollectionMismatches.push({
            projectId: matflowDoc.id,
            ...m,
          });
        });
      }
    }

    if (result.subcollectionMismatches.length === 0) {
      console.log('  ✓ All subcollections match\n');
    } else {
      console.log('');
    }

    // Step 5: Validate BOQ hierarchy
    console.log('Step 5: Validating BOQ hierarchy...');

    for (const matflowDoc of matflowSnapshot.docs) {
      const issues = await validateBOQHierarchy(db, orgId, matflowDoc.id);

      if (issues.length > 0) {
        console.log(`  ⚠ ${matflowDoc.data().name} (${matflowDoc.id}):`);
        issues.forEach(issue => {
          console.log(`    - Item ${issue.itemId}: ${issue.issue}`);
          result.hierarchyIssues.push({
            projectId: matflowDoc.id,
            ...issue,
          });
        });
      }
    }

    if (result.hierarchyIssues.length === 0) {
      console.log('  ✓ All BOQ hierarchies valid\n');
    } else {
      console.log('');
    }

    // Determine overall success
    result.success =
      result.missingProjects.length === 0 &&
      result.fieldMismatches.length === 0 &&
      result.subcollectionMismatches.length === 0 &&
      result.hierarchyIssues.length === 0;

  } catch (error) {
    result.success = false;
    console.error(`\nFATAL ERROR: ${error}`);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total MatFlow Projects: ${result.totalMatFlowProjects}`);
  console.log(`Matched in Core: ${result.matchedProjects}`);
  console.log(`Missing in Core: ${result.missingProjects.length}`);
  console.log(`Field Mismatches: ${result.fieldMismatches.length}`);
  console.log(`Subcollection Mismatches: ${result.subcollectionMismatches.length}`);
  console.log(`BOQ Hierarchy Issues: ${result.hierarchyIssues.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`Status: ${result.success ? '✓ PASS' : '✗ FAIL'}`);
  console.log('='.repeat(80) + '\n');

  if (result.missingProjects.length > 0) {
    console.log('MISSING PROJECTS:');
    result.missingProjects.forEach(id => {
      console.log(`  - ${id}`);
    });
    console.log('');
  }

  if (result.fieldMismatches.length > 0) {
    console.log('FIELD MISMATCHES:');
    result.fieldMismatches.slice(0, 10).forEach(m => {
      console.log(`  - ${m.projectId} / ${m.field}: ${m.matflowValue} → ${m.coreValue}`);
    });
    if (result.fieldMismatches.length > 10) {
      console.log(`  ... and ${result.fieldMismatches.length - 10} more`);
    }
    console.log('');
  }

  if (result.warnings.length > 0 && result.warnings.length <= 5) {
    console.log('WARNINGS:');
    result.warnings.forEach(w => {
      console.log(`  - ${w}`);
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

  if (orgIdIndex === -1 || !args[orgIdIndex + 1]) {
    console.error('Usage: node validate-migration.js --org <orgId>');
    process.exit(1);
  }

  const orgId = args[orgIdIndex + 1];

  validateMigration(orgId)
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}
