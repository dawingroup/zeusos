/**
 * Unified Supplier Service
 *
 * Service for managing suppliers with subsidiary filtering.
 * Supports all subsidiaries from a single collection: platform/suppliers
 *
 * Migrated from: src/subsidiaries/advisory/matflow/services/supplier-service.ts
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type {
  Supplier,
  SupplierStatus,
  SupplierQuotation,
  RequestForQuotation,
  CreateSupplierInput,
  MaterialRate,
  SupplierCategory,
  SubsidiaryId,
  SupplierFilters,
} from '../types/supplier';

// Generate unique IDs
const generateId = (prefix: string = 'sup'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================================
// COLLECTION REFERENCE
// ============================================================================

// Unified collection - all suppliers in one place
const SUPPLIERS_COLLECTION = 'platform/suppliers/records';
const QUOTATIONS_COLLECTION = 'platform/suppliers/quotations';
const RFQ_COLLECTION = 'platform/suppliers/rfqs';

const suppliersRef = collection(db, SUPPLIERS_COLLECTION);

// ============================================================================
// SUBSIDIARY FILTERING HELPERS
// ============================================================================

/**
 * Check if a supplier is available for a given subsidiary
 */
function isSupplierAvailableForSubsidiary(supplier: Supplier, subsidiaryId?: SubsidiaryId): boolean {
  // If no subsidiary filter, return all
  if (!subsidiaryId) return true;

  // If supplier has no subsidiaries defined or includes 'all', it's available everywhere
  if (!supplier.subsidiaries || supplier.subsidiaries.length === 0 || supplier.subsidiaries.includes('all')) {
    return true;
  }

  // Check if the supplier serves this subsidiary
  return supplier.subsidiaries.includes(subsidiaryId);
}

/**
 * Filter suppliers by subsidiary (client-side filtering since Firestore doesn't support array-contains-any with 'all')
 */
function filterBySubsidiary(suppliers: Supplier[], subsidiaryId?: SubsidiaryId): Supplier[] {
  if (!subsidiaryId) return suppliers;
  return suppliers.filter((s) => isSupplierAvailableForSubsidiary(s, subsidiaryId));
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export const createSupplier = async (input: CreateSupplierInput): Promise<Supplier> => {
  const supplierId = generateId('sup');
  const supplierCode = input.code || (await generateSupplierCode(input.category || 'other'));

  // Default address if not provided
  const defaultAddress = {
    line1: '',
    city: '',
    country: 'Uganda',
  };

  const supplier: Supplier = {
    id: supplierId,
    code: supplierCode,
    name: input.name || '',
    contactPerson: input.contactPerson || '',
    email: input.email || '',
    phone: input.phone,
    address: {
      ...defaultAddress,
      ...input.address,
    },
    categories: input.categories || (input.category ? [input.category] : []),
    materials: [],
    status: 'active',
    totalOrders: 0,
    totalValue: { amount: 0, currency: 'UGX' },
    paymentTerms: input.paymentTerms || 'Net 30',
    subsidiaries: input.subsidiaries || ['all'], // Default to all subsidiaries
    audit: {
      createdAt: Timestamp.now(),
      createdBy: input.createdBy,
      updatedAt: Timestamp.now(),
      updatedBy: input.createdBy,
      version: 1,
    },
  };

  // Add optional fields only if they have values
  if (input.alternatePhone) supplier.alternatePhone = input.alternatePhone;
  if (input.taxId) supplier.taxId = input.taxId;
  if (input.bankDetails) supplier.bankDetails = input.bankDetails;
  if (input.creditLimit) supplier.creditLimit = { amount: input.creditLimit, currency: 'UGX' };
  if (input.tradeName) supplier.tradeName = input.tradeName;

  await setDoc(doc(suppliersRef, supplierId), supplier);
  return supplier;
};

const generateSupplierCode = async (category: SupplierCategory): Promise<string> => {
  const categoryPrefix: Record<SupplierCategory, string> = {
    materials: 'MAT',
    equipment: 'EQP',
    services: 'SVC',
    subcontractor: 'SUB',
    contractor: 'CON',
    other: 'OTH',
  };

  const q = query(suppliersRef, where('categories', 'array-contains', category));
  const snapshot = await getDocs(q);
  const count = snapshot.size + 1;

  return `${categoryPrefix[category]}-${count.toString().padStart(4, '0')}`;
};

export const updateSupplier = async (
  supplierId: string,
  updates: Partial<Supplier>,
  userId: string
): Promise<void> => {
  const supplierDocRef = doc(suppliersRef, supplierId);

  // Strip undefined values recursively — Firestore rejects them
  const stripUndefined = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) =>
          v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && typeof (v as any).toDate !== 'function'
            ? [k, stripUndefined(v as Record<string, unknown>)]
            : [k, v],
        ),
    );
  const cleaned = stripUndefined(updates as Record<string, unknown>);

  await updateDoc(supplierDocRef, {
    ...cleaned,
    'audit.updatedAt': serverTimestamp(),
    'audit.updatedBy': userId,
    'audit.version': increment(1),
  });
};

