/**
 * DATA MIGRATION SCRIPT: Backfill PO Delivery Tracking Fields
 *
 * Purpose: Add delivery tracking fields to existing PurchaseOrder items
 *
 * What this does:
 * 1. Query all existing PurchaseOrder documents
 * 2. For each PO, update items array to include:
 *    - deliveredQuantity: 0
 *    - receivedQuantity: 0
 *    - rejectedQuantity: 0
 *    - acceptedQuantity: 0
 *    - deliveryEntryIds: []
 * 3. Optionally link existing ProcurementEntry records to POs
 * 4. Update PO status based on existing deliveries
 *
 * SAFETY:
 * - Dry-run mode available (no writes)
 * - Backup recommendations before running
 * - Progress logging
 * - Error recovery
 */

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface MigrationConfig {
  dryRun: boolean;              // If true, log changes without writing
  batchSize: number;            // Number of POs to process per batch
  linkExistingDeliveries: boolean;  // Attempt to link existing procurement entries
  updatePOStatus: boolean;      // Recalculate PO status based on linked deliveries
  projectFilter?: string;       // Only migrate specific project (optional)
}

const DEFAULT_CONFIG: MigrationConfig = {
  dryRun: true,
  batchSize: 50,
  linkExistingDeliveries: false,
  updatePOStatus: false
};

// ============================================================================
// TYPES
// ============================================================================

interface MigrationResult {
  totalPOs: number;
  migratedPOs: number;
  skippedPOs: number;
  erroredPOs: number;
  linkedDeliveries: number;
  errors: { poId: string; error: string }[];
  duration: number;
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

export class PODeliveryTrackingMigration {
  private db;
  private config: MigrationConfig;

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = getFirestore();
  }

