import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  loadOffcuts, 
  saveOffcuts, 
  addOffcut as addOffcutService,
  updateOffcut as updateOffcutService,
  removeOffcut as removeOffcutService,
  markOffcutUsed as markOffcutUsedService,
  markOffcutAvailable as markOffcutAvailableService
} from '../services/configService';

const OffcutContext = createContext();

export const OffcutProvider = ({ children }) => {
  const [offcuts, setOffcuts] = useState(() => loadOffcuts());

  // Auto-save offcuts when they change
  useEffect(() => {
    saveOffcuts(offcuts);
  }, [offcuts]);

  // Get available offcuts only
  const availableOffcuts = offcuts.filter(o => o.available);

  // Get used offcuts only
  const usedOffcuts = offcuts.filter(o => !o.available);

  // Add a new offcut
  const addOffcut = useCallback((offcut) => {
    setOffcuts(prev => addOffcutService(prev, offcut));
  }, []);

  // Update an offcut
  const updateOffcut = useCallback((offcutId, updates) => {
    setOffcuts(prev => updateOffcutService(prev, offcutId, updates));
  }, []);

  // Remove an offcut
  const removeOffcut = useCallback((offcutId) => {
    setOffcuts(prev => removeOffcutService(prev, offcutId));
  }, []);

  // Mark offcut as used
  const markAsUsed = useCallback((offcutId, projectCode) => {
    setOffcuts(prev => markOffcutUsedService(prev, offcutId, projectCode));
  }, []);

  // Mark offcut as available again
  const markAsAvailable = useCallback((offcutId) => {
    setOffcuts(prev => markOffcutAvailableService(prev, offcutId));
  }, []);

  // Get offcuts by material
  const getOffcutsByMaterial = useCallback((material) => {
    return availableOffcuts.filter(o => 
      o.material.toLowerCase() === material?.toLowerCase()
    );
  }, [availableOffcuts]);

  // Clear all offcuts
  const clearAllOffcuts = useCallback(() => {
    setOffcuts([]);
  }, []);

  const value = useMemo(() => ({
    offcuts,
    availableOffcuts,
    usedOffcuts,
    addOffcut,
    updateOffcut,
    removeOffcut,
    markAsUsed,
    markAsAvailable,
    getOffcutsByMaterial,
    clearAllOffcuts,
    offcutCount: offcuts.length,
    availableCount: availableOffcuts.length,
  }), [
    offcuts,
    availableOffcuts,
    usedOffcuts,
    addOffcut,
    updateOffcut,
    removeOffcut,
    markAsUsed,
    markAsAvailable,
    getOffcutsByMaterial,
    clearAllOffcuts,
  ]);

  return (
    <OffcutContext.Provider value={value}>
      {children}
    </OffcutContext.Provider>
  );
};

export const useOffcuts = () => {
  const context = useContext(OffcutContext);
  if (!context) {
    throw new Error('useOffcuts must be used within an OffcutProvider');
  }
  return context;
};

export default OffcutContext;
