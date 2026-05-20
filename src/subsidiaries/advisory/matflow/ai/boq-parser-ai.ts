/**
 * AI BOQ Parser
 * 
 * Core AI parsing logic for BOQ documents.
 * Uses local processing with option for Cloud Function AI calls.
 */

import './parsing-prompts';
import {
  calculateItemConfidence,
  calculateSectionConfidence,
  getReviewStatus,
} from './confidence-scorer';
import {
  matchMaterialsLocally,
  applyMatchesToItems,
  type MaterialLibraryEntry,
  type MatchingInput,
} from './material-matcher-ai';
import type {
  ParsedSection,
  ParsedItem,
  ParsingMetadata,
  SourceAnalysis,
} from '../types/parsing';

// ============================================================================
// TYPES
// ============================================================================

export interface ExcelAnalysisInput {
  excelData: Record<string, any>[];
  fileName: string;
  sheetName: string;
}

export interface ExcelAnalysisResult {
  headerRow: number;
  dataStartRow: number;
  sectionIndicatorRows: number[];
  columnMapping: Record<string, { column: string | number; confidence: number }>;
  detectedCurrency: string;
  detectedUnits: string[];
  qualityIssues: string[];
  overallConfidence: number;
}

export interface SectionParsingInput {
  sectionData: Record<string, any>[];
  columnMapping: Record<string, any>;
  projectName: string;
  previousSections: string[];
  sectionIndex: number;
}

export interface SectionParsingResult {
  section: {
    code: string;
    name: string;
    category: string;
    confidence: number;
  };
  items: ParsedItemResult[];
  subtotal: number;
  parseMetadata: {
    rowsProcessed: number;
    itemsExtracted: number;
    itemsWithIssues: number;
  };
}

export interface ParsedItemResult {
  tempId: string;
  itemNumber: string;
  description: string;
  specification: string | null;
  quantity: number;
  unit: string;
  laborRate: number | null;
  materialRate: number | null;
  equipmentRate: number | null;
  unitRate: number;
  totalAmount: number;
  confidence: {
    overall: number;
    fields: Record<string, number>;
  };
  flags: string[];
  suggestions: Array<{
    type: string;
    field: string;
    currentValue: any;
    suggestedValue: any;
    reason: string;
    confidence: number;
  }>;
}

export interface FullParsingInput {
  excelData: Record<string, any>[];
  fileName: string;
  sheetName: string;
  projectName: string;
  materialLibrary?: MaterialLibraryEntry[];
  onProgress?: (progress: { stage: string; percentage: number; message?: string }) => void;
}

export interface FullParsingResult {
  sections: ParsedSection[];
  metadata: ParsingMetadata;
  sourceAnalysis: SourceAnalysis;
}

// ============================================================================
// LOCAL EXCEL ANALYSIS (Non-AI)
// ============================================================================

/**
 * Analyze Excel structure locally (without AI)
 */
export const analyzeExcelStructureLocally = (
  input: ExcelAnalysisInput
): ExcelAnalysisResult => {
  const { excelData } = input;
  
  // Find header row by looking for BOQ keywords
  const headerRow = findHeaderRow(excelData);
  const dataStartRow = headerRow + 1;
  
  // Identify columns based on headers
  const columnMapping = detectColumnMapping(excelData[headerRow] || {});
  
  // Find section indicator rows
  const sectionIndicatorRows = findSectionRows(excelData, dataStartRow);
  
  // Detect units and currency
  const detectedUnits = detectUnits(excelData);
  const detectedCurrency = detectCurrency(excelData);
  
  // Quality issues
  const qualityIssues = detectQualityIssues(excelData, columnMapping);
  
  // Overall confidence
  const confidence = calculateAnalysisConfidence(columnMapping);
  
  return {
    headerRow,
    dataStartRow,
    sectionIndicatorRows,
    columnMapping,
    detectedCurrency,
    detectedUnits,
    qualityIssues,
    overallConfidence: confidence,
  };
};

const findHeaderRow = (data: Record<string, any>[]): number => {
  const headerKeywords = [
    'item', 'description', 'qty', 'quantity', 'unit', 'rate',
    'amount', 'total', 'no.', 'ref', 'specification'
  ];

  let bestRow = -1;
  let bestMatchCount = 0;

  for (let i = 0; i < Math.min(100, data.length); i++) {
    const row = data[i];
    const rowValues = Object.values(row).map(v => String(v || '').toLowerCase());
    const rowText = rowValues.join(' ');

    const matchCount = headerKeywords.filter(kw => rowText.includes(kw)).length;
    if (matchCount >= 3 && matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestRow = i;
    }
  }

  // If no header found, check if row 0 has any text at all (might be data-only)
  if (bestRow === -1) {
    // Return 0 but the caller should handle this as "no header detected"
    return 0;
  }

  return bestRow;
};

