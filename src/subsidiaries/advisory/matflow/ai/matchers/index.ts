/**
 * Combined Formula Matcher
 * Integrates rule-based, keyword, and semantic matching strategies
 */

import type { StandardFormula } from '../../types';
import { MaterialCategory } from '../../types';
import { matchByRules, matchByKeywords, getCategoryFromUnit } from './ruleBased';
import { matchSemantically } from './semantic';

export type { RuleMatchResult } from './ruleBased';
export type { SemanticMatchResult } from './semantic';

/**
 * Combined formula suggestion
 */
export interface FormulaSuggestion {
  formulaCode: string;
  formulaName: string;
  category: MaterialCategory;
  confidence: number;
  source: 'rule' | 'keyword' | 'semantic' | 'combined';
  reasoning?: string;
  matchDetails?: string[];
}

/**
 * Options for formula matching
 */
export interface MatchOptions {
  enableRules?: boolean;
  enableKeywords?: boolean;
  enableSemantic?: boolean;
  maxSuggestions?: number;
  minConfidence?: number;
}

const DEFAULT_OPTIONS: MatchOptions = {
  enableRules: true,
  enableKeywords: true,
  enableSemantic: true,
  maxSuggestions: 5,
  minConfidence: 0.3,
};

/**
 * Get formula suggestions using all available matching strategies
 */
export async function getFormulaSuggestions(
  description: string,
  unit: string,
  formulas: StandardFormula[],
  options?: MatchOptions
): Promise<FormulaSuggestion[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const suggestions: Map<string, FormulaSuggestion> = new Map();
  
  // Get category hint from unit
  const categoryHint = getCategoryFromUnit(unit);
  
  // 1. Rule-based matching (fast, high precision)
  if (opts.enableRules) {
    const ruleMatches = matchByRules(description, formulas);
    for (const match of ruleMatches) {
      const formula = formulas.find(f => f.code === match.formulaCode);
      if (formula) {
        suggestions.set(match.formulaCode, {
          formulaCode: match.formulaCode,
          formulaName: formula.name,
          category: formula.category as MaterialCategory,
          confidence: match.confidence,
          source: 'rule',
          matchDetails: match.matchedPatterns,
        });
      }
    }
  }
  
  // 2. Keyword matching (fallback)
  if (opts.enableKeywords) {
    const keywordMatches = matchByKeywords(description, formulas);
    for (const match of keywordMatches) {
      if (!suggestions.has(match.formulaCode)) {
        const formula = formulas.find(f => f.code === match.formulaCode);
        if (formula) {
          suggestions.set(match.formulaCode, {
            formulaCode: match.formulaCode,
            formulaName: formula.name,
            category: formula.category as MaterialCategory,
            confidence: match.confidence,
            source: 'keyword',
            matchDetails: match.matchedPatterns,
          });
        }
      }
    }
  }
  
  // 3. Semantic matching (for ambiguous cases)
  if (opts.enableSemantic && suggestions.size < opts.maxSuggestions!) {
    try {
      const semanticResult = await matchSemantically(description, unit, formulas, {
        maxSuggestions: opts.maxSuggestions! - suggestions.size,
        minConfidence: opts.minConfidence,
      });
      
      for (const match of semanticResult.suggestions) {
        if (!suggestions.has(match.formulaCode)) {
          const formula = formulas.find(f => f.code === match.formulaCode);
          if (formula) {
            suggestions.set(match.formulaCode, {
              formulaCode: match.formulaCode,
              formulaName: formula.name,
              category: formula.category as MaterialCategory,
              confidence: match.confidence * 0.9, // Slightly discount semantic confidence
              source: 'semantic',
              reasoning: match.reasoning,
            });
          }
        } else {
          // Combine with existing - boost confidence
          const existing = suggestions.get(match.formulaCode)!;
          existing.confidence = Math.min(0.98, existing.confidence + match.confidence * 0.15);
          existing.source = 'combined';
          existing.reasoning = match.reasoning;
        }
      }
    } catch (error) {
      console.warn('Semantic matching failed, using rule-based results only');
    }
  }
  
  // Apply category hint boost
  if (categoryHint) {
    for (const suggestion of suggestions.values()) {
      if (suggestion.category === categoryHint) {
        suggestion.confidence = Math.min(0.99, suggestion.confidence + 0.05);
      }
    }
  }
  
  // Sort and limit
  return Array.from(suggestions.values())
    .filter(s => s.confidence >= opts.minConfidence!)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, opts.maxSuggestions);
}

/**
 * Quick match using only rules (for real-time suggestions)
 */
export function getQuickSuggestions(
  description: string,
  unit: string,
  formulas: StandardFormula[],
  maxResults: number = 3
): FormulaSuggestion[] {
  const ruleMatches = matchByRules(description, formulas);
  const categoryHint = getCategoryFromUnit(unit);
  
  const suggestions: FormulaSuggestion[] = ruleMatches
    .slice(0, maxResults)
    .map(match => {
      const formula = formulas.find(f => f.code === match.formulaCode)!;
      let confidence = match.confidence;
      
      if (categoryHint && formula.category === categoryHint) {
        confidence = Math.min(0.99, confidence + 0.05);
      }
      
      return {
        formulaCode: match.formulaCode,
        formulaName: formula.name,
        category: formula.category as MaterialCategory,
        confidence,
        source: 'rule' as const,
        matchDetails: match.matchedPatterns,
      };
    });
  
  return suggestions;
}
