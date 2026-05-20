/**
 * EFRIS Tax Invoice Validation Types
 * Uganda Revenue Authority Electronic Fiscal Receipting and Invoicing Solution
 */

// EFRIS Invoice Status
export type EFRISInvoiceStatus =
  | 'pending'        // Not yet validated
  | 'valid'          // Successfully validated with URA
  | 'invalid'        // Failed validation
  | 'expired'        // Fiscal document expired
  | 'cancelled'      // Invoice was cancelled in EFRIS
  | 'not_found';     // FDN not found in EFRIS

// EFRIS Taxpayer Status
export type TaxpayerStatus =
  | 'active'
  | 'suspended'
  | 'deregistered'
  | 'unknown';

// VAT Rate Types in Uganda
export type VATRateType =
  | 'standard'       // 18%
  | 'zero_rated'     // 0%
  | 'exempt'         // Exempt supplies
  | 'deemed';        // Deemed VAT

// Fiscal Document Number (FDN) structure
export interface FiscalDocumentNumber {
  fdn: string;                    // Full FDN string
  deviceNumber: string;           // EFD device number
  fiscalDocNumber: string;        // Sequential fiscal document number
  verificationCode: string;       // Verification code for validation
}

// EFRIS Invoice from URA system
export interface EFRISInvoice {
  fdn: string;
  invoiceNumber: string;
  invoiceDate: string;            // ISO date string
  invoiceTime: string;            // HH:mm:ss format
  
  // Seller Information
  seller: {
    tin: string;                  // Tax Identification Number
    name: string;
    tradeName?: string;
    address: string;
    phone?: string;
    email?: string;
    vatRegistered: boolean;
  };
  
  // Buyer Information
  buyer: {
    tin?: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  
  // Invoice Amounts
  amounts: {
    subtotal: number;
    vatAmount: number;
    totalAmount: number;
    currency: 'UGX' | 'USD';
    exchangeRate?: number;        // If USD, rate to UGX
  };
  
  // Line Items
  items: EFRISInvoiceItem[];
  
  // Tax Details
  taxBreakdown: TaxBreakdown[];
  
  // Status
  status: 'normal' | 'credit_note' | 'debit_note';
  originalFdn?: string;           // For credit/debit notes
  
  // Timestamps
  issuedAt: string;               // ISO timestamp
  validatedAt?: string;           // When we validated it
}

// EFRIS Invoice Line Item
export interface EFRISInvoiceItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
  vatAmount: number;
  vatRateType: VATRateType;
  itemCode?: string;              // Supplier's item code
  hsCode?: string;                // Harmonized System code
}

// Tax Breakdown by Rate
export interface TaxBreakdown {
  vatRateType: VATRateType;
  vatRate: number;
  taxableAmount: number;
  vatAmount: number;
}

// EFRIS Validation Request
export interface EFRISValidationRequest {
  fdn: string;
  sellerTin?: string;             // Optional: for additional verification
  invoiceAmount?: number;         // Optional: for amount matching
}

// EFRIS Validation Response
export interface EFRISValidationResponse {
  success: boolean;
  status: EFRISInvoiceStatus;
  invoice?: EFRISInvoice;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  validatedAt: string;
}

// Supplier Tax Profile
export interface SupplierTaxProfile {
  supplierId: string;
  tin: string;
  tradeName: string;
  legalName: string;
  vatRegistered: boolean;
  taxStatus: TaxpayerStatus;
  registrationDate?: string;
  lastVerified: string;
  verificationHistory: TaxVerificationRecord[];
}

// Tax Verification Record
export interface TaxVerificationRecord {
  verifiedAt: string;
  status: TaxpayerStatus;
  vatRegistered: boolean;
  source: 'efris' | 'manual';
  verifiedBy?: string;
}

// Invoice Validation Record (stored in Firestore)
export interface InvoiceValidationRecord {
  id: string;
  projectId: string;
  deliveryId?: string;            // Links to procurement delivery
  purchaseOrderId?: string;
  
  // Invoice Details
  fdn: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierTin: string;
  supplierName: string;
  
  // Amounts
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  currency: 'UGX' | 'USD';
  
  // Validation Status
  validationStatus: EFRISInvoiceStatus;
  validatedAt?: string;
  validationError?: string;
  
  // Matching Status
  amountMatches: boolean;
  supplierMatches: boolean;
  itemsMatched: number;
  itemsTotal: number;
  
  // Full EFRIS response (cached)
  efrisInvoice?: EFRISInvoice;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  lastValidationAttempt?: string;
}

// Invoice Match Result
export interface InvoiceMatchResult {
  overallMatch: 'exact' | 'partial' | 'mismatch' | 'unverified';
  amountMatch: {
    matches: boolean;
    expectedAmount: number;
    invoiceAmount: number;
    variance: number;
    variancePercent: number;
  };
  supplierMatch: {
    matches: boolean;
    expectedSupplier: string;
    invoiceSupplier: string;
    tinMatches: boolean;
  };
  itemMatches: ItemMatchResult[];
  warnings: string[];
}

// Item Match Result
export interface ItemMatchResult {
  deliveryItemId: string;
  deliveryItemName: string;
  deliveryQuantity: number;
  invoiceLineNumber?: number;
  invoiceDescription?: string;
  invoiceQuantity?: number;
  matchStatus: 'matched' | 'partial' | 'unmatched';
  matchConfidence: number;        // 0-100
}

// EFRIS Settings
export interface EFRISSettings {
  enabled: boolean;
  autoValidate: boolean;          // Auto-validate on delivery entry
  requireValidation: boolean;     // Block without valid invoice
  amountTolerancePercent: number; // e.g., 1% variance allowed
  cacheExpiryHours: number;       // How long to cache validations
  apiEndpoint?: string;           // Custom endpoint (for testing)
}

// Tax Compliance Summary
export interface TaxComplianceSummary {
  projectId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  invoices: {
    total: number;
    validated: number;
    invalid: number;
    pending: number;
  };
  amounts: {
    totalPurchases: number;
    vatRecoverable: number;
    withValidInvoices: number;
    withInvalidInvoices: number;
    unvalidated: number;
  };
  suppliers: {
    total: number;
    vatRegistered: number;
    nonVatRegistered: number;
    suspended: number;
  };
  complianceRate: number;         // Percentage of valid invoices
}

// Delivery item interface for matching
export interface DeliveryItem {
  materialId: string;
  materialName: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
}

// Delivery log interface for validation
export interface DeliveryLogForValidation {
  id: string;
  supplierName: string;
  supplierInfo?: {
    tin?: string;
    name?: string;
  };
  totalCost?: number;
  items?: DeliveryItem[];
}
