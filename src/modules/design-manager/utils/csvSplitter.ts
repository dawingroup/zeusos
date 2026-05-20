/**
 * CSV Splitter Utility
 * Parses Polyboard Master CSV and groups rows by Cabinet_Code
 */

import type { Panel } from '@/shared/services/optimization';

// ============================================
// Types
// ============================================

export interface PolyboardRow {
  partId: string;
  label: string;
  cabinetCode: string;
  cabinetName?: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  quantity: number;
  grain: number;
  edgeTop?: string;
  edgeBottom?: string;
  edgeLeft?: string;
  edgeRight?: string;
  notes?: string;
}

export interface CabinetGroup {
  cabinetCode: string;
  cabinetName?: string;
  panels: Panel[];
  totalPanels: number;
  totalArea: number;
  materials: string[];
  isTimberSection?: boolean; // true when parsed from timber/bar section format
}

export interface SplitResult {
  groups: CabinetGroup[];
  totalRows: number;
  totalCabinets: number;
  parseErrors: string[];
  // Debug info for troubleshooting
  debugInfo?: {
    headers: string[];
    columnMapping: Record<string, number | undefined>;
    sampleRow?: string[];
    hasHeaderRow?: boolean;
  };
}

// ============================================
// Column Mapping
// ============================================

const COLUMN_MAPPINGS: Record<string, string[]> = {
  // Part identification
  partId: ['Part ID', 'PartID', 'Part_ID', 'ID', 'Part', 'N°', 'No', 'Num', 'Number', 'Référence', 'Reference', 'Ref'],
  label: ['Label', 'Name', 'Part Name', 'PartName', 'Description', 'Désignation', 'Designation', 'Component', 'Composant', 'Pièce', 'Piece'],
  
  // Cabinet grouping - expanded for Polyboard
  cabinetCode: ['Cabinet', 'Cabinet_Code', 'CabinetCode', 'Cabinet Code', 'Unit', 'Unit_Code', 'UnitCode', 
    'Meuble', 'Module', 'Assembly', 'Sub-Assembly', 'SubAssembly', 'Sub Assembly', 'Parent', 'Groupe', 'Group',
    'Élément', 'Element', 'Item', 'Code'],
  cabinetName: ['Cabinet Name', 'CabinetName', 'Cabinet_Name', 'Unit Name', 'UnitName', 'Nom Meuble', 'Nom du meuble', 'Module Name'],
  
  // Material - expanded for Polyboard French
  material: ['Material', 'Board', 'Material Name', 'MaterialName', 'Mat', 'Matériau', 'Materiau', 
    'Panneau', 'Panel', 'Sheet', 'Board Type', 'Décor', 'Decor', 'Texture', 'Finition', 'Finish'],
  
  // Dimensions - expanded for various units and French
  thickness: ['Thickness', 'Thk', 'T', 'Board Thickness', 'Épaisseur', 'Epaisseur', 'Ep', 'E', 'Depth', 'D'],
  length: ['Length', 'L', 'Len', 'Height', 'H', 'Longueur', 'Long', 'Hauteur'],
  width: ['Width', 'W', 'Wid', 'Largeur', 'Larg', 'Profondeur', 'Prof', 'P'],
  
  // Quantity
  quantity: ['Quantity', 'Qty', 'Q', 'Count', 'No.', 'Quantité', 'Quantite', 'Qté', 'Qte', 'Nb', 'Nombre', 'Pcs', 'Pieces'],
  
  // Grain direction
  grain: ['Grain', 'Grain Direction', 'GrainDir', 'Rotation', 'Fil', 'Sens du fil', 'Sens', 'Direction', 'Orientation'],
  
  // Edge banding - expanded for Polyboard format
  edgeTop: ['Edge Top', 'EdgeTop', 'Top Edge', 'Edge1', 'Chant 1', 'Chant1', 'C1', 'topEdge', 'Chant Haut', 'ChantHaut', 'AV1', 'E1'],
  edgeBottom: ['Edge Bottom', 'EdgeBottom', 'Bottom Edge', 'Edge2', 'Chant 2', 'Chant2', 'C2', 'bottomEdge', 'Chant Bas', 'ChantBas', 'AV2', 'E2'],
  edgeLeft: ['Edge Left', 'EdgeLeft', 'Left Edge', 'Edge3', 'Chant 3', 'Chant3', 'C3', 'leftEdge', 'Chant Gauche', 'ChantGauche', 'AV3', 'E3'],
  edgeRight: ['Edge Right', 'EdgeRight', 'Right Edge', 'Edge4', 'Chant 4', 'Chant4', 'C4', 'rightEdge', 'Chant Droit', 'ChantDroit', 'AV4', 'E4'],
  
  // Notes
  notes: ['Notes', 'Comments', 'Remarks', 'Remarques', 'Observation', 'Commentaires', 'Info'],
};

