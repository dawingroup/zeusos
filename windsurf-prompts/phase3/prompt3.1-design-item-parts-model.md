# Prompt 3.1: Design Item Parts Model

## Objective
Extend the design item data model to include embedded parts entries, enabling part-level tracking for cutlist generation.

## Prerequisites
- Completed Phase 1 and Phase 2
- Existing DesignItem model in design-manager module

## Context
Each design item (cabinet, door, furniture piece) consists of multiple parts (panels, rails, stiles). We need to track these parts with their dimensions, materials, and quantities for cutlist aggregation.

## Requirements

### 1. Create Parts Types

Add to file: `src/modules/design-manager/types/index.ts`

```typescript
/**
 * Edge banding specification
 */
export interface EdgeBanding {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  material?: string;
  thickness?: number;
}

/**
 * Grain direction for wood panels
 */
export type GrainDirection = 'length' | 'width' | 'none';

/**
 * Part source (how it was added)
 */
export type PartSource = 'manual' | 'csv-import' | 'polyboard' | 'sketchup';

/**
 * Individual part entry within a design item
 */
export interface PartEntry {
  id: string;
  
  // Identification
  partNumber: string;        // Part identifier within item (e.g., "P001")
  name: string;              // Descriptive name (e.g., "Left Side Panel")
  
  // Dimensions (always stored in mm internally)
  length: number;            // Length in mm
  width: number;             // Width in mm  
  thickness: number;         // Thickness in mm
  
  // Material
  materialId?: string;       // Reference to material library
  materialName: string;      // Denormalized material name
  materialCode?: string;     // Material code for ordering
  
  // Quantity
  quantity: number;
  
  // Processing
  grainDirection: GrainDirection;
  edgeBanding: EdgeBanding;
  
  // CNC/Machining
  hasCNCOperations: boolean;
  cncProgramRef?: string;
  
  // Notes
  notes?: string;
  
  // Metadata
  source: PartSource;
  importedFrom?: string;     // Original filename if imported
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Parts summary for a design item
 */
export interface PartsSummary {
  totalParts: number;
  uniqueMaterials: number;
  totalArea: number;          // Square meters
  lastUpdated: Timestamp;
  isComplete: boolean;        // All parts have materials assigned
}

/**
 * Extended DesignItem with parts
 */
export interface DesignItemWithParts extends DesignItem {
  parts: PartEntry[];
  partsSummary?: PartsSummary;
}
```

### 2. Create Parts Service

Create file: `src/modules/design-manager/services/partsService.ts`

```typescript
/**
 * Parts Service
 * CRUD operations for design item parts
 */

import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { nanoid } from 'nanoid';
import type { PartEntry, PartsSummary, EdgeBanding } from '../types';

/**
 * Generate a unique part ID
 */
export function generatePartId(): string {
  return nanoid(10);
}

/**
 * Generate part number (sequential within item)
 */
export function generatePartNumber(existingParts: PartEntry[]): string {
  const maxNumber = existingParts.reduce((max, part) => {
    const match = part.partNumber.match(/P(\d+)/);
    if (match) {
      return Math.max(max, parseInt(match[1], 10));
    }
    return max;
  }, 0);
  return `P${String(maxNumber + 1).padStart(3, '0')}`;
}

/**
 * Calculate parts summary
 */
export function calculatePartsSummary(parts: PartEntry[]): PartsSummary {
  const uniqueMaterials = new Set(parts.map((p) => p.materialId || p.materialName));
  
  // Calculate total area in square meters
  const totalArea = parts.reduce((sum, part) => {
    const areaPerPart = (part.length * part.width) / 1_000_000; // mm² to m²
    return sum + areaPerPart * part.quantity;
  }, 0);

  const isComplete = parts.every((p) => p.materialId || p.materialName);

  return {
    totalParts: parts.reduce((sum, p) => sum + p.quantity, 0),
    uniqueMaterials: uniqueMaterials.size,
    totalArea: Math.round(totalArea * 1000) / 1000, // Round to 3 decimals
    lastUpdated: Timestamp.now(),
    isComplete,
  };
}

/**
 * Default edge banding
 */
export const DEFAULT_EDGE_BANDING: EdgeBanding = {
  top: false,
  bottom: false,
  left: false,
  right: false,
};

/**
 * Create a new part entry
 */
export function createPartEntry(
  data: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>,
  existingParts: PartEntry[] = []
): PartEntry {
  return {
    ...data,
    id: generatePartId(),
    partNumber: data.partNumber || generatePartNumber(existingParts),
    edgeBanding: data.edgeBanding || DEFAULT_EDGE_BANDING,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

/**
 * Get design item document reference
 */
function getDesignItemRef(customerId: string, projectId: string, itemId: string) {
  return doc(db, 'customers', customerId, 'projects', projectId, 'designItems', itemId);
}

/**
 * Add a part to a design item
 */
export async function addPart(
  customerId: string,
  projectId: string,
  itemId: string,
  partData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>,
  existingParts: PartEntry[],
  userId: string
): Promise<PartEntry> {
  const part = createPartEntry(partData, existingParts);
  const docRef = getDesignItemRef(customerId, projectId, itemId);

  const newParts = [...existingParts, part];
  const summary = calculatePartsSummary(newParts);

  await updateDoc(docRef, {
    parts: arrayUnion(part),
    partsSummary: summary,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return part;
}

/**
 * Update a part in a design item
 */
export async function updatePart(
  customerId: string,
  projectId: string,
  itemId: string,
  partId: string,
  updates: Partial<Omit<PartEntry, 'id' | 'createdAt'>>,
  currentParts: PartEntry[],
  userId: string
): Promise<void> {
  const docRef = getDesignItemRef(customerId, projectId, itemId);

  const updatedParts = currentParts.map((part) =>
    part.id === partId
      ? { ...part, ...updates, updatedAt: Timestamp.now() }
      : part
  );

  const summary = calculatePartsSummary(updatedParts);

  await updateDoc(docRef, {
    parts: updatedParts,
    partsSummary: summary,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Delete a part from a design item
 */
export async function deletePart(
  customerId: string,
  projectId: string,
  itemId: string,
  partId: string,
  currentParts: PartEntry[],
  userId: string
): Promise<void> {
  const docRef = getDesignItemRef(customerId, projectId, itemId);
  const partToRemove = currentParts.find((p) => p.id === partId);

  if (!partToRemove) {
    throw new Error('Part not found');
  }

  const remainingParts = currentParts.filter((p) => p.id !== partId);
  const summary = calculatePartsSummary(remainingParts);

  await updateDoc(docRef, {
    parts: arrayRemove(partToRemove),
    partsSummary: summary,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Bulk add parts (for CSV import)
 */
export async function bulkAddParts(
  customerId: string,
  projectId: string,
  itemId: string,
  partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[],
  existingParts: PartEntry[],
  userId: string
): Promise<PartEntry[]> {
  const docRef = getDesignItemRef(customerId, projectId, itemId);

  let allParts = [...existingParts];
  const newParts: PartEntry[] = [];

  for (const partData of partsData) {
    const part = createPartEntry(partData, allParts);
    newParts.push(part);
    allParts.push(part);
  }

  const summary = calculatePartsSummary(allParts);

  await updateDoc(docRef, {
    parts: allParts,
    partsSummary: summary,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return newParts;
}

/**
 * Replace all parts (for re-import)
 */
export async function replaceAllParts(
  customerId: string,
  projectId: string,
  itemId: string,
  partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[],
  userId: string
): Promise<PartEntry[]> {
  const docRef = getDesignItemRef(customerId, projectId, itemId);

  const parts: PartEntry[] = [];
  for (const partData of partsData) {
    const part = createPartEntry(partData, parts);
    parts.push(part);
  }

  const summary = calculatePartsSummary(parts);

  await updateDoc(docRef, {
    parts,
    partsSummary: summary,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return parts;
}
```

