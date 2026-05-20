/**
 * CSV Parser Service
 * Parses cutlist CSV exports from various CAD software
 */

import type { PartEntry, GrainDirection, PartEdgeBanding } from '../types';

export type CSVSourceType = 'polyboard' | 'polyboard-bar' | 'polyboard-timber' | 'sketchup' | 'generic' | 'unknown';

export interface CSVParseResult {
  success: boolean;
  sourceType: CSVSourceType;
  parts: ParsedPart[];
  errors: ParseError[];
  warnings: string[];
  metadata: {
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    filename?: string;
  };
}

export interface ParsedPart {
  name: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  materialName: string;
  materialCode?: string;
  grainDirection: GrainDirection;
  edgeBanding: PartEdgeBanding;
  notes?: string;
  originalRow: number;
  partType: 'sheet' | 'bar';
  barProfile?: string;
}

export interface ParseError {
  row: number;
  column?: string;
  message: string;
  rawData?: string;
}

interface ColumnMapping {
  name: string | number;
  length: string | number;
  width: string | number;
  thickness: string | number;
  quantity: string | number;
  material: string | number;
  grain?: string | number;
  edgeTop?: string | number;
  edgeBottom?: string | number;
  edgeLeft?: string | number;
  edgeRight?: string | number;
  notes?: string | number;
  profile?: string | number;  // bar cross-section profile (e.g. "40x40x2")
  /** Edge tape material column — PolyBoard advanced exports may carry
   *  a single column with the edge material name for all edges. */
  edgeMaterial?: string | number;
}

/**
 * Remove BOM (Byte Order Mark) from string
 */
function removeBOM(str: string): string {
  // Remove UTF-8 BOM
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  // Remove UTF-8 BOM as bytes
  if (str.startsWith('\uFEFF') || str.startsWith('\xEF\xBB\xBF')) {
    return str.slice(1);
  }
  return str;
}

/**
 * Detect the delimiter used in the CSV (comma or semicolon)
 */
