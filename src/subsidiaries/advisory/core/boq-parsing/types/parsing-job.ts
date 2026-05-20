/**
 * Parsing Job Types
 * Types for BOQ parsing jobs and their progress
 */

import type { ParsedBOQItem, ProjectInfo, ParsingMetadata } from './parsed-boq';
import type { CleanedBOQItem } from './cleaned-boq';

/**
 * BOQ Parsing Job Status
 */
export type ParsingJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * BOQ Parsing Job
 * Tracks the progress of a BOQ parsing operation
 */
export interface BOQParsingJob {
  id: string;
  projectId: string;

  /** Source file information */
  sourceFile: {
    name: string;
    url: string;
    format: 'excel' | 'pdf' | 'csv';
    size: number;
  };

  /** Status and progress */
  status: ParsingJobStatus;
  progress: number; // 0-100

  /** Processing stages */
  stages: {
    upload?: { completed: boolean; timestamp?: any };
    parse?: { completed: boolean; timestamp?: any };
    cleanup?: { completed: boolean; timestamp?: any };
    review?: { completed: boolean; timestamp?: any };
  };

  /** Results */
  projectInfo?: ProjectInfo;
  parsedItems?: ParsedBOQItem[];
  cleanedItems?: CleanedBOQItem[];
  metadata?: ParsingMetadata;

  /** Error information */
  error?: {
    message: string;
    code?: string;
    details?: any;
  };

  /** Timestamps */
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
  completedAt?: any;

  /** User */
  createdBy: string;
}

/**
 * Parsing job progress update
 */
export interface ParsingProgressUpdate {
  jobId: string;
  status: ParsingJobStatus;
  progress: number;
  currentStage?: string;
  message?: string;
}