const detectColumnMapping = (
  headerRow: Record<string, any>
): Record<string, { column: string | number; confidence: number }> => {
  const patterns: Record<string, string[]> = {
    itemNumber: ['item', 'no', 'ref', 'number', '#'],
    description: ['description', 'particulars', 'work', 'item description'],
    unit: ['unit', 'uom', 'u/m'],
    quantity: ['qty', 'quantity', 'qnty'],
    laborRate: ['labour', 'labor', 'labour rate'],
    materialRate: ['material', 'materials', 'material rate'],
    equipmentRate: ['equipment', 'plant', 'equipment rate'],
    unitRate: ['rate', 'unit rate', 'price'],
    totalAmount: ['amount', 'total', 'sum'],
  };

  // Score all columns for each field, then pick the best match
  const candidates: Record<string, Array<{ column: string | number; confidence: number }>> = {};

  for (const [key, value] of Object.entries(headerRow)) {
    const headerText = String(value || '').toLowerCase();

    for (const [field, keywords] of Object.entries(patterns)) {
      const matches = keywords.filter(kw => headerText.includes(kw));
      if (matches.length > 0) {
        const confidence = Math.min(1, 0.5 + matches.length * 0.2);
        if (!candidates[field]) candidates[field] = [];
        candidates[field].push({ column: key, confidence });
      }
    }
  }

  // Pick the highest-confidence candidate for each field
  // Also ensure no two fields map to the same column (resolve conflicts by confidence)
  const mapping: Record<string, { column: string | number; confidence: number }> = {};
  const usedColumns = new Set<string | number>();

  // Sort fields by their best candidate confidence (highest first) to give priority
  const fieldsByConfidence = Object.entries(candidates)
    .map(([field, cols]) => ({
      field,
      best: cols.sort((a, b) => b.confidence - a.confidence),
    }))
    .sort((a, b) => (b.best[0]?.confidence || 0) - (a.best[0]?.confidence || 0));

  for (const { field, best } of fieldsByConfidence) {
    for (const candidate of best) {
      if (!usedColumns.has(candidate.column)) {
        mapping[field] = candidate;
        usedColumns.add(candidate.column);
        break;
      }
    }
  }

  return mapping;
};

const findSectionRows = (
  data: Record<string, any>[],
  dataStartRow: number
): number[] => {
  const sectionRows: number[] = [];
  const sectionPatterns = [
    /^[A-Z]\s*[-–:]/,          // A - Section name
    /^\d+\.0*\s*[-–:]/,        // 1.0 - Section name
    /^(SECTION|ELEMENT|BILL)/i, // SECTION, ELEMENT, BILL
    /^(PRELIMINARIES|SUBSTRUCTURE|SUPERSTRUCTURE|FINISHES|SERVICES|EXTERNAL)/i,
  ];
  
  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i];
    const firstValue = String(Object.values(row)[0] || '');
    const description = String(row.description || row.Description || Object.values(row)[1] || '');
    
    // Check if this looks like a section header
    const textToCheck = firstValue + ' ' + description;
    
    for (const pattern of sectionPatterns) {
      if (pattern.test(textToCheck)) {
        sectionRows.push(i);
        break;
      }
    }
    
    // Also check if row has text but no quantity (likely section header)
    const hasText = textToCheck.length > 5;
    const hasNoQty = !Object.values(row).some(v => {
      const num = parseFloat(String(v));
      return !isNaN(num) && num > 0 && num < 1000000;
    });
    
    if (hasText && hasNoQty && textToCheck.toUpperCase() === textToCheck) {
      if (!sectionRows.includes(i)) {
        sectionRows.push(i);
      }
    }
  }
  
  // If no sections found, treat entire data as one section
  if (sectionRows.length === 0) {
    sectionRows.push(dataStartRow);
  }
  
  return sectionRows.sort((a, b) => a - b);
};

