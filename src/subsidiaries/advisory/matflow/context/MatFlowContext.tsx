/**
 * MatFlow Context
 * Global state management for MatFlow module
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useParams } from 'react-router-dom';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface MatFlowContextValue {
  // Project
  currentProject: Project | null;
  projectLoading: boolean;
  projectError: Error | null;
  
  // Sync
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncNow: () => Promise<void>;
  
  // Preferences
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  
  // Filters (global)
  globalDateRange: { start: Date | null; end: Date | null };
  setGlobalDateRange: (range: { start: Date | null; end: Date | null }) => void;
}

const MatFlowContext = createContext<MatFlowContextValue | undefined>(undefined);

interface MatFlowContextProviderProps {
  children: ReactNode;
}

export const MatFlowContextProvider: React.FC<MatFlowContextProviderProps> = ({ children }) => {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState<Error | null>(null);
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  
  // UI preferences
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [globalDateRange, setGlobalDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // Load project
  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      setProjectLoading(true);
      setProjectError(null);
      
      try {
        // Placeholder - will connect to actual service
        // const project = await getProject(projectId);
        const project: Project = {
          id: projectId,
          name: 'Sample Construction Project',
          description: 'A sample project for testing',
        };
        setCurrentProject(project);
      } catch (err) {
        setProjectError(err instanceof Error ? err : new Error('Failed to load project'));
      } finally {
        setProjectLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  // Monitor offline status
  useEffect(() => {
    const checkOfflineStatus = async () => {
      // Placeholder - will connect to actual offline service
      setPendingChanges(0);
    };

    checkOfflineStatus();
    const interval = setInterval(checkOfflineStatus, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  // Sync function
  const syncNow = useCallback(async () => {
    if (syncStatus === 'syncing') return;
    
    setSyncStatus('syncing');
    
    try {
      // Placeholder - will connect to actual sync service
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSyncTime(new Date());
      setPendingChanges(0);
      setSyncStatus('success');
      
      // Reset to idle after brief success display
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      setSyncStatus('error');
      console.error('Sync failed:', err);
    }
  }, [syncStatus]);

  // Auto-sync when coming online
  useEffect(() => {
    const handleOnline = () => {
      if (pendingChanges > 0) {
        syncNow();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [pendingChanges, syncNow]);

  const value = useMemo<MatFlowContextValue>(() => ({
    currentProject,
    projectLoading,
    projectError,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    syncNow,
    viewMode,
    setViewMode,
    globalDateRange,
    setGlobalDateRange,
  }), [
    currentProject, projectLoading, projectError, syncStatus,
    lastSyncTime, pendingChanges, syncNow, viewMode, globalDateRange,
  ]);

  return (
    <MatFlowContext.Provider value={value}>
      {children}
    </MatFlowContext.Provider>
  );
};

export const useMatFlowContext = (): MatFlowContextValue => {
  const context = useContext(MatFlowContext);
  if (!context) {
    throw new Error('useMatFlowContext must be used within MatFlowContextProvider');
  }
  return context;
};

export default MatFlowContext;
