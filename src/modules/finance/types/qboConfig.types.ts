/**
 * QuickBooks Configuration Types
 * Account mappings and settings for QuickBooks integration
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// LANDED COST METHOD
// ============================================================================

/**
 * How landed costs are posted on QBO Bills:
 * - 'capitalize': Post to inventory asset account (correct for absorption costing)
 * - 'expense': Post to separate expense accounts (legacy — may cause double-counting)
 */
export type LandedCostMethod = 'capitalize' | 'expense';

// ============================================================================
// ACCOUNT MAPPING
// ============================================================================

/**
 * QuickBooks GL Account Mapping Configuration
 * Maps DawinOS transaction types to QuickBooks Chart of Accounts
 */
export interface QBOAccountMapping {
  // --- Core Accounts (Required) ---
  accountsPayable: string;        // For bills from POs
  accountsReceivable: string;     // For invoices
  inventory: string;              // Inventory asset account
  cogs: string;                   // Default/fallback COGS account
  revenue: string;                // Default/fallback sales revenue

  // --- Revenue Sub-Accounts (map each income stream to a specific QBO account) ---
  revenueManufactured?: string;   // Income from manufactured/custom items
  revenueProducts?: string;       // Income from resold products
  revenueServicesAndProjects?: string; // Income from services & project work
  revenueShipping?: string;       // Shipping/delivery income charged to customers

  // --- COGS Sub-Accounts (map each cost category to a specific QBO account) ---
  cogsMaterials?: string;         // Raw materials (timber, boards, glass, etc.)
  cogsProducts?: string;          // Procured products for resale
  cogsServicesAndProjects?: string; // Services and project-specific COGS
  cogsLabour?: string;            // Internal/external labour
  cogsOutsourced?: string;        // Outsourced services (edge banding, cutting, welding, etc.)

  // --- Optional Accounts ---
  workInProgress?: string;        // WIP asset account (optional)
  fixedAssets?: string;           // Fixed/capital asset account (for PO line items categorized as 'asset')
  overhead?: string;              // Overhead/operating expense account (for 'overhead' items)
  manufacturingOverhead?: string; // Manufacturing overhead expense account (for 'manufacturing-overhead' items)
  shippingExpense?: string;       // For PO landed costs - shipping
  customsExpense?: string;        // For PO landed costs - customs/duties
  dutiesExpense?: string;         // For PO landed costs - duties
  insuranceExpense?: string;      // For PO landed costs - insurance
  handlingExpense?: string;       // For PO landed costs - handling
  otherExpense?: string;          // For PO landed costs - other
}

/**
 * QuickBooks configuration document
 */
export interface QBOConfig {
  // Account mappings
  accountMapping: QBOAccountMapping;

  // Human-readable QBO account names keyed by account ID
  // Persisted when saving account mappings so other modules can display names
  accountNames?: Record<string, string>;

  // Landed cost treatment on QBO Bills (default: capitalize)
  landedCostMethod?: LandedCostMethod;

  // Tax handling mode for QBO Bills and Invoices
  taxMode?: 'out_of_scope' | 'tax_exclusive' | 'tax_inclusive';

  /**
   * @deprecated Replaced by automatic item resolution with fuzzy matching.
   * Items are now resolved DawinOS → QBO automatically via resolveOrCreateQBOItem().
   * Kept for backward compatibility with existing config documents.
   */
  serviceItemMapping?: {
    material?: string;
    labor?: string;
    hardware?: string;
    finishing?: string;
    procurement?: string;
    construction?: string;
    other?: string;
  };

  // Payment terms mapping
  paymentTermsMapping?: {
    [days: number]: string;         // Maps days (15, 30, 45, 60) to QBO Term names
  };

  // Tax code mappings
  taxCodeMapping?: {
    noVat?: string;                 // Tax-exempt code
    standardVat?: string;           // Standard VAT code
    zeroRated?: string;             // Zero-rated code
  };

  // Custom field mappings (QBO DefinitionId values)
  customFieldMapping?: {
    poNumber?: string;              // DefinitionId for "PO No" custom field on bills
    docNumber?: string;             // DefinitionId for "Doc No" custom field on bills
  };