const detectUnits = (data: Record<string, any>[]): string[] => {
  const units = new Set<string>();
  const unitPatterns = /\b(m²|m³|m|mm|cm|kg|t|nr|no|pcs|l\.s\.|ls|item|lm|rm|l)\b/gi;
  
  for (const row of data) {
    for (const value of Object.values(row)) {
      const str = String(value || '');
      const matches = str.match(unitPatterns);
      if (matches) {
        matches.forEach(m => units.add(m.toLowerCase()));
      }
    }
  }
  
  return Array.from(units);
};

const detectCurrency = (data: Record<string, any>[]): string => {
  const currencyPatterns = [
    { pattern: /UGX|Ush/i, currency: 'UGX' },
    { pattern: /USD|\$/i, currency: 'USD' },
    { pattern: /KES/i, currency: 'KES' },
    { pattern: /TZS/i, currency: 'TZS' },
  ];
  
  const text = JSON.stringify(data);
  
  for (const { pattern, currency } of currencyPatterns) {
    if (pattern.test(text)) {
      return currency;
    }
  }
  
  return 'UGX'; // Default for Uganda
};

const detectQualityIssues = (
  data: Record<string, any>[],
  columnMapping: Record<string, { column: string | number; confidence: number }>
): string[] => {
  const issues: string[] = [];
  
  // Check for missing columns
  const requiredFields = ['description', 'quantity', 'unitRate'];
  for (const field of requiredFields) {
    if (!columnMapping[field]) {
      issues.push(`Missing ${field} column`);
    }
  }
  
  // Check for low confidence mappings
  for (const [field, mapping] of Object.entries(columnMapping)) {
    if (mapping.confidence < 0.6) {
      issues.push(`Low confidence for ${field} column (${(mapping.confidence * 100).toFixed(0)}%)`);
    }
  }
  
  // Check data quality
  let emptyDescriptions = 0;
  let invalidQuantities = 0;
  
  for (const row of data) {
    const desc = row[columnMapping.description?.column as string];
    const qty = row[columnMapping.quantity?.column as string];

    if (!desc || String(desc).trim().length < 3) emptyDescriptions++;
    if (qty !== undefined && (isNaN(parseFloat(qty)) || parseFloat(qty) < 0)) {
      invalidQuantities++;
    }
  }
  
  if (emptyDescriptions > 10) {
    issues.push(`${emptyDescriptions} rows with empty/short descriptions`);
  }
  if (invalidQuantities > 5) {
    issues.push(`${invalidQuantities} rows with invalid quantities`);
  }
  
  return issues;
};

const calculateAnalysisConfidence = (
  columnMapping: Record<string, { column: string | number; confidence: number }>
): number => {
  const requiredFields = ['description', 'quantity', 'unitRate', 'totalAmount'];
  let totalConfidence = 0;
  let fieldsFound = 0;
  
  for (const field of requiredFields) {
    if (columnMapping[field]) {
      totalConfidence += columnMapping[field].confidence;
      fieldsFound++;
    }
  }
  
  return fieldsFound > 0 ? totalConfidence / requiredFields.length : 0;
};

// ============================================================================
// LOCAL SECTION PARSING (Non-AI)
// ============================================================================

/**
 * Check if a row looks like a section header (no numeric data, text-heavy)
 */
const isSectionHeaderRow = (
  row: Record<string, any>,
  columnMapping: Record<string, any>
): boolean => {
  const qtyCol = columnMapping.quantity?.column;
  const rateCol = columnMapping.unitRate?.column;
  const amtCol = columnMapping.totalAmount?.column;

  const qty = qtyCol ? parseFloat(row[qtyCol]) : NaN;
  const rate = rateCol ? parseFloat(row[rateCol]) : NaN;
  const amt = amtCol ? parseFloat(row[amtCol]) : NaN;

  // If the row has numeric quantity, rate, or amount data, it's likely a data row
  if ((!isNaN(qty) && qty > 0) || (!isNaN(rate) && rate > 0) || (!isNaN(amt) && amt > 0)) {
    return false;
  }

  // Check if the row has meaningful text in the description column
  const descCol = columnMapping.description?.column;
  const desc = descCol ? String(row[descCol] || '').trim() : '';
  if (desc.length > 3) {
    return true; // Has text but no numbers — likely a section header
  }

  // Check first non-empty value
  for (const value of Object.values(row)) {
    const str = String(value || '').trim();
    if (str.length > 3 && isNaN(parseFloat(str))) {
      return true;
    }
  }

  return false;
};

/**
 * Parse section data locally (without AI)
 */
