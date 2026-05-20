/**
 * BOQ Cleanup Service
 * AI-powered cleanup and enrichment of parsed BOQ items
 */

import type { ParsedBOQItem } from './schemas/boqSchema';
import type { StandardFormula, MaterialCategory } from '../types';
import { getFormulas } from '../services/formulaService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Governing specifications extracted from Level 3 (Element Section) items
 * These specs are inherited by Level 4 work items
 */
export interface GoverningSpecs {
  /** Material grade (e.g., "C25/30", "Grade 460B", "Class A") */
  materialGrade?: string;
  /** Brand specifications (e.g., "Grohe", "Danpal", "Crown Paints") */
  brand?: string;
  /** Standard/code reference (e.g., "BS 8110", "ASTM A615") */
  standardRef?: string;
  /** Finish specification (e.g., "Matt", "Satin", "Polished") */
  finish?: string;
  /** Color specification */
  color?: string;
  /** Size/dimensions (e.g., "600x600mm", "150mm thick") */
  size?: string;
  /** Material type (e.g., "Ceramic", "Porcelain", "Hardwood") */
  materialType?: string;
  /** Installation method (e.g., "Bonded", "Floating", "Mechanical fix") */
  installationMethod?: string;
  /** General specifications text */
  generalSpecs?: string;
  /** Source item code where specs were defined */
  sourceItemCode?: string;
}

/**
 * Enhanced specifications after AI processing
 */
export interface EnhancedSpecs extends GoverningSpecs {
  /** Whether specs were enhanced by AI */
  aiEnhanced: boolean;
  /** Combined description used for enhancement */
  combinedContext?: string;
  /** AI confidence in the extracted specs (0-1) */
  confidence: number;
  /** Missing critical specs that need manual input */
  missingCritical?: string[];
  /** Suggested products/materials based on specs */
  suggestedProducts?: string[];
}

export interface CleanedBOQItem extends ParsedBOQItem {
  /** Extracted item name (short, clean) */
  itemName: string;
  /** Extracted specifications (dimensions, materials, etc.) */
  specifications: string;
  /** Whether this row is a subtotal/total row */
  isSummaryRow: boolean;
  /** 
   * Hierarchical structure:
   * Level 1 = Bill (categorization)
   * Level 1.1 = Element (categorization)
   * Level 1.1.1 = Element Section (specification - governs work items)
   * Level 1.1.1.1 = Work Item (inherits specs from level 3)
   */
  billNumber: string;      // Level 1: Bill (e.g., "1")
  billName?: string;       // Level 1: Bill name from description
  elementCode: string;     // Level 2: Element (e.g., "1")
  elementName?: string;    // Level 2: Element name from description
  sectionCode: string;     // Level 3: Element Section (e.g., "1")
  sectionName?: string;    // Level 3: Section name from description
  workItemCode: string;    // Level 4: Work Item (e.g., "1")
  /** Full hierarchical path for display */
  hierarchyPath: string;   // e.g., "1.1.1.1"
  /** Hierarchy level (1-4) */
  hierarchyLevel: number;
  /** Whether this is a specification row (Level 3) that governs work items */
  isSpecificationRow: boolean;
  /** Governing specs - either defined (Level 3) or inherited (Level 4) */
  governingSpecs?: GoverningSpecs;
  /** AI-enhanced specs (combining Level 3 + Level 4 info) */
  enhancedSpecs?: EnhancedSpecs;
  /** Whether this item needs manual enhancement before material extraction */
  needsEnhancement: boolean;
  /** Reasons why enhancement is needed */
  enhancementReasons?: string[];
  /** Suggested formula match */
  suggestedFormula?: {
    formulaId: string;
    formulaCode: string;
    formulaName: string;
    matchScore: number;
  };
  /** Generated material requirements based on formula */
  materialRequirements?: MaterialRequirement[];
  /** Cleanup notes/warnings */
  cleanupNotes: string[];
}

export interface MaterialRequirement {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
}

