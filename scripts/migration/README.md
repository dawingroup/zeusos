# MatFlow to Core Projects Migration

This directory contains scripts for migrating MatFlow projects from the separate `matflow_projects` collection to the unified `advisory_projects` collection.

## Overview

The migration consolidates all MatFlow projects into the core advisory projects structure while:
- ✅ Preserving all project data and metadata
- ✅ Migrating all subcollections (BOQ items, parsing jobs, materials, formulas, procurement)
- ✅ Maintaining 4-level BOQ hierarchy integrity
- ✅ Mapping MatFlow statuses to core project statuses
- ✅ Creating default program for orphaned projects
- ✅ Supporting dry-run mode for safe testing

## Prerequisites

1. Firebase credentials configured
2. Access to the organization's Firestore database
3. Node.js and npm installed
4. TypeScript compiled (or ts-node available)

## Migration Process

### Step 1: Dry Run

**Always start with a dry run** to see what would happen:

```bash
npm run migrate:matflow -- --org <orgId> --dry-run
```

This will:
- Report all projects that would be migrated
- Show status mappings (MatFlow → Core)
- Count subcollection documents
- **NOT make any changes**

### Step 2: Run Migration

Once you've reviewed the dry run output:

```bash
npm run migrate:matflow -- --org <orgId>
```

This will:
- Create "MatFlow Projects" program (if needed)
- Migrate all projects to `advisory_projects`
- Copy all subcollections
- Preserve all data and metadata

**Note**: The script is idempotent - projects already in the core collection will be skipped.

### Step 3: Validate

After migration, validate data integrity:

```bash
npm run validate:migration -- --org <orgId>
```

This will check:
- ✅ All MatFlow projects exist in core collection
- ✅ All fields properly migrated
- ✅ All subcollections copied with correct counts
- ✅ BOQ hierarchy preserved (4-level structure intact)
- ✅ Governing specs maintained
- ✅ No orphaned references

## Status Mapping

MatFlow statuses are mapped to core project statuses:

| MatFlow Status | Core Status              |
|----------------|--------------------------|
| `draft`        | `planning`               |
| `planning`     | `planning`               |
| `active`       | `active`                 |
| `on_hold`      | `suspended`              |
| `completed`    | `completed`              |
| `cancelled`    | `cancelled`              |

## Data Transformation

### Project Fields

The migration transforms MatFlow projects as follows:

**Preserved**:
- Name, description, project code
- Customer ID and name
- Location (with defaults)
- Budget (with defaults)
- Progress tracking
- Timeline
- BOQ summary
- Team members (transformed to core format)

**Added**:
- `programId`: Links to "MatFlow Projects" program
- `engagementId`: Inherited from program
- `settings`: { taxEnabled: true, taxRate: 18, defaultWastagePercent: 10 }
- `stages`: Default construction stages
- `version`, `isDeleted`: Core metadata fields

**Mapped**:
- `status`: MatFlow → Core status
- `type`: Mapped to `projectType`
- `teamMembers`: Transformed to core `members` format

### Subcollections

All subcollections are copied as-is:

- `boq_items` - BOQ items with 4-level hierarchy
- `parsing_jobs` - BOQ parsing job history
- `materials` - Project-specific materials
- `formulas` - Project-specific formulas
- `procurement_entries` - Procurement tracking

## Default Program

If no program exists for MatFlow projects, the script creates:

**Name**: "MatFlow Projects"
**Code**: `MATFLOW`
**Description**: "Projects migrated from MatFlow module"
**Status**: `active`
**Type**: `direct` implementation

This program serves as a container for all migrated MatFlow projects.

## Validation Checks

The validation script performs comprehensive checks:

### 1. Project Existence
- Verifies all MatFlow projects exist in core collection
- Reports any missing projects

### 2. Field Integrity
- Checks name preservation
- Validates BOQ summary migration
- Verifies settings (taxEnabled should be true)

### 3. Subcollection Counts
- Compares document counts in each subcollection
- Reports any mismatches

### 4. BOQ Hierarchy
- Validates hierarchyLevel (1-4)
- Checks hierarchy path consistency
- Verifies Level 3 governing specs
- Ensures spec inheritance structure

## Rollback

If needed, you can rollback by:

1. Deleting migrated projects from `advisory_projects`:
   ```
   Delete: organizations/{orgId}/advisory_projects/{projectId}
   ```

2. MatFlow projects remain in `matflow_projects` collection (not deleted)

3. Re-run migration after fixing issues

## Safety Features

- **Dry-run mode**: Test without making changes
- **Idempotent**: Safe to run multiple times
- **Skip duplicates**: Won't overwrite existing projects
- **Comprehensive logging**: Detailed output for troubleshooting
- **Batch processing**: Efficient handling of large datasets
- **Error isolation**: One project failure doesn't stop migration

## Example Output

### Dry Run
```
================================================================================
MATFLOW TO CORE PROJECTS MIGRATION
================================================================================
Organization: org_123456
Mode: DRY RUN
================================================================================

Step 1: Fetching MatFlow projects...
✓ Found 45 MatFlow projects

Step 2: Setting up default program...
✓ Found existing "MatFlow Projects" program

Step 3: Migrating projects...

[1/45] Residential Tower (abc123)
  [DRY RUN] Would create project: MATFLOW-26-001
  [DRY RUN] Status: active → active
  [DRY RUN] Would copy 234 documents from boq_items
  [DRY RUN] Would copy 3 documents from parsing_jobs

...

================================================================================
MIGRATION SUMMARY
================================================================================
Total MatFlow Projects: 45
Migrated Successfully: 45
Skipped (Already Exist): 0
Failed: 0
Warnings: 0
Duration: 12.34s
Status: ✓ SUCCESS
================================================================================
```

### Validation
```
================================================================================
MATFLOW MIGRATION VALIDATION
================================================================================
Organization: org_123456
================================================================================

Step 1: Counting projects...
  MatFlow projects: 45
  Core projects: 45

Step 2: Checking project existence...
  ✓ Residential Tower (abc123)
  ✓ Commercial Complex (def456)
  ...

Step 3: Validating field mappings...
  ✓ Validated 45 projects

Step 4: Validating subcollections...
  ✓ All subcollections match

Step 5: Validating BOQ hierarchy...
  ✓ All BOQ hierarchies valid

================================================================================
VALIDATION SUMMARY
================================================================================
Total MatFlow Projects: 45
Matched in Core: 45
Missing in Core: 0
Field Mismatches: 0
Subcollection Mismatches: 0
BOQ Hierarchy Issues: 0
Warnings: 0
Status: ✓ PASS
================================================================================
```

## Troubleshooting

### Issue: "Program not found"
**Solution**: Ensure the default program was created. Check Step 2 output.

### Issue: Subcollection count mismatch
**Solution**: Run validation to identify which subcollections have issues. May need to re-run migration for specific projects.

### Issue: BOQ hierarchy errors
**Solution**: Check original MatFlow BOQ items. Hierarchy might have been corrupted before migration.

### Issue: Field mismatches
**Solution**: Review transformation logic in `transformMatFlowProject()`. Some fields may need custom mapping.

## Support

For issues or questions:
1. Check validation output for specific errors
2. Review migration logs
3. Contact development team
4. File issue in repository

## Timeline

Estimated migration time:
- 10 projects: ~30 seconds
- 50 projects: ~2 minutes
- 100 projects: ~5 minutes
- 500+ projects: ~20 minutes

*Times vary based on subcollection sizes and network speed.*