export const parseSectionLocally = (
  input: SectionParsingInput
): SectionParsingResult => {
  const { sectionData, columnMapping, sectionIndex } = input;

  // Check whether the first row is actually a section header or a data row
  const firstRow = sectionData[0] || {};
  const firstRowIsHeader = isSectionHeaderRow(firstRow, columnMapping);

  const sectionName = firstRowIsHeader
    ? extractSectionName(firstRow, columnMapping)
    : `Section ${sectionIndex + 1}`;
  const sectionCode = extractSectionCode(sectionName, sectionIndex);
  const category = inferCategory(sectionName);

  // Start from row 1 if first row is a header, otherwise from row 0
  const startIndex = firstRowIsHeader ? 1 : 0;

  // Parse items from data rows
  const items: ParsedItemResult[] = [];
  let subtotal = 0;
  let itemsWithIssues = 0;

  for (let i = startIndex; i < sectionData.length; i++) {
    const row = sectionData[i];
    const item = parseItemRow(row, columnMapping, sectionIndex, i - startIndex);

    if (item) {
      items.push(item);
      subtotal += item.totalAmount;
      if (item.flags.length > 0) itemsWithIssues++;
    }
  }
  
  return {
    section: {
      code: sectionCode,
      name: sectionName,
      category,
      confidence: items.length > 0 ? 0.7 : 0.4,
    },
    items,
    subtotal,
    parseMetadata: {
      rowsProcessed: sectionData.length,
      itemsExtracted: items.length,
      itemsWithIssues,
    },
  };
};

const extractSectionName = (
  row: Record<string, any>,
  columnMapping: Record<string, any>
): string => {
  // Try description column first
  const descCol = columnMapping.description?.column;
  if (descCol && row[descCol]) {
    return String(row[descCol]).trim();
  }
  
  // Fall back to first non-empty value
  for (const value of Object.values(row)) {
    if (value && String(value).trim().length > 3) {
      return String(value).trim();
    }
  }
  
  return 'Unnamed Section';
};

const extractSectionCode = (name: string, index: number): string => {
  // Try to extract code from name
  const codeMatch = name.match(/^([A-Z]\d*|\d+\.?\d*)\s*[-–:.]?\s*/);
  if (codeMatch) {
    return codeMatch[1];
  }
  
  // Generate based on index
  return String(index + 1);
};

const inferCategory = (name: string): string => {
  const nameLower = name.toLowerCase();
  
  const categoryKeywords: Record<string, string[]> = {
    preliminaries: ['preliminar', 'general', 'site', 'temporary'],
    substructure: ['substructure', 'foundation', 'excavat', 'ground', 'basement'],
    superstructure: ['superstructure', 'column', 'beam', 'slab', 'wall', 'concrete'],
    finishes: ['finish', 'plaster', 'paint', 'tile', 'floor', 'ceiling'],
    services: ['service', 'plumbing', 'electrical', 'mechanical', 'hvac'],
    external_works: ['external', 'landscap', 'paving', 'drainage', 'fence'],
    provisional: ['provisional', 'contingenc', 'pc sum'],
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => nameLower.includes(kw))) {
      return category;
    }
  }
  
  return 'other';
};

