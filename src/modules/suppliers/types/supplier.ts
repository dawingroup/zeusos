/**
 * Unified Supplier Types
 *
 * Platform-wide supplier types with subsidiary tagging.
 * Suppliers can serve multiple subsidiaries, preventing data duplication.
 *
 * Migrated from: src/subsidiaries/advisory/matflow/types/supplier.ts
 */

import { Timestamp } from 'firebase/firestore';
import type {
  SupplierEnrichmentResult,
  ProcurementRecommendation,
  PriceTrendAnalysis,
  SupplierRiskAlert,
} from '@/modules/procurement/types/procurementAdvisor';

// ============================================================================
// BASE TYPES
// ============================================================================

export interface Money {
  amount: number;
  currency: string;
}

export interface AuditFields {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  version: number;
}

// ============================================================================
// SUBSIDIARY TYPE
// ============================================================================

export type SubsidiaryId = 'finishes' | 'advisory' | 'matflow' | 'all';

export const SUBSIDIARY_CONFIG: Record<SubsidiaryId, { label: string; description: string }> = {
  finishes: { label: 'ZeusOS Finishes', description: 'Interior finishes and materials' },
  advisory: { label: 'ZeusOS Advisory', description: 'Project advisory services' },
  matflow: { label: 'Matflow', description: 'Material flow management' },
  all: { label: 'All Subsidiaries', description: 'Available to all subsidiaries' },
};

// ============================================================================
// SUPPLIER
// ============================================================================

export interface Supplier {
  id: string;

  // Basic info
  code: string;
  name: string;
  tradeName?: string;

  // Contact
  contactPerson: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  website?: string;

  // Address
  address: SupplierAddress;

  // Business info
  registrationNumber?: string;
  taxId?: string;
  bankDetails?: BankDetails;

  // Categories
  categories: string[];
  materials: string[]; // Material IDs they supply

  // Performance
  rating?: number;
  totalOrders: number;
  totalValue: Money;
  onTimeDeliveryRate?: number;
  qualityScore?: number;

  // Terms
  paymentTerms?: string;
  creditLimit?: Money;
  currentBalance?: Money;

  // Status
  status: SupplierStatus;

  // Subsidiary Access - which subsidiaries can use this supplier
  // If not specified or empty, defaults to 'all' (available everywhere)
  subsidiaries?: SubsidiaryId[];

  // External System IDs
  externalIds?: {
    quickbooksId?: string;
    [key: string]: string | undefined;
  };

  // QuickBooks Sync Status
  qboSyncStatus?: 'pending' | 'synced' | 'error';
  qboSyncedAt?: Timestamp;
  qboSyncError?: string;

  // Contractor / Outsourced Manufacturing
  /** Free-text tags for contractor services: ['metalwork', 'upholstery', 'lacquer'] */
  contractorCapabilities?: string[];
  /** FK to warehouses — the contractor's facility */
  contractorWarehouseId?: string;
  /** Default manufacturing lead time in days */
  defaultLeadTimeDays?: number;
  /** Items this contractor typically manufactures (for auto-suggestion) */
  defaultOutsourcedItemIds?: string[];

  // AI Intelligence (persisted from Smart Procurement Advisor)
  aiIntelligence?: SupplierAIIntelligence;

  // Documents
  documents?: SupplierDocument[];

  // Audit
  audit: AuditFields;
}

export type SupplierStatus = 'active' | 'inactive' | 'blacklisted' | 'pending_approval';

export interface SupplierAddress {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  country: string;
  postalCode?: string;
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftCode?: string;
  branchCode?: string;
}

export interface SupplierDocument {
  id: string;
  type: SupplierDocumentType;
  name: string;
  url: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
  expiryDate?: Timestamp;
}

export type SupplierDocumentType =
  | 'registration'
  | 'tax_cert'
  | 'quality_cert'
  | 'insurance'
  | 'contract'
  | 'other';

// ============================================================================
// AI INTELLIGENCE (Persisted Advisor Results)
// ============================================================================

export interface SupplierAIIntelligence {
  enrichment?: SupplierEnrichmentResult;
  recommendations?: ProcurementRecommendation[];
  priceTrends?: PriceTrendAnalysis[];
  riskAlerts?: SupplierRiskAlert[];
  marketInsights?: string[];
  lastAnalyzedAt?: string;
  lastEnrichedAt?: string;
}

// ============================================================================
// SUPPLIER RATING
// ============================================================================

export interface SupplierRating {
  id: string;
  supplierId: string;

  // Rating details
  overallRating: number; // 1-5
  qualityRating: number;
  deliveryRating: number;
  priceRating: number;
  serviceRating: number;

  // Context
  projectId?: string;
  purchaseOrderId?: string;
  subsidiaryId?: SubsidiaryId;

  // Feedback
  comments?: string;
  wouldRecommend: boolean;

  // Audit
  ratedBy: string;
  ratedAt: Timestamp;
}

// ============================================================================
// SUPPLIER QUOTATION
// ============================================================================

export interface SupplierQuotation {
  id: string;
  supplierId: string;
  supplierName: string;

  // Request reference
  rfqId?: string;
  projectId?: string;

  // Quotation info
  quotationNumber: string;
  quotationDate: Timestamp;
  validUntil: Timestamp;

