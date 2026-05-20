# Prompt 4.2: Cutlist Aggregation Service

## Objective
Create a service that aggregates parts from all design items into a consolidated cutlist grouped by material.

## Prerequisites
- Completed Prompt 4.1

## Requirements

### 1. Aggregation Service

Create `src/modules/design-manager/services/cutlistAggregation.ts`:

```typescript
/**
 * Cutlist Aggregation Service
 */

import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ConsolidatedCutlist, MaterialGroup, AggregatedPart, DesignItem, PartEntry } from '../types';

const DEFAULT_SHEET_SIZE = { length: 2440, width: 1220 }; // Standard 8x4 sheet in mm

export async function aggregateCutlist(
  customerId: string,
  projectId: string,
  userId: string
): Promise<ConsolidatedCutlist> {
  // 1. Fetch all design items with parts
  const itemsRef = collection(db, 'customers', customerId, 'projects', projectId, 'designItems');
  const snapshot = await getDocs(itemsRef);
  
  const allParts: (AggregatedPart & { materialName: string; thickness: number })[] = [];
  let lastUpdate = new Date(0);
  
  snapshot.forEach((doc) => {
    const item = doc.data() as DesignItem & { parts?: PartEntry[] };
    const parts = item.parts || [];
    
    parts.forEach((part) => {
      allParts.push({
        partId: part.id,
        designItemId: doc.id,
        designItemName: item.name,
        partNumber: part.partNumber,
        partName: part.name,
        length: part.length,
        width: part.width,
        quantity: part.quantity,
        grainDirection: part.grainDirection,
        edgeBanding: part.edgeBanding,
        materialName: part.materialName,
        thickness: part.thickness,
      });
      
      if (part.updatedAt?.toDate() > lastUpdate) {
        lastUpdate = part.updatedAt.toDate();
      }
    });
  });

  // 2. Group by material
  const materialMap = new Map<string, MaterialGroup>();
  
  allParts.forEach((part) => {
    const key = `${part.materialName}-${part.thickness}`;
    
    if (!materialMap.has(key)) {
      materialMap.set(key, {
        materialId: '', // To be linked later
        materialCode: key,
        materialName: part.materialName,
        thickness: part.thickness,
        sheetSize: DEFAULT_SHEET_SIZE,
        parts: [],
        totalParts: 0,
        totalArea: 0,
        estimatedSheets: 0,
      });
    }
    
    const group = materialMap.get(key)!;
    group.parts.push(part);
    group.totalParts += part.quantity;
    group.totalArea += (part.length * part.width * part.quantity) / 1_000_000; // mm² to m²
  });

  // 3. Calculate estimated sheets per material
  materialMap.forEach((group) => {
    const sheetArea = (group.sheetSize!.length * group.sheetSize!.width) / 1_000_000;
    // Assume 70% yield efficiency
    group.estimatedSheets = Math.ceil(group.totalArea / (sheetArea * 0.7));
  });

  const materialGroups = Array.from(materialMap.values());
  
  // 4. Build consolidated cutlist
  const cutlist: Omit<ConsolidatedCutlist, 'id'> = {
    projectId,
    customerId,
    generatedAt: serverTimestamp() as any,
    generatedBy: userId,
    isStale: false,
    staleReason: undefined,
    lastDesignItemUpdate: lastUpdate as any,
    materialGroups,
    totalParts: materialGroups.reduce((sum, g) => sum + g.totalParts, 0),
    totalUniquePartsCount: allParts.length,
    totalMaterials: materialGroups.length,
    totalArea: materialGroups.reduce((sum, g) => sum + g.totalArea, 0),
    estimatedTotalSheets: materialGroups.reduce((sum, g) => sum + g.estimatedSheets, 0),
  };

  // 5. Save to project document
  const projectRef = doc(db, 'customers', customerId, 'projects', projectId);
  await updateDoc(projectRef, {
    consolidatedCutlist: cutlist,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return cutlist as ConsolidatedCutlist;
}

export async function exportCutlistCSV(cutlist: ConsolidatedCutlist): Promise<string> {
  const rows: string[] = [];
  rows.push('Material,Thickness,Part #,Part Name,Design Item,Length,Width,Qty,Grain,Edges');
  
  cutlist.materialGroups.forEach((group) => {
    group.parts.forEach((part) => {
      const edges = [
        part.edgeBanding.top && 'T',
        part.edgeBanding.bottom && 'B',
        part.edgeBanding.left && 'L',
        part.edgeBanding.right && 'R',
      ].filter(Boolean).join('');
      
      rows.push([
        group.materialName,
        group.thickness,
        part.partNumber,
        `"${part.partName}"`,
        `"${part.designItemName}"`,
        part.length,
        part.width,
        part.quantity,
        part.grainDirection,
        edges || '-',
      ].join(','));
    });
  });
  
  return rows.join('\n');
}
```

### 2. useCutlistAggregation Hook

Create hook for UI integration:

```typescript
export function useCutlistAggregation(customerId: string, projectId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const regenerate = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await aggregateCutlist(customerId, projectId, userId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to aggregate'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId]);

  return { regenerate, loading, error };
}
```

## Validation Checklist

- [ ] Aggregation groups parts by material correctly
- [ ] Sheet estimation uses reasonable yield factor
- [ ] CSV export includes all required fields
- [ ] Cutlist saved to project document

## Next Steps
Proceed to **Prompt 4.3**: Consolidated Cutlist UI
