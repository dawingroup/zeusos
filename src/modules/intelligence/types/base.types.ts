/**
 * Base Types - DawinOS v2.0
 * Foundational types used across all modules
 */

import { Timestamp } from 'firebase/firestore';
import { 
  SubsidiaryId, 
  DepartmentId, 
  JobLevel,
  NotificationChannel,
} from '../config/constants';

// ============================================
// Common Identifiers
// ============================================

export interface EntityId {
  id: string;
}

export interface TimestampFields {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuditFields extends TimestampFields {
  createdBy: string;
  updatedBy: string;
}

export interface SoftDeleteFields {
  deletedAt?: Timestamp;
  deletedBy?: string;
  isDeleted: boolean;
}

// ============================================
// User & Employee References
// ============================================

export interface UserRef {
  userId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

export interface EmployeeRef {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  departmentId: DepartmentId;
  subsidiaryId: SubsidiaryId;
}

export interface ManagerRef extends EmployeeRef {
  level: JobLevel;
}

// ============================================
// Organization References
// ============================================

export interface SubsidiaryRef {
  subsidiaryId: SubsidiaryId;
  name: string;
}

export interface DepartmentRef {
  departmentId: DepartmentId;
  name: string;
  subsidiaryId: SubsidiaryId;
}

export interface TeamRef {
  teamId: string;
  name: string;
  departmentId: DepartmentId;
  leadId: string;
}

// ============================================
// Document & File References
// ============================================

export interface FileRef {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

export interface DocumentRef {
  documentId: string;
  title: string;
  version: string;
  fileUrl: string;
  type: DocumentType;
  uploadedAt: Timestamp;
}

export type DocumentType = 
  | 'contract'
  | 'policy'
  | 'sop'
  | 'report'
  | 'presentation'
  | 'spreadsheet'
  | 'image'
  | 'pdf'
  | 'other';

// ============================================
// Money & Currency
// ============================================

export interface Money {
  amount: number;
  currency: string;
}

export interface MoneyRange {
  min: Money;
  max: Money;
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: Timestamp;
  source: string;
}

// ============================================
// Date & Time Ranges
// ============================================

export interface DateRange {
  start: Timestamp;
  end: Timestamp;
}

export interface DateRangeOptional {
  start?: Timestamp;
  end?: Timestamp;
}

export interface Period {
  year: number;
  month: number;
  quarter?: number;
}

// ============================================
// Address & Location
// ============================================

export interface Address {
  street: string;
  city: string;
  district?: string;
  region?: string;
  country: string;
  postalCode?: string;
}

export interface Location {
  name: string;
  address?: Address;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// ============================================
// Contact Information
// ============================================

export interface ContactInfo {
  email: string;
  phone: string;
  alternatePhone?: string;
  website?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

// ============================================
// Status & Workflow
// ============================================

export interface StatusChange<T extends string = string> {
  from: T;
  to: T;
  changedBy: string;
  changedAt: Timestamp;
  reason?: string;
}

export interface WorkflowStep {
  stepId: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  assignedTo?: string;
  completedBy?: string;
  completedAt?: Timestamp;
  notes?: string;
}

// ============================================
// Approval
// ============================================

export interface ApprovalRequest {
  requestId: string;
  type: string;
  requestedBy: string;
  requestedAt: Timestamp;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  approvers: ApprovalStep[];
  currentLevel: number;
  dueDate?: Timestamp;
}

export interface ApprovalStep {
  level: number;
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  decidedAt?: Timestamp;
  comments?: string;
  delegatedTo?: string;
}

// ============================================
// Comments & Activity
// ============================================

export interface Comment {
  commentId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  isEdited: boolean;
  mentions?: string[];
  attachments?: FileRef[];
}

export interface ActivityLogEntry {
  activityId: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  performedBy: string;
  performedAt: Timestamp;
  metadata?: Record<string, any>;
  previousValue?: any;
  newValue?: any;
}

// ============================================
// Tags & Categories
// ============================================

export interface Tag {
  tagId: string;
  name: string;
  color?: string;
  category?: string;
}

export interface Category {
  categoryId: string;
  name: string;
  parentId?: string;
  order: number;
  icon?: string;
  color?: string;
}

// ============================================
// Search & Filter
// ============================================

export interface SearchQuery {
  query: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

// ============================================
// Notification
// ============================================

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
  action?: {
    type: string;
    url?: string;
    entityId?: string;
  };
}

export interface NotificationPreferences {
  channels: {
    [K in NotificationChannel]?: boolean;
  };
  categories: {
    [category: string]: {
      enabled: boolean;
      channels: NotificationChannel[];
    };
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    requestId: string;
    timestamp: Timestamp;
    duration: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ============================================
// Form & Validation
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface FormState<T> {
  values: T;
  errors: Record<keyof T, string | undefined>;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// ============================================
// UI State Types
// ============================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface ModalState {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view' | 'delete';
  data?: any;
}

export interface TableState {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, any>;
  selectedIds: string[];
}