  // Items
  items: QuotationItem[];

  // Totals
  subtotal: Money;
  taxAmount: Money;
  totalAmount: Money;
  currency: string;

  // Terms
  paymentTerms: string;
  deliveryTerms: string;
  leadTimeDays: number;

  // Status
  status: 'received' | 'under_review' | 'accepted' | 'rejected' | 'expired';

  // Documents
  quotationDocUrl?: string;

  // Notes
  notes?: string;
  rejectionReason?: string;

  // Audit
  audit: AuditFields;
}

export interface QuotationItem {
  id: string;
  quotationId: string;

  // Item info
  description: string;
  materialId?: string;
  materialCode?: string;

  // Quantity
  quantity: number;
  unit: string;

  // Pricing
  unitRate: Money;
  amount: Money;

  // Specs
  specifications?: string;
  brand?: string;
  origin?: string;

  // Availability
  inStock: boolean;
  leadTimeDays?: number;
}

// ============================================================================
// REQUEST FOR QUOTATION (RFQ)
// ============================================================================

export interface RequestForQuotation {
  id: string;

  // RFQ info
  rfqNumber: string;
  title: string;
  description?: string;

  // Project reference
  projectId?: string;
  projectName?: string;
  requisitionId?: string;

  // Items requested
  items: RFQItem[];

  // Suppliers invited
  invitedSuppliers: string[];
  quotationsReceived: string[];

  // Timeline
  issueDate: Timestamp;
  closingDate: Timestamp;

  // Status
  status: 'draft' | 'issued' | 'closed' | 'awarded' | 'cancelled';

  // Award
  awardedSupplierId?: string;
  awardedQuotationId?: string;
  awardedAt?: Timestamp;
  awardedBy?: string;

  // Audit
  audit: AuditFields;
}

export interface RFQItem {
  id: string;

  // Item info
  description: string;
  materialId?: string;
  materialCode?: string;

  // Quantity
  quantity: number;
  unit: string;

  // Requirements
  specifications?: string;
  technicalRequirements?: string;
  requiredDeliveryDate?: Timestamp;
}

// ============================================================================
// MATERIAL RATE TYPE
// ============================================================================

export interface MaterialRate {
  materialId: string;
  materialName: string;
  unitPrice: number;
  currency: string;
  unit: string;
  minimumOrder?: number;
  leadTimeDays?: number;
  effectiveDate?: Timestamp;
  expiryDate?: Timestamp;
  addedAt: Timestamp;
  addedBy: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export type SupplierCategory = 'materials' | 'equipment' | 'services' | 'subcontractor' | 'contractor' | 'other';

export interface CreateSupplierInput {
  code?: string;
  name?: string;
  tradeName?: string;
  contactPerson?: string;
  email?: string;
  phone: string; // Only phone is mandatory
  alternatePhone?: string;
  address?: Partial<SupplierAddress>;
  categories?: string[];
  category?: SupplierCategory;
  paymentTerms?: string;
  creditLimit?: number;
  taxId?: string;
  bankDetails?: BankDetails;
  notes?: string;
  subsidiaries?: SubsidiaryId[];
  createdBy: string;
}

export interface UpdateSupplierInput {
  name?: string;
  tradeName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  address?: Partial<SupplierAddress>;
  categories?: string[];
  paymentTerms?: string;
  status?: SupplierStatus;
  subsidiaries?: SubsidiaryId[];
}

export interface SupplierPickerValue {
  supplierId: string;
  supplierName: string;
}

// ============================================================================
// CONTRACTOR PERFORMANCE METRICS
// ============================================================================

export interface ContractorPerformanceMetrics {
  totalOrders: number;
  completedOrders: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeRate: number;           // 0-100 percentage
  averageLeadTimeDays: number;
  totalSpend: number;
  lastOrderDate?: Timestamp;
  performanceScore: number;     // 0-100 composite score
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

export interface SupplierFilters {
  status?: SupplierStatus;
  subsidiaryId?: SubsidiaryId;
  category?: string;
  searchTerm?: string;
  materialId?: string;
  minRating?: number;
}

export interface SupplierSortOptions {
  field: 'name' | 'code' | 'rating' | 'totalOrders' | 'createdAt';
  direction: 'asc' | 'desc';
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

export const SUPPLIER_STATUS_CONFIG: Record<SupplierStatus, { label: string; color: string; bgClass: string; textClass: string }> = {
  active: {
    label: 'Active',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
  },
  inactive: {
    label: 'Inactive',
    color: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
  },
  blacklisted: {
    label: 'Blacklisted',
    color: 'red',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
  },
  pending_approval: {
    label: 'Pending Approval',
    color: 'yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-700',
  },
};

export const SUPPLIER_CATEGORY_CONFIG: Record<SupplierCategory, { label: string; prefix: string }> = {
  materials: { label: 'Materials', prefix: 'MAT' },
  equipment: { label: 'Equipment', prefix: 'EQP' },
  services: { label: 'Services', prefix: 'SVC' },
  subcontractor: { label: 'Subcontractor', prefix: 'SUB' },
  contractor: { label: 'Contractor', prefix: 'CON' },
  other: { label: 'Other', prefix: 'OTH' },
};
