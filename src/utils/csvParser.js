/**
 * CSV Parser Utilities for Cutlist Processor
 * Includes multi-part label processing per ISO 9001:2015 Clause 8.5.2
 */

/**
 * Parse a CSV line handling quoted fields with commas
 * @param {string} line - CSV line
 * @returns {Array} Array of field values
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Don't forget the last field
  result.push(current.trim());
  
  return result;
};

/**
 * Expand rows with comma-separated labels into individual rows
 * Following ISO 9001:2015 Clause 8.5.2 - unique identification per part
 * 
 * @param {Array} rows - Parsed CSV rows
 * @returns {Array} Expanded rows with unique part IDs
 */
export const expandMultiPartLabels = (rows) => {
  const expanded = [];
  
  rows.forEach((row, rowIndex) => {
    // Detect comma-separated labels
    const labels = row.label?.split(/,\s*/).map(l => l.trim()).filter(Boolean) || [row.label];
    
    if (labels.length === 1) {
      // Single label - pass through with metadata
      expanded.push({
        ...row,
        _originalIndex: rowIndex,
        _isSplit: false
      });
    } else {
      // Multiple labels - create separate entries
      labels.forEach((label, labelIndex) => {
        expanded.push({
          ...row,
          label: label,
          partId: generatePartId(row.cabinet, label, labelIndex + 1),
          _originalIndex: rowIndex,
          _isSplit: true,
          _splitFrom: row.label,
          _splitCount: labels.length,
          _splitIndex: labelIndex + 1
        });
      });
    }
  });
  
  return expanded;
};

/**
 * Generate unique part identifier
 * Format: {Cabinet}_{Label}_{Index}
 */
const generatePartId = (cabinet, label, index) => {
  const sanitizedCabinet = (cabinet || 'PART').replace(/\s+/g, '-').toUpperCase();
  const sanitizedLabel = label.replace(/\s+/g, '-').toUpperCase();
  return `${sanitizedCabinet}_${sanitizedLabel}_${String(index).padStart(2, '0')}`;
};

/**
 * Check if parts are identical (for grouping instead of splitting)
 * Parts are identical if they share ALL these properties
 */
export const arePartsIdentical = (parts) => {
  if (parts.length < 2) return false;
  
  const baseProps = [
    'material', 'thickness', 'length', 'width', 'grain', 
    'topEdge', 'rightEdge', 'bottomEdge', 'leftEdge'
  ];
  
  const reference = parts[0];
  return parts.every(part => 
    baseProps.every(prop => part[prop] === reference[prop])
  );
};

/**
 * Group identical parts instead of splitting
 * Returns single entry with combined quantity
 */
export const groupIdenticalParts = (parts, originalLabel) => {
  if (!arePartsIdentical(parts)) return null;
  
  // Extract base label (remove numeric suffixes)
  const baseLabel = originalLabel.split(',')[0].replace(/_?\d+$/, '').trim();
  
  return {
    ...parts[0],
    label: `${baseLabel} × ${parts.length}`,
    quantity: parts.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0),
    _isGrouped: true,
    _groupCount: parts.length,
    _originalLabels: originalLabel
  };
};

/**
 * Normalize edge value from various CSV formats
 * @param {string} value - Raw edge value
 * @returns {string|null} Normalized edge value
 */
const normalizeEdgeValue = (value) => {
  if (!value || value === '' || value === '0' || value === 'null' || value === 'none') {
    return null;
  }
  const v = value.toString().toLowerCase().trim();
  if (v === '2' || v === '2.0' || v === 'thick') return '2.0';
  if (v === '0.4' || v === 'thin') return '0.4';
  return value; // Custom thickness
};

/**
 * Parse CSV content with multi-part label support
 * @param {string} text - Raw CSV text
 * @param {Object} options - Parsing options
 * @returns {Object} Parsed data with stats
 */
