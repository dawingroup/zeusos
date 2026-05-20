/**
 * PROJECT CONTRACTOR TYPES
 *
 * Types for managing contractor information on delivery projects.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// CONTRACTOR TYPES
// ============================================================================

export type ContractorStatus = 'active' | 'suspended' | 'terminated' | 'completed';

export type ContractType = 'lump_sum' | 'unit_rate' | 'cost_plus' | 'design_build';

export interface ContractorContact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface ProjectContractor {
  id: string;
  projectId: string;
  companyName: string;
  registrationNumber?: string;
  taxId?: string;
  contractNumber?: string;
  contractType?: ContractType;
  contractValue?: number;
  currency?: string;
  status: ContractorStatus;
  contactPerson?: ContractorContact;
  address?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  performanceRating?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// HELPERS
// ============================================================================

export const CONTRACTOR_STATUS_LABELS: Record<ContractorStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  terminated: 'Terminated',
  completed: 'Completed',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  lump_sum: 'Lump Sum',
  unit_rate: 'Unit Rate',
  cost_plus: 'Cost Plus',
  design_build: 'Design & Build',
};
