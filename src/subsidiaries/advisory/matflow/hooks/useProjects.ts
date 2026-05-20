/**
 * Project Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  subscribeToProject,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '../services/projectService';
import type { MatFlowProject, ProjectStatus } from '../types';

// Default organization ID for MatFlow (can be overridden)
const DEFAULT_ORG_ID = 'default';

export function useProjects(filters?: {
  status?: ProjectStatus;
  customerId?: string;
}) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<MatFlowProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Use user's organizationId if available, otherwise default
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  
  const reload = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await getProjects(orgId, filters);
      setProjects(data as any);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load projects'));
    } finally {
      setIsLoading(false);
    }
  }, [orgId, user, filters?.status, filters?.customerId]);
  
  useEffect(() => {
    reload();
  }, [reload]);
  
  return { projects, isLoading, error, reload };
}

export function useProject(projectId: string | null) {
  const { user } = useAuth();
  const [project, setProject] = useState<MatFlowProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  
  useEffect(() => {
    if (!user || !projectId) {
      setProject(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToProject(orgId, projectId, (data) => {
      setProject(data as any);
      setIsLoading(false);
      setError(null);
    });
    
    return () => unsubscribe();
  }, [orgId, user, projectId]);
  
  return { project, isLoading, error };
}

export function useProjectMutations() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;
  
  const create = useCallback(async (input: CreateProjectInput) => {
    if (!userId) throw new Error('Not authenticated');
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const projectId = await createProject(orgId, userId, input);
      return projectId;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create project');
      setError(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, userId]);
  
  const update = useCallback(async (projectId: string, input: UpdateProjectInput) => {
    if (!userId) throw new Error('Not authenticated');
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await updateProject(orgId, projectId, userId, input);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update project');
      setError(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, userId]);
  
  const remove = useCallback(async (projectId: string) => {
    if (!userId) throw new Error('Not authenticated');
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await deleteProject(orgId, projectId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete project');
      setError(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, userId]);
  
  return { create, update, remove, isSubmitting, error };
}
