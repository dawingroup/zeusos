import { Timestamp } from 'firebase/firestore';

/**
 * ENGAGEMENT STATUS
 */
export type EngagementStatus =
  | 'prospect'           // In pipeline, not won
  | 'onboarding'         // Won, setting up
  | 'active'             // Ongoing work
  | 'on_hold'            // Temporarily paused
  | 'closing'            // Wrapping up
  | 'completed'          // Successfully finished
  | 'terminated';        // Ended early

/**
 * MILESTONE STATUS
 */
export type MilestoneStatus = 'pending' | 'achieved' | 'missed' | 'cancelled';

/**
 * MILESTONE
 * Key engagement milestone
 */
export interface Milestone {
  /** Unique identifier */
  id: string;
  
  /** Milestone name */
  name: string;
  
  /** Description */
  description?: string;
  
  /** Target date */
  targetDate: Timestamp;
  
  /** Actual achievement date */
  actualDate?: Timestamp;
  
  /** Status */
  status: MilestoneStatus;
  
  /** Linked entity type */
  linkedEntityType?: 'program' | 'project' | 'deal' | 'portfolio';
  
  /** Linked entity ID */
  linkedEntityId?: string;
}

/**
 * ENGAGEMENT TIMELINE
 */
export interface EngagementTimeline {
  /** When engagement was won/signed */
  effectiveDate: Timestamp;
  
  /** Expected completion/exit */
  targetEndDate?: Timestamp;
  
  /** Actual completion (if completed) */
  actualEndDate?: Timestamp;
  
  /** Key milestones */
  milestones: Milestone[];
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: EngagementStatus): string {
  const names: Record<EngagementStatus, string> = {
    prospect: 'Prospect',
    onboarding: 'Onboarding',
    active: 'Active',
    on_hold: 'On Hold',
    closing: 'Closing',
    completed: 'Completed',
    terminated: 'Terminated',
  };
  return names[status];
}

/**
 * Get status color for UI (Tailwind color names)
 */
export function getStatusColor(status: EngagementStatus): string {
  const colors: Record<EngagementStatus, string> = {
    prospect: 'gray',
    onboarding: 'blue',
    active: 'green',
    on_hold: 'yellow',
    closing: 'orange',
    completed: 'teal',
    terminated: 'red',
  };
  return colors[status];
}

/**
 * Get status badge classes (Tailwind)
 */
export function getStatusBadgeClasses(status: EngagementStatus): string {
  const classes: Record<EngagementStatus, string> = {
    prospect: 'bg-gray-100 text-gray-800',
    onboarding: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    closing: 'bg-orange-100 text-orange-800',
    completed: 'bg-teal-100 text-teal-800',
    terminated: 'bg-red-100 text-red-800',
  };
  return classes[status];
}

/**
 * Check if engagement is in active state
 */
export function isActiveEngagement(status: EngagementStatus): boolean {
  return ['onboarding', 'active', 'on_hold', 'closing'].includes(status);
}

/**
 * Check if engagement is terminal
 */
export function isTerminalStatus(status: EngagementStatus): boolean {
  return ['completed', 'terminated'].includes(status);
}

/**
 * Valid status transitions
 */
export const STATUS_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  prospect: ['onboarding', 'terminated'],
  onboarding: ['active', 'on_hold', 'terminated'],
  active: ['on_hold', 'closing', 'terminated'],
  on_hold: ['active', 'closing', 'terminated'],
  closing: ['completed', 'terminated'],
  completed: [],  // Terminal state
  terminated: [], // Terminal state
};

/**
 * Check if status transition is valid
 */
export function canTransitionTo(
  currentStatus: EngagementStatus,
  newStatus: EngagementStatus
): boolean {
  return STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Get valid next statuses
 */
export function getValidNextStatuses(currentStatus: EngagementStatus): EngagementStatus[] {
  return STATUS_TRANSITIONS[currentStatus];
}

/**
 * Get milestone status display name
 */
export function getMilestoneStatusDisplayName(status: MilestoneStatus): string {
  const names: Record<MilestoneStatus, string> = {
    pending: 'Pending',
    achieved: 'Achieved',
    missed: 'Missed',
    cancelled: 'Cancelled',
  };
  return names[status];
}

/**
 * Get milestone status color
 */
export function getMilestoneStatusColor(status: MilestoneStatus): string {
  const colors: Record<MilestoneStatus, string> = {
    pending: 'blue',
    achieved: 'green',
    missed: 'red',
    cancelled: 'gray',
  };
  return colors[status];
}
