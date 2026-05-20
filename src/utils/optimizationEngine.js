/**
 * Cutting Optimization Engine
 * Guillotine bin-packing algorithm for cutting optimization
 * Prioritizes: Grain direction matching, minimal waste, fewer cuts
 */

/**
 * Group panels by material and thickness
 * @param {Array} panels - Array of panel objects
 * @returns {Object} Grouped panels by "material|thickness" key
 */
export const groupByMaterialAndThickness = (panels) => {
  const groups = {};
  
  panels.forEach(panel => {
    const key = `${panel.material || 'Unknown'}|${panel.thickness || 18}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    // Expand by quantity
    for (let i = 0; i < (panel.quantity || 1); i++) {
      groups[key].push({
        ...panel,
        originalQuantity: panel.quantity,
        instanceIndex: i
      });
    }
  });
  
  return groups;
};

/**
 * Find matching stock sheet for material
 * @param {Object} stockSheets - Stock sheets configuration
 * @param {string} material - Material name
 * @param {number} thickness - Thickness in mm
 * @returns {Object|null} Matching stock sheet or null
 */
export const findMatchingStock = (stockSheets, material, thickness) => {
  // Try exact match first
  if (stockSheets[material]) {
    return { material, ...stockSheets[material] };
  }
  
  // Try partial match
  const materialLower = material.toLowerCase();
  for (const [key, value] of Object.entries(stockSheets)) {
    if (materialLower.includes(key.toLowerCase()) || key.toLowerCase().includes(materialLower)) {
      return { material: key, ...value };
    }
  }
  
  // Return default
  return stockSheets.default ? { material: 'Default', ...stockSheets.default } : null;
};

/**
 * Check if a panel fits in a free rectangle
 * @param {Object} panel - Panel to place
 * @param {Object} rect - Free rectangle
 * @param {boolean} rotate - Whether to rotate the panel
 * @returns {boolean} True if panel fits
 */
const panelFits = (panel, rect, rotate = false) => {
  const panelWidth = rotate ? panel.length : panel.width;
  const panelHeight = rotate ? panel.width : panel.length;
  return panelWidth <= rect.width && panelHeight <= rect.height;
};

/**
 * Guillotine split - split a rectangle after placing a panel
 * @param {Object} rect - Rectangle to split
 * @param {number} panelWidth - Width of placed panel
 * @param {number} panelHeight - Height of placed panel
 * @param {number} kerf - Blade kerf
 * @returns {Array} Array of new free rectangles
 */
const guillotineSplit = (rect, panelWidth, panelHeight, kerf) => {
  const newRects = [];
  
  // Right remainder
  const rightWidth = rect.width - panelWidth - kerf;
  if (rightWidth > 50) { // Minimum usable size
    newRects.push({
      x: rect.x + panelWidth + kerf,
      y: rect.y,
      width: rightWidth,
      height: panelHeight
    });
  }
  
  // Top remainder
  const topHeight = rect.height - panelHeight - kerf;
  if (topHeight > 50) { // Minimum usable size
    newRects.push({
      x: rect.x,
      y: rect.y + panelHeight + kerf,
      width: rect.width,
      height: topHeight
    });
  }
  
  return newRects;
};

/**
 * Find best position for a panel using Best Short Side Fit
 * @param {Object} panel - Panel to place
 * @param {Array} freeRects - Available free rectangles
 * @returns {Object|null} Best placement or null
 */
const findBestPosition = (panel, freeRects) => {
  let bestScore = Infinity;
  let bestRect = null;
  let bestRotated = false;
  let bestIndex = -1;
  
  for (let i = 0; i < freeRects.length; i++) {
    const rect = freeRects[i];
    
    // Try without rotation
    if (panelFits(panel, rect, false)) {
      const leftover = Math.min(
        rect.width - panel.width,
        rect.height - panel.length
      );
      if (leftover < bestScore) {
        bestScore = leftover;
        bestRect = rect;
        bestRotated = false;
        bestIndex = i;
      }
    }
    
    // Try with rotation (if grain allows)
    if (panel.grain !== 1 && panelFits(panel, rect, true)) {
      const leftover = Math.min(
        rect.width - panel.length,
        rect.height - panel.width
      );
      if (leftover < bestScore) {
        bestScore = leftover;
        bestRect = rect;
        bestRotated = true;
        bestIndex = i;
      }
    }
  }
  
  if (bestRect) {
    return { rect: bestRect, rotated: bestRotated, index: bestIndex };
  }
  return null;
};

/**
 * Pack panels onto a single sheet using guillotine algorithm
 * @param {Array} panels - Panels to pack (sorted by area, largest first)
 * @param {Object} stockSheet - Stock sheet dimensions
 * @param {number} kerf - Blade kerf
 * @returns {Object} Packing result
 */
const packSingleSheet = (panels, stockSheet, kerf) => {
  const placements = [];
  const remaining = [];
  const cuts = [];
  let usedArea = 0;
  
  // Stock sheets use length x width format (length is the longer dimension)
  // For packing, we use width (horizontal) and height (vertical)
  const sheetWidth = stockSheet.length || stockSheet.width || 2440;
  const sheetHeight = stockSheet.width || stockSheet.height || 1220;
  
  // Initialize free rectangles with full sheet
  let freeRects = [{
    x: 0,
    y: 0,
    width: sheetWidth,
    height: sheetHeight
  }];
  
  for (const panel of panels) {
    const position = findBestPosition(panel, freeRects);
    
    if (position) {
      const { rect, rotated, index } = position;
      const placedWidth = rotated ? panel.length : panel.width;
      const placedHeight = rotated ? panel.width : panel.length;
      
      // Add placement
      placements.push({
        panel,
        x: rect.x,
        y: rect.y,
        width: placedWidth,
        height: placedHeight,
        rotated,
        label: panel.label || `Panel ${placements.length + 1}`
      });
      
      usedArea += placedWidth * placedHeight;
      
      // Add cut lines
      cuts.push({
        type: 'horizontal',
        x1: rect.x,
        y1: rect.y + placedHeight,
        x2: rect.x + placedWidth,
        y2: rect.y + placedHeight
      });
      cuts.push({
        type: 'vertical',
        x1: rect.x + placedWidth,
        y1: rect.y,
        x2: rect.x + placedWidth,
        y2: rect.y + placedHeight
      });
      
      // Remove used rectangle and add new ones
      freeRects.splice(index, 1);
      const newRects = guillotineSplit(rect, placedWidth, placedHeight, kerf);
      freeRects.push(...newRects);
      
      // Sort free rects by area (smallest first for better packing)
      freeRects.sort((a, b) => (a.width * a.height) - (b.width * b.height));
    } else {
      remaining.push(panel);
    }
  }
  
  return {
    placements,
    remaining,
    cuts,
    usedArea,
    freeRects
  };
};

/**
 * Main optimization function
 * @param {Array} panels - Array of panel objects
 * @param {Object} stockSheets - Stock sheet configurations
 * @param {number} bladeKerf - Blade kerf in mm
 * @returns {Array} Array of sheet layouts
 */
export const optimizePanelLayout = (panels, stockSheets, bladeKerf = 4) => {
  if (!panels || panels.length === 0) {
    return [];
  }
  
  // Group panels by material and thickness
  const groupedPanels = groupByMaterialAndThickness(panels);
  const results = [];
  
  for (const [key, panelGroup] of Object.entries(groupedPanels)) {
    const [material, thickness] = key.split('|');
    const stockSheet = findMatchingStock(stockSheets, material, parseFloat(thickness));
    
    if (!stockSheet) {
      console.warn(`No stock sheet found for material: ${material}`);
      continue;
    }
    
    // Sort panels by area (largest first) - First Fit Decreasing
    const sortedPanels = [...panelGroup].sort((a, b) => 
      (b.length * b.width) - (a.length * a.width)
    );
    
    let remainingPanels = sortedPanels;
    let sheetIndex = 0;
    
    while (remainingPanels.length > 0) {
      const packResult = packSingleSheet(remainingPanels, stockSheet, bladeKerf);
      
      if (packResult.placements.length === 0) {
        // No panels could be placed - panels too large for sheet
        console.warn('Some panels are too large for the stock sheet');
        break;
      }
      
      // Stock sheets use length x width format (length is the longer dimension)
      const sheetWidth = stockSheet.length || stockSheet.width || 2440;
      const sheetHeight = stockSheet.width || stockSheet.height || 1220;
      const totalArea = sheetWidth * sheetHeight;
      
      results.push({
        id: `sheet-${results.length + 1}`,
        sheetNumber: results.length + 1,
        material,
        thickness: parseFloat(thickness),
        stockSheet: {
          ...stockSheet,
          length: sheetWidth,
          width: sheetHeight
        },
        width: sheetWidth,
        height: sheetHeight,
        placements: packResult.placements,
        cuts: packResult.cuts,
        usedArea: packResult.usedArea,
        wastedArea: totalArea - packResult.usedArea,
        utilization: (packResult.usedArea / totalArea) * 100,
        freeRects: packResult.freeRects
      });
      
      remainingPanels = packResult.remaining;
      sheetIndex++;
      
      // Safety limit
      if (sheetIndex > 100) {
        console.warn('Exceeded maximum sheet limit');
        break;
      }
    }
  }
  
  return results;
};

/**
 * Calculate optimization statistics
 * @param {Array} sheetLayouts - Array of sheet layout results
 * @returns {Object} Statistics summary
 */
export const calculateStatistics = (sheetLayouts) => {
  if (!sheetLayouts || sheetLayouts.length === 0) {
    return {
      totalSheets: 0,
      totalPanels: 0,
      totalUsedArea: 0,
      totalWastedArea: 0,
      averageUtilization: 0,
      totalCutLength: 0,
      sheetsByMaterial: {}
    };
  }
  
  let totalUsedArea = 0;
  let totalWastedArea = 0;
  let totalPanels = 0;
  let totalCutLength = 0;
  const sheetsByMaterial = {};
  
  sheetLayouts.forEach(sheet => {
    totalUsedArea += sheet.usedArea;
    totalWastedArea += sheet.wastedArea;
    totalPanels += sheet.placements.length;
    
    // Calculate cut length
    sheet.cuts.forEach(cut => {
      const length = cut.type === 'horizontal' 
        ? Math.abs(cut.x2 - cut.x1)
        : Math.abs(cut.y2 - cut.y1);
      totalCutLength += length;
    });
    
    // Count by material
    if (!sheetsByMaterial[sheet.material]) {
      sheetsByMaterial[sheet.material] = 0;
    }
    sheetsByMaterial[sheet.material]++;
  });
  
  const totalArea = totalUsedArea + totalWastedArea;
  
  return {
    totalSheets: sheetLayouts.length,
    totalPanels,
    totalUsedArea,
    totalWastedArea,
    averageUtilization: totalArea > 0 ? (totalUsedArea / totalArea) * 100 : 0,
    totalCutLength,
    sheetsByMaterial
  };
};

export default {
  optimizePanelLayout,
  calculateStatistics,
  groupByMaterialAndThickness,
  findMatchingStock
};