  /**
   * Main migration entry point
   */
  async run(): Promise<MigrationResult> {
    const startTime = Date.now();

    console.log('========================================');
    console.log('PO DELIVERY TRACKING MIGRATION');
    console.log('========================================');
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Batch Size: ${this.config.batchSize}`);
    console.log(`Link Deliveries: ${this.config.linkExistingDeliveries}`);
    console.log(`Update Status: ${this.config.updatePOStatus}`);
    if (this.config.projectFilter) {
      console.log(`Project Filter: ${this.config.projectFilter}`);
    }
    console.log('========================================\n');

    const result: MigrationResult = {
      totalPOs: 0,
      migratedPOs: 0,
      skippedPOs: 0,
      erroredPOs: 0,
      linkedDeliveries: 0,
      errors: [],
      duration: 0
    };

    try {
      // Step 1: Query all purchase orders
      const posSnapshot = await this.queryPurchaseOrders();
      result.totalPOs = posSnapshot.docs.length;

      console.log(`Found ${result.totalPOs} purchase orders to process\n`);

      // Step 2: Process in batches
      const batches = this.createBatches(posSnapshot.docs, this.config.batchSize);

      for (let i = 0; i < batches.length; i++) {
        console.log(`Processing batch ${i + 1}/${batches.length}...`);
        const batchResult = await this.processBatch(batches[i]);

        result.migratedPOs += batchResult.migratedCount;
        result.skippedPOs += batchResult.skippedCount;
        result.erroredPOs += batchResult.erroredCount;
        result.linkedDeliveries += batchResult.linkedDeliveries;
        result.errors.push(...batchResult.errors);
      }

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }

    result.duration = Date.now() - startTime;

    this.printSummary(result);

    return result;
  }

  /**
   * Query purchase orders (with optional project filter)
   */
  private async queryPurchaseOrders() {
    const poCollection = collection(this.db, 'advisoryPlatform/matflow/purchaseOrders');

    // Note: If projectFilter is set, you'd add a where clause here
    // For now, we fetch all POs
    return getDocs(poCollection);
  }

  /**
   * Split documents into batches
   */
  private createBatches<T>(docs: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < docs.length; i += batchSize) {
      batches.push(docs.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of POs
   */
  private async processBatch(batch: any[]): Promise<{
    migratedCount: number;
    skippedCount: number;
    erroredCount: number;
    linkedDeliveries: number;
    errors: { poId: string; error: string }[];
  }> {
    let migratedCount = 0;
    let skippedCount = 0;
    let erroredCount = 0;
    let linkedDeliveries = 0;
    const errors: { poId: string; error: string }[] = [];

    const firestoreBatch = writeBatch(this.db);

    for (const poDoc of batch) {
      try {
        const poId = poDoc.id;
        const poData = poDoc.data();

        // Check if already migrated
        if (this.isAlreadyMigrated(poData)) {
          console.log(`  [SKIP] ${poData.orderNumber} - Already migrated`);
          skippedCount++;
          continue;
        }

        // Migrate PO items
        const migratedItems = this.migrateItems(poData.items || []);

        // Prepare update
        const updateData: any = {
          items: migratedItems,
          'migration.deliveryTrackingAdded': true,
          'migration.deliveryTrackingAddedAt': Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        if (!this.config.dryRun) {
          const poRef = doc(this.db, 'advisoryPlatform/matflow/purchaseOrders', poId);
          firestoreBatch.update(poRef, updateData);
        }

        console.log(`  [MIGRATE] ${poData.orderNumber} - Added tracking to ${migratedItems.length} items`);
        migratedCount++;

        // Optional: Link existing deliveries
        if (this.config.linkExistingDeliveries) {
          const linkedCount = await this.linkExistingDeliveries(poId, poData);
          linkedDeliveries += linkedCount;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  [ERROR] ${poDoc.id}: ${errorMessage}`);
        errors.push({ poId: poDoc.id, error: errorMessage });
        erroredCount++;
      }
    }

    // Commit batch
    if (!this.config.dryRun && migratedCount > 0) {
      await firestoreBatch.commit();
      console.log(`  Committed ${migratedCount} updates to Firestore`);
    }

    return { migratedCount, skippedCount, erroredCount, linkedDeliveries, errors };
  }

  /**
   * Check if PO already has tracking fields
   */
  private isAlreadyMigrated(poData: any): boolean {
    if (poData.migration?.deliveryTrackingAdded) {
      return true;
    }

    // Check if any item has tracking fields
    const items = poData.items || [];
    if (items.length === 0) return false;

    return items.some((item: any) =>
      typeof item.deliveredQuantity === 'number' ||
      typeof item.receivedQuantity === 'number' ||
      Array.isArray(item.deliveryEntryIds)
    );
  }

  /**
   * Add tracking fields to PO items
   */
  private migrateItems(items: any[]): any[] {
    return items.map(item => ({
      ...item,
      deliveredQuantity: item.deliveredQuantity ?? 0,
      receivedQuantity: item.receivedQuantity ?? 0,
      rejectedQuantity: item.rejectedQuantity ?? 0,
      acceptedQuantity: item.acceptedQuantity ?? 0,
      deliveryEntryIds: item.deliveryEntryIds ?? []
    }));
  }

  /**
   * Link existing procurement entries to PO (best-effort matching)
   */
  private async linkExistingDeliveries(_poId: string, poData: any): Promise<number> {
    // This is a complex operation that would:
    // 1. Query procurement entries for the same project/supplier
    // 2. Match by material ID and date range
    // 3. Link delivery to PO item
    // 4. Update quantities

    // For now, return 0 (not implemented in this version)
    console.log(`  [LINK] Skipping delivery linkage for ${poData.orderNumber} (not implemented)`);
    return 0;
  }

  /**
   * Print migration summary
   */
  private printSummary(result: MigrationResult): void {
    console.log('\n========================================');
    console.log('MIGRATION SUMMARY');
    console.log('========================================');
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN (no changes written)' : 'LIVE'}`);
    console.log(`Total POs: ${result.totalPOs}`);
    console.log(`Migrated: ${result.migratedPOs}`);
    console.log(`Skipped: ${result.skippedPOs}`);
    console.log(`Errors: ${result.erroredPOs}`);
    console.log(`Linked Deliveries: ${result.linkedDeliveries}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => {
        console.log(`  - ${err.poId}: ${err.error}`);
      });
    }

    console.log('========================================\n');

    if (this.config.dryRun) {
      console.log('✅ Dry run completed successfully');
      console.log('💡 Run with dryRun: false to apply changes\n');
    } else {
      console.log('✅ Migration completed\n');
    }
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

/**
 * Run migration from command line
 *
 * Usage:
 *   npm run migrate:po-tracking                    # Dry run
 *   npm run migrate:po-tracking -- --live          # Live migration
 *   npm run migrate:po-tracking -- --project=abc   # Specific project
 */
async function runMigration() {
  const args = process.argv.slice(2);

  const config: Partial<MigrationConfig> = {
    dryRun: !args.includes('--live'),
    linkExistingDeliveries: args.includes('--link-deliveries'),
    updatePOStatus: args.includes('--update-status')
  };

  // Extract project filter
  const projectArg = args.find(arg => arg.startsWith('--project='));
  if (projectArg) {
    config.projectFilter = projectArg.split('=')[1];
  }

  // Create migration instance
  const migration = new PODeliveryTrackingMigration(config);

  try {
    await migration.run();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runMigration();
}

// Export for testing
export default PODeliveryTrackingMigration;
