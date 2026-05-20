/**
 * Customer Service for MatFlow
 * Interfaces with the shared customer collection
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type { 
  SharedCustomer, 
  MatFlowCustomerSummary,
  SubsidiaryEngagement,
} from '../types/customer';

const CUSTOMERS_COLLECTION = 'customers';

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get all customers available to MatFlow
 */
export async function getCustomersForMatFlow(): Promise<MatFlowCustomerSummary[]> {
  const customersRef = collection(db, CUSTOMERS_COLLECTION);
  const q = query(
    customersRef,
    where('status', 'in', ['active', 'prospect']),
    orderBy('name', 'asc'),
    limit(100)
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data() as SharedCustomer;
    const advisoryEngagement = data.subsidiaryEngagements?.find(
      e => e.subsidiaryId === 'advisory'
    );
    const primaryContact = data.contacts?.find(c => c.isPrimary);
    
    return {
      id: docSnap.id,
      code: data.code,
      name: data.name,
      type: data.type,
      status: data.status,
      primaryContact,
      phone: primaryContact?.phone || data.phone,
      email: primaryContact?.email || data.email,
      district: data.physicalAddress?.district,
      advisoryStats: advisoryEngagement ? {
        totalProjects: advisoryEngagement.totalProjects,
        activeProjects: 0, // Calculated separately
        totalValue: advisoryEngagement.totalValue,
        lastProjectDate: advisoryEngagement.lastProjectDate,
      } : undefined,
    };
  });
}

/**
 * Get a single customer by ID
 */
export async function getCustomerById(customerId: string): Promise<SharedCustomer | null> {
  const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
  const snapshot = await getDoc(customerRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as SharedCustomer;
}

/**
 * Search customers by name or code
 */
export async function searchCustomers(
  searchTerm: string,
  limitCount = 20
): Promise<MatFlowCustomerSummary[]> {
  const customersRef = collection(db, CUSTOMERS_COLLECTION);
  
  // Firestore doesn't support full-text search, so we fetch and filter client-side
  // For production, consider Algolia or Elasticsearch
  const q = query(
    customersRef,
    where('status', 'in', ['active', 'prospect']),
    orderBy('name', 'asc'),
    limit(100)
  );
  
  const snapshot = await getDocs(q);
  const searchLower = searchTerm.toLowerCase();
  
  const filtered = snapshot.docs
    .filter(docSnap => {
      const data = docSnap.data() as SharedCustomer;
      return (
        data.name.toLowerCase().includes(searchLower) ||
        data.code.toLowerCase().includes(searchLower) ||
        data.tradingName?.toLowerCase().includes(searchLower)
      );
    })
    .slice(0, limitCount);
  
  return filtered.map(docSnap => {
    const data = docSnap.data() as SharedCustomer;
    const primaryContact = data.contacts?.find(c => c.isPrimary);
    
    return {
      id: docSnap.id,
      code: data.code,
      name: data.name,
      type: data.type,
      status: data.status,
      primaryContact,
      phone: primaryContact?.phone || data.phone,
      email: primaryContact?.email || data.email,
      district: data.physicalAddress?.district,
    };
  });
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Update customer's Advisory engagement stats
 * Called when projects are created/completed
 */
export async function updateAdvisoryEngagement(
  customerId: string,
  update: {
    projectCreated?: boolean;
    projectCompleted?: boolean;
    projectValue?: number;
  }
): Promise<void> {
  const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
  const customerDoc = await getDoc(customerRef);
  
  if (!customerDoc.exists()) {
    throw new Error(`Customer ${customerId} not found`);
  }
  
  const data = customerDoc.data() as SharedCustomer;
  const existingEngagement = data.subsidiaryEngagements?.find(
    e => e.subsidiaryId === 'advisory'
  );
  
  const now = Timestamp.now();
  
  if (existingEngagement) {
    // Update existing engagement
    const updatedEngagements = data.subsidiaryEngagements.map(e => {
      if (e.subsidiaryId !== 'advisory') return e;
      
      return {
        ...e,
        totalProjects: update.projectCreated 
          ? e.totalProjects + 1 
          : e.totalProjects,
        totalValue: update.projectValue 
          ? e.totalValue + update.projectValue 
          : e.totalValue,
        lastProjectDate: update.projectCreated ? now : e.lastProjectDate,
        status: 'active' as const,
      };
    });
    
    await updateDoc(customerRef, {
      subsidiaryEngagements: updatedEngagements,
      updatedAt: serverTimestamp(),
    });
  } else {
    // Create new Advisory engagement
    const newEngagement: SubsidiaryEngagement = {
      subsidiaryId: 'advisory',
      subsidiaryName: 'Dawin Advisory',
      engagementType: 'advisory',
      firstProjectDate: now,
      lastProjectDate: now,
      totalProjects: update.projectCreated ? 1 : 0,
      totalValue: update.projectValue || 0,
      currency: 'UGX',
      status: 'active',
    };
    
    await updateDoc(customerRef, {
      subsidiaryEngagements: arrayUnion(newEngagement),
      updatedAt: serverTimestamp(),
    });
  }
}
