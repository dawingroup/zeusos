/**
 * DELIVERY PROJECT SERVICE (Refactored)
 * =================================================================
 * This service acts as a wrapper around the Core Project Service.
 * It handles basic CRUD by delegating to the core service, but also
 * contains business logic specific to the Project Delivery module,

 * such as progress tracking and timeline extensions.
 */

import {
  serverTimestamp,
  Timestamp,
  Firestore,
  addDoc,
  collection
} from 'firebase/firestore';

// Core project imports
import { 
  Project, 
  ProjectFormData, 
  ProjectStatus 
} from '@/subsidiaries/advisory/core/project/types/project.types';
import { 
  ProjectService as CoreProjectService, 
  getProjectService as getCoreProjectService 
} from '@/subsidiaries/advisory/core/project/services/project.service';

// Delivery-specific type imports
import { ProgressRecord, calculateProgressStatus } from '../types/project-progress';
import { FacilityBranding } from '../types/funds-acknowledgement';
import { TimelineExtension, calculateDaysBetween } from '../types/project-timeline';
import { ProjectBudget } from '../types/project-budget';
import { ProjectLocation } from '../types/project-location';

// Default organization ID - matches the pattern used across the app
const ORG_ID = 'default'; 

export class ProjectService {
  private static instance: ProjectService;
  private db: Firestore;
  private coreProjectService: CoreProjectService;

  private constructor(db: Firestore) {
    this.db = db;
    this.coreProjectService = getCoreProjectService(db);
  }