const parseItemRow = (
  row: Record<string, any>,
  columnMapping: Record<string, any>,
  sectionIndex: number,
  itemIndex: number
): ParsedItemResult | null => {
  const getValue = (field: string): any => {
    const col = columnMapping[field]?.column;
    return col ? row[col] : undefined;
  };
  
  const description = String(getValue('description') || '').trim();
  
  // Skip empty rows or section headers
  if (!description || description.length < 3) return null;
  
  const quantity = parseFloat(getValue('quantity')) || 0;
  const unit = String(getValue('unit') || 'nr').trim();
  const unitRate = parseFloat(getValue('unitRate')) || 0;
  const laborRate = parseFloat(getValue('laborRate')) || null;
  const materialRate = parseFloat(getValue('materialRate')) || null;
  const equipmentRate = parseFloat(getValue('equipmentRate')) || null;
  const totalAmount = parseFloat(getValue('totalAmount')) || quantity * unitRate;
  
  // Skip if no meaningful data
  if (quantity === 0 && unitRate === 0 && totalAmount === 0) return null;
  
  const flags: string[] = [];
  const suggestions: ParsedItemResult['suggestions'] = [];
  
  // Check for issues
  if (quantity <= 0) {
    flags.push('Invalid quantity');
  }
  if (unitRate <= 0 && totalAmount > 0) {
    flags.push('Missing rate');
    suggestions.push({
      type: 'completion',
      field: 'unitRate',
      currentValue: unitRate,
      suggestedValue: quantity > 0 ? totalAmount / quantity : 0,
      reason: 'Calculated from total ÷ quantity',
      confidence: 0.8,
    });
  }
  
  // Check calculation
  const calculated = quantity * unitRate;
  if (totalAmount > 0 && Math.abs(calculated - totalAmount) / totalAmount > 0.01) {
    flags.push('Calculation mismatch');
    suggestions.push({
      type: 'correction',
      field: 'totalAmount',
      currentValue: totalAmount,
      suggestedValue: calculated,
      reason: 'Total should equal Quantity × Rate',
      confidence: 0.9,
    });
  }
  
  const confidence = calculateItemConfidence(
    { description, quantity, unit, unitRate, totalAmount },
    row
  );
  
  return {
    tempId: `temp-${sectionIndex}-${itemIndex}-${Date.now()}`,
    itemNumber: String(getValue('itemNumber') || `${sectionIndex + 1}.${itemIndex + 1}`),
    description,
    specification: null,
    quantity,
    unit,
    laborRate,
    materialRate,
    equipmentRate,
    unitRate,
    totalAmount: totalAmount || calculated,
    confidence: {
      overall: confidence.overall,
      fields: confidence.fields,
    },
    flags,
    suggestions,
  };
};

// ============================================================================
// FULL PARSING ORCHESTRATION
// ============================================================================

/**
 * Parse full BOQ document locally
 */