function detectDelimiter(csvString: string): string {
  const firstLine = csvString.split(/[\r\n]/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parse CSV string into rows
 */
function parseCSVToRows(csvString: string): string[][] {
  // Remove BOM if present
  const cleanedString = removeBOM(csvString);
  
  // Detect delimiter
  const delimiter = detectDelimiter(cleanedString);
  
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanedString.length; i++) {
    const char = cleanedString[i];
    const nextChar = cleanedString[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detect if a row is a header row or a data row
 * Polyboard exports often have no header - data starts immediately
 */
function detectIfHeaderRow(row: string[]): boolean {
  if (row.length < 7) return false;
  
  // In Polyboard format: columns 5 and 6 are Length and Width (0-indexed)
  // If they're numeric, this is likely a data row, not headers
  const col5 = row[5]?.trim() || '';
  const col6 = row[6]?.trim() || '';
  
  const col5IsNumeric = /^\d+(\.\d+)?$/.test(col5);
  const col6IsNumeric = /^\d+(\.\d+)?$/.test(col6);
  
  if (col5IsNumeric && col6IsNumeric) {
    return false;
  }
  
  // Also check column 3 (thickness) and 4 (quantity)
  const col3 = row[3]?.trim() || '';
  const col4 = row[4]?.trim() || '';
  const col3IsNumeric = /^\d+(\.\d+)?$/.test(col3);
  const col4IsNumeric = /^\d+(\.\d+)?$/.test(col4);
  
  const numericCount = [col3IsNumeric, col4IsNumeric, col5IsNumeric, col6IsNumeric].filter(Boolean).length;
  if (numericCount >= 3) {
    return false;
  }
  
  return true;
}

/**
 * Detect CSV source type from headers
 */
function detectSourceType(headers: string[]): CSVSourceType {
  const headerString = headers.join(',').toLowerCase();

  // Polyboard bar cutting list: has 'profile' or 'profil' column, no width column
  if (
    (headerString.includes('profile') || headerString.includes('profil')) &&
    !headerString.includes('largeur') &&
    !headerString.includes('width')
  ) {
    return 'polyboard-bar';
  }

  if (
    headerString.includes('désignation') ||
    headerString.includes('longueur') ||
    headerString.includes('largeur') ||
    headerString.includes('polyboard')
  ) {
    return 'polyboard';
  }

  if (
    headerString.includes('sub-assembly') ||
    headerString.includes('part name') ||
    headerString.includes('sketchup') ||
    headerString.includes('cutlist')
  ) {
    return 'sketchup';
  }

  if (
    headerString.includes('length') &&
    headerString.includes('width') &&
    (headerString.includes('qty') || headerString.includes('quantity'))
  ) {
    return 'generic';
  }

  return 'unknown';
}

/**
 * Get column mapping based on source type
 */
function getColumnMapping(headers: string[], sourceType: CSVSourceType): ColumnMapping {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase().trim()] = i;
  });

  if (sourceType === 'polyboard-bar') {
    return {
      name: headerMap['désignation'] ?? headerMap['designation'] ?? headerMap['label'] ?? headerMap['name'] ?? 1,
      length: headerMap['longueur'] ?? headerMap['length'] ?? 5,
      width: -1,      // not applicable
      thickness: -1,  // not applicable
      quantity: headerMap['quantité'] ?? headerMap['qty'] ?? headerMap['quantity'] ?? 4,
      material: headerMap['matériau'] ?? headerMap['material'] ?? 2,
      profile: headerMap['profile'] ?? headerMap['profil'] ?? headerMap['section'] ?? 3,
    };
  }

  if (sourceType === 'polyboard') {
    return {
      name: headerMap['désignation'] ?? headerMap['designation'] ?? headerMap['name'] ?? 0,
      length: headerMap['longueur'] ?? headerMap['length'] ?? 1,
      width: headerMap['largeur'] ?? headerMap['width'] ?? 2,
      thickness: headerMap['épaisseur'] ?? headerMap['thickness'] ?? 3,
      quantity: headerMap['quantité'] ?? headerMap['qty'] ?? headerMap['quantity'] ?? 4,
      material: headerMap['matériau'] ?? headerMap['material'] ?? 5,
      grain: headerMap['fil'] ?? headerMap['grain'],
      edgeTop: headerMap['chant 1'] ?? headerMap['edge1'],
      edgeBottom: headerMap['chant 2'] ?? headerMap['edge2'],
      edgeLeft: headerMap['chant 3'] ?? headerMap['edge3'],
      edgeRight: headerMap['chant 4'] ?? headerMap['edge4'],
      edgeMaterial: headerMap['matériau chant'] ?? headerMap['edge material'] ?? headerMap['edgematerial'],
    };
  }

  if (sourceType === 'sketchup') {
    return {
      name: headerMap['part name'] ?? headerMap['part'] ?? headerMap['name'] ?? 0,
      length: headerMap['length'] ?? headerMap['l'] ?? 1,
      width: headerMap['width'] ?? headerMap['w'] ?? 2,
      thickness: headerMap['thickness'] ?? headerMap['t'] ?? headerMap['thk'] ?? 3,
      quantity: headerMap['quantity'] ?? headerMap['qty'] ?? headerMap['count'] ?? 4,
      material: headerMap['material'] ?? headerMap['sheet'] ?? 5,
      grain: headerMap['grain'] ?? headerMap['grain direction'],
      notes: headerMap['notes'] ?? headerMap['comments'],
    };
  }

  // Generic mapping - try many common variations
  return {
    name: headerMap['name'] ?? headerMap['part'] ?? headerMap['description'] ?? headerMap['part name'] ?? headerMap['component'] ?? headerMap['item'] ?? 0,
    length: headerMap['length'] ?? headerMap['l'] ?? headerMap['len'] ?? headerMap['long'] ?? 1,
    width: headerMap['width'] ?? headerMap['w'] ?? headerMap['wid'] ?? headerMap['wide'] ?? 2,
    thickness: headerMap['thickness'] ?? headerMap['t'] ?? headerMap['thk'] ?? headerMap['thick'] ?? headerMap['depth'] ?? headerMap['d'] ?? 3,
    quantity: headerMap['quantity'] ?? headerMap['qty'] ?? headerMap['count'] ?? headerMap['no'] ?? headerMap['num'] ?? headerMap['pcs'] ?? 4,
    material: headerMap['material'] ?? headerMap['mat'] ?? headerMap['board'] ?? headerMap['sheet'] ?? headerMap['panel'] ?? 5,
    grain: headerMap['grain'] ?? headerMap['grain direction'] ?? headerMap['direction'],
    notes: headerMap['notes'] ?? headerMap['comment'] ?? headerMap['comments'] ?? headerMap['remarks'],
  };
}

/**
 * Get positional mapping for headerless Polyboard panel exports
 * Format: Cabinet;Label;Material;Thickness;Quantity;Length;Width;Grain;Edge1;Edge2;Edge3;Edge4
 */
function getPolyboardPositionalMapping(): ColumnMapping {
  return {
    name: 1,        // Label
    length: 5,      // Length
    width: 6,       // Width
    thickness: 3,   // Thickness
    quantity: 4,    // Quantity
    material: 2,    // Material
    grain: 7,       // Grain
    edgeTop: 8,     // Edge1
    edgeBottom: 10, // Edge3
    edgeLeft: 11,   // Edge4
    edgeRight: 9,   // Edge2
  };
}

/**
 * Get positional mapping for headerless Polyboard bar/section cutting list exports
 * Format: Cabinet;Label;Material;Profile;Quantity;Length
 * Example: Kitchen;Top Rail;Aluminium 40x40;40x40x2;2;1200
 */
function getPolyboardBarPositionalMapping(): ColumnMapping {
  return {
    name: 1,        // Label
    length: 5,      // Cut length
    width: -1,      // Not applicable for bars
    thickness: -1,  // Not applicable for bars (profile covers cross-section)
    quantity: 4,    // Quantity
    material: 2,    // Material
    profile: 3,     // Cross-section profile (e.g. "40x40x2")
  };
}

/**
 * Detect timber section format (no header, 6 cols, length first):
 * Length, Qty, Material, Thickness, Width, Label
 * e.g. "664,1,Timber Door Style,45,140,Door 1_UCB"
 *
 * Distinguished from Polyboard bar format (Cabinet,Label,Material,Profile,Qty,Length)
 * by col[0] being numeric (length) instead of text (cabinet name).
 */
function isHeaderlessTimberSectionFormat(rows: string[][]): boolean {
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
 * Detect whether a headerless CSV is a Polyboard bar cutting list
 * (Cabinet;Label;Material;Profile;Qty;Length — col[0] is text, col[5] is numeric)
 * Bar format has 6 columns; panel format has 8–12
 */
function isHeaderlessBarFormat(rows: string[][]): boolean {
  const sampleRows = rows.slice(0, Math.min(5, rows.length));
  const avgCols = sampleRows.reduce((sum, r) => sum + r.length, 0) / sampleRows.length;
  // Bar format typically has exactly 6 columns; panel has 8+
  return avgCols <= 6.5;
}

/**
 * Parse dimension value (handles mm, cm, inches)
 */
function parseDimension(value: string): number {
  if (!value) return 0;
  
  const cleaned = value.toString().trim().toLowerCase();
  const match = cleaned.match(/^([\d.,]+)\s*(mm|cm|in|inch|")?$/);
  
  if (!match) {
    const num = parseFloat(cleaned.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }

  let num = parseFloat(match[1].replace(',', '.'));
  const unit = match[2];

  if (unit === 'cm') {
    num *= 10;
  } else if (unit === 'in' || unit === 'inch' || unit === '"') {
    num *= 25.4;
  }

  return Math.round(num * 100) / 100;
}

/**
 * Parse grain direction
 */
function parseGrain(value: string | undefined): GrainDirection {
  if (!value) return 'none';
  const v = value.toLowerCase().trim();
  if (v === 'l' || v === 'length' || v === 'longueur' || v === '1') return 'length';
  if (v === 'w' || v === 'width' || v === 'largeur' || v === '2') return 'width';
  return 'none';
}

/**
 * Parse edge banding indicator.
 * Returns `true` for simple boolean flags ("1", "x", "yes").
 * Returns the material name string for named edge tapes ("ABS 0.45mm Oak").
 * Returns `false` when no edge banding is specified.
 */
function parseEdge(value: string | undefined): boolean | string {
  if (!value) return false;
  const v = value.trim();
  const vl = v.toLowerCase();
  if (vl === '0' || vl === 'no' || vl === 'false' || vl === 'n' || vl === '' || vl === '-') return false;
  if (vl === '1' || vl === 'x' || vl === 'yes' || vl === 'true' || vl === 'y') return true;
  // Anything else is treated as a material name (e.g. "ABS 0.45" or "PVC 2mm")
  return v;
}

/**
 * Build a PartEdgeBanding from a CSV row. Extracts booleans, detects
 * per-edge material names from parseEdge, and populates the legacy
 * `material` field from an explicit edgeMaterial column or the first
 * named edge.
 */
function buildEdgeBandingFromRow(
  getValue: (key: keyof ColumnMapping) => string,
  mapping: ColumnMapping,
): PartEdgeBanding {
  const top = parseEdge(getValue('edgeTop'));
  const bottom = parseEdge(getValue('edgeBottom'));
  const left = parseEdge(getValue('edgeLeft'));
  const right = parseEdge(getValue('edgeRight'));

  // Resolve material: explicit column > first named edge > undefined
  const explicitMaterial = mapping.edgeMaterial != null ? getValue('edgeMaterial') : undefined;
  const firstNamedEdge = [top, bottom, left, right].find(e => typeof e === 'string') as string | undefined;
  const material = (explicitMaterial?.trim() || firstNamedEdge || undefined);

  const toMat = (edge: boolean | string): string | undefined =>
    typeof edge === 'string' ? edge : material;

  const out: PartEdgeBanding = {
    top: !!top,
    bottom: !!bottom,
    left: !!left,
    right: !!right,
    material,
  };

  // Populate rich per-edge data when material info is available
  if (material || firstNamedEdge) {
    const edges: PartEdgeBanding['edges'] = {};
    if (top) edges.top = { material: toMat(top) };
    if (bottom) edges.bottom = { material: toMat(bottom) };
    if (left) edges.left = { material: toMat(left) };
    if (right) edges.right = { material: toMat(right) };
    if (Object.keys(edges).length > 0) out.edges = edges;
  }

  return out;
}

/**
 * Parse a single row into a part
 */
function parseRow(
  row: string[],
  rowIndex: number,
  mapping: ColumnMapping
): { part: ParsedPart | null; error: ParseError | null } {
  try {
    const getValue = (key: keyof ColumnMapping): string => {
      const idx = mapping[key];
      if (idx === undefined) return '';
      return typeof idx === 'number' ? row[idx] || '' : '';
    };

    const name = getValue('name');
    const length = parseDimension(getValue('length'));
    const width = parseDimension(getValue('width'));
    const thickness = parseDimension(getValue('thickness'));
    const quantity = parseInt(getValue('quantity'), 10) || 1;
    const materialName = getValue('material') || 'Unspecified';
    const profile = getValue('profile') || undefined;

    if (!name) {
      return { part: null, error: { row: rowIndex, column: 'name', message: 'Missing part name' } };
    }
    if (length <= 0) {
      return { part: null, error: { row: rowIndex, column: 'length', message: 'Invalid length' } };
    }

    // Bar parts have no width — they are defined by length + cross-section profile
    const isBarPart = width <= 0 && (!!profile || mapping.width === -1);
    if (!isBarPart && width <= 0) {
      return { part: null, error: { row: rowIndex, column: 'width', message: 'Invalid width (add a Profile column for bar/linear materials)' } };
    }

    const part: ParsedPart = {
      name,
      length,
      width: isBarPart ? 0 : width,
      thickness: isBarPart ? 0 : (thickness || 18),
      quantity,
      materialName,
      grainDirection: parseGrain(getValue('grain')),
      edgeBanding: buildEdgeBandingFromRow(getValue, mapping),
      notes: getValue('notes') || undefined,
      originalRow: rowIndex,
      partType: isBarPart ? 'bar' : 'sheet',
      barProfile: isBarPart ? profile : undefined,
    };

    return { part, error: null };
  } catch (err) {
    return {
      part: null,
      error: {
        row: rowIndex,
        message: err instanceof Error ? err.message : 'Parse error',
        rawData: row.join(','),
      },
    };
  }
}

/**
 * Main CSV parse function
 */
export function parseCSV(csvString: string, filename?: string): CSVParseResult {
  const rows = parseCSVToRows(csvString);
  
  if (rows.length < 1) {
    return {
      success: false,
      sourceType: 'unknown',
      parts: [],
      errors: [{ row: 0, message: 'CSV file is empty' }],
      warnings: [],
      metadata: {
        totalRows: rows.length,
        parsedRows: 0,
        skippedRows: 0,
        filename,
      },
    };
  }

  // Detect if first row is header or data
  const firstRow = rows[0];
  const isHeaderRow = detectIfHeaderRow(firstRow);

  let headers: string[];
  let dataStartIndex: number;

  // When the format is detected, these may be replaced by pre-processed rows
  let effectiveRows = rows;

  if (isHeaderRow) {
    headers = firstRow;
    dataStartIndex = 1;
  } else {
    // No header row - use Polyboard positional format.
    // Check timber section format first (col[0] is numeric length).
    if (isHeaderlessTimberSectionFormat(rows)) {
      // Timber section format: Length;Qty;Material;Thickness;Width;Label
      // Pre-process: derive profile string from thickness×width and append as col[6]
      effectiveRows = rows.map((row) => [
        ...row,
        row[3] && row[4] ? `${row[3]}x${row[4]}` : '',
      ]);
      headers = ['length', 'quantity', 'material', 'thickness', 'width', 'label', 'profile'];
      dataStartIndex = 0;
    } else if (isHeaderlessBarFormat(rows)) {
      // Bar format: Cabinet;Label;Material;Profile;Quantity;Length
      headers = ['cabinet', 'label', 'material', 'profile', 'quantity', 'length'];
      dataStartIndex = 0;
    } else {
      // Panel format: Cabinet;Label;Material;Thickness;Quantity;Length;Width;Grain;Edge1;Edge2;Edge3;Edge4
      headers = ['cabinet', 'label', 'material', 'thickness', 'quantity', 'length', 'width', 'grain', 'topEdge', 'rightEdge', 'bottomEdge', 'leftEdge'];
      dataStartIndex = 0;
    }
  }

  const sourceType: CSVSourceType = isHeaderRow
    ? detectSourceType(headers)
    : isHeaderlessTimberSectionFormat(rows)
      ? 'polyboard-timber'
      : isHeaderlessBarFormat(rows)
        ? 'polyboard-bar'
        : 'polyboard';

  let mapping: ColumnMapping;
  if (isHeaderRow) {
    mapping = getColumnMapping(headers, sourceType);
  } else if (sourceType === 'polyboard-timber') {
    // Length;Qty;Material;Thickness;Width;Label → profile appended at col[6]
    mapping = {
      name: 5,        // Label
      length: 0,      // Length
      width: -1,      // Not applicable (bar-style: profile covers cross-section)
      thickness: -1,  // Not applicable
      quantity: 1,    // Quantity
      material: 2,    // Material
      profile: 6,     // Derived profile (e.g. "45x140")
    };
  } else if (sourceType === 'polyboard-bar') {
    mapping = getPolyboardBarPositionalMapping();
  } else {
    mapping = getPolyboardPositionalMapping();
  }

  const parts: ParsedPart[] = [];
  const errors: ParseError[] = [];
  const warnings: string[] = [];

  if (sourceType === 'unknown') {
    warnings.push('Could not detect CSV format, using generic mapping');
  }

  if (!isHeaderRow) {
    if (sourceType === 'polyboard-timber') {
      warnings.push('No header row detected - using Polyboard timber section format (Length;Qty;Material;Thickness;Width;Label)');
    } else if (sourceType === 'polyboard-bar') {
      warnings.push('No header row detected - using Polyboard bar/section cutting list format (Cabinet;Label;Material;Profile;Qty;Length)');
    } else {
      warnings.push('No header row detected - using Polyboard panel positional format');
    }
  }

  for (let i = dataStartIndex; i < effectiveRows.length; i++) {
    const { part, error } = parseRow(effectiveRows[i], i + 1, mapping);
    if (part) {
      parts.push(part);
    }
    if (error) {
      errors.push(error);
    }
  }

  return {
    success: parts.length > 0,
    sourceType,
    parts,
    errors,
    warnings,
    metadata: {
      totalRows: effectiveRows.length - (isHeaderRow ? 1 : 0),
      parsedRows: parts.length,
      skippedRows: errors.length,
      filename,
    },
  };
}

/**
 * Convert parsed parts to PartEntry format for saving
 */
export function parsedPartsToPartEntries(
  parsedParts: ParsedPart[],
  source: 'csv-import' | 'polyboard' | 'sketchup',
  filename?: string
): Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[] {
  return parsedParts.map((p, index) => ({
    partNumber: `P${String(index + 1).padStart(3, '0')}`,
    name: p.name,
    length: p.length,
    width: p.width,
    thickness: p.thickness,
    quantity: p.quantity,
    materialName: p.materialName,
    materialCode: p.materialCode,
    grainDirection: p.grainDirection,
    edgeBanding: p.edgeBanding,
    hasCNCOperations: false,
    notes: p.notes,
    source,
    importedFrom: filename,
    partType: p.partType,
    barProfile: p.barProfile,
  }));
}
