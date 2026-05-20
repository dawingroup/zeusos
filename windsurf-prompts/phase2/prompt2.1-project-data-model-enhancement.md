# Prompt 2.1: Project Data Model Enhancement

## Objective
Enhance the project data model to support the development → confirmed workflow, consolidated cutlist aggregation, and estimate tracking.

## Prerequisites
- Completed Phase 1 (Customer Hub Foundation)

## Context
Projects currently exist in `designProjects/` as top-level documents. We need to:
1. Move projects under customers as subcollections
2. Add fields for consolidated cutlist and estimates
3. Track project phase (development vs confirmed)
4. Link to Drive folders for each phase

## Requirements

### 1. Enhanced Project Types

Update file: `src/modules/design-manager/types/index.ts`

Add the following types:

```typescript
/**
 * Project phase in the lifecycle
 */
export type ProjectPhase = 'development' | 'confirmed' | 'in-production' | 'completed';

/**
 * Consolidated material entry for cutlist
 */
export interface ConsolidatedMaterialEntry {
  materialId: string;
  materialName: string;
  materialCode: string;
  thickness: number;
  width: number;
  length: number;
  unit: 'mm' | 'inch';
  quantity: number;
  totalArea: number;      // sq meters or sq feet
  sourceItems: {
    designItemId: string;
    designItemName: string;
    partCount: number;
  }[];
}

/**
 * Consolidated cutlist at project level
 */
export interface ConsolidatedCutlist {
  generatedAt: Timestamp;
  generatedBy: string;
  isStale: boolean;
  staleReason?: string;
  materials: ConsolidatedMaterialEntry[];
  totalParts: number;
  totalSheets: number;      // Estimated sheet count
  lastDesignItemUpdate: Timestamp;
}

/**
 * Line item in estimate
 */
export interface EstimateLineItem {
  id: string;
  description: string;
  category: 'material' | 'hardware' | 'labor' | 'finishing' | 'other';
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  linkedMaterialId?: string;
}

/**
 * Consolidated estimate at project level
 */
export interface ConsolidatedEstimate {
  generatedAt: Timestamp;
  generatedBy: string;
  isStale: boolean;
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  quickbooksInvoiceId?: string;
  quickbooksInvoiceNumber?: string;
}

/**
 * Enhanced DesignProject interface
 */
export interface DesignProject {
  id: string;
  
  // Basic info
  code: string;
  name: string;
  description?: string;
  
  // Customer relationship (NEW)
  customerId: string;
  customerName: string;
  customerCode: string;
  
  // Status and phase
  status: 'active' | 'on-hold' | 'completed' | 'cancelled';
  phase: ProjectPhase;  // NEW
  
  // Dates
  startDate?: Timestamp;
  dueDate?: Timestamp;
  confirmedDate?: Timestamp;  // NEW
  completedDate?: Timestamp;
  
  // Drive folders (NEW)
  developmentFolderId?: string;
  developmentFolderLink?: string;
  confirmedFolderId?: string;
  confirmedFolderLink?: string;
  
  // Consolidated data (NEW)
  consolidatedCutlist?: ConsolidatedCutlist;
  consolidatedEstimate?: ConsolidatedEstimate;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Project form data for create/update
 */
export type ProjectFormData = Omit<
  DesignProject,
  'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 
  'consolidatedCutlist' | 'consolidatedEstimate'
>;
```

### 2. Update Firestore Service

Update file: `src/modules/design-manager/services/firestore.ts`

Add/update the following functions:

