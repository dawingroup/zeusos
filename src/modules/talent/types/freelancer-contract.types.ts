/**
 * FreelancerContract — engagement contract for a freelancer on a project.
 *
 * Collection: freelancer_contracts/{contractId}
 */

import type { Timestamp } from 'firebase/firestore';

export type ContractStatus = 'DRAFT' | 'SIGNED' | 'EXPIRED';

export interface FreelancerContract {
  id: string;
  talentProfileId: string;
  masterJobId?: string;
  projectTitle: string;
  startDate: string;
  endDate: string;
  /** Total contract fee in minor units. */
  totalFeeMinor: number;
  currency: string;
  /** Storage reference to the signed contract document. */
  signedContractStorageRef?: string;
  status: ContractStatus;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
