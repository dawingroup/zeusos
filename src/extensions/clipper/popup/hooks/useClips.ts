import { useState, useEffect, useCallback } from 'react';
import type { PopupClipRecord } from '../types';

// Simplified clip type for chrome.storage
interface StoredClip {
  id: string;
  firestoreId?: string;
  imageUrl: string;
  sourceUrl: string;
  title: string;
  thumbnailDataUrl?: string;
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'syncing' | 'error';
  syncError?: string;
  tags?: string[];
  description?: string;
  notes?: string;
  brand?: string;
  sku?: string;
  price?: { amount: number; currency?: string; formatted: string };
  dimensions?: { width?: number; height?: number; depth?: number; unit?: string };
  materials?: string[];
  colors?: string[];
  projectId?: string;
  designItemId?: string;
  clipType?: string;
  analysisStatus?: 'pending' | 'analyzing' | 'completed' | 'failed';
  aiAnalysis?: PopupClipRecord['aiAnalysis'];
}

interface UseClipsReturn {
  clips: PopupClipRecord[];
  pendingCount: number;
  isLoading: boolean;
  syncClips: () => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  updateClip: (clipId: string, updates: Partial<PopupClipRecord>) => Promise<void>;
  triggerAnalysis: (clipId: string) => Promise<void>;
}

export function useClips(): UseClipsReturn {
  const [clips, setClips] = useState<PopupClipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadClips = useCallback(async () => {
    try {
      // Load clips from chrome.storage.local
      const result = await chrome.storage.local.get(['clips']);
      const storedClips: StoredClip[] = result.clips || [];
      
      // Map to PopupClipRecord format
      const mappedClips: PopupClipRecord[] = storedClips.map((clip) => ({
        id: clip.id,
        firestoreId: clip.firestoreId,
        imageUrl: clip.imageUrl,
        sourceUrl: clip.sourceUrl,
        title: clip.title,
        thumbnailDataUrl: clip.thumbnailDataUrl,
        createdAt: new Date(clip.createdAt),
        syncStatus: clip.syncStatus,
        syncError: clip.syncError,
        tags: clip.tags || [],
        description: clip.description,
        notes: clip.notes,
        brand: clip.brand,
        sku: clip.sku,
        price: clip.price,
        dimensions: clip.dimensions,
        materials: clip.materials,
        colors: clip.colors,
        projectId: clip.projectId,
        designItemId: clip.designItemId,
        clipType: clip.clipType as PopupClipRecord['clipType'],
        analysisStatus: clip.analysisStatus,
        aiAnalysis: clip.aiAnalysis,
      }));
      
      // Sort by createdAt descending
      mappedClips.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setClips(mappedClips);
      console.log('Loaded clips:', mappedClips.length);
    } catch (error) {
      console.error('Failed to load clips:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClips();

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.clips) {
        console.log('Clips storage changed');
        loadClips();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Listen for analysis complete/failed messages from service worker
    const handleMessage = (message: { type: string; clipId?: string }) => {
      if (message.type === 'ANALYSIS_COMPLETE' || message.type === 'ANALYSIS_FAILED') {
        console.log(`Analysis ${message.type} for clip ${message.clipId}`);
        loadClips();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    // Refresh clips when popup opens/focuses
    const handleFocus = () => loadClips();
    window.addEventListener('focus', handleFocus);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadClips]);

  const pendingCount = clips.filter((c) => c.syncStatus === 'pending').length;

  const syncClips = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'REQUEST_SYNC' });
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const deleteClip = async (clipId: string) => {
    try {
      const result = await chrome.storage.local.get(['clips']);
      const clips: StoredClip[] = result.clips || [];
      const filtered = clips.filter((c) => c.id !== clipId);
      await chrome.storage.local.set({ clips: filtered });
      loadClips();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const updateClip = async (clipId: string, updates: Partial<PopupClipRecord>) => {
    try {
      const result = await chrome.storage.local.get(['clips']);
      const storedClips: StoredClip[] = result.clips || [];
      const index = storedClips.findIndex((c) => c.id === clipId);
      if (index !== -1) {
        storedClips[index] = { ...storedClips[index], ...updates, createdAt: storedClips[index].createdAt };
        await chrome.storage.local.set({ clips: storedClips });
        loadClips();
      }
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const triggerAnalysis = async (clipId: string) => {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'TRIGGER_ANALYSIS', clipId });
      if (!result?.success) {
        console.error('Analysis trigger failed:', result?.error);
      }
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
    }
  };

  return {
    clips,
    pendingCount,
    isLoading,
    syncClips,
    deleteClip,
    updateClip,
    triggerAnalysis,
  };
}