export const parseCSV = (text, options = {}) => {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return { rows: [], stats: { totalRows: 0, splitRows: 0, groupedRows: 0 } };

  // Parse header line with proper CSV handling
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').toLowerCase());
  const rawRows = [];

  // Map common CSV header variations to expected field names
  const headerMap = {
    'cabinet': 'cabinet',
    'label': 'label',
    'name': 'label',
    'component': 'label',
    'material': 'material',
    'thickness': 'thickness',
    'thk': 'thickness',
    't': 'thickness',
    'quantity': 'quantity',
    'qty': 'quantity',
    'q': 'quantity',
    'length': 'length',
    'l': 'length',
    'width': 'width',
    'w': 'width',
    'grain': 'grain',
    'grain direction': 'grain',
    'graindirection': 'grain',
    'topedge': 'topEdge',
    'top edge': 'topEdge',
    'rightedge': 'rightEdge',
    'right edge': 'rightEdge',
    'bottomedge': 'bottomEdge',
    'bottom edge': 'bottomEdge',
    'leftedge': 'leftEdge',
    'left edge': 'leftEdge'
  };

  for (let i = 1; i < lines.length; i++) {
    // Use proper CSV parsing to handle quoted fields with commas
    const values = parseCSVLine(lines[i]).map(v => v.replace(/"/g, ''));
    
    if (values.length >= headers.length && values.some(v => v !== '')) {
      const row = {
        cabinet: '',
        label: '',
        material: '',
        thickness: 18,
        quantity: 1,
        length: 0,
        width: 0,
        grain: 0,
        topEdge: '',
        rightEdge: '',
        bottomEdge: '',
        leftEdge: ''
      };

      headers.forEach((header, index) => {
        const mappedField = headerMap[header] || header;
        const value = values[index];

        if (mappedField in row) {
          // Convert numeric fields
          if (['thickness', 'quantity', 'length', 'width', 'grain'].includes(mappedField)) {
            const numValue = parseFloat(value);
            row[mappedField] = isNaN(numValue) ? row[mappedField] : numValue;
          } else {
            // String fields
            row[mappedField] = value || row[mappedField];
          }
        }
      });

      // Ensure required fields have values
      if (row.label && row.material && row.length > 0 && row.width > 0) {
        // Add normalized edges object for PDF rendering
        row.edges = {
          top: normalizeEdgeValue(row.topEdge),
          bottom: normalizeEdgeValue(row.bottomEdge),
          left: normalizeEdgeValue(row.leftEdge),
          right: normalizeEdgeValue(row.rightEdge)
        };
        rawRows.push(row);
      }
    }
  }

  let processedRows = rawRows;
  
  // Step 1: Expand multi-part labels
  if (options.expandMultiPart !== false) {
    processedRows = expandMultiPartLabels(processedRows);
  }
  
  // Step 2: Optionally group identical parts back together
  if (options.groupIdentical) {
    const processedWithGrouping = [];
    const processedOriginalIndices = new Set();
    
    processedRows.forEach(row => {
      if (row._isSplit && !processedOriginalIndices.has(row._originalIndex)) {
        const siblings = processedRows.filter(r => 
          r._originalIndex === row._originalIndex && r._isSplit
        );
        const grouped = groupIdenticalParts(siblings, row._splitFrom);
        if (grouped) {
          processedWithGrouping.push(grouped);
          processedOriginalIndices.add(row._originalIndex);
        } else {
          // Parts are not identical, keep them separate
          siblings.forEach(s => processedWithGrouping.push(s));
          processedOriginalIndices.add(row._originalIndex);
        }
      } else if (!row._isSplit) {
        processedWithGrouping.push(row);
      }
    });
    
    processedRows = processedWithGrouping;
  }
  
  return {
    rows: processedRows,
    stats: {
      totalRows: processedRows.length,
      originalRows: rawRows.length,
      splitRows: processedRows.filter(r => r._isSplit).length,
      groupedRows: processedRows.filter(r => r._isGrouped).length
    }
  };
};

/**
 * Extract unique materials from parsed rows
 * @param {Array} rows - Parsed CSV rows
 * @returns {Array} Unique material names
 */
export const extractUniqueMaterials = (rows) => {
  return [...new Set(rows.map(r => r.material).filter(Boolean))];
};

// normalizeEdgeValue is defined above parseCSV and exported here for external use
export { normalizeEdgeValue };

/**
 * Process edge banding data for a panel
 * Calculates edge statistics and PG Bison format summary
 * @param {Object} row - Panel row data
 * @returns {Object} Row with edge statistics
 */
export const processEdgeData = (row) => {
  const edges = {
    top: normalizeEdgeValue(row.topEdge),
    bottom: normalizeEdgeValue(row.bottomEdge),
    left: normalizeEdgeValue(row.leftEdge),
    right: normalizeEdgeValue(row.rightEdge)
  };
  
  const length = parseFloat(row.length) || 0;
  const width = parseFloat(row.width) || 0;
  
  // Calculate edge statistics
  // Length edges = Top + Bottom (horizontal edges along the length)
  // Width edges = Left + Right (vertical edges along the width)
  const lengthEdgeCount = (edges.top ? 1 : 0) + (edges.bottom ? 1 : 0);
  const widthEdgeCount = (edges.left ? 1 : 0) + (edges.right ? 1 : 0);
  
  // Total linear mm of edge banding needed
  let totalEdgeLength = 0;
  if (edges.top) totalEdgeLength += length;
  if (edges.bottom) totalEdgeLength += length;
  if (edges.left) totalEdgeLength += width;
  if (edges.right) totalEdgeLength += width;
  
  // PG Bison summary format: "2L 1W" or "-"
  const parts = [];
  if (lengthEdgeCount > 0) parts.push(`${lengthEdgeCount}L`);
  if (widthEdgeCount > 0) parts.push(`${widthEdgeCount}W`);
  const edgeSummary = parts.length > 0 ? parts.join(' ') : '-';
  
  return {
    ...row,
    _edges: edges,
    _edgeStats: {
      lengthEdgeCount,
      widthEdgeCount,
      totalEdgeLength,  // in mm
      edgeSummary
    }
  };
};

/**
 * Calculate project-wide edge banding requirements
 * @param {Array} panels - Array of panels with edge data
 * @returns {Object} Edge banding totals by thickness
 */
export const calculateProjectEdgeTotals = (panels) => {
  const totals = {
    thick: { meters: 0, edges: 0 },  // 2.0mm
    thin: { meters: 0, edges: 0 }    // 0.4mm
  };
  
  panels.forEach(panel => {
    const edges = panel._edges || {};
    const length = parseFloat(panel.length) || 0;
    const width = parseFloat(panel.width) || 0;
    const qty = parseInt(panel.quantity) || 1;
    
    ['top', 'bottom'].forEach(pos => {
      if (edges[pos] === '2.0') {
        totals.thick.meters += (length / 1000) * qty;
        totals.thick.edges += qty;
      } else if (edges[pos] === '0.4') {
        totals.thin.meters += (length / 1000) * qty;
        totals.thin.edges += qty;
      }
    });
    
    ['left', 'right'].forEach(pos => {
      if (edges[pos] === '2.0') {
        totals.thick.meters += (width / 1000) * qty;
        totals.thick.edges += qty;
      } else if (edges[pos] === '0.4') {
        totals.thin.meters += (width / 1000) * qty;
        totals.thin.edges += qty;
      }
    });
  });
  
  totals.total = {
    meters: totals.thick.meters + totals.thin.meters,
    edges: totals.thick.edges + totals.thin.edges
  };
  
  return totals;
};

/**
 * Material patterns for grain detection
 */
const GRAIN_MATERIALS = /veneer|wood|oak|walnut|maple|cherry|ash|birch|pine|teak|mahogany|timber|woodgrain/i;
const NO_GRAIN_MATERIALS = /painted|solid\s*colou?r|plain|white|black|grey|gray|lacquer|mdf.*paint|melamine/i;

/**
 * Detect if material has visible grain
 * @param {string} materialName - Material name from CSV
 * @param {boolean|null} explicitHasGrain - Override from material database
 * @returns {boolean} Whether material has grain
 */
export const materialHasGrain = (materialName, explicitHasGrain = null) => {
  if (explicitHasGrain !== null) return explicitHasGrain;
  if (NO_GRAIN_MATERIALS.test(materialName)) return false;
  if (GRAIN_MATERIALS.test(materialName)) return true;
  return true; // Default: assume grain (safer for wood industry)
};

/**
 * Get grain display for panel
 * @param {Object} panel - Panel with grain and material
 * @returns {{ icon: string, label: string }} Grain display info
 */
export const getGrainDisplay = (panel) => {
  const hasGrain = materialHasGrain(panel.material);
  
  if (!hasGrain) {
    return { icon: '—', label: 'None' };
  }
  
  const direction = (panel.grain || '').toString().toLowerCase().trim();
  
  // Vertical grain (along length)
  if (['v', 'vertical', '0', 'length', '1', ''].includes(direction) || panel.grain === 1 || panel.grain === 0) {
    // grain === 1 typically means vertical in the app
    if (panel.grain === 1) {
      return { icon: '↕', label: 'Vertical' };
    }
    // grain === 0 typically means horizontal
    if (panel.grain === 0) {
      return { icon: '↔', label: 'Horizontal' };
    }
    return { icon: '↕', label: 'Vertical' };
  }
  
  // Horizontal grain (along width)
  if (['h', 'horizontal', '90', 'width'].includes(direction)) {
    return { icon: '↔', label: 'Horizontal' };
  }
  
  return { icon: '↕', label: 'Vertical' }; // Default
};

export default parseCSV;
