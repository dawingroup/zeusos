/**
 * Due Diligence - Comprehensive investigation entity
 * 
 * Due diligence covers multiple workstreams to evaluate
 * an investment opportunity systematically.
 */

import { Timestamp } from 'firebase/firestore';

export interface DueDiligence {
  id: string;
  dealId: string;
  engagementId: string;
  
  // Status
  status: DDStatus;
  overallRating?: DDRating;
  
  // Summary metrics
  metrics: DDMetrics;
  
  // Key dates
  startDate: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  
  // Sign-off
  signedOffBy?: string;
  signedOffAt?: Timestamp;
  signOffNotes?: string;
  
  // Configuration
  scope: DDScope;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type DDStatus = 
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'completed'
  | 'on_hold';

export type DDRating = 
  | 'proceed'                   // Green light
  | 'proceed_with_conditions'   // Yellow - proceed with mitigations
  | 'further_review'            // Orange - more work needed
  | 'do_not_proceed';           // Red - significant issues

export interface DDMetrics {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  totalFindings: number;
  redFlagsCount: number;
  yellowFlagsCount: number;
  openIssuesCount: number;
  documentsUploaded: number;
  daysRemaining?: number;
  daysOverdue?: number;
}

export interface DDScope {
  workstreamsIncluded: WorkstreamType[];
  customWorkstreams?: CustomWorkstream[];
  exclusions?: string[];
  limitations?: string[];
  dataRoomAccess: DataRoomAccess;
  managementMeetings: MeetingSchedule[];
  siteVisits: SiteVisitSchedule[];
}

export type WorkstreamType = 
  | 'commercial'
  | 'financial'
  | 'legal'
  | 'technical'
  | 'environmental'
  | 'tax'
  | 'hr'
  | 'it'
  | 'regulatory'
  | 'insurance';

export interface CustomWorkstream {
  id: string;
  name: string;
  description: string;
  lead?: string;
}

export interface DataRoomAccess {
  provider: string;           // e.g., 'Intralinks', 'Datasite', 'Google Drive'
  url?: string;
  accessGrantedDate?: Date;
  credentials?: string;       // Reference to secure storage
  documents: DataRoomDocument[];
}

export interface DataRoomDocument {
  id: string;
  name: string;
  category: string;
  uploaded: boolean;
  uploadedAt?: Date;
  requested: boolean;
  requestedAt?: Date;
  notes?: string;
}

export interface MeetingSchedule {
  id: string;
  topic: string;
  attendees: string[];
  scheduledDate?: Date;
  completed: boolean;
  notes?: string;
}

export interface SiteVisitSchedule {
  id: string;
  location: string;
  purpose: string;
  scheduledDate?: Date;
  completed: boolean;
  findings?: string;
}

// Due diligence summary for deal view
export interface DDSummary {
  id: string;
  status: DDStatus;
  overallRating?: DDRating;
  completionPercentage: number;
  redFlagsCount: number;
  workstreamsSummary: WorkstreamSummary[];
  lastUpdated: Date;
}

export interface WorkstreamSummary {
  type: WorkstreamType;
  status: DDStatus;
  completion: number;
  findingsCount: number;
  redFlagsCount: number;
  lead?: string;
}

// Helper functions
export function getDDStatusDisplayName(status: DDStatus): string {
  const names: Record<DDStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    completed: 'Completed',
    on_hold: 'On Hold',
  };
  return names[status] || status;
}

export function getDDRatingDisplayName(rating: DDRating): string {
  const names: Record<DDRating, string> = {
    proceed: 'Proceed',
    proceed_with_conditions: 'Proceed with Conditions',
    further_review: 'Further Review Required',
    do_not_proceed: 'Do Not Proceed',
  };
  return names[rating] || rating;
}

export function getDDRatingColor(rating: DDRating): string {
  const colors: Record<DDRating, string> = {
    proceed: '#22c55e',
    proceed_with_conditions: '#eab308',
    further_review: '#f97316',
    do_not_proceed: '#dc2626',
  };
  return colors[rating] || '#6b7280';
}

export function getDDStatusColor(status: DDStatus): string {
  const colors: Record<DDStatus, string> = {
    not_started: '#6b7280',
    in_progress: '#3b82f6',
    under_review: '#f59e0b',
    completed: '#22c55e',
    on_hold: '#ef4444',
  };
  return colors[status] || '#6b7280';
}

export function getWorkstreamTypeDisplayName(type: WorkstreamType): string {
  const names: Record<WorkstreamType, string> = {
    commercial: 'Commercial',
    financial: 'Financial',
    legal: 'Legal',
    technical: 'Technical',
    environmental: 'Environmental',
    tax: 'Tax',
    hr: 'HR',
    it: 'IT',
    regulatory: 'Regulatory',
    insurance: 'Insurance',
  };
  return names[type] || type;
}

export function getWorkstreamTypeColor(type: WorkstreamType): string {
  const colors: Record<WorkstreamType, string> = {
    commercial: '#3b82f6',
    financial: '#22c55e',
    legal: '#8b5cf6',
    technical: '#f59e0b',
    environmental: '#10b981',
    tax: '#ef4444',
    hr: '#ec4899',
    it: '#06b6d4',
    regulatory: '#6366f1',
    insurance: '#f97316',
  };
  return colors[type] || '#6b7280';
}

// Default workstreams for standard DD
export const DEFAULT_WORKSTREAMS: WorkstreamType[] = [
  'commercial',
  'financial',
  'legal',
  'technical',
  'environmental',
  'tax',
];

// Create empty DD scope
export function createEmptyDDScope(): DDScope {
  return {
    workstreamsIncluded: [...DEFAULT_WORKSTREAMS],
    customWorkstreams: [],
    exclusions: [],
    limitations: [],
    dataRoomAccess: {
      provider: '',
      documents: [],
    },
    managementMeetings: [],
    siteVisits: [],
  };
}
