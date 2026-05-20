/**
 * Audience Service
 * Customer segmentation and audience resolution for campaigns
 * Integrates with Customer Hub for targeting
 */

import {
  collection,
  query,
  where,
  getDocs,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { AudienceSegment, AudienceFilters } from '../types';

// ============================================
// Customer Interface (from Customer Hub)
// ============================================

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status?: 'active' | 'inactive' | 'prospect';
  customerType?: 'residential' | 'commercial' | 'contractor' | 'designer';
  tags?: string[];
  projectCount?: number;
  [key: string]: any;
}

const CUSTOMERS_COLLECTION = 'customers';

// ============================================
// Audience Resolution
// ============================================

/**
 * Resolve audience segment to list of customers
 */
export async function resolveAudienceToCustomers(
  companyId: string,
  segment: AudienceSegment
): Promise<Customer[]> {
  switch (segment.segmentType) {
    case 'all':
      return await getAllCustomers(companyId);

    case 'customer_ids':
      if (!segment.customerIds || segment.customerIds.length === 0) {
        return [];
      }
      return await getCustomersByIds(segment.customerIds);

    case 'filters':
      if (!segment.filters) {
        return [];
      }
      return await getCustomersByFilters(companyId, segment.filters);

    default:
      return [];
  }
}

/**
 * Get all customers for a company
 */
async function getAllCustomers(companyId: string): Promise<Customer[]> {
  const customersRef = collection(db, CUSTOMERS_COLLECTION);
  const q = query(customersRef, where('companyId', '==', companyId));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Customer[];
}

/**
 * Get customers by IDs
 */
async function getCustomersByIds(customerIds: string[]): Promise<Customer[]> {
  const customers: Customer[] = [];

  // Firestore 'in' queries limited to 10 items, batch them
  const batches = [];
  for (let i = 0; i < customerIds.length; i += 10) {
    batches.push(customerIds.slice(i, i + 10));
  }

  const customersRef = collection(db, CUSTOMERS_COLLECTION);

  for (const batch of batches) {
    const q = query(customersRef, where('__name__', 'in', batch));
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((doc) => {
      customers.push({
        id: doc.id,
        ...doc.data(),
      } as Customer);
    });
  }

  return customers;
}

/**
 * Get customers by filters
 */
async function getCustomersByFilters(
  companyId: string,
  filters: AudienceFilters
): Promise<Customer[]> {
  const customersRef = collection(db, CUSTOMERS_COLLECTION);
  const constraints: QueryConstraint[] = [where('companyId', '==', companyId)];

  // Apply Firestore-compatible filters
  if (filters.customerStatus && filters.customerStatus.length > 0) {
    if (filters.customerStatus.length === 1) {
      constraints.push(where('status', '==', filters.customerStatus[0]));
    } else {
      constraints.push(where('status', 'in', filters.customerStatus));
    }
  }

  if (filters.customerType && filters.customerType.length > 0) {
    if (filters.customerType.length === 1) {
      constraints.push(where('customerType', '==', filters.customerType[0]));
    } else {
      constraints.push(where('customerType', 'in', filters.customerType));
    }
  }

  const q = query(customersRef, ...constraints);
  const snapshot = await getDocs(q);

  let customers = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Customer[];

  // Apply client-side filters
  if (filters.hasWhatsApp) {
    customers = customers.filter((c) => !!c.phone && c.phone.length > 0);
  }

  if (filters.tags && filters.tags.length > 0) {
    customers = customers.filter((c) =>
      c.tags && c.tags.some((tag) => filters.tags!.includes(tag))
    );
  }

  if (filters.minProjectCount !== undefined) {
    customers = customers.filter((c) =>
      (c.projectCount || 0) >= filters.minProjectCount!
    );
  }

  return customers;
}

// ============================================
// Audience Validation & Estimation
// ============================================

/**
 * Estimate audience size based on segment configuration
 */
export async function estimateAudienceSize(
  companyId: string,
  segment: Omit<AudienceSegment, 'estimatedSize'>
): Promise<number> {
  const customers = await resolveAudienceToCustomers(companyId, {
    ...segment,
    estimatedSize: 0,
  });

  return customers.length;
}

/**
 * Validate audience segment
 * Returns validation errors if any
 */
export function validateAudienceSegment(
  segment: AudienceSegment
): string[] {
  const errors: string[] = [];

  if (segment.segmentType === 'customer_ids') {
    if (!segment.customerIds || segment.customerIds.length === 0) {
      errors.push('Customer IDs are required for customer_ids segment type');
    }
  }

  if (segment.segmentType === 'filters') {
    if (!segment.filters) {
      errors.push('Filters are required for filters segment type');
    } else {
      const hasAnyFilter =
        segment.filters.customerType ||
        segment.filters.customerStatus ||
        segment.filters.tags ||
        segment.filters.hasWhatsApp !== undefined ||
        segment.filters.minProjectCount !== undefined;

      if (!hasAnyFilter) {
        errors.push('At least one filter must be specified');
      }
    }
  }

  if (segment.estimatedSize === 0 && segment.segmentType !== 'all') {
    errors.push('Audience size is 0. Please adjust your filters or segment type.');
  }

  return errors;
}

// ============================================
// Customer Filtering Helpers
// ============================================

/**
 * Get customers with WhatsApp capability (have phone numbers)
 */
export async function getWhatsAppEnabledCustomers(
  companyId: string
): Promise<Customer[]> {
  const customers = await getAllCustomers(companyId);
  return customers.filter((c) => !!c.phone && c.phone.length > 0);
}

/**
 * Get active customers
 */
export async function getActiveCustomers(
  companyId: string
): Promise<Customer[]> {
  const customersRef = collection(db, CUSTOMERS_COLLECTION);
  const q = query(
    customersRef,
    where('companyId', '==', companyId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Customer[];
}

/**
 * Get customers by tags
 */
export async function getCustomersByTags(
  companyId: string,
  tags: string[]
): Promise<Customer[]> {
  const customers = await getAllCustomers(companyId);

  return customers.filter((c) =>
    c.tags && c.tags.some((tag) => tags.includes(tag))
  );
}

// ============================================
// Audience Insights
// ============================================

/**
 * Get audience statistics and insights
 */
export async function getAudienceInsights(
  companyId: string,
  segment: AudienceSegment
): Promise<{
  totalSize: number;
  withWhatsApp: number;
  withoutWhatsApp: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  averageProjectCount: number;
}> {
  const customers = await resolveAudienceToCustomers(companyId, segment);

  const withWhatsApp = customers.filter((c) => !!c.phone).length;
  const withoutWhatsApp = customers.length - withWhatsApp;

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalProjectCount = 0;

  customers.forEach((c) => {
    // Count by status
    const status = c.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Count by type
    const type = c.customerType || 'unknown';
    byType[type] = (byType[type] || 0) + 1;

    // Sum project counts
    totalProjectCount += c.projectCount || 0;
  });

  return {
    totalSize: customers.length,
    withWhatsApp,
    withoutWhatsApp,
    byStatus,
    byType,
    averageProjectCount: customers.length > 0 ? totalProjectCount / customers.length : 0,
  };
}

/**
 * Preview audience (get first N customers)
 */
export async function previewAudience(
  companyId: string,
  segment: AudienceSegment,
  limitCount = 10
): Promise<Customer[]> {
  const customers = await resolveAudienceToCustomers(companyId, segment);
  return customers.slice(0, limitCount);
}