export interface CleanupResult {
  cleanedItems: CleanedBOQItem[];
  removedSummaryRows: CleanedBOQItem[];
  stats: {
    totalOriginal: number;
    totalCleaned: number;
    summaryRowsRemoved: number;
    formulasMatched: number;
    avgConfidence: number;
    needsEnhancement: number;
    specificationRows: number;
    workItems: number;
  };
}

// ============================================================================
// BILL AND SECTION HEADER DETECTION
// ============================================================================

// Patterns to detect bill headers (e.g., "BILL NO. 1", "BILL 1: SUBSTRUCTURE")
const BILL_HEADER_PATTERNS = [
  /^BILL\s*(?:NO\.?|NUMBER)?\s*(\d+)/i,
  /^BILL\s+(\d+)\s*[:\-–]/i,
  /^(\d+)\s*[:\-–]?\s*BILL\s+/i,
  /^PRELIMINARIES/i,  // Often Bill 1
  /^PREAMBLES/i,      // Often Bill 1
];

// Patterns to detect section/element headers
const SECTION_HEADER_PATTERNS = [
  /^ELEMENT\s+([A-Z]|\d+)/i,
  /^SECTION\s+([A-Z]|\d+)/i,
  /^([A-Z])\s*[:\-–]\s+[A-Z]/i,  // "A: EXCAVATION", "B - CONCRETE"
  /^([A-Z])\.\s+[A-Z]/i,         // "A. EXCAVATION"
  /^(\d+)\.\s+[A-Z]{3,}/i,       // "1. EXCAVATION" (but only if description is all caps)
];

// Common section names that indicate a new section
const SECTION_NAME_KEYWORDS = [
  'excavation', 'earthworks', 'foundations', 'concrete', 'reinforcement',
  'formwork', 'blockwork', 'brickwork', 'masonry', 'roofing', 'carpentry',
  'joinery', 'plumbing', 'electrical', 'finishes', 'plastering', 'painting',
  'flooring', 'ceiling', 'doors', 'windows', 'ironmongery', 'drainage',
  'external works', 'landscaping', 'fencing', 'steelwork', 'structural steel',
];


/**
 * Detect if an item is a bill header and extract bill info
 */
function detectBillHeader(item: ParsedBOQItem & { __isSheetHeader?: boolean; __sheetName?: string }): string | null {
  const desc = item.description.trim();
  
  // Check for sheet header marker (from multi-sheet parsing)
  if (item.__isSheetHeader && item.__sheetName) {
    // Use sheet name as bill identifier
    // Extract bill number if sheet name contains it, otherwise use sheet name
    const sheetBillMatch = item.__sheetName.match(/bill\s*(\d+)/i);
    if (sheetBillMatch) {
      return sheetBillMatch[1];
    }
    // Use sheet index or name as bill number
    return item.__sheetName;
  }
  
  // Check bill patterns in description
  for (const pattern of BILL_HEADER_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      // If pattern has capture group, use it; otherwise use "1"
      return match[1] || '1';
    }
  }
  
  // Check for "PRELIMINARIES" or "PREAMBLES" which is typically Bill 1
  if (/^PRELIMINARIES|^PREAMBLES/i.test(desc)) {
    return '1';
  }
  
  // Check if description starts with "BILL:" (from multi-sheet marker)
  const billMarkerMatch = desc.match(/^BILL:\s*(.+)/i);
  if (billMarkerMatch) {
    return billMarkerMatch[1];
  }
  
  return null;
}

/**
 * Detect if an item is a section/element header and extract section info
 */
function detectSectionHeader(item: ParsedBOQItem): { code: string; name: string } | null {
  const desc = item.description.trim();
  
  // Check section patterns
  for (const pattern of SECTION_HEADER_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      const code = match[1] || '';
      // Extract section name - everything after the code
      const nameMatch = desc.match(/^(?:ELEMENT|SECTION)?\s*[A-Z\d]+\s*[:\-–.]?\s*(.+)/i);
      const name = nameMatch ? nameMatch[1].trim() : desc;
      return { code, name };
    }
  }
  
  // Check if description is a section keyword (all caps, short, no quantity)
  const descLower = desc.toLowerCase();
  if (item.quantity === 0 && desc.length < 50) {
    for (const keyword of SECTION_NAME_KEYWORDS) {
      if (descLower.includes(keyword)) {
        // Use first letter as section code
        return { code: desc.charAt(0).toUpperCase(), name: desc };
      }
    }
  }
  
  return null;
}

