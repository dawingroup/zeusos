/**
 * Project Context
 * Provides current project data and capabilities to child components
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useProject } from '../hooks/useProjects';
import type { MatFlowProject, MatFlowCapability, ProjectMember } from '../types';
import { MATFLOW_ROLE_TEMPLATES } from '../types';
import { useAuth } from '@/core/hooks/useAuth';

interface ProjectContextValue {
  project: MatFlowProject | null;
  isLoading: boolean;
  loading: boolean; // Alias for isLoading
  error: Error | null;
  userRole: string | null;
  currentMember: ProjectMember | null;
  capabilities: MatFlowCapability[];
  hasCapability: (cap: MatFlowCapability) => boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  projectId: string;
  children: React.ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({
  projectId,
  children,
}) => {
  const { user } = useAuth();
  const { project, isLoading, error } = useProject(projectId);
  
  const { userRole, capabilities, currentMember } = useMemo(() => {
    if (!project || !user) {
      return { userRole: null, capabilities: [] as MatFlowCapability[], currentMember: null };
    }
    
    const member = project.members?.find((m: { userId: string; role: string }) => m.userId === user.uid);
    if (!member) {
      return { userRole: null, capabilities: [] as MatFlowCapability[], currentMember: null };
    }
    
    const roleCapabilities = MATFLOW_ROLE_TEMPLATES[member.role] || [];
    const customCapabilities = (member.capabilities || []) as MatFlowCapability[];
    
    return {
      userRole: member.role,
      capabilities: [...new Set([...roleCapabilities, ...customCapabilities])] as MatFlowCapability[],
      currentMember: member,
    };
  }, [project, user]);
  
  const hasCapability = (cap: MatFlowCapability) => capabilities.includes(cap);
  
  const value: ProjectContextValue = {
    project,
    isLoading,
    loading: isLoading,
    error,
    userRole,
    currentMember,
    capabilities,
    hasCapability,
  };
  
  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider');
  }
  return context;
}
