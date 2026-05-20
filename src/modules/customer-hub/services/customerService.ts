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
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Customer, CustomerFormData, CustomerListItem, CustomerStatus } from '../types';
import { mirrorEmbeddedContactsToCollection } from './customerContactService';

// Collection reference
const customersRef = collection(db, 'customers');

/**
 * Subscribe to all customers
 */
export function subscribeToCustomers(
  callback: (customers: CustomerListItem[]) => void,
  onError?: (error: Error) => void,
  options?: {
    status?: CustomerStatus;
    /**
     * P8 follow-up: include records that have been merged away into
     * another customer. Default `false` — lists hide merged rows so
     * operators don't see duplicates after a dedupe. Set `true` for
     * the archived/merged view where the trail is the point.
     */
    includeMerged?: boolean;
  }
): () => void {
  // Simple query without compound index requirement
  const q = query(customersRef);

  return onSnapshot(
    q,
    (snapshot) => {
      let customers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          code: data.code || '',
          name: data.name || '',
          type: data.type || 'residential',
          status: data.status || 'active',
          email: data.email,
          phone: data.phone,
          contacts: data.contacts || [],
          mergedInto: data.mergedInto,
        };
      }) as CustomerListItem[];

      // Client-side filtering and sorting
      if (options?.status) {
        customers = customers.filter(c => c.status === options.status);
      }
      if (!options?.includeMerged) {
        customers = customers.filter(c => !c.mergedInto);
      }
      customers.sort((a, b) => a.name.localeCompare(b.name));

      callback(customers);
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      onError?.(error);
    }
  );
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
  
  // Strip undefined values — Firestore rejects them
  const cleanData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }

  const docRef = await addDoc(customersRef, {
    ...cleanData,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // P11-3 (F8) — mirror the embedded contacts array into the new
  // top-level `customerContacts` collection. The embedded array is
  // still the source of truth; this keeps the normalized surface in
  // sync so P11-4 readers (CRM pickers, activity forms) can adopt it
  // without waiting on a backfill.
  if (data.contacts && data.contacts.length > 0) {
    await mirrorEmbeddedContactsToCollection(docRef.id, data.contacts);
  }

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
  
  // Strip undefined values — Firestore rejects them in updateDoc
  const cleanData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }

  const docRef = doc(customersRef, customerId);
  await updateDoc(docRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // P11-3 (F8) — mirror ONLY when the patch touches `contacts`.
  // Patches that update unrelated fields (status, tags, etc.) must
  // not pay for a full collection reconciliation. Empty arrays are a
  // valid "delete everything" signal and still flow through so that
  // removed-from-UI contacts get soft-deleted in the collection.
  if (data.contacts !== undefined) {
    await mirrorEmbeddedContactsToCollection(customerId, data.contacts);
  }
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
 * Get the next sequential customer number
 */
export async function getNextCustomerNumber(): Promise<number> {
  return new Promise((resolve) => {
    const q = query(customersRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      unsubscribe();
      
      let maxNumber = 0;
      snapshot.docs.forEach((doc) => {
        const code = doc.data().code || '';
        // Extract number from DF-CUS-### format
        const match = code.match(/DF-CUS-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) maxNumber = num;
        }
      });
      
      resolve(maxNumber + 1);
    });
  });
}

/**
 * Generate a customer code in format DF-CUS-[Sequential#]
 */
export async function generateCustomerCode(): Promise<string> {
  const nextNumber = await getNextCustomerNumber();
  // Pad to 3 digits minimum (001, 002, ... 999, 1000, etc.)
  const paddedNumber = nextNumber.toString().padStart(3, '0');
  return `DF-CUS-${paddedNumber}`;
}
