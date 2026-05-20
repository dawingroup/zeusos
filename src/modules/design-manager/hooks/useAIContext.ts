/**
 * useAIContext Hook
 * React hook for managing AI context with change detection
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { DesignItem } from '../types';
import {
  AIContext,
  AIOutput,
  saveAIContext,
  updateContextWithItem,
  recordAIOutput,
  getLatestOutput,
  hasRelevantChanges,
  getChangeSummary,
} from '../services/aiContextService';

interface UseAIContextReturn {
  context: AIContext | null;
  isLoading: boolean;
  changesDetected: string[];
  hasChangesFor: (sections: string[]) => boolean;
  getOutput: (toolName: string) => AIOutput | null;
  recordOutput: (toolName: string, output: any, sourceSections: string[]) => Promise<void>;
  acknowledgeChanges: () => Promise<void>;
  refreshContext: () => void;
}

export function useAIContext(
  item: DesignItem | null,
  projectId: string | undefined
): UseAIContextReturn {
  const [context, setContext] = useState<AIContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load and sync context when item changes
  useEffect(() => {
    if (!item || !projectId) {
      setIsLoading(false);
      return;
    }

    // Subscribe to AI context in Firestore
    const contextRef = doc(db, 'aiContext', item.id);
    
    const unsubscribe = onSnapshot(contextRef, async (snapshot) => {
      let loadedContext: AIContext | null = null;
      
      if (snapshot.exists()) {
        loadedContext = snapshot.data() as AIContext;
      }
      
      // Update context with current item data and detect changes
      const updatedContext = updateContextWithItem(loadedContext, item, projectId);
      setContext(updatedContext);
      
      // Save if there were changes detected
      if (JSON.stringify(loadedContext) !== JSON.stringify(updatedContext)) {
        await saveAIContext(updatedContext);
      }
      
      setIsLoading(false);
    }, (error) => {
      console.error('Error loading AI context:', error);
      // Create a new context if we can't load
      const newContext = updateContextWithItem(null, item, projectId);
      setContext(newContext);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [item?.id, item?.updatedAt, projectId]);

  // Get list of changed sections
  const changesDetected = context ? getChangeSummary(context) : [];

  // Check if specific sections have changes
  const hasChangesFor = useCallback((sections: string[]) => {
    if (!context) return false;
    return hasRelevantChanges(context, sections);
  }, [context]);

  // Get the latest output for a tool
  const getOutput = useCallback((toolName: string) => {
    if (!context) return null;
    return getLatestOutput(context, toolName);
  }, [context]);

  // Record a new AI output
  const recordOutput = useCallback(async (
    toolName: string, 
    output: any, 
    sourceSections: string[]
  ) => {
    if (!context) return;
    
    const updatedContext = recordAIOutput(context, toolName, output, sourceSections);
    setContext(updatedContext);
    await saveAIContext(updatedContext);
  }, [context]);

  // Acknowledge all changes (clear flags)
  const acknowledgeChanges = useCallback(async () => {
    if (!context) return;
    
    const updatedContext: AIContext = {
      ...context,
      changesDetected: {
        overview: false,
        parameters: false,
        parts: false,
        files: false,
        ragStatus: false,
      },
    };
    
    setContext(updatedContext);
    await saveAIContext(updatedContext);
  }, [context]);

  // Force refresh context
  const refreshContext = useCallback(() => {
    if (item && projectId) {
      const updatedContext = updateContextWithItem(context, item, projectId);
      setContext(updatedContext);
    }
  }, [context, item, projectId]);

  return {
    context,
    isLoading,
    changesDetected,
    hasChangesFor,
    getOutput,
    recordOutput,
    acknowledgeChanges,
    refreshContext,
  };
}
