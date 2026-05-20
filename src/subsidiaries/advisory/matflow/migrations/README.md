# Purchase Order Delivery Tracking Migration

This directory contains data migration scripts for backfilling existing purchase orders with delivery tracking fields.

## Migration: Backfill PO Delivery Tracking

**File**: `backfill-po-delivery-tracking.ts`

### Purpose
Add delivery tracking fields to existing `PurchaseOrder` items that were created before the Phase 1 enhancement.

### What It Does

For each existing purchase order, the migration:

1. ✅ Adds delivery tracking fields to all items:
   ```typescript
   {
     deliveredQuantity: 0,
     receivedQuantity: 0,
     rejectedQuantity: 0,
     acceptedQuantity: 0,
     deliveryEntryIds: []
   }
   ```

2. ✅ Marks PO as migrated with metadata:
   ```typescript
   {
     migration: {
       deliveryTrackingAdded: true,
       deliveryTrackingAddedAt: Timestamp.now()
     }
   }
   ```

3. ⚠️ Optionally attempts to link existing `ProcurementEntry` records (disabled by default)

4. ⚠️ Optionally recalculates PO status based on deliveries (disabled by default)

---

## Running the Migration

### Prerequisites

1. **Backup your data**:
   ```bash
   # Export Firestore data
   gcloud firestore export gs://your-backup-bucket/pre-po-migration
   ```

2. **Review the code**:
   - Read through `backfill-po-delivery-tracking.ts`
   - Understand what changes will be made
   - Check the configuration options

3. **Test in development first**:
   ```bash
   # Point to dev environment
   export FIREBASE_PROJECT_ID=your-dev-project
   ```

---

### Step 1: Dry Run (Recommended)

Run the migration in dry-run mode to see what would change **without writing to Firestore**:

```bash
# Dry run - no changes written
npm run migrate:po-tracking

# Or using ts-node directly
npx ts-node src/subsidiaries/advisory/matflow/migrations/backfill-po-delivery-tracking.ts
```

**Expected Output**:
```
========================================
PO DELIVERY TRACKING MIGRATION
========================================
Mode: DRY RUN
Batch Size: 50
Link Deliveries: false
Update Status: false
========================================

Found 234 purchase orders to process

Processing batch 1/5...
  [MIGRATE] PO-2026-001 - Added tracking to 3 items
  [MIGRATE] PO-2026-002 - Added tracking to 5 items
  [SKIP] PO-2026-003 - Already migrated
  ...

========================================
MIGRATION SUMMARY
========================================
Mode: DRY RUN (no changes written)
Total POs: 234
Migrated: 198
Skipped: 35
Errors: 1
Linked Deliveries: 0
Duration: 2.34s
========================================

✅ Dry run completed successfully
💡 Run with dryRun: false to apply changes
```

---

### Step 2: Live Migration

After reviewing the dry run results, run the actual migration:

```bash
# LIVE MIGRATION - writes to Firestore
npm run migrate:po-tracking -- --live
```

**⚠️ WARNING**: This will modify your Firestore data. Ensure you have a backup!

---

### Step 3: Verify Results

After migration, verify the changes:

```bash
# Check a few POs in Firestore console
# Verify items have new tracking fields
# Confirm migration metadata present
```

Query Firestore to check:
```typescript
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const db = getFirestore();
const posRef = collection(db, 'advisoryPlatform/matflow/purchaseOrders');
const migratedQuery = query(posRef, where('migration.deliveryTrackingAdded', '==', true));
const snapshot = await getDocs(migratedQuery);

console.log(`${snapshot.size} POs migrated successfully`);
```

---

## Configuration Options

### Command-Line Flags

```bash
# Default (dry run)
npm run migrate:po-tracking

# Live migration
npm run migrate:po-tracking -- --live

# Filter to specific project
npm run migrate:po-tracking -- --live --project=proj-123

# Link existing deliveries (experimental)
npm run migrate:po-tracking -- --live --link-deliveries

# Update PO status based on deliveries
npm run migrate:po-tracking -- --live --update-status

# Combine flags
npm run migrate:po-tracking -- --live --project=proj-123 --link-deliveries
```

### Programmatic Configuration

