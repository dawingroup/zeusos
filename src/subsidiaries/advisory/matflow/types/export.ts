/**
 * Export and Reporting Types
 */

// Export Format Options
export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';

// Report Type
export type ReportType =
  | 'boq_summary'
  | 'material_requirements'
  | 'procurement_log'
  | 'variance_analysis'
  | 'stage_progress'
  | 'tax_compliance'
  | 'project_overview'
  | 'delivery_summary'
  | 'cost_breakdown'
  | 'custom';

// Report Status
export type ReportStatus = 
  | 'pending' 
  | 'generating' 
  | 'ready' 
  | 'failed' 
  | 'expired';

// Report Configuration
export interface ReportConfig {
  type: ReportType;
  title: string;
  description?: string;
  
  // Data Selection
  projectId: string;
  stageIds?: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  
  // Content Options
  includeSummary: boolean;
  includeDetails: boolean;
  includeCharts: boolean;
  includeAppendix: boolean;
  
  // Grouping
  groupBy?: 'stage' | 'material' | 'supplier' | 'category' | 'date';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  
  // Filters
  filters?: ReportFilter[];
  
  // Formatting
  format: ExportFormat;
  paperSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  
  // Branding
  includeLogo?: boolean;
  companyName?: string;
  headerText?: string;
  footerText?: string;
}

// Report Filter
export interface ReportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

// Generated Report Record
export interface ReportRecord {
  id: string;
  projectId: string;
  
  // Configuration
  config: ReportConfig;
  
  // Status
  status: ReportStatus;
  progress?: number;
  error?: string;
  
  // Output
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  expiresAt?: string;
  
  // Metadata
  generatedAt?: string;
  createdAt: string;
  createdBy: string;
  downloadCount: number;
}

// Report Template
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  config: Partial<ReportConfig>;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
}

// BOQ Summary Report Data
export interface BOQSummaryReportData {
  project: {
    id: string;
    name: string;
    client: string;
    location: string;
    startDate?: string;
    endDate?: string;
  };
  summary: {
    totalStages: number;
    totalItems: number;
    totalQuantity: number;
    estimatedCost: number;
    currency: string;
  };
  stages: BOQStageSection[];
  generatedAt: string;
}

// BOQ Stage Section
export interface BOQStageSection {
  stageId: string;
  stageName: string;
  stageNumber: number;
  items: BOQItemRow[];
  subtotal: number;
}

// BOQ Item Row
export interface BOQItemRow {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  remarks?: string;
}

// Material Requirements Report Data
export interface MaterialRequirementsReportData {
  project: {
    id: string;
    name: string;
  };
  summary: {
    totalMaterials: number;
    totalEstimatedCost: number;
    currency: string;
  };
  materials: MaterialRequirementRow[];
  byCategory: CategorySummary[];
  generatedAt: string;
}

// Material Requirement Row
export interface MaterialRequirementRow {
  materialId: string;
  materialName: string;
  category: string;
  unit: string;
  totalRequired: number;
  delivered: number;
  remaining: number;
  unitCost: number;
  totalCost: number;
  status: 'pending' | 'partial' | 'complete' | 'over';
}

// Category Summary
export interface CategorySummary {
  category: string;
  materialCount: number;
  totalCost: number;
  percentOfTotal: number;
}

// Variance Analysis Report Data
export interface VarianceAnalysisReportData {
  project: {
    id: string;
    name: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalPlanned: number;
    totalActual: number;
    totalVariance: number;
    variancePercent: number;
    itemsOverBudget: number;
    itemsUnderBudget: number;
    currency: string;
  };
  byStage: StageVarianceSection[];
  topVariances: VarianceItem[];
  trends: VarianceTrend[];
  generatedAt: string;
}

// Stage Variance Section
export interface StageVarianceSection {
  stageId: string;
  stageName: string;
  planned: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'on_budget' | 'over_budget' | 'under_budget';
  items: VarianceItem[];
}

// Variance Item
export interface VarianceItem {
  itemId: string;
  itemName: string;
  unit: string;
  plannedQty: number;
  actualQty: number;
  plannedCost: number;
  actualCost: number;
  quantityVariance: number;
  costVariance: number;
  variancePercent: number;
  reason?: string;
}

