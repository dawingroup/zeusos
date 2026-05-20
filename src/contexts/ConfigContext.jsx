import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { loadConfig, saveConfig, resetConfig, getDefaultConfig } from '../services/configService';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(() => loadConfig());
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-save config when it changes
  useEffect(() => {
    if (hasChanges) {
      saveConfig(config);
      setHasChanges(false);
    }
  }, [config, hasChanges]);

  // Update config and mark as changed
  const updateConfig = useCallback((updates) => {
    setConfig(prev => {
      if (typeof updates === 'function') {
        return updates(prev);
      }
      return { ...prev, ...updates };
    });
    setHasChanges(true);
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaults = resetConfig();
    setConfig(defaults);
    setHasChanges(false);
    return defaults;
  }, []);

  // Get stock sheet by material name
  const getStockSheet = useCallback((materialName) => {
    const sheet = config.stockSheets.find(
      s => s.material.toLowerCase() === materialName?.toLowerCase()
    );
    return sheet || config.stockSheets[0] || getDefaultConfig().stockSheets[0];
  }, [config.stockSheets]);

  // Get mapped material name
  const getMappedMaterial = useCallback((sourceMaterial) => {
    return config.materialMapping[sourceMaterial] || sourceMaterial;
  }, [config.materialMapping]);

  const value = useMemo(() => ({
    config,
    setConfig,
    updateConfig,
    resetToDefaults,
    getStockSheet,
    getMappedMaterial,
    // Convenience accessors
    stockSheets: config.stockSheets,
    bladeKerf: config.bladeKerf,
    edgeBanding: config.edgeBanding,
    materialMapping: config.materialMapping,
    millingConfig: config.millingConfig,
    outputPreferences: config.outputPreferences,
  }), [config, updateConfig, resetToDefaults, getStockSheet, getMappedMaterial]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

export default ConfigContext;
