/**
 * Shared Constants - Intelligence Layer
 * Single source of truth for values used across multiple intelligence components.
 */

// ============================================
// Subsidiaries
// ============================================

export const SUBSIDIARIES = [
  { id: 'finishes', label: 'Dawin Finishes' },
  { id: 'advisory', label: 'Dawin Advisory' },
  { id: 'capital', label: 'Dawin Capital' },
] as const;

export type SubsidiaryId = (typeof SUBSIDIARIES)[number]['id'];

// ============================================
// Departments
// ============================================

export const DEPARTMENTS = [
  { value: 'design', label: 'Design' },
  { value: 'production', label: 'Production' },
  { value: 'operations', label: 'Operations' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'sales', label: 'Sales' },
  { value: 'finance', label: 'Finance' },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]['value'];

// ============================================
// Source Modules
// Unified list from TaskManagementPanel + EventMonitoringPanel
// ============================================

export const INTELLIGENCE_SOURCE_MODULES = [
  { value: 'design_manager', label: 'Design Manager' },
  { value: 'launch_pipeline', label: 'Launch Pipeline' },
  { value: 'customer_hub', label: 'Customer Hub' },
  { value: 'cutlist', label: 'Cutlist' },
  { value: 'assets', label: 'Assets' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'hr_central', label: 'HR Central' },
  { value: 'matflow', label: 'MatFlow' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'procurement', label: 'Procurement' },
] as const;

// ============================================
// Workload Defaults
// ============================================

export const WORKLOAD_DEFAULTS = {
  /** Default max concurrent tasks per employee when not configured */
  DEFAULT_MAX_CAPACITY: 40,
} as const;
