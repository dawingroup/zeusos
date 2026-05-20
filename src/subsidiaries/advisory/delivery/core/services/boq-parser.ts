/**
 * BOQ Parser Service
 * 
 * Service for parsing BOQ documents (Excel, CSV).
 * Re-exports and adapts MatFlow's parsing infrastructure.
 */

import * as XLSX from 'xlsx';
import type { ParsedBOQItem, CleanedBOQItem, CleanupResult } from '../types/parsing';

// ─────────────────────────────────────────────────────────────────
// EXCEL PARSING
// ─────────────────────────────────────────────────────────────────

export interface ParseExcelOptions {
  file: File;
  sheetName?: string;
  onProgress?: (progress: number) => void;
}

export async function parseExcelFile(
  options: ParseExcelOptions
): Promise<ParsedBOQItem[]> {
  const { file, sheetName, onProgress } = options;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        onProgress?.(10);
        
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        onProgress?.(30);
        
        const parsedItems: ParsedBOQItem[] = [];
        const sheets = sheetName ? [sheetName] : workbook.SheetNames;
        
        for (let i = 0; i < sheets.length; i++) {
          const sheet = workbook.Sheets[sheets[i]];
          const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
          
          const progress = 30 + ((i + 1) / sheets.length) * 50;
          onProgress?.(Math.round(progress));
          
          for (const row of jsonData) {
            const item = extractBOQItem(row, parsedItems.length + 1);
            if (item) {
              parsedItems.push(item);
            }
          }
        }
        
        onProgress?.(100);
        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function extractBOQItem(row: Record<string, unknown>, index: number): ParsedBOQItem | null {
  const itemCodeKeys = ['item', 'item no', 'item code', 'no', 'ref', 'reference', 'code', 'sn', 's/n'];
  const descKeys = ['description', 'desc', 'item description', 'particulars', 'work item'];
  const qtyKeys = ['qty', 'quantity', 'qnty'];
  const unitKeys = ['unit', 'uom', 'units'];
  const rateKeys = ['rate', 'unit rate', 'price', 'unit price'];
  const amountKeys = ['amount', 'total', 'total amount', 'value'];
  
  const findValue = (keys: string[]) => {
    for (const key of keys) {
      const found = Object.entries(row).find(([k]) => k.toLowerCase().includes(key));
      if (found && found[1] !== undefined && found[1] !== '') {
        return found[1];
      }
    }
    return null;
  };
  
  const rawItemCode = findValue(itemCodeKeys);
  const description = findValue(descKeys);
  const rawQuantity = parseFloat(String(findValue(qtyKeys) || 0)) || 0;
  const quantity = Math.ceil(rawQuantity);
  const unit = String(findValue(unitKeys) || 'nr');
  const rate = parseFloat(String(findValue(rateKeys) || 0)) || 0;
  const amount = parseFloat(String(findValue(amountKeys) || 0)) || quantity * rate;
  
  if (!description && !rawItemCode) {
    return null;
  }
  
  const itemCode = rawItemCode ? String(rawItemCode).trim() : String(index);
  
  return {
    itemCode,
    description: String(description || ''),
    quantity,
    unit,
    rate,
    amount,
    confidence: 0.8,
  };
}

// ─────────────────────────────────────────────────────────────────
// BOQ CLEANUP (Full MatFlow-style implementation)
// ─────────────────────────────────────────────────────────────────

// Bill header detection patterns
const BILL_HEADER_PATTERNS = [
  /^BILL\s*(?:NO\.?|NUMBER)?\s*(\d+)/i,
  /^BILL\s+(\d+)\s*[:\-–]/i,
  /^(\d+)\s*[:\-–]?\s*BILL\s+/i,
  /^PRELIMINARIES/i,
  /^PREAMBLES/i,
];

// Section header detection patterns
const SECTION_HEADER_PATTERNS = [
  /^ELEMENT\s+([A-Z]|\d+)/i,
  /^SECTION\s+([A-Z]|\d+)/i,
  /^([A-Z])\s*[:\-–]\s+[A-Z]/i,
  /^([A-Z])\.\s+[A-Z]/i,
  /^(\d+)\.\s+[A-Z]{3,}/i,
];

// Section name keywords
const SECTION_NAME_KEYWORDS = [
  'excavation', 'earthworks', 'foundations', 'concrete', 'reinforcement',
  'formwork', 'blockwork', 'brickwork', 'masonry', 'roofing', 'carpentry',
  'joinery', 'plumbing', 'electrical', 'finishes', 'plastering', 'painting',
  'flooring', 'ceiling', 'doors', 'windows', 'ironmongery', 'drainage',
  'external works', 'landscaping', 'fencing', 'steelwork', 'structural steel',
];

// Summary row detection
const SUMMARY_KEYWORDS = [
  'total', 'sub-total', 'subtotal', 'sub total',
  'carried forward', 'c/f', 'b/f', 'brought forward',
  'carried to', 'to collection', 'to summary',
  'grand total', 'page total', 'section total',
  'amount c/f', 'amount b/f', 'sum', 'total amount',
];

const SUMMARY_PATTERNS = [
  /^total\s*$/i,
  /^sub[\s-]?total/i,
  /carried\s+(forward|to)/i,
  /brought\s+forward/i,
  /^[cb]\/f\s*$/i,
  /to\s+(collection|summary)/i,
  /page\s+\d+\s+total/i,
  /section\s+\w+\s+total/i,
];

// Governing specs extraction patterns
const GRADE_PATTERNS = [
  /\b(C\d{2}\/\d{2})\b/i,
  /\b(Grade\s*\d+[A-Z]?)\b/i,
  /\b(Class\s*[A-Z])\b/i,
  /\b(M\d+)\b/,
  /\b(BS\s*\d+)\b/i,
  /\b(ASTM\s*[A-Z]?\d+)\b/i,
];

const BRAND_PATTERNS = [
  /\b(Grohe|Geberit|Duravit|Kohler|TOTO|Roca|Ideal Standard)\b/i,
  /\b(Crown|Dulux|Jotun|Sadolin|Plascon)\b/i,
  /\b(Danpal|Alucobond|Reynobond)\b/i,
  /\b(Hager|ABB|Schneider|Legrand|Siemens)\b/i,
  /\b(Armitage Shanks|Twyfords)\b/i,
];

const FINISH_PATTERNS = [
  /\b(matt|matte|satin|gloss|polished|brushed|textured)\b/i,
  /\b(smooth|rough|fair[- ]?face[d]?)\b/i,
  /\b(powder[- ]?coat(?:ed)?|anodized|galvanized|painted)\b/i,
];

const COLOR_PATTERNS = [
  /\b(white|black|grey|gray|cream|ivory|beige|brown)\b/i,
  /\b(RAL\s*\d+)\b/i,
  /\bcolou?r[:\s]+([a-z]+)\b/i,
];

const STANDARD_PATTERNS = [
  /\b(BS\s*\d+(?:[-:]\d+)?)\b/i,
  /\b(EN\s*\d+(?:[-:]\d+)?)\b/i,
  /\b(ASTM\s*[A-Z]?\d+)\b/i,
  /\b(ACI\s*\d+)\b/i,
];

// Specification extraction patterns
const SPEC_PATTERNS = [
  /\d+\s*(?:mm|cm|m|")?\s*[x×]\s*\d+\s*(?:mm|cm|m|")?(?:\s*[x×]\s*\d+\s*(?:mm|cm|m|")?)?/gi,
  /\d+\s*(?:mm|cm)\s*(?:thick|thk|thck)/gi,
  /(?:Ø|dia(?:meter)?\.?)\s*\d+\s*(?:mm)?/gi,
  /(?:grade\s+)?[cC]\d{2,3}(?:\/\d+)?/g,
  /grade\s+\d+/gi,
  /BS\s+\d+/gi,
  /[YTR]\d{1,2}(?:@\d+)?/g,
  /@?\d+\s*(?:mm)?\s*c\/c/gi,
  /\d+:\d+(?::\d+)?/g,
  /\([^)]+\)/g,
];

// Category keywords - maps to BOQCategory type
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  preliminaries: ['preliminary', 'preliminaries', 'general', 'site', 'mobilization', 'insurance', 'bond'],
  substructure: ['foundation', 'footing', 'substructure', 'ground floor', 'ground beam', 'excavation', 'hardcore', 'blinding', 'dpc', 'concrete', 'cement', 'mortar', 'screed', 'reinforcement', 'rebar', 'brc', 'mesh', 'earthworks', 'backfill', 'murram', 'compaction'],
  superstructure: ['superstructure', 'wall', 'column', 'beam', 'slab', 'staircase', 'lintel', 'block', 'brick', 'masonry', 'blockwork', 'brickwork', 'stone', 'steel', 'structural', 'timber', 'wood', 'formwork', 'shuttering'],
  finishes: ['plaster', 'render', 'paint', 'tile', 'terrazzo', 'ceiling', 'floor finish', 'skirting', 'finish', 'door', 'window', 'frame', 'glazing', 'glass', 'shutter', 'ironmongery'],
  services: ['plumbing', 'water', 'drain', 'sanitary', 'toilet', 'sink', 'tap', 'valve', 'electrical', 'cable', 'wire', 'socket', 'switch', 'conduit', 'lighting', 'light', 'hvac', 'mechanical'],
  external_works: ['external', 'paving', 'landscaping', 'fence', 'gate', 'driveway', 'compound', 'drainage'],
  provisional: ['provisional', 'prime cost', 'pc sum', 'daywork'],
  contingency: ['contingency', 'allowance'],
  professional_fees: ['professional', 'consultant', 'architect', 'engineer', 'quantity surveyor'],
  other: [],
};

// Stage keywords
const STAGE_KEYWORDS: Record<string, string[]> = {
  preliminaries: ['preliminary', 'preliminaries', 'general', 'site', 'mobilization'],
  substructure: ['foundation', 'footing', 'substructure', 'ground floor', 'ground beam', 'excavation', 'hardcore', 'blinding', 'dpc'],
  superstructure: ['superstructure', 'wall', 'column', 'beam', 'slab', 'staircase', 'lintel', 'first floor', 'second floor'],
  roofing: ['roof', 'roofing', 'truss', 'purlin', 'rafter', 'fascia', 'ridge'],
  finishes: ['finish', 'plaster', 'render', 'paint', 'tile', 'ceiling', 'floor finish', 'skirting'],
  services: ['electrical', 'plumbing', 'mechanical', 'hvac', 'drainage'],
  external_works: ['external', 'paving', 'landscaping', 'fence', 'gate', 'driveway', 'compound'],
};

function detectBillHeader(item: ParsedBOQItem): string | null {
  const desc = item.description.trim();
  
  for (const pattern of BILL_HEADER_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      return match[1] || '1';
    }
  }
  
  if (/^PRELIMINARIES|^PREAMBLES/i.test(desc)) {
    return '1';
  }
  
  const billMarkerMatch = desc.match(/^BILL:\s*(.+)/i);
  if (billMarkerMatch) {
    return billMarkerMatch[1];
  }
  
  return null;
}

