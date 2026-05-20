/**
 * Configuration Service
 * Handles persistent storage of user settings in localStorage
 */

const CONFIG_KEY = 'cutlist-processor-config';

const defaultConfig = {
  stockSheets: [
    { id: 1, material: 'Blockboard Light Brown', width: 1220, height: 2440, thickness: 18 },
    { id: 2, material: 'Blockboard Ordinary', width: 1220, height: 2440, thickness: 18 },
    { id: 3, material: 'PG Bison White', width: 1830, height: 2750, thickness: 18 },
    { id: 4, material: 'PG Bison Backer', width: 1830, height: 2750, thickness: 3 },
    { id: 5, material: 'Plywood', width: 1220, height: 2440, thickness: 18 },
    { id: 6, material: 'MDF', width: 1220, height: 2440, thickness: 18 },
    { id: 7, material: 'Chipboard', width: 1830, height: 2750, thickness: 16 },
    { id: 8, material: 'OSB', width: 1220, height: 2440, thickness: 18 },
  ],
  bladeKerf: 4, // mm
  edgeBanding: {
    thin: 0.4,  // mm
    thick: 2.0, // mm
  },
  defaultMaterial: 'Blockboard Light Brown',
  materialMapping: {
    'Generic 0180': 'Blockboard Light Brown',
    'OSB3': 'PG Bison White',
    'Blockboard': 'Blockboard Ordinary',
    'Generic 0031': 'PG Bison Backer',
    'Plywood': 'Plywood',
  },
  millingConfig: {
    rawMaterialThickness: 60,
    intermediateMaterialThickness: 50,
    defectYield: 0.85,
  },
  outputPreferences: {
    includePGBison: true,
    includeCutlistOpt: true,
    includeKatanaBOM: true,
    includeTimberBOM: true,
    autoSaveToDrive: false,
  }
};

/**
 * Load configuration from localStorage
 * @returns {Object} Configuration object
 */
export const loadConfig = () => {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all keys exist
      return {
        ...defaultConfig,
        ...parsed,
        stockSheets: parsed.stockSheets || defaultConfig.stockSheets,
        edgeBanding: { ...defaultConfig.edgeBanding, ...parsed.edgeBanding },
        materialMapping: { ...defaultConfig.materialMapping, ...parsed.materialMapping },
        millingConfig: { ...defaultConfig.millingConfig, ...parsed.millingConfig },
        outputPreferences: { ...defaultConfig.outputPreferences, ...parsed.outputPreferences },
      };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return { ...defaultConfig };
};

/**
 * Save configuration to localStorage
 * @param {Object} config - Configuration object to save
 * @returns {boolean} Success status
 */
export const saveConfig = (config) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Failed to save config:', e);
    return false;
  }
};

/**
 * Reset configuration to defaults
 * @returns {Object} Default configuration
 */
export const resetConfig = () => {
  localStorage.removeItem(CONFIG_KEY);
  return { ...defaultConfig };
};

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
export const getDefaultConfig = () => {
  return { ...defaultConfig };
};

/**
 * Update a specific stock sheet
 * @param {Object} config - Current configuration
 * @param {number} sheetId - ID of sheet to update
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated configuration
 */
export const updateStockSheet = (config, sheetId, updates) => {
  const newConfig = { ...config };
  const index = newConfig.stockSheets.findIndex(s => s.id === sheetId);
  if (index >= 0) {
    newConfig.stockSheets = [...newConfig.stockSheets];
    newConfig.stockSheets[index] = { ...newConfig.stockSheets[index], ...updates };
  }
  return newConfig;
};

/**
 * Add a new stock sheet
 * @param {Object} config - Current configuration
 * @param {Object} sheet - Sheet to add
 * @returns {Object} Updated configuration
 */
export const addStockSheet = (config, sheet) => {
  const newId = Math.max(...config.stockSheets.map(s => s.id), 0) + 1;
  return {
    ...config,
    stockSheets: [...config.stockSheets, { ...sheet, id: newId }]
  };
};

/**
 * Remove a stock sheet
 * @param {Object} config - Current configuration
 * @param {number} sheetId - ID of sheet to remove
 * @returns {Object} Updated configuration
 */
