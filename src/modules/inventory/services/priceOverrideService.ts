/**
 * Price Override Service
 * Manages project and customer-level price overrides
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

export interface PriceOverride {
  id: string;
  sku: string;
  itemName: string;
  costPerUnit: number;
  currency: string;
  unit: string;
  reason?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface PriceOverrideFormData {
  sku: string;
  itemName: string;
  costPerUnit: number;
  currency: string;
  unit: string;
  reason?: string;
}

/**
 * Get project price overrides
 */
export async function getProjectPriceOverrides(projectId: string): Promise<PriceOverride[]> {
  const overridesRef = collection(db, 'designProjects', projectId, 'priceOverrides');
  const snapshot = await getDocs(overridesRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as PriceOverride[];
}

/**
 * Get customer price overrides
 */
export async function getCustomerPriceOverrides(customerId: string): Promise<PriceOverride[]> {
  const overridesRef = collection(db, 'customers', customerId, 'priceOverrides');
  const snapshot = await getDocs(overridesRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as PriceOverride[];
}

/**
 * Add project price override
 */
export async function addProjectPriceOverride(
  projectId: string,
  data: PriceOverrideFormData,
  userId: string
): Promise<string> {
  const overridesRef = collection(db, 'designProjects', projectId, 'priceOverrides');
  
  // Check if override already exists for this SKU
  const existingQuery = query(overridesRef, where('sku', '==', data.sku));
  const existing = await getDocs(existingQuery);
  
  if (!existing.empty) {
    // Update existing
    const docRef = existing.docs[0].ref;
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return existing.docs[0].id;
  }
  
  // Create new
  const docRef = await addDoc(overridesRef, {
    ...data,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

/**
 * Add customer price override
 */
export async function addCustomerPriceOverride(
  customerId: string,
  data: PriceOverrideFormData,
  userId: string
): Promise<string> {
  const overridesRef = collection(db, 'customers', customerId, 'priceOverrides');
  
  // Check if override already exists for this SKU
  const existingQuery = query(overridesRef, where('sku', '==', data.sku));
  const existing = await getDocs(existingQuery);
  
  if (!existing.empty) {
    // Update existing
    const docRef = existing.docs[0].ref;
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return existing.docs[0].id;
  }
  
  // Create new
  const docRef = await addDoc(overridesRef, {
    ...data,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

/**
 * Delete project price override
 */
export async function deleteProjectPriceOverride(
  projectId: string,
  overrideId: string
): Promise<void> {
  const docRef = doc(db, 'designProjects', projectId, 'priceOverrides', overrideId);
  await deleteDoc(docRef);
}

/**
 * Delete customer price override
 */
export async function deleteCustomerPriceOverride(
  customerId: string,
  overrideId: string
): Promise<void> {
  const docRef = doc(db, 'customers', customerId, 'priceOverrides', overrideId);
  await deleteDoc(docRef);
}