// ============================================================================
// GOVERNING SPECS EXTRACTION (Level 3)
// ============================================================================

// Patterns to extract material grades
const GRADE_PATTERNS = [
  /\b(C\d{2}\/\d{2})\b/i,                    // Concrete: C25/30, C30/37
  /\b(Grade\s*\d+[A-Z]?)\b/i,                // Steel: Grade 460B, Grade 250
  /\b(Class\s*[A-Z])\b/i,                    // Class A, Class B
  /\b(M\d+)\b/,                              // Mortar: M10, M15
  /\b(BS\s*\d+)\b/i,                         // BS grades
  /\b(ASTM\s*[A-Z]?\d+)\b/i,                 // ASTM standards
];

// Patterns to extract brands
const BRAND_PATTERNS = [
  /\b(Grohe|Geberit|Duravit|Kohler|TOTO|Roca|Ideal Standard)\b/i,  // Sanitary
  /\b(Crown|Dulux|Jotun|Sadolin|Plascon)\b/i,                      // Paints
  /\b(Danpal|Alucobond|Reynobond)\b/i,                             // Cladding
  /\b(Hager|ABB|Schneider|Legrand|Siemens)\b/i,                    // Electrical
  /\b(Armitage Shanks|Twyfords)\b/i,                               // Sanitary UK
];

// Patterns to extract finish specs
const FINISH_PATTERNS = [
  /\b(matt|matte|satin|gloss|polished|brushed|textured)\b/i,
  /\b(smooth|rough|fair[- ]?face[d]?)\b/i,
  /\b(powder[- ]?coat(?:ed)?|anodized|galvanized|painted)\b/i,
];

// Patterns to extract color specs
const COLOR_PATTERNS = [
  /\b(white|black|grey|gray|cream|ivory|beige|brown)\b/i,
  /\b(RAL\s*\d+)\b/i,                        // RAL color codes
  /\bcolou?r[:\s]+([a-z]+)\b/i,              // "color: white"
];

// Patterns to extract standard references
const STANDARD_PATTERNS = [
  /\b(BS\s*\d+(?:[-:]\d+)?)\b/i,             // BS 8110, BS EN 1992-1-1
  /\b(EN\s*\d+(?:[-:]\d+)?)\b/i,             // EN 206, EN 1992
  /\b(ASTM\s*[A-Z]?\d+)\b/i,                 // ASTM A615
  /\b(ACI\s*\d+)\b/i,                        // ACI 318
];

/**
 * Extract governing specifications from a Level 3 description
 */
