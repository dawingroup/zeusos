import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { 
  createWorkInstance, 
  updateWorkInstance, 
  getWorkInstance,
  getProjectInstances,
  getAllRecentInstances,
  addDriveFileLink,
  updateInstanceStatus
} from '../services/workInstanceService';

const WorkInstanceContext = createContext();

export const WorkInstanceProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentInstance, setCurrentInstance] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [recentInstances, setRecentInstances] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const autoSaveTimerRef = useRef(null);

  // Load recent instances on mount and when user changes
  useEffect(() => {
    if (user?.email) {
      loadRecentInstances();
    }
  }, [user?.email]);

  const loadRecentInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      const instances = await getAllRecentInstances(20);
      setRecentInstances(instances);
    } catch (error) {
      console.error('Failed to load recent instances:', error);
    } finally {
      setLoadingInstances(false);
    }
  }, []);

  // Create new instance
  const createNewInstance = useCallback(async (projectData) => {
    try {
      setSaving(true);
      const instance = await createWorkInstance(projectData, user);
      setCurrentInstance(instance);
      setCurrentProjectId(projectData.projectId);
      setLastSaved(new Date());
      await loadRecentInstances();
      return instance;
    } catch (error) {
      console.error('Failed to create instance:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user, loadRecentInstances]);

  // Check if project changed and clear instance if needed
  const handleProjectChange = useCallback((newProjectId) => {
    if (currentProjectId && newProjectId !== currentProjectId) {
      // Project changed - clear the current instance
      console.log('Project changed, clearing current instance');
      setCurrentInstance(null);
      setLastSaved(null);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    }
    setCurrentProjectId(newProjectId);
  }, [currentProjectId]);

  // Save current instance (with project validation)
  const saveInstance = useCallback(async (updates, projectId = null) => {
    if (!currentInstance?.id) {
      console.warn('No current instance to save');
      return false;
    }
    
    // Validate that we're saving to the correct project's instance
    if (projectId && currentInstance.projectId !== projectId) {
      console.warn('Cannot save: current instance belongs to a different project');
      return false;
    }
    
    try {
      setSaving(true);
      await updateWorkInstance(currentInstance.id, updates, user);
      setCurrentInstance(prev => ({ ...prev, ...updates }));
      setLastSaved(new Date());
      return true;
    } catch (error) {
      console.error('Failed to save instance:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [currentInstance?.id, currentInstance?.projectId, user]);

  // Load existing instance
  const loadInstance = useCallback(async (instanceId) => {
    try {
      const instance = await getWorkInstance(instanceId);
      setCurrentInstance(instance);
      // Also update the current project ID to match the loaded instance
      if (instance?.projectId) {
        setCurrentProjectId(instance.projectId);
      }
      return instance;
    } catch (error) {
      console.error('Failed to load instance:', error);
      throw error;
    }
  }, []);

  // Load instances for a project
  const loadProjectInstances = useCallback(async (projectId) => {
    try {
      return await getProjectInstances(projectId);
    } catch (error) {
      console.error('Failed to load project instances:', error);
      return [];
    }
  }, []);

  // Add exported file link
  const addExportedFile = useCallback(async (fileInfo) => {
    if (!currentInstance?.id) return;
    try {
      await addDriveFileLink(currentInstance.id, fileInfo, user);
      setCurrentInstance(prev => ({
        ...prev,
        driveFiles: [...(prev.driveFiles || []), {
          ...fileInfo,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user?.email,
        }]
      }));
    } catch (error) {
      console.error('Failed to add exported file:', error);
    }
  }, [currentInstance?.id, user]);

  // Update status
  const setInstanceStatus = useCallback(async (status) => {
    if (!currentInstance?.id) return;
    try {
      await updateInstanceStatus(currentInstance.id, status, user);
      setCurrentInstance(prev => ({ ...prev, status }));
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [currentInstance?.id, user]);

  // Clear current instance (start fresh)
  const clearInstance = useCallback(() => {
    setCurrentInstance(null);
    setCurrentProjectId(null);
    setLastSaved(null);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

  // Schedule auto-save
  const scheduleAutoSave = useCallback((updates) => {
    if (!autoSaveEnabled || !currentInstance?.id) return;
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Schedule new auto-save in 30 seconds
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveInstance(updates);
        console.log('Auto-saved work instance');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 30000);
  }, [autoSaveEnabled, currentInstance?.id, saveInstance]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({
    currentInstance,
    setCurrentInstance,
    currentProjectId,
    recentInstances,
    saving,
    lastSaved,
    autoSaveEnabled,
    setAutoSaveEnabled,
    loadingInstances,
    createNewInstance,
    saveInstance,
    loadInstance,
    loadProjectInstances,
    loadRecentInstances,
    addExportedFile,
    setInstanceStatus,
    clearInstance,
    scheduleAutoSave,
    handleProjectChange,
  }), [
    currentInstance,
    currentProjectId,
    recentInstances,
    saving,
    lastSaved,
    autoSaveEnabled,
    loadingInstances,
    createNewInstance,
    saveInstance,
    loadInstance,
    loadProjectInstances,
    loadRecentInstances,
    addExportedFile,
    setInstanceStatus,
    clearInstance,
    scheduleAutoSave,
    handleProjectChange,
  ]);

  return (
    <WorkInstanceContext.Provider value={value}>
      {children}
    </WorkInstanceContext.Provider>
  );
};

export const useWorkInstance = () => {
  const context = useContext(WorkInstanceContext);
  if (!context) {
    throw new Error('useWorkInstance must be used within a WorkInstanceProvider');
  }
  return context;
};

export default WorkInstanceContext;
