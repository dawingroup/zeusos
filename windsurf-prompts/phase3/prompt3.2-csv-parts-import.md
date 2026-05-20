# Prompt 3.2: CSV Parts Import

## Objective
Create a CSV parser and import service that handles parts exports from Polyboard and SketchUp, mapping them to our PartEntry structure.

## Prerequisites
- Completed Prompt 3.1 (Design Item Parts Model)

## Context
Designers export cutlists from CAD software (Polyboard, SketchUp with CutList plugin). These exports have different formats that need to be normalized to our PartEntry structure.

## Requirements

### 1. Create CSV Parser Types

Create file: `src/modules/design-manager/services/csvParser/types.ts`

```typescript
/**
 * CSV Parser Types
 */

export type CSVSourceType = 'polyboard' | 'sketchup' | 'generic' | 'unknown';

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
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  notes?: string;
  originalRow: number;
}

export interface ParseError {
  row: number;
  column?: string;
  message: string;
  rawData?: string;
}

export interface ColumnMapping {
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
}
```

### 2. Create CSV Parser Service

Create file: `src/modules/design-manager/services/csvParser/parser.ts`

```typescript
/**
 * CSV Parser Service
 * Parses cutlist CSV exports from various CAD software
 */

import type {
  CSVParseResult,
  CSVSourceType,
  ParsedPart,
  ParseError,
  ColumnMapping,
} from './types';

/**
 * Parse CSV string into rows
 */
function parseCSVToRows(csvString: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n after \r
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

  // Handle last row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detect CSV source type from headers
 */
function detectSourceType(headers: string[]): CSVSourceType {
  const headerString = headers.join(',').toLowerCase();

  // Polyboard markers
  if (
    headerString.includes('désignation') ||
    headerString.includes('longueur') ||
    headerString.includes('largeur') ||
    headerString.includes('polyboard')
  ) {
    return 'polyboard';
  }

  // SketchUp CutList markers
  if (
    headerString.includes('sub-assembly') ||
    headerString.includes('part name') ||
    headerString.includes('sketchup') ||
    headerString.includes('cutlist')
  ) {
    return 'sketchup';
  }

  // Generic cutlist headers
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
 * Get column mapping for Polyboard format
 */
function getPolyboardMapping(headers: string[]): ColumnMapping {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase().trim()] = i;
  });

  return {
    name: headerMap['désignation'] ?? headerMap['designation'] ?? headerMap['name'] ?? 0,
    length: headerMap['longueur'] ?? headerMap['length'] ?? 1,
    width: headerMap['largeur'] ?? headerMap['width'] ?? 2,
    thickness: headerMap['épaisseur'] ?? headerMap['thickness'] ?? 3,
    quantity: headerMap['quantité'] ?? headerMap['qty'] ?? headerMap['quantity'] ?? 4,
    material: headerMap['matériau'] ?? headerMap['material'] ?? 5,
    grain: headerMap['fil'] ?? headerMap['grain'] ?? undefined,
    edgeTop: headerMap['chant 1'] ?? headerMap['edge1'] ?? undefined,
    edgeBottom: headerMap['chant 2'] ?? headerMap['edge2'] ?? undefined,
    edgeLeft: headerMap['chant 3'] ?? headerMap['edge3'] ?? undefined,
    edgeRight: headerMap['chant 4'] ?? headerMap['edge4'] ?? undefined,
  };
}

/**
 * Get column mapping for SketchUp CutList format
 */
function getSketchUpMapping(headers: string[]): ColumnMapping {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase().trim()] = i;
  });

  return {
    name: headerMap['part name'] ?? headerMap['part'] ?? headerMap['name'] ?? 0,
    length: headerMap['length'] ?? headerMap['l'] ?? 1,
    width: headerMap['width'] ?? headerMap['w'] ?? 2,
    thickness: headerMap['thickness'] ?? headerMap['t'] ?? headerMap['thk'] ?? 3,
    quantity: headerMap['quantity'] ?? headerMap['qty'] ?? headerMap['count'] ?? 4,
    material: headerMap['material'] ?? headerMap['sheet'] ?? 5,
    grain: headerMap['grain'] ?? headerMap['grain direction'] ?? undefined,
    notes: headerMap['notes'] ?? headerMap['comments'] ?? undefined,
  };
}

/**
 * Get column mapping for generic format
 */
function getGenericMapping(headers: string[]): ColumnMapping {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase().trim()] = i;
  });

  return {
    name: headerMap['name'] ?? headerMap['part'] ?? headerMap['description'] ?? 0,
    length: headerMap['length'] ?? headerMap['l'] ?? 1,
    width: headerMap['width'] ?? headerMap['w'] ?? 2,
    thickness: headerMap['thickness'] ?? headerMap['t'] ?? headerMap['thk'] ?? 3,
    quantity: headerMap['quantity'] ?? headerMap['qty'] ?? headerMap['count'] ?? 4,
    material: headerMap['material'] ?? headerMap['mat'] ?? 5,
    grain: headerMap['grain'] ?? undefined,
    notes: headerMap['notes'] ?? undefined,
  };
}

/**
 * Parse dimension value (handles mm, cm, inches)
 */
function parseDimension(value: string): number {
  if (!value) return 0;
  
  const cleaned = value.toString().trim().toLowerCase();
  
  // Extract number
  const match = cleaned.match(/^([\d.,]+)\s*(mm|cm|in|inch|")?$/);
  if (!match) {
    // Try just number
    const num = parseFloat(cleaned.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }

  let num = parseFloat(match[1].replace(',', '.'));
  const unit = match[2];

  // Convert to mm
  if (unit === 'cm') {
    num *= 10;
  } else if (unit === 'in' || unit === 'inch' || unit === '"') {
    num *= 25.4;
  }

  return Math.round(num * 100) / 100; // Round to 2 decimals
}

/**
 * Parse grain direction
 */
function parseGrain(value: string | undefined): 'length' | 'width' | 'none' {
  if (!value) return 'none';
  const v = value.toLowerCase().trim();
  if (v === 'l' || v === 'length' || v === 'longueur' || v === '1') return 'length';
  if (v === 'w' || v === 'width' || v === 'largeur' || v === '2') return 'width';
  return 'none';
}

/**
 * Parse edge banding indicator
 */
function parseEdge(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return v === '1' || v === 'x' || v === 'yes' || v === 'true' || v === 'y';
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

    // Validate required fields
    if (!name) {
      return { part: null, error: { row: rowIndex, column: 'name', message: 'Missing part name' } };
    }
    if (length <= 0) {
      return { part: null, error: { row: rowIndex, column: 'length', message: 'Invalid length' } };
    }
    if (width <= 0) {
      return { part: null, error: { row: rowIndex, column: 'width', message: 'Invalid width' } };
    }

    const part: ParsedPart = {
      name,
      length,
      width,
      thickness: thickness || 18, // Default 18mm
      quantity,
      materialName,
      grainDirection: parseGrain(getValue('grain')),
      edgeBanding: {
        top: parseEdge(getValue('edgeTop')),
        bottom: parseEdge(getValue('edgeBottom')),
        left: parseEdge(getValue('edgeLeft')),
        right: parseEdge(getValue('edgeRight')),
      },
      notes: getValue('notes') || undefined,
      originalRow: rowIndex,
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
  
  if (rows.length < 2) {
    return {
      success: false,
      sourceType: 'unknown',
      parts: [],
      errors: [{ row: 0, message: 'CSV must have header row and at least one data row' }],
      warnings: [],
      metadata: {
        totalRows: rows.length,
        parsedRows: 0,
        skippedRows: 0,
        filename,
      },
    };
  }

  const headers = rows[0];
  const sourceType = detectSourceType(headers);
  
  let mapping: ColumnMapping;
  switch (sourceType) {
    case 'polyboard':
      mapping = getPolyboardMapping(headers);
      break;
    case 'sketchup':
      mapping = getSketchUpMapping(headers);
      break;
    default:
      mapping = getGenericMapping(headers);
  }

  const parts: ParsedPart[] = [];
  const errors: ParseError[] = [];
  const warnings: string[] = [];

  if (sourceType === 'unknown') {
    warnings.push('Could not detect CSV format, using generic mapping');
  }

  for (let i = 1; i < rows.length; i++) {
    const { part, error } = parseRow(rows[i], i + 1, mapping);
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
      totalRows: rows.length - 1,
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
): Omit<import('../types').PartEntry, 'id' | 'createdAt' | 'updatedAt'>[] {
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
  }));
}
```

### 3. Create Import Index

Create file: `src/modules/design-manager/services/csvParser/index.ts`

```typescript
export * from './types';
export * from './parser';
```

### 4. Update Service Exports

Update `src/modules/design-manager/services/index.ts`:

```typescript
export * from './partsService';
export * from './csvParser';
```

## Validation Checklist

- [ ] CSV parser handles different delimiters and quoted fields
- [ ] Polyboard format detected and mapped correctly
- [ ] SketchUp format detected and mapped correctly
- [ ] Generic format works as fallback
- [ ] Dimension parsing handles mm, cm, inches
- [ ] Errors and warnings tracked per row

## Next Steps

After completing this prompt, proceed to:
- **Prompt 3.3**: Parts List UI - Display and manage parts within design item detail view
