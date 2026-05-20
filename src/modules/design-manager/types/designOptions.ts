/**
 * Design Options Types
 * For team-created design options that clients can approve
 */

import type { Timestamp } from 'firebase/firestore';
import type { ClipAIAnalysis } from '@/subsidiaries/finishes/clipper/types';

/**
 * Design option workflow status
 */
export type DesignOptionStatus =
  | 'draft'           // Being prepared by team
  | 'submitted'       // Submitted for client review
  | 'approved'        // Client approved this option
  | 'rejected'        // Client rejected this option
  | 'revision'        // Client requested changes
  | 'superseded';     // Replaced by newer version

/**
 * Design option category
 */
export type DesignOptionCategory =
  | 'material'        // Material selection (wood species, finishes)
  | 'finish'          // Finish options (stain, paint, lacquer)
  | 'style'           // Design style options
  | 'layout'          // Layout/configuration options
  | 'feature'         // Feature additions/modifications
  | 'hardware'        // Hardware selections
  | 'other';          // Other options

/**
 * Inspiration linked to a design option
 */
export interface DesignOptionInspiration {
  id: string;
  /** Link to DesignClip if from clipper */
  clipId?: string;
  /** Image URL */
  imageUrl: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Display title */
  title: string;
  /** Description of the inspiration */
  description?: string;
  /** Source URL if from web */
  sourceUrl?: string;
  /** AI analysis results if available */
  aiAnalysis?: ClipAIAnalysis;
  /** Whether this was uploaded via manual upload */
  isManualUpload?: boolean;
  /** Order index for sorting */
  order?: number;
}

/**
 * Design option document
 */
export interface DesignOption {
  id: string;
  /** Project this option belongs to */
  projectId: string;
  /** Design item this option is for (optional) */
  designItemId?: string;
  /** Design item name for display */
  designItemName?: string;

  // Option details
  /** Option name */
  name: string;
  /** Detailed description */
  description?: string;
  /** Category of the option */
  category: DesignOptionCategory;

  // Inspirations linked to this option
  inspirations: DesignOptionInspiration[];

  // Pricing (optional)
  /** Estimated cost */
  estimatedCost?: number;
  /** Currency code */
  currency?: string;

  // For comparison - marking and notes
  /** Whether this is the recommended option */
  isRecommended?: boolean;
  /** Notes for comparing with alternatives */
  comparisonNotes?: string;

  // Workflow
  /** Current status */
  status: DesignOptionStatus;
  /** Priority level */
  priority: 'low' | 'medium' | 'high';

  // Client response
  clientResponse?: {
    status: DesignOptionStatus;
    notes?: string;
    respondedAt: Timestamp;
    respondedBy?: string;
  };

  // Approval item link (when submitted to client portal)
  approvalItemId?: string;

  // Tags for organization
  tags?: string[];

  // Timestamps
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  submittedAt?: Timestamp;
  submittedBy?: string;
}

/**
 * Design option group for comparison
 * Groups multiple options for the same decision point
 */
export interface DesignOptionGroup {
  id: string;
  projectId: string;
  designItemId?: string;

  // Group details
  /** Group name, e.g., "Kitchen Island Material Options" */
  name: string;
  /** Description of what the client is deciding */
  description?: string;

  // Options in this group (client chooses one)
  optionIds: string[];

  // Which option was selected
  selectedOptionId?: string;

  // Workflow
  status: 'draft' | 'submitted' | 'decided' | 'archived';
  dueDate?: Timestamp;

  // Approval item link
  approvalItemId?: string;

  // Timestamps
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
}

/**
 * Form data for creating a design option
 */
export interface DesignOptionFormData {
  name: string;
  description?: string;
  category: DesignOptionCategory;
  inspirations?: DesignOptionInspiration[];
  estimatedCost?: number;
  currency?: string;
  isRecommended?: boolean;
  comparisonNotes?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

/**
 * Options for submitting design option for approval
 */
export interface SubmitForApprovalOptions {
  /** Quote to attach the approval item to */
  quoteId?: string;
  /** Due date for client response */
  dueDate?: Date;
  /** Priority for the approval */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Message to include with the approval request */
  message?: string;
}

/**
 * Filter options for querying design options
 */
export interface DesignOptionFilters {
  designItemId?: string;
  status?: DesignOptionStatus | DesignOptionStatus[];
  category?: DesignOptionCategory | DesignOptionCategory[];
  isRecommended?: boolean;
}
