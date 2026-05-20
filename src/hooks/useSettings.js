/**
 * Settings Hook for Cutlist Processor
 * Manages global settings with localStorage + Firestore sync
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'cutlist_settings';
const COLLECTION = 'userSettings';

const DEFAULT_SETTINGS = {
  defaults: {
    bladeKerf: 3.2,
    minimumOffcutSize: 300,
    edgeAllowance: 2,
    preferredStockSheets: ['2750x1830', '2440x1220'],
    preferredMaterials: []
  },
  display: {
    unitSystem: 'metric',
    dateFormat: 'DD/MM/YYYY',
    theme: 'light',
    showPartIds: true
  },
  export: {
    defaultDriveFolder: '',
    includeHeadersInCSV: true,
    autoSaveInterval: 30
  },
  integrations: {
    notionWorkspaceId: '',
    katanaApiKey: ''
  }
};

export const useSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Load settings on mount and user change
  useEffect(() => {
    loadSettings();
  }, [user]);
  
  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    
    // First, try to load from localStorage
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSettings(mergeSettings(DEFAULT_SETTINGS, parsed));
      } catch (e) {
        console.warn('Failed to parse cached settings:', e);
      }
    }
    
    // If user is logged in, sync from Firestore
    if (user) {
      try {
        const docRef = doc(db, COLLECTION, user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const firestoreSettings = docSnap.data();
          const merged = mergeSettings(DEFAULT_SETTINGS, firestoreSettings);
          setSettings(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      } catch (err) {
        console.error('Failed to load settings from Firestore:', err);
        setError('Failed to sync settings');
      }
    }
    
    setLoading(false);
  };
  
  // Deep merge settings with defaults
  const mergeSettings = (defaults, overrides) => {
    const result = { ...defaults };
    for (const key in overrides) {
      if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && overrides[key] !== null) {
        result[key] = mergeSettings(defaults[key] || {}, overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
    return result;
  };
  
  const updateSettings = useCallback(async (newSettings) => {
    setSaving(true);
    setError(null);
    
    try {
      const merged = mergeSettings(settings, newSettings);
      setSettings(merged);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      
      // Sync to Firestore if user is logged in
      if (user) {
        const docRef = doc(db, COLLECTION, user.uid);
        await setDoc(docRef, { 
          ...merged, 
          updatedAt: new Date() 
        }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [user, settings]);
  
  const updateSection = useCallback(async (section, values) => {
    await updateSettings({ [section]: values });
  }, [updateSettings]);
  
  const resetToDefaults = useCallback(async () => {
    await updateSettings(DEFAULT_SETTINGS);
  }, [updateSettings]);
  
  const getSetting = useCallback((path) => {
    const parts = path.split('.');
    let value = settings;
    for (const part of parts) {
      value = value?.[part];
    }
    return value;
  }, [settings]);
  
  return {
    settings,
    loading,
    saving,
    error,
    updateSettings,
    updateSection,
    resetToDefaults,
    getSetting,
    DEFAULT_SETTINGS
  };
};

export default useSettings;