```typescript
import { PODeliveryTrackingMigration } from './backfill-po-delivery-tracking';

const migration = new PODeliveryTrackingMigration({
  dryRun: false,              // Set to true for dry run
  batchSize: 50,              // Process 50 POs per batch
  linkExistingDeliveries: false,  // Attempt to link existing deliveries
  updatePOStatus: false,      // Recalculate PO status
  projectFilter: 'proj-123'   // Only migrate specific project
});

const result = await migration.run();
console.log(`Migrated ${result.migratedPOs} purchase orders`);
```

---

## Rollback Strategy

If the migration causes issues:

### Option 1: Restore from Backup

```bash
# Restore Firestore from backup
gcloud firestore import gs://your-backup-bucket/pre-po-migration
```

### Option 2: Manual Rollback Script

```typescript
/**
 * Rollback script - remove migration fields
 */
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

async function rollbackMigration() {
  const db = getFirestore();
  const posRef = collection(db, 'advisoryPlatform/matflow/purchaseOrders');
  const snapshot = await getDocs(posRef);

  for (const poDoc of snapshot.docs) {
    const items = poDoc.data().items.map((item: any) => {
      const { deliveredQuantity, receivedQuantity, rejectedQuantity, acceptedQuantity, deliveryEntryIds, ...rest } = item;
      return rest;
    });

    await updateDoc(doc(db, 'advisoryPlatform/matflow/purchaseOrders', poDoc.id), {
      items,
      migration: null
    });
  }

  console.log(`Rolled back ${snapshot.size} purchase orders`);
}
```

---

## Common Issues

### Issue: "Cannot find module 'firebase/firestore'"

**Solution**:
```bash
npm install firebase firebase-admin
```

### Issue: "Permission denied" errors

**Solution**:
```bash
# Authenticate with Firebase
firebase login
gcloud auth application-default login
```

### Issue: Migration times out

**Solution**: Reduce batch size
```typescript
const migration = new PODeliveryTrackingMigration({
  batchSize: 25  // Reduce from 50 to 25
});
```

### Issue: Some POs show as "already migrated" unexpectedly

**Cause**: POs created during/after Phase 1 deployment already have tracking fields

**Solution**: This is expected - these POs are skipped automatically

---

## Performance Considerations

### Expected Duration

- **Small dataset** (<100 POs): ~5-10 seconds
- **Medium dataset** (100-1000 POs): ~30-60 seconds
- **Large dataset** (1000+ POs): ~2-5 minutes

### Batch Size Recommendations

- **Development/Testing**: 10-25 (easier to debug)
- **Production**: 50 (default, good balance)
- **Large migration**: 100 (faster but less granular error handling)

### Firestore Costs

- **Reads**: 1 per PO (to query existing data)
- **Writes**: 1 per migrated PO
- **Example**: 500 POs = 500 reads + 500 writes = ~$0.10

---

## Testing the Migration

### Unit Tests

```typescript
import { PODeliveryTrackingMigration } from './backfill-po-delivery-tracking';

describe('PO Delivery Tracking Migration', () => {
  it('should add tracking fields to PO items', () => {
    const migration = new PODeliveryTrackingMigration({ dryRun: true });
    const items = [
      { materialId: 'mat-1', quantity: 10, unitPrice: 1000 }
    ];

    const migrated = migration['migrateItems'](items);

    expect(migrated[0].deliveredQuantity).toBe(0);
    expect(migrated[0].deliveryEntryIds).toEqual([]);
  });
});
```

### Integration Test

Run migration against test data:

```bash
# Use test project
export FIREBASE_PROJECT_ID=test-project

# Seed test data
npm run seed:test-pos

# Run migration
npm run migrate:po-tracking -- --live

# Verify results
npm run verify:po-migration
```

---

## Post-Migration Checklist

After successful migration:

- [ ] Verify all POs have tracking fields
- [ ] Check migration metadata on POs
- [ ] Test creating new deliveries
- [ ] Test linking deliveries to migrated POs
- [ ] Verify PO status updates work correctly
- [ ] Monitor error logs for any issues
- [ ] Update team documentation
- [ ] Enable Phase 2 (Accountability integration)

---

## Support

For issues with migration:
- Check Firestore logs: Firebase Console → Firestore → Usage
- Review error messages in migration output
- Test with smaller batch size
- Contact development team with error details
- Reference implementation plan: `/Users/ofd/.claude/plans/validated-hatching-conway.md`
