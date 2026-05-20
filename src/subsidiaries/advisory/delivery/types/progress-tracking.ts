/**
 * PROGRESS TRACKING TYPES
 * 
 * Comprehensive progress management with S-curve and variance analysis.
 */

import { Timestamp } from 'firebase/firestore';
import { WorkCategory } from './project-scope';

// ─────────────────────────────────────────────────────────────────
// S-CURVE TYPES
// ─────────────────────────────────────────────────────────────────

export type SCurveType = 'linear' | 'front_loaded' | 'back_loaded' | 'custom';

export interface MilestoneProgress {
  milestoneId: string;
  milestoneName: string;
  plannedDate: Date;
  plannedProgress: number;
  weightPercentage: number;
}

export interface WeeklyProgress {
  weekNumber: number;
  weekStartDate: Date;
  plannedCumulative: number;
  plannedIncremental: number;
  actualCumulative?: number;
  actualIncremental?: number;
  variance?: number;
}

export interface PlannedProgress {
  projectId: string;
  baselineDate: Date;
  milestoneProgress: MilestoneProgress[];
  weeklyProgress: WeeklyProgress[];
  scurveType: SCurveType;
}

// ─────────────────────────────────────────────────────────────────
// WORK PACKAGE TRACKER
// ─────────────────────────────────────────────────────────────────

export type WorkPackageTrackerStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'completed' 
  | 'delayed' 
  | 'blocked';

export interface ResourceAllocation {
  resourceType: 'labor' | 'equipment' | 'material';
  description: string;
  quantity: number;
  unit: string;
  startDate: Date;
  endDate: Date;
}

export interface ProgressHistoryEntry {
  date: Date;
  percent: number;
  notes?: string;
  recordedBy: string;
}

export interface WorkPackageTracker {
  id: string;
  projectId: string;
  workPackageId: string;
  name: string;
  category: WorkCategory;
  
  // Schedule
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  
  // Progress
  percentComplete: number;
  status: WorkPackageTrackerStatus;
  
  // Dependencies
  predecessors: string[];
  successors: string[];
  
  // Resources
  assignedResources: ResourceAllocation[];
  
  // Issues
  blockers: string[];
  
  // History
  progressHistory: ProgressHistoryEntry[];
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// VARIANCE ANALYSIS
// ─────────────────────────────────────────────────────────────────

export type VarianceStatusType = 'ahead' | 'on_track' | 'behind' | 'critical';

export interface ScheduleVariance {
  plannedProgress: number;
  actualProgress: number;
  variancePercent: number;
  varianceDays: number;
  status: VarianceStatusType;
}

export interface CostVariance {
  plannedCost: number;
  earnedValue: number;
  actualCost: number;
  costVariance: number;
  scheduleVariance: number;
  cpi: number;
  spi: number;
}

export interface ProgressForecast {
  estimateAtCompletion: number;
  estimateToComplete: number;
  forecastEndDate: Date;
  daysSlippage: number;
}

export interface ProgressVariance {
  projectId: string;
  analysisDate: Date;
  scheduleVariance: ScheduleVariance;
  costVariance: CostVariance;
  forecast: ProgressForecast;
}

// ─────────────────────────────────────────────────────────────────
// PROGRESS PHOTOS
// ─────────────────────────────────────────────────────────────────

export interface PhotoLocation {
  latitude: number;
  longitude: number;
}

export interface AIPhotoAnalysis {
  detectedProgress?: number;
  identifiedElements: string[];
  qualityIssues?: string[];
  confidence: number;
}

export interface ProgressPhoto {
  id: string;
  projectId: string;
  workPackageId?: string;
  siteVisitId?: string;
  
  // File info
  url: string;
  thumbnailUrl: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  
  // Metadata
  captureDate: Date;
  caption?: string;
  location?: PhotoLocation;
  
  // AI analysis
  aiAnalysis?: AIPhotoAnalysis;
  
  // Audit
  uploadedBy: string;
  uploadedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate weeks between two dates
 */
export function calculateWeeksBetween(start: Date, end: Date): number {
  const diffTime = new Date(end).getTime() - new Date(start).getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
}

/**
 * Add weeks to a date
 */
export function addWeeksToDate(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

/**
 * Get variance status from percent difference
 */
export function getVarianceStatus(variancePercent: number): VarianceStatusType {
  if (variancePercent > 5) return 'ahead';
  if (variancePercent >= -5) return 'on_track';
  if (variancePercent >= -15) return 'behind';
  return 'critical';
}

/**
 * Get variance status color class
 */
export function getVarianceStatusColor(status: VarianceStatusType): string {
  const colorMap: Record<VarianceStatusType, string> = {
    ahead: 'text-blue-600 bg-blue-100',
    on_track: 'text-green-600 bg-green-100',
    behind: 'text-yellow-600 bg-yellow-100',
    critical: 'text-red-600 bg-red-100',
  };
  return colorMap[status];
}

/**
 * Get variance status label
 */
export function getVarianceStatusLabel(status: VarianceStatusType): string {
  const labels: Record<VarianceStatusType, string> = {
    ahead: 'Ahead of Schedule',
    on_track: 'On Track',
    behind: 'Behind Schedule',
    critical: 'Critical Delay',
  };
  return labels[status];
}

/**
 * Calculate CPI status
 */
export function getCPIStatus(cpi: number): 'under_budget' | 'on_budget' | 'over_budget' {
  if (cpi > 1.05) return 'under_budget';
  if (cpi >= 0.95) return 'on_budget';
  return 'over_budget';
}

/**
 * Calculate SPI status
 */
export function getSPIStatus(spi: number): VarianceStatusType {
  if (spi > 1.05) return 'ahead';
  if (spi >= 0.95) return 'on_track';
  if (spi >= 0.85) return 'behind';
  return 'critical';
}

/**
 * Format CPI/SPI for display
 */
export function formatPerformanceIndex(value: number): string {
  return value.toFixed(2);
}

/**
 * Get work package status color
 */
export function getWorkPackageStatusColor(status: WorkPackageTrackerStatus): string {
  const colorMap: Record<WorkPackageTrackerStatus, string> = {
    not_started: 'text-gray-600 bg-gray-100',
    in_progress: 'text-blue-600 bg-blue-100',
    completed: 'text-green-600 bg-green-100',
    delayed: 'text-yellow-600 bg-yellow-100',
    blocked: 'text-red-600 bg-red-100',
  };
  return colorMap[status];
}

/**
 * Initialize empty work package tracker
 */
export function initializeWorkPackageTracker(
  projectId: string,
  workPackageId: string,
  name: string,
  category: WorkCategory,
  plannedStart: Date,
  plannedEnd: Date
): Omit<WorkPackageTracker, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'> {
  return {
    projectId,
    workPackageId,
    name,
    category,
    plannedStart,
    plannedEnd,
    percentComplete: 0,
    status: 'not_started',
    predecessors: [],
    successors: [],
    assignedResources: [],
    blockers: [],
    progressHistory: [],
  };
}