export const parseFullBOQLocally = async (
  input: FullParsingInput
): Promise<FullParsingResult> => {
  const startTime = Date.now();
  const { excelData, fileName, sheetName, projectName, materialLibrary, onProgress } = input;
  
  // Progress callback helper
  const reportProgress = (stage: string, percentage: number, message?: string) => {
    onProgress?.({ stage, percentage, message });
  };
  
  // Step 1: Analyze structure
  reportProgress('analyzing', 10, 'Analyzing document structure...');
  const analysis = analyzeExcelStructureLocally({ excelData, fileName, sheetName });
  
  // Step 2: Identify section ranges
  reportProgress('parsing', 20, 'Identifying sections...');
  const sectionRanges = identifySectionRanges(
    excelData,
    analysis.sectionIndicatorRows,
    analysis.dataStartRow
  );
  
  // Step 3: Parse each section
  const parsedSections: ParsedSection[] = [];
  const previousSections: string[] = [];
  
  for (let i = 0; i < sectionRanges.length; i++) {
    const range = sectionRanges[i];
    const progressPercent = 20 + ((i / sectionRanges.length) * 50);
    reportProgress('parsing', progressPercent, `Parsing section ${i + 1} of ${sectionRanges.length}...`);
    
    const sectionData = excelData.slice(range.start, range.end);
    const result = parseSectionLocally({
      sectionData,
      columnMapping: analysis.columnMapping,
      projectName,
      previousSections,
      sectionIndex: i,
    });
    
    // Transform to ParsedSection
    const section = transformToParsedSection(result, i, range);
    parsedSections.push(section);
    previousSections.push(result.section.name);
  }
  
  // Step 4: Match materials (if library provided)
  if (materialLibrary && materialLibrary.length > 0) {
    reportProgress('matching', 75, 'Matching materials...');
    
    const allItems: MatchingInput[] = parsedSections.flatMap(s =>
      s.items.map(item => ({
        itemId: item.id,
        description: item.description,
        unit: item.unit,
        rate: item.unitRate,
      }))
    );
    
    const matches = matchMaterialsLocally(allItems, materialLibrary);
    applyMatchesToItems(parsedSections, matches);
  }
  
  reportProgress('completed', 100, 'Parsing complete!');
  
  // Build metadata
  const endTime = Date.now();
  const totalItems = parsedSections.reduce((sum, s) => sum + s.items.length, 0);
  
  const metadata: ParsingMetadata = {
    model: 'local-parser',
    modelVersion: '1.0.0',
    startTime: { toMillis: () => startTime } as any,
    endTime: { toMillis: () => endTime } as any,
    durationMs: endTime - startTime,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    sectionsFound: parsedSections.length,
    itemsFound: totalItems,
    averageConfidence: calculateAverageConfidence(parsedSections),
    itemsAutoApproved: countByStatus(parsedSections, 'auto_approved'),
    itemsNeedingReview: countByStatus(parsedSections, 'needs_review'),
    materialsMatched: countMaterialsMatched(parsedSections),
    sourceAnalysis: {
      detectedFormat: 'excel',
      headerRow: analysis.headerRow,
      dataStartRow: analysis.dataStartRow,
      columnMapping: Object.fromEntries(
        Object.entries(analysis.columnMapping).map(([k, v]) => [k, String(v.column)])
      ),
      currencyDetected: analysis.detectedCurrency,
      unitsDetected: analysis.detectedUnits,
      languageDetected: 'en',
      qualityScore: analysis.overallConfidence,
      issues: analysis.qualityIssues,
    },
  };
  
  return {
    sections: parsedSections,
    metadata,
    sourceAnalysis: metadata.sourceAnalysis,
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const identifySectionRanges = (
  data: Record<string, any>[],
  sectionRows: number[],
  dataStartRow: number
): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  
  for (let i = 0; i < sectionRows.length; i++) {
    const start = sectionRows[i];
    const end = sectionRows[i + 1] || data.length;
    ranges.push({ start, end });
  }
  
  if (ranges.length === 0 && data.length > dataStartRow) {
    ranges.push({ start: dataStartRow, end: data.length });
  }
  
  return ranges;
};

const transformToParsedSection = (
  result: SectionParsingResult,
  index: number,
  range: { start: number; end: number }
): ParsedSection => {
  const items: ParsedItem[] = result.items.map((item, itemIndex) => ({
    id: `item-${index}-${itemIndex}`,
    tempId: item.tempId,
    itemNumber: item.itemNumber,
    description: item.description,
    specification: item.specification || undefined,
    quantity: item.quantity,
    unit: item.unit,
    laborRate: item.laborRate || undefined,
    materialRate: item.materialRate || undefined,
    equipmentRate: item.equipmentRate || undefined,
    unitRate: item.unitRate,
    laborAmount: item.laborRate ? item.quantity * item.laborRate : undefined,
    materialAmount: item.materialRate ? item.quantity * item.materialRate : undefined,
    equipmentAmount: item.equipmentRate ? item.quantity * item.equipmentRate : undefined,
    totalAmount: item.totalAmount,
    confidence: {
      overall: item.confidence.overall,
      fields: item.confidence.fields,
      factors: item.flags.map(flag => ({
        factor: flag,
        impact: 'negative' as const,
        weight: 0.1,
        reason: flag,
      })),
    },
    sourceLocation: {
      startRow: range.start + itemIndex + 1,
      endRow: range.start + itemIndex + 1,
      columns: [],
    },
    extractedFields: [],
    suggestions: item.suggestions.map((s, i) => ({
      id: `suggestion-${index}-${itemIndex}-${i}`,
      type: s.type as any,
      field: s.field,
      currentValue: s.currentValue,
      suggestedValue: s.suggestedValue,
      reason: s.reason,
      confidence: s.confidence,
      applied: false,
    })),
    reviewStatus: getReviewStatus(item.confidence.overall),
  }));
  
  const sectionConfidence = calculateSectionConfidence(
    { name: result.section.name, category: result.section.category as any },
    items
  );
  
  return {
    id: `section-${index}`,
    code: result.section.code,
    name: result.section.name,
    category: result.section.category as any,
    order: index,
    items,
    confidence: sectionConfidence,
    sourceLocation: {
      startRow: range.start,
      endRow: range.end,
      columns: [],
    },
    reviewStatus: getReviewStatus(sectionConfidence.overall),
  };
};

const calculateAverageConfidence = (sections: ParsedSection[]): number => {
  const allConfidences = sections.flatMap(s =>
    s.items.map(i => i.confidence.overall)
  );
  
  if (allConfidences.length === 0) return 0;
  return allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length;
};

const countByStatus = (sections: ParsedSection[], status: string): number => {
  return sections.flatMap(s => s.items)
    .filter(i => i.reviewStatus === status)
    .length;
};

const countMaterialsMatched = (sections: ParsedSection[]): number => {
  return sections.flatMap(s => s.items)
    .filter(i => i.materialMatch && i.materialMatch.matchScore > 0.5)
    .length;
};

export default {
  analyzeExcelStructureLocally,
  parseSectionLocally,
  parseFullBOQLocally,
};