  static getInstance(db: Firestore): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService(db);
    }
    return ProjectService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // DELEGATED CORE METHODS
  // ─────────────────────────────────────────────────────────────────

  async createProject(data: ProjectFormData, userId: string): Promise<Project> {
    // This now calls the core service method
    return this.coreProjectService.createProject(ORG_ID, userId, data);
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.coreProjectService.getProject(ORG_ID, projectId);
  }

  async getAllProjects(options?: {
    status?: ProjectStatus[];
    orderByField?: 'name' | 'createdAt' | 'status';
    orderDirection?: 'asc' | 'desc';
    limitCount?: number;
  }): Promise<Project[]> {
    return this.coreProjectService.getAllProjects(ORG_ID, options);
  }

  async getProjectsByProgram(programId: string, options?: { status?: ProjectStatus[] }): Promise<Project[]> {
    return this.coreProjectService.getProjectsByProgram(ORG_ID, programId, options);
  }

  subscribeToProject(projectId: string, callback: (project: Project | null) => void): () => void {
    return this.coreProjectService.subscribeToProject(ORG_ID, projectId, callback);
  }

  subscribeToProjectsByProgram(programId: string, callback: (projects: Project[]) => void): () => void {
    return this.coreProjectService.subscribeToProjectsByProgram(ORG_ID, programId, callback);
  }

  async updateProject(projectId: string, updates: Partial<Project>, userId: string): Promise<void> {
    return this.coreProjectService.updateProject(ORG_ID, projectId, userId, updates);
  }

  async updateProjectStatus(projectId: string, newStatus: ProjectStatus, userId: string): Promise<void> {
    // This business logic remains in the delivery service but uses the core service
    return this.coreProjectService.updateProjectStatus(ORG_ID, projectId, newStatus, userId);
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    return this.coreProjectService.deleteProject(ORG_ID, projectId, userId);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // DELIVERY-SPECIFIC BUSINESS LOGIC
  // These methods remain within the Delivery service but use the
  // core service to fetch and update project data.
  // ─────────────────────────────────────────────────────────────────

  async recordProgress(
    projectId: string,
    record: Omit<ProgressRecord, 'id' | 'recordedBy' | 'recordedAt'>,
    userId: string
  ): Promise<string> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const recordId = `prog-${Date.now()}`;
    const progressRecord: ProgressRecord = { id: recordId, ...record, recordedBy: userId, recordedAt: Timestamp.now() };

    const progressStatus = calculateProgressStatus(record.physicalProgress, (project.progress as any).plannedProgress || 0);

    const updates = {
      'progress.physicalProgress': record.physicalProgress,
      'progress.lastPhysicalUpdate': serverTimestamp(),
      'progress.physicalUpdateMethod': 'manual',
      'progress.progressStatus': progressStatus,
      'progress.progressHistory': [...((project.progress as any).progressHistory || []), progressRecord],
    };
    
    await this.updateProject(projectId, updates as any, userId);
    await this.logActivity(projectId, 'progress_recorded', userId, { physicalProgress: record.physicalProgress });
    return recordId;
  }

  async requestExtension(
    projectId: string,
    extensionData: Omit<TimelineExtension, 'id' | 'status' | 'approvedBy' | 'approvedAt' | 'newEndDate' | 'approvedDays'>,
    userId: string
  ): Promise<string> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const extensionId = `ext-${Date.now()}`;
    const newExtension = { id: extensionId, ...extensionData, approvedDays: 0, status: 'pending' } as TimelineExtension;

    const updates = {
      'timeline.extensions': [...(project.timeline as any).extensions, newExtension],
    };

    await this.updateProject(projectId, updates as any, userId);
    await this.logActivity(projectId, 'extension_requested', userId, { extensionId, requestedDays: extensionData.requestedDays });
    return extensionId;
  }
  
  async approveExtension(
    projectId: string,
    extensionId: string,
    approvedDays: number,
    userId: string
  ): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const extensionIndex = (project.timeline as any).extensions.findIndex((e: TimelineExtension) => e.id === extensionId);
    if (extensionIndex === -1) throw new Error('Extension not found');

    const extension = (project.timeline as any).extensions[extensionIndex];
    const currentEndDate = new Date((project.timeline.currentEndDate as any).seconds * 1000);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + approvedDays);

    const updatedExtensions = [...(project.timeline as any).extensions];
    updatedExtensions[extensionIndex] = {
      ...extension,
      approvedDays,
      status: approvedDays === extension.requestedDays ? 'approved' : 'partial',
      approvedBy: userId,
      approvedAt: Timestamp.now(),
      newEndDate,
    };

    const updates = {
      'timeline.extensions': updatedExtensions,
      'timeline.currentEndDate': newEndDate,
      'timeline.daysRemaining': calculateDaysBetween(new Date(), newEndDate),
    };

    await this.updateProject(projectId, updates as any, userId);
    await this.logActivity(projectId, 'extension_approved', userId, { extensionId, approvedDays });
  }

  async updateLocation(projectId: string, location: Partial<ProjectLocation>, userId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    const updatedLocation = { ...project.location, ...location };
    await this.updateProject(projectId, { location: updatedLocation }, userId);
  }

  async updateBudget(projectId: string, budgetUpdates: Partial<ProjectBudget>, userId: string): Promise<void> {
    const updates: Record<string, any> = {};
    Object.entries(budgetUpdates).forEach(([key, value]) => {
      updates[`budget.${key}`] = value;
    });
    await this.updateProject(projectId, updates as any, userId);
  }

  // ─────────────────────────────────────────────────────────────────
  // FACILITY BRANDING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update facility branding for a project
   * Used for generating branded documents like Funds Acknowledgement Forms
   */
  async updateFacilityBranding(projectId: string, branding: FacilityBranding, userId: string): Promise<void> {
    return this.coreProjectService.updateFacilityBranding(ORG_ID, projectId, branding, userId);
  }

  /**
   * Get facility branding for a project
   */
  async getFacilityBranding(projectId: string): Promise<FacilityBranding | null> {
    return this.coreProjectService.getFacilityBranding(ORG_ID, projectId);
  }

  // ─────────────────────────────────────────────────────────────────
  // MATFLOW INTEGRATION
  // ─────────────────────────────────────────────────────────────────

  async linkToMatFlow(projectId: string, boqId: string, userId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const boqIds = project.boqIds || [];
    if (!boqIds.includes(boqId)) {
      boqIds.push(boqId);
    }
    
    await this.updateProject(projectId, { boqIds, activeBoqId: project.activeBoqId || boqId }, userId);
    await this.logActivity(projectId, 'matflow_linked', userId, { boqId });
  }
  
  // Helper for logging remains for now
  private async logActivity(projectId: string, action: string, userId: string, details?: Record<string, unknown>): Promise<void> {
    const activityRef = collection(this.db, `organizations/${ORG_ID}/advisory_projects/${projectId}/activityLog`);
    await addDoc(activityRef, {
      action,
      userId,
      details,
      timestamp: serverTimestamp(),
    });
  }
}

// Export singleton factory
export function getProjectService(db: Firestore): ProjectService {
  return ProjectService.getInstance(db);
}