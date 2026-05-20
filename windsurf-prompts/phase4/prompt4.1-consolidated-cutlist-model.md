# Prompt 4.1: Consolidated Cutlist Model

## Objective
Define the data model for aggregating parts across all design items into a project-level consolidated cutlist.

## Prerequisites
- Completed Phase 3 (Parts Management)

## Requirements

### 1. Consolidated Cutlist Types

The ConsolidatedCutlist type was defined in Prompt 2.1. Expand with:

```typescript
// Add to src/modules/design-manager/types/index.ts

export interface MaterialGroup {
  materialId: string;
  materialCode: string;
  materialName: string;
  thickness: number;
  sheetSize?: { length: number; width: number };
  parts: AggregatedPart[];
  totalParts: number;
  totalArea: number;        // sq meters
  estimatedSheets: number;
}

export interface AggregatedPart {
  partId: string;
  designItemId: string;
  designItemName: string;
  partNumber: string;
  partName: string;
  length: number;
  width: number;
  quantity: number;
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: EdgeBanding;
}

export interface ConsolidatedCutlist {
  id: string;
  projectId: string;
  customerId: string;
  
  generatedAt: Timestamp;
  generatedBy: string;
  
  // Staleness tracking
  isStale: boolean;
  staleReason?: string;
  lastDesignItemUpdate: Timestamp;
  
  // Aggregated data
  materialGroups: MaterialGroup[];
  
  // Summary
  totalParts: number;
  totalUniquePartsCount: number;
  totalMaterials: number;
  totalArea: number;
  estimatedTotalSheets: number;
  
  // Export tracking
  lastExportedAt?: Timestamp;
  lastExportFormat?: 'csv' | 'pdf' | 'opticut';
}
```

### 2. Firestore Structure

Store consolidated cutlist at project level:

```
customers/{customerId}/projects/{projectId}/
  consolidatedCutlist: ConsolidatedCutlist  // Embedded in project doc
```

### 3. Staleness Detection

Create trigger to mark cutlist stale when parts change:

```typescript
// In Cloud Functions
export const onDesignItemPartsChanged = functions.firestore
  .document('customers/{customerId}/projects/{projectId}/designItems/{itemId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if parts array changed
    if (JSON.stringify(before.parts) !== JSON.stringify(after.parts)) {
      // Mark project cutlist as stale
      await db.doc(`customers/${context.params.customerId}/projects/${context.params.projectId}`)
        .update({
          'consolidatedCutlist.isStale': true,
          'consolidatedCutlist.staleReason': `Parts updated in ${after.name}`,
        });
    }
  });
```

## Validation Checklist

- [ ] Types compile without errors
- [ ] Staleness trigger fires on part changes
- [ ] MaterialGroup aggregates parts by material

## Next Steps
Proceed to **Prompt 4.2**: Cutlist Aggregation Service
