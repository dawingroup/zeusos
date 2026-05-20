/**
 * Rule-Based Formula Matcher
 * Pattern matching rules for formula suggestions based on BOQ descriptions
 */

import type { StandardFormula } from '../../types';
import { MaterialCategory } from '../../types';

/**
 * Pattern matching rule interface
 */
interface MatchRule {
  patterns: RegExp[];
  formulaCodes: string[];
  boost: number;
  category?: MaterialCategory;
}

/**
 * Comprehensive matching rules for construction BOQ items
 */
const MATCH_RULES: MatchRule[] = [
  // Concrete formulas
  {
    patterns: [
      /concrete\s+(?:grade\s+)?c\s*15/i,
      /c\s*15\s+concrete/i,
      /1\s*:\s*3\s*:\s*6\s+(?:mix|concrete)/i,
      /blinding\s+concrete/i,
    ],
    formulaCodes: ['C15'],
    boost: 0.9,
    category: MaterialCategory.CONCRETE,
  },
  {
    patterns: [
      /concrete\s+(?:grade\s+)?c\s*20/i,
      /c\s*20\s+concrete/i,
      /1\s*:\s*2\s*:\s*4\s+(?:mix|concrete)/i,
      /structural\s+concrete.*(?:floor|slab)/i,
    ],
    formulaCodes: ['C20'],
    boost: 0.9,
    category: MaterialCategory.CONCRETE,
  },
  {
    patterns: [
      /concrete\s+(?:grade\s+)?c\s*25/i,
      /c\s*25\s+concrete/i,
      /1\s*:\s*1\.5\s*:\s*3\s+(?:mix|concrete)/i,
      /reinforced\s+concrete/i,
      /r\.?c\s+(?:column|beam|slab)/i,
    ],
    formulaCodes: ['C25'],
    boost: 0.9,
    category: MaterialCategory.CONCRETE,
  },
  {
    patterns: [
      /concrete\s+(?:grade\s+)?c\s*30/i,
      /c\s*30\s+concrete/i,
      /high\s+strength\s+concrete/i,
    ],
    formulaCodes: ['C30'],
    boost: 0.9,
    category: MaterialCategory.CONCRETE,
  },
  
  // Masonry - Bricks
  {
    patterns: [
      /(?:half\s+)?brick\s+wall.*150\s*mm/i,
      /150\s*mm.*brick\s+wall/i,
      /brick.*(?:work|masonry).*half\s+brick/i,
      /4\.5\s*(?:inch|")\s+brick/i,
    ],
    formulaCodes: ['BRICK_150'],
    boost: 0.85,
    category: MaterialCategory.MASONRY,
  },
  {
    patterns: [
      /(?:one\s+)?brick\s+wall.*230\s*mm/i,
      /230\s*mm.*brick\s+wall/i,
      /brick.*(?:work|masonry).*one\s+brick/i,
      /9\s*(?:inch|")\s+brick/i,
      /full\s+brick\s+wall/i,
    ],
    formulaCodes: ['BRICK_230'],
    boost: 0.85,
    category: MaterialCategory.MASONRY,
  },
  
  // Masonry - Blocks
  {
    patterns: [
      /block\s+wall.*150\s*mm/i,
      /150\s*mm.*block\s+wall/i,
      /6\s*(?:inch|")\s+block/i,
      /hollow\s+block.*150/i,
    ],
    formulaCodes: ['BLOCK_150'],
    boost: 0.85,
    category: MaterialCategory.MASONRY,
  },
  {
    patterns: [
      /block\s+wall.*200\s*mm/i,
      /200\s*mm.*block\s+wall/i,
      /8\s*(?:inch|")\s+block/i,
      /hollow\s+block.*200/i,
    ],
    formulaCodes: ['BLOCK_200'],
    boost: 0.85,
    category: MaterialCategory.MASONRY,
  },
  
  // Steel - Rebar
  {
    patterns: [
      /(?:rebar|reinforcement|steel\s+bar).*(?:y|t)\s*10/i,
      /(?:y|t)\s*10\s+(?:bars?|rebar|reinforcement)/i,
      /10\s*mm.*(?:dia|diameter).*(?:bar|rebar|steel)/i,
      /high\s+yield.*10\s*mm/i,
    ],
    formulaCodes: ['REBAR_Y10'],
    boost: 0.85,
    category: MaterialCategory.STEEL,
  },
  {
    patterns: [
      /(?:rebar|reinforcement|steel\s+bar).*(?:y|t)\s*12/i,
      /(?:y|t)\s*12\s+(?:bars?|rebar|reinforcement)/i,
      /12\s*mm.*(?:dia|diameter).*(?:bar|rebar|steel)/i,
      /high\s+yield.*12\s*mm/i,
    ],
    formulaCodes: ['REBAR_Y12'],
    boost: 0.85,
    category: MaterialCategory.STEEL,
  },
  {
    patterns: [
      /(?:rebar|reinforcement|steel\s+bar).*(?:y|t)\s*16/i,
      /(?:y|t)\s*16\s+(?:bars?|rebar|reinforcement)/i,
      /16\s*mm.*(?:dia|diameter).*(?:bar|rebar|steel)/i,
      /high\s+yield.*16\s*mm/i,
      /main\s+(?:bar|reinforcement)/i,
    ],
    formulaCodes: ['REBAR_Y16'],
    boost: 0.85,
    category: MaterialCategory.STEEL,
  },
  {
    patterns: [
      /brc\s+mesh/i,
      /welded\s+mesh/i,
      /fabric\s+reinforcement/i,
      /wire\s+mesh\s+reinforcement/i,
    ],
    formulaCodes: ['BRC_MESH'],
    boost: 0.85,
    category: MaterialCategory.STEEL,
  },
  
  // Finishes - Plastering
  {
    patterns: [
      /plaster.*12\s*mm/i,
      /12\s*mm.*plaster/i,
      /internal\s+plaster/i,
      /(?:ceiling|soffit)\s+plaster/i,
      /render.*12/i,
    ],
    formulaCodes: ['PLASTER_12'],
    boost: 0.85,
    category: MaterialCategory.FINISHES,
  },
  {
    patterns: [
      /plaster.*20\s*mm/i,
      /20\s*mm.*plaster/i,
      /external\s+plaster/i,
      /(?:rough\s+cast|roughcast)/i,
      /render.*20/i,
    ],
    formulaCodes: ['PLASTER_20'],
    boost: 0.85,
    category: MaterialCategory.FINISHES,
  },
  
  // Finishes - Flooring
  {
    patterns: [
      /floor\s+screed.*50\s*mm/i,
      /50\s*mm.*screed/i,
      /cement\s+sand\s+screed/i,
      /leveling\s+screed/i,
    ],
    formulaCodes: ['FLOOR_SCREED_50'],
    boost: 0.85,
    category: MaterialCategory.FINISHES,
  },
  {
    patterns: [
      /(?:floor|wall)\s+tile/i,
      /ceramic\s+tile/i,
      /porcelain\s+tile/i,
      /tiling.*(?:floor|wall)/i,
    ],
    formulaCodes: ['FLOOR_TILE_CERAMIC'],
    boost: 0.80,
    category: MaterialCategory.FINISHES,
  },
  
  // Roofing
  {
    patterns: [
      /iron\s+sheet.*(?:roofing|roof)/i,
      /corrugated\s+iron/i,
      /g\.?i\s+sheet/i,
      /(?:roofing|roof).*iron\s+sheet/i,
      /28\s*(?:gauge|g).*sheet/i,
    ],
    formulaCodes: ['ROOF_IRON_28G'],
    boost: 0.85,
    category: MaterialCategory.ROOFING,
  },
  {
    patterns: [
      /roof\s+tile/i,
      /clay\s+tile.*roof/i,
      /concrete\s+tile.*roof/i,
      /tile\s+roofing/i,
    ],
    formulaCodes: ['ROOF_TILES'],
    boost: 0.80,
    category: MaterialCategory.ROOFING,
  },
  
  // Earthworks
  {
    patterns: [
      /excavat.*foundation/i,
      /foundation.*excavat/i,
      /trench.*excavat/i,
      /excavat.*trench/i,
      /cut\s+to\s+foundation/i,
    ],
    formulaCodes: ['EXCAVATE_FOUNDATION'],
    boost: 0.85,
    category: MaterialCategory.EARTHWORKS,
  },
  {
    patterns: [
      /backfill.*compact/i,
      /compact.*backfill/i,
      /selected\s+fill/i,
      /fill.*compact/i,
      /hardcore.*filling/i,
    ],
    formulaCodes: ['BACKFILL_COMPACT'],
    boost: 0.85,
    category: MaterialCategory.EARTHWORKS,
  },
  
  // Painting
  {
    patterns: [
      /emulsion.*paint/i,
      /paint.*emulsion/i,
      /interior.*paint/i,
      /plastic\s+paint/i,
      /water\s+based\s+paint/i,
    ],
    formulaCodes: ['PAINT_EMULSION'],
    boost: 0.80,
    category: MaterialCategory.FINISHES,
  },
  {
    patterns: [
      /gloss.*paint/i,
      /oil\s+paint/i,
      /enamel.*paint/i,
      /paint.*(?:door|window|metal)/i,
    ],
    formulaCodes: ['PAINT_GLOSS'],
    boost: 0.80,
    category: MaterialCategory.FINISHES,
  },
];

/**
 * Extract keywords from description
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'including', 'etc', 'as', 'per', 'all', 'any', 'item', 'work',
  ]);
  
  return description
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Result from rule-based matching
 */
export interface RuleMatchResult {
  formulaCode: string;
  confidence: number;
  matchedPatterns: string[];
  category?: MaterialCategory;
}

/**
 * Match description against rules
 */
export function matchByRules(
  description: string,
  formulas: StandardFormula[]
): RuleMatchResult[] {
  const results: RuleMatchResult[] = [];
  const normalizedDesc = description.toLowerCase().trim();
  
  for (const rule of MATCH_RULES) {
    const matchedPatterns: string[] = [];
    
    for (const pattern of rule.patterns) {
      if (pattern.test(normalizedDesc)) {
        matchedPatterns.push(pattern.source);
      }
    }
    
    if (matchedPatterns.length > 0) {
      for (const formulaCode of rule.formulaCodes) {
        // Verify formula exists
        const formula = formulas.find(f => f.code === formulaCode);
        if (formula) {
          // Calculate confidence based on number of matched patterns
          const baseConfidence = rule.boost;
          const patternBonus = Math.min(0.1, (matchedPatterns.length - 1) * 0.03);
          
          results.push({
            formulaCode,
            confidence: Math.min(0.95, baseConfidence + patternBonus),
            matchedPatterns,
            category: rule.category,
          });
        }
      }
    }
  }
  
  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Fuzzy match by category and keywords
 */
export function matchByKeywords(
  description: string,
  formulas: StandardFormula[]
): RuleMatchResult[] {
  const keywords = extractKeywords(description);
  const results: RuleMatchResult[] = [];
  
  for (const formula of formulas) {
    const formulaKeywords = extractKeywords(
      `${formula.name} ${formula.description || ''}` 
    );
    
    // Count matching keywords
    const matchCount = keywords.filter(kw => 
      formulaKeywords.some(fkw => 
        fkw.includes(kw) || kw.includes(fkw)
      )
    ).length;
    
    if (matchCount >= 2) {
      const confidence = Math.min(0.7, 0.3 + (matchCount * 0.1));
      results.push({
        formulaCode: formula.code,
        confidence,
        matchedPatterns: [`keyword_match:${matchCount}`],
        category: formula.category as any,
      });
    }
  }
  
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get unit-based category hints
 */
export function getCategoryFromUnit(unit: string): MaterialCategory | null {
  const unitMap: Record<string, MaterialCategory> = {
    'm³': MaterialCategory.CONCRETE,
    'm3': MaterialCategory.CONCRETE,
    'cum': MaterialCategory.CONCRETE,
    'kg': MaterialCategory.STEEL,
    't': MaterialCategory.STEEL,
    'ton': MaterialCategory.STEEL,
    'm²': MaterialCategory.FINISHES,
    'm2': MaterialCategory.FINISHES,
    'sqm': MaterialCategory.FINISHES,
    'nr': MaterialCategory.MASONRY,
    'no': MaterialCategory.MASONRY,
    'l.m': MaterialCategory.STEEL,
    'lm': MaterialCategory.STEEL,
    'rm': MaterialCategory.STEEL,
  };
  
  return unitMap[unit.toLowerCase()] || null;
}
