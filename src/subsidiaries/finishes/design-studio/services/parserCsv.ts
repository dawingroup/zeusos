/**
 * PolyBoard CSV Cut List Parser
 * Parses semicolon-delimited PolyBoard panel exports.
 *
 * PolyBoard headerless format (12 columns):
 *   Cabinet ; Label ; Material ; Thickness ; Quantity ; Length ; Width ; Grain ; Edge1 ; Edge2 ; Edge3 ; Edge4
 *
 * Also supports PolyBoard bar format (6 columns):
 *   Cabinet ; Label ; Material ; Profile ; Quantity ; Length
 *
 * Detection logic adapted from existing design-manager/services/csvParser.ts
 */

import type { CutListEntry } from '../types/workshop-viewer.types';

export interface CsvParseResult {
  success: boolean;
  entries: CutListEntry[];
  errors: string[];
  metadata: {
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    detectedFormat: 'polyboard-panel' | 'polyboard-bar' | 'polyboard-timber' | 'unknown';
  };
}

/**
 * Parse a PolyBoard CSV string into cut list entries.
 */
export function parsePolyBoardCSV(csvString: string): CsvParseResult {
  const cleaned = removeBOM(csvString);
  const delimiter = detectDelimiter(cleaned);
  const rows = parseToRows(cleaned, delimiter);

  if (rows.length === 0) {
    return {
      success: false,
      entries: [],
      errors: ['Empty CSV file'],
      metadata: { totalRows: 0, parsedRows: 0, skippedRows: 0, detectedFormat: 'unknown' },
    };
  }

  // Detect if first row is a header (numeric in dimension columns = data row)
  const hasHeader = isHeaderRow(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const format = detectFormat(rows[0], delimiter);

  const entries: CutListEntry[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = hasHeader ? i + 2 : i + 1;

    if (row.length < 6 || row.every(c => c === '')) {
      skipped++;
      continue;
    }

    try {
      if (format === 'polyboard-panel' && row.length >= 7) {
        entries.push(parsePanelRow(row, rowNum));
      } else if (format === 'polyboard-bar' && row.length >= 6) {
        entries.push(parseBarRow(row, rowNum));
      } else {
        // Best effort: try panel format
        entries.push(parsePanelRow(row, rowNum));
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : 'Parse error'}`);
      skipped++;
    }
  }

  return {
    success: entries.length > 0,
    entries,
    errors,
    metadata: {
      totalRows: rows.length,
      parsedRows: entries.length,
      skippedRows: skipped,
      detectedFormat: format,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function removeBOM(str: string): string {
  if (str.charCodeAt(0) === 0xFEFF) return str.slice(1);
  return str;
}

function detectDelimiter(csv: string): string {
  const firstLine = csv.split(/[\r\n]/)[0] ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

function parseToRows(csv: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      currentRow.push(cell.trim());
      if (currentRow.some(c => c !== '')) rows.push(currentRow);
      currentRow = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || currentRow.length > 0) {
    currentRow.push(cell.trim());
    if (currentRow.some(c => c !== '')) rows.push(currentRow);
  }

  return rows;
}

function isHeaderRow(row: string[]): boolean {
  if (row.length < 7) return false;
  // In PolyBoard format, columns 3-6 are Thickness/Qty/Length/Width
  // If they're numeric, this is a data row
  const numerics = [row[3], row[4], row[5], row[6]]
    .filter(Boolean)
    .filter(v => /^\d+(\.\d+)?$/.test(v.trim()));
  return numerics.length < 3;
}

function detectFormat(firstRow: string[], _delimiter: string): CsvParseResult['metadata']['detectedFormat'] {
  const joined = firstRow.join(' ').toLowerCase();

  // Bar format: has "profile" or "profil", no width column
  if ((joined.includes('profile') || joined.includes('profil')) && !joined.includes('width') && !joined.includes('largeur')) {
    return 'polyboard-bar';
  }

  // Timber format: starts with length (numeric in col 0)
  if (firstRow.length === 6 && /^\d+(\.\d+)?$/.test(firstRow[0].trim())) {
    return 'polyboard-timber';
  }

  // Panel format: 7+ columns
  if (firstRow.length >= 7) {
    return 'polyboard-panel';
  }

  return 'unknown';
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^\d.,\-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseEdge(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v === '1' || v === 'x' || v === 'yes' || v === 'true' || v === 'y' || v === 'oui';
}

function parsePanelRow(row: string[], originalRow: number): CutListEntry {
  // Columns: 0=Cabinet, 1=Label, 2=Material, 3=Thickness, 4=Qty, 5=Length, 6=Width, 7=Grain, 8-11=Edges
  return {
    cabinet: row[0]?.trim() ?? '',
    partName: row[1]?.trim() ?? '',
    material: row[2]?.trim() ?? '',
    thickness: parseNum(row[3]),
    qty: Math.max(1, Math.round(parseNum(row[4]))),
    length: parseNum(row[5]),
    width: parseNum(row[6]),
    grainDirection: parseGrainDirection(row[7]),
    edgeBanding: {
      L1: parseEdge(row[8]),
      L2: parseEdge(row[9]),
      W1: parseEdge(row[10]),
      W2: parseEdge(row[11]),
    },
    originalRow,
  };
}

function parseBarRow(row: string[], originalRow: number): CutListEntry {
  // Columns: 0=Cabinet, 1=Label, 2=Material, 3=Profile, 4=Qty, 5=Length
  const profile = row[3]?.trim() ?? '';
  // Parse profile "WxH" or "WxHxT" → use first two as width/thickness
  const profileParts = profile.split(/[x×]/i).map(parseFloat).filter(v => !isNaN(v));

  return {
    cabinet: row[0]?.trim() ?? '',
    partName: row[1]?.trim() ?? '',
    material: row[2]?.trim() ?? '',
    thickness: profileParts[2] ?? profileParts[1] ?? 0,
    qty: Math.max(1, Math.round(parseNum(row[4]))),
    length: parseNum(row[5]),
    width: profileParts[0] ?? 0,
    grainDirection: 'none',
    edgeBanding: { L1: false, L2: false, W1: false, W2: false },
    originalRow,
  };
}

function parseGrainDirection(val: string | undefined): CutListEntry['grainDirection'] {
  if (!val) return 'none';
  const v = val.trim().toLowerCase();
  if (v === 'l' || v === 'longueur' || v === 'length') return 'length';
  if (v === 'w' || v === 'largeur' || v === 'width') return 'width';
  return 'none';
}