// ============================================
// CSV Parser
// ============================================

/**
 * Remove BOM (Byte Order Mark) from string
 */
function removeBOM(str: string): string {
  if (str.charCodeAt(0) === 0xFEFF) return str.slice(1);
  if (str.startsWith('\uFEFF') || str.startsWith('\xEF\xBB\xBF')) return str.slice(1);
  return str;
}

/**
 * Detect delimiter (comma, semicolon, or tab)
 */
function detectDelimiter(csvText: string): string {
  const firstLine = csvText.split(/[\r\n]/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Parse CSV text into rows
 */
function parseCSVText(csvText: string): string[][] {
  // Remove BOM if present
  const cleanedText = removeBOM(csvText.trim());
  
  // Detect delimiter
  const delimiter = detectDelimiter(cleanedText);
  
  const lines = cleanedText.split(/\r?\n/);
  const rows: string[][] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Handle quoted fields with delimiters inside
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        // Handle escaped quotes ("")
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }
  
  return rows;
}

/**
 * Find column index for a field using exact match first, then partial/contains match
 */
function findColumnIndex(headers: string[], fieldName: string): number {
  const possibleNames = COLUMN_MAPPINGS[fieldName] || [fieldName];
  const headersLower = headers.map(h => h.toLowerCase().trim().replace(/['"]/g, ''));
  
  // First try exact match
  for (const name of possibleNames) {
    const nameLower = name.toLowerCase();
    const index = headersLower.indexOf(nameLower);
    if (index !== -1) return index;
  }
  
  // Then try partial/contains match (header contains the expected name)
  for (const name of possibleNames) {
    const nameLower = name.toLowerCase();
    for (let i = 0; i < headersLower.length; i++) {
      if (headersLower[i].includes(nameLower) || nameLower.includes(headersLower[i])) {
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Parse a single row into PolyboardRow
 */
function parseRow(
  values: string[],
  columnMap: Record<string, number>,
  rowIndex: number
): { row: PolyboardRow | null; error: string | null } {
  try {
    const getValue = (field: string, defaultValue: string = ''): string => {
      const index = columnMap[field];
      if (index === undefined || index < 0) return defaultValue;
      return index < values.length ? values[index] : defaultValue;
    };
    
    const getNumericValue = (field: string, defaultValue: number): number => {
      const strValue = getValue(field);
      // Handle comma as decimal separator (European format)
      const normalized = strValue.replace(',', '.');
      const numValue = parseFloat(normalized);
      return isNaN(numValue) ? defaultValue : numValue;
    };

    // Get cabinet code, or use default if not found
    let cabinetCode = getValue('cabinetCode');
    if (!cabinetCode) {
      // Use label as cabinet code if available, otherwise use "Default"
      cabinetCode = getValue('label') || `Import-${rowIndex}`;
    }

    const row: PolyboardRow = {
      partId: getValue('partId', `part-${rowIndex}`),
      label: getValue('label', `Panel ${rowIndex}`),
      cabinetCode,
      cabinetName: getValue('cabinetName') || undefined,
      material: getValue('material', 'Unknown'),
      thickness: getNumericValue('thickness', 18),
      length: getNumericValue('length', 0),
      width: getNumericValue('width', 0),
      quantity: Math.max(1, Math.round(getNumericValue('quantity', 1))),
      grain: getNumericValue('grain', 0),
      edgeTop: getValue('edgeTop') || undefined,
      edgeBottom: getValue('edgeBottom') || undefined,
      edgeLeft: getValue('edgeLeft') || undefined,
      edgeRight: getValue('edgeRight') || undefined,
      notes: getValue('notes') || undefined,
    };

    // Validate dimensions - try to swap if one is 0 but other fields might be dimensions
    if (row.length <= 0 && row.width > 0) {
      // Try using width as length
      row.length = row.width;
      row.width = 18; // Default width
    }
    if (row.width <= 0 && row.length > 0) {
      row.width = row.length > 100 ? row.length / 2 : 100; // Reasonable default
    }
    
    // Still invalid? Skip with detailed warning
    if (row.length <= 0 || row.width <= 0) {
      // Show actual values from the row for debugging
      const rawValues = values.slice(0, 8).map((v, i) => `[${i}]=${v}`).join(', ');
      return { row: null, error: `Row ${rowIndex + 1}: Invalid dimensions (L=${row.length}, W=${row.width}). Raw: ${rawValues}` };
    }

    return { row, error: null };
  } catch (err) {
    return { row: null, error: `Row ${rowIndex + 1}: Parse error - ${err}` };
  }
}

/**
 * Convert PolyboardRow to Panel for optimization
 */
function rowToPanel(row: PolyboardRow): Panel {
  return {
    id: row.partId,
    label: row.label,
    cabinet: row.cabinetCode,
    material: row.material,
    thickness: row.thickness,
    length: row.length,
    width: row.width,
    quantity: row.quantity,
    grain: row.grain,
  };
}

/**
 * Detect timber section format (no header, 6 cols, length-first):
 * Length, Qty, Material, Thickness, Width, Label
 * e.g. "664,1,Timber Door Style,45,140,Door 1_UCB"
 *
 * Distinguished from standard Polyboard panel positional format
 * (Cabinet,Label,Material,Thickness,Qty,Length,Width,...) by col[0] being
 * numeric (length value) rather than text (cabinet name).
 */
function isTimberSectionFormat(rows: string[][]): boolean {
  const sampleRows = rows.slice(0, Math.min(5, rows.length));
  if (sampleRows.length === 0) return false;

  const avgCols = sampleRows.reduce((sum, r) => sum + r.length, 0) / sampleRows.length;
  if (avgCols > 6.5) return false;

  return sampleRows.every((row) => {
    const col0 = row[0]?.trim() || '';
    const col1 = row[1]?.trim() || '';
    const col3 = row[3]?.trim() || '';
    const col4 = row[4]?.trim() || '';
    const col5 = row[5]?.trim() || '';
    return (
      /^\d+(\.\d+)?$/.test(col0) &&  // col0 = numeric length
      /^\d+(\.\d+)?$/.test(col1) &&  // col1 = numeric qty
      /^\d+(\.\d+)?$/.test(col3) &&  // col3 = numeric thickness
      /^\d+(\.\d+)?$/.test(col4) &&  // col4 = numeric width
      col5.length > 0 && !/^\d+(\.\d+)?$/.test(col5) // col5 = text label
    );
  });
}

/**
 * Detect if a row is a header row or a data row
 * Polyboard exports often have no header - data starts immediately
 * We detect by checking if typical dimension columns (5-6) contain numeric values
 */
function detectIfHeaderRow(row: string[]): boolean {
  if (row.length < 7) return false;
  
  // In Polyboard format: columns 5 and 6 are Length and Width (0-indexed)
  // If they're numeric, this is likely a data row, not headers
  const col5 = row[5]?.trim() || '';
  const col6 = row[6]?.trim() || '';
  
  // Check if columns 5-6 are purely numeric (indicating data row)
  const col5IsNumeric = /^\d+(\.\d+)?$/.test(col5);
  const col6IsNumeric = /^\d+(\.\d+)?$/.test(col6);
  
  // If both are numeric, this is likely a data row
  if (col5IsNumeric && col6IsNumeric) {
    return false;
  }
  
  // Also check column 3 (thickness) and 4 (quantity)
  const col3 = row[3]?.trim() || '';
  const col4 = row[4]?.trim() || '';
  const col3IsNumeric = /^\d+(\.\d+)?$/.test(col3);
  const col4IsNumeric = /^\d+(\.\d+)?$/.test(col4);
  
  // If most of columns 3-6 are numeric, it's a data row
  const numericCount = [col3IsNumeric, col4IsNumeric, col5IsNumeric, col6IsNumeric].filter(Boolean).length;
  if (numericCount >= 3) {
    return false;
  }
  
  // Otherwise assume it's a header row
  return true;
}

// ============================================
// Main Export Functions
// ============================================

/**
 * Split Polyboard Master CSV by Cabinet Code
 * @param csvText - Raw CSV text content
 * @returns Split result with groups and statistics
 */
export function splitByCabinet(csvText: string): SplitResult {
  const rawRows = parseCSVText(csvText);
  
  if (rawRows.length < 1) {
    return {
      groups: [],
      totalRows: 0,
      totalCabinets: 0,
      parseErrors: ['CSV file is empty'],
    };
  }

  // Detect if first row is a header or data row
  // Polyboard exports often have NO header row - data starts immediately
  // Header detection: check if columns 5-6 (length/width positions) contain non-numeric text
  const firstRow = rawRows[0];
  const isHeaderRow = detectIfHeaderRow(firstRow);

  let headers: string[];
  let dataStartIndex: number;
  // May be replaced with pre-processed rows (e.g. timber section format)
  let effectiveRows = rawRows;
  let isTimberSectionMode = false;

  if (isHeaderRow) {
    headers = firstRow;
    dataStartIndex = 1;
    console.log('[CSV Parser] Header row detected:', headers);
  } else if (isTimberSectionFormat(rawRows)) {
    // Timber section format: Length;Qty;Material;Thickness;Width;Label
    // Pre-process: derive cabinet code from label prefix (before last "_")
    // e.g. "Door 1_UCB" → cabinet "Door 1", "Door 1_LU" → "Door 1"
    isTimberSectionMode = true;
    effectiveRows = rawRows.map((row) => {
      const label = row[5] || '';
      const underscoreIdx = label.lastIndexOf('_');
      const cabinet = underscoreIdx > 0 ? label.slice(0, underscoreIdx) : label;
      return [...row, cabinet]; // cabinet appended at col[6]
    });
    headers = ['length', 'quantity', 'material', 'thickness', 'width', 'label', 'cabinet'];
    dataStartIndex = 0;
    console.log('[CSV Parser] No header row detected - using timber section format (Length;Qty;Material;Thickness;Width;Label)');
    console.log('[CSV Parser] First data row:', firstRow);
  } else {
    // No header row - use Polyboard positional format
    // Format: Cabinet;Label;Material;Thickness;Quantity;Length;Width;Grain;Edge1;Edge2;Edge3;Edge4
    headers = ['cabinet', 'label', 'material', 'thickness', 'quantity', 'length', 'width', 'grain', 'topEdge', 'rightEdge', 'bottomEdge', 'leftEdge'];
    dataStartIndex = 0;
    console.log('[CSV Parser] No header row detected - using Polyboard positional format');
    console.log('[CSV Parser] First data row:', firstRow);
  }
  
  // Build column map
  const columnMap: Record<string, number> = {};
  for (const field of Object.keys(COLUMN_MAPPINGS)) {
    const index = findColumnIndex(headers, field);
    if (index !== -1) {
      columnMap[field] = index;
    }
  }

  // If no cabinet code column found, try to use label or a default group
  const hasCabinetCode = columnMap.cabinetCode !== undefined;
  if (!hasCabinetCode) {
    // Use first column or label as fallback cabinet grouping
    if (columnMap.label !== undefined) {
      columnMap.cabinetCode = columnMap.label;
    } else {
      // Use a default group - all parts go into one cabinet
      columnMap.cabinetCode = -1; // Special marker for default grouping
    }
  }

  // Check for missing critical columns and try positional fallback
  const parseErrors: string[] = [];
  
  // Template format: Cabinet, Label/Name, Material, Thickness, Length, Width, Quantity, Grain, Edge1-4
  // If length/width not found by name, try positional detection based on template
  if (columnMap.length === undefined || columnMap.width === undefined) {
    console.log('[CSV Parser] Length/Width not found by name, trying positional detection...');
    console.log('[CSV Parser] Headers:', headers);
    
    // Look for numeric columns that could be dimensions (typically columns 4-5 or 3-4 in template)
    const numericColumns: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase().trim();
      // Skip if already mapped to something
      const alreadyMapped = Object.values(columnMap).includes(i);
      if (!alreadyMapped) {
        // Check if header looks like a dimension column or is just a number
        if (header.match(/^(length|width|l|w|long|larg|\d+)$/i) || 
            header === '' || 
            header.match(/^\d+(\.\d+)?$/)) {
          numericColumns.push(i);
        }
      }
    }
    
    // If we found potential numeric columns and are missing length/width
    if (numericColumns.length >= 2) {
      if (columnMap.length === undefined) {
        columnMap.length = numericColumns[0];
        console.log(`[CSV Parser] Using column ${numericColumns[0]} (${headers[numericColumns[0]]}) as Length`);
      }
      if (columnMap.width === undefined) {
        columnMap.width = numericColumns[1];
        console.log(`[CSV Parser] Using column ${numericColumns[1]} (${headers[numericColumns[1]]}) as Width`);
      }
    }
    
    // Last resort: use fixed positions based on template (Cabinet=0, Label=1, Material=2, Thickness=3, Length=4, Width=5)
    if (columnMap.length === undefined && headers.length > 4) {
      columnMap.length = 4;
      parseErrors.push(`Info: Using column 5 (${headers[4] || 'unnamed'}) as Length based on template position`);
    }
    if (columnMap.width === undefined && headers.length > 5) {
      columnMap.width = 5;
      parseErrors.push(`Info: Using column 6 (${headers[5] || 'unnamed'}) as Width based on template position`);
    }
  }
  
  // Still missing? Add warnings
  if (columnMap.length === undefined) {
    parseErrors.push(`Error: Could not find Length column. Headers: [${headers.map((h, i) => `${i}:${h}`).join(', ')}]`);
  }
  if (columnMap.width === undefined) {
    parseErrors.push(`Error: Could not find Width column. Headers: [${headers.map((h, i) => `${i}:${h}`).join(', ')}]`);
  }
  
  // Debug: Log detected columns
  console.log('[CSV Parser] Final column mapping:', JSON.stringify(columnMap));
  console.log('[CSV Parser] Headers with indices:', headers.map((h, i) => `${i}:${h}`));
  
  // Parse data rows (starting from dataStartIndex)
  const cabinetGroups: Map<string, { rows: PolyboardRow[]; name?: string }> = new Map();

  for (let i = dataStartIndex; i < effectiveRows.length; i++) {
    const { row, error } = parseRow(effectiveRows[i], columnMap, i);
    
    if (error) {
      parseErrors.push(error);
      continue;
    }
    
    if (row) {
      if (!cabinetGroups.has(row.cabinetCode)) {
        cabinetGroups.set(row.cabinetCode, { rows: [], name: row.cabinetName });
      }
      cabinetGroups.get(row.cabinetCode)!.rows.push(row);
    }
  }

  // Build result groups
  const groups: CabinetGroup[] = [];
  
  for (const [cabinetCode, groupData] of cabinetGroups) {
    const panels = groupData.rows.map(rowToPanel);
    const materials = [...new Set(groupData.rows.map(r => r.material))];
    
    let totalArea = 0;
    let totalPanels = 0;
    
    for (const row of groupData.rows) {
      totalArea += row.length * row.width * row.quantity;
      totalPanels += row.quantity;
    }

    groups.push({
      cabinetCode,
      cabinetName: groupData.name,
      panels,
      totalPanels,
      totalArea,
      materials,
      ...(isTimberSectionMode ? { isTimberSection: true } : {}),
    });
  }

  // Sort by cabinet code
  groups.sort((a, b) => a.cabinetCode.localeCompare(b.cabinetCode));

  return {
    groups,
    totalRows: effectiveRows.length - dataStartIndex,
    totalCabinets: groups.length,
    parseErrors,
    debugInfo: {
      headers,
      columnMapping: columnMap,
      sampleRow: effectiveRows.length > dataStartIndex ? effectiveRows[dataStartIndex] : undefined,
      hasHeaderRow: isHeaderRow,
    },
  };
}

/**
 * Parse CSV file and return all panels (unsplit)
 */
export function parsePolyboardCSV(csvText: string): { panels: Panel[]; errors: string[] } {
  const result = splitByCabinet(csvText);
  
  const allPanels: Panel[] = [];
  for (const group of result.groups) {
    allPanels.push(...group.panels);
  }
  
  return {
    panels: allPanels,
    errors: result.parseErrors,
  };
}

/**
 * Get summary statistics from split result
 */
export function getSplitSummary(result: SplitResult): {
  totalCabinets: number;
  totalPanels: number;
  totalArea: number;
  materialBreakdown: Record<string, number>;
} {
  let totalPanels = 0;
  let totalArea = 0;
  const materialBreakdown: Record<string, number> = {};

  for (const group of result.groups) {
    totalPanels += group.totalPanels;
    totalArea += group.totalArea;
    
    for (const material of group.materials) {
      if (!materialBreakdown[material]) {
        materialBreakdown[material] = 0;
      }
      materialBreakdown[material] += group.panels.filter(p => p.material === material).length;
    }
  }

  return {
    totalCabinets: result.totalCabinets,
    totalPanels,
    totalArea,
    materialBreakdown,
  };
}