  // Feature flags
  features?: {
    autoSyncVendors?: boolean;      // Auto-sync suppliers to vendors on creation
    autoSyncCustomers?: boolean;    // Auto-sync customers on creation
    autoCreateBills?: boolean;      // Auto-create bills on PO approval
    autoCreateSalesOrders?: boolean; // Auto-create SOs on quote approval
    autoCreateInvoices?: boolean;   // Auto-create invoices on MO completion
    autoRecordCOGS?: boolean;       // Auto-record COGS on MO completion
  };

  // Metadata
  configuredAt?: Timestamp;
  configuredBy?: string;
  lastUpdatedAt?: Timestamp;
  lastUpdatedBy?: string;
  isConfigured: boolean;            // True if all required fields set
}

// ============================================================================
// QBO ACCOUNT INFO (from sync)
// ============================================================================

/**
 * QuickBooks account info (from Chart of Accounts sync)
 * Used to populate dropdowns in configuration UI
 */
export interface QBOAccountInfo {
  id: string;                       // QBO Account ID
  qboId: string;                    // Same as id
  name: string;                     // Account name
  fullyQualifiedName: string;       // Full path (e.g., "Assets:Current Assets:Inventory")
  accountType: string;              // e.g., "Bank", "Accounts Payable", "Expense"
  accountSubType: string;           // e.g., "Cash", "AccountsPayable", "SuppliesMaterials"
  classification: 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue'; // High-level class
  currentBalance: number;
  active: boolean;
}

/**
 * Filtered accounts by classification for dropdowns
 */
export interface QBOAccountsByClassification {
  Asset: QBOAccountInfo[];
  Liability: QBOAccountInfo[];
  Equity: QBOAccountInfo[];
  Revenue: QBOAccountInfo[];
  Expense: QBOAccountInfo[];
}

// ============================================================================
// QBO SERVICE ITEM INFO (for Sales Orders/Invoices)
// ============================================================================

/**
 * QuickBooks service/product item info
 * Used for creating sales orders and invoices
 */
export interface QBOItemInfo {
  id: string;                       // QBO Item ID
  name: string;                     // Item name
  type: 'Service' | 'Inventory' | 'NonInventory'; // Item type
  description?: string;
  unitPrice?: number;
  incomeAccountRef?: string;        // Income account for this item
  expenseAccountRef?: string;       // Expense account for this item
  active: boolean;
}

// ============================================================================
// ITEM RESOLUTION LOG
// ============================================================================

/**
 * Record of how a DawinOS item was resolved to a QBO item.
 * Stored in integrations/qbo_item_cache/resolution_log/{id}
 */
export interface QBOItemResolutionEntry {
  id: string;
  dawinosName: string;
  dawinosSku?: string;
  dawinosInventoryItemId?: string;
  dawinosCategory?: string;
  qboItemId: string;
  qboItemName: string;
  matchType: 'exact' | 'fuzzy' | 'created' | 'linked';
  matchScore?: number;
  status: 'auto-approved' | 'pending-review' | 'user-approved' | 'user-rejected';
  resolvedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validation result for QBO configuration
 */
export interface QBOConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate required account mappings
 */
export function validateQBOConfig(config: Partial<QBOConfig>): QBOConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  const required: (keyof QBOAccountMapping)[] = [
    'accountsPayable',
    'accountsReceivable',
    'inventory',
    'cogs',
    'revenue',
  ];

  for (const field of required) {
    if (!config.accountMapping?.[field]) {
      errors.push(`Missing required account mapping: ${field}`);
    }
  }

