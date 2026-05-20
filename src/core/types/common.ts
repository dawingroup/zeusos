/**
 * Common Types
 * Shared TypeScript type definitions used across all modules
 */

/**
 * User roles in the system
 */
export type UserRole = 'admin' | 'designer' | 'engineer' | 'viewer';

/**
 * Application user
 */
export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Firestore Timestamp type
 */
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
}

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Status types used across modules
 */
export type StatusType = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';

/**
 * Traffic light status (used in Design Manager)
 */
export type TrafficLightStatus = 'red' | 'amber' | 'green' | 'grey';

/**
 * Project reference (shared across modules)
 */
export interface ProjectReference {
  id: string;
  code: string;
  name: string;
  customerId?: string;
  customerName?: string;
}

/**
 * Material reference (shared across modules)
 */
export interface MaterialReference {
  id: string;
  name: string;
  code?: string;
  thickness?: number;
  unit?: 'mm' | 'in';
}

/**
 * Dimension type
 */
export interface Dimensions {
  length: number;
  width: number;
  thickness?: number;
  unit: 'mm' | 'in';
}

/**
 * File attachment
 */
export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
}