### 3. Create useParts Hook

Create file: `src/modules/design-manager/hooks/useParts.ts`

```typescript
/**
 * useParts Hook
 * Manage parts within a design item
 */

import { useState, useCallback } from 'react';
import {
  addPart,
  updatePart,
  deletePart,
  bulkAddParts,
  replaceAllParts,
} from '../services/partsService';
import type { PartEntry, DesignItem } from '../types';

interface UsePartsReturn {
  loading: boolean;
  error: Error | null;
  add: (partData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PartEntry>;
  update: (partId: string, updates: Partial<PartEntry>) => Promise<void>;
  remove: (partId: string) => Promise<void>;
  bulkAdd: (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<PartEntry[]>;
  replaceAll: (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<PartEntry[]>;
  clearError: () => void;
}

export function useParts(
  customerId: string,
  projectId: string,
  item: DesignItem | null,
  userId: string
): UsePartsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const currentParts = (item as any)?.parts || [];

  const add = useCallback(
    async (partData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PartEntry> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        const part = await addPart(customerId, projectId, item.id, partData, currentParts, userId);
        return part;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add part');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [customerId, projectId, item, currentParts, userId]
  );

  const update = useCallback(
    async (partId: string, updates: Partial<PartEntry>): Promise<void> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        await updatePart(customerId, projectId, item.id, partId, updates, currentParts, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update part');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [customerId, projectId, item, currentParts, userId]
  );

  const remove = useCallback(
    async (partId: string): Promise<void> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        await deletePart(customerId, projectId, item.id, partId, currentParts, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete part');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [customerId, projectId, item, currentParts, userId]
  );

  const bulkAdd = useCallback(
    async (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<PartEntry[]> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        const parts = await bulkAddParts(customerId, projectId, item.id, partsData, currentParts, userId);
        return parts;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add parts');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [customerId, projectId, item, currentParts, userId]
  );

  const replaceAll = useCallback(
    async (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<PartEntry[]> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        const parts = await replaceAllParts(customerId, projectId, item.id, partsData, userId);
        return parts;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to replace parts');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [customerId, projectId, item, userId]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    add,
    update,
    remove,
    bulkAdd,
    replaceAll,
    clearError,
  };
}
```

### 4. Update Module Exports

Update `src/modules/design-manager/hooks/index.ts`:

```typescript
export { useParts } from './useParts';
```

Update `src/modules/design-manager/services/index.ts`:

```typescript
export * from './partsService';
```

## Validation Checklist

- [ ] PartEntry interface includes all necessary fields
- [ ] Parts service functions compile without errors
- [ ] useParts hook provides all CRUD operations
- [ ] Part numbers auto-generate sequentially
- [ ] Parts summary calculates correctly

## Next Steps

After completing this prompt, proceed to:
- **Prompt 3.2**: CSV Parts Import - Parse and import parts from Polyboard/SketchUp exports
