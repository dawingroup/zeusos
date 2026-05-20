/**
 * Material Classification Utilities
 * Distinguishes between sheet materials and lumber materials
 * for conditional Timber BOM generation
 */

const SHEET_MATERIALS = [
  'plywood', 'mdf', 'blockboard', 'melamine', 'chipboard',
  'osb', 'particle board', 'laminate', 'veneer', 'melawood',
  'supawood', 'novopan', 'pb ', 'particle', 'fibreboard',
  'generic', 'board', 'panel', 'sheet'
];

const LUMBER_MATERIALS = [
  'hardwood', 'softwood', 'oak', 'walnut', 'mahogany',
  'pine', 'cedar', 'spruce', 'meranti', 'kiaat',
  'teak', 'ash', 'beech', 'birch', 'cherry',
  'maple', 'timber', 'lumber', 'solid wood'
];

/**
 * Check if a material is a sheet material (plywood, MDF, etc.)
 * @param {string} materialName - The material name to check
 * @returns {boolean} - True if sheet material, false otherwise
 */
export const isSheetMaterial = (materialName) => {
  if (!materialName) return true; // Default to sheet if unknown
  const normalized = materialName.toLowerCase().trim();
  
  // First check if it explicitly matches lumber patterns
  if (LUMBER_MATERIALS.some(lumber => normalized.includes(lumber))) {
    return false;
  }
  
  // Then check if it matches sheet patterns
  return SHEET_MATERIALS.some(sheet => normalized.includes(sheet));
};

/**
 * Check if a material requires Timber BOM processing
 * @param {string} materialName - The material name to check
 * @returns {boolean} - True if lumber material requiring Timber BOM
 */
export const requiresTimberBOM = (materialName) => {
  return !isSheetMaterial(materialName);
};

/**
 * Analyze an array of panels and determine material types
 * @param {Array} panels - Array of panel objects with material property
 * @returns {Object} - Analysis results
 */
export const analyzeMaterials = (panels) => {
  if (!panels || panels.length === 0) {
    return {
      hasSheetMaterials: false,
      hasLumberMaterials: false,
      sheetPanels: [],
      lumberPanels: [],
      uniqueMaterials: [],
      timberBOMApplicable: false
    };
  }

  const sheetPanels = [];
  const lumberPanels = [];
  const uniqueMaterials = new Set();

  panels.forEach(panel => {
    const material = panel.material || 'Unknown';
    uniqueMaterials.add(material);
    
    if (isSheetMaterial(material)) {
      sheetPanels.push(panel);
    } else {
      lumberPanels.push(panel);
    }
  });

  return {
    hasSheetMaterials: sheetPanels.length > 0,
    hasLumberMaterials: lumberPanels.length > 0,
    sheetPanels,
    lumberPanels,
    uniqueMaterials: Array.from(uniqueMaterials),
    timberBOMApplicable: lumberPanels.length > 0
  };
};

/**
 * Get a human-readable description of material types in the data
 * @param {Array} panels - Array of panel objects
 * @returns {string} - Description of material types
 */
export const getMaterialSummary = (panels) => {
  const analysis = analyzeMaterials(panels);
  
  if (!analysis.hasSheetMaterials && !analysis.hasLumberMaterials) {
    return 'No materials detected';
  }
  
  if (analysis.hasSheetMaterials && !analysis.hasLumberMaterials) {
    return 'Sheet materials only - Timber BOM not applicable';
  }
  
  if (!analysis.hasSheetMaterials && analysis.hasLumberMaterials) {
    return 'Lumber materials only - Timber BOM required';
  }
  
  return `Mixed materials: ${analysis.lumberPanels.length} lumber panels, ${analysis.sheetPanels.length} sheet panels`;
};
