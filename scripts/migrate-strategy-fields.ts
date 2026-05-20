/**
 * Firestore Migration Script: Add Strategy Fields to Design Items
 *
 * This script adds strategyContext and budgetTracking fields to existing design items.
 *
 * Usage:
 *   # Dry run (show what would change, no writes)
 *   npx ts-node --esm scripts/migrate-strategy-fields.ts
 *
 *   # Execute migration (actually write to Firestore)
 *   npx ts-node --esm scripts/migrate-strategy-fields.ts --execute
 *
 *   # Migrate specific project only
 *   npx ts-node --esm scripts/migrate-strategy-fields.ts --project=PROJECT_ID --execute
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// ============================================
// Configuration
// ============================================

const DRY_RUN = !process.argv.includes('--execute');
const SPECIFIC_PROJECT = process.argv.find(arg => arg.startsWith('--project='))?.split('=')[1];
const BATCH_SIZE = 100; // Firestore batch write limit is 500, using 100 for safety

// ============================================
// Initialize Firebase Admin
// ============================================

function initializeFirebase() {
  if (getApps().length === 0) {
    // Look for service account key in common locations
    const possiblePaths = [
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'firebase-admin-key.json'),
      path.resolve(process.cwd(), 'config/serviceAccountKey.json'),
    ];

    let serviceAccountPath: string | undefined;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        serviceAccountPath = p;
        break;
      }
    }

    if (!serviceAccountPath) {
      console.error('❌ Service account key not found. Please create serviceAccountKey.json in the project root.');
      console.error('   Download it from Firebase Console > Project Settings > Service Accounts');
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    initializeApp({
      credential: cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized\n');
  }

  return getFirestore();
}

// ============================================
// Types
// ============================================

interface DesignItem {
  id: string;
  name: string;
  sourcingType?: string;
  strategyContext?: {
    strategyId: string;
    budgetTier?: 'economy' | 'standard' | 'premium' | 'luxury';
    spaceMultiplier?: number;
    scopingConfidence?: number;
    deliverableType?: string;
  };
  budgetTracking?: {
    allocatedBudget?: number;
    actualCost?: number;
    variance?: number;
    lastUpdated?: Timestamp;
  };
  manufacturing?: {
    totalCost?: number;
    costPerUnit?: number;
  };
  procurement?: {
    totalLandedCost?: number;
  };
  construction?: {
    totalCost?: number;
  };
  architectural?: {
    pricingMatrix?: Record<string, number>;
  };
}

interface ProjectStrategy {
  id: string;
  budgetFramework?: {
    tier?: 'economy' | 'standard' | 'premium' | 'luxury';
  };
}

interface MigrationStats {
  projectsProcessed: number;
  itemsProcessed: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errors: Array<{ projectId: string; itemId: string; error: string }>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Estimate actual cost from item data
 */
function estimateActualCost(item: DesignItem): number {
  // MANUFACTURED / CUSTOM_FURNITURE_MILLWORK
  if (item.manufacturing?.totalCost) {
    return item.manufacturing.totalCost;
  }

  // PROCURED
  if (item.procurement?.totalLandedCost) {
    return item.procurement.totalLandedCost;
  }

  // CONSTRUCTION
  if (item.construction?.totalCost) {
    return item.construction.totalCost;
  }

  // DESIGN_DOCUMENT (architectural)
  if (item.architectural?.pricingMatrix) {
    // Sum all hours in pricing matrix (simplified, actual calculation is more complex)
    const totalHours = Object.values(item.architectural.pricingMatrix).reduce((sum, h) => sum + (h || 0), 0);
    // Rough estimate: 300000 UGX per hour average
    return totalHours * 300000;
  }

  return 0;
}

/**
 * Check if item needs migration
 */
function needsMigration(item: DesignItem): boolean {
  return !item.strategyContext || !item.budgetTracking;
}

/**
 * Build migration data for an item
 */
function buildMigrationData(
  item: DesignItem,
  projectId: string,
  strategy: ProjectStrategy | null
): Partial<DesignItem> {
  const updates: any = {};

  // Add strategyContext if missing
  if (!item.strategyContext) {
    updates.strategyContext = {
      strategyId: projectId,
      budgetTier: strategy?.budgetFramework?.tier || 'standard',
      spaceMultiplier: 1,
      scopingConfidence: 0.75, // Default confidence for existing items
      deliverableType: item.sourcingType || 'unknown',
    };
  }

  // Add budgetTracking if missing
  if (!item.budgetTracking) {
    const actualCost = estimateActualCost(item);

    updates.budgetTracking = {
      allocatedBudget: 0, // To be set manually by user
      actualCost,
      variance: actualCost, // variance = actualCost - allocatedBudget (0)
      lastUpdated: Timestamp.now(),
    };
  }

  return updates;
}

// ============================================
// Migration Functions
// ============================================

/**
 * Fetch project strategy
 */