export const getSupplier = async (supplierId: string): Promise<Supplier | null> => {
  const supplierDocRef = doc(suppliersRef, supplierId);
  const snapshot = await getDoc(supplierDocRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Supplier;
};

export const deactivateSupplier = async (
  supplierId: string,
  userId: string,
  _reason: string
): Promise<void> => {
  await updateSupplier(
    supplierId,
    {
      status: 'inactive',
    },
    userId
  );
};

export const reactivateSupplier = async (supplierId: string, userId: string): Promise<void> => {
  await updateSupplier(
    supplierId,
    {
      status: 'active',
    },
    userId
  );
};

export const blacklistSupplier = async (
  supplierId: string,
  userId: string,
  _reason: string
): Promise<void> => {
  await updateSupplier(
    supplierId,
    {
      status: 'blacklisted',
    },
    userId
  );
};

// ============================================================================
// MATERIAL RATES
// ============================================================================

export const addMaterialRate = async (
  supplierId: string,
  rate: Omit<MaterialRate, 'addedAt' | 'addedBy'>,
  userId: string
): Promise<void> => {
  const supplier = await getSupplier(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const newRate: MaterialRate = {
    ...rate,
    addedAt: Timestamp.now(),
    addedBy: userId,
  };

  // Add material ID to supplier's materials list if not already there
  const materials = supplier.materials || [];
  if (!materials.includes(rate.materialId)) {
    materials.push(rate.materialId);
  }

  const supplierDocRef = doc(suppliersRef, supplierId);
  await updateDoc(supplierDocRef, {
    materials,
    [`materialRates.${rate.materialId}`]: newRate,
    'audit.updatedAt': serverTimestamp(),
    'audit.updatedBy': userId,
  });
};

export const updateMaterialRate = async (
  supplierId: string,
  materialId: string,
  newPrice: number,
  userId: string,
  effectiveDate?: Date
): Promise<void> => {
  const supplierDocRef = doc(suppliersRef, supplierId);

  await updateDoc(supplierDocRef, {
    [`materialRates.${materialId}.unitPrice`]: newPrice,
    [`materialRates.${materialId}.effectiveDate`]: effectiveDate
      ? Timestamp.fromDate(effectiveDate)
      : Timestamp.now(),
    [`materialRates.${materialId}.addedAt`]: Timestamp.now(),
    [`materialRates.${materialId}.addedBy`]: userId,
    'audit.updatedAt': serverTimestamp(),
    'audit.updatedBy': userId,
  });
};

export const removeMaterialRate = async (
  supplierId: string,
  materialId: string,
  userId: string
): Promise<void> => {
  const supplier = await getSupplier(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const materials = (supplier.materials || []).filter((m) => m !== materialId);

  const supplierDocRef = doc(suppliersRef, supplierId);
  await updateDoc(supplierDocRef, {
    materials,
    [`materialRates.${materialId}`]: null,
    'audit.updatedAt': serverTimestamp(),
    'audit.updatedBy': userId,
  });
};

// ============================================================================
// PERFORMANCE TRACKING
// ============================================================================

export const updatePerformanceMetrics = async (
  supplierId: string,
  metrics: {
    orderCompleted?: boolean;
    deliveryOnTime?: boolean;
    qualityPassed?: boolean;
    leadTimeDays?: number;
  },
  userId: string
): Promise<void> => {
  const supplier = await getSupplier(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const updates: Record<string, unknown> = {
    'audit.updatedAt': serverTimestamp(),
    'audit.updatedBy': userId,
  };

  if (metrics.orderCompleted !== undefined) {
    updates.totalOrders = increment(1);
  }

  if (metrics.deliveryOnTime !== undefined && metrics.deliveryOnTime) {
    updates.onTimeDeliveryRate = increment(1);
  }

  if (metrics.qualityPassed !== undefined && metrics.qualityPassed) {
    updates.qualityScore = increment(1);
  }

  const supplierDocRef = doc(suppliersRef, supplierId);
  await updateDoc(supplierDocRef, updates);
};

export const calculateSupplierRating = (supplier: Supplier): number => {
  const weights = {
    onTimeDelivery: 0.4,
    quality: 0.3,
    orderCompletion: 0.3,
  };

  const onTimeRate = supplier.onTimeDeliveryRate || 0;
  const qualityRate = supplier.qualityScore || 0;
  const completionRate = supplier.totalOrders > 0 ? 1 : 0;

  const rating =
    ((onTimeRate / 100) * weights.onTimeDelivery +
      (qualityRate / 100) * weights.quality +
      completionRate * weights.orderCompletion) *
    5;

  return Math.min(5, Math.max(0, rating));
};

export const getSupplierPerformanceReport = async (
  supplierId: string
): Promise<{
  supplier: Supplier;
  rating: number;
  recommendations: string[];
}> => {
  const supplier = await getSupplier(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const rating = calculateSupplierRating(supplier);
  const recommendations: string[] = [];

  if ((supplier.onTimeDeliveryRate || 0) < 70) {
    recommendations.push('On-time delivery rate is low. Consider negotiating better delivery schedules.');
  }
  if ((supplier.qualityScore || 0) < 90) {
    recommendations.push('Quality score could be improved. Consider stricter quality requirements.');
  }
  if (rating < 3) {
    recommendations.push('Overall rating is below average. Consider finding alternative suppliers.');
  }

  return {
    supplier,
    rating,
    recommendations,
  };
};

// ============================================================================
// QUERIES WITH SUBSIDIARY FILTERING
// ============================================================================

export const getSuppliers = async (filters?: SupplierFilters): Promise<Supplier[]> => {
  let q;

  if (filters?.status) {
    // Query with status filter only (uses single-field auto-index)
    // Sort client-side to avoid needing a composite index
    q = query(suppliersRef, where('status', '==', filters.status));
  } else {
    q = query(suppliersRef, orderBy('name'));
  }

  const snapshot = await getDocs(q);
  let suppliers = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Supplier[];

  // Sort by name client-side
  suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Client-side filtering for subsidiary
  if (filters?.subsidiaryId) {
    suppliers = filterBySubsidiary(suppliers, filters.subsidiaryId);
  }

  // Client-side filtering for category
  if (filters?.category) {
    suppliers = suppliers.filter((s) => s.categories?.includes(filters.category!));
  }

  // Client-side filtering for minRating
  if (filters?.minRating) {
    suppliers = suppliers.filter((s) => (s.rating || 0) >= filters.minRating!);
  }

  return suppliers;
};

export const getActiveSuppliers = async (subsidiaryId?: SubsidiaryId): Promise<Supplier[]> => {
  return getSuppliers({ status: 'active', subsidiaryId });
};

export const getSuppliersByCategory = async (
  category: string,
  subsidiaryId?: SubsidiaryId
): Promise<Supplier[]> => {
  const q = query(
    suppliersRef,
    where('categories', 'array-contains', category),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  let suppliers = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Supplier[];

  return filterBySubsidiary(suppliers, subsidiaryId);
};

export const getSuppliersByMaterial = async (
  materialId: string,
  subsidiaryId?: SubsidiaryId
): Promise<Supplier[]> => {
  const q = query(
    suppliersRef,
    where('materials', 'array-contains', materialId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  let suppliers = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Supplier[];

  return filterBySubsidiary(suppliers, subsidiaryId);
};

export const searchSuppliers = async (
  searchTerm: string,
  subsidiaryId?: SubsidiaryId
): Promise<Supplier[]> => {
  const allSuppliers = await getSuppliers({ status: 'active', subsidiaryId });
  const term = searchTerm.toLowerCase();

  return allSuppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(term) ||
      s.code.toLowerCase().includes(term) ||
      s.contactPerson?.toLowerCase().includes(term) ||
      s.address.city.toLowerCase().includes(term)
  );
};

// ============================================================================
// SUBSCRIPTIONS WITH SUBSIDIARY FILTERING
// ============================================================================

export const subscribeToSupplier = (
  supplierId: string,
  callback: (supplier: Supplier | null) => void
): (() => void) => {
  const supplierDocRef = doc(suppliersRef, supplierId);

  return onSnapshot(supplierDocRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Supplier);
    } else {
      callback(null);
    }
  });
};

const DEFAULT_SUBSCRIBE_SUPPLIERS_LIMIT = 500;

export const subscribeToSuppliers = (
  callback: (suppliers: Supplier[]) => void,
  status?: SupplierStatus,
  subsidiaryId?: SubsidiaryId,
  options?: { maxResults?: number; unbounded?: boolean },
): (() => void) => {
  let q = query(suppliersRef, orderBy('name'));

  if (status) {
    q = query(q, where('status', '==', status));
  }

  const effectiveLimit = options?.unbounded
    ? undefined
    : (options?.maxResults ?? DEFAULT_SUBSCRIBE_SUPPLIERS_LIMIT);
  if (effectiveLimit !== undefined) {
    q = query(q, limit(effectiveLimit));
  }

  return onSnapshot(q, (snapshot) => {
    let suppliers = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Supplier[];

    // Apply subsidiary filter
    suppliers = filterBySubsidiary(suppliers, subsidiaryId);

    if (effectiveLimit !== undefined && snapshot.size >= effectiveLimit) {
      console.warn(
        `[suppliers] subscribeToSuppliers hit the ${effectiveLimit}-row cap. ` +
        `Pass options.unbounded=true or raise maxResults if intentional.`,
      );
    }

    callback(suppliers);
  });
};

// ============================================================================
// QUOTATION MANAGEMENT
// ============================================================================

export const createQuotation = async (
  quotation: Omit<SupplierQuotation, 'id' | 'status'>,
  _userId: string
): Promise<string> => {
  const quotationId = generateId('quot');
  const quotationsRef = collection(db, QUOTATIONS_COLLECTION);

  const fullQuotation: SupplierQuotation = {
    ...quotation,
    id: quotationId,
    status: 'received',
  };

  await setDoc(doc(quotationsRef, quotationId), fullQuotation);
  return quotationId;
};

export const getSupplierQuotations = async (supplierId: string): Promise<SupplierQuotation[]> => {
  const quotationsRef = collection(db, QUOTATIONS_COLLECTION);
  const q = query(quotationsRef, where('supplierId', '==', supplierId), orderBy('quotationDate', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as SupplierQuotation[];
};

// ============================================================================
// RFQ MANAGEMENT
// ============================================================================

export const createRFQ = async (
  rfq: Omit<RequestForQuotation, 'id' | 'status'>,
  _userId: string
): Promise<string> => {
  const rfqId = generateId('rfq');
  const rfqsRef = collection(db, RFQ_COLLECTION);

  const fullRFQ: RequestForQuotation = {
    ...rfq,
    id: rfqId,
    status: 'draft',
  };

  await setDoc(doc(rfqsRef, rfqId), fullRFQ);
  return rfqId;
};

export const sendRFQ = async (rfqId: string, supplierIds: string[], userId: string): Promise<void> => {
  const rfqsRef = collection(db, RFQ_COLLECTION);
  const rfqDocRef = doc(rfqsRef, rfqId);

  await updateDoc(rfqDocRef, {
    status: 'sent',
    sentToSuppliers: supplierIds,
    sentAt: Timestamp.now(),
    sentBy: userId,
  });
};

// ============================================================================
// EXPORTED SERVICE OBJECT
// ============================================================================

export const supplierService = {
  createSupplier,
  updateSupplier,
  getSupplier,
  deactivateSupplier,
  reactivateSupplier,
  blacklistSupplier,
  addMaterialRate,
  updateMaterialRate,
  removeMaterialRate,
  updatePerformanceMetrics,
  calculateSupplierRating,
  getSupplierPerformanceReport,
  getSuppliers,
  getActiveSuppliers,
  getSuppliersByCategory,
  getSuppliersByMaterial,
  searchSuppliers,
  subscribeToSupplier,
  subscribeToSuppliers,
  createQuotation,
  getSupplierQuotations,
  createRFQ,
  sendRFQ,
};

export default supplierService;