export const removeStockSheet = (config, sheetId) => {
  return {
    ...config,
    stockSheets: config.stockSheets.filter(s => s.id !== sheetId)
  };
};

/**
 * Update material mapping
 * @param {Object} config - Current configuration
 * @param {string} source - Source material name
 * @param {string} target - Target material name
 * @returns {Object} Updated configuration
 */
export const updateMaterialMapping = (config, source, target) => {
  return {
    ...config,
    materialMapping: {
      ...config.materialMapping,
      [source]: target
    }
  };
};

/**
 * Remove material mapping
 * @param {Object} config - Current configuration
 * @param {string} source - Source material name to remove
 * @returns {Object} Updated configuration
 */
export const removeMaterialMapping = (config, source) => {
  const newMapping = { ...config.materialMapping };
  delete newMapping[source];
  return {
    ...config,
    materialMapping: newMapping
  };
};

// ==================== OFFCUT MANAGEMENT ====================

const OFFCUTS_KEY = 'cutlist-processor-offcuts';

/**
 * Load offcuts from localStorage
 * @returns {Array} Array of offcut objects
 */
export const loadOffcuts = () => {
  try {
    const saved = localStorage.getItem(OFFCUTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load offcuts:', e);
    return [];
  }
};

/**
 * Save offcuts to localStorage
 * @param {Array} offcuts - Array of offcut objects
 * @returns {boolean} Success status
 */
export const saveOffcuts = (offcuts) => {
  try {
    localStorage.setItem(OFFCUTS_KEY, JSON.stringify(offcuts));
    return true;
  } catch (e) {
    console.error('Failed to save offcuts:', e);
    return false;
  }
};

/**
 * Add a new offcut
 * @param {Array} offcuts - Current offcuts array
 * @param {Object} offcut - Offcut to add
 * @returns {Array} Updated offcuts array
 */
export const addOffcut = (offcuts, offcut) => {
  const newId = `offcut-${Date.now()}`;
  return [...offcuts, {
    id: newId,
    ...offcut,
    addedDate: new Date().toISOString(),
    available: true,
    usedInProject: null,
    usedDate: null
  }];
};

/**
 * Update an existing offcut
 * @param {Array} offcuts - Current offcuts array
 * @param {string} offcutId - ID of offcut to update
 * @param {Object} updates - Updates to apply
 * @returns {Array} Updated offcuts array
 */
export const updateOffcut = (offcuts, offcutId, updates) => {
  return offcuts.map(o => o.id === offcutId ? { ...o, ...updates } : o);
};

/**
 * Remove an offcut
 * @param {Array} offcuts - Current offcuts array
 * @param {string} offcutId - ID of offcut to remove
 * @returns {Array} Updated offcuts array
 */
export const removeOffcut = (offcuts, offcutId) => {
  return offcuts.filter(o => o.id !== offcutId);
};

/**
 * Mark an offcut as used
 * @param {Array} offcuts - Current offcuts array
 * @param {string} offcutId - ID of offcut to mark
 * @param {string} projectCode - Project code where it was used
 * @returns {Array} Updated offcuts array
 */
export const markOffcutUsed = (offcuts, offcutId, projectCode) => {
  return offcuts.map(o => o.id === offcutId ? {
    ...o,
    available: false,
    usedInProject: projectCode,
    usedDate: new Date().toISOString()
  } : o);
};

/**
 * Mark an offcut as available again
 * @param {Array} offcuts - Current offcuts array
 * @param {string} offcutId - ID of offcut to restore
 * @returns {Array} Updated offcuts array
 */
export const markOffcutAvailable = (offcuts, offcutId) => {
  return offcuts.map(o => o.id === offcutId ? {
    ...o,
    available: true,
    usedInProject: null,
    usedDate: null
  } : o);
};

export default {
  loadConfig,
  saveConfig,
  resetConfig,
  getDefaultConfig,
  updateStockSheet,
  addStockSheet,
  removeStockSheet,
  updateMaterialMapping,
  removeMaterialMapping,
  loadOffcuts,
  saveOffcuts,
  addOffcut,
  updateOffcut,
  removeOffcut,
  markOffcutUsed,
  markOffcutAvailable,
};