async function fetchProjectStrategy(db: FirebaseFirestore.Firestore, projectId: string): Promise<ProjectStrategy | null> {
  try {
    const strategyDoc = await db.collection('projectStrategy').doc(projectId).get();
    if (!strategyDoc.exists) {
      return null;
    }

    return {
      id: strategyDoc.id,
      ...strategyDoc.data(),
    } as ProjectStrategy;
  } catch (err) {
    console.warn(`⚠️  Could not fetch strategy for project ${projectId}:`, err);
    return null;
  }
}

/**
 * Migrate a single project
 */
async function migrateProject(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n📦 Processing project: ${projectId}`);

  // Fetch project strategy
  const strategy = await fetchProjectStrategy(db, projectId);
  if (strategy) {
    console.log(`   Strategy found with budget tier: ${strategy.budgetFramework?.tier || 'none'}`);
  } else {
    console.log(`   No strategy found (will use defaults)`);
  }

  // Fetch all design items
  const itemsSnapshot = await db
    .collection('designProjects')
    .doc(projectId)
    .collection('designItems')
    .get();

  if (itemsSnapshot.empty) {
    console.log(`   No design items found`);
    return;
  }

  console.log(`   Found ${itemsSnapshot.size} design items`);

  // Process items in batches
  const itemsToUpdate: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];

  for (const doc of itemsSnapshot.docs) {
    const item = { id: doc.id, ...doc.data() } as DesignItem;
    stats.itemsProcessed++;

    if (!needsMigration(item)) {
      stats.itemsSkipped++;
      continue;
    }

    const updates = buildMigrationData(item, projectId, strategy);

    itemsToUpdate.push({
      ref: doc.ref,
      data: updates,
    });
  }

  if (itemsToUpdate.length === 0) {
    console.log(`   ✓ All items already have strategy fields`);
    return;
  }

  console.log(`   📝 ${itemsToUpdate.length} items need migration`);

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would update ${itemsToUpdate.length} items`);
    // Show sample of what would be updated
    const sample = itemsToUpdate.slice(0, 3);
    for (const { ref, data } of sample) {
      console.log(`      - ${ref.id}: ${JSON.stringify(data, null, 2).split('\n').join('\n        ')}`);
    }
    if (itemsToUpdate.length > 3) {
      console.log(`      ... and ${itemsToUpdate.length - 3} more`);
    }
    stats.itemsUpdated += itemsToUpdate.length;
  } else {
    // Execute batch writes
    let batchCount = 0;
    let batch = db.batch();
    let batchOps = 0;

    for (const { ref, data } of itemsToUpdate) {
      batch.update(ref, data);
      batchOps++;
      stats.itemsUpdated++;

      if (batchOps >= BATCH_SIZE) {
        await batch.commit();
        batchCount++;
        console.log(`      ✓ Committed batch ${batchCount} (${batchOps} items)`);
        batch = db.batch();
        batchOps = 0;
      }
    }

    // Commit remaining items
    if (batchOps > 0) {
      await batch.commit();
      batchCount++;
      console.log(`      ✓ Committed batch ${batchCount} (${batchOps} items)`);
    }

    console.log(`   ✅ Updated ${itemsToUpdate.length} items`);
  }

  stats.projectsProcessed++;
}

/**
 * Run migration
 */
async function runMigration() {
  console.log('🚀 Strategy Fields Migration Script\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✍️  EXECUTE (will write to Firestore)'}`);
  if (SPECIFIC_PROJECT) {
    console.log(`Target: Specific project ${SPECIFIC_PROJECT}`);
  } else {
    console.log(`Target: All projects`);
  }
  console.log('');

  const db = initializeFirebase();

  const stats: MigrationStats = {
    projectsProcessed: 0,
    itemsProcessed: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    errors: [],
  };

  try {
    if (SPECIFIC_PROJECT) {
      // Migrate single project
      await migrateProject(db, SPECIFIC_PROJECT, stats);
    } else {
      // Migrate all projects
      const projectsSnapshot = await db.collection('designProjects').get();
      console.log(`📋 Found ${projectsSnapshot.size} total projects\n`);

      for (const projectDoc of projectsSnapshot.docs) {
        try {
          await migrateProject(db, projectDoc.id, stats);
        } catch (err) {
          console.error(`❌ Error processing project ${projectDoc.id}:`, err);
          stats.errors.push({
            projectId: projectDoc.id,
            itemId: 'N/A',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Projects processed:  ${stats.projectsProcessed}`);
    console.log(`Items processed:     ${stats.itemsProcessed}`);
    console.log(`Items updated:       ${stats.itemsUpdated}`);
    console.log(`Items skipped:       ${stats.itemsSkipped}`);
    console.log(`Errors:              ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      for (const err of stats.errors) {
        console.log(`   - Project ${err.projectId}, Item ${err.itemId}: ${err.error}`);
      }
    }

    if (DRY_RUN && stats.itemsUpdated > 0) {
      console.log('\n💡 This was a dry run. To execute the migration, run:');
      console.log('   npx ts-node --esm scripts/migrate-strategy-fields.ts --execute');
    } else if (!DRY_RUN && stats.itemsUpdated > 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n✓ No items needed migration');
    }

    console.log('');
  } catch (err) {
    console.error('\n❌ Fatal error during migration:', err);
    process.exit(1);
  }
}

// ============================================
// Main
// ============================================

runMigration().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
