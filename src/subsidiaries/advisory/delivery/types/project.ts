/**
 * PROJECT TYPES FOR DELIVERY MODULE
 * 
 * Re-exports from core and adds delivery-specific constants.
 */

// Re-export core project types
export type { 
  ProjectStatus, 
  ProjectType,
  Project,
  ProjectFormData,
  ProjectSummary
} from '@/subsidiaries/advisory/core/project/types/project.types';

import type { Project, ProjectStatus } from '@/subsidiaries/advisory/core/project/types/project.types';

// ─────────────────────────────────────────────────────────────────
// PROJECT STATUS CONFIGURATION
// ─────────────────────────────────────────────────────────────────

export interface ProjectStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

export const PROJECT_STATUSES: Record<ProjectStatus, ProjectStatusConfig> = {
  planning: {
    label: 'Planning',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Project in planning phase',
  },
  procurement: {
    label: 'Procurement',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    description: 'Procuring materials and contractors',
  },
  mobilization: {
    label: 'Mobilization',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    description: 'Site mobilization in progress',
  },
  active: {
    label: 'Active',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Construction actively underway',
  },
  substantial_completion: {
    label: 'Substantial Completion',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
    description: 'Substantial completion achieved',
  },
  defects_liability: {
    label: 'Defects Liability',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    description: 'In defects liability period',
  },
  completed: {
    label: 'Completed',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    description: 'Project completed',
  },
  suspended: {
    label: 'Suspended',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    description: 'Project temporarily suspended',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'Project cancelled',
  },
};

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUSES[status]?.label || status;
}

export function getProjectStatusColor(status: ProjectStatus): string {
  const config = PROJECT_STATUSES[status];
  return config ? `${config.color} ${config.bgColor}` : 'text-gray-700 bg-gray-100';
}

export function isProjectActive(status: ProjectStatus): boolean {
  return ['planning', 'procurement', 'mobilization', 'active', 'substantial_completion'].includes(status);
}

export function isProjectClosed(status: ProjectStatus): boolean {
  return ['completed', 'cancelled'].includes(status);
}

/**
 * Convert a Project to a ProjectSummary for list views
 */
export function getProjectSummary(project: Project): {
  id: string;
  projectCode: string;
  name: string;
  status: ProjectStatus;
  location: { siteName: string; region: string };
  budget: { currency: string; total: number; spent: number; percentSpent: number };
  progress: { physical: number; financial: number };
  timeline: { endDate: Date; isDelayed: boolean };
} {
  const budget = project.budget || { currency: 'UGX', totalBudget: 0, spent: 0 };
  const progress = project.progress || { physicalProgress: 0, financialProgress: 0 };
  const timeline = project.timeline || { currentEndDate: new Date(), isDelayed: false };
  const location = project.location || { siteName: '', region: '' };

  return {
    id: project.id,
    projectCode: project.projectCode || '',
    name: project.name,
    status: project.status,
    location: {
      siteName: location.siteName || '',
      region: location.region || '',
    },
    budget: {
      currency: budget.currency || 'UGX',
      total: budget.totalBudget || 0,
      spent: budget.spent || 0,
      percentSpent: budget.totalBudget ? (budget.spent / budget.totalBudget) * 100 : 0,
    },
    progress: {
      physical: progress.physicalProgress || 0,
      financial: progress.financialProgress || 0,
    },
    timeline: {
      endDate: timeline.currentEndDate || new Date(),
      isDelayed: timeline.isDelayed || false,
    },
  };
}