// Variance Trend
export interface VarianceTrend {
  date: string;
  planned: number;
  actual: number;
  cumulative: number;
}

// Procurement Log Report Data
export interface ProcurementLogReportData {
  project: {
    id: string;
    name: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalDeliveries: number;
    totalPurchaseOrders: number;
    totalSpend: number;
    uniqueSuppliers: number;
    currency: string;
  };
  deliveries: DeliveryLogRow[];
  bySupplier: SupplierSummary[];
  generatedAt: string;
}

// Delivery Log Row
export interface DeliveryLogRow {
  deliveryId: string;
  date: string;
  supplier: string;
  poNumber?: string;
  items: string;
  quantity: number;
  amount: number;
  status: string;
  invoiceValidated: boolean;
}

// Supplier Summary
export interface SupplierSummary {
  supplierName: string;
  deliveryCount: number;
  totalAmount: number;
  percentOfSpend: number;
  vatRegistered?: boolean;
}

// Tax Compliance Report Data
export interface TaxComplianceReportData {
  project: {
    id: string;
    name: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalInvoices: number;
    validInvoices: number;
    invalidInvoices: number;
    pendingInvoices: number;
    complianceRate: number;
    totalPurchases: number;
    vatRecoverable: number;
    atRiskAmount: number;
    currency: string;
  };
  invoices: TaxInvoiceRow[];
  bySupplier: SupplierTaxSummary[];
  generatedAt: string;
}

// Tax Invoice Row
export interface TaxInvoiceRow {
  fdn: string;
  invoiceNumber: string;
  date: string;
  supplier: string;
  tin: string;
  amount: number;
  vatAmount: number;
  status: string;
  validatedAt?: string;
}

// Supplier Tax Summary
export interface SupplierTaxSummary {
  supplier: string;
  tin: string;
  vatRegistered: boolean;
  invoiceCount: number;
  totalAmount: number;
  vatAmount: number;
  validInvoices: number;
  invalidInvoices: number;
}

// Project Overview Report Data
export interface ProjectOverviewReportData {
  project: {
    id: string;
    name: string;
    client: string;
    location: string;
    startDate?: string;
    targetEndDate?: string;
    status: string;
  };
  progress: {
    overallPercent: number;
    stagesComplete: number;
    totalStages: number;
    daysElapsed: number;
    daysRemaining?: number;
  };
  budget: {
    estimated: number;
    actual: number;
    variance: number;
    variancePercent: number;
    currency: string;
  };
  stages: StageProgressRow[];
  recentActivity: ActivityItem[];
  issues: ProjectIssue[];
  generatedAt: string;
}

// Stage Progress Row
export interface StageProgressRow {
  stageId: string;
  stageName: string;
  status: string;
  materialProgress: number;
  workProgress: number;
  plannedCost: number;
  actualCost: number;
  milestones: { total: number; complete: number };
  blockers: number;
}

// Activity Item
export interface ActivityItem {
  date: string;
  type: string;
  description: string;
  user: string;
}

// Project Issue
export interface ProjectIssue {
  id: string;
  type: 'blocker' | 'variance' | 'delay' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  stage?: string;
  createdAt: string;
  status: 'open' | 'in_progress' | 'resolved';
}

// Export Job
export interface ExportJob {
  id: string;
  type: 'report' | 'data_export';
  config: ReportConfig | DataExportConfig;
  status: ReportStatus;
  progress: number;
  createdAt: string;
  completedAt?: string;
  result?: {
    url: string;
    fileName: string;
    fileSize: number;
    expiresAt: string;
  };
  error?: string;
}

// Data Export Config
export interface DataExportConfig {
  entities: ('projects' | 'boqItems' | 'deliveries' | 'materials' | 'invoices')[];
  projectId: string;
  format: 'xlsx' | 'csv' | 'json';
  includeRelated: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

// Scheduled Report
export interface ScheduledReport {
  id: string;
  name: string;
  config: ReportConfig;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    timezone: string;
  };
  recipients: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdBy: string;
  createdAt: string;
}

// Report data union type
export type ReportData = 
  | BOQSummaryReportData 
  | MaterialRequirementsReportData 
  | VarianceAnalysisReportData 
  | ProcurementLogReportData 
  | TaxComplianceReportData 
  | ProjectOverviewReportData;
