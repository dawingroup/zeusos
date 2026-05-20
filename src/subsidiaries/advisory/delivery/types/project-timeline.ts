/**
 * PROJECT TIMELINE TYPES
 * 
 * Types for timeline extensions and date calculations.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// EXTENSION TYPES
// ─────────────────────────────────────────────────────────────────

export type ExtensionReason = 
  | 'weather'
  | 'design_changes'
  | 'material_delays'
  | 'client_request'
  | 'unforeseen_conditions'
  | 'permit_delays'
  | 'labor_shortage'
  | 'other';

export type ExtensionStatus = 'pending' | 'approved' | 'rejected';

export interface TimelineExtension {
  id: string;
  projectId: string;
  requestedDays: number;
  reason: ExtensionReason;
  justification: string;
  supportingDocuments?: string[];
  status: ExtensionStatus;
  requestedBy: string;
  requestedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate days between two dates
 */
export function calculateDaysBetween(start: Date, end: Date): number {
  const diffTime = new Date(end).getTime() - new Date(start).getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date
 */
export function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get extension reason label
 */
export function getExtensionReasonLabel(reason: ExtensionReason): string {
  const labels: Record<ExtensionReason, string> = {
    weather: 'Weather Conditions',
    design_changes: 'Design Changes',
    material_delays: 'Material Delays',
    client_request: 'Client Request',
    unforeseen_conditions: 'Unforeseen Site Conditions',
    permit_delays: 'Permit Delays',
    labor_shortage: 'Labor Shortage',
    other: 'Other',
  };
  return labels[reason];
}

/**
 * Get extension status color
 */
export function getExtensionStatusColor(status: ExtensionStatus): string {
  const colorMap: Record<ExtensionStatus, string> = {
    pending: 'text-yellow-600 bg-yellow-100',
    approved: 'text-green-600 bg-green-100',
    rejected: 'text-red-600 bg-red-100',
  };
  return colorMap[status];
}
