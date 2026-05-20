# Prompt 1.1: Customer Data Model

## Objective
Create the Firestore data model and TypeScript interfaces for the Customer entity, which will serve as the root of the project hierarchy.

## Context
Currently, projects exist as top-level documents in `designProjects/`. We need to introduce a `customers/` collection where each customer can have multiple projects. This establishes proper data ownership and enables external system integrations.

## Requirements

### 1. Create TypeScript Interfaces

Create file: `src/modules/customer-hub/types/index.ts`

```typescript
/**
 * Customer Hub Types
 * TypeScript interfaces for customer management
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Customer status
 */
export type CustomerStatus = 'active' | 'inactive' | 'prospect';

/**
 * Customer type/tier
 */
export type CustomerType = 'residential' | 'commercial' | 'contractor' | 'designer';

/**
 * Address structure
 */
export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Contact person within an organization
 */
export interface ContactPerson {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

/**
 * External system references
 */
export interface ExternalIds {
  katanaId?: string;        // Katana MRP customer ID
  quickbooksId?: string;    // QuickBooks customer ID
  driveFolderId?: string;   // Google Drive folder ID
}

/**
 * Customer document in Firestore
 */
export interface Customer {
  id: string;
  
  // Basic info
  code: string;              // Unique customer code (e.g., "SMITH-RES-001")
  name: string;              // Display name
  type: CustomerType;
  status: CustomerStatus;
  
  // Contact info
  email?: string;
  phone?: string;
  website?: string;
  
  // Address
  billingAddress?: Address;
  shippingAddress?: Address;
  
  // Contacts
  contacts: ContactPerson[];
  
  // External integrations
  externalIds: ExternalIds;
  
  // Notes
  notes?: string;
  tags: string[];
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Customer form data (for create/update)
 */
export type CustomerFormData = Omit<Customer, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;

/**
 * Customer list item (lightweight for lists)
 */
export interface CustomerListItem {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  status: CustomerStatus;
  email?: string;
  phone?: string;
  projectCount?: number;
}
```

### 2. Create Firestore Security Rules

Add to `firestore.rules`:

```javascript
// Customer collection rules
match /customers/{customerId} {
  // Allow read for authenticated users
  allow read: if request.auth != null;
  
  // Allow create/update for authenticated users
  allow create, update: if request.auth != null
    && request.resource.data.code is string
    && request.resource.data.name is string
    && request.resource.data.type in ['residential', 'commercial', 'contractor', 'designer']
    && request.resource.data.status in ['active', 'inactive', 'prospect'];
  
  // Allow delete only if no active projects
  allow delete: if request.auth != null;
  
  // Projects subcollection inherits from customer
  match /projects/{projectId} {
    allow read, write: if request.auth != null;
    
    // Design items within projects
    match /designItems/{itemId} {
      allow read, write: if request.auth != null;
      
      match /deliverables/{deliverableId} {
        allow read, write: if request.auth != null;
      }
      
      match /approvals/{approvalId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

### 3. Create Customer Service

Create file: `src/modules/customer-hub/services/customerService.ts`

```typescript
/**
 * Customer Service
 * Firestore operations for customer management
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Customer, CustomerFormData, CustomerListItem } from '../types';

// Collection reference
const customersRef = collection(db, 'customers');

/**
 * Subscribe to all customers
 */
export function subscribeToCustomers(
  callback: (customers: CustomerListItem[]) => void,
  options?: { status?: string; type?: string }
): () => void {
  let q = query(customersRef, orderBy('name', 'asc'));
  
  if (options?.status) {
    q = query(customersRef, where('status', '==', options.status), orderBy('name', 'asc'));
  }
  
  return onSnapshot(q, (snapshot) => {
    const customers = snapshot.docs.map((doc) => ({
      id: doc.id,
      code: doc.data().code,
      name: doc.data().name,
      type: doc.data().type,
      status: doc.data().status,
      email: doc.data().email,
      phone: doc.data().phone,
    })) as CustomerListItem[];
    callback(customers);
  });
}

/**
 * Subscribe to a single customer
 */
export function subscribeToCustomer(
  customerId: string,
  callback: (customer: Customer | null) => void
): () => void {
  const docRef = doc(customersRef, customerId);
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Customer);
    } else {
      callback(null);
    }
  });
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string): Promise<Customer | null> {
  const docRef = doc(customersRef, customerId);
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Customer;
  }
  return null;
}

/**
 * Check if customer code is unique
 */
export async function isCustomerCodeUnique(code: string, excludeId?: string): Promise<boolean> {
  const q = query(customersRef, where('code', '==', code));
  return new Promise((resolve) => {
    const unsubscribe = onSnapshot(q, (snapshot) => {
      unsubscribe();
      const matches = snapshot.docs.filter((doc) => doc.id !== excludeId);
      resolve(matches.length === 0);
    });
  });
}

/**
 * Create a new customer
 */
export async function createCustomer(
  data: CustomerFormData,
  userId: string
): Promise<string> {
  // Validate unique code
  const isUnique = await isCustomerCodeUnique(data.code);
  if (!isUnique) {
    throw new Error(`Customer code "${data.code}" already exists`);
  }
  
  const docRef = await addDoc(customersRef, {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  return docRef.id;
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  customerId: string,
  data: Partial<CustomerFormData>,
  userId: string
): Promise<void> {
  // If code is being changed, validate uniqueness
  if (data.code) {
    const isUnique = await isCustomerCodeUnique(data.code, customerId);
    if (!isUnique) {
      throw new Error(`Customer code "${data.code}" already exists`);
    }
  }
  
  const docRef = doc(customersRef, customerId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Delete a customer (soft delete by setting status to inactive)
 */
export async function deleteCustomer(
  customerId: string,
  userId: string,
  hardDelete = false
): Promise<void> {
  const docRef = doc(customersRef, customerId);
  
  if (hardDelete) {
    // TODO: Check for active projects before hard delete
    await deleteDoc(docRef);
  } else {
    await updateDoc(docRef, {
      status: 'inactive',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }
}

/**
 * Generate a customer code from name
 */
export function generateCustomerCode(name: string, type: string): string {
  const namePart = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);
  
  const typePart = type.substring(0, 3).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${namePart}-${typePart}-${randomPart}`;
}
```

### 4. Create Module Index

Create file: `src/modules/customer-hub/index.ts`

```typescript
/**
 * Customer Hub Module
 * Exports for customer management functionality
 */

// Types
export * from './types';

// Services
export * from './services/customerService';
```

## Validation Checklist

- [ ] TypeScript interfaces compile without errors
- [ ] Firestore rules deployed successfully
- [ ] Customer service functions are properly typed
- [ ] Module exports are accessible from other modules

## Next Steps

After completing this prompt, proceed to:
- **Prompt 1.2**: Customer CRUD Hooks - React hooks for customer data management
