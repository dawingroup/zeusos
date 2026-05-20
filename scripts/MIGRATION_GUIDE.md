# Strategy Fields Migration Guide

This guide explains how to run the Firestore migration script to add `strategyContext` and `budgetTracking` fields to existing design items.

## Overview

The migration script adds two new fields to all existing design items:

### 1. **strategyContext**
Links design items to their project strategy and stores strategy-related metadata:
- `strategyId`: Links to the project strategy document
- `budgetTier`: Budget tier from strategy (economy/standard/premium/luxury)
- `spaceMultiplier`: For quantity calculations (default: 1)
- `scopingConfidence`: AI confidence score (default: 0.75 for existing items)
- `deliverableType`: Type of deliverable from scoping

### 2. **budgetTracking**
Tracks budget allocation and variance for each item:
- `allocatedBudget`: Target budget for this item (default: 0, to be set manually)
- `actualCost`: Estimated from existing cost data (manufacturing/procurement/construction)
- `variance`: Difference between actual and allocated
- `lastUpdated`: Timestamp of last update

## Prerequisites

1. **Firebase Admin Service Account Key**

   Download from Firebase Console → Project Settings → Service Accounts → Generate new private key

   Save as `serviceAccountKey.json` in the project root

2. **Node.js and TypeScript**

   Ensure you have Node.js installed and the project dependencies:
   ```bash
   npm install
   ```

## Usage

### 1. Dry Run (Recommended First Step)

Preview what would be changed without writing to Firestore:

```bash
npx ts-node --esm scripts/migrate-strategy-fields.ts
```

This will:
- Show which projects and items would be updated
- Display sample data of what would be written
- Print a summary report
- **NOT write anything to Firestore**

### 2. Execute Migration

Once you've reviewed the dry run output and are ready to proceed:

```bash
npx ts-node --esm scripts/migrate-strategy-fields.ts --execute
```

This will:
- Update all design items across all projects
- Write changes to Firestore in batches (100 items per batch)
- Print progress for each project
- Show final summary report

### 3. Migrate Specific Project Only

To migrate a single project:

```bash
npx ts-node --esm scripts/migrate-strategy-fields.ts --project=YOUR_PROJECT_ID --execute
```

Replace `YOUR_PROJECT_ID` with the actual project ID.

## Migration Logic

### For Each Design Item:

1. **Check if migration needed**: Skip items that already have both `strategyContext` and `budgetTracking`

2. **Fetch project strategy**: Load strategy document to get budget tier (if exists)

3. **Add strategyContext**:
   - `strategyId`: Set to project ID
   - `budgetTier`: From strategy, or 'standard' if no strategy
   - `spaceMultiplier`: Default to 1
   - `scopingConfidence`: Default to 0.75 (existing items)
   - `deliverableType`: From item's sourcingType

4. **Add budgetTracking**:
   - `allocatedBudget`: Default to 0 (user should set manually)
   - `actualCost`: Estimated from:
     - MANUFACTURED: `manufacturing.totalCost`
     - PROCURED: `procurement.totalLandedCost`
     - CONSTRUCTION: `construction.totalCost`
     - DESIGN_DOCUMENT: Rough estimate from `architectural.pricingMatrix`
   - `variance`: `actualCost - allocatedBudget` (will be actualCost since allocated is 0)
   - `lastUpdated`: Current timestamp

## Safety Features

✅ **Dry run by default** - Always preview before writing

✅ **Batch writes** - Processes items in batches of 100 to stay within Firestore limits

✅ **Error handling** - Continues processing other items if one fails

✅ **Skip existing** - Only updates items missing the new fields

✅ **Progress logging** - Shows detailed progress for each project

✅ **Summary report** - Final statistics on what was updated

## Expected Output

### Dry Run Example:
```
🚀 Strategy Fields Migration Script

Mode: 🔍 DRY RUN (no writes)
Target: All projects

✅ Firebase Admin initialized

📋 Found 12 total projects

📦 Processing project: abc123def456
   Strategy found with budget tier: premium
   Found 24 design items
   📝 15 items need migration
   [DRY RUN] Would update 15 items
      - item1: { strategyContext: {...}, budgetTracking: {...} }
      - item2: { strategyContext: {...}, budgetTracking: {...} }
      - item3: { strategyContext: {...}, budgetTracking: {...} }
      ... and 12 more

[... more projects ...]

============================================================
📊 Migration Summary
============================================================
Projects processed:  12
Items processed:     287
Items updated:       156
Items skipped:       131
Errors:              0

💡 This was a dry run. To execute the migration, run:
   npx ts-node --esm scripts/migrate-strategy-fields.ts --execute
```

### Execute Example:
```
🚀 Strategy Fields Migration Script

Mode: ✍️  EXECUTE (will write to Firestore)
Target: All projects

✅ Firebase Admin initialized

📋 Found 12 total projects

📦 Processing project: abc123def456
   Strategy found with budget tier: premium
   Found 24 design items
   📝 15 items need migration
      ✓ Committed batch 1 (15 items)
   ✅ Updated 15 items

[... more projects ...]

============================================================
📊 Migration Summary
============================================================
Projects processed:  12
Items processed:     287
Items updated:       156
Items skipped:       131
Errors:              0

✅ Migration completed successfully!
```

## Post-Migration Steps

After running the migration:

1. **Verify in Firestore Console**
   - Check a few design items to confirm fields were added correctly
   - Verify strategyContext links to correct strategy documents

2. **Set Allocated Budgets**
   - The `allocatedBudget` field is set to 0 by default
   - Users should manually set target budgets for each item in the UI
   - Once set, variance calculations will be accurate

3. **Run Estimate Calculations**
   - Generate new estimates to see budget tier pricing in action
   - Check budget summary in consolidated estimates
   - Review items over budget

4. **Test Budget Tier Pricing**
   - Create a new estimate and verify budget tier multipliers are applied
   - Check that luxury items cost 2.5x base price, economy items 0.7x, etc.

## Troubleshooting

### "Service account key not found"
- Ensure `serviceAccountKey.json` is in the project root
- Check file name matches exactly (case-sensitive)
- Verify file contains valid JSON

### "Permission denied" errors
- Ensure service account has Firestore write permissions
- Check Firebase project settings

### "Batch write exceeded"
- Script uses batches of 100 (safe limit)
- If this happens, there may be a network issue - retry

### Migration runs but no items updated
- All items may already have the fields
- Check Firestore console to verify

## Rollback

If you need to remove the migrated fields:

```typescript
// Run this in Firebase Console or create a rollback script
const items = await db
  .collectionGroup('designItems')
  .get();

const batch = db.batch();
items.forEach(doc => {
  batch.update(doc.ref, {
    strategyContext: FieldValue.delete(),
    budgetTracking: FieldValue.delete(),
  });
});
await batch.commit();
```

## Support

For issues or questions:
1. Check this guide first
2. Review the dry run output carefully
3. Test on a single project first (`--project=PROJECT_ID`)
4. Contact the development team

---

**⚠️ Important**: Always run a dry run first and review the output before executing the migration on production data.
