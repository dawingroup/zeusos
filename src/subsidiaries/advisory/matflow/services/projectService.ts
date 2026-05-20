/**
 * MATFLOW PROJECT SERVICE (Refactored)
 * =================================================================
 * This service now wraps the Core Project Service, delegating CRUD
 * operations to use the unified advisory_projects collection.
 *
 * Maintains backward compatibility with MatFlow's API while using
 * the shared core infrastructure.
 */

import {
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  collection,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';

// Core project imports
import {
  Project,
  ProjectFormData,
  ProjectStatus as CoreProjectStatus,
} from '@/subsidiaries/advisory/core/project/types/project.types';
import { getProjectService } from '@/subsidiaries/advisory/core/project/services/project.service';

// MatFlow-specific types (for backward compatibility)
import type { ProjectStatus } from '../types/core';

// ─────────────────────────────────────────────────────────────────
// TYPE MAPPINGS
// ─────────────────────────────────────────────────────────────────

/**
 * Map MatFlow status to Core status
 */
function mapMatFlowToCoreStatus(matflowStatus: ProjectStatus): CoreProjectStatus {
  const mapping: Record<ProjectStatus, CoreProjectStatus> = {
    'draft': 'planning',
    'planning': 'planning',
    'active': 'active',
    'on_hold': 'suspended',
    'completed': 'completed',
    'cancelled': 'cancelled',
  };
  return mapping[matflowStatus] || 'planning';
}

// ─────────────────────────────────────────────────────────────────
// INPUT TYPES (Backward Compatibility)
// ─────────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  projectCode?: string;
  description?: string;
  type?: 'new_construction' | 'renovation' | 'expansion' | 'rehabilitation';
  customerId?: string;
  customerName?: string;
  location?: {
    siteName: string;
    address?: string;
    district?: string;
    region?: string;
    country?: string;
  };
  startDate?: Date;
  endDate?: Date;
  budget?: {
    currency: 'UGX' | 'USD';
    totalBudget: number;
  };
  programId?: string; // Optional - will use default if not provided
}

