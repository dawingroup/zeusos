/**
 * ProductionJob — header record for a physical production job.
 *
 * Collection: production_jobs/{jobId}
 *
 * The 10-stage workflow models the lifecycle of a TVC shoot,
 * radio recording, photography session, print run, or exhibition build.
 */

import type { Timestamp } from 'firebase/firestore';

export type ProductionJobType =
  | 'TVC'
  | 'RADIO'
  | 'PHOTOGRAPHY'
  | 'PRINT'
  | 'EXHIBITION'
  | 'OTHER';

export type ProductionStage =
  | 'BRIEF'
  | 'PRE_PRODUCTION'
  | 'TALENT_BOOKING'
  | 'LOCATION_LOCK'
  | 'EQUIPMENT'
  | 'SHOOT'
  | 'POST_PRODUCTION'
  | 'CLIENT_REVIEW'
  | 'MASTER_DELIVERY'
  | 'COMPLETE';

/** Ordered list of all stages — used for advance-stage guard. */
export const PRODUCTION_STAGES: readonly ProductionStage[] = [
  'BRIEF',
  'PRE_PRODUCTION',
  'TALENT_BOOKING',
  'LOCATION_LOCK',
  'EQUIPMENT',
  'SHOOT',
  'POST_PRODUCTION',
  'CLIENT_REVIEW',
  'MASTER_DELIVERY',
  'COMPLETE',
] as const;

export interface ProductionJob {
  id: string;
  title: string;
  type: ProductionJobType;
  masterJobId: string;
  campaignId?: string;
  /** Internal Work Order reference, if issued. */
  iwoId?: string;
  stage: ProductionStage;
  subsidiaryOrgId: string;
  producerId: string;
  scheduledShootDate?: string;
  /** Storage reference for the call sheet document. */
  callSheetStorageRef?: string;
  /** Audit log of stage transitions. */
  stageHistory?: ProductionStageTransition[];
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface ProductionStageTransition {
  fromStage: ProductionStage;
  toStage: ProductionStage;
  transitionedAt: Timestamp | string;
  transitionedBy: string;
  notes?: string;
}
