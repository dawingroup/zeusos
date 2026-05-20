/**
 * PROJECT PROGRESS TYPES
 * 
 * Types for tracking project progress records and status calculations.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// PROGRESS RECORD
// ─────────────────────────────────────────────────────────────────

export interface ProgressRecord {
  id: string;
  physicalProgress: number;
  financialProgress?: number;
  notes?: string;
  photos?: string[];
  recordedBy: string;
  recordedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// PROGRESS STATUS
// ─────────────────────────────────────────────────────────────────

export type ProgressStatusType = 'ahead' | 'on_track' | 'behind' | 'critical';

/**
 * Calculate progress status based on actual vs planned progress
 */
export function calculateProgressStatus(
  actualProgress: number,
  plannedProgress: number
): ProgressStatusType {
  const variance = actualProgress - plannedProgress;
  
  if (variance > 5) return 'ahead';
  if (variance >= -5) return 'on_track';
  if (variance >= -15) return 'behind';
  return 'critical';
}

/**
 * Get progress status color class
 */
export function getProgressStatusColor(status: ProgressStatusType): string {
  const colorMap: Record<ProgressStatusType, string> = {
    ahead: 'text-blue-600 bg-blue-100',
    on_track: 'text-green-600 bg-green-100',
    behind: 'text-yellow-600 bg-yellow-100',
    critical: 'text-red-600 bg-red-100',
  };
  return colorMap[status];
}

/**
 * Get progress status label
 */
export function getProgressStatusLabel(status: ProgressStatusType): string {
  const labels: Record<ProgressStatusType, string> = {
    ahead: 'Ahead of Schedule',
    on_track: 'On Track',
    behind: 'Behind Schedule',
    critical: 'Critical Delay',
  };
  return labels[status];
}
