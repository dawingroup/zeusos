/**
 * API Compatibility Types
 * Type definitions for backward-compatible API layer
 */

export type APIVersion = 'v5' | 'v6';

export interface APIRequest {
  version: APIVersion;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: any;
}

export interface APIResponse<T = any> {
  version: APIVersion;
  status: number;
  data: T;
  meta?: {
    deprecation?: DeprecationWarning;
    pagination?: PaginationMeta;
    links?: HATEOASLinks;
    warnings?: string[];
  };
}

export interface DeprecationWarning {
  message: string;
  deprecatedAt: string;
  sunsetDate: string;
  migrationGuide: string;
  replacementEndpoint?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface HATEOASLinks {
  self: string;
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
  related?: Record<string, string>;
}

// Field mapping configuration
export interface FieldMapping {
  v5Field: string;
  v6Field: string;
  transform?: (value: any, direction: 'v5_to_v6' | 'v6_to_v5') => any;
  deprecated?: boolean;
  required?: boolean;
}

export interface EntityMapping {
  v5Entity: string;
  v6Entity: string;
  fields: FieldMapping[];
  nestedMappings?: Record<string, EntityMapping>;
}

// ============================================================================
// V5 API Response formats (Legacy)
// ============================================================================

export interface V5ProgramResponse {
  id: string;
  name: string;
  code: string;
  fundingSource: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: string;
  projects: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface V5ProjectResponse {
  id: string;
  programId: string;
  programName: string;
  name: string;
  code: string;
  location: string;
  contractor: string;
  budget: number;
  spent: number;
  progress: number;
  status: string;
  implementationType: 'contractor' | 'direct';
  createdAt: string;
  updatedAt: string;
}

export interface V5IPCResponse {
  id: string;
  projectId: string;
  projectName: string;
  certificateNumber: string;
  periodFrom: string;
  periodTo: string;
  workDone: number;
  previousCertificates: number;
  currentCertificate: number;
  retention: number;
  netPayable: number;
  status: string;
  createdAt: string;
}

export interface V5DealResponse {
  id: string;
  name: string;
  stage: string;
  value: number;
  sector: string;
  subsector?: string;
  projectId?: string;
  description?: string;
  clientName?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface V5RequisitionResponse {
  id: string;
  projectId: string;
  projectName: string;
  requisitionNumber: string;
  amount: number;
  type: string;
  status: string;
  description?: string;
  items?: V5RequisitionItem[];
  createdAt: string;
}

export interface V5RequisitionItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

// ============================================================================
// V6 API Response formats (New)
// ============================================================================

export interface V6EngagementResponse {
  id: string;
  type: 'program' | 'deal' | 'advisory_mandate';
  name: string;
  code: string;
  client?: {
    id: string;
    name: string;
  };
  funding?: {
    type: string;
    sources: Array<{
      name: string;
      amount: number;
      percentage: number;
    }>;
    totalBudget: number;
    currency: string;
  };
  timeline?: {
    startDate: string | null;
    endDate: string | null;
    milestones: Array<{
      id: string;
      name: string;
      dueDate: string;
      status: string;
    }>;
  };
  status: string;
  description?: string;
  metadata?: {
    sector?: string;
    subsector?: string;
    linkedProjectId?: string;
    [key: string]: any;
  };
  metrics?: {
    projectCount: number;
    totalBudget: number;
    totalSpent: number;
    overallProgress: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface V6ProjectResponse {
  id: string;
  engagementId: string;
  engagement: {
    id: string;
    name: string;
    code: string;
  };
  name: string;
  code: string;
  location: {
    name: string;
    region?: string;
    district?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  implementationType: 'contractor' | 'direct';
  contractor?: {
    id?: string;
    name: string;
    contact?: string;
  };
  budget: {
    allocated: number;
    committed: number;
    spent: number;
    remaining: number;
    currency: string;
  };
  timeline: {
    plannedStart?: string;
    plannedEnd?: string;
    actualStart?: string;
    actualEnd?: string;
    percentComplete: number;
  };
  status: string;
  milestones?: Array<{
    id: string;
    name: string;
    dueDate: string;
    completedDate?: string;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface V6PaymentResponse {
  id: string;
  projectId: string;
  engagementId: string;
  project: {
    id: string;
    name: string;
    code: string;
  };
  type: 'ipc' | 'requisition' | 'advance' | 'retention';
  reference: string;
  period?: {
    from: string;
    to: string;
  };
  amounts: {
    cumulative: number;
    previous: number;
    current: number;
    retention: number;
    net: number;
  };
  lineItems?: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }>;
  status: string;
  approvals?: Array<{
    role: string;
    userId?: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface V5CreateProgramRequest {
  name: string;
  code?: string;
  fundingSource: string;
  budget: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  description?: string;
}

export interface V5UpdateProgramRequest {
  name?: string;
  code?: string;
  fundingSource?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  description?: string;
}

export interface V5CreateProjectRequest {
  programId: string;
  name: string;
  code?: string;
  location: string;
  contractor?: string;
  budget: number;
  implementationType: 'contractor' | 'direct';
  status?: string;
}

export interface V5CreateIPCRequest {
  projectId: string;
  certificateNumber: string;
  periodFrom: string;
  periodTo: string;
  workDone: number;
  previousCertificates?: number;
  currentCertificate: number;
  retention?: number;
  status?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface TransformResult {
  transformed: any;
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface APIError {
  status: number;
  code: string;
  message: string;
  details?: ValidationError[];
}