function detectSectionHeader(item: ParsedBOQItem): { code: string; name: string } | null {
  const desc = item.description.trim();
  
  for (const pattern of SECTION_HEADER_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      const code = match[1] || '';
      const nameMatch = desc.match(/^(?:ELEMENT|SECTION)?\s*[A-Z\d]+\s*[:\-–.]?\s*(.+)/i);
      const name = nameMatch ? nameMatch[1].trim() : desc;
      return { code, name };
    }
  }
  
  const descLower = desc.toLowerCase();
  if (item.quantity === 0 && desc.length < 50) {
    for (const keyword of SECTION_NAME_KEYWORDS) {
      if (descLower.includes(keyword)) {
        return { code: desc.charAt(0).toUpperCase(), name: desc };
      }
    }
  }
  
  return null;
}

function extractGoverningSpecs(item: ParsedBOQItem): CleanedBOQItem['governingSpecs'] | null {
  const desc = item.description;
  const specs: NonNullable<CleanedBOQItem['governingSpecs']> = {};
  let hasSpecs = false;
  
  for (const pattern of GRADE_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.materialGrade = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  for (const pattern of BRAND_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.brand = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  for (const pattern of FINISH_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.finish = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  for (const pattern of COLOR_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.color = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  for (const pattern of STANDARD_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.standardRef = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  if (desc.length > 20 && (hasSpecs || /specification|spec|material|grade|class/i.test(desc))) {
    specs.generalSpecs = desc.substring(0, 200);
    specs.sourceItemCode = item.itemCode;
    hasSpecs = true;
  }
  
  return hasSpecs ? specs : null;
}

function isHeaderRow(item: ParsedBOQItem): boolean {
  const desc = item.description.trim();
  
  if (item.quantity > 0 || (item.amount && item.amount > 0)) {
    return false;
  }
  
  if (desc.length < 60) {
    const upperCount = (desc.match(/[A-Z]/g) || []).length;
    const letterCount = (desc.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount > 0.7) {
      return true;
    }
  }
  
  return false;
}

function isSummaryRow(item: ParsedBOQItem): boolean {
  const desc = item.description.toLowerCase().trim();
  
  for (const keyword of SUMMARY_KEYWORDS) {
    if (desc.includes(keyword)) {
      return true;
    }
  }
  
  for (const pattern of SUMMARY_PATTERNS) {
    if (pattern.test(desc)) {
      return true;
    }
  }
  
  if (desc.length < 20 && item.quantity === 0 && (item.amount || 0) > 0) {
    return true;
  }
  
  return false;
}

function extractNameAndSpecs(description: string): { name: string; specifications: string } {
  const originalDesc = description.trim();
  let workingDesc = originalDesc;
  const extractedSpecs: string[] = [];
  
  for (const pattern of SPEC_PATTERNS) {
    const matches = workingDesc.match(pattern);
    if (matches) {
      extractedSpecs.push(...matches);
      workingDesc = workingDesc.replace(pattern, ' ');
    }
  }
  
  let name = workingDesc
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
    .trim();
  
  if (name.length < 5) {
    name = originalDesc.split(/[,;(]/)[0].trim();
  }
  
  name = name.charAt(0).toUpperCase() + name.slice(1);
  
  const specifications = extractedSpecs
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join(', ');
  
  return { name, specifications };
}

function detectCategory(description: string): string | undefined {
  const desc = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return category;
      }
    }
  }
  
  return undefined;
}

function detectStage(description: string): string | undefined {
  const desc = description.toLowerCase();
  
  for (const [stage, keywords] of Object.entries(STAGE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return stage;
      }
    }
  }
  
  return undefined;
}

export async function cleanupBOQItems(
  items: ParsedBOQItem[]
): Promise<CleanupResult> {
  const cleanedItems: CleanedBOQItem[] = [];
  const removedSummaryRows: CleanedBOQItem[] = [];
  
  let currentBillNumber = '1';
  let currentBillName = '';
  let currentElementCode = '';
  let currentElementName = '';
  let currentSectionCode = '';
  let currentSectionName = '';
  
  const sectionSpecs: Map<string, NonNullable<CleanedBOQItem['governingSpecs']>> = new Map();
  
  for (const item of items) {
    const isSummary = isSummaryRow(item);
    const isHeader = isHeaderRow(item);
    const { name, specifications } = extractNameAndSpecs(item.description);
    const detectedCategory = detectCategory(item.description);
    const detectedStage = detectStage(item.description);
    
    const detectedBill = detectBillHeader(item);
    if (detectedBill) {
      currentBillNumber = detectedBill;
      currentBillName = name;
      currentElementCode = '';
      currentElementName = '';
      currentSectionCode = '';
      currentSectionName = '';
    }
    
    const detectedSection = detectSectionHeader(item);
    if (detectedSection) {
      currentSectionCode = detectedSection.code;
      currentSectionName = detectedSection.name || name;
    }
    
    const codeParts = (item.itemCode || '').split(/[.\-\/]/).filter(Boolean);
    
    let billNumber = currentBillNumber;
    let elementCode = currentElementCode;
    let sectionCode = currentSectionCode;
    let workItemCode = '';
    let hierarchyLevel = 0;
    
    if (codeParts.length >= 1) {
      const newBill = codeParts[0];
      if (newBill !== currentBillNumber) {
        currentBillNumber = newBill;
        currentBillName = name;
        currentElementCode = '';
        currentElementName = '';
        currentSectionCode = '';
        currentSectionName = '';
      }
      billNumber = newBill;
      hierarchyLevel = 1;
    }
    
    if (codeParts.length >= 2) {
      const newElement = codeParts[1];
      if (newElement !== currentElementCode) {
        currentElementCode = newElement;
        currentElementName = name;
        currentSectionCode = '';
        currentSectionName = '';
      }
      elementCode = newElement;
      hierarchyLevel = 2;
    }
    
    if (codeParts.length >= 3) {
      const newSection = codeParts[2];
      if (newSection !== currentSectionCode) {
        currentSectionCode = newSection;
        currentSectionName = name;
      }
      sectionCode = newSection;
      hierarchyLevel = 3;
    }
    
    if (codeParts.length >= 4) {
      workItemCode = codeParts.slice(3).join('.');
      hierarchyLevel = 4;
    }
    
    if (codeParts.length === 0) {
      billNumber = currentBillNumber;
      elementCode = currentElementCode;
      sectionCode = currentSectionCode;
      if (currentSectionCode) hierarchyLevel = 4;
      else if (currentElementCode) hierarchyLevel = 3;
      else if (currentBillNumber) hierarchyLevel = 2;
      else hierarchyLevel = 1;
    }
    
    const hierarchyPath = [billNumber, elementCode, sectionCode, workItemCode]
      .filter(Boolean)
      .join('.');
    
    const isSpecificationRow = hierarchyLevel === 3 && !workItemCode;
    
    let governingSpecs: CleanedBOQItem['governingSpecs'];
    const sectionKey = `${billNumber}.${elementCode}.${sectionCode}`;
    
    if (isSpecificationRow) {
      const extractedSpecs = extractGoverningSpecs(item);
      if (extractedSpecs) {
        sectionSpecs.set(sectionKey, extractedSpecs);
        governingSpecs = extractedSpecs;
      }
    } else if (hierarchyLevel === 4) {
      governingSpecs = sectionSpecs.get(sectionKey);
    }
    
    const enhancementReasons: string[] = [];
    let needsEnhancement = false;
    
    if (hierarchyLevel === 4 && !isSummary && !isHeader) {
      if (!governingSpecs) {
        enhancementReasons.push('No governing specs from parent section');
        needsEnhancement = true;
      } else {
        if (!governingSpecs.materialGrade && !governingSpecs.materialType) {
          enhancementReasons.push('Missing material grade or type');
          needsEnhancement = true;
        }
      }
      
      if (name.length < 15 && !specifications) {
        enhancementReasons.push('Description too brief');
        needsEnhancement = true;
      }
      
      const vagueTerms = ['supply', 'provide', 'install', 'fix', 'as specified', 'as described', 'ditto', 'as above'];
      const hasVagueTerms = vagueTerms.some(term => item.description.toLowerCase().includes(term));
      if (hasVagueTerms && !governingSpecs?.materialType && !governingSpecs?.materialGrade) {
        enhancementReasons.push('Contains generic terms without specific specs');
        needsEnhancement = true;
      }
    }
    
    const cleanedItem: CleanedBOQItem = {
      ...item,
      itemName: name,
      specifications,
      isSummaryRow: isSummary || isHeader,
      billNumber,
      billName: currentBillName || undefined,
      elementCode,
      elementName: currentElementName || undefined,
      sectionCode,
      sectionName: currentSectionName || undefined,
      workItemCode,
      hierarchyPath,
      hierarchyLevel,
      isSpecificationRow,
      governingSpecs,
      needsEnhancement,
      enhancementReasons: enhancementReasons.length > 0 ? enhancementReasons : undefined,
      category: item.category || detectedCategory,
      stage: item.stage || detectedStage,
      cleanupNotes: [],
    };
    
    if (isSummary) {
      cleanedItem.cleanupNotes.push('Detected as summary/total row');
    }
    if (isHeader && !isSummary) {
      cleanedItem.cleanupNotes.push('Detected as header row');
    }
    if (detectedBill) {
      cleanedItem.cleanupNotes.push(`Bill ${detectedBill} header`);
    }
    if (detectedSection) {
      cleanedItem.cleanupNotes.push(`Section ${detectedSection.code}: ${detectedSection.name}`);
    }
    if (specifications) {
      cleanedItem.cleanupNotes.push(`Extracted specs: ${specifications}`);
    }
    if (detectedCategory && !item.category) {
      cleanedItem.cleanupNotes.push(`Auto-detected category: ${detectedCategory}`);
    }
    if (detectedStage && !item.stage) {
      cleanedItem.cleanupNotes.push(`Auto-detected stage: ${detectedStage}`);
    }
    if (isSpecificationRow && governingSpecs) {
      const specParts: string[] = [];
      if (governingSpecs.materialGrade) specParts.push(`Grade: ${governingSpecs.materialGrade}`);
      if (governingSpecs.brand) specParts.push(`Brand: ${governingSpecs.brand}`);
      if (governingSpecs.finish) specParts.push(`Finish: ${governingSpecs.finish}`);
      if (governingSpecs.standardRef) specParts.push(`Std: ${governingSpecs.standardRef}`);
      if (specParts.length > 0) {
        cleanedItem.cleanupNotes.push(`Governing specs: ${specParts.join(', ')}`);
      }
    }
    if (hierarchyLevel === 4 && governingSpecs) {
      cleanedItem.cleanupNotes.push(`Inherits specs from ${governingSpecs.sourceItemCode || sectionKey}`);
    }
    if (needsEnhancement) {
      cleanedItem.cleanupNotes.push(`Needs enhancement: ${enhancementReasons.join('; ')}`);
    }
    
    if (isSummary) {
      removedSummaryRows.push(cleanedItem);
    } else {
      cleanedItems.push(cleanedItem);
    }
  }
  
  const avgConfidence = cleanedItems.length > 0
    ? cleanedItems.reduce((sum, item) => sum + (item.confidence || 0), 0) / cleanedItems.length
    : 0;
  
  const needsEnhancementCount = cleanedItems.filter(i => i.needsEnhancement).length;
  const specificationRowsCount = cleanedItems.filter(i => i.isSpecificationRow).length;
  const workItemsCount = cleanedItems.filter(i => i.hierarchyLevel === 4 && !i.isSummaryRow).length;
  
  return {
    cleanedItems,
    removedSummaryRows,
    stats: {
      totalOriginal: items.length,
      totalCleaned: cleanedItems.length,
      summaryRowsRemoved: removedSummaryRows.length,
      formulasMatched: 0,
      avgConfidence,
      needsEnhancement: needsEnhancementCount,
      specificationRows: specificationRowsCount,
      workItems: workItemsCount,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// FULL PARSING PIPELINE
// ─────────────────────────────────────────────────────────────────

export interface ParseAndCleanOptions {
  file: File;
  sheetName?: string;
  onProgress?: (stage: string, progress: number) => void;
}

export async function parseAndCleanBOQ(
  options: ParseAndCleanOptions
): Promise<CleanupResult> {
  const { file, sheetName, onProgress } = options;
  
  onProgress?.('parsing', 0);
  
  const parsedItems = await parseExcelFile({
    file,
    sheetName,
    onProgress: (p) => onProgress?.('parsing', p),
  });
  
  onProgress?.('cleaning', 50);
  
  const result = await cleanupBOQItems(parsedItems);
  
  onProgress?.('complete', 100);
  
  return result;
}