function extractGoverningSpecs(item: ParsedBOQItem): GoverningSpecs | null {
  const desc = item.description;
  const specs: GoverningSpecs = {};
  let hasSpecs = false;
  
  // Extract material grade
  for (const pattern of GRADE_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.materialGrade = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  // Extract brand
  for (const pattern of BRAND_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.brand = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  // Extract finish
  for (const pattern of FINISH_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.finish = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  // Extract color
  for (const pattern of COLOR_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.color = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  // Extract standard reference
  for (const pattern of STANDARD_PATTERNS) {
    const match = desc.match(pattern);
    if (match) {
      specs.standardRef = match[1];
      hasSpecs = true;
      break;
    }
  }
  
  // Store general specs if description has spec-like content
  if (desc.length > 20 && (hasSpecs || /specification|spec|material|grade|class/i.test(desc))) {
    specs.generalSpecs = desc.substring(0, 200);
    specs.sourceItemCode = item.itemCode;
    hasSpecs = true;
  }
  
  return hasSpecs ? specs : null;
}

/**
 * Check if a row appears to be a header row (no quantity, short description, often all caps)
 */
function isHeaderRow(item: ParsedBOQItem): boolean {
  const desc = item.description.trim();
  
  // Header rows typically have no quantity and no amount
  if (item.quantity > 0 || (item.amount && item.amount > 0)) {
    return false;
  }
  
  // Short descriptions that are all or mostly uppercase
  if (desc.length < 60) {
    const upperCount = (desc.match(/[A-Z]/g) || []).length;
    const letterCount = (desc.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount > 0.7) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// SUMMARY ROW DETECTION
// ============================================================================

const SUMMARY_KEYWORDS = [
  'total', 'sub-total', 'subtotal', 'sub total',
  'carried forward', 'c/f', 'b/f', 'brought forward',
  'carried to', 'to collection', 'to summary',
  'grand total', 'page total', 'section total',
  'amount c/f', 'amount b/f',
  'sum', 'total amount',
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

/**
 * Check if a row is a summary/total row
 */
function isSummaryRow(item: ParsedBOQItem): boolean {
  const desc = item.description.toLowerCase().trim();
  
  // Check keywords
  for (const keyword of SUMMARY_KEYWORDS) {
    if (desc.includes(keyword)) {
      return true;
    }
  }
  
  // Check patterns
  for (const pattern of SUMMARY_PATTERNS) {
    if (pattern.test(desc)) {
      return true;
    }
  }
  
  // Check if description is very short and has no quantity but has amount
  if (desc.length < 20 && item.quantity === 0 && (item.amount || 0) > 0) {
    return true;
  }
  
  return false;
}

// ============================================================================
// NAME/SPECIFICATION EXTRACTION
// ============================================================================

const SPEC_PATTERNS = [
  // Dimensions: 200mm x 300mm, 200x300, 200 x 300 mm
  /\d+\s*(?:mm|cm|m|")?\s*[x×]\s*\d+\s*(?:mm|cm|m|")?(?:\s*[x×]\s*\d+\s*(?:mm|cm|m|")?)?/gi,
  // Thickness: 20mm thick, 150mm thk
  /\d+\s*(?:mm|cm)\s*(?:thick|thk|thck)/gi,
  // Diameter: Ø12, dia 12mm, 12mm dia
  /(?:Ø|dia(?:meter)?\.?)\s*\d+\s*(?:mm)?/gi,
  // Grade: C25, C30, grade 43, BS 4449
  /(?:grade\s+)?[cC]\d{2,3}(?:\/\d+)?/g,
  /grade\s+\d+/gi,
  /BS\s+\d+/gi,
  // Size specs: size 12, Y12, T12, R12
  /[YTR]\d{1,2}(?:@\d+)?/g,
  // Spacing: @200c/c, 200mm c/c
  /@?\d+\s*(?:mm)?\s*c\/c/gi,
  // Mix ratios: 1:2:4, 1:3
  /\d+:\d+(?::\d+)?/g,
  // Material specs in parentheses
  /\([^)]+\)/g,
];

interface ExtractedParts {
  name: string;
  specifications: string;
}

/**
 * Extract item name and specifications from description
 */
function extractNameAndSpecs(description: string): ExtractedParts {
  const originalDesc = description.trim();
  let workingDesc = originalDesc;
  const extractedSpecs: string[] = [];
  
  // Extract specification patterns
  for (const pattern of SPEC_PATTERNS) {
    const matches = workingDesc.match(pattern);
    if (matches) {
      extractedSpecs.push(...matches);
      workingDesc = workingDesc.replace(pattern, ' ');
    }
  }
  
  // Clean up the name
  let name = workingDesc
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')  // Trim punctuation
    .trim();
  
  // If name is too short, use original description
  if (name.length < 5) {
    name = originalDesc.split(/[,;(]/)[0].trim();
  }
  
  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);
  
  // Join extracted specs
  const specifications = extractedSpecs
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join(', ');
  
  return { name, specifications };
}

// ============================================================================
// CATEGORY DETECTION
// ============================================================================

const CATEGORY_KEYWORDS: Record<MaterialCategory | string, string[]> = {
  concrete: ['concrete', 'cement', 'mortar', 'screed', 'blinding', 'slab', 'beam', 'column', 'foundation', 'footing'],
  masonry: ['block', 'brick', 'masonry', 'wall', 'blockwork', 'brickwork', 'stone'],
  steel: ['steel', 'reinforcement', 'rebar', 'brc', 'mesh', 'bar', 'y12', 'y16', 'y20', 't12', 't16'],
  timber: ['timber', 'wood', 'formwork', 'shuttering', 'plywood', 'hardwood', 'softwood', 'boarding'],
  roofing: ['roof', 'roofing', 'tiles', 'iron sheet', 'ridge', 'fascia', 'gutter', 'truss'],
  finishes: ['plaster', 'render', 'paint', 'tile', 'terrazzo', 'ceiling', 'floor', 'wall finish', 'skirting'],
  plumbing: ['pipe', 'plumbing', 'water', 'drain', 'sanitary', 'toilet', 'sink', 'tap', 'valve'],
  electrical: ['electrical', 'cable', 'wire', 'socket', 'switch', 'conduit', 'lighting', 'light'],
  doors_windows: ['door', 'window', 'frame', 'glazing', 'glass', 'shutter'],
  earthworks: ['excavation', 'excavate', 'backfill', 'hardcore', 'murram', 'compaction', 'fill'],
};

/**
 * Detect category from description
 */
function detectCategory(description: string): MaterialCategory | undefined {
  const desc = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return category as MaterialCategory;
      }
    }
  }
  
  return undefined;
}

// ============================================================================
// STAGE DETECTION
// ============================================================================

const STAGE_KEYWORDS: Record<string, string[]> = {
  preliminaries: ['preliminary', 'preliminaries', 'general', 'site', 'mobilization'],
  substructure: ['foundation', 'footing', 'substructure', 'ground floor', 'ground beam', 'excavation', 'hardcore', 'blinding', 'dpc'],
  superstructure: ['superstructure', 'wall', 'column', 'beam', 'slab', 'staircase', 'lintel', 'first floor', 'second floor'],
  roofing: ['roof', 'roofing', 'truss', 'purlin', 'rafter', 'fascia', 'ridge'],
  finishes: ['finish', 'plaster', 'render', 'paint', 'tile', 'ceiling', 'floor finish', 'skirting'],
  services: ['electrical', 'plumbing', 'mechanical', 'hvac', 'drainage'],
  external_works: ['external', 'paving', 'landscaping', 'fence', 'gate', 'driveway', 'compound'],
};

/**
 * Detect construction stage from description
 */
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

// ============================================================================
// FORMULA MATCHING
// ============================================================================

/**
 * Find best matching formula for a BOQ item
 */
async function findMatchingFormula(
  item: ParsedBOQItem,
  formulas: StandardFormula[]
): Promise<{ formula: StandardFormula; score: number } | null> {
  const desc = item.description.toLowerCase();
  const category = item.category || detectCategory(item.description);
  
  let bestMatch: { formula: StandardFormula; score: number } | null = null;
  
  for (const formula of formulas) {
    let score = 0;
    
    // Category match
    if (category && formula.category === category) {
      score += 30;
    }
    
    // Keyword matches
    for (const keyword of (formula.keywords || [])) {
      if (desc.includes(keyword.toLowerCase())) {
        score += 15;
      }
    }
    
    // Name similarity
    const formulaName = formula.name.toLowerCase();
    const words = formulaName.split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && desc.includes(word)) {
        score += 10;
      }
    }
    
    // Unit match
    if (item.unit && formula.outputUnit === item.unit) {
      score += 20;
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { formula, score };
    }
  }
  
  // Only return if score is above threshold
  if (bestMatch && bestMatch.score >= 30) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Calculate material requirements from formula and quantity
 */
function calculateMaterialRequirements(
  formula: StandardFormula,
  boqQuantity: number
): MaterialRequirement[] {
  return formula.components.map(component => ({
    materialId: component.materialId,
    materialName: component.materialName,
    quantity: boqQuantity * component.quantity * (1 + component.wastagePercent / 100),
    unit: component.unit,
    wastagePercent: component.wastagePercent,
  }));
}

// ============================================================================
// MAIN CLEANUP FUNCTION
// ============================================================================

/**
 * Clean and enrich parsed BOQ items
 */
export async function cleanupBOQItems(
  items: ParsedBOQItem[],
  options?: {
    removeSummaryRows?: boolean;
    matchFormulas?: boolean;
    calculateMaterials?: boolean;
  }
): Promise<CleanupResult> {
  const opts = {
    removeSummaryRows: true,
    matchFormulas: true,
    calculateMaterials: true,
    ...options,
  };
  
  // Load formulas for matching
  let formulas: StandardFormula[] = [];
  if (opts.matchFormulas) {
    try {
      formulas = await getFormulas();
    } catch (err) {
      console.error('Failed to load formulas:', err);
    }
  }
  
  const cleanedItems: CleanedBOQItem[] = [];
  const removedSummaryRows: CleanedBOQItem[] = [];
  let formulasMatched = 0;
  
  // Track current hierarchy context as we process items sequentially
  let currentBillNumber = '1';
  let currentBillName = '';
  let currentElementCode = '';
  let currentElementName = '';
  let currentSectionCode = '';
  let currentSectionName = '';
  // Track governing specs from Level 3 items - key is "billNumber.elementCode.sectionCode"
  const sectionSpecs: Map<string, GoverningSpecs> = new Map();
  
  for (const item of items) {
    const isSummary = isSummaryRow(item);
    const { name, specifications } = extractNameAndSpecs(item.description);
    const detectedCategory = detectCategory(item.description);
    const detectedStage = detectStage(item.description);
    
    // Check if this item is a bill header (from description or item code pattern)
    const detectedBill = detectBillHeader(item);
    if (detectedBill) {
      currentBillNumber = detectedBill;
      currentBillName = name;  // Description becomes the bill name
      currentElementCode = '';  // Reset element for new bill
      currentElementName = '';
      currentSectionCode = '';  // Reset section for new bill
      currentSectionName = '';
    }
    
    // Check if this item is a section/element header
    const detectedSection = detectSectionHeader(item);
    if (detectedSection) {
      currentSectionCode = detectedSection.code;
      currentSectionName = detectedSection.name || name;
    }
    
    // Parse hierarchical item code
    // Structure: Bill.Element.Section.WorkItem (4-level hierarchy from item code)
    // Level 1: "1" = Bill 1
    // Level 2: "1.1" = Bill 1, Element 1
    // Level 3: "1.1.1" = Bill 1, Element 1, Section 1
    // Level 4: "1.1.1.1" = Bill 1, Element 1, Section 1, Work Item 1
    const codeParts = (item.itemCode || '').split(/[.\-\/]/).filter(Boolean);
    
    // Use tracked context for hierarchy (inherit from parent levels)
    let billNumber = currentBillNumber;
    let elementCode = currentElementCode;
    let sectionCode = currentSectionCode;
    let workItemCode = '';
    let hierarchyLevel = 0;
    
    // Parse item code to determine hierarchy level
    if (codeParts.length >= 1) {
      // First part is BILL number
      const newBill = codeParts[0];
      if (newBill !== currentBillNumber) {
        // New bill - reset all lower levels
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
      // Second part is ELEMENT code
      const newElement = codeParts[1];
      if (newElement !== currentElementCode) {
        // New element - reset lower levels
        currentElementCode = newElement;
        currentElementName = name;
        currentSectionCode = '';
        currentSectionName = '';
      }
      elementCode = newElement;
      hierarchyLevel = 2;
    }
    
    if (codeParts.length >= 3) {
      // Third part is SECTION code
      const newSection = codeParts[2];
      if (newSection !== currentSectionCode) {
        // New section
        currentSectionCode = newSection;
        currentSectionName = name;
      }
      sectionCode = newSection;
      hierarchyLevel = 3;
    }
    
    if (codeParts.length >= 4) {
      // Fourth+ parts are WORK ITEM code
      workItemCode = codeParts.slice(3).join('.');
      hierarchyLevel = 4;
    }
    
    // If no item code, use tracked context
    if (codeParts.length === 0) {
      billNumber = currentBillNumber;
      elementCode = currentElementCode;
      sectionCode = currentSectionCode;
      // Determine level based on what context we have
      if (currentSectionCode) hierarchyLevel = 4;
      else if (currentElementCode) hierarchyLevel = 3;
      else if (currentBillNumber) hierarchyLevel = 2;
      else hierarchyLevel = 1;
    }
    
    // Build hierarchy path
    const hierarchyPath = [billNumber, elementCode, sectionCode, workItemCode]
      .filter(Boolean)
      .join('.');
    
    // For header rows, use their content as section info
    const isHeader = isHeaderRow(item);
    
    // Determine if this is a Level 3 specification row
    const isSpecificationRow = hierarchyLevel === 3 && !workItemCode;
    
    // Extract or inherit governing specs
    let governingSpecs: GoverningSpecs | undefined;
    const sectionKey = `${billNumber}.${elementCode}.${sectionCode}`;
    
    if (isSpecificationRow) {
      // Level 3: Extract specs from this item and store for inheritance
      const extractedSpecs = extractGoverningSpecs(item);
      if (extractedSpecs) {
        sectionSpecs.set(sectionKey, extractedSpecs);
        governingSpecs = extractedSpecs;
      }
    } else if (hierarchyLevel === 4) {
      // Level 4: Inherit specs from parent Level 3
      governingSpecs = sectionSpecs.get(sectionKey);
    }
    
    // Determine if this item needs enhancement
    // Work items (Level 4) need enhancement if specs are insufficient for material extraction
    const enhancementReasons: string[] = [];
    let needsEnhancement = false;
    
    if (hierarchyLevel === 4 && !isSummary && !isHeader) {
      // Check for critical missing specs
      if (!governingSpecs) {
        enhancementReasons.push('No governing specs from parent section');
        needsEnhancement = true;
      } else {
        // Check for specific missing critical info based on category
        if (!governingSpecs.materialGrade && !governingSpecs.materialType) {
          enhancementReasons.push('Missing material grade or type');
          needsEnhancement = true;
        }
      }
      
      // Check if description is too vague (very short or generic)
      if (name.length < 15 && !specifications) {
        enhancementReasons.push('Description too brief for accurate material extraction');
        needsEnhancement = true;
      }
      
      // Check for generic/ambiguous terms that need clarification
      const vagueTerms = ['supply', 'provide', 'install', 'fix', 'as specified', 'as described', 'ditto', 'as above'];
      const hasVagueTerms = vagueTerms.some(term => item.description.toLowerCase().includes(term));
      if (hasVagueTerms && !governingSpecs?.materialType && !governingSpecs?.materialGrade) {
        enhancementReasons.push('Contains generic terms without specific material specs');
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
    
    // Add cleanup notes
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
      cleanedItem.cleanupNotes.push(`⚠️ Needs enhancement: ${enhancementReasons.join('; ')}`);
    }
    
    // Match formula
    if (opts.matchFormulas && formulas.length > 0 && !isSummary) {
      const match = await findMatchingFormula(cleanedItem, formulas);
      if (match) {
        cleanedItem.suggestedFormula = {
          formulaId: match.formula.id,
          formulaCode: match.formula.code,
          formulaName: match.formula.name,
          matchScore: match.score,
        };
        cleanedItem.suggestedFormulaCode = match.formula.code;
        formulasMatched++;
        
        // Calculate material requirements
        if (opts.calculateMaterials && cleanedItem.quantity > 0) {
          cleanedItem.materialRequirements = calculateMaterialRequirements(
            match.formula,
            cleanedItem.quantity
          );
        }
      }
    }
    
    // Separate summary rows if requested
    if (isSummary && opts.removeSummaryRows) {
      removedSummaryRows.push(cleanedItem);
    } else {
      cleanedItems.push(cleanedItem);
    }
  }
  
  // Calculate stats
  const avgConfidence = cleanedItems.length > 0
    ? cleanedItems.reduce((sum, item) => sum + (item.confidence || 0), 0) / cleanedItems.length
    : 0;
  
  // Calculate additional stats
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
      formulasMatched,
      avgConfidence,
      needsEnhancement: needsEnhancementCount,
      specificationRows: specificationRowsCount,
      workItems: workItemsCount,
    },
  };
}

/**
 * Get confidence color class based on score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 bg-green-50';
  if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
  if (confidence >= 0.4) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

/**
 * Get confidence label based on score
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  if (confidence >= 0.4) return 'Low';
  return 'Very Low';
}
