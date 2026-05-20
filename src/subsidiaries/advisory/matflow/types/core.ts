/**
 * MATFLOW CORE TYPES
 * 
 * Core types for the MatFlow module including projects, BOQ items, and formulas.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// PROJECT STATUS
// ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 
  | 'draft'
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type ProjectType = 
  | 'new_construction'
  | 'renovation'
  | 'expansion'
  | 'rehabilitation';

// ─────────────────────────────────────────────────────────────────
// MATFLOW PROJECT
// ─────────────────────────────────────────────────────────────────

export interface MatFlowProject {
  id: string;
  name: string;
  projectCode?: string;
  description?: string;
  status: ProjectStatus;
  type?: ProjectType;
  
  // Customer
  customerId?: string;
  customerName?: string;
  
  // Location
  location?: {
    siteName: string;
    address?: string;
    district?: string;
    region?: string;
    country?: string;
  };
  
  // Timeline
  startDate?: Date | Timestamp;
  endDate?: Date | Timestamp;
  
  // Budget
  budget?: {
    currency: 'UGX' | 'USD';
    totalBudget: number;
    spent: number;
  };
  
  // Progress
  progress?: {
    physicalProgress: number;
    financialProgress: number;
  };
  
  // BOQ Summary
  boqSummary?: {
    totalItems: number;
    totalValue: number;
    parsedItems: number;
    approvedItems: number;
  };
  
  // Cost tracking
  totalPlannedCost?: number;
  totalActualCost?: number;

  // Team
  teamMembers?: ProjectMember[];
  members?: ProjectMember[]; // Alias for teamMembers (used by ProjectContext)

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// PROJECT MEMBER & ROLES
// ─────────────────────────────────────────────────────────────────

export type MatFlowRole = 
  | 'project_manager'
  | 'quantity_surveyor'
  | 'site_engineer'
  | 'procurement_officer'
  | 'viewer';

export type MatFlowCapability =
  // Coarse-grained capabilities (original)
  | 'view_project'
  | 'edit_project'
  | 'manage_boq'
  | 'approve_boq'
  | 'manage_procurement'
  | 'approve_procurement'
  | 'manage_team'
  | 'export_data'
  // Fine-grained BOQ capabilities
  | 'boq:view'
  | 'boq:create'
  | 'boq:edit'
  | 'boq:delete'
  | 'boq:approve'
  | 'boq:import'
  // Fine-grained formula capabilities
  | 'formula:view'
  | 'formula:manage'
  // Fine-grained procurement capabilities
  | 'procurement:view'
  | 'procurement:create'
  | 'procurement:edit'
  | 'procurement:delete'
  // Fine-grained project capabilities
  | 'project:view'
  | 'project:create'
  | 'project:edit'
  | 'project:delete'
  // Fine-grained reports capabilities
  | 'reports:view'
  | 'reports:export';

export interface ProjectMember {
  userId: string;
  email: string;
  displayName: string;
  role: MatFlowRole;
  capabilities: MatFlowCapability[];
  addedAt: Timestamp;
  addedBy: string;
}

export const MATFLOW_ROLE_TEMPLATES: Record<MatFlowRole, MatFlowCapability[]> = {
  project_manager: [
    'view_project', 'edit_project', 'manage_boq', 'approve_boq',
    'manage_procurement', 'approve_procurement', 'manage_team', 'export_data'
  ],
  quantity_surveyor: [
    'view_project', 'edit_project', 'manage_boq', 'approve_boq', 'export_data'
  ],
  site_engineer: [
    'view_project', 'edit_project', 'manage_procurement', 'export_data'
  ],
  procurement_officer: [
    'view_project', 'manage_procurement', 'export_data'
  ],
  viewer: ['view_project'],
};

// ─────────────────────────────────────────────────────────────────
// BOQ ITEM
// ─────────────────────────────────────────────────────────────────

export interface BOQItem {
  id: string;
  projectId: string;

  // Classification
  itemCode?: string; // Short code for display (e.g., "B1.1.1")
  stage?: string; // Construction stage (ConstructionStage enum value)

  // Hierarchy (4-level structure)
  billNumber?: string;
  billName?: string;
  elementCode?: string;
  elementName?: string;
  sectionCode?: string;
  sectionName?: string;
  itemNumber: string;
  itemName?: string;
  hierarchyPath?: string;  // e.g., "1.1.1.1"
  hierarchyLevel?: number; // 1=Bill, 2=Element, 3=Section, 4=Work Item
  isSummaryRow?: boolean;  // True for Level 1/2 header rows

  // Description
  description: string;
  specification?: string;
  specifications?: string; // Alternative field name from parsing
  governingSpecs?: {
    materialGrade?: string;
    brand?: string;
    standard?: string;
    finish?: string;
    color?: string;
  };

  // Quantities
  quantity: number; // For backward compatibility with parsed items
  quantityContract?: number; // Contract quantity (what's saved to Firestore)
  quantityExecuted?: number; // Actual quantity executed
  quantityRemaining?: number; // Remaining quantity
  quantityRequisitioned?: number; // Quantity already requisitioned
  quantityCertified?: number; // Quantity certified by engineer
  unit: string;

  // Rates
  laborRate?: number;
  materialRate?: number;
  equipmentRate?: number;
  rate?: number; // Unit rate (what's saved to Firestore)
  unitRate: number; // For backward compatibility
  amount: number;

  // Status
  status: 'draft' | 'reviewed' | 'approved' | 'rejected';

  // Tracking
  procuredQuantity?: number;
  deliveredQuantity?: number;
  installedQuantity?: number;

  // Formula & Materials
  formulaId?: string;
  formulaName?: string;
  formulaCode?: string;
  suggestedFormula?: {
    formulaCode?: string;
    confidence?: number;
    materialRequirements?: any[];
  };
  materialRequirements?: any[];
  isBulkItem?: boolean; // True if item description IS the material itself, purchased as-is
  isCustomFormula?: boolean; // True if using one-time formula variant (not saved to library)
  noFormulaRequired?: boolean; // True for headers, provisional sums, labour-only items that don't need material breakdown

  // AI Parsing
  confidence?: number;
  aiConfidence?: number;
  aiSuggestions?: string[];
  isVerified?: boolean;
  needsEnhancement?: boolean;
  enhancementReasons?: string[];
  cleanupNotes?: string[];

  // Source tracking
  source?: {
    type: 'manual' | 'ai_import' | 'template';
    parsingJobId?: string;
  };
  version?: number;
  lastModifiedAt?: Timestamp;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// MATERIAL CATEGORY ENUM (for formulas)
// ─────────────────────────────────────────────────────────────────

export enum MaterialCategory {
  CONCRETE = 'concrete',
  STEEL = 'steel',
  MASONRY = 'masonry',
  TIMBER = 'timber',
  ROOFING = 'roofing',
  PLUMBING = 'plumbing',
  ELECTRICAL = 'electrical',
  FINISHES = 'finishes',
  DOORS_WINDOWS = 'doors_windows',
  HARDWARE = 'hardware',
  AGGREGATES = 'aggregates',
  EARTHWORKS = 'earthworks',
  OTHER = 'other',
}

// ─────────────────────────────────────────────────────────────────
// MEASUREMENT UNIT ENUM
// ─────────────────────────────────────────────────────────────────

export enum MeasurementUnit {
  // Volume
  CUBIC_METERS = 'm³',
  LITERS = 'L',

  // Area
  SQUARE_METERS = 'm²',

  // Length
  METERS = 'm',
  LINEAR_METERS = 'lm',
  MILLIMETERS = 'mm',

  // Weight
  KILOGRAMS = 'kg',
  TONNES = 't',

  // Quantity
  PIECES = 'pcs',
  BAGS = 'bags',
  SHEETS = 'sheets',
  ROLLS = 'rolls',
  BUNDLES = 'bundles',
  SETS = 'sets',

  // Other
  EACH = 'ea',
  LOT = 'lot',
  TRIPS = 'trips',
}

// ─────────────────────────────────────────────────────────────────
// STANDARD FORMULA
// ─────────────────────────────────────────────────────────────────

export interface FormulaComponent {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  moq?: number;       // Minimum purchasable quantity (e.g. 50 for a 50 kg bag)
  packUnit?: string;  // Human label for the pack (e.g. "bag", "roll", "sheet")
}

export interface StandardFormula {
  id: string;
  code: string; // e.g., "C25", "BRICK_230"
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  outputUnit: string; // e.g., "m³", "m²"

  // Material components (NEW - what makes up this formula)
  components: FormulaComponent[];

  // Formula components (OLD - for calculations)
  laborFormula?: string;
  materialFormula?: string;
  equipmentFormula?: string;

  // Default rates
  defaultLaborRate?: number;
  defaultMaterialRate?: number;
  defaultEquipmentRate?: number;

  // Search keywords for easier discovery
  keywords?: string[];

  // Usage
  usageCount: number;
  isActive: boolean;

  // Versioning
  version?: number;

  // Audit
  createdAt: Timestamp;
  createdBy?: string;
  updatedAt: Timestamp;
  updatedBy?: string;
}

// ─────────────────────────────────────────────────────────────────
// PROCUREMENT ENTRY
// ─────────────────────────────────────────────────────────────────

export interface ProcurementEntry {
  id: string;
  projectId: string;
  boqItemId?: string;
  
  // Item details
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  
  // Supplier
  supplierId?: string;
  supplierName?: string;
  
  // Status
  status: 'pending' | 'ordered' | 'delivered' | 'verified';
  
  // Dates
  orderDate?: Timestamp;
  expectedDelivery?: Timestamp;
  actualDelivery?: Timestamp;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ─────────────────────────────────────────────────────────────────
// MATERIAL REQUIREMENT & VARIANCE
// ─────────────────────────────────────────────────────────────────

export interface MaterialRequirement {
  id: string;
  projectId: string;
  materialId: string;
  materialName: string;
  itemCode?: string; // BOQ item code reference

  // Calculated quantities
  quantity?: number; // Total quantity needed (with wastage)
  requiredQuantity: number;
  orderedQuantity: number;
  deliveredQuantity: number;
  usedQuantity: number;

  unit: string;
  unitPrice: number;
  totalCost?: number; // Total cost (quantity * unitPrice)
  purchaseQuantity?: number; // Rounded up to MOQ
  moq?: number;
  packUnit?: string;

  status: 'pending' | 'partial' | 'complete';
}

export interface MaterialVariance {
  id: string;
  projectId: string;
  materialId: string;
  
  plannedQuantity: number;
  actualQuantity: number;
  varianceQuantity: number;
  variancePercent: number;
  
  reason?: string;
  notes?: string;
  
  recordedAt: Timestamp;
  recordedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// BOQ PARSING JOB
// ─────────────────────────────────────────────────────────────────

export interface BOQParsingJob {
  id: string;
  projectId: string;
  
  // Source
  fileName: string;
  fileUrl: string;
  fileType: 'excel' | 'pdf' | 'csv';
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  
  // Results
  totalItems?: number;
  parsedItems?: number;
  errorItems?: number;
  
  // Timing
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
}