```typescript
// Helper to get projects collection for a customer
function getProjectsRef(customerId: string) {
  return collection(db, 'customers', customerId, 'projects');
}

/**
 * Subscribe to projects for a customer
 */
export function subscribeToCustomerProjects(
  customerId: string,
  callback: (projects: DesignProject[]) => void
): () => void {
  const projectsRef = getProjectsRef(customerId);
  const q = query(projectsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DesignProject[];
    callback(projects);
  });
}

/**
 * Subscribe to a single project
 */
export function subscribeToProject(
  customerId: string,
  projectId: string,
  callback: (project: DesignProject | null) => void
): () => void {
  const docRef = doc(db, 'customers', customerId, 'projects', projectId);

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as DesignProject);
    } else {
      callback(null);
    }
  });
}

/**
 * Create a new project under a customer
 */
export async function createProject(
  customerId: string,
  data: Omit<ProjectFormData, 'customerId'>,
  userId: string
): Promise<string> {
  const projectsRef = getProjectsRef(customerId);
  
  // Get customer info for denormalization
  const customerDoc = await getDoc(doc(db, 'customers', customerId));
  if (!customerDoc.exists()) {
    throw new Error('Customer not found');
  }
  const customer = customerDoc.data();

  const docRef = await addDoc(projectsRef, {
    ...data,
    customerId,
    customerName: customer.name,
    customerCode: customer.code,
    phase: 'development',
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return docRef.id;
}

/**
 * Update project
 */
export async function updateProject(
  customerId: string,
  projectId: string,
  data: Partial<ProjectFormData>,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'customers', customerId, 'projects', projectId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Confirm a project (transition from development to confirmed)
 */
export async function confirmProject(
  customerId: string,
  projectId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'customers', customerId, 'projects', projectId);
  await updateDoc(docRef, {
    phase: 'confirmed',
    confirmedDate: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Update consolidated cutlist
 */
export async function updateConsolidatedCutlist(
  customerId: string,
  projectId: string,
  cutlist: Omit<ConsolidatedCutlist, 'generatedAt'>,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'customers', customerId, 'projects', projectId);
  await updateDoc(docRef, {
    consolidatedCutlist: {
      ...cutlist,
      generatedAt: serverTimestamp(),
      generatedBy: userId,
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Mark cutlist as stale
 */
export async function markCutlistStale(
  customerId: string,
  projectId: string,
  reason: string
): Promise<void> {
  const docRef = doc(db, 'customers', customerId, 'projects', projectId);
  await updateDoc(docRef, {
    'consolidatedCutlist.isStale': true,
    'consolidatedCutlist.staleReason': reason,
  });
}
```

### 3. Migration Strategy

For existing projects in `designProjects/`, create a migration script:

Create file: `scripts/migrate-projects-to-customers.ts`

```typescript
/**
 * Migration Script: Move projects to customer subcollections
 * 
 * Run with: npx ts-node scripts/migrate-projects-to-customers.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function migrateProjects() {
  console.log('Starting project migration...');

  // Get all projects from old location
  const oldProjectsSnapshot = await db.collection('designProjects').get();
  console.log(`Found ${oldProjectsSnapshot.size} projects to migrate`);

  // Create a default customer for unmapped projects
  const defaultCustomerRef = await db.collection('customers').add({
    code: 'LEGACY-001',
    name: 'Legacy Projects',
    type: 'commercial',
    status: 'active',
    contacts: [],
    externalIds: {},
    tags: ['migrated'],
    createdAt: new Date(),
    createdBy: 'migration-script',
    updatedAt: new Date(),
    updatedBy: 'migration-script',
  });
  console.log(`Created default customer: ${defaultCustomerRef.id}`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const projectDoc of oldProjectsSnapshot.docs) {
    try {
      const projectData = projectDoc.data();
      
      // Determine customer (use customerName if available, else default)
      let customerId = defaultCustomerRef.id;
      
      if (projectData.customerName) {
        // Try to find existing customer by name
        const customerQuery = await db.collection('customers')
          .where('name', '==', projectData.customerName)
          .limit(1)
          .get();
        
        if (!customerQuery.empty) {
          customerId = customerQuery.docs[0].id;
        }
      }

      // Create project in new location
      const newProjectRef = db.collection('customers')
        .doc(customerId)
        .collection('projects')
        .doc(projectDoc.id); // Keep same ID

      await newProjectRef.set({
        ...projectData,
        customerId,
        phase: 'development', // Default phase
      });

      // Migrate design items subcollection
      const designItemsSnapshot = await db
        .collection('designProjects')
        .doc(projectDoc.id)
        .collection('designItems')
        .get();

      for (const itemDoc of designItemsSnapshot.docs) {
        await newProjectRef
          .collection('designItems')
          .doc(itemDoc.id)
          .set(itemDoc.data());

        // Migrate deliverables
        const deliverablesSnapshot = await db
          .collection('designProjects')
          .doc(projectDoc.id)
          .collection('designItems')
          .doc(itemDoc.id)
          .collection('deliverables')
          .get();

        for (const delivDoc of deliverablesSnapshot.docs) {
          await newProjectRef
            .collection('designItems')
            .doc(itemDoc.id)
            .collection('deliverables')
            .doc(delivDoc.id)
            .set(delivDoc.data());
        }
      }

      migratedCount++;
      console.log(`Migrated project: ${projectData.name} (${projectDoc.id})`);
    } catch (error) {
      errorCount++;
      console.error(`Failed to migrate project ${projectDoc.id}:`, error);
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Errors: ${errorCount}`);
}

migrateProjects().catch(console.error);
```

## Validation Checklist

- [ ] New TypeScript types compile without errors
- [ ] Firestore service functions work with new structure
- [ ] Projects can be created under customers
- [ ] Project phase transitions work correctly
- [ ] Migration script runs successfully (test on backup first!)

## Next Steps

After completing this prompt, proceed to:
- **Prompt 2.2**: Project Development Folder - Auto-create development folders in Drive