export interface UpdateProjectInput {
  name?: string;
  projectCode?: string;
  description?: string;
  status?: ProjectStatus;
  type?: 'new_construction' | 'renovation' | 'expansion' | 'rehabilitation';
  customerId?: string;
  customerName?: string;
  location?: {
    siteName?: string;
    address?: string;
    district?: string;
    region?: string;
    country?: string;
  };
  startDate?: Date;
  endDate?: Date;
  budget?: {
    currency?: 'UGX' | 'USD';
    totalBudget?: number;
    spent?: number;
  };
  progress?: {
    physicalProgress?: number;
    financialProgress?: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPER: GET OR CREATE DEFAULT MATFLOW PROGRAM
// ─────────────────────────────────────────────────────────────────

let defaultMatFlowProgramId: string | null = null;

async function getOrCreateDefaultProgram(orgId: string): Promise<string> {
  // Return cached value if available
  if (defaultMatFlowProgramId) {
    return defaultMatFlowProgramId;
  }

  // Look for "MatFlow Projects" program
  const programsRef = collection(db, `organizations/${orgId}/advisory_programs`);
  const q = query(programsRef, where('name', '==', 'MatFlow Projects'));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    defaultMatFlowProgramId = snapshot.docs[0].id;
    return defaultMatFlowProgramId;
  }

  // If not found, this should have been created by migration script
  // For now, throw error to indicate migration is needed
  throw new Error(
    'MatFlow default program not found. Please run migration script first: npm run migrate:matflow'
  );
}

// ─────────────────────────────────────────────────────────────────
// CRUD OPERATIONS (Wrapping Core Service)
// ─────────────────────────────────────────────────────────────────

/**
 * Get all projects for an organization
 * Now queries advisory_projects collection with MatFlow program filter
 */
export async function getProjects(
  orgId: string,
  filters?: { status?: ProjectStatus; customerId?: string }
): Promise<Project[]> {
  const programId = await getOrCreateDefaultProgram(orgId);
  const projectsRef = collection(db, `organizations/${orgId}/advisory_projects`);

  // Build query
  let q = query(
    projectsRef,
    where('programId', '==', programId),
    where('isDeleted', '==', false),
    orderBy('createdAt', 'desc')
  );

  // Apply filters
  if (filters?.status) {
    const coreStatus = mapMatFlowToCoreStatus(filters.status);
    q = query(projectsRef, where('status', '==', coreStatus), orderBy('createdAt', 'desc'));
  }

  if (filters?.customerId) {
    q = query(q, where('customerId', '==', filters.customerId));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Project[];
}

/**
 * Get a single project by ID
 */
export async function getProject(
  orgId: string,
  projectId: string
): Promise<Project | null> {
  const coreService = getProjectService(db);
  return coreService.getProject(orgId, projectId);
}

/**
 * Subscribe to real-time project updates
 */
export function subscribeToProject(
  orgId: string,
  projectId: string,
  onUpdate: (project: Project | null) => void
): () => void {
  const coreService = getProjectService(db);
  return coreService.subscribeToProject(orgId, projectId, onUpdate);
}

/**
 * Create a new project
 * Transforms MatFlow input to Core format and uses Core service
 */
export async function createProject(
  orgId: string,
  userId: string,
  input: CreateProjectInput
): Promise<string> {
  // Get or create default program
  const programId = input.programId || (await getOrCreateDefaultProgram(orgId));

  // Transform to Core ProjectFormData
  const coreData: ProjectFormData = {
    programId,
    name: input.name,
    description: input.description || '',
    projectType: input.type || 'new_construction',
    location: {
      siteName: input.location?.siteName || input.name,
      district: input.location?.district || '',
      region: input.location?.region || '',
      country: input.location?.country || 'UG',
      address: input.location?.address,
    },
    estimatedStartDate: input.startDate || new Date(),
    estimatedEndDate: input.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 year
    budgetAmount: input.budget?.totalBudget || 0,
    budgetCurrency: input.budget?.currency || 'UGX',
    customerId: input.customerId,
  };

  // Create project via core service
  const coreService = getProjectService(db);
  const project = await coreService.createProject(orgId, userId, coreData);

  // Update with MatFlow-specific fields (BOQ summary)
  const projectRef = doc(db, `organizations/${orgId}/advisory_projects/${project.id}`);
  await updateDoc(projectRef, {
    boqSummary: {
      totalItems: 0,
      totalValue: 0,
      parsedItems: 0,
      approvedItems: 0,
    },
    customerName: input.customerName,
  });

  return project.id;
}

/**
 * Update an existing project
 * Transforms MatFlow updates to Core format
 */
export async function updateProject(
  orgId: string,
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<void> {
  const updates: Partial<Project> = {};

  // Map fields
  if (input.name !== undefined) updates.name = input.name;
  if (input.projectCode !== undefined) updates.projectCode = input.projectCode;
  if (input.description !== undefined) updates.description = input.description;
  if (input.customerId !== undefined) updates.customerId = input.customerId;
  if (input.customerName !== undefined) updates.customerName = input.customerName;

  // Map status
  if (input.status !== undefined) {
    updates.status = mapMatFlowToCoreStatus(input.status);
  }

  // Map type
  if (input.type !== undefined) {
    updates.projectType = input.type;
  }

  // Map location
  if (input.location) {
    const project = await getProject(orgId, projectId);
    if (project) {
      updates.location = {
        ...project.location,
        ...input.location,
      };
    }
  }

  // Map timeline
  if (input.startDate || input.endDate) {
    const project = await getProject(orgId, projectId);
    if (project) {
      updates.timeline = {
        ...project.timeline,
        ...(input.startDate && {
          plannedStartDate: input.startDate,
          currentStartDate: input.startDate,
        }),
        ...(input.endDate && {
          plannedEndDate: input.endDate,
          currentEndDate: input.endDate,
        }),
      };
    }
  }

  // Map budget
  if (input.budget) {
    const project = await getProject(orgId, projectId);
    if (project) {
      updates.budget = {
        ...project.budget,
        ...(input.budget.currency && { currency: input.budget.currency }),
        ...(input.budget.totalBudget !== undefined && { totalBudget: input.budget.totalBudget }),
        ...(input.budget.spent !== undefined && { spent: input.budget.spent }),
        ...(input.budget.totalBudget !== undefined && input.budget.spent !== undefined && {
          remaining: input.budget.totalBudget - input.budget.spent,
        }),
      };
    }
  }

  // Map progress
  if (input.progress) {
    const project = await getProject(orgId, projectId);
    if (project) {
      updates.progress = {
        ...project.progress,
        ...input.progress,
      };
    }
  }

  // Update via core service
  const coreService = getProjectService(db);
  await coreService.updateProject(orgId, projectId, userId, updates);
}

/**
 * Delete a project (soft delete via core service)
 */
export async function deleteProject(
  orgId: string,
  projectId: string,
  userId: string
): Promise<void> {
  const coreService = getProjectService(db);
  await coreService.deleteProject(orgId, projectId, userId);
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  orgId: string,
  projectId: string,
  userId: string,
  status: ProjectStatus
): Promise<void> {
  const coreStatus = mapMatFlowToCoreStatus(status);
  const coreService = getProjectService(db);
  await coreService.updateProjectStatus(orgId, projectId, coreStatus, userId);
}

/**
 * Update project progress
 */
export async function updateProjectProgress(
  orgId: string,
  projectId: string,
  userId: string,
  progress: { physicalProgress?: number; financialProgress?: number }
): Promise<void> {
  await updateProject(orgId, projectId, userId, { progress });
}

/**
 * Update BOQ summary (MatFlow-specific)
 * This remains MatFlow-specific as it updates the boqSummary field
 */
export async function updateBOQSummary(
  orgId: string,
  projectId: string,
  userId: string,
  boqSummary: {
    totalItems?: number;
    totalValue?: number;
    parsedItems?: number;
    approvedItems?: number;
  }
): Promise<void> {
  const project = await getProject(orgId, projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const projectRef = doc(db, `organizations/${orgId}/advisory_projects/${projectId}`);
  await updateDoc(projectRef, {
    boqSummary: {
      ...project.boqSummary,
      ...boqSummary,
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