  // Only warn about expense accounts when using 'expense' method
  const landedMethod = config.landedCostMethod ?? 'capitalize';
  if (landedMethod === 'expense') {
    if (!config.accountMapping?.shippingExpense) {
      warnings.push('Shipping expense account not mapped - landed costs will use inventory account as fallback');
    }
    if (!config.accountMapping?.customsExpense) {
      warnings.push('Customs expense account not mapped - landed costs will use inventory account as fallback');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default QBO configuration with feature flags
 */
export const DEFAULT_QBO_CONFIG: Partial<QBOConfig> = {
  landedCostMethod: 'capitalize',
  features: {
    autoSyncVendors: true,
    autoSyncCustomers: true,
    autoCreateBills: true,
    autoCreateSalesOrders: true,
    autoCreateInvoices: true,
    autoRecordCOGS: true,
  },
  paymentTermsMapping: {
    15: 'Net 15',
    30: 'Net 30',
    45: 'Net 45',
    60: 'Net 60',
  },
  isConfigured: false,
};

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Account mapping field labels
 */
export const ACCOUNT_MAPPING_LABELS: Record<keyof QBOAccountMapping, string> = {
  accountsPayable: 'Accounts Payable',
  accountsReceivable: 'Accounts Receivable',
  inventory: 'Inventory Asset',
  cogs: 'COGS (Default)',
  revenue: 'Sales Revenue (Default)',
  revenueManufactured: 'Revenue - Manufactured Items',
  revenueProducts: 'Revenue - Products',
  revenueServicesAndProjects: 'Revenue - Services & Projects',
  revenueShipping: 'Revenue - Shipping Income',
  cogsMaterials: 'COGS - Materials',
  cogsProducts: 'COGS - Products',
  cogsServicesAndProjects: 'COGS - Services & Projects',
  cogsLabour: 'COGS - Labour',
  cogsOutsourced: 'COGS - Outsourced Services',
  workInProgress: 'Work in Progress (WIP)',
  fixedAssets: 'Fixed Assets',
  overhead: 'Overhead / Operating Expense',
  manufacturingOverhead: 'Manufacturing Overhead',
  shippingExpense: 'Shipping Expense',
  customsExpense: 'Customs Expense',
  dutiesExpense: 'Duties Expense',
  insuranceExpense: 'Insurance Expense',
  handlingExpense: 'Handling Expense',
  otherExpense: 'Other Expenses',
};

/**
 * Account mapping field descriptions
 */
export const ACCOUNT_MAPPING_DESCRIPTIONS: Record<keyof QBOAccountMapping, string> = {
  accountsPayable: 'Liability account for bills created from purchase orders',
  accountsReceivable: 'Asset account for invoices created from sales orders',
  inventory: 'Asset account for inventory items and materials',
  cogs: 'Fallback COGS account used when no category-specific account is mapped',
  revenue: 'Fallback revenue account used when no category-specific account is mapped',
  revenueManufactured: 'Income from custom-manufactured items (furniture, joinery, etc.)',
  revenueProducts: 'Income from procured products resold to customers',
  revenueServicesAndProjects: 'Income from design, consulting, installation, and project services',
  revenueShipping: 'Income from shipping/delivery charges billed to customers',
  cogsMaterials: 'COGS for raw materials — timber, boards, glass, hardware, etc.',
  cogsProducts: 'COGS for procured products bought ready to sell',
  cogsServicesAndProjects: 'COGS for services and project-specific costs',
  cogsLabour: 'COGS for internal and external labour costs',
  cogsOutsourced: 'COGS for outsourced services — edge banding, cutting, planing, welding, etc.',
  workInProgress: 'Asset account for work in progress (optional)',
  fixedAssets: 'Asset account for capital/fixed asset purchases on POs (equipment, machinery, etc.)',
  overhead: 'Expense account for overhead/operating cost line items on POs',
  manufacturingOverhead: 'Expense account for manufacturing overhead costs (factory rent, utilities, equipment maintenance, etc.)',
  shippingExpense: 'Expense account for shipping costs on purchase orders',
  customsExpense: 'Expense account for customs fees on purchase orders',
  dutiesExpense: 'Expense account for import duties on purchase orders',
  insuranceExpense: 'Expense account for insurance on purchase orders',
  handlingExpense: 'Expense account for handling fees on purchase orders',
  otherExpense: 'Expense account for other miscellaneous costs',
};

/**
 * Required vs optional field flags
 */
export const ACCOUNT_MAPPING_REQUIRED: Record<keyof QBOAccountMapping, boolean> = {
  accountsPayable: true,
  accountsReceivable: true,
  inventory: true,
  cogs: true,
  revenue: true,
  revenueManufactured: false,
  revenueProducts: false,
  revenueServicesAndProjects: false,
  revenueShipping: false,
  cogsMaterials: false,
  cogsProducts: false,
  cogsServicesAndProjects: false,
  cogsLabour: false,
  cogsOutsourced: false,
  workInProgress: false,
  fixedAssets: false,
  overhead: false,
  manufacturingOverhead: false,
  shippingExpense: false,
  customsExpense: false,
  dutiesExpense: false,
  insuranceExpense: false,
  handlingExpense: false,
  otherExpense: false,
};
